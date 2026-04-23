# Огляд модулів Shveyka MES

## 1. CRM — Основний додаток

### 1.1. Production Orders (Виробничі замовлення)

**Призначення:** Управління повним життєвим циклом виробничих замовлень.

**Бізнес-ціль:** Забезпечити контроль від створення замовлення до передачі готової продукції на склад.

**Користувачі:** Менеджер, Admin

**Вхідні дані:**
- Модель продукту, кількість, клієнт
- Тип замовлення (stock/customer)

**Вихідні дані:**
- Замовлення зі статусом
- Лінії замовлення
- MRP розрахунок

**Залежності:**
- `production_orders`, `production_order_lines`, `production_order_events`, `production_order_materials`
- RPC: `calculate_material_requirements()`, `log_production_order_event()`

**Місце в Clean Architecture:**
- **Entity:** ProductionOrder
- **Use Case:** CreateOrder, ApproveOrder, LaunchOrder, CompleteOrder
- **Adapter:** API Routes `/api/production-orders/*`
- **Infrastructure:** Supabase Client

### 1.2. Production Batches (Партії)

**Призначення:** Управління виробничими партіями — основна одиниця виробництва.

**Бізнес-ціль:** Розбити замовлення на конкретні партії для виконання в цеху.

**Користувачі:** Начальник виробництва, Admin, Manager, Master

**Вхідні дані:**
- Модель, кількість, тканина, кольори, розміри

**Вихідні дані:**
- Партія зі статусом
- Batch tasks для кожного етапу

**Залежності:**
- `production_batches`, `batch_tasks`, `task_entries`, `cutting_nastils`
- `production_stages`, `stage_operations`

### 1.3. Analytics (Аналітика)

**Призначення:** Дашборд з KPI виробництва.

**Бізнес-ціль:** Надати менеджеру огляд поточного стану виробництва.

**Вхідні дані:** Період (today/week/month)

**Вихідні дані:**
- Активні партії, працівники
- Загальний виробіток, заробіток
- Топ працівників
- Денна розбивка

**⚠️ Відомий баг:** Читає з `operation_entries` замість `task_entries` (див. ADR-001)

### 1.4. Payroll (Зарплата)

**Призначення:** Розрахунок відрядної зарплати працівників.

**Бізнес-ціль:** Автоматичний розрахунок на основі виробітку × ставка.

**⚠️ Відомий баг:** Читає з `operation_entries` замість `task_entries` (див. ADR-001)

### 1.5. Employees (Персонал)

**Призначення:** Довідник працівників, посади, графіки, відвідуваність.

**Бізнес-ціль:** Управління персоналом виробництва.

### 1.6. AI Assistant

**Призначення:** Інтелектуальний помічник для аналізу виробництва.

**Режими:**
- **Classic:** Прямий запит до LLM з контекстом
- **Agentic:** Використовує інструменти (Supabase query, knowledge search)

**Архітектура (Clean Architecture):**
- **Presentation:** `AssistantSidebar.tsx`, `api/ai/assistant/route.ts`
- **Application:** `AgenticOrchestrator.ts`
- **Domain:** `production-rules.md` (бізнес-правила)
- **Infrastructure:** `GeminiProvider`, `SupabaseRepository`, `KnowledgeTools`

## 2. Worker App — Мобільний додаток цеху

### 2.1. Task Execution

**Призначення:** Виконання завдань працівниками в цеху.

**Бізнес-ціль:** Фіксувати виробіток кожного працівника по операціях.

**Користувачі:** Працівники з ролями (cutting, sewing, overlock, etc.)

**Вхідні дані:**
- Employee number + PIN + password
- Заповнені поля операції (динамічна форма з field_schema)

**Вихідні дані:**
- `task_entries` — записи виконання
- `cutting_nastils` — legacy для розкрою
- `employee_activity_log` — аудит

### 2.2. Master Approval

**Призначення:** Підтвердження записів працівників майстром.

**Бізнес-ціль:** Контроль якості перед переходом на наступний етап.

## 3. Інтеграції

### 3.1. KeyCRM

**Призначення:** Синхронізація замовлень з KeyCRM.

**Тип:** HTTP API pull

**Частота:** Вручну або за розкладом

**Дані:** Замовлення → production_orders + production_batches

### 3.2. Supabase

**Призначення:** Основна база даних + автентифікація.

**Тип:** PostgreSQL + Auth + Realtime

### 3.3. Google Gemini / AI Provider

**Призначення:** AI-асистент для аналізу виробництва.

**Тип:** HTTP API

## 4. Місце в Clean Architecture (повна система)

```mermaid
graph TD
    subgraph "Presentation"
        CRM["CRM Pages<br/>app/(dashboard)/*"]
        WORKER["Worker Pages<br/>app/(worker)/*"]
        COMPONENTS["React Components<br/>components/*"]
    end

    subgraph "Application"
        ORDERS_API["Orders API<br/>api/production-orders/*"]
        BATCHES_API["Batches API<br/>api/batches/*"]
        ANALYTICS_API["Analytics API<br/>api/analytics/*"]
        PAYROLL_API["Payroll API<br/>api/payroll/*"]
        MOBILE_API["Mobile API<br/>api/mobile/*"]
        AI_API["AI API<br/>api/ai/*"]
    end

    subgraph "Domain"
        ORDER_ENTITY["ProductionOrder"]
        BATCH_ENTITY["ProductionBatch"]
        TASK_ENTITY["BatchTask"]
        ENTRY_ENTITY["TaskEntry"]
        EMPLOYEE_ENTITY["Employee"]
        ORDER_RULES["Order Status Rules"]
        BATCH_RULES["Batch Stage Transitions"]
        PAYROLL_RULES["Piecework Calculation"]
    end

    subgraph "Infrastructure"
        SUPABASE["Supabase Client"]
        GEMINI["Google Gemini"]
        KEYCRM_CLIENT["KeyCRM HTTP"]
    end

    CRM --> ORDERS_API
    CRM --> BATCHES_API
    CRM --> ANALYTICS_API
    CRM --> PAYROLL_API
    
    WORKER --> MOBILE_API
    
    COMPONENTS --> AI_API
    COMPONENTS --> ORDERS_API
    COMPONENTS --> BATCHES_API
    
    ORDERS_API --> ORDER_ENTITY
    ORDERS_API --> ORDER_RULES
    BATCHES_API --> BATCH_ENTITY
    BATCHES_API --> BATCH_RULES
    ANALYTICS_API --> ENTRY_ENTITY
    PAYROLL_API --> PAYROLL_RULES
    PAYROLL_API --> EMPLOYEE_ENTITY
    MOBILE_API --> TASK_ENTITY
    MOBILE_API --> ENTRY_ENTITY
    AI_API --> GEMINI
    AI_API --> SUPABASE
    
    ORDER_ENTITY -.-> SUPABASE
    BATCH_ENTITY -.-> SUPABASE
    TASK_ENTITY -.-> SUPABASE
    ENTRY_ENTITY -.-> SUPABASE
    EMPLOYEE_ENTITY -.-> SUPABASE
    PAYROLL_RULES -.-> SUPABASE
    
    ORDERS_API -.-> KEYCRM_CLIENT
```

## 5. Напрямок залежностей

```
Presentation → Application → Domain ← Infrastructure
```

Кожен шар залежить тільки від шару всередині (до Domain). Domain не залежить ні від кого. Infrastructure реалізує порти, визначені в Domain.
