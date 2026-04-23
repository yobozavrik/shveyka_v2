-- Run this in Supabase SQL Editor
ALTER TABLE production_batches ADD COLUMN IF NOT EXISTS keycrm_id bigint UNIQUE;
