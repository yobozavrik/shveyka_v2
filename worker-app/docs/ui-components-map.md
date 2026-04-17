# UI Components Map

This map tracks the shared UI layer and the direction of reuse.

```mermaid
flowchart TB
    subgraph "Primitive Visual Components"
        W["Wrapper.tsx"]
        MS["MaterialSymbol.tsx"]
        B["badge.tsx"]
        BR["blur-reveal.tsx"]
    end

    subgraph "Reusable Feature Components"
        SH["StageHeader.tsx"]
        QF["QuantityForm.tsx"]
        PF["PackagingForm.tsx"]
        EH["EntryHistory.tsx"]
        TS["task-page-shared.tsx"]
        TO["task-operation-cards.tsx"]
    end

    subgraph "App Screens"
        T["tasks/page.tsx"]
        TD["tasks/[id]/page.tsx"]
        P["profile/page.tsx"]
        BATCH["batches/[id]/page.tsx"]
    end

    T --> TS
    TD --> TO
    TD --> TS
    P --> EH
    BATCH --> SH
    BATCH --> QF
    BATCH --> PF

    TS --> W
    TS --> MS
    TO --> SH
    TO --> QF
    TO --> PF
    TO --> B
    TO --> BR
    SH --> MS
    QF --> MS
    PF --> MS
```

## Reuse policy

- Shared UI lives in `src/components/`.
- Page-local component factories are not allowed for stable UI.
- Cosmetic overrides from outside are not allowed.
- Layout is handled with `Wrapper` or parent composition.

## Current component roles

- `Wrapper` is the layout primitive.
- `MaterialSymbol` is the icon primitive.
- `StageHeader` renders stage identity and progress.
- `QuantityForm` and `PackagingForm` render domain-specific input UI.
- `task-page-shared` contains reusable field and queue blocks.
- `task-operation-cards` owns task card composition and modals.
