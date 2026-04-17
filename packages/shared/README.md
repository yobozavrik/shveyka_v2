# @shveyka/shared

Спільні типи, константи та логіка для CRM та Worker App.

## Типи бази даних

Типи згенеровані автоматично з Supabase.

### Генерація типів

Для генерації типів використовуйте одну з команд у корені проекту. Скрипти адаптовані для Windows (PowerShell) та Unix за допомогою `cross-env`.

#### 1. Локально (потрібен Docker)
```powershell
npm run db:types
```

#### 2. Supabase Cloud (потрібен SUPABASE_PROJECT_ID)
Спочатку увійдіть: `npm run supabase:login`
Скрипт також автоматично шукає `SUPABASE_PROJECT_ID` у `.env.local/.env` (root, `crm`, `worker-app`), якщо змінна не задана в поточній сесії.

**PowerShell:**
```powershell
$env:SUPABASE_PROJECT_ID="ваш-ід"; npm run db:types:remote
```

**Bash:**
```bash
SUPABASE_PROJECT_ID="ваш-ід" npm run db:types:remote
```

#### 3. Через URL бази даних (Self-hosted)
Найбільш підходящий варіант для вашого VPS.
Скрипт автоматично бере `DATABASE_URL` з поточної сесії або з `.env.local/.env` (root, `crm`, `worker-app`).

**PowerShell:**
```powershell
$env:DATABASE_URL="postgresql://postgres:pass@host:5432/postgres"; npm run db:types:url
```

**Bash:**
```bash
DATABASE_URL="postgresql://postgres:pass@host:5432/postgres" npm run db:types:url
```

Типи будуть збережені у `src/types/database.ts` та доступні через основний експорт пакета.

## Використання

```typescript
import { Database } from '@shveyka/shared';

type Employee = Database['public']['Tables']['employees']['Row'];
```
