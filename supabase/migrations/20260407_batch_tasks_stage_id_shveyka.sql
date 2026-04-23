-- Step 2: bind batch tasks to production stages.
-- This keeps the current task flow compatible while making stage the source of truth.

alter table shveyka.batch_tasks
  add column if not exists stage_id bigint;

update shveyka.batch_tasks bt
set stage_id = ps.id
from shveyka.production_stages ps
where bt.stage_id is null
  and (
    bt.task_type = ps.code
    or bt.assigned_role = ps.assigned_role
    or (bt.task_type = 'cutting' and ps.code = 'cutting')
  );

alter table shveyka.batch_tasks
  alter column stage_id set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'batch_tasks_stage_id_fkey'
  ) then
    alter table shveyka.batch_tasks
      add constraint batch_tasks_stage_id_fkey
      foreign key (stage_id) references shveyka.production_stages(id) on delete restrict;
  end if;
end $$;

create index if not exists idx_batch_tasks_stage_id
  on shveyka.batch_tasks (stage_id);
