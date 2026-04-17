-- Fix: make product_model_id optional (nullable) in production_batches
-- Run in Supabase SQL Editor
ALTER TABLE production_batches ALTER COLUMN product_model_id DROP NOT NULL;
