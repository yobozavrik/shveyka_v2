# SQL Migration Instructions

## Apply Migrations

1. Open Supabase Dashboard: https://supabase.dmytrotovstytskyi.online/dashboard
2. Go to SQL Editor
3. Copy and execute each file in order:

### Step 1: error_logs.sql
Copy entire content of docs/schemas/error_logs.sql

### Step 2: refresh_tokens.sql
Copy entire content of docs/schemas/refresh_tokens.sql

### Step 3: rate_limits.sql
Copy entire content of docs/schemas/rate_limits.sql

## Verify

Execute this SQL to check tables:
SELECT table_name FROM information_schema.tables WHERE table_schema = 'shveyka' AND table_name IN ('error_logs', 'refresh_tokens', 'rate_limits');
Expected: 3 rows

## Test Rate Limiting

After migrations and app restart:
npm run dev

Send 6 login requests rapidly - first 5 should be 401, 6th should be 429.

## Summary

All code changes complete. Build successful. Next: apply SQL migrations manually.
