# Shveyka Worker App

Worker app for shop-floor execution in the Shveyka MES.

## What it does

- worker login
- task queue and task detail views
- stage entry capture
- cutting nastils
- master approvals
- offline sync support

## Local development

```bash
npm install
npm run dev
```

Default local port: `3005`

## Required environment variables

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
JWT_SECRET=
```

## API surface

- `POST /api/mobile/auth/login`
- `GET /api/mobile/auth/me`
- `POST /api/mobile/tasks/{id}/entries`
- `POST /api/mobile/tasks/{id}/nastils`
- `GET /api/mobile/tasks`
- `GET /api/mobile/stages`
- `GET /api/mobile/batches/{id}`

See the full contract in [docs/api/mobile.openapi.yaml](./docs/api/mobile.openapi.yaml).

## Data boundaries

- `shveyka` is the main application schema.
- `public` still hosts a few legacy/shared tables.
- `task_entries` is the canonical execution log.
- `cutting_nastils` remains a compatibility mirror for cutting.

## Related docs

- [Worker API index](./docs/api/README.md)
- [Root README](../README.md)
- [CRM docs](../crm/docs/api/README.md)
