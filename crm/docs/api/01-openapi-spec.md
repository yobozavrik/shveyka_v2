# 📡 API Specification (OpenAPI 3.0)

> Полная спецификация всех API эндпоинтов CRM Shveyka MES.

## Base URL
```
http://localhost:3004/api
```

## Authentication
Все запросы (кроме `/auth/login`) требуют cookie `mes_auth_token` с JWT токеном.

```yaml
security:
  - cookieAuth: []

components:
  securitySchemes:
    cookieAuth:
      type: apiKey
      in: cookie
      name: mes_auth_token
```

---

## 1. Batches (Партии)

### 1.1 GET /batches
Получить список партий с фильтрацией.

**Query Parameters:**
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| status | string | all | Фильтр по статусу (`active`, `cutting`, `sewing`, `ready`, `all`) |
| limit | int | 100 | Максимальное количество записей |

**Response 200:**
```json
[
  {
    "id": 34,
    "batch_number": "1-01",
    "status": "cutting",
    "quantity": 100,
    "is_urgent": false,
    "fabric_type": "Бязь",
    "fabric_color": "синій",
    "size_variants": {"selected_sizes": ["S", "M", "L"]},
    "product_models": {"id": 1, "name": "Футболка дитяча", "sku": "TS-001"},
    "task_status": "completed",
    "task_role": "cutting",
    "operations_progress": {"1": 105}
  }
]
```

### 1.2 POST /batches
Создать новую партию.

**Body:**
```json
{
  "batch_number": "1-02",
  "product_model_id": 1,
  "quantity": 50,
  "status": "created",
  "fabric_type": "Интерлок",
  "fabric_color": "белый",
  "size_variants": {"selected_sizes": ["86", "92", "98"]},
  "is_urgent": true
}
```

**Response 201:** Созданная партия  
**Response 400:** Ошибка валидации (Zod)

### 1.3 GET /batches/:id
Получить детальную информацию о партии.

**Response 200:**
```json
{
  "id": 34,
  "batch_number": "1-01",
  "status": "cutting",
  "quantity": 100,
  "product_models": {"id": 1, "name": "Футболка дитяча"},
  "production_orders": {"id": 105, "order_number": "ORD-2026-001"},
  "actuals": {
    "total_qty": 105,
    "by_size": {"S": 35, "M": 35, "L": 35},
    "entries_count": 5
  }
}
```

### 1.4 DELETE /batches/:id
Удалить партию (только если статус `created`).

**Response 200:** `{ "success": true }`  
**Response 400:** Партию нельзя удалить (уже в работе)

### 1.5 GET /batches/:id/entries
Получить все записи выработки для партии.

**Response 200:**
```json
[
  {
    "id": 7,
    "quantity": 105,
    "status": "submitted",
    "recorded_at": "2026-04-13T18:45:36Z",
    "data": {
      "size_breakdown": {"S": 35, "M": 35, "L": 35},
      "fabric_color": "синій",
      "nastil_number": "1"
    },
    "employees": {"id": 10, "full_name": "Порошенко", "position": "Розкрійник"},
    "stage_operations": {"id": 1, "code": "nastil", "name": "Настил"}
  }
]
```

### 1.6 GET /batches/:id/tasks
Получить все задачи для партии.

**Response 200:**
```json
[
  {
    "id": 12,
    "status": "completed",
    "assigned_role": "cutting",
    "accepted_by_employee_id": 10,
    "completed_at": "2026-04-13T19:00:00Z"
  }
]
```

### 1.7 POST /batches/:id/transfer
**Ключевой эндпоинт:** Подтвердить этап и передать партию на следующий этап.

**Body:**
```json
{
  "next_stage": "sewing",
  "next_role": "sewing",
  "thread_color": "черный",
  "embroidery_type": "логотип",
  "embroidery_color": "белый",
  "notes": "Проверить качество строчки",
  "rate": 2.5
}
```

**Что делает:**
1. Все `submitted` записи → `approved` (начисление ЗП)
2. Создает `payroll_accruals` для каждого сотрудника
3. Создает новую `batch_tasks` для следующего этапа
4. Меняет статус партии на `next_stage`

**Response 200:**
```json
{
  "success": true,
  "batch_id": 34,
  "new_status": "sewing",
  "entries_approved": 5
}
```

---

## 2. Task Entries (Записи выработки)

### 2.1 GET /entries
Получить записи выработки с фильтрацией.

**Query Parameters:**
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| status | string | submitted | `submitted`, `approved`, `rejected`, `all` |
| limit | int | 100 | Лимит записей |
| batch_id | int | — | Фильтр по партии |
| employee_id | int | — | Фильтр по сотруднику |
| date_from | string | — | Дата от (ISO) |
| date_to | string | — | Дата до (ISO) |

**Response 200:** Массив записей с данными сотрудников и операций.

### 2.2 PATCH /entries/:id
Обновить запись (добавить данные в `data`).

**Body:**
```json
{
  "data": { "notes": "Дополнительная информация" }
}
```

---

## 3. Employees (Сотрудники)

### 3.1 GET /employees
Получить список активных сотрудников с их доступом.

**Response 200:**
```json
[
  {
    "id": 10,
    "full_name": "Порошенко",
    "position": "Розкрійник",
    "status": "active",
    "payment_type": "piecework",
    "access": {
      "username": "007",
      "role": "cutting",
      "is_active": true,
      "has_pin": true,
      "has_password": true
    }
  }
]
```

### 3.2 POST /employees
Создать сотрудника (автоматически создает пользователя).

**Body:**
```json
{
  "full_name": "Иванов Иван",
  "position": "Швея",
  "username": "ivanov",
  "role": "sewing",
  "pin": "1234",
  "password": "secure_password"
}
```

**Автоматика:** Если PIN/пароль не указаны, используется дефолтный `12345`.

### 3.3 PATCH /employees/:id
Обновить данные сотрудника.

### 3.4 DELETE /employees/:id
Уволить сотрудника (статус → `dismissed`).

### 3.5 GET /employees/:id/production-history
Получить историю выработки конкретного сотрудника.

**Response 200:**
```json
[
  {
    "id": 7,
    "date": "2026-04-13T18:45:36Z",
    "quantity": 105,
    "sizes": {"S": 35, "M": 35, "L": 35},
    "batch_number": "1-01",
    "order_number": "ORD-2026-001",
    "operation_name": "Настил"
  }
]
```

---

## 4. Payroll (Зарплата)

### 4.1 GET /payroll/summary
Получить сводку по зарплате всех активных сотрудников.

**Response 200:**
```json
[
  {
    "id": 10,
    "name": "Порошенко",
    "role": "cutting",
    "position": "Розкрійник",
    "department": "",
    "totalQty": 105,
    "totalAmount": 525.00,
    "entryCount": 1
  }
]
```

---

## 5. Worker App API (Mobile)

### 5.1 GET /mobile/tasks
Получить задачи текущего работника.

**Response 200:**
```json
[
  {
    "id": 12,
    "batch_id": 34,
    "status": "pending",
    "summary": {"rolls": 1, "quantity": 105},
    "batch": {
      "batch_number": "1-01",
      "quantity": 100,
      "is_urgent": false,
      "product_models": {"name": "Футболка дитяча"}
    }
  }
]
```

### 5.2 POST /mobile/tasks/:id
Принять или завершить задачу.

**Body (Accept):**
```json
{ "action": "accept" }
```

**Body (Complete):**
```json
{ "action": "complete" }
```

### 5.3 POST /mobile/tasks/:id/entries
Добавить запись выработки.

**Body:**
```json
{
  "operation_id": 1,
  "data": {
    "nastil_number": "1",
    "reel_width_cm": 150,
    "reel_length_m": 50,
    "fabric_color": "чорний",
    "weight_kg": 12.5,
    "quantity_per_nastil": 21,
    "remainder_kg": 2.3
  }
}
```

**Автоматика:** Сервер умножает `quantity_per_nastil × sizeCount` и записывает итоговое `quantity` в `task_entries`.

---

## Error Responses

| Code | Description |
|------|-------------|
| 400 | Bad Request — ошибка валидации |
| 401 | Unauthorized — нет или просрочен cookie |
| 403 | Forbidden — роль не имеет доступа |
| 404 | Not Found — ресурс не найден |
| 500 | Internal Server Error — ошибка сервера |

**Format:**
```json
{
  "error": "Текст ошибки на украинском",
  "details": "...",
  "stack": "..." // только в development
}
```
