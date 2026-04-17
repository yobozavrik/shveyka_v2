alter table if exists shveyka.product_models
  add column if not exists keycrm_id integer;

create unique index if not exists idx_product_models_keycrm_id
  on shveyka.product_models (keycrm_id)
  where keycrm_id is not null;
