alter table if exists shveyka.production_batches
  add column if not exists target_location_id bigint;

do $$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'shveyka'
      and table_name = 'production_batches'
  ) then
    if not exists (
      select 1
      from information_schema.table_constraints
      where table_schema = 'shveyka'
        and table_name = 'production_batches'
        and constraint_name = 'production_batches_target_location_id_fkey'
    ) then
      alter table shveyka.production_batches
        add constraint production_batches_target_location_id_fkey
        foreign key (target_location_id) references shveyka.locations(id);
    end if;
  end if;
end $$;

create index if not exists idx_production_batches_target_location_id
  on shveyka.production_batches (target_location_id);
