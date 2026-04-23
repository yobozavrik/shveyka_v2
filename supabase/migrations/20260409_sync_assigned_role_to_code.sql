-- Синхронізація: assigned_role завжди дорівнює code етапу.
-- Це гарантує, що роль у batch_tasks збігається з users.role.

UPDATE shveyka.production_stages
SET assigned_role = code
WHERE assigned_role != code;
