# ADR-001: Розбіжність даних між task_entries та operation_entries

## Статус
**PROPOSED** → Очікує реалізації

## Дата
2026-04-11

## Контекст

У квітні 2026 була впроваджена нова модель виконання виробництва через таблиці:
- `shveyka.production_stages`
- `shveyka.stage_operations`
- `shveyka.batch_tasks`
- `shveyka.task_entries`
- `shveyka.cutting_nastils` (legacy mirror)
- `shveyka.employee_activity_log`

Ця модель замінила стару систему через `public.operation_entries`.

## Проблема

17 API роутів досі читають дані з `public.operation_entries`, тоді як нові записи працівників йдуть в `shveyka.task_entries`:

| API | Джерело даних | Статус |
|-----|---------------|--------|
| `GET /api/analytics/dashboard` | `operation_entries` | ❌ Не бачить нових записів |
| `GET /api/analytics/employees/{id}/stats` | `operation_entries` | ❌ |
| `GET /api/payroll/*` | `operation_entries` | ❌ Зарплата не рахується |
| `GET /api/entries` | `operation_entries` | ❌ |
| `POST /api/entries/approve` | `operation_entries` | ❌ |
| `GET /api/production-orders/{id}` | `production_orders` | ✅ |
| `GET /api/batches/{id}/stages` | `batch_tasks` + `task_entries` | ✅ |

### Наслідки

1. **Зарплата не рахується** — payroll API читає `operation_entries`, а дані йдуть в `task_entries`
2. **Аналітика показує 0** — dashboard analytics не бачить підтверджених записів
3. **AI-асистент дає неправильні відповіді** — використовує старі дані
4. **Подвійний запис** — якщо працівник працює, його виробіток не відображається ніде

## Розглянуті варіанти

### Варіант A: Перемикнути всі API на task_entries
**Плюси:**
- Єдине джерело правди
- Ніякої дублікації
- Дані актуальні

**Мінуси:**
- Потрібно переписати 17 API роутів
- Потрібно переписати payroll calculation
- Ризик зламати payroll якщо дані відрізняються за структурою

### Варіант B: Синхронізувати task_entries → operation_entries
**Плюси:**
- Менше змін в існуючих API
- Зворотна сумісність

**Мінуси:**
- Постійна дублікація даних
- Ризик розбіжності
- Технічний борг назавжди

### Варіант C: Створити VIEW operation_entries над task_entries
**Плюси:**
- Жодних змін в API
- Дані завжди актуальні
- Єдине джерело правди

**Мінуси:**
- Потрібно мапінг полів між моделями
- `task_entries.data` (JSONB) → окремі колонки `operation_entries`

## Прийняте рішення

**Варіант A** — переключити всі API на `shveyka.task_entries`.

### Обґрунтування

1. `operation_entries` — legacy, не має підтримки stages/operations
2. `task_entries` має `jsonb data` поле для гнучких форм
3. Подвійна синхронізація (Варіант B) — це технічний борг назавжди
4. VIEW (Варіант C) — складний мапінг через різну структуру даних

## Наслідки

1. **Потрібно оновити**:
   - `GET /api/analytics/dashboard` → читати `task_entries`
   - `GET /api/analytics/employees/{id}/stats` → читати `task_entries`
   - Всі payroll API → читати `task_entries`
   - `GET /api/entries` → читати `task_entries`
   - `POST /api/entries/approve` → писати в `task_entries`
   - AI SupabaseRepository → читати `task_entries`

2. **Структура даних відрізняється**:
   - `task_entries.quantity` vs `operation_entries.quantity`
   - `task_entries.data` (JSONB) vs окремі поля
   - `task_entries.employee_id` vs `operation_entries.employee_id`

3. **Тестування**: Потрібно перевірити розрахунок зарплати з новими даними

## Обмеження

- payroll calculation використовує `base_rate` з `operations` таблиці
- `task_entries` не має поля `status` для підтвердження (підтвердження через окрему логіку)

## Пов'язані документи

- `/docs/schemas/database.md` — схеми обох таблиць
- `/docs/processes/production-flow.md` — процес виконання
- `/docs/api/production-orders.yaml` — API endpoint'и

## Посилання на код

- `src/app/api/analytics/dashboard/route.ts`
- `src/app/api/payroll/` (всі роути)
- `src/app/api/entries/` (всі роути)
- `src/lib/ai/agentic/SupabaseRepository.ts`
