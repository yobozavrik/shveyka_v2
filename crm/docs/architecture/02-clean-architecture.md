# 🧱 Clean Architecture — Shveyka MES

## Принцип разделения ответственности

Проект следует модифицированному Clean Architecture для Next.js App Router:

```
┌───────────────────────────────────────────────────────────┐
│                 PRESENTATION LAYER                        │
│  (src/app/(dashboard)/**, src/components/**)             │
│                                                           │
│  • UI Components (React)                                 │
│  • State Management (useState, useEffect)               │
│  • Routing (Next.js App Router)                         │
│  • Input Validation (client-side)                        │
│  • Error Display                                         │
│  ─────────────────────────────────────────────────────── │
│  ПРАВИЛО: Не содержит бизнес-логики.                     │
│  Только отображение данных и делегирование действий.     │
└─────────────────────────┬─────────────────────────────────┘
                          │ fetch()
┌─────────────────────────▼─────────────────────────────────┐
│                 APPLICATION LAYER                         │
│  (src/app/api/** — Route Handlers)                       │
│                                                           │
│  • Authentication / Authorization                        │
│  • Request Validation (Zod)                              │
│  • Response Formatting                                   │
│  • Orchestration сервисов                                │
│  • Error Handling & Logging                              │
│  ─────────────────────────────────────────────────────── │
│  ПРАВИЛО: Тонкий контроллер. Вся бизнес-логика          │
│  вынесена в Service Layer.                               │
└─────────────────────────┬─────────────────────────────────┘
                          │ вызовы
┌─────────────────────────▼─────────────────────────────────┐
│                 DOMAIN LAYER (Services)                   │
│  (src/services/** — в процессе создания)                 │
│                                                           │
│  • BatchService — логика партий                          │
│  • PayrollService — расчет зарплаты                     │
│  • TaskService — управление задачами                    │
│  • EmployeeService — сотрудники                          │
│  ─────────────────────────────────────────────────────── │
│  ПРАВИЛО: Чистая бизнес-логика. Не знает о HTTP/DB.     │
│  Зависит только от интерфейсов репозиториев.             │
└─────────────────────────┬─────────────────────────────────┘
                          │ интерфейсы
┌─────────────────────────▼─────────────────────────────────┐
│                 INFRASTRUCTURE LAYER                      │
│  (src/lib/supabase/**, src/lib/auth*.ts)                 │
│                                                           │
│  • Supabase Client (Admin & Anon)                        │
│  • JWT Auth Provider                                     │
│  • External APIs (KeyCRM, Telegram)                      │
│  • Database Repositories                                 │
│  ─────────────────────────────────────────────────────── │
│  ПРАВИЛО: Знает о БД и внешних сервисах.                 │
│  Реализует интерфейсы Domain Layer.                      │
└───────────────────────────────────────────────────────────┘
```

## Dependency Rule

Зависимости направлены **только внутрь**:
```
Presentation → Application → Domain → Infrastructure
```

Инфраструктура **НЕ ИМПОРТИРУЕТ** ничего из Application или Presentation.

## Текущее состояние

| Слой | Статус | Файлы |
|------|--------|-------|
| Presentation | ✅ Готово | `src/app/(dashboard)/**`, `src/components/**` |
| Application | ⚠️ Частично | `src/app/api/**` (бизнес-логика внутри роутов) |
| Domain | 🚧 В процессе | `src/services/` (только `keycrm.ts`) |
| Infrastructure | ✅ Готово | `src/lib/supabase/**`, `src/lib/auth*.ts` |

## План рефакторинга к чистой архитектуре

### Phase 1: Выделение сервисов (следующий спринт)
```typescript
// src/services/batchService.ts
export class BatchService {
  constructor(private repo: BatchRepository) {}

  async transferStage(batchId: number, nextStage: string, params: TransferParams) {
    // 1. Validate
    // 2. Approve entries
    // 3. Calculate payroll
    // 4. Create next task
    // 5. Update batch status
    // 6. Send notifications
  }
}
```

### Phase 2: Репозитории
```typescript
// src/lib/repositories/batchRepository.ts
export interface BatchRepository {
  findById(id: number): Promise<Batch | null>;
  findAll(filter: BatchFilter): Promise<Batch[]>;
  updateStatus(id: number, status: string): Promise<void>;
}

export class SupabaseBatchRepository implements BatchRepository {
  // Supabase-specific implementation
}
```

### Phase 3: Dependency Injection
```typescript
// src/lib/di.ts
export const container = {
  batchRepo: new SupabaseBatchRepository(supabase),
  batchService: new BatchService(container.batchRepo),
};
```

## Naming Conventions

| Сущность | Convention | Example |
|----------|-----------|---------|
| Tables | `snake_case` (shveyka schema) | `task_entries`, `batch_tasks` |
| Types | `PascalCase` | `EmployeeSummary`, `BatchDetail` |
| API Routes | `kebab-case` | `/api/batches/[id]/transfer` |
| Components | `PascalCase` | `OrderWorkflowPanel`, `StageHeader` |
| Services | `PascalCase` + `Service` suffix | `BatchService`, `PayrollService` |
| Repositories | `PascalCase` + `Repository` suffix | `BatchRepository` |
| Variables/Functions | `camelCase` | `calculateTotalQuantity`, `handleTransfer` |

## File Organization Rules

1. **Один компонент = один файл** (исключение: мелкие helper-компоненты)
2. **API роуты**: один файл на эндпоинт (`route.ts`)
3. **Типы**: централизованы в `src/types/database.ts`
4. **Утилиты**: `src/lib/` по домену (`sizeVariants.ts`, `stageConfig.ts`)
5. **Константы**: `src/constants/` (если >3 файлов используют)
