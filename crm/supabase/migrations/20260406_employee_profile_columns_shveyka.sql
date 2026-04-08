-- Employee profile columns required by CRM staff pages and analytics.
-- Safe additive migration for the shveyka schema.

alter table shveyka.employees
  add column if not exists department text,
  add column if not exists birth_date date,
  add column if not exists family_info text,
  add column if not exists address text,
  add column if not exists skill_level integer,
  add column if not exists individual_coefficient numeric(10,2) not null default 1,
  add column if not exists supervisor_id bigint,
  add column if not exists salary_amount numeric(12,2),
  add column if not exists comments text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'employees_supervisor_id_fkey'
  ) then
    alter table shveyka.employees
      add constraint employees_supervisor_id_fkey
      foreign key (supervisor_id)
      references shveyka.employees(id)
      on delete set null;
  end if;
end $$;
