# Бізнес-процеси Worker App

---

## П1: Прийняття та виконання задачі

```mermaid
flowchart TD
    A[CRM створює партію] --> B[batch_tasks INSERT status=pending]
    B --> C[Працівник відкриває /tasks]
    C --> D[Бачить карточку з бейджем НОВА]
    D --> E{Натискає 'Прийняти в роботу'?}
    E -->|Так| F[POST tasks/id action=accept]
    E -->|Ні| C
    F --> G[status → accepted]
    G --> H[Відкривається форма вводу]
    H --> I[Заповнює поля → 'Додати запис']
    I --> J[POST tasks/id/entries]
    J --> K{Валідація OK?}
    K -->|Ні| L[Помилка → H]
    K -->|Так| M[INSERT task_entries]
    M --> N[status → in_progress]
    N --> O[Лог в employee_activity_log]
    O --> P{Продовжує ввід?}
    P -->|Так| H
    P -->|Ні| Q[Натискає 'Завершити етап']
    Q --> R{Валідація OK?}
    R -->|Ні| S[Модалка з помилками → H]
    R -->|Так| T[POST tasks/id action=complete]
    T --> U[status → completed]
    U --> V[✅ Етап завершено]
```

**Входи:** Працівник, задача в статусі `pending`
**Виходи:** Записи в `task_entries`, статус `completed`
**Учасники:** Працівник цеху, API, Supabase
**Тригери:** Створення задачі в CRM → `batch_tasks` INSERT

---

## П2: Автоматичне створення задачі

```mermaid
flowchart TD
    A[Працівник відкриває /batches/id] --> B[Бачить конвеєр]
    B --> C[Натискає на операцію]
    C --> D{batch_tasks існує<br/>batch_id + stage_id?}
    D -->|Так| E[Redirect → /tasks/id]
    D -->|Ні| F[POST /api/mobile/tasks]
    F --> G{batch_id + stage_code валідні?}
    G -->|Ні| H[Помилка 400/404]
    G -->|Так| I{Роль збігається?}
    I -->|Ні| J[403 Forbidden]
    I -->|Так| K{Задача вже існує?}
    K -->|Так| L[Повертає існуючу, created=false]
    K -->|Ні| M[INSERT batch_tasks status=pending]
    M --> L
    L --> E
```

**Входи:** batch_id, stage_code
**Виходи:** batch_tasks запис або redirect на існуючу задачу
**Учасники:** Працівник, API, Supabase
**Тригери:** Натискання на операцію в конвеєрі партії

---

## П3: Розрахунок кількості для розкрою

```mermaid
flowchart LR
    A[Працівник вводить<br/>quantity_per_nastil=21] --> B[API отримує<br/>batch.size_variants]
    B --> C[Підраховує<br/>кількість_розмірів=5]
    C --> D[Розрахунок:<br/>21 × 5 = 105]
    D --> E[task_entries.quantity=105]
    D --> F[task_entries.data.size_breakdown<br/>S:21, M:21, L:21, XL:21, XXL:21]
    E --> G[CRM бачить 105 шт]
    F --> G
```

**Входи:** quantity_per_nastil, batch.size_variants
**Виходи:** task_entries.quantity, task_entries.data.size_breakdown
**Обмеження:** Розрахунок ВИКОНУЄТЬСЯ на сервері, НЕ в UI
**Ризики:** Якщо size_variants порожній → quantity = quantity_per_nastil (без множення)

---

## П4: Сповіщення про нові задачі

```mermaid
flowchart TD
    A[CRM створює batch_task] --> B[status=pending]
    B --> C[Працівник заходить в додаток]
    C --> D[Polling кожні 30с<br/>GET /notifications/count]
    D --> E{pending_tasks > 0?}
    E -->|Ні| D
    E -->|Так| F[Колокольчик 🔔 з badge]
    F --> G[Баннер 'N нових завдань']
    G --> H[Працівник натискає задачу]
    H --> I[POST action=accept]
    I --> J[status → accepted]
    J --> K[Колокольчик оновлюється -1]
    K --> D
```

**Періодичність polling:** 30 секунд
**Умова зникнення:** status ≠ pending
**Browser notifications:** При збільшенні count (якщо permission granted)

---

## П5: Особистий кабінет — збір статистики

```mermaid
flowchart TD
    A[Працівник відкриває /profile] --> B[GET /employee/stats]
    B --> C[employees дані]
    B --> D[payroll_accruals поточний період]
    B --> E[task_entries сьогодні]
    B --> F[employee_activity_log 7 днів]
    B --> G[batch_tasks accepted/in_progress]
    C --> H[Формування відповіді]
    D --> H
    E --> I[Підрахунок дефектів]
    I --> J[Якість %]
    E --> K[Середнє за 7 днів]
    K --> L[Ціль дня = avg × 1.2]
    L --> H
    F --> H
    G --> H
    H --> M[JSON → UI]
    M --> N[Профіль, заробіток, якість,<br/>ціль, задачі, історія]
```

**API:** `GET /api/mobile/employee/stats` + `GET /api/mobile/employee/payroll`
**Час відповіді:** ~200-500ms (6 паралельних запитів)
**Кешування:** Немає (дані змінюються в реальному часі)

---

## П6: Валідація завершення етапу

```mermaid
flowchart TD
    A[Працівник натискає<br/>'Завершити етап'] --> B[validateBeforeComplete]
    B --> C{entries.length > 0?}
    C -->|Ні| D[Помилка: 'Немає жодного запису']
    C -->|Так| E{Кожна операція<br/>має записи?}
    E -->|Ні| F[Список операцій<br/>без записів]
    E -->|Так| G[Модалка підтвердження]
    F --> H[Модалка з помилками<br/>не закривається підтвердженням]
    G --> I[POST action=complete]
    I --> J{Є записи?}
    J -->|Ні| K[400: 'Додайте хоча б один запис']
    J -->|Так| L[status → completed]
    L --> M[completed_at = NOW]
    M --> N[✅ Етап завершено]
```

**Правило:** Неможливо завершити без записів
**Помилки:** Показують КОНКРЕТНІ операції без записів
**Серверна перевірка:** Дублює клієнтську валідацію
