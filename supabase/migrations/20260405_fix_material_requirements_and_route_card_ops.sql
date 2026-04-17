alter table if exists shveyka.material_requirements
  alter column material_id drop not null;

alter table if exists shveyka.route_card_operations
  add column if not exists sequence_order integer;

update shveyka.route_card_operations
set sequence_order = sequence_number
where sequence_order is null;

alter table if exists shveyka.route_card_operations
  alter column sequence_order set not null;

create index if not exists idx_route_card_operations_sequence_order
  on shveyka.route_card_operations (route_card_id, sequence_order);

