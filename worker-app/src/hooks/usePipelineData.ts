import { useState, useEffect, useCallback } from 'react';

interface SizeQty {
  size: string;
  confirmed_qty: number;
  submitted_qty: number;
  defect_qty: number;
  metric_qty: number;
  local_id?: string;
}

interface PipelineOp {
  id: number;
  name: string;
  sizes: SizeQty[];
}

interface BatchInfo {
  id: number;
  batch_number: string;
  quantity: number;
  size_variants: Record<string, number>;
  product_models: { name: string } | null;
}

export interface SizeValues {
  qty: string;
  defect: string;
  metric: string;
  local_id: string | null;
}

export function usePipelineData(batchId: string | null, opId: string | null) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [batch, setBatch] = useState<BatchInfo | null>(null);
  const [incomingSizes, setIncomingSizes] = useState<Record<string, number>>({});
  const [initialQuantities, setInitialQuantities] = useState<Record<string, SizeValues>>({});

  useEffect(() => {
    setLoading(true);
    setError('');
    setBatch(null);
    setIncomingSizes({});
    setInitialQuantities({});
  }, [batchId, opId]);

  const loadData = useCallback(async () => {
    if (!batchId || !opId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const [batchRes, pipeRes] = await Promise.all([
        fetch(`/api/mobile/batches/${batchId}`),
        fetch(`/api/mobile/batches/${batchId}/pipeline`)
      ]);

      if (!batchRes.ok || !pipeRes.ok) throw new Error('Помилка завантаження');

      const batchData = await batchRes.json();
      const pipeData = await pipeRes.json();
      
      setBatch(batchData);

      const pipeline: PipelineOp[] = pipeData.pipeline || [];
      const curIdx = pipeline.findIndex(op => op.id === parseInt(opId));
      const currentOp = pipeline[curIdx];
      
      const dict: Record<string, SizeValues> = {};
      const incoming: Record<string, number> = {};

      if (curIdx > 0) {
        const prevOp = pipeline[curIdx - 1];
        prevOp.sizes.forEach(sz => {
          incoming[sz.size] = sz.confirmed_qty;
        });
      } else if (batchData.size_variants) {
        Object.entries(batchData.size_variants).forEach(([size, qty]) => {
          incoming[size] = Number(qty);
        });
      }

      if (currentOp) {
        currentOp.sizes.forEach(sz => {
          dict[sz.size] = {
            qty: String(sz.submitted_qty || sz.confirmed_qty || 0),
            defect: String(sz.defect_qty || 0),
            metric: String(sz.metric_qty || 0),
            local_id: sz.local_id || null
          };
        });
      }

      // FALLBACK: If first operation and grid is still empty, add default sizes
      if (curIdx === 0 && Object.keys(dict).length === 0) {
        ['S', 'M', 'L', 'XL', '2XL'].forEach(sz => {
          dict[sz] = { qty: '', defect: '', metric: '', local_id: null };
        });
      }

      setIncomingSizes(incoming);
      setInitialQuantities(dict);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [batchId, opId]);

  useEffect(() => { loadData(); }, [loadData]);

  return { batch, loading, error, incomingSizes, initialQuantities, reload: loadData };
}
