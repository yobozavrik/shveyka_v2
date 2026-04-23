# 📝 CHANGELOG — Shveyka MES

> Все значимые изменения проекта. Формат: [SemVer](https://semver.org/)

## [Unreleased] — 2026-04-14

### 🆕 New Features
- **Stage-Gate Workflow**: Полный маршрут партии через 6 этапов (Раскрой → Пошив → Оверлок → Прямострочка → Распай → Упаковка)
- **Карточка партии** (`/batches/[id]`): Детальная страница с результатом работы, кнопкой "Підтвердити та передати"
- **API `/batches/[id]/transfer`**: Ключевой эндпоинт для перевода партии на следующий этап
- **Авто-расчет размеров**: Детские/взрослые размеры автоматически определяются по названию модели
- **Зарплата по сотрудникам**: Страница `/payroll` теперь показывает всех сотрудников (даже без выработки)
- **История выработки**: Модалка с деталями по каждому сотруднику (Заказ, Партия, Операция, Кол-во)
- **Система логирования**: `src/lib/logger.ts` + таблица `system_logs` для аудита всех действий

### 🔧 Bug Fixes
- **#FIX-001**: Объединены `operation_entries` и `task_entries` (7 файлов API мигрированы)
- **#FIX-002**: Унифицированы статусы партий во всех файлах (Zod, TypeScript, API)
- **#FIX-003**: Исправлен баг `prevConfirmed = batch.quantity` в pipeline (теперь `0`)
- **#FIX-004**: Партия теперь получает статус этапа (`cutting`) при завершении задачи Worker App
- **#FIX-005**: API `/api/batches` стал устойчивым к ошибкам (try/catch на подзапросах)
- **#FIX-006**: Добавлен `import Link` в `batches/page.tsx` (ReferenceError)
- **#FIX-007**: Worker App теперь сохраняет `quantity_per_nastil × sizeCount` в `task_entries.quantity`
- **#FIX-008**: Создан пользователь для сотрудника автоматически с дефолтным паролем `12345`

### 🗑 Removed
- **Вкладка `/master`**: Убрана из Sidebar, Dashboard и всех ссылок
- **Дублирующие статусы**: `embroidery`, `quality_control` → заменены на `overlock`, `straight_stitch`, `coverlock`

### 📚 Documentation
- `docs/architecture/01-overview.md`: Mermaid диаграммы (Architecture, Schema, Flow, Security)
- `docs/api/01-openapi-spec.md`: Полная OpenAPI 3.0 спецификация
- `docs/architecture/02-clean-architecture.md`: Clean Architecture принципы и план рефакторинга
- `supabase/migrations/20260414_create_system_logs.sql`: Миграция таблицы логов

### ⚠️ Known Issues
- **No RLS**: Row-Level Security еще не включен (критично для продакшена)
- **No Zod validation**: 89 из 91 API роутов принимают сырой JSON
- **No CSRF protection**: Cookie `sameSite: 'lax'` — недостаточно для финансовой системы
- **Weak JWT Secret**: `super-secret-jwt-key-change-me` — требует перегенерации
- **axios dependency**: В `package.json` но не используется

---

## [0.1.0] — Initial Release (до начала рефакторинга)

### Features
- Создание заказов и партий
- Worker App для Раскроя
- Базовый расчет зарплаты
- Интеграция KeyCRM
- Dashboard с аналитикой
