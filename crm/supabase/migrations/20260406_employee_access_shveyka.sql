-- Employee access credentials for worker-app
-- Keep everything in shveyka so CRM and worker app share one source of truth.

alter table shveyka.users
  add column if not exists hashed_pin text;

update shveyka.users
set hashed_pin = hashed_password
where hashed_pin is null and hashed_password is not null;
