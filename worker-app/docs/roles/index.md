# Ролі та права доступу

> Хто що може робити в Worker App

---

## Матриця прав

```mermaid
flowchart LR
    subgraph "Працівники цеху"
        CUT[✂️ Розкройщик]
        SEW[🧵 Швець]
        OVL[📦 Оверлочник]
        PKG[📋 Упаковщик]
    end

    subgraph "Керівництво"
        MST[🛡️ Майстер]
        ADM[⚙️ Адміністратор]
    end

    CUT -->|ввід настилу| DB[(task_entries)]
    SEW -->|ввід кількості| DB
    OVL -->|ввід кількості| DB
    PKG -->|ввід упаковки| DB
    MST -->|підтвердження| DB
    ADM -->|повний доступ| DB
```

## Детальна матриця

| Дія | Розкройщик | Швець | Оверлочник | Упаковщик | Майстер | Адмін |
|-----|:----------:|:-----:|:----------:|:---------:|:-------:|:-----:|
| Перегляд задач своєї ролі | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Прийняття задачі | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Ввід записів | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Завершення етапу | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Перегляд усіх партій | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| Призначення техпроцесу | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| Підтвердження записів | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| Створення партій | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| Управління працівниками | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| Перегляд payroll | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |

## Правила доступу

### 1. Фільтрація за роллю
- Worker бачить **тільки** задачі своєї ролі (`assigned_role = user.role`)
- Майстер бачить **усі** задачі
- Адмін бачить **усі** задачі + payroll + управління

### 2. Валідація ролі на сервері
- Кожен API endpoint перевіряє `stage.assigned_role === user.role`
- Якщо роль не збігається → `403 Forbidden`
- Виняток: `master` та `admin` мають доступ до всіх етапів

### 3. Прив'язка запису до працівника
- Кожен запис у `task_entries` містить `employee_id`
- Працівник бачить тільки **свої** записи
- Майстер бачить записи **усіх** працівників

## Аутентифікація

```mermaid
sequenceDiagram
    participant W as Працівник
    participant APP as Worker App
    participant API as API
    participant DB as Supabase

    W->>APP: Вводить employee_number + PIN + пароль
    APP->>API: POST /api/mobile/auth/login
    API->>DB: SELECT * FROM employees WHERE employee_number = X
    API->>API: Перевірка PIN + password (bcrypt)
    API->>API: Генерація JWT (jose, HS256, 30 днів)
    API->>APP: Set-Cookie: mes_worker_token=eyJ...
    APP->>W: Redirect → /tasks
```

## Cookie

| Параметр | Значення |
|---------|---------|
| Name | `mes_worker_token` |
| Type | HttpOnly, SameSite=Strict |
| TTL | 30 днів |
| Algorithm | HS256 (jose) |
| Payload | `{ userId, username, role, employeeId }` |
