# Project Visual Map

This is the high-level map of the worker app. It shows where UI, shared components, API routes, and data boundaries live.

```mermaid
flowchart TB
    subgraph "User-Facing App"
        L["/login"]
        T["/tasks"]
        TD["/tasks/[id]"]
        B["/batches/[id]"]
        P["/profile"]
        S["/profile/settings"]
        H["/history"]
        M["/master"]
    end

    subgraph "UI Composition"
        W["Wrapper.tsx"]
        MS["MaterialSymbol.tsx"]
        SH["StageHeader.tsx"]
        QF["QuantityForm.tsx"]
        OF["OverlockOperationCard.tsx"]
        PF["PackagingForm.tsx"]
        TS["task-page-shared.tsx"]
        TO["task-operation-cards.tsx"]
        EH["EntryHistory.tsx"]
        BT["badge.tsx"]
        BR["blur-reveal.tsx"]
    end

    subgraph "Framework Layer"
        APP["src/app/(worker) pages"]
        AUTH["src/app/(auth) pages"]
        API["src/app/api/mobile/* routes"]
        LAYOUT["src/app/(worker)/layout.tsx"]
    end

    subgraph "Domain and Infrastructure"
        LIB["src/lib/*"]
        HOOKS["src/hooks/*"]
        DB["Supabase / PostgreSQL"]
        DOCS["docs/*"]
    end

    L --> AUTH
    T --> APP
    TD --> APP
    B --> APP
    P --> APP
    S --> APP
    H --> APP
    M --> APP

    APP --> TO
    APP --> TS
    APP --> SH
    APP --> EH
    APP --> LAYOUT
    AUTH --> LAYOUT

    TO --> QF
    TO --> OF
    TO --> PF
    TO --> BT
    TO --> BR
    TS --> W
    TS --> MS
    SH --> MS
    QF --> MS
    PF --> MS

    APP --> API
    AUTH --> API
    API --> LIB
    API --> DB
    HOOKS --> LIB
    LIB --> DB
    DOCS --> LIB
    DOCS --> API
```

## What the map means

- Pages in `src/app/(worker)` are orchestrators, not style containers.
- Reusable visual behavior lives in `src/components/`.
- Runtime logic and server access live in `src/app/api/mobile/*` and `src/lib/*`.
- Documentation tracks both the architecture and the implementation boundary.

## Reading order

1. Start with the UI layer.
2. Follow the shared component layer.
3. Trace into API routes and `src/lib`.
4. Use the architecture docs and OpenAPI files for the formal contract.
