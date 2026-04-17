# Стандарт документування проекту

> Базове правило: **Все фіксувати через Mermaid, Swagger та Clean Architecture**

---

## 1. Обов'язкові види документації

| Тип | Для чого | Приклад |
|-----|---------|---------|
| **Mermaid** | Архітектура, потоки, sequence, state | [processes/index.md](./processes/index.md) |
| **Swagger/OpenAPI** | API endpoint'и, схеми, помилки | [api/openapi.yaml](./api/openapi.yaml) |
| **Clean Architecture** | Шари, сущності, use cases | [architecture/index.md](./architecture/index.md) |

## 2. Структура документації

```
/docs
  /architecture    — шари, модулі, залежності
  /api             — OpenAPI/Swagger, endpoint docs
  /modules         — опис кожного модулю
  /processes       — бізнес-процеси, user flow
  /integrations    — зовнішні сервіси
  /infrastructure  — деплой, env, безпека
  /adr             — архітектурні рішення
  /glossary        — словник термінів
  /roles           — ролі та права
  /schemas         — схеми даних, таблиці
```

## 3. Definition of Done для документації

Задача завершена **ТІЛЬКИ** якщо:

- [ ] Код працює та тестується
- [ ] Оновлені Mermaid схеми (якщо змінена логіка)
- [ ] Оновлений OpenAPI (якщо змінений API)
- [ ] Відображено місце в Clean Architecture
- [ ] Зафіксовані входи, виходи, залежності
- [ ] Доданий ADR (якщо важливе архітектурне рішення)
- [ ] Глосарій оновлений (якщо нові терміни)

## 4. Коли документування обов'язкове

| Триггер | Що документувати |
|---------|----------------|
| Новий API endpoint | OpenAPI + processes + modules |
| Зміна бізнес-логіки | processes + architecture + ADR |
| Новий модуль | modules + architecture |
| Зміна ролі/прав | roles + glossary |
| Зміна інфраструктури | infrastructure + ADR |
| Нова інтеграція | integrations + processes |

## 5. Шаблон опису модуля

```markdown
# Назва модуля

| Поле | Значення |
|------|---------|
| Назва | |
| Призначення | |
| Бізнес-ціль | |
| Вхідні дані | |
| Вихідні дані | |
| Залежності | |
| Шар CA | |
| Особливості | |
```

## 6. Шаблон ADR

```markdown
# ADR-NNN: Назва рішення

| Поле | Значення |
|------|---------|
| Статус | Proposed / Accepted / Deprecated |
| Дата | |
| Автор | |

## Контекст
## Розглянуті варіанти
## Рішення
## Наслідки
```
