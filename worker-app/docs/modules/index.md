# Модулі Worker App

---

## Огляд

```mermaid
flowchart TB
    subgraph "UI Layer (Next.js Pages)"
        LOGIN[🔐 login/page.tsx]
        TASKS[📋 tasks/page.tsx]
        TASK_DETAIL[📝 tasks/[id]/page.tsx]
        PROFILE[👤 profile/page.tsx]
        SETTINGS[⚙️ profile/settings/page.tsx]
        BATCHES[📦 batches/page.tsx]
        BATCH_DETAIL[🔍 batches/[id]/page.tsx]
    end

    subgraph "API Layer (Use Cases)"
        AUTH[POST /auth/login]
        TASKS_API[GET|POST /tasks]
        ENTRIES[POST /tasks/[id]/entries]
        EMPLOYEE[GET /employee/stats]
        PAYROLL[GET /employee/payroll]
        NOTIF[GET /notifications/count]
    end

    subgraph "Data Layer (Supabase)"
        DB[(PostgreSQL<br/>shveyka schema)]
    end

    LOGIN --> AUTH
    TASKS --> TASKS_API
    TASK_DETAIL --> TASKS_API
    TASK_DETAIL --> ENTRIES
    PROFILE --> EMPLOYEE
    PROFILE --> PAYROLL
    SETTINGS --> AUTH

    TASKS_API --> DB
    ENTRIES --> DB
    EMPLOYEE --> DB
    PAYROLL --> DB
    NOTIF --> DB
```

---

## auth/login/page.tsx

| Поле | Значення |
|------|---------|
| **Назва** | Сторінка входу |
| **Призначення** | Аутентифікація працівника |
| **Бізнес-ціль** | Безпечний доступ з прив'язкою до employee_id |
| **Вхідні дані** | employee_number, pin, password |
| **Вихідні дані** | Cookie `mes_worker_token` (JWT, 30 днів), redirect → /tasks |
| **Залежності** | POST /api/mobile/auth/login, next-themes |
| **Шар CA** | Interface Adapter (UI) |

---

## tasks/page.tsx

| Поле | Значення |
|------|---------|
| **Назва** | Список задач |
| **Призначення** | Показати активні задачі працівника з бейджем НОВА |
| **Бізнес-ціль** | Працівник бачить що робити, пріоритети, прогрес |
| **Вхідні дані** | JWT cookie (role, employeeId) |
| **Вихідні дані** | Список TaskListItem з batch info, summary, colors |
| **Залежності** | GET /api/mobile/tasks, useNotificationCount |
| **Шар CA** | Interface Adapter (UI) |
| **Особливості** | Бейдж "НОВА" для pending, прогресс-бар, Material Symbols |

---

## tasks/[id]/page.tsx

| Поле | Значення |
|------|---------|
| **Назва** | Деталі задачі + форми вводу |
| **Призначення** | Прийняття, ввід даних, завершення етапу |
| **Бізнес-ціль** | Фіксація виконаної роботи з валідацією |
| **Вхідні дані** | task_id (URL), форма даних (JSON) |
| **Вихідні дані** | task_entries записи, зміна статусу задачі |
| **Залежності** | GET/POST /tasks/[id], POST /tasks/[id]/entries |
| **Шар CA** | Interface Adapter (UI) → Use Cases (API) |
| **Типи форм** | Розкрой (7 полів), Пошив (кількість+брак), Упаковка (тип+кількість) |
| **Валідація** | Клієнтська + серверна. Неможливо завершити без записів |

---

## profile/page.tsx

| Поле | Значення |
|------|---------|
| **Назва** | Особистий кабінет |
| **Призначення** | Статистика, заробіток, якість, ціль дня, історія |
| **Бізнес-ціль** | Мотивація працівника через прозорість заробітку |
| **Вхідні дані** | JWT cookie (employeeId) |
| **Вихідні дані** | EmployeeStats JSON (заробіток, якість, активність, задачі) |
| **Залежності** | GET /employee/stats, GET /employee/payroll |
| **Шар CA** | Interface Adapter (UI) |
| **Особливості** | Порівняння з вчора, ціль дня (avg×1.2), bar chart 7 днів |

---

## profile/settings/page.tsx

| Поле | Значення |
|------|---------|
| **Назва** | Налаштування |
| **Призначення** | Безпека, сповіщення, тема, вихід |
| **Бізнес-ціль** | Управління акаунтом без CRM |
| **Вхідні дані** | JWT cookie |
| **Вихідні дані** | Зміна cookie (тема), DELETE cookie (вихід) |
| **Залежності** | POST /auth/logout, next-themes |
| **Шар CA** | Interface Adapter (UI) |

---

## API: POST /api/mobile/tasks/[id]/entries

| Поле | Значення |
|------|---------|
| **Назва** | Додати запис виконання |
| **Призначення** | Зберегти результат роботи в task_entries |
| **Бізнес-ціль** | Фіксація виробітки для payroll та CRM |
| **Вхідні дані** | operation_id, data (JSONB), notes |
| **Вихідні дані** | Запис в task_entries + cutting_nastils (legacy) |
| **Залежності** | batch_tasks, task_entries, employee_activity_log |
| **Шар CA** | Use Case |
| **Особливості** | Розрахунок quantity = per_nastil × size_count для розкрою |

---

## API: GET /api/mobile/employee/stats

| Поле | Значення |
|------|---------|
| **Назва** | Статистика працівника |
| **Призначення** | Повна статистика для особистого кабінету |
| **Бізнес-ціль** | Прозорість заробітку та продуктивності |
| **Вхідні дані** | employeeId (з JWT) |
| **Вихідні дані** | EmployeeStats (заробіток, якість, ціль, активність, задачі) |
| **Залежності** | employees, task_entries, payroll_accruals, activity_log, batch_tasks |
| **Шар CA** | Use Case |
| **Продуктивність** | 6 паралельних запитів через Promise.all |
