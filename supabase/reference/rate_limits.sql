-- ═══════════════════════════════════════════════════
-- Rate Limits — Защита от brute force и DDoS
-- ═══════════════════════════════════════════════════
-- Назначение: Хранение счетчиков запросов для rate limiting
--             без внешнего Redis (только Supabase)

CREATE TABLE IF NOT EXISTS shveyka.rate_limits (
    id              BIGSERIAL PRIMARY KEY,
    key             VARCHAR(200)    NOT NULL,          -- Идентификатор: IP или user_id
    action          VARCHAR(50)     NOT NULL,          -- Действие: 'login', 'refresh', 'entries'
    window_start    TIMESTAMPTZ     NOT NULL,          -- Начало временного окна (aligned to minute)
    request_count   INTEGER         NOT NULL DEFAULT 1,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    
    CONSTRAINT rate_limits_unique UNIQUE (key, action, window_start)
);

-- ═══════════════════════════════════════════════════
-- Индексы
-- ═══════════════════════════════════════════════════

-- Быстрый поиск по key + action
CREATE INDEX idx_rate_limits_lookup ON shveyka.rate_limits (key, action, window_start DESC);

-- Для cleanup
CREATE INDEX idx_rate_limits_cleanup ON shveyka.rate_limits (created_at);

-- ═══════════════════════════════════════════════════
-- Константы лимитов
-- ═══════════════════════════════════════════════════
--
-- login:   5 попыток / 1 минута (по IP)
-- refresh: 10 попыток / 1 минута (по IP)
-- entries: 100 запросов / 1 минута (по employee_id)
--

-- ═══════════════════════════════════════════════════
-- PL/pgSQL функция атомарной проверки
-- ═══════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION shveyka.check_rate_limit(
    p_key VARCHAR(200),
    p_action VARCHAR(50),
    p_max_requests INTEGER,
    p_window_seconds INTEGER
) RETURNS TABLE (
    allowed BOOLEAN,
    current_count INTEGER,
    limit_max INTEGER,
    remaining INTEGER,
    reset_at TIMESTAMPTZ,
    retry_after INTEGER
) AS $$
DECLARE
    v_window_start TIMESTAMPTZ;
    v_count INTEGER;
    v_reset TIMESTAMPTZ;
    v_retry_after INTEGER;
BEGIN
    -- Вычисляем начало временного окна (fixed window, aligned to minute)
    v_window_start := date_trunc('minute', NOW());
    v_reset := v_window_start + (p_window_seconds || ' seconds')::INTERVAL;
    
    -- Атомарно инкрементируем или вставляем
    INSERT INTO shveyka.rate_limits (key, action, window_start, request_count)
    VALUES (p_key, p_action, v_window_start, 1)
    ON CONFLICT (key, action, window_start) 
    DO UPDATE SET request_count = shveyka.rate_limits.request_count + 1
    RETURNING shveyka.rate_limits.request_count INTO v_count;
    
    -- Вычисляем retry_after если превышен лимит
    IF v_count > p_max_requests THEN
        v_retry_after := EXTRACT(EPOCH FROM (v_reset - NOW()))::INTEGER;
    ELSE
        v_retry_after := 0;
    END IF;
    
    -- Возвращаем результат
    RETURN QUERY SELECT 
        v_count <= p_max_requests,           -- allowed
        v_count,                              -- current_count
        p_max_requests,                       -- limit_max
        GREATEST(0, p_max_requests - v_count), -- remaining
        v_reset,                              -- reset_at
        v_retry_after;                        -- retry_after
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ═══════════════════════════════════════════════════
-- Cleanup (cron job или lazy cleanup)
-- ═══════════════════════════════════════════════════

-- Удаляем записи старше 2 минут
-- DELETE FROM shveyka.rate_limits 
-- WHERE created_at < NOW() - INTERVAL '2 minutes';

-- Или вызывать cleanup внутри функции:
CREATE OR REPLACE FUNCTION shveyka.check_rate_limit_with_cleanup(
    p_key VARCHAR(200),
    p_action VARCHAR(50),
    p_max_requests INTEGER,
    p_window_seconds INTEGER
) RETURNS TABLE (
    allowed BOOLEAN,
    current_count INTEGER,
    limit_max INTEGER,
    remaining INTEGER,
    reset_at TIMESTAMPTZ,
    retry_after INTEGER
) AS $$
BEGIN
    -- Сначала cleanup (lazy)
    DELETE FROM shveyka.rate_limits 
    WHERE created_at < NOW() - INTERVAL '5 minutes';
    
    -- Затем проверка
    RETURN QUERY SELECT * FROM shveyka.check_rate_limit(
        p_key, p_action, p_max_requests, p_window_seconds
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ═══════════════════════════════════════════════════
-- Примеры использования
-- ═══════════════════════════════════════════════════

-- Проверка лимита для login по IP
-- SELECT * FROM shveyka.check_rate_limit('ip:192.168.1.1', 'login', 5, 60);

-- Проверка лимита для entries по employee_id
-- SELECT * FROM shveyka.check_rate_limit('user:42', 'entries', 100, 60);

-- Результат:
-- allowed | current_count | limit_max | remaining | reset_at           | retry_after
-- --------|---------------|-----------|-----------|--------------------|------------
-- true    | 3             | 5         | 2         | 2024-04-16 19:17:00| 0
-- false   | 6             | 5         | 0         | 2024-04-16 19:17:00| 45
