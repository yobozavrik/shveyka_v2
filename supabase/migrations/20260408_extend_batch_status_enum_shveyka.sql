-- Keep batch status strictly in the shveyka schema.
-- This migration creates shveyka.batch_status if needed, moves production_batches.status
-- to that type, and then extends it with the later-stage values used by CRM.

drop view if exists public.v_batch_progress;
drop view if exists shveyka.v_batch_progress;

do $$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'shveyka'
      and t.typname = 'batch_status'
  ) then
    create type shveyka.batch_status as enum (
      'created',
      'preparing',
      'cutting',
      'sewing',
      'quality_check',
      'rework',
      'ready',
      'shipped',
      'closed',
      'cancelled'
    );
  end if;
end
$$;

do $$
declare
  current_type text;
begin
  execute 'alter table shveyka.production_batches alter column status drop default';

  select format('%I.%I', n.nspname, t.typname)
    into current_type
  from pg_attribute a
  join pg_class c on c.oid = a.attrelid
  join pg_namespace cn on cn.oid = c.relnamespace
  join pg_type t on t.oid = a.atttypid
  join pg_namespace n on n.oid = t.typnamespace
  where cn.nspname = 'shveyka'
    and c.relname = 'production_batches'
    and a.attname = 'status'
    and a.attnum > 0
    and not a.attisdropped;

  if current_type is distinct from 'shveyka.batch_status' then
    execute 'alter table shveyka.production_batches alter column status type shveyka.batch_status using status::text::shveyka.batch_status';
  end if;

  execute 'alter table shveyka.production_batches alter column status set default ''created''::shveyka.batch_status';
end
$$;

alter type shveyka.batch_status add value if not exists 'overlock' after 'sewing';
alter type shveyka.batch_status add value if not exists 'straight_stitch' after 'overlock';
alter type shveyka.batch_status add value if not exists 'coverlock' after 'straight_stitch';
alter type shveyka.batch_status add value if not exists 'packaging' after 'coverlock';

create or replace view shveyka.v_batch_progress as
select
  pb.id,
  pb.batch_number,
  pb.status,
  pm.name as product_name,
  pb.quantity,
  count(distinct rco.id) as total_operations,
  count(distinct oe.operation_id) filter (
    where oe.status = 'approved'
  ) as completed_operations,
  round(
    case
      when count(distinct rco.id) > 0
      then (count(distinct oe.operation_id) filter (
        where oe.status = 'approved'
      ))::numeric / count(distinct rco.id)::numeric * 100
      else 0
    end, 2
  ) as progress_percent,
  pb.planned_end_date,
  case
    when pb.planned_end_date < current_date
      and pb.status not in (
        'ready'::shveyka.batch_status,
        'shipped'::shveyka.batch_status,
        'closed'::shveyka.batch_status
      )
    then true
    else false
  end as is_overdue
from shveyka.production_batches pb
join shveyka.product_models pm on pb.product_model_id = pm.id
left join shveyka.route_cards rc on pb.route_card_id = rc.id
left join shveyka.route_card_operations rco on rc.id = rco.route_card_id
left join shveyka.operation_entries oe
  on pb.id = oe.production_batch_id and rco.operation_id = oe.operation_id
group by pb.id, pb.batch_number, pb.status, pm.name, pb.quantity, pb.planned_end_date;
