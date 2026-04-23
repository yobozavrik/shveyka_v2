-- ═══════════════════════════════════════════════════
-- Error Logs — Централизованное логирование ошибок
-- ═══════════════════════════════════════════════════
-- Назначение: Хранение всех ошибок приложения для
--             мониторинга, отладки и аудита.

CREATE TABLE IF NOT EXISTS shveyka.error_logs (
    id              BIGSERIAL PRIMARY KEY,
    level           VARCHAR(10)     NOT NULL,          -- 'debug', 'info', 'warn', 'error'
    message         TEXT            NOT NULL,          -- Сообщение ошибки
    context         JSONB,                              -- Контекст (userId, requestId, endpoint)
    error_data      JSONB,                              -- Данные ошибки (name, message, stack)
    metadata        JSONB,                              -- Дополнительные метаданные
    
    request_id      VARCHAR(36),                        -- Уникальный ID запроса
    user_id         INTEGER,                            -- ID пользователя
    employee_id     INTEGER,                            -- ID сотрудника
    endpoint        VARCHAR(200),                       -- API endpoint
    action          VARCHAR(100),                       -- Действие (login, create_entry)
    
    ip_address      VARCHAR(45),                        -- IP адрес клиента
    user_agent      VARCHAR(500),                       -- User-Agent
    
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════
-- Индексы для быстрого поиска
-- ═══════════════════════════════════════════════════

-- Поиск по уровню и дате
CREATE INDEX idx_error_logs_level_date ON shveyka.error_logs (level, created_at DESC);

-- Поиск по сотруднику
CREATE INDEX idx_error_logs_employee ON shveyka.error_logs (employee_id, created_at DESC);

-- Поиск по request_id
CREATE INDEX idx_error_logs_request ON shveyka.error_logs (request_id);

-- Поиск по endpoint
CREATE INDEX idx_error_logs_endpoint ON shveyka.error_logs (endpoint, created_at DESC);

-- ═══════════════════════════════════════════════════
-- Уровни логирования
-- ═══════════════════════════════════════════════════
--
-- debug   — Детальная информация для отладки (только в development)
-- info    — Информационные сообщения (запуск, shutdown)
-- warn    — Предупреждения (deprecated API, retry succeeded)
-- error   — Ошибки, требующие внимания (failed DB query, API error)
--

-- ═══════════════════════════════════════════════════
-- Примеры запросов
-- ═══════════════════════════════════════════════════

-- Последние 100 ошибок
-- SELECT * FROM shveyka.error_logs 
-- WHERE level = 'error' 
-- ORDER BY created_at DESC 
-- LIMIT 100;

-- Ошибки по сотруднику за неделю
-- SELECT * FROM shveyka.error_logs 
-- WHERE employee_id = 42 
--   AND created_at > NOW() - INTERVAL '7 days'
-- ORDER BY created_at DESC;

-- Топ endpoint'ов по ошибкам
-- SELECT endpoint, COUNT(*) as error_count
-- FROM shveyka.error_logs
-- WHERE level = 'error'
--   AND created_at > NOW() - INTERVAL '24 hours'
-- GROUP BY endpoint
-- ORDER BY error_count DESC;

-- Очистка старых логов (cron, раз в неделю)
-- DELETE FROM shveyka.error_logs 
-- WHERE created_at < NOW() - INTERVAL '30 days';
