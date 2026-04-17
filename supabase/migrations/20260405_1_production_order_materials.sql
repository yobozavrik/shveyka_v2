-- Migration to rename material_requirements to production_order_materials
-- and update the related function 'calculate_material_requirements'

ALTER TABLE shveyka.material_requirements RENAME TO production_order_materials;
ALTER SEQUENCE IF EXISTS shveyka.material_requirements_id_seq RENAME TO production_order_materials_id_seq;

-- Drop the old function
DROP FUNCTION IF EXISTS shveyka.calculate_material_requirements(integer);

-- Recreate function to use production_order_materials
CREATE OR REPLACE FUNCTION shveyka.calculate_material_requirements(p_order_id integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_order_status varchar;
BEGIN
  -- Get order status to ensure it exists
  SELECT status INTO v_order_status
  FROM shveyka.production_orders
  WHERE id = p_order_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order % not found', p_order_id;
  END IF;

  -- Delete old requirements for this order
  DELETE FROM shveyka.production_order_materials WHERE order_id = p_order_id;

  -- Insert new requirements calculated from Product Models (BOM)
  INSERT INTO shveyka.production_order_materials (
    order_id,
    order_line_id,
    material_id,
    material_name,
    item_type,
    unit_of_measure,
    required_quantity,
    available_quantity,
    shortage_quantity,
    calculation_source,
    calculated_at
  )
  SELECT
    p_order_id,
    ol.id,
    mn.material_id,
    m.name,
    mn.item_type,
    COALESCE(mn.unit_of_measure, m.unit),
    (mn.quantity_per_unit * ol.quantity) AS required_quantity,
    COALESCE(m.current_stock, 0) AS available_quantity,
    GREATEST(0, (mn.quantity_per_unit * ol.quantity) - COALESCE(m.current_stock, 0)) AS shortage_quantity,
    'norm',
    now()
  FROM shveyka.production_order_lines ol
  JOIN shveyka.product_models pm ON pm.id = ol.model_id
  JOIN shveyka.material_norms mn ON mn.product_model_id = pm.id
  JOIN shveyka.items m ON m.id = mn.material_id
  WHERE ol.order_id = p_order_id;
  
END;
$$;
