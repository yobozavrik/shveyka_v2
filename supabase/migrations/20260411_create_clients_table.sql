-- Создание таблицы клиентов (clients)
create table if not exists shveyka.clients (
  id bigserial primary key,
  name text not null,
  phone text,
  email text,
  created_by bigint references shveyka.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Индекс по имени для быстрого поиска
create index if not exists idx_clients_name on shveyka.clients (name);

-- Триггер авто-обновления updated_at
create or replace function shveyka.touch_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_clients_updated_at on shveyka.clients;
create trigger trg_clients_updated_at
  before update on shveyka.clients
  for each row
  execute function shveyka.touch_updated_at();
