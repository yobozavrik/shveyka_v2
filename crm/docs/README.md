# Документація Shveyka MES

Цей каталог містить повну документацію проекту Shveyka MES згідно стандарту документирования.

## Структура

```
/docs
  /architecture    — Архітектура системи
    overview.md    — Загальна архітектура (Mermaid, Clean Architecture)
  /api             — API документація
    production-orders.yaml — OpenAPI/Swagger для виробничих endpoint'ів
  /modules         — Опис модулів
    overview.md    — Огляд всіх модулів + Clean Architecture mapping
  /processes       — Бізнес-процеси
    production-flow.md — Повний потік від замовлення до складу
  /integrations    — Зовнішні інтеграції (TODO)
  /infrastructure  — Технічна інфраструктура
    deployment.md  — Деплой, змінні оточення, безпека
  /adr             — Архітектурні рішення
    001-task-entries-vs-operation-entries.md — Розбіжність task_entries / operation_entries
  /glossary        — Словник термінів
    terms.md       — Бізнес-терміни, ролі, статуси, скорочення
  /roles           — Ролі та права доступу
    access-matrix.md — Матриця прав, аутентифікація, RLS
  /schemas         — Схеми даних
    database.md    — Повна схема БД (ER, колонки, залежності)
```

## Статус документації

| Розділ | Файли | Статус | Останнє оновлення |
|--------|-------|--------|-------------------|
| Architecture | `overview.md` | ✅ Завершено | 2026-04-11 |
| API (OpenAPI) | `production-orders.yaml`, `worker-mobile.yaml`, `ai-assistant.yaml` | ✅ Завершено | 2026-04-11 |
| Modules | `overview.md` | ✅ Завершено | 2026-04-11 |
| Processes | `production-flow.md` | ✅ Завершено | 2026-04-11 |
| Integrations | `overview.md` | ✅ Завершено | 2026-04-11 |
| Infrastructure | `deployment.md` | ✅ Завершено | 2026-04-11 |
| ADR | `001-task-entries.md`, `002-linear-design.md` | ✅ Завершено | 2026-04-11 |
| Glossary | `terms.md` | ✅ Завершено | 2026-04-11 |
| Roles | `access-matrix.md` | ✅ Завершено | 2026-04-11 |
| Schemas | `database.md` | ✅ Завершено | 2026-04-11 |

## Що залишилось зробити (покращення)

- [ ] Warehouse API документація (OpenAPI)
- [ ] Payroll API документація (OpenAPI)
- [ ] Employees API документація (OpenAPI)
- [ ] Defects API документація (OpenAPI)
- [ ] ADR для вибору Supabase як core layer
- [ ] Warehouse processes документація
- [ ] Payroll processes документація
- [ ] Схема worker-app архітектури
