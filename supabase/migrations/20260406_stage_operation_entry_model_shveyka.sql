-- Stage → Operation → Entry model for production flow.
-- This migration creates the new shared directory and entry tables in shveyka.
-- Existing batch_tasks / cutting_nastils tables are kept for compatibility and will be migrated in a later step.

create schema if not exists shveyka;

create table if not exists shveyka.production_stages (
  id bigserial primary key,
  code text not null unique,
  name text not null,
  assigned_role text not null,
  sequence_order integer not null default 0,
  color text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_production_stages_active_order
  on shveyka.production_stages (is_active, sequence_order, code);

create table if not exists shveyka.stage_operations (
  id bigserial primary key,
  stage_id bigint not null references shveyka.production_stages(id) on delete cascade,
  code text not null,
  name text not null,
  field_schema jsonb not null default '[]'::jsonb,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (stage_id, code)
);

create index if not exists idx_stage_operations_stage_sort
  on shveyka.stage_operations (stage_id, is_active, sort_order, code);

create table if not exists shveyka.task_entries (
  id bigserial primary key,
  task_id bigint not null references shveyka.batch_tasks(id) on delete cascade,
  batch_id bigint not null references shveyka.production_batches(id) on delete cascade,
  employee_id bigint not null references shveyka.employees(id) on delete restrict,
  stage_id bigint not null references shveyka.production_stages(id) on delete restrict,
  operation_id bigint references shveyka.stage_operations(id) on delete set null,
  entry_number integer not null default 1,
  quantity integer,
  data jsonb not null default '{}'::jsonb,
  notes text,
  recorded_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_task_entries_task
  on shveyka.task_entries (task_id, entry_number);

create index if not exists idx_task_entries_batch
  on shveyka.task_entries (batch_id, recorded_at desc);

create index if not exists idx_task_entries_employee
  on shveyka.task_entries (employee_id, recorded_at desc);

create index if not exists idx_task_entries_stage
  on shveyka.task_entries (stage_id, recorded_at desc);

create table if not exists shveyka.employee_activity_log (
  id bigserial primary key,
  employee_id bigint not null references shveyka.employees(id) on delete cascade,
  task_id bigint references shveyka.batch_tasks(id) on delete set null,
  batch_id bigint references shveyka.production_batches(id) on delete set null,
  batch_number text,
  stage_code text,
  stage_name text,
  action text not null,
  quantity integer,
  created_at timestamptz not null default now()
);

create index if not exists idx_employee_activity_employee
  on shveyka.employee_activity_log (employee_id, created_at desc);

create index if not exists idx_employee_activity_batch
  on shveyka.employee_activity_log (batch_id, created_at desc);

insert into shveyka.production_stages (code, name, assigned_role, sequence_order, color)
values
  ('cutting', 'Розкрій', 'cutting', 10, 'amber'),
  ('sewing', 'Пошив', 'sewing', 20, 'blue'),
  ('overlock', 'Оверлок', 'overlock', 30, 'violet'),
  ('straight_stitch', 'Прямострочка', 'straight', 40, 'cyan'),
  ('coverlock', 'Розпошив', 'coverlock', 50, 'rose'),
  ('packaging', 'Упаковка', 'packaging', 60, 'emerald')
on conflict (code) do update
set
  name = excluded.name,
  assigned_role = excluded.assigned_role,
  sequence_order = excluded.sequence_order,
  color = excluded.color,
  is_active = true,
  updated_at = now();

insert into shveyka.stage_operations (stage_id, code, name, sort_order, field_schema)
select id, 'nastil', 'Настил', 10, '[
  {"key":"nastil_number","label":"№ настилу","type":"number","required":true},
  {"key":"fabric_color","label":"Колір тканини","type":"select","source":"batch_colors","required":true},
  {"key":"reel_width_cm","label":"Ширина рулону (см)","type":"number","required":true},
  {"key":"reel_length_m","label":"Довжина рулону (м)","type":"number","required":true},
  {"key":"weight_kg","label":"Вага (кг)","type":"number","required":true},
  {"key":"quantity_per_nastil","label":"Кількість на настил","type":"number","required":true},
  {"key":"remainder_kg","label":"Залишок (кг)","type":"number","required":false}
]'::jsonb
from shveyka.production_stages
where code = 'cutting'
on conflict (stage_id, code) do update
set
  name = excluded.name,
  field_schema = excluded.field_schema,
  sort_order = excluded.sort_order,
  is_active = true,
  updated_at = now();

insert into shveyka.stage_operations (stage_id, code, name, sort_order, field_schema)
select id, 'cutting', 'Крій', 20, '[
  {"key":"quantity_cut","label":"Викроєно (шт)","type":"number","required":true},
  {"key":"notes","label":"Примітки","type":"text","required":false}
]'::jsonb
from shveyka.production_stages
where code = 'cutting'
on conflict (stage_id, code) do update
set
  name = excluded.name,
  field_schema = excluded.field_schema,
  sort_order = excluded.sort_order,
  is_active = true,
  updated_at = now();

insert into shveyka.stage_operations (stage_id, code, name, sort_order, field_schema)
select id, 'assembly', 'Зшивання', 10, '[
  {"key":"operation_name","label":"Операція","type":"text","required":true},
  {"key":"quantity_done","label":"Виконано (шт)","type":"number","required":true},
  {"key":"defect_count","label":"Брак (шт)","type":"number","required":false}
]'::jsonb
from shveyka.production_stages
where code = 'sewing'
on conflict (stage_id, code) do update
set
  name = excluded.name,
  field_schema = excluded.field_schema,
  sort_order = excluded.sort_order,
  is_active = true,
  updated_at = now();

insert into shveyka.stage_operations (stage_id, code, name, sort_order, field_schema)
select id, 'overlock', 'Оверлок', 10, '[
  {"key":"quantity_done","label":"Виконано (шт)","type":"number","required":true},
  {"key":"defect_count","label":"Брак (шт)","type":"number","required":false}
]'::jsonb
from shveyka.production_stages
where code = 'overlock'
on conflict (stage_id, code) do update
set
  name = excluded.name,
  field_schema = excluded.field_schema,
  sort_order = excluded.sort_order,
  is_active = true,
  updated_at = now();

insert into shveyka.stage_operations (stage_id, code, name, sort_order, field_schema)
select id, 'straight_stitch', 'Прямострочка', 10, '[
  {"key":"quantity_done","label":"Виконано (шт)","type":"number","required":true},
  {"key":"defect_count","label":"Брак (шт)","type":"number","required":false}
]'::jsonb
from shveyka.production_stages
where code = 'straight_stitch'
on conflict (stage_id, code) do update
set
  name = excluded.name,
  field_schema = excluded.field_schema,
  sort_order = excluded.sort_order,
  is_active = true,
  updated_at = now();

insert into shveyka.stage_operations (stage_id, code, name, sort_order, field_schema)
select id, 'coverlock', 'Розпошив', 10, '[
  {"key":"quantity_done","label":"Виконано (шт)","type":"number","required":true},
  {"key":"defect_count","label":"Брак (шт)","type":"number","required":false}
]'::jsonb
from shveyka.production_stages
where code = 'coverlock'
on conflict (stage_id, code) do update
set
  name = excluded.name,
  field_schema = excluded.field_schema,
  sort_order = excluded.sort_order,
  is_active = true,
  updated_at = now();

insert into shveyka.stage_operations (stage_id, code, name, sort_order, field_schema)
select id, 'packaging', 'Упаковка', 10, '[
  {"key":"package_type","label":"Тип пакування","type":"text","required":true},
  {"key":"quantity_packed","label":"Упаковано (шт)","type":"number","required":true}
]'::jsonb
from shveyka.production_stages
where code = 'packaging'
on conflict (stage_id, code) do update
set
  name = excluded.name,
  field_schema = excluded.field_schema,
  sort_order = excluded.sort_order,
  is_active = true,
  updated_at = now();
