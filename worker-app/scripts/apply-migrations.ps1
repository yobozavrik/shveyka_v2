# Инструкция по применению SQL миграций

## Шаг 1: Откройте Supabase Dashboard

Перейдите в: https://supabase.dmytrotovstytskyi.online/dashboard

Или используйте локальный клиент PostgreSQL:
```bash
psql -h supabase.dmytrotovstytskyi.online -U postgres -d shveyka
```

## Шаг 2: Выполните SQL файлы по порядку

### 2.1 Error Logs
Выполните содержимое файла: `docs/schemas/error_logs.sql`

### 2.2 Refresh Tokens
Выполните содержимое файла: `docs/schemas/refresh_tokens.sql`

### 2.3 Rate Limits
Выполните содержимое файла: `docs/schemas/rate_limits.sql`

## Шаг 3: Проверьте создание таблиц

```sql
-- Проверить все таблицы
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'shveyka' 
AND table_name IN ('error_logs', 'refresh_tokens', 'rate_limits');

-- Ожидается: 3 строки
```

## Шаг 4: Проверьте функции

```sql
-- Проверить PL/pgSQL функции
SELECT routine_name, routine_type
FROM information_schema.routines
WHERE routine_schema = 'shveyka'
AND routine_name IN ('rotate_refresh_token', 'revoke_all_user_tokens', 'check_rate_limit', 'check_rate_limit_with_cleanup');

-- Ожидается: 4 функции
```

## Шаг 5: Запустите приложение

```bash
npm run dev
```

Приложение должно запуститься на порту 3005.

## Шаг 6: Протестируйте

Откройте браузер и перейдите на http://localhost:3005

Или используйте curl для проверки API endpoints.
