-- Миграция: Параметрическое описание модели (ДНК изделия)
-- Дата: 2026-04-18

alter table shveyka.product_models 
    add column if not exists base_construction text, -- Например: 'Футболка для хлопчика'
    add column if not exists design_name text,       -- Например: 'Барвінок'
    add column if not exists fabric_type text,      -- Например: 'Стрейч-кулір'
    add column if not exists fabric_color text,     -- Например: 'Темно-синій'
    add column if not exists embroidery_info text;   -- Например: 'Синій+жовтий'

-- Добавляем колонку в заказы для привязки к Базовой Модели
alter table shveyka.production_orders
    add column if not exists base_model_id bigint references shveyka.base_models(id);
