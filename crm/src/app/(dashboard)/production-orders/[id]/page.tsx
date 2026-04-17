'use client';

import { useCallback, useEffect, useState } from 'react';
import { showConfirm } from '@/lib/confirm';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { AlertTriangle, ArrowLeft, CheckCircle, Edit3, FileText, Layers, Loader2, Package, Plus, RefreshCw, ShoppingBag, Trash2, Play, XCircle } from 'lucide-react';
import { OrderWorkflowPanel } from '@/components/orders/OrderWorkflowPanel';
import { detectSizeType, extractSelectedSizes, getSizesByType } from '@/lib/sizeVariants';

type OrderLine = {
  id: number;
  model_id: number | null;
  model_name: string;
  model_sku: string | null;
  size?: string | null;
  quantity: number;
  quantity_produced: number;
};

type OrderBatch = {
  id: number;
  batch_number: string;
  status: string;
  quantity: number;
  product_model_id: number | null;
  route_card_id: number | null;
  sku: string | null;
  created_at: string;
  planned_start_date?: string | null;
  planned_end_date?: string | null;
  fabric_type?: string | null;
  fabric_color?: string | null;
  size_variants?: Record<string, any> | null;
  notes?: string | null;
  product_models?: {
    id: number;
    name: string;
    sku: string | null;
  } | null;
};

type ProductionOrder = {
  id: number;
  order_number: string;
  order_type: 'stock' | 'customer';
  customer_name: string | null;
  status: string;
  priority: string;
  order_date: string;
  planned_completion_date: string | null;
  total_quantity: number;
  total_lines: number;
  notes: string | null;
  lines: OrderLine[];
  batches?: OrderBatch[];
};

type MaterialReq = {
  id: number;
  material_id: number;
  material_name: string;
  item_type: string | null;
  unit_of_measure: string | null;
  required_quantity: number;
  available_quantity: number;
  shortage_quantity: number;
  status: 'ok' | 'shortage';
};

type Requirements = {
  order_id: number;
  order_number: string;
  can_launch: boolean;
  materials: MaterialReq[];
};

const STATUS_LABEL: Record<string, string> = {
  draft: 'Чернетка',
  approved: 'Затверджено',
  launched: 'Запущено',
  in_production: 'У виробництві',
  in_progress: 'Виконується',
  completed: 'Завершено',
  closed: 'Закрито',
  cancelled: 'Скасовано',
};

const STATUS_COLOR: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-600',
  approved: 'bg-blue-100 text-blue-700',
  launched: 'bg-green-100 text-green-700',
  in_production: 'bg-green-100 text-green-700',
  in_progress: 'bg-orange-100 text-orange-700',
  completed: 'bg-emerald-100 text-emerald-700',
  closed: 'bg-gray-100 text-gray-500',
  cancelled: 'bg-red-100 text-red-600',
};

const ITEM_TYPE_LABEL: Record<string, string> = {
  fabric: 'Тканина',
  thread: 'Нитки',
  accessory: 'Фурнітура',
  packaging: 'Пакування',
  raw_material: 'Сировина',
};

const PRIORITY_LABEL: Record<string, string> = {
  normal: 'Звичайний',
  high: 'Високий',
  urgent: 'Терміновий',
};

const PRIORITY_COLOR: Record<string, string> = {
  normal: 'text-gray-600',
  high: 'text-orange-600',
  urgent: 'text-red-600 font-semibold',
};

function getSizeSet(modelName?: string | null): readonly string[] {
  if (!modelName) return getSizesByType('adult');
  return getSizesByType(detectSizeType(modelName));
}

function parseFabricColors(value?: string | null) {
  if (!value) return [] as { color: string; rolls: string }[];
  return value
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const match = part.match(/^(.*?)(?:\s*\((\d+)\))?$/);
      const color = match?.[1]?.trim() || part;
      const rolls = match?.[2] || '1';
      return { color, rolls };
    });
}

function parseSelectedSizes(value?: Record<string, any> | null) {
  if (!value) return [] as string[];
  const raw = value.selected_sizes;
  return Array.isArray(raw) ? raw.map(String) : [];
}

async function readJsonResponse<T>(res: Response): Promise<T | null> {
  const text = await res.text();
  if (!text) return null;

  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(text.slice(0, 200) || 'Неочікувана відповідь сервера');
  }
}

export default function ProductionOrderDetailPage() {
  const params = useParams();
  const orderId = params?.id as string;

  const [order, setOrder] = useState<ProductionOrder | null>(null);
  const [requirements, setRequirements] = useState<Requirements | null>(null);
  const [loadingOrder, setLoadingOrder] = useState(true);
  const [loadingReqs, setLoadingReqs] = useState(false);
  const [approving, setApproving] = useState(false);
  const [launching, setLaunching] = useState(false);
  const [cancellingLaunch, setCancellingLaunch] = useState(false);
  const [savingOrder, setSavingOrder] = useState(false);
  const [creatingBatch, setCreatingBatch] = useState(false);
  const [showLaunchConfirm, setShowLaunchConfirm] = useState(false);
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [launchError, setLaunchError] = useState<{ message: string; details?: any[] } | null>(null);
  const [launchSuccess, setLaunchSuccess] = useState(false);
  const [batchError, setBatchError] = useState<string | null>(null);
  const [batchLoading, setBatchLoading] = useState(false);
  const [editingBatchId, setEditingBatchId] = useState<number | null>(null);
  const [batchDraft, setBatchDraft] = useState({
    model_id: '',
    planned_start_date: '',
    fabric_type: '',
    fabric_color_input: '',
    fabric_rolls_input: '1',
    fabric_colors: [] as { color: string; rolls: string }[],
    notes: '',
    selected_sizes: [] as string[],
  });
  const [editDraft, setEditDraft] = useState({
    customer_name: '',
    planned_completion_date: '',
    priority: 'normal',
    notes: '',
  });

  const fetchOrder = useCallback(async () => {
    setLoadingOrder(true);
    try {
      const res = await fetch(`/api/production-orders?id=${orderId}`);
      if (!res.ok) throw new Error('Замовлення не знайдено');
      const all = await readJsonResponse<any[]>(res);
      const found = Array.isArray(all) ? all.find((o: any) => String(o.id) === orderId) : null;
      if (!found) {
        setOrder(null);
        setError('Замовлення не знайдено');
      } else {
        setOrder(found);
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoadingOrder(false);
    }
  }, [orderId]);

  const fetchRequirements = useCallback(async () => {
    setLoadingReqs(true);
    setLaunchError(null);
    try {
      const res = await fetch(`/api/production-orders/${orderId}/requirements`);
      if (!res.ok) throw new Error('Помилка завантаження вимог');
      setRequirements(await readJsonResponse<Requirements>(res));
    } catch (e) {
      console.error('Requirements fetch failed:', e);
    } finally {
      setLoadingReqs(false);
    }
  }, [orderId]);

  useEffect(() => {
    fetchOrder();
  }, [fetchOrder]);

  useEffect(() => {
    if (order) fetchRequirements();
  }, [order, fetchRequirements]);

  useEffect(() => {
    if (!order) return;
    setEditDraft({
      customer_name: order.customer_name || '',
      planned_completion_date: order.planned_completion_date || '',
      priority: order.priority || 'normal',
      notes: order.notes || '',
    });
  }, [order]);
  const handleApprove = async () => {
    setApproving(true);
    setError(null);
    try {
      const res = await fetch(`/api/production-orders/${orderId}/approve`, { method: 'POST' });
      if (!res.ok) {
        const d = await readJsonResponse<{ error?: string }>(res);
        throw new Error(d?.error || 'Помилка затвердження');
      }
      await fetchOrder();
      await fetchRequirements();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setApproving(false);
    }
  };

  const handleOrderAction = async (action: 'launch' | 'cancel-launch' | 'complete' | 'close' | 'cancel') => {
    setError(null);
    setLaunchError(null);
    setLaunchSuccess(false);
    if (action === 'launch') setLaunching(true);
    if (action === 'cancel-launch') setCancellingLaunch(true);

    try {
      const res = await fetch(`/api/production-orders/${orderId}/${action}`, { method: 'POST' });
      const data = await readJsonResponse<{ error?: string; pending_batches?: any[]; shortage_details?: any[] }>(res);
      if (!res.ok) {
        if (action === 'launch' || action === 'cancel-launch') {
          setLaunchError({ message: data?.error || 'Помилка запуску', details: data?.pending_batches || data?.shortage_details });
        } else {
          throw new Error(data?.error || 'Помилка операції');
        }
      } else {
        if (action === 'launch') setLaunchSuccess(true);
        await fetchOrder();
        await fetchRequirements();
      }
    } catch (e: any) {
      if (action === 'launch' || action === 'cancel-launch') setLaunchError({ message: e.message });
      else setError(e.message);
    } finally {
      if (action === 'launch') setLaunching(false);
      if (action === 'cancel-launch') setCancellingLaunch(false);
    }
  };

  const handleCancelLaunch = async () => {
    if (!await showConfirm('Скасувати запуск? Це поверне замовлення у статус approved.')) return;
    await handleOrderAction('cancel-launch');
  };

  const handleSaveOrder = async () => {
    if (!order) return;
    setSavingOrder(true);
    setError(null);
    try {
      const res = await fetch(`/api/production-orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_name: order.order_type === 'customer' ? editDraft.customer_name : null,
          planned_completion_date: editDraft.planned_completion_date || null,
          priority: editDraft.priority,
          notes: editDraft.notes || null,
        }),
      });
      const data = (await readJsonResponse<{ error?: string }>(res)) || {};
      if (!res.ok) throw new Error(data.error || 'Не вдалося зберегти зміни');
      await fetchOrder();
      await fetchRequirements();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSavingOrder(false);
    }
  };

  const selectedBatchLine = order?.lines.find((line) => String(line.model_id ?? line.id) === batchDraft.model_id) || null;
  const selectedBatchSizeSet = getSizeSet(selectedBatchLine?.model_name);
  const batchQuantity = Number(selectedBatchLine?.quantity || 0);

  const openBatchModal = () => {
    const firstLine = order?.lines?.[0] || null;
    // Автоматически определяем размеры по названию модели
    const modelName = firstLine?.model_name || null;
    const defaultSizes = getSizeSet(modelName);

    setEditingBatchId(null);
    setBatchDraft({
      model_id: firstLine?.model_id ? String(firstLine.model_id) : '',
      planned_start_date: new Date().toISOString().slice(0, 10),
      fabric_type: '',
      fabric_color_input: '',
      fabric_rolls_input: '1',
      fabric_colors: [],
      notes: '',
      selected_sizes: [...defaultSizes], // Сразу выбираем все размеры нужного типа
    });
    setBatchError(null);
    setShowBatchModal(true);
  };

  const openEditBatchModal = async (batch: OrderBatch) => {
    setBatchLoading(true);
    setBatchError(null);
    try {
      const res = await fetch(`/api/batches/${batch.id}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Не вдалося відкрити партію');

      setEditingBatchId(batch.id);
      setBatchDraft({
        model_id: String(data.product_model_id ?? batch.product_model_id ?? ''),
        planned_start_date: data.planned_start_date || batch.planned_start_date || '',
        fabric_type: data.fabric_type || batch.fabric_type || '',
        fabric_color_input: '',
        fabric_rolls_input: '1',
        fabric_colors: parseFabricColors(data.fabric_color || batch.fabric_color),
        notes: data.notes || batch.notes || '',
        selected_sizes: parseSelectedSizes(data.size_variants || batch.size_variants),
      });
      setShowBatchModal(true);
    } catch (e: any) {
      setBatchError(e.message);
    } finally {
      setBatchLoading(false);
    }
  };

  const handleSaveBatch = async () => {
    if (!order) return;
    setCreatingBatch(true);
    setBatchError(null);
    try {
      const selectedLine = order.lines.find((line) => String(line.model_id ?? line.id) === batchDraft.model_id);
      if (!selectedLine || !selectedLine.model_id) throw new Error('Оберіть позицію замовлення');

      // --- ВАЛІДАЦІЯ ОБОВ'ЯЗКОВИХ ПОЛІВ ---
      if (!batchDraft.fabric_type?.trim()) {
        throw new Error("Поле 'Тип тканини' є обов'язковим");
      }
      
      const fabricColors = batchDraft.fabric_colors
        .map((item) => ({ color: String(item.color || '').trim(), rolls: Number(item.rolls) }))
        .filter((item) => item.color && Number.isFinite(item.rolls) && item.rolls > 0);
      
      if (fabricColors.length === 0) {
        throw new Error("Вкажіть хоча б один колір тканини та кількість рулонів");
      }

      const selectedSizes = batchDraft.selected_sizes.filter(Boolean);
      if (selectedSizes.length === 0) {
        throw new Error("Оберіть хоча б один розмір для партії");
      }

      const payload = {
        product_model_id: selectedLine.model_id,
        quantity: editingBatchId ? selectedLine.quantity : (batchQuantity > 0 ? batchQuantity : Number(selectedLine.quantity || 0)),
        status: 'created',
        sku: selectedLine.model_sku || null,
        fabric_type: batchDraft.fabric_type,
        fabric_color: fabricColors.map((item) => `${item.color} (${item.rolls})`).join(', '),
        planned_start_date: batchDraft.planned_start_date || null,
        planned_end_date: order.planned_completion_date || null,
        notes: batchDraft.notes || null,
        is_urgent: order.priority === 'urgent',
        size_variants: { selected_sizes: selectedSizes },
      };

      const res = await fetch(editingBatchId ? `/api/batches/${editingBatchId}` : `/api/production-orders/${orderId}/batches`, {
        method: editingBatchId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingBatchId ? payload : {
          model_id: selectedLine.model_id,
          quantity: batchQuantity > 0 ? batchQuantity : Number(selectedLine.quantity || 0),
          planned_start_date: batchDraft.planned_start_date || null,
          fabric_type: batchDraft.fabric_type || null,
          fabric_colors: fabricColors,
          selected_sizes: batchDraft.selected_sizes.filter(Boolean),
          notes: batchDraft.notes || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || (editingBatchId ? 'Не вдалося зберегти партію' : 'Не вдалося створити партію'));
      setShowBatchModal(false);
      setEditingBatchId(null);
      await fetchOrder();
    } catch (e: any) {
      setBatchError(e.message);
    } finally {
      setCreatingBatch(false);
    }
  };

  const handleDeleteBatch = async (batch: OrderBatch) => {
    if (batch.status !== 'created') {
      setError('Партію можна видаляти лише до початку наступного етапу.');
      return;
    }
    if (!await showConfirm(`Видалити партію ${batch.batch_number}?`)) return;
    try {
      const res = await fetch(`/api/batches/${batch.id}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Не вдалося видалити партію');
      await fetchOrder();
      await fetchRequirements();
    } catch (e: any) {
      setError(e.message);
    }
  };

  if (loadingOrder) {
    return <div className="flex min-h-[400px] items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-blue-600" /></div>;
  }

  if (error || !order) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <div className="p-6 bg-red-50 border border-red-200 rounded-xl text-red-600 text-center">
          <AlertTriangle className="h-8 w-8 mx-auto mb-2" />
          {error || 'Замовлення не знайдено'}
        </div>
        <Link href="/production-orders" className="flex items-center gap-2 mt-4 text-sm text-gray-500 hover:text-gray-800">
          <ArrowLeft size={16} /> До списку
        </Link>
      </div>
    );
  }

  const statusCls = STATUS_COLOR[order.status] || 'bg-gray-100 text-gray-600';
  const canLaunch = requirements?.can_launch && order.status === 'approved';

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <Link href="/production-orders" className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800 mb-4">
          <ArrowLeft size={15} /> Виробничі замовлення
        </Link>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900">{order.order_number}</h1>
              <span className={`px-3 py-1 rounded-full text-sm font-semibold ${statusCls}`}>{STATUS_LABEL[order.status] || order.status}</span>
            </div>
            <p className={`text-sm mt-1 ${PRIORITY_COLOR[order.priority] || 'text-gray-500'}`}>
              Пріоритет: {PRIORITY_LABEL[order.priority] || order.priority}
              {order.customer_name && <span className="text-gray-400 font-normal"> · Замовник: {order.customer_name}</span>}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => { fetchOrder(); fetchRequirements(); }} className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-400" title="Оновити">
              <RefreshCw size={16} />
            </button>
            {!['closed', 'cancelled'].includes(order.status) && (
              <button onClick={openBatchModal} className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium">
                <Plus size={16} /> Створити партію
              </button>
            )}
            {order.status === 'draft' && (
              <button onClick={handleApprove} disabled={approving} className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white rounded-lg text-sm font-medium">
                {approving ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle size={16} />} Затвердити
              </button>
            )}
            {order.status === 'approved' && (
              <button onClick={() => setShowLaunchConfirm(true)} disabled={launching || !canLaunch} title={!canLaunch ? 'Запуск доступний тільки після затвердження' : undefined} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${canLaunch ? 'bg-green-600 hover:bg-green-700 text-white' : 'bg-gray-200 text-gray-400 cursor-not-allowed'}`}>
                {launching ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />} Запустити у виробництво
              </button>
            )}
            {order.status === 'launched' && <button onClick={() => handleOrderAction('complete')} className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium"><CheckCircle size={16} /> Завершити</button>}
            {order.status === 'launched' && <button onClick={handleCancelLaunch} disabled={cancellingLaunch} className="flex items-center gap-2 px-4 py-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg text-sm font-medium disabled:opacity-60">{cancellingLaunch ? <Loader2 size={16} className="animate-spin" /> : <XCircle size={16} />} Скасувати запуск</button>}
            {order.status === 'completed' && <button onClick={() => handleOrderAction('close')} className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-800 text-white rounded-lg text-sm font-medium"><FileText size={16} /> Закрити</button>}
            {['draft', 'approved'].includes(order.status) && <button onClick={() => handleOrderAction('cancel')} className="flex items-center gap-2 px-4 py-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg text-sm font-medium"><AlertTriangle size={16} /> Скасувати</button>}
          </div>
        </div>
      </div>

      {launchSuccess && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-xl flex items-center gap-3 text-green-700">
          <CheckCircle size={20} className="shrink-0" />
          <div>
            <p className="font-semibold">Замовлення запущено у виробництво!</p>
            <p className="text-sm">Партії створюються вручну по кожній моделі, а розхід зі складу буде відображено окремо.</p>
          </div>
        </div>
      )}
      {launchError && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700">
          <div className="flex items-center gap-2 font-semibold mb-2">
            <AlertTriangle size={18} />
            {launchError.message}
          </div>
          {launchError.details && launchError.details.length > 0 && (
            <table className="w-full text-sm mt-2">
              <thead>
                <tr className="text-left text-red-600 text-xs uppercase">
                  <th className="pb-1">Матеріал</th>
                  <th className="pb-1 text-right">Потрібно</th>
                  <th className="pb-1 text-right">Є</th>
                  <th className="pb-1 text-right">Нестача</th>
                </tr>
              </thead>
              <tbody>
                {launchError.details.map((d, i) => (
                  <tr key={i} className="border-t border-red-100">
                    <td className="py-1">{d.material_name}</td>
                    <td className="py-1 text-right">{d.required}</td>
                    <td className="py-1 text-right">{d.available}</td>
                    <td className="py-1 text-right font-bold">{d.shortage}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4 flex items-center gap-2">
          <FileText size={15} /> Інформація про замовлення
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div>
            <div className="text-xs text-gray-400">Дата</div>
            <div className="text-sm font-medium mt-0.5">{new Date(order.order_date).toLocaleDateString('uk-UA')}</div>
          </div>
          <div>
            <div className="text-xs text-gray-400">Тип</div>
            <div className="text-sm font-medium mt-0.5">{order.order_type === 'customer' ? 'На замовника' : 'На склад'}</div>
          </div>
          <div>
            <div className="text-xs text-gray-400">Кількість</div>
            <div className="text-2xl font-bold text-gray-900 mt-0.5">{order.total_quantity} <span className="text-sm text-gray-400">шт</span></div>
          </div>
          <div>
            <div className="text-xs text-gray-400">Позицій</div>
            <div className="text-2xl font-bold text-gray-900 mt-0.5">{order.total_lines}</div>
          </div>
        </div>
        {order.notes && <div className="mt-4 pt-4 border-t border-gray-100 text-sm text-gray-600">{order.notes}</div>}
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <div className="flex items-center justify-between gap-3 mb-4">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-2"><RefreshCw size={15} /> Редагування замовлення</h2>
          <button onClick={handleSaveOrder} disabled={savingOrder} className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white rounded-lg text-sm font-medium">
            {savingOrder ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle size={16} />} Зберегти зміни
          </button>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {order.order_type === 'customer' && (
            <label className="block">
              <span className="block text-xs font-medium text-gray-500 mb-1">Замовник</span>
              <input value={editDraft.customer_name} onChange={(e) => setEditDraft((d) => ({ ...d, customer_name: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Ім'я замовника" />
            </label>
          )}
          <label className="block">
            <span className="block text-xs font-medium text-gray-500 mb-1">Планова дата завершення</span>
            <input type="date" value={editDraft.planned_completion_date} onChange={(e) => setEditDraft((d) => ({ ...d, planned_completion_date: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </label>
          <label className="block">
            <span className="block text-xs font-medium text-gray-500 mb-1">Пріоритет</span>
            <select value={editDraft.priority} onChange={(e) => setEditDraft((d) => ({ ...d, priority: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="normal">Звичайний</option>
              <option value="high">Високий</option>
              <option value="urgent">Терміновий</option>
            </select>
          </label>
          <label className="block md:col-span-2">
            <span className="block text-xs font-medium text-gray-500 mb-1">Примітки</span>
            <textarea value={editDraft.notes} onChange={(e) => setEditDraft((d) => ({ ...d, notes: e.target.value }))} rows={3} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Додаткові коментарі" />
          </label>
        </div>
      </div>

      <OrderWorkflowPanel orderId={Number(order.id)} currentStatus={order.status} canLaunch={requirements?.can_launch ?? false} onChanged={async () => { await fetchOrder(); await fetchRequirements(); }} />

      {order.lines && order.lines.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-2"><ShoppingBag size={15} /> Позиції замовлення</h2>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr className="text-left text-xs uppercase text-gray-400">
                <th className="px-5 py-3">Модель</th>
                <th className="px-5 py-3">Артикул</th>
                <th className="px-5 py-3">Розмір</th>
                <th className="px-5 py-3 text-right">Кількість</th>
                <th className="px-5 py-3 text-right">Вироблено</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {order.lines.map((line) => (
                <tr key={line.id} className="hover:bg-gray-50">
                  <td className="px-5 py-3 font-medium text-gray-900">{line.model_name || '—'}</td>
                  <td className="px-5 py-3 text-gray-500 font-mono text-xs">{line.model_sku || '—'}</td>
                  <td className="px-5 py-3"><span className="px-2 py-0.5 bg-gray-100 rounded text-xs font-medium">{line.size || '—'}</span></td>
                  <td className="px-5 py-3 text-right font-bold text-gray-900">{line.quantity}</td>
                  <td className="px-5 py-3 text-right text-gray-500">{line.quantity_produced ?? 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {order.batches && order.batches.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-2"><Package size={15} /> Партії замовлення</h2>
            <span className="text-xs text-gray-400">{order.batches.length} шт.</span>
          </div>
          <div className="divide-y divide-gray-100">
            {order.batches.map((batch) => (
              <div key={batch.id} className="px-5 py-4 flex items-center justify-between gap-4">
                <div>
                  <div className="font-semibold text-gray-900">{batch.batch_number}</div>
                  <div className="text-xs text-gray-400 mt-1">{batch.quantity} шт · SKU {batch.sku || '—'} · route card {batch.route_card_id || '—'}</div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_COLOR[batch.status] || 'bg-gray-100 text-gray-600'}`}>{STATUS_LABEL[batch.status] || batch.status}</span>
                  {batch.status === 'created' && (
                    <>
                      <button
                        type="button"
                        onClick={() => openEditBatchModal(batch)}
                        className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700"
                      >
                        <Edit3 size={14} />
                        Редагувати
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteBatch(batch)}
                        className="inline-flex items-center gap-1 text-xs font-medium text-red-600 hover:text-red-700"
                      >
                        <Trash2 size={14} />
                        Видалити
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100"><h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-2"><Layers size={15} /> Вимоги до матеріалів</h2></div>
        {loadingReqs ? (
          <div className="p-5 text-sm text-gray-500 flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Завантаження вимог...</div>
        ) : !requirements || requirements.materials.length === 0 ? (
          <div className="p-5 text-sm text-gray-500">Немає даних про матеріали.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50"><tr className="text-left text-xs uppercase text-gray-400"><th className="px-5 py-3">Матеріал</th><th className="px-5 py-3">Тип</th><th className="px-5 py-3 text-right">Потрібно</th><th className="px-5 py-3 text-right">Є</th><th className="px-5 py-3 text-right">Нестача</th><th className="px-5 py-3 text-right">Статус</th></tr></thead>
            <tbody className="divide-y divide-gray-100">
              {requirements.materials.map((material) => (
                <tr key={material.id}>
                  <td className="px-5 py-3 font-medium text-gray-900">{material.material_name}</td>
                  <td className="px-5 py-3 text-gray-500">{ITEM_TYPE_LABEL[material.item_type || ''] || material.item_type || '—'}</td>
                  <td className="px-5 py-3 text-right">{material.required_quantity}</td>
                  <td className="px-5 py-3 text-right">{material.available_quantity}</td>
                  <td className="px-5 py-3 text-right font-semibold text-gray-900">{material.shortage_quantity}</td>
                  <td className="px-5 py-3 text-right"><span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${material.status === 'ok' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{material.status === 'ok' ? 'OK' : 'Нестача'}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {showLaunchConfirm && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900">Запустити замовлення?</h3>
            <p className="text-sm text-gray-500 mt-2">Це переведе замовлення у виробництво і створить партії на основі доступних позицій.</p>
            <div className="mt-6 flex items-center justify-end gap-3">
              <button onClick={() => setShowLaunchConfirm(false)} className="px-4 py-2 rounded-lg border border-gray-200 text-sm text-gray-700 hover:bg-gray-50">Скасувати</button>
              <button onClick={async () => { setShowLaunchConfirm(false); await handleOrderAction('launch'); }} className="px-4 py-2 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-700">Підтвердити запуск</button>
            </div>
          </div>
        </div>
      )}

      {showBatchModal && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between gap-3 mb-4">
              <h3 className="text-lg font-semibold text-gray-900">
                {editingBatchId ? 'Редагувати партію' : 'Створити партію'}
              </h3>
              <button onClick={() => { setShowBatchModal(false); setEditingBatchId(null); }} className="text-gray-400 hover:text-gray-600"><XCircle size={20} /></button>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="block md:col-span-2">
                <span className="block text-xs font-medium text-gray-500 mb-1">Позиція</span>
                <select
                  value={batchDraft.model_id}
                  onChange={(e) => {
                    const val = e.target.value;
                    const line = order.lines.find(l => String(l.model_id ?? l.id) === val);
                    const sizes = line ? getSizeSet(line.model_name) : [];
                    setBatchDraft((d) => ({ ...d, model_id: val, selected_sizes: [...sizes] }));
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                >
                  <option value="">Оберіть позицію</option>
                  {order.lines.map((line) => (
                    <option key={line.id} value={String(line.model_id ?? line.id)}>
                      {line.model_name} {line.model_sku ? `· ${line.model_sku}` : ''}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="block text-xs font-medium text-gray-500 mb-1">Планова дата старту</span>
                <input
                  type="date"
                  value={batchDraft.planned_start_date}
                  onChange={(e) => setBatchDraft((d) => ({ ...d, planned_start_date: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </label>

              <label className="block">
                <span className="block text-xs font-medium text-gray-500 mb-1">Тип тканини</span>
                <input
                  value={batchDraft.fabric_type}
                  onChange={(e) => setBatchDraft((d) => ({ ...d, fabric_type: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  placeholder="Трикотаж, фліс..."
                />
              </label>

              <label className="block md:col-span-2">
                <span className="block text-xs font-medium text-gray-500 mb-1">Розмірна сітка</span>
                <div className="flex flex-wrap gap-2">
                  {selectedBatchSizeSet.map((size) => (
                    <button
                      key={size}
                      type="button"
                      onClick={() => setBatchDraft((d) => ({ ...d, selected_sizes: d.selected_sizes.includes(size) ? d.selected_sizes.filter((item) => item !== size) : [...d.selected_sizes, size] }))}
                      className={`px-3 py-1.5 rounded-lg text-sm border ${batchDraft.selected_sizes.includes(size) ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 border-gray-300'}`}
                    >
                      {size}
                    </button>
                  ))}
                </div>
              </label>

              <label className="block md:col-span-2">
                <span className="block text-xs font-medium text-gray-500 mb-1">Кольори тканини</span>
                <div className="space-y-2">
                  <div className="grid grid-cols-[1fr_110px_auto] gap-2 items-center">
                    <input
                      value={batchDraft.fabric_color_input}
                      onChange={(e) => setBatchDraft((d) => ({ ...d, fabric_color_input: e.target.value }))}
                      className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      placeholder="Колір"
                    />
                    <input
                      value={batchDraft.fabric_rolls_input}
                      onChange={(e) => setBatchDraft((d) => ({ ...d, fabric_rolls_input: e.target.value }))}
                      className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      placeholder="Рулони"
                      type="number"
                      min="1"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const color = batchDraft.fabric_color_input.trim();
                        const rolls = Number(batchDraft.fabric_rolls_input);
                        if (!color || !Number.isFinite(rolls) || rolls < 1) return;
                        setBatchDraft((d) => ({
                          ...d,
                          fabric_colors: [...d.fabric_colors, { color, rolls: String(Math.trunc(rolls)) }],
                          fabric_color_input: '',
                          fabric_rolls_input: '1',
                        }));
                      }}
                      className="px-4 py-2 rounded-lg bg-gray-900 text-white text-sm"
                    >
                      Додати
                    </button>
                  </div>
                  {batchDraft.fabric_colors.length > 0 && (
                    <div className="space-y-2">
                      {batchDraft.fabric_colors.map((item, index) => (
                        <div key={`${item.color}-${index}`} className="grid grid-cols-[1fr_110px_auto] gap-2 items-center rounded-lg border border-gray-200 p-2">
                          <div className="px-2 py-1.5 rounded-md bg-blue-50 text-blue-700 text-sm font-medium">
                            {item.color}
                          </div>
                          <input
                            type="number"
                            min="1"
                            value={item.rolls}
                            onChange={(e) => setBatchDraft((d) => ({
                              ...d,
                              fabric_colors: d.fabric_colors.map((entry, idx) => idx === index ? { ...entry, rolls: e.target.value } : entry),
                            }))}
                            className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                          />
                          <button
                            type="button"
                            onClick={() => setBatchDraft((d) => ({ ...d, fabric_colors: d.fabric_colors.filter((_, idx) => idx !== index) }))}
                            className="p-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50"
                          >
                            <XCircle size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </label>

              <label className="block md:col-span-2">
                <span className="block text-xs font-medium text-gray-500 mb-1">Примітки</span>
                <textarea
                  value={batchDraft.notes}
                  onChange={(e) => setBatchDraft((d) => ({ ...d, notes: e.target.value }))}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  placeholder="Додаткові вказівки"
                />
              </label>
            </div>
            {batchError && <div className="mt-4 p-3 rounded-lg bg-red-50 text-red-700 text-sm">{batchError}</div>}
            {batchLoading && <div className="mt-4 p-3 rounded-lg bg-blue-50 text-blue-700 text-sm">Завантажуємо дані партії...</div>}
            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                onClick={() => { setShowBatchModal(false); setEditingBatchId(null); }}
                className="px-4 py-2 rounded-lg border border-gray-200 text-sm text-gray-700 hover:bg-gray-50"
              >
                Скасувати
              </button>
              <button
                onClick={handleSaveBatch}
                disabled={creatingBatch || batchLoading}
                className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-60"
              >
                {creatingBatch
                  ? editingBatchId ? 'Зберігаємо...' : 'Створення...'
                  : editingBatchId ? 'Зберегти зміни' : 'Створити партію'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

