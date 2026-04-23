alter table if exists shveyka.product_models
  add column if not exists category text;

insert into shveyka.product_models (
  keycrm_id,
  name,
  sku,
  category,
  description,
  source_payload,
  is_active,
  thumbnail_url
)
select *
from (
  values
    (900001, 'Футболка для хлопчика "Тризуб"', 'KID-TRYZUB', 'child', 'Базова дитяча модель для старту виробництва', '{"seed":true,"age_group":"child"}'::jsonb, true, null),
    (900002, 'Футболка для хлопчика "Козак"', 'KID-KOZAK', 'child', 'Базова дитяча модель для старту виробництва', '{"seed":true,"age_group":"child"}'::jsonb, true, null),
    (900003, 'Футболка для хлопчика "Лев"', 'KID-LEV', 'child', 'Базова дитяча модель для старту виробництва', '{"seed":true,"age_group":"child"}'::jsonb, true, null),
    (900004, 'Футболка для хлопчика "Україна"', 'KID-UKRAINE', 'child', 'Базова дитяча модель для старту виробництва', '{"seed":true,"age_group":"child"}'::jsonb, true, null),
    (900005, 'Футболка для хлопчика "Герб"', 'KID-GERB', 'child', 'Базова дитяча модель для старту виробництва', '{"seed":true,"age_group":"child"}'::jsonb, true, null),
    (900006, 'Футболка чоловіча "Тризуб"', 'ADT-TRYZUB', 'adult', 'Базова доросла модель для старту виробництва', '{"seed":true,"age_group":"adult"}'::jsonb, true, null),
    (900007, 'Футболка чоловіча "Козак"', 'ADT-KOZAK', 'adult', 'Базова доросла модель для старту виробництва', '{"seed":true,"age_group":"adult"}'::jsonb, true, null),
    (900008, 'Футболка чоловіча "Герб"', 'ADT-GERB', 'adult', 'Базова доросла модель для старту виробництва', '{"seed":true,"age_group":"adult"}'::jsonb, true, null),
    (900009, 'Футболка жіноча "Тризуб"', 'WOM-TRYZUB', 'adult', 'Базова доросла модель для старту виробництва', '{"seed":true,"age_group":"adult"}'::jsonb, true, null),
    (900010, 'Футболка жіноча "Україна"', 'WOM-UKRAINE', 'adult', 'Базова доросла модель для старту виробництва', '{"seed":true,"age_group":"adult"}'::jsonb, true, null)
) as seed_rows (
  keycrm_id,
  name,
  sku,
  category,
  description,
  source_payload,
  is_active,
  thumbnail_url
)
where not exists (
  select 1
  from shveyka.product_models pm
  where pm.keycrm_id = seed_rows.keycrm_id
);
