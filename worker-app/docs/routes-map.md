# Routes Map

This map shows the user-facing routes and how they group inside the app.

```mermaid
flowchart LR
    subgraph "Auth"
        A1["/login"]
    end

    subgraph "Worker App"
        W1["/tasks"]
        W2["/tasks/[id]"]
        W3["/batches"]
        W4["/batches/[id]"]
        W5["/profile"]
        W6["/profile/settings"]
        W7["/history"]
        W8["/master"]
        W9["/settings"]
    end

    subgraph "API Surface"
        P1["/api/mobile/auth/*"]
        P2["/api/mobile/tasks/*"]
        P3["/api/mobile/batches/*"]
        P4["/api/mobile/employee/*"]
        P5["/api/mobile/notifications/*"]
        P6["/api/mobile/stages"]
        P7["/api/mobile/config"]
    end

    A1 --> P1
    W1 --> P2
    W2 --> P2
    W2 --> P6
    W3 --> P3
    W4 --> P3
    W5 --> P4
    W6 --> P1
    W7 --> P4
    W8 --> P3
    W9 --> P1
```

## Route ownership

- `/login` handles worker authentication.
- `/tasks` is the task inbox.
- `/tasks/[id]` is the execution screen.
- `/batches/[id]` is the production context and task entry point.
- `/profile` and `/profile/settings` cover worker stats and account settings.
- `/history` and `/master` are specialized operational views.

## Navigation rule

Navigation decides layout and orchestration only. Visual styling stays in the target component tree.
