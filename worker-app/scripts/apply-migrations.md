# Инструкция по применению SQL миграций

## Шаг 1: Откройте Supabase Dashboard

Перейдите в Supabase Dashboard вашего проекта.

## Шаг 2: Выполните SQL файлы по порядку

Откройте SQL Editor и выполните содержимое файлов:

1. `docs/schemas/error_logs.sql`
2. `docs/schemas/refresh_tokens.sql`
3. `docs/schemas/rate_limits.sql`

## Шаг 3: Проверьте создание таблиц

```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'shveyka' 
AND table_name IN ('error_logs', 'refresh_tokens', 'rate_limits');
```

Ожидается: 3 строки.

## Шаг 4: Запустите приложение

```bash
npm run dev
```
