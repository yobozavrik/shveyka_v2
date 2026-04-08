# Worker Mobile API

This folder contains the Swagger/OpenAPI contract for the worker app.

## Files

- `mobile.openapi.yaml` - mobile execution API for auth, tasks, entries, and
  batch views.

## Notes

- Worker login uses `employee_number + PIN + password`.
- The worker app reads and writes shop-floor data through Supabase server-side
  helpers.
- Cutting keeps a legacy mirror in `cutting_nastils`, but `task_entries` is
  the canonical execution log.
