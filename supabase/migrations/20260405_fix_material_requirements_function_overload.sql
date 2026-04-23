drop function if exists shveyka.calculate_material_requirements(integer);
drop function if exists shveyka.calculate_material_requirements(bigint);

create or replace function shveyka.calculate_material_requirements(p_order_id bigint)
returns void
language plpgsql
as $$
begin
  delete from shveyka.material_requirements where order_id = p_order_id;

  insert into shveyka.material_requirements (
    order_id,
    material_id,
    material_name,
    required_quantity,
    available_quantity,
    shortage_quantity,
    unit,
    item_type,
    unit_of_measure,
    calculation_source,
    notes
  )
  select
    p_order_id as order_id,
    m.id as material_id,
    m.name as material_name,
    sum(coalesce(ol.quantity, 0) * coalesce(mn.quantity_per_unit, 0))::numeric as required_quantity,
    coalesce(m.current_stock, 0)::numeric as available_quantity,
    greatest(
      sum(coalesce(ol.quantity, 0) * coalesce(mn.quantity_per_unit, 0))::numeric - coalesce(m.current_stock, 0)::numeric,
      0
    ) as shortage_quantity,
    coalesce(m.unit, mn.unit_of_measure, 'шт') as unit,
    mn.item_type,
    coalesce(mn.unit_of_measure, m.unit, 'шт') as unit_of_measure,
    'material_norms' as calculation_source,
    null::text as notes
  from shveyka.production_order_lines ol
  join shveyka.product_models pm on pm.id = ol.model_id
  join shveyka.material_norms mn
    on mn.product_model_id = pm.id
   and mn.is_active = true
  join shveyka.materials m
    on m.id = mn.material_id
  where ol.order_id = p_order_id
  group by m.id, m.name, m.current_stock, m.unit, mn.unit_of_measure, mn.item_type;

  insert into shveyka.material_requirements (
    order_id,
    material_id,
    material_name,
    required_quantity,
    available_quantity,
    shortage_quantity,
    unit,
    item_type,
    unit_of_measure,
    calculation_source,
    notes
  )
  select
    p_order_id as order_id,
    null::bigint as material_id,
    'Норми не задані: ' || pm.name as material_name,
    sum(coalesce(ol.quantity, 0))::numeric as required_quantity,
    0::numeric as available_quantity,
    sum(coalesce(ol.quantity, 0))::numeric as shortage_quantity,
    'шт' as unit,
    'missing_norms' as item_type,
    'шт' as unit_of_measure,
    'missing_norms' as calculation_source,
    'Для моделі немає матеріальних норм' as notes
  from shveyka.production_order_lines ol
  join shveyka.product_models pm on pm.id = ol.model_id
  left join shveyka.material_norms mn
    on mn.product_model_id = pm.id
   and mn.is_active = true
  where ol.order_id = p_order_id
    and mn.id is null
  group by pm.id, pm.name;
end;
$$;
