# Data and API Map

This map shows how routes connect to API handlers and data helpers.

```mermaid
flowchart TB
    subgraph "UI Layer"
        T["/tasks"]
        TD["/tasks/[id]"]
        P["/profile"]
        B["/batches/[id]"]
    end

    subgraph "API Routes"
        AT["/api/mobile/tasks"]
        ATD["/api/mobile/tasks/[id]"]
        AE["/api/mobile/tasks/[id]/entries"]
        AB["/api/mobile/batches/*"]
        AP["/api/mobile/employee/*"]
        AN["/api/mobile/notifications/count"]
        AS["/api/mobile/stages"]
        AC["/api/mobile/config"]
    end

    subgraph "Server Helpers"
        SB["supabase.ts"]
        AU["auth.ts"]
        ACFG["stageConfig.ts"]
        SV["sizeVariants.ts"]
        LG["logger.ts"]
        RL["rate-limit.ts"]
        ATX["audit.ts"]
    end

    subgraph "Data"
        DB["Supabase / PostgreSQL"]
        E["employees"]
        BT["batch_tasks"]
        TE["task_entries"]
        PA["payroll_accruals"]
        PL["payroll_periods"]
        ALOG["employee_activity_log"]
        CN["cutting_nastils"]
    end

    T --> AT
    TD --> ATD
    TD --> AE
    P --> AP
    B --> AB

    AT --> SB
    ATD --> SB
    AE --> SB
    AB --> SB
    AP --> SB
    AN --> SB
    AS --> ACFG
    AC --> ACFG

    SB --> DB
    AU --> DB
    ACFG --> DB
    SV --> DB
    LG --> DB
    RL --> DB
    ATX --> DB

    DB --> E
    DB --> BT
    DB --> TE
    DB --> PA
    DB --> PL
    DB --> ALOG
    DB --> CN
```

## Contract rule

- UI refactors do not change the API contract.
- OpenAPI documents the wire format, not component composition.
- `task_entries` is the canonical execution log.
- `cutting_nastils` remains a legacy mirror where required.

## Data rule

- Reading and writing shop-floor data happens through server-side helpers.
- Route handlers own use-case orchestration.
- `src/lib/*` owns connection, validation, audit, and rate-limiting helpers.
