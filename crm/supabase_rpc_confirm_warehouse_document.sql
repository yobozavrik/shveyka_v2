CREATE OR REPLACE FUNCTION confirm_warehouse_document(p_doc_id bigint)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_doc RECORD;
    v_tx RECORD;
    v_mat RECORD;
BEGIN
    -- Найти документ
    SELECT * INTO v_doc FROM warehouse_documents WHERE id = p_doc_id FOR UPDATE;
    IF v_doc.status != 'draft' THEN
        RAISE EXCEPTION 'Документ вже проведений або скасований';
    END IF;

    -- Пройтись по всіх транзакціях
    FOR v_tx IN SELECT * FROM warehouse_transactions WHERE document_id = p_doc_id
    LOOP
        -- Блокуємо матеріал
        SELECT * INTO v_mat FROM materials WHERE id = v_tx.material_id FOR UPDATE;
        
        -- Оновлюємо quantity_before та quantity_after
        UPDATE warehouse_transactions 
        SET quantity_before = v_mat.current_stock,
            quantity_after = v_mat.current_stock + v_tx.quantity
        WHERE id = v_tx.id;
        
        -- Оновлюємо склад та ціну
        UPDATE materials
        SET current_stock = current_stock + v_tx.quantity,
            price_per_unit = COALESCE(v_tx.price_per_unit, price_per_unit)
        WHERE id = v_mat.id;
    END LOOP;

    -- Міняємо статус
    UPDATE warehouse_documents SET status = 'completed', updated_at = NOW() WHERE id = p_doc_id;
    
    RETURN true;
END;
$$;
