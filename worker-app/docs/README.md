# Worker App Docs

> Documentation hub for the Shveyka worker app.

## What is documented

- Clean Architecture and Mermaid diagrams
- UI component boundary and layout vs visual styling split
- Swagger/OpenAPI contract
- Business processes and module responsibilities
- Infrastructure, schemas, roles, glossary, and ADRs

## Index

| Document | Purpose |
|---|---|
| [Architecture](./architecture/index.md) | Clean Architecture overview, Mermaid flows, and data flow |
| [UI Boundary](./architecture/ui-boundary.md) | Component ownership, layout-only wrappers, and visual styling rules |
| [Visual Map](./visual-map.md) | One-page Mermaid map of the project structure and runtime layers |
| [Routes Map](./routes-map.md) | App routes, screens, and navigation entry points |
| [UI Components Map](./ui-components-map.md) | Shared component graph and ownership |
| [Data/API Map](./data-api-map.md) | API routes, lib helpers, and data flow boundaries |
| [API / Swagger](./api/README.md) | OpenAPI contract and compatibility notes |
| [Modules](./modules/index.md) | Page/module responsibilities and dependencies |
| [UI Components](./modules/ui-components.md) | Shared component registry and reuse rules |
| [Processes](./processes/index.md) | Business flows expressed as Mermaid diagrams |
| [Infrastructure](./infrastructure/index.md) | Deploy, configuration, caching, and logging |
| [Database Schemas](./schemas/database.md) | Tables, JSONB shapes, and schema notes |
| [Roles](./roles/index.md) | Permissions, authentication, and cookies |
| [Glossary](./glossary/index.md) | Domain terms and abbreviations |
| [ADR](./adr/index.md) | Architecture decisions and rationale |

## Current flow notes

- Overlock is a dedicated size-grid screen, not a generic quantity form.
- The worker enters per-size quantity and defect quantities.
- The API enforces the cutting breakdown as the upper bound for each size.
- Next-stage visibility appears only after approval of the submitted row set.

## Documentation rule

Every UI boundary change, component extraction, or API contract change must be reflected in the docs first or in the same change set.
