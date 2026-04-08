-- Positions directory for employee forms.
-- Stores selectable job titles in the shveyka schema.

create table if not exists shveyka.positions (
  id bigserial primary key,
  name text not null unique,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_positions_active_sort
  on shveyka.positions (is_active, sort_order, name);

insert into shveyka.positions (name, sort_order)
values
  ('Розкрійник', 10),
  ('Швея', 20),
  ('Оверлочниця', 30),
  ('Пакувальниця', 40),
  ('Контролер якості', 50),
  ('Майстер', 60),
  ('Начальник виробництва', 70),
  ('Адміністратор', 80),
  ('HR', 90)
on conflict (name) do nothing;
