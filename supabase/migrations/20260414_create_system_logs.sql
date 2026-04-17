-- Таблица системного логирования для Shveyka MES
-- Хранит все действия пользователей, ошибки и аудит-события

CREATE TABLE IF NOT EXISTS shveyka.system_logs (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  level TEXT NOT NULL CHECK (level IN ('info', 'warn', 'error', 'debug', 'audit')),
  message TEXT NOT NULL,
  module TEXT NOT NULL,
  action TEXT NOT NULL,
  user_id BIGINT,
  username TEXT,
  entity_id TEXT,
  entity_type TEXT,
  data JSONB,
  error_message TEXT,
  request_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Индексы для быстрого поиска
CREATE INDEX IF NOT EXISTS idx_system_logs_level ON shveyka.system_logs(level);
CREATE INDEX IF NOT EXISTS idx_system_logs_created ON shveyka.system_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_system_logs_user ON shveyka.system_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_system_logs_module ON shveyka.system_logs(module);
CREATE INDEX IF NOT EXISTS idx_system_logs_entity ON shveyka.system_logs(entity_type, entity_id);

-- Политика RLS (только admin/manager могут читать логи)
ALTER TABLE shveyka.system_logs ENABLE ROW LEVEL SECURITY;

-- Админ видит всё
CREATE POLICY admin_see_all_logs ON shveyka.system_logs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM shveyka.users u
      WHERE u.id = auth.uid() AND u.role IN ('admin', 'manager')
    )
  );

-- Приложение может писать логи через service_role
-- (RLS bypass для серверных запросов)
