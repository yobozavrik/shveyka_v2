-- ШВЕЙКА CRM: Активація фото виробів
-- Скопіюйте та виконайте цей код у Supabase SQL Editor

-- 1. Додаємо колонку для мініатюр у таблицю моделей
ALTER TABLE public.product_models 
ADD COLUMN IF NOT EXISTS thumbnail_url TEXT;

-- 2. Оновлюємо коментар для документації
COMMENT ON COLUMN public.product_models.thumbnail_url IS 'URL мініатюри товару з KeyCRM';
