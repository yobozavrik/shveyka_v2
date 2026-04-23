# Процес виробництва — Повний потік

## 1. Назва процесу

Повний цикл виробництва: від замовлення до передачі на склад.

## 2. Мета

Автоматизувати та відстежити весь виробничий процес швейної продукції: створення замовлення, формування партій, виконання етапів працівниками, контроль якості, передача готової продукції.

## 3. Триггер запуску

Менеджер створює виробниче замовлення в CRM або замовлення синхронізується з KeyCRM.

## 4. Учасники

| Роль | Дія |
|------|-----|
| Менеджер / Admin | Створення, затвердження, запуск замовлення |
| Начальник виробництва | Створення партій, запуск в розкрій, контроль процесу |
| Працівник розкрою | Виконання операцій настилу та крою |
| Працівник пошиву | Виконання операцій пошиву |
| Працівник оверлоку | Виконання операцій оверлоку |
| Працівник прямострочки | Виконання операцій прямострочки |
| Працівник розпошиву | Виконання операцій розпошиву |
| Працівник упаковки | Упаковка, відбраковка, передача на склад |
| Майстер | Підтвердження записів працівників |

## 5. Вхідні дані

- Модель продукту (`product_models`)
- Кількість замовлення
- Специфікація матеріалів (`material_norms`)

## 6. Кроки виконання

```mermaid
sequenceDiagram
    participant M as Менеджер
    participant CRM as CRM
    participant DB as Supabase
    participant PH as Нач. виробництва
    participant W as Працівник
    participant MS as Майстер

    M->>CRM: Натискає "Сформувати нове замовлення"
    
    Note over M,CRM: Вибір типу замовлення
    alt Тип "На склад"
        M->>CRM: Вибір складу (`shveyka.locations`)
    else Тип "Замовнику"
        M->>CRM: Вибір клієнта (`shveyka.clients`)
        opt Клієнта немає
            M->>CRM: Модалка "Створити клієнта"
            CRM->>DB: INSERT clients
        end
    end
    
    M->>CRM: Заповнює моделі та кількість
    CRM->>DB: INSERT production_orders (draft)
    CRM->>DB: INSERT production_order_lines
    CRM-->>M: Замовлення створено

    M->>CRM: Затвердити замовлення
    CRM->>DB: UPDATE status = 'approved'
    CRM->>DB: log_production_order_event

    M->>CRM: Запустити у виробництво
    CRM->>DB: calculate_material_requirements()
    CRM->>DB: UPDATE status = 'launched'
    CRM-->>M: Замовлення запущено

    PH->>CRM: Створити партію
    CRM->>DB: INSERT production_batches (created)
    CRM-->>PH: Партія створена

    PH->>CRM: Запустити партію
    CRM->>DB: INSERT batch_tasks (cutting, pending)
    CRM->>DB: UPDATE batch.status = 'cutting'
    CRM-->>PH: Партію передано в розкрій

    Note over W,MS: Етап 1: Розкрій
    W->>CRM: Бачить завдання в Worker App
    W->>CRM: Приймає завдання (status → accepted)
    W->>CRM: Заповнює настил (7 полів)
    CRM->>DB: INSERT task_entries + cutting_nastils
    W->>CRM: Заповнює крій (2 поля)
    CRM->>DB: INSERT task_entries
    W->>CRM: Завершує завдання (status → completed)
    MS->>CRM: Підтверджує записи

    Note over PH: Начальник виробництва бачить результат
    PH->>CRM: Бачить заповнені настили в CRM
    PH->>CRM: Заповнює узор, колір нитки
    PH->>CRM: Натискає "Передати у виробництво"
    PH->>CRM: POST /batches/{id}/stages action=advance
    CRM->>DB: INSERT batch_tasks (sewing, pending)
    CRM->>DB: UPDATE batch.status = 'sewing'

    Note over W,MS: Етап 2: Пошив → 3: Оверлок → 4: Прямострочка → 5: Упаковка
    W->>CRM: Виконує операції кожного етапу
    CRM->>DB: INSERT task_entries (quantity, data, defect_count)
    MS->>CRM: Підтверджує
    PH->>CRM: Передає на наступний етап

    Note over PH: Всі етапи завершені
    PH->>CRM: Партія → ready
    PH->>CRM: Завершити замовлення
    CRM->>DB: UPDATE order.status = 'completed'

    PH->>CRM: Передати на склад
    CRM->>DB: UPDATE order.status = 'warehouse_transferred'

    PH->>CRM: Закрити замовлення
    CRM->>DB: UPDATE order.status = 'closed'
```

## 7. Етапи виробництва

| # | Етап | Код | Роль | Операції | Форма працівника |
|---|------|-----|------|----------|-----------------|
| 1 | Розкрій | `cutting` | cutting | настил, крій | 7 полів (настил) + 2 поля (крій) |
| 2 | Пошив | `sewing` | sewing | зшивання | кількість, брак |
| 3 | Оверлок | `overlock` | overlock | оверлок | кількість, брак |
| 4 | Прямострочка | `straight_stitch` | straight | прямострочка | кількість, брак |
| 5 | Розпошив | `coverlock` | coverlock | розпошив | кількість, брак |
| 6 | Упаковка | `packaging` | packaging | упаковка | тип, кількість |

## 8. Точки прийняття рішень

| Точка | Умова | Дія |
|-------|-------|-----|
| MRP перевірка | Є дефіцит матеріалів | Попередження, але запуск дозволено |
| Запуск партії | Вже є активне завдання | Блокування — не можна запустити вдруге |
| Завершення замовлення | Не всі партії готові | Блокування — треба завершити всі партії |
| Передача на склад | Статус не `completed` | Блокування |
| Закриття замовлення | Статус не `warehouse_transferred` | Блокування |

## 9. Створювані сутності

1. `production_orders` — замовлення
2. `production_order_lines` — позиції
3. `production_order_events` — аудит-лог подій
4. `production_order_materials` — MRP знімок
5. `production_batches` — партії
6. `batch_tasks` — завдання на етап
7. `task_entries` — записи виконання
8. `cutting_nastils` — legacy-дзеркало настилів
9. `employee_activity_log` — активність працівників

## 10. Вихідний результат

- Готова продукція на складі
- Повний аудит-лог виробництва
- Дані для розрахунку зарплати
- Аналітика виробітку

## 11. Помилки

| Помилка | Коли виникає | Що робити |
|---------|-------------|-----------|
| "Створити партію можна лише для approved/launched/in_production" | Замовлення в draft | Спочатку затвердити замовлення |
| "Запуск можливий лише для партії у статусі created" | Партія вже запущена | Не запускати повторно |
| "Для цієї партії вже існує активне завдання розкрою" | Дубльований запуск | Перевірити існуюче завдання |
| "Неможливо завершити замовлення: не всі партії готові" | Є партії не в ready/closed/shipped | Завершити всі партії |
| "Передати на склад можна лише після завершення" | Замовлення не completed | Спочатку завершити замовлення |

## 12. Залежності

| Залежність | Тип | Використання |
|------------|-----|-------------|
| `shveyka.production_orders` | Таблиця | Верхньорівневе замовлення |
| `shveyka.production_batches` | Таблиця | Виробнича партія |
| `shveyka.batch_tasks` | Таблиця | Завдання на етап |
| `shveyka.task_entries` | Таблиця | Канонічний лог виконання |
| `shveyka.production_stages` | Таблиця | Довідник етапів |
| `shveyka.stage_operations` | Таблиця | Операції + field_schema |
| `shveyka.cutting_nastils` | Таблиця | Legacy-дзеркало для сумісності |
| `shveyka.employee_activity_log` | Таблиця | Аудит активності |
| `storage.getMoves` | API Poster | Переміщення на склад списання |
| `storage.getWastes` | API Poster | Ручні списання |

## 13. API/Функції

| Endpoint | Метод | Призначення |
|----------|-------|-------------|
| `POST /api/production-orders` | POST | Створити замовлення |
| `POST /api/production-orders/{id}/approve` | POST | Затвердити |
| `POST /api/production-orders/{id}/launch` | POST | Запустити |
| `POST /api/production-orders/{id}/batches` | POST | Створити партію |
| `POST /api/batches/{id}/launch` | POST | Запустити партію → розкрій |
| `POST /api/batches/{id}/stages` | POST | Перехід на наступний етап |
| `POST /api/mobile/tasks/{id}/entries` | POST | Запис працівника |
| `POST /api/mobile/master/approve` | POST | Підтвердження майстром |
| `POST /api/production-orders/{id}/complete` | POST | Завершити замовлення |
| `POST /api/production-orders/{id}/transfer_to_warehouse` | POST | Передати на склад |
| `POST /api/production-orders/{id}/close` | POST | Закрити замовлення |
