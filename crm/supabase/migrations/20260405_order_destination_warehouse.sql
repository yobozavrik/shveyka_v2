alter table if exists shveyka.production_orders
  add column if not exists target_location_id bigint;

do $$
begin
  if not exists (
    select 1
    from information_schema.table_constraints
      where table_schema = 'shveyka'
      and table_name = 'production_orders'
      and constraint_name = 'production_orders_target_location_id_fkey'
  ) then
    alter table shveyka.production_orders
      add constraint production_orders_target_location_id_fkey
      foreign key (target_location_id) references shveyka.locations(id);
  end if;
end $$;

create index if not exists idx_production_orders_target_location_id
  on shveyka.production_orders (target_location_id);
