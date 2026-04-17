-- Migration to add status and approval fields to shveyka.task_entries
-- This allows us to move away from public.operation_entries

alter table if exists shveyka.task_entries 
add column if not exists status text not null default 'submitted',
add column if not exists approved_at timestamptz,
add column if not exists approved_by bigint references shveyka.users(id);

-- Create index for faster filtering in CRM
create index if not exists idx_task_entries_status on shveyka.task_entries(status);

-- Update existing entries if any to 'submitted' (redundant due to default but good for clarity)
update shveyka.task_entries set status = 'submitted' where status is null;
