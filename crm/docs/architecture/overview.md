# Архітектура Shveyka MES — Огляд

## 1. Назва системи

Shveyka MES (Manufacturing Execution System) — система управління виробництвом швейної фабрики.

## 2. Мета

Автоматизація повного циклу виробництва: від замовлення до передачі готової продукції на склад. Відстеження партій, операцій, працівників, зарплати та матеріалів.

## 3. Загальна архітектура

```mermaid
graph TB
    subgraph "Клієнтський шар (Presentation)"
        CRM_UI["CRM UI<br/>Next.js :3004"]
        WORKER_UI["Worker App<br/>Next.js :3005"]
    end

    subgraph "Серверний шар (Application)"
        CRM_API["CRM API Routes<br/>/api/*"]
        WORKER_API["Worker API Routes<br/>/api/mobile/*"]
        AI_API["AI Assistant API<br/>/api/ai/*"]
    end

    subgraph "Слой домену (Domain)"
        ORDERS["Production Orders"]
        BATCHES["Production Batches"]
        STAGES["Production Stages"]
        TASKS["Batch Tasks"]
        ENTRIES["Task Entries"]
        EMPLOYEES["Employees"]
        MATERIALS["Materials & MRP"]
        PAYROLL["Payroll"]
    end

    subgraph "Інфраструктурний шар (Infrastructure)"
        SUPABASE["Supabase<br/>PostgreSQL"]
        AI_PROVIDER["Google Gemini / AI Provider"]
        KEYCRM["KeyCRM Integration"]
    end

    CRM_UI --> CRM_API
    WORKER_UI --> WORKER_API
    CRM_UI --> AI_API
    
    CRM_API --> ORDERS
    CRM_API --> BATCHES
    CRM_API --> EMPLOYEES
    CRM_API --> MATERIALS
    CRM_API --> PAYROLL
    CRM_API --> AI_API
    
    WORKER_API --> TASKS
    WORKER_API --> ENTRIES
    WORKER_API --> STAGES
    
    AI_API --> AI_PROVIDER
    
    ORDERS --> SUPABASE
    BATCHES --> SUPABASE
    STAGES --> SUPABASE
    TASKS --> SUPABASE
    ENTRIES --> SUPABASE
    EMPLOYEES --> SUPABASE
    MATERIALS --> SUPABASE
    PAYROLL --> SUPABASE
    
    CRM_API --> KEYCRM
```

## 4. Компоненти системи

| Компонент | Порт | Технологія | Призначення |
|-----------|------|------------|-------------|
| CRM | 3004 | Next.js 15 (App Router) | Планування, управління партіями, аналітика, AI |
| Worker App | 3005 | Next.js 15 (App Router) | Виконання завдань працівниками в цеху |
| Supabase | Cloud | PostgreSQL + Auth + Realtime | База даних, автентифікація, RLS |
| AI Provider | External | Google Gemini / OpenRouter | AI-асистент для аналізу виробництва |

## 5. База даних — схема `shveyka`

```mermaid
erDiagram
    production_orders ||--o{ production_order_lines : "має"
    production_orders ||--o{ production_batches : "має"
    production_orders ||--o{ production_order_events : "логі"
    production_orders ||--o{ production_order_materials : "MRP"
    
    production_batches ||--o{ batch_tasks : "генерає"
    production_batches ||--o{ task_entries : "фіксує"
    
    product_models ||--o{ production_order_lines : "використовується"
    product_models ||--o{ material_norms : "має BOM"
    
    materials ||--o{ material_norms : "входить"
    materials ||--o{ production_order_materials : "резервується"
    
    route_cards ||--o{ route_card_operations : "має"
    route_cards ||--o{ production_batches : "прив'язана"
    
    operations ||--o{ route_card_operations : "входить"
    
    production_stages ||--o{ stage_operations : "має"
    production_stages ||--o{ batch_tasks : "прив'язана"
    
    stage_operations ||--o{ task_entries : "записує"
    
    batch_tasks ||--o{ task_entries : "фіксує"
    batch_tasks ||--o{ cutting_nastils : "legacy mirror"
    
    employees ||--o{ task_entries : "виконує"
    employees ||--o{ users : "обліковий запис"
    employees ||--o{ employee_activity_log : "логі"
    employees ||--o{ payroll_adjustments : "коригування"
    
    users ||--|| employees : "1:1"
    
    payroll_periods ||--o{ payroll_adjustments : "має"
    
    warehouse_documents ||--o{ warehouse_transactions : "містить"
    
    locations ||--o{ stock_movements : "відстежує"
    
    suppliers ||--o{ supply_documents : "постачає"
    supply_documents ||--o{ supply_items : "містить"
    
    production_orders {
        bigint id PK
        string order_number
        string status
        string order_type
        int target_location_id
        date planned_completion_date
    }
    
    production_order_lines {
        bigint id PK
        bigint order_id FK
        int model_id FK
        string model_name
        int quantity
        string size
    }
    
    production_batches {
        bigint id PK
        bigint order_id FK
        string batch_number
        int product_model_id FK
        int quantity
        string status
        string fabric_type
        string fabric_color
        jsonb size_variants
    }
    
    production_stages {
        bigint id PK
        string code UK
        string name
        string assigned_role
        int sequence_order
    }
    
    stage_operations {
        bigint id PK
        bigint stage_id FK
        string code
        string name
        jsonb field_schema
        int sort_order
    }
    
    batch_tasks {
        bigint id PK
        bigint batch_id FK
        bigint stage_id FK
        string task_type
        string assigned_role
        string status
        bigint accepted_by_employee_id FK
    }
    
    task_entries {
        bigint id PK
        bigint task_id FK
        bigint batch_id FK
        bigint employee_id FK
        bigint stage_id FK
        bigint operation_id FK
        int entry_number
        int quantity
        jsonb data
        timestamptz recorded_at
    }
    
    employees {
        bigint id PK
        string full_name
        string employee_number UK
        string department
        string position
        string status
    }
    
    users {
        bigint id PK
        string username UK
        string hashed_password
        string hashed_pin
        string role
        bigint employee_id FK
        boolean is_active
    }
    
    materials {
        bigint id PK
        string code UK
        string name
        string category
        string unit
        float current_stock
        float min_stock
    }
    
    material_norms {
        bigint id PK
        int product_model_id FK
        bigint material_id FK
        float quantity_per_unit
        string item_type
    }
    
    product_models {
        bigint id PK
        string name
        string sku UK
        string category
        jsonb sizes
        int keycrm_id
    }
    
    route_cards {
        bigint id PK
        int product_model_id FK
        string version
        boolean is_active
    }
    
    operations {
        bigint id PK
        string code UK
        string name
        string operation_type
        float base_rate
    }
    
    payroll_periods {
        bigint id PK
        string name
        date date_from
        date date_to
        string status
    }
```

## 6. Потік даних (Data Flow)

```mermaid
flowchart LR
    A["Створення замовлення"] --> B["Затвердження"]
    B --> C["Запуск у виробництво"]
    C --> D["Створення партії"]
    D --> E["Запуск партії → Розкрій"]
    E --> F["Працівник виконує операції"]
    F --> G["Майстер підтверджує"]
    G --> H["Перехід на наступний етап"]
    H --> I["Пошив → Оверлок → Прямострочка → Упаковка"]
    I --> J["Партія готова"]
    J --> K["Передача на склад"]
    K --> L["Закриття замовлення"]
```

## 7. Місце в Clean Architecture

```mermaid
graph TD
    subgraph "Presentation Layer"
        CRM_PAGES["CRM Pages<br/>/app/(dashboard)/*"]
        WORKER_PAGES["Worker Pages<br/>/app/(worker)/*"]
        COMPONENTS["React Components"]
    end
    
    subgraph "Application Layer"
        API_ROUTES["API Routes<br/>/api/*"]
        USE_CASES["Use Cases<br/>Business Services"]
        ORCHESTRATORS["AI Orchestrator<br/>AgenticOrchestrator"]
    end
    
    subgraph "Domain Layer"
        ENTITIES["Entities<br/>Production Orders, Batches, Tasks"]
        RULES["Domain Rules<br/>Status transitions, validation"]
        INTERFACES["Interfaces<br/>Repository, AI Provider ports"]
    end
    
    subgraph "Infrastructure Layer"
        SUPABASE_CLIENT["Supabase Client"]
        AI_PROVIDER["Gemini / AI Provider"]
        KEYCRM_CLIENT["KeyCRM HTTP Client"]
        FILE_STORAGE["File Storage"]
    end
    
    CRM_PAGES --> API_ROUTES
    WORKER_PAGES --> API_ROUTES
    COMPONENTS --> API_ROUTES
    
    API_ROUTES --> USE_CASES
    API_ROUTES --> ORCHESTRATORS
    
    USE_CASES --> ENTITIES
    USE_CASES --> RULES
    USE_CASES --> INTERFACES
    
    INTERFACES -.-> SUPABASE_CLIENT
    INTERFACES -.-> AI_PROVIDER
    INTERFACES -.-> KEYCRM_CLIENT
    
    SUPABASE_CLIENT --> ENTITIES
    AI_PROVIDER --> ORCHESTRATORS
    KEYCRM_CLIENT --> USE_CASES
```

### Напрямок залежностей

```
Presentation → Application → Domain ← Infrastructure
```

- **Presentation** залежить від **Application** (викликає API)
- **Application** залежить від **Domain** (використовує сутності та правила)
- **Infrastructure** залежить від **Domain** (реалізує порти)
- **Domain** НЕ залежить ні від кого

## 8. Обмеження та принципи

1. **Суперечності статусів**: Партія не може перейти на наступний етап без підтвердження попереднього
2. **MRP**: Розрахунок матеріалів відбувається при запуску замовлення
3. **Авторизація**: JWT cookie + RLS (частково)
4. **Legacy**: `operation_entries` + `cutting_nastils` співіснують з новою моделлю `task_entries`
5. **KeyCRM**: Синхронізація замовлень через API

## 9. Змінні оточення

| Змінна | Призначення |
|--------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | URL Supabase проекту |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Публічний ключ Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Сервісний ключ (обходить RLS) |
| `JWT_SECRET` | Секрет для підпису JWT токенів |
| `KEYCRM_API_URL` | URL KeyCRM API |
| `KEYCRM_API_TOKEN` | Токен KeyCRM |
| `GOOGLE_AI_API_KEY` | Ключ Google AI для асистента |
