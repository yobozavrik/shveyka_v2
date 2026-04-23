# 🏗 Shveyka MES — System Architecture

> Полная архитектурная документация системы управления производством (MES) для швейного цеха.

## 1. High-Level Architecture

```mermaid
graph TB
    subgraph "Client Layer"
        CRM[CRM Web App<br/>Next.js 15 + React]
        Worker[Worker App<br/>Mobile PWA]
    end

    subgraph "API Gateway Layer"
        API_CRM[CRM API Routes<br/>/api/*]
        API_Worker[Worker API Routes<br/>/api/mobile/*]
    end

    subgraph "Service Layer"
        BatchSvc[Batch Service]
        PayrollSvc[Payroll Service]
        TaskSvc[Task Service]
        AuthSvc[Auth Service]
    end

    subgraph "Data Access Layer"
        Supabase[(Supabase<br/>PostgreSQL)]
        Cache[Redis Cache<br/>TBD]
    end

    subgraph "External Services"
        KeyCRM[KeyCRM API]
        Telegram[Telegram Bot]
    end

    CRM --> API_CRM
    Worker --> API_Worker
    API_CRM --> BatchSvc
    API_CRM --> PayrollSvc
    API_CRM --> TaskSvc
    API_CRM --> AuthSvc
    API_Worker --> TaskSvc
    API_Worker --> AuthSvc
    
    BatchSvc --> Supabase
    PayrollSvc --> Supabase
    TaskSvc --> Supabase
    AuthSvc --> Supabase
    
    API_CRM -.sync.-> KeyCRM
    API_CRM -.notify.-> Telegram
```

## 2. Database Schema (shveyka)

```mermaid
erDiagram
    employees ||--o{ task_entries : creates
    employees ||--o| users : has
    employees ||--o{ payroll_accruals : receives
    
    production_batches ||--o{ batch_tasks : contains
    production_batches ||--o{ task_entries : tracks
    production_batches }o--|| product_models : based_on
    production_batches }o--|| production_orders : belongs_to
    
    batch_tasks ||--o{ task_entries : generates
    batch_tasks }o--|| production_stages : assigned_to
    
    task_entries }o--|| stage_operations : references
    task_entries }o--|| employees : created_by
    
    stage_operations }o--|| production_stages : belongs_to
    stage_operations }o--|| operations : defines_rate
    
    operations ||--o{ stage_operations : used_in
    
    payroll_accruals }o--|| employees : paid_to
    payroll_accruals }o--|| production_batches : for_batch

    employees {
        bigint id PK
        string full_name
        string position
        string status
    }
    
    users {
        bigint id PK
        string username
        string hashed_password
        string hashed_pin
        string role
        bigint employee_id FK
    }
    
    production_orders {
        bigint id PK
        string order_number
        string status
        date order_date
    }
    
    production_batches {
        bigint id PK
        string batch_number
        bigint product_model_id FK
        bigint order_id FK
        string status
        int quantity
        jsonb size_variants
        string fabric_type
        string fabric_color
    }
    
    batch_tasks {
        bigint id PK
        bigint batch_id FK
        bigint stage_id FK
        string status
        string assigned_role
        bigint accepted_by_employee_id FK
    }
    
    task_entries {
        bigint id PK
        bigint task_id FK
        bigint batch_id FK
        bigint employee_id FK
        bigint operation_id FK
        int quantity
        string status
        jsonb data
    }
    
    stage_operations {
        bigint id PK
        bigint stage_id FK
        string code
        string name
        jsonb field_schema
    }
    
    operations {
        bigint id PK
        string code
        string name
        decimal base_rate
    }
    
    payroll_accruals {
        bigint id PK
        bigint employee_id FK
        bigint batch_id FK
        decimal piecework_amount
        int piecework_quantity
        decimal total_amount
    }
```

## 3. Production Flow (Stage-Gate)

```mermaid
stateDiagram-v2
    [*] --> created: Начальник создает партию
    created --> cutting: Запуск партии
    
    cutting --> cutting_accepted: Раскройщик принимает задачу
    cutting_accepted --> cutting_completed: Раскройщик завершает
    
    cutting_completed --> sewing_pending: Начальник подтверждает и передает
    sewing_pending --> sewing: Швея принимает задачу
    sewing --> sewing_completed: Швея завершает
    
    sewing_completed --> overlock_pending: Начальник подтверждает
    overlock_pending --> overlock: Оверлочник принимает
    overlock --> overlock_completed: Оверлочник завершает
    
    overlock_completed --> straight_stitch_pending: Начальник подтверждает
    straight_stitch_pending --> straight_stitch: Прямострочка принимает
    straight_stitch --> straight_stitch_completed: Завершает
    
    straight_stitch_completed --> coverlock_pending: Начальник подтверждает
    coverlock_pending --> coverlock: Распай принимает
    coverlock --> coverlock_completed: Распай завершает
    
    coverlock_completed --> packaging_pending: Начальник подтверждает
    packaging_pending --> packaging: Упаковка принимает
    packaging --> packaging_completed: Упаковка завершает
    
    packaging_completed --> ready: Партия готова
    ready --> shipped: Отгружена
    shipped --> [*]
    
    note right of cutting_completed
        Задача: completed
        Партия: cutting
        Записи: submitted
    end note
    
    note right of sewing_pending
        Записи: approved (ЗП начислена)
        Новая задача: sewing (pending)
        Партия: sewing
        Push уведомление швеям
    end note
```

## 4. Data Flow: Worker → CRM → Payroll

```mermaid
sequenceDiagram
    participant W as Worker App
    participant API as Worker API
    participant DB as Supabase
    participant CRM as CRM Web
    participant M as Начальник
    participant P as Payroll System

    W->>API: POST /tasks/:id/entries<br/>(quantity, data)
    API->>API: Расчет quantity × sizeCount
    API->>DB: INSERT task_entries<br/>status: submitted
    API-->>W: 200 OK

    M->>CRM: Открывает карточку партии
    CRM->>API: GET /batches/:id/entries
    API->>DB: SELECT task_entries<br/>WHERE batch_id = :id
    DB-->>CRM: Возвращает записи
    
    M->>CRM: Нажимает "Підтвердити та передати"
    CRM->>API: POST /batches/:id/transfer
    API->>DB: UPDATE task_entries<br/>SET status = approved
    API->>DB: INSERT payroll_accruals<br/>(employee_id, amount)
    API->>DB: INSERT batch_tasks<br/>(next_stage, pending)
    API->>DB: UPDATE production_batches<br/>SET status = next_stage
    API-->>CRM: 200 OK
    CRM->>W: Push Notification (Realtime)
    W-->>W: Новая задача у след. роли
```

## 5. Clean Architecture Layers

```
┌─────────────────────────────────────────────────┐
│           Presentation Layer (UI)                │
│  src/app/(dashboard)/**  │  src/components/**    │
└──────────────────────┬──────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────┐
│              Application Layer                   │
│  src/app/api/** (Next.js Route Handlers)        │
│  - Request validation (Zod)                     │
│  - Authentication/Authorization                 │
│  - Response formatting                          │
└──────────────────────┬──────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────┐
│               Domain Layer (Services)            │
│  src/services/** (TBD)                          │
│  - BatchService, PayrollService, TaskService    │
│  - Pure business logic, no DB coupling           │
└──────────────────────┬──────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────┐
│            Infrastructure Layer                  │
│  src/lib/supabase/**  │  src/lib/auth*.ts        │
│  - Database clients, Auth providers             │
│  - External API integrations (KeyCRM)           │
└─────────────────────────────────────────────────┘
```

## 6. Security Architecture

```mermaid
graph LR
    subgraph "Edge Protection"
        MW[Next.js Middleware<br/>Cookie Auth Check]
        RL[Rate Limiting<br/>TBD]
    end
    
    subgraph "API Protection"
        AUTH[Route Auth Check<br/>getAuth/requireAuth]
        ROLE[Role Validation<br/>admin/manager/master]
        ZOD[Input Validation<br/>Zod Schemas]
    end
    
    subgraph "Database Protection"
        RLS[Row-Level Security<br/>TBD]
        SRV[Service Role Key<br/>Server-side only]
    end
    
    User --> MW
    MW --> AUTH
    AUTH --> ROLE
    ROLE --> ZOD
    ZOD --> SRV
    SRV --> RLS
```

## 7. File Structure

```
shveyka_v2-main/
├── crm/                              # CRM Web Application
│   ├── src/
│   │   ├── app/
│   │   │   ├── (dashboard)/          # Protected dashboard pages
│   │   │   │   ├── batches/          # Управление партиями
│   │   │   │   ├── orders/           # Заказы
│   │   │   │   ├── payroll/          # Зарплата
│   │   │   │   ├── employees/        # Сотрудники
│   │   │   │   └── ...
│   │   │   ├── api/                  # API Routes (Backend)
│   │   │   │   ├── batches/          # CRUD партий
│   │   │   │   ├── entries/          # Записи выработки
│   │   │   │   ├── payroll/          # Расчет ЗП
│   │   │   │   └── ...
│   │   │   └── layout.tsx
│   │   ├── components/               # Reusable UI components
│   │   ├── lib/                      # Utilities (supabase, auth, etc)
│   │   ├── types/                    # TypeScript definitions
│   │   └── services/                 # Business logic (TBD)
│   ├── supabase/
│   │   └── migrations/               # Database schema changes
│   └── docs/                         # Documentation
│
├── worker-app/                       # Worker Mobile PWA
│   ├── src/
│   │   ├── app/(worker)/
│   │   │   ├── tasks/                # Список задач
│   │   │   ├── tasks/[id]/           # Детали задачи
│   │   │   └── batches/              # Конвейер партий
│   │   ├── app/api/mobile/           # Worker-specific API
│   │   ├── lib/                      # Utilities
│   │   └── components/               # Worker UI components
```
