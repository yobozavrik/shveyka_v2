-- Крок 1: Оновлення структури для Замовлень та Партій
-- Дата: 2026-04-18

-- Зв'язок замовлення з базовою моделлю
alter table shveyka.production_orders
    add column if not exists base_model_id bigint references shveyka.base_models(id);

-- Розширення таблиці партій для нової логіки
alter table shveyka.batches
    add column if not exists selected_sizes jsonb not null default '[]'::jsonb, -- Список обраних розмірів (напр. ["S", "M", "L"])
    add column if not exists fabric_items jsonb not null default '[]'::jsonb;  -- Список [{color, rolls, planned_qty}]

-- Коментарі для розробників
comment on column shveyka.batches.selected_sizes is 'Перелік розмірів, обраних Начальником виробництва для цієї партії';
comment on column shveyka.batches.fabric_items is 'Деталізація тканини: колір, кількість рулонів та планова кількість штук для кожного кольору';
