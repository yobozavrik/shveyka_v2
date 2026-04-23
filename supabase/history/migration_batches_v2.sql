-- Migration: Expand production_batches table with more fields
-- Run this in Supabase SQL Editor

-- 1. Add missing production batch fields
ALTER TABLE public.production_batches 
ADD COLUMN IF NOT EXISTS fabric_type text,
ADD COLUMN IF NOT EXISTS fabric_color text,
ADD COLUMN IF NOT EXISTS thread_number text,
ADD COLUMN IF NOT EXISTS embroidery_type text,
ADD COLUMN IF NOT EXISTS embroidery_color text,
ADD COLUMN IF NOT EXISTS nastyl_number integer,
ADD COLUMN IF NOT EXISTS supervisor_id bigint REFERENCES public.employees(id),
ADD COLUMN IF NOT EXISTS planned_start_date date,
ADD COLUMN IF NOT EXISTS planned_end_date date,
ADD COLUMN IF NOT EXISTS actual_launch_date date,
ADD COLUMN IF NOT EXISTS sku text;

-- 2. Ensure product_models has category if used in API
ALTER TABLE public.product_models ADD COLUMN IF NOT EXISTS category text;

-- 3. Add index for better performance
CREATE INDEX IF NOT EXISTS idx_batches_supervisor ON public.production_batches(supervisor_id);
CREATE INDEX IF NOT EXISTS idx_batches_model ON public.production_batches(product_model_id);
