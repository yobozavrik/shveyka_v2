# Worker API / Swagger

This folder contains the OpenAPI contract for the worker app.

## Source of Truth

- `mobile.openapi.yaml` is the worker mobile contract
- `openapi.yaml` is the broader API contract used by the app

## Compatibility Notes

- The UI refactor does not change the API wire contract.
- Request and response shapes remain the same unless the OpenAPI files are updated explicitly.
- `task_entries` is the canonical execution log.
- `cutting_nastils` remains a legacy mirror for backward compatibility.
- If a change only moves styling or component boundaries, Swagger does not need a contract update.
- Overlock is a contract-level exception to the generic quantity flow: it submits `size_rows` with `quantity` and `defect_quantity` per size, bounded by the cutting breakdown.

## Documentation Rule

Every endpoint change, payload change, or auth change must be reflected in the OpenAPI files and described here.
