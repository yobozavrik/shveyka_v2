-- Додає default_role у довідник посад для автопідстановки ролі при створенні співробітника.

ALTER TABLE shveyka.positions
  ADD COLUMN IF NOT EXISTS default_role text;

UPDATE shveyka.positions SET default_role = 'cutting' WHERE name ILIKE '%розкрійник%';
UPDATE shveyka.positions SET default_role = 'sewing' WHERE name ILIKE '%шве%';
UPDATE shveyka.positions SET default_role = 'overlock' WHERE name ILIKE '%оверлок%';
UPDATE shveyka.positions SET default_role = 'straight_stitch' WHERE name ILIKE '%прямостроч%';
UPDATE shveyka.positions SET default_role = 'coverlock' WHERE name ILIKE '%розпошив%' OR name ILIKE '%распошив%';
UPDATE shveyka.positions SET default_role = 'packaging' WHERE name ILIKE '%пакувальник%' OR name ILIKE '%пакувальниц%';
UPDATE shveyka.positions SET default_role = 'embroidery' WHERE name ILIKE '%вишивальник%' OR name ILIKE '%вишивальниц%';
UPDATE shveyka.positions SET default_role = 'master' WHERE name ILIKE '%майстер%';
UPDATE shveyka.positions SET default_role = 'admin' WHERE name ILIKE '%адміністратор%' OR name ILIKE '%HR%';

INSERT INTO shveyka.positions (name, sort_order, default_role)
VALUES
  ('Прямострочниця', 35, 'straight_stitch'),
  ('Розпошивниця', 45, 'coverlock'),
  ('Вишивальник', 25, 'embroidery')
ON CONFLICT (name) DO UPDATE
SET default_role = EXCLUDED.default_role;
