-- ═══════════════════════════════════════════════════
-- Refresh Tokens — Хранение refresh токенов для JWT
-- ═══════════════════════════════════════════════════

-- 1. Создание таблицы
CREATE TABLE IF NOT EXISTS shveyka.refresh_tokens (
    id              BIGSERIAL PRIMARY KEY,
    token_hash      VARCHAR(64)     NOT NULL UNIQUE,   -- SHA-256 hash токена
    user_id         INTEGER         NOT NULL,          -- ID пользователя из users.id
    employee_id     INTEGER,                            -- ID сотрудника (если есть)
    
    -- Device fingerprinting
    user_agent      VARCHAR(500),                       -- User-Agent браузера
    ip_address      VARCHAR(45),                        -- IP адрес
    
    -- Timestamps
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    expires_at      TIMESTAMPTZ     NOT NULL,           -- Срок действия (7 дней)
    
    -- Revocation
    revoked_at      TIMESTAMPTZ,                        -- Когда отозван
    revoked_reason  VARCHAR(50),                        -- Причина: 'logout', 'security', 'password_change', 'rotated'
    replaced_by     VARCHAR(64)                         -- Hash нового токена (для replay detection)
);

-- 2. Индексы
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_hash ON shveyka.refresh_tokens (token_hash) 
    WHERE revoked_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_active ON shveyka.refresh_tokens (user_id, created_at DESC) 
    WHERE revoked_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_cleanup ON shveyka.refresh_tokens (expires_at);

-- 3. Функции

-- Атомарная ротация токена с обнаружением replay атак
CREATE OR REPLACE FUNCTION shveyka.rotate_refresh_token(
    p_token_hash VARCHAR(64),
    p_new_token_hash VARCHAR(64),
    p_user_agent VARCHAR(500),
    p_ip_address VARCHAR(45)
) RETURNS TABLE (
    success BOOLEAN,
    user_id INTEGER,
    employee_id INTEGER,
    was_replayed BOOLEAN,
    message TEXT
) AS $$
DECLARE
    v_token RECORD;
    v_was_replayed BOOLEAN := FALSE;
BEGIN
    -- Блокируем строку для update
    SELECT * INTO v_token 
    FROM shveyka.refresh_tokens 
    WHERE token_hash = p_token_hash
    FOR UPDATE;
    
    -- Токен не найден
    IF NOT FOUND THEN
        RETURN QUERY SELECT FALSE, NULL::INTEGER, NULL::INTEGER, FALSE, 'Token not found'::TEXT;
        RETURN;
    END IF;
    
    -- Токен уже отозван - возможно replay атака
    IF v_token.revoked_at IS NOT NULL THEN
        -- Проверяем, не был ли токен уже заменен другим (rotated)
        IF v_token.revoked_reason = 'rotated' THEN
            -- Это replay атака! Кто-то использует старый токен
            v_was_replayed := TRUE;
            
            -- Логируем инцидент безопасности
            INSERT INTO shveyka.error_logs (level, message, context, user_id, employee_id, ip_address)
            VALUES (
                'error',
                'Potential replay attack detected',
                jsonb_build_object('token_hash', p_token_hash, 'original_revoked_at', v_token.revoked_at),
                v_token.user_id,
                v_token.employee_id,
                p_ip_address
            );
        END IF;
        
        RETURN QUERY SELECT FALSE, NULL::INTEGER, NULL::INTEGER, v_was_replayed, 'Token revoked'::TEXT;
        RETURN;
    END IF;
    
    -- Токен истек
    IF v_token.expires_at < NOW() THEN
        RETURN QUERY SELECT FALSE, NULL::INTEGER, NULL::INTEGER, FALSE, 'Token expired'::TEXT;
        RETURN;
    END IF;
    
    -- Ротируем токен: помечаем старый как отозванный
    UPDATE shveyka.refresh_tokens 
    SET 
        revoked_at = NOW(),
        revoked_reason = 'rotated',
        replaced_by = p_new_token_hash
    WHERE id = v_token.id;
    
    -- Вставляем новый токен
    INSERT INTO shveyka.refresh_tokens (
        token_hash, 
        user_id, 
        employee_id, 
        user_agent, 
        ip_address, 
        expires_at
    ) VALUES (
        p_new_token_hash,
        v_token.user_id,
        v_token.employee_id,
        p_user_agent,
        p_ip_address,
        NOW() + INTERVAL '7 days'
    );
    
    RETURN QUERY SELECT TRUE, v_token.user_id, v_token.employee_id, FALSE, 'Token rotated'::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Отзыв всех токенов пользователя
CREATE OR REPLACE FUNCTION shveyka.revoke_all_user_tokens(
    p_user_id INTEGER,
    p_reason VARCHAR(50)
) RETURNS INTEGER AS $$
DECLARE
    v_count INTEGER;
BEGIN
    UPDATE shveyka.refresh_tokens 
    SET revoked_at = NOW(), revoked_reason = p_reason
    WHERE user_id = p_user_id 
      AND revoked_at IS NULL;
    
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
