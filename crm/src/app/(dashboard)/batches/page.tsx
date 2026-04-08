'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { 
  Package, Search, Plus, Calendar, Layers, Loader2, 
  AlertTriangle, X, Check, Trash2, Scissors, 
  ArrowRight, Clock, MessageSquare, Edit3 
} from 'lucide-react';

interface ProductModel { id: number; name: string; sku: string; thumbnail_url?: string | null; sizes?: string[] | null }
interface Employee { id: number; full_name: string }
interface Batch {
  id: number;
  batch_number: string;
  sku: string | null;
  product_model_id: number | null;
  quantity: number;
  status: string;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  fabric_type: string | null;
  fabric_color: string | null;
  thread_number: string | null;
  embroidery_type: string | null;
  embroidery_color: string | null;
  nastyl_number: number | null;
  source_order: string | null;
  client_name: string | null;
  supervisor_id: number | null;
  planned_start_date: string | null;
  planned_end_date: string | null;
  is_urgent: boolean;
  notes: string | null;
  product_models: ProductModel | null;
  employees?: Employee | null;
  size_variants?: Record<string, number | string[]> | null;
  operations_progress?: Record<number, number>;
}

interface BatchStageTask {
  id: number;
  status: string;
  task_type: string | null;
  assigned_role: string | null;
  launched_at: string | null;
  accepted_at: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
  notes: string | null;
}

interface BatchStageEntry {
  id: number;
  batch_id: number;
  stage_id: number | null;
  operation_id: number | null;
  employee_id: number | null;
  entry_number: number | null;
  quantity: number | null;
  data: Record<string, any> | null;
  notes: string | null;
  recorded_at: string;
  operation_code?: string | null;
  operation_name?: string | null;
}

interface BatchStageSummary {
  id: number;
  code: string;
  name: string;
  assigned_role: string;
  sequence_order: number;
  color: string | null;
  is_active: boolean;
  task: BatchStageTask | null;
  entries_count: number;
  quantity_total: number;
  latest_entry_at: string | null;
  is_current: boolean;
  is_completed: boolean;
  entries?: BatchStageEntry[];
}

interface BatchFlowResponse {
  batch: Batch;
  stages: BatchStageSummary[];
  current_stage: BatchStageSummary | null;
  current_task: BatchStageTask | null;
  next_stage: BatchStageSummary | null;
  can_transfer_next: boolean;
  completed_stages: number;
  total_entries: number;
}

function formatStageDataValue(value: any): string {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'boolean') return value ? 'Так' : 'Ні';
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : '—';
  if (Array.isArray(value)) return value.map(formatStageDataValue).join(', ');
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function formatStageDataEntries(data: Record<string, any> | null | undefined): string[] {
  if (!data || typeof data !== 'object') return [];
  return Object.entries(data)
    .filter(([, value]) => value !== null && value !== undefined && value !== '')
    .map(([key, value]) => `${key}: ${formatStageDataValue(value)}`);
}

function getNastilEntries(entries: BatchStageEntry[]) {
  return entries.filter((entry) => entry.operation_code === 'nastil');
}

function getSizeVariantEntries(sizeVariants: Record<string, number | string[]> | null | undefined) {
  return Object.entries(sizeVariants || {})
    .filter(([size, val]) => Boolean(size) && size !== 'selected_sizes' && typeof val === 'number')
    .sort((left, right) => {
      const normalize = (value: string) => value.trim().toLowerCase().replace(/\s+/g, '');
      const leftValue = normalize(left[0]);
      const rightValue = normalize(right[0]);
      const apparelOrder = ['xxs', 'xs', 's', 'm', 'l', 'xl', 'xxl', 'xxxl', '4xl', '5xl', '6xl'];
      const leftIndex = apparelOrder.indexOf(leftValue);
      const rightIndex = apparelOrder.indexOf(rightValue);

      if (leftIndex !== -1 || rightIndex !== -1) {
        if (leftIndex === -1) return 1;
        if (rightIndex === -1) return -1;
        return leftIndex - rightIndex;
      }

      const leftNumber = Number(leftValue.replace(',', '.'));
      const rightNumber = Number(rightValue.replace(',', '.'));
      const leftIsNumber = Number.isFinite(leftNumber) && /^\d+(?:[.,]\d+)?$/.test(leftValue);
      const rightIsNumber = Number.isFinite(rightNumber) && /^\d+(?:[.,]\d+)?$/.test(rightValue);

      if (leftIsNumber && rightIsNumber) return leftNumber - rightNumber;
      if (leftIsNumber) return -1;
      if (rightIsNumber) return 1;

      return left[0].localeCompare(right[0], 'uk', { numeric: true, sensitivity: 'base' });
  });
}

function getBatchSizeLabels(batch: Batch | null | undefined, flowBatch: Batch | null | undefined): string[] {
  const fromModel = batch?.product_models?.sizes || flowBatch?.product_models?.sizes || [];
  if (Array.isArray(fromModel) && fromModel.filter(Boolean).length > 0) {
    return fromModel.filter((size): size is string => Boolean(size)).map((size) => String(size).trim()).filter(Boolean);
  }

  // New format: { selected_sizes: ["XS","S","M",...] }
  const selectedSizesArr = batch?.size_variants?.selected_sizes ?? flowBatch?.size_variants?.selected_sizes;
  if (Array.isArray(selectedSizesArr) && selectedSizesArr.filter(Boolean).length > 0) {
    return selectedSizesArr.map(String).filter(Boolean);
  }

  // Legacy format: { XS: 21, S: 21, ... }
  const fromVariants = Object.keys(batch?.size_variants || {})
    .filter((key) => key && key !== 'selected_sizes' && key !== 'total');

  return fromVariants;
}

const EMBROIDERY_TYPES = [
  { value: '', label: 'Не вказано' },
  { value: 'немає', label: 'Немає' },
  { value: 'вишивка', label: 'Вишивка' },
  { value: 'нашивка', label: 'Нашивка' },
  { value: 'принт', label: 'Принт' },
  { value: 'термодрук', label: 'Термодрук' },
  { value: 'вишивка+нашивка', label: 'Вишивка + Нашивка' },
];

const EMBROIDERY_COLORS = [
  { value: '', label: 'Не вказано' },
  { value: 'немає', label: 'Немає' },
  { value: 'білий', label: 'Білий' },
  { value: 'чорний', label: 'Чорний' },
  { value: 'золотий', label: 'Золотий' },
  { value: 'срібний', label: 'Срібний' },
  { value: 'червоний', label: 'Червоний' },
  { value: 'синій', label: 'Синій' },
  { value: 'зелений', label: 'Зелений' },
  { value: 'жовтий', label: 'Жовтий' },
  { value: 'рожевий', label: 'Рожевий' },
  { value: 'різнокольоровий', label: 'Різнокольоровий' },
];

const PRODUCTION_STEPS = [
  { id: 7,  label: 'Розкрій',      short: 'Р' },
  { id: 13, label: 'Вишивка',      short: 'В' },
  { id: 9,  label: 'Оверлок',      short: 'О' },
  { id: 14, label: 'Прямострочка', short: 'П' },
  { id: 15, label: 'Розпошив',     short: 'Рз' },
  { id: 12, label: 'Упаковка',     short: 'У' },
];

const STATUS_MAP: Record<string, { label: string; color: string; bg: string; dot: string }> = {
  created:          { label: 'Створено',       color: 'text-slate-600 dark:text-slate-400',   bg: 'bg-slate-100 dark:bg-slate-800', dot: 'bg-slate-400' },
  cutting:          { label: 'Розкрій',        color: 'text-orange-700 dark:text-orange-400',  bg: 'bg-orange-50 dark:bg-orange-950/30', dot: 'bg-orange-500' },
  embroidery:       { label: 'Вишивка',        color: 'text-purple-700 dark:text-purple-400', bg: 'bg-purple-50 dark:bg-purple-950/30', dot: 'bg-purple-500' },
  sewing:           { label: 'Пошив',          color: 'text-indigo-700 dark:text-indigo-400',  bg: 'bg-indigo-50 dark:bg-indigo-950/30', dot: 'bg-indigo-500' },
  quality_control:  { label: 'ОТК',            color: 'text-amber-700 dark:text-amber-400',   bg: 'bg-amber-50 dark:bg-amber-950/30',   dot: 'bg-amber-500' },
  packaging:        { label: 'Упаковка',       color: 'text-cyan-700 dark:text-cyan-400',     bg: 'bg-cyan-50 dark:bg-cyan-950/30',    dot: 'bg-cyan-500' },
  ready:            { label: 'Готово',         color: 'text-emerald-700 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-950/30', dot: 'bg-emerald-500' },
  shipped:          { label: 'Відвантажено',   color: 'text-blue-700 dark:text-blue-400',    bg: 'bg-blue-50 dark:bg-blue-950/30',   dot: 'bg-blue-500' },
  cancelled:        { label: 'Скасовано',      color: 'text-red-700 dark:text-red-400',     bg: 'bg-red-50 dark:bg-red-950/30',    dot: 'bg-red-500' },
};

const EMPTY_FORM = { 
  batch_number: '', 
  sku: '',
  product_model_id: '', 
  quantity: '', 
  status: 'created', 
  priority: 'normal',
  fabric_type: '',
  fabric_color: '',
  thread_number: '',
  embroidery_type: '',
  embroidery_color: '',
  nastyl_number: '',
  supervisor_id: '',
  planned_start_date: '',
  planned_end_date: '',
  is_urgent: false, 
  notes: '' 
};

function BatchesContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  
  const [batches, setBatches] = useState<Batch[]>([]);
  const [models, setModels] = useState<ProductModel[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);

  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || 'all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [searchModel, setSearchModel] = useState('');
  const [form, setForm] = useState(EMPTY_FORM);
  const [selectedBatch, setSelectedBatch] = useState<Batch | null>(null);
  const [batchFlow, setBatchFlow] = useState<BatchFlowResponse | null>(null);
  const [activeStageCode, setActiveStageCode] = useState<string | null>(null);
  const [activeNastilId, setActiveNastilId] = useState<number | null>(null);
  const [nastilEmbroidery, setNastilEmbroidery] = useState<{ type: string; color: string }>({ type: '', color: '' });
  const [embroideryPending, setEmbroideryPending] = useState(false);
  const [embroideryDirty, setEmbroideryDirty] = useState(false);
  const [batchFlowLoading, setBatchFlowLoading] = useState(false);
  const [batchFlowError, setBatchFlowError] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);

  useEffect(() => { load(); }, []);

  useEffect(() => {
    const params = new URLSearchParams(searchParams);
    if (statusFilter === 'all') {
      params.delete('status');
    } else {
      params.set('status', statusFilter);
    }
    router.replace(`${pathname}?${params.toString()}`);
  }, [statusFilter]);

  useEffect(() => {
    if (!selectedBatch) {
      setBatchFlow(null);
      setActiveStageCode(null);
      setActiveNastilId(null);
      setBatchFlowError('');
      return;
    }

    loadBatchFlow(selectedBatch.id);
  }, [selectedBatch]);

  useEffect(() => {
    if (!activeNastilId || !batchFlow) {
      setNastilEmbroidery({ type: '', color: '' });
      setEmbroideryDirty(false);
      return;
    }
    const stage = batchFlow.stages.find((s) => s.code === 'cutting');
    const nastil = getNastilEntries(stage?.entries || []).find((e) => e.id === activeNastilId);
    setNastilEmbroidery({
      type: nastil?.data?.embroidery_type || selectedBatch?.embroidery_type || '',
      color: nastil?.data?.embroidery_color || selectedBatch?.embroidery_color || '',
    });
    setEmbroideryDirty(false);
  }, [activeNastilId]);

  function handleEmbroideryChange(field: 'type' | 'color', value: string) {
    setNastilEmbroidery((prev) => ({ ...prev, [field]: value }));
    setEmbroideryDirty(true);
  }

  async function handleEmbroiderySave(entryId: number) {
    setEmbroideryPending(true);
    try {
      await fetch(`/api/entries/${entryId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: { embroidery_type: nastilEmbroidery.type, embroidery_color: nastilEmbroidery.color } }),
      });
      setEmbroideryDirty(false);
      if (selectedBatch) {
        const res = await fetch(`/api/batches/${selectedBatch.id}/stages`);
        if (res.ok) setBatchFlow(await res.json());
      }
    } finally {
      setEmbroideryPending(false);
    }
  }

  async function handleSendToEmbroidery(entryId: number) {
    setEmbroideryPending(true);
    try {
      await fetch(`/api/entries/${entryId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: { embroidery_type: nastilEmbroidery.type, embroidery_color: nastilEmbroidery.color } }),
      });
      await fetch(`/api/nastils/${entryId}/send-to-embroidery`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ batch_id: selectedBatch?.id }),
      });
      setEmbroideryDirty(false);
      if (selectedBatch) {
        const res = await fetch(`/api/batches/${selectedBatch.id}/stages`);
        if (res.ok) setBatchFlow(await res.json());
      }
    } finally {
      setEmbroideryPending(false);
    }
  }

  async function load() {
    setLoading(true);
    try {
      const [bRes, mRes, eRes] = await Promise.all([
        fetch('/api/batches'),
        fetch('/api/product-models'),
        fetch('/api/employees?active=true'),
      ]);
      const bData = await bRes.json();
      setBatches(Array.isArray(bData) ? bData : []);
      if (mRes.ok) setModels(await mRes.json());
      if (eRes.ok) setEmployees(await eRes.json());
    } catch (e) {
      console.error('Failed to load data', e);
    } finally { setLoading(false); }
  }

  async function loadBatchFlow(batchId: number) {
    setBatchFlowLoading(true);
    setBatchFlowError('');
    try {
      const res = await fetch(`/api/batches/${batchId}/stages`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || 'Не вдалося завантажити етапи партії');
      }
      setBatchFlow(data);
      setActiveStageCode(null);
      setActiveNastilId(null);
    } catch (err) {
      setBatchFlow(null);
      setActiveStageCode(null);
      setActiveNastilId(null);
      setBatchFlowError(err instanceof Error ? err.message : 'Не вдалося завантажити етапи партії');
    } finally {
      setBatchFlowLoading(false);
    }
  }

  async function handleSave() {
    setSaving(true); setError('');
    try {
      const url = editingId ? `/api/batches/${editingId}` : '/api/batches';
      const method = editingId ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          quantity: parseInt(form.quantity) || 0,
          product_model_id: form.product_model_id ? parseInt(form.product_model_id) : null,
          sku: form.sku || null,
          supervisor_id: form.supervisor_id ? parseInt(form.supervisor_id) : null,
          nastyl_number: form.nastyl_number ? parseInt(form.nastyl_number) : null,
          planned_start_date: form.planned_start_date || null,
          planned_end_date: form.planned_end_date || null,
        }),
      });

      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Помилка збереження'); return; }
      setShowAddModal(false); setForm(EMPTY_FORM); setEditingId(null); setSearchModel(''); load();
    } catch (e) {
      setError('Помилка з\'єднання з сервером');
    } finally { setSaving(false); }
  }

  function handleEditBatch(batch: Batch) {
    setEditingId(batch.id);
    setForm({
      batch_number: batch.batch_number || '',
      sku: batch.sku || '',
      product_model_id: batch.product_model_id?.toString() || '',
      quantity: batch.quantity.toString(),
      status: batch.status,
      priority: batch.priority,
      fabric_type: batch.fabric_type || '',
      fabric_color: batch.fabric_color || '',
      thread_number: batch.thread_number || '',
      embroidery_type: batch.embroidery_type || '',
      embroidery_color: batch.embroidery_color || '',
      nastyl_number: batch.nastyl_number?.toString() || '',
      supervisor_id: batch.supervisor_id?.toString() || '',
      planned_start_date: batch.planned_start_date || '',
      planned_end_date: batch.planned_end_date || '',
      is_urgent: batch.is_urgent,
      notes: batch.notes || ''
    });
    setSearchModel(batch.product_models?.name || '');
    setShowAddModal(true);
  }

  async function handleDeleteBatch(id: number) {
    if (!window.confirm('Ви впевнені, що хочете видалити цю партію?')) return;
    try {
      const res = await fetch(`/api/batches/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Помилка при видаленні');
      }
      setSelectedBatch(null);
      load();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Помилка при видаленні');
    }
  }

  const batchesArray = Array.isArray(batches) ? batches : [];
  const filtered = batchesArray.filter(b => {
    const matchSearch = b.batch_number.toLowerCase().includes(search.toLowerCase()) ||
      (b.product_models?.name || '').toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' || b.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const activeCnt = batchesArray.filter(b => ['cutting', 'embroidery', 'sewing', 'quality_control', 'packaging'].includes(b.status)).length;
  const urgentCnt = batchesArray.filter(b => b.is_urgent && !['shipped', 'cancelled'].includes(b.status)).length;
  const overdueCnt = batchesArray.filter(b => b.planned_end_date && new Date(b.planned_end_date) < new Date() && !['ready', 'shipped', 'cancelled'].includes(b.status)).length;

  return (
    <div className="space-y-8 pb-10">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-slate-100 pb-6">
        <div>
          <h1 className="text-3xl font-black tracking-tighter text-slate-900 flex items-center gap-3">
            <Package className="h-8 w-8 text-indigo-600" />
            Партії
          </h1>
          <p className="text-slate-500 text-sm font-medium mt-1">
            {batchesArray.length} в базі · <span className="text-indigo-600 font-bold">{activeCnt} зараз у виробництві</span>
          </p>
        </div>
        <button onClick={() => { setEditingId(null); setForm(EMPTY_FORM); setSearchModel(''); setShowAddModal(true); }}
          className="flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-xl text-sm font-black transition-all shadow-md active:scale-95 shadow-indigo-100">
          <Plus className="h-4 w-4" /> Створити партію
        </button>
      </div>

      {/* Stats Bento Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white border border-slate-200 p-5 rounded-3xl shadow-sm hover:border-slate-300 transition-colors group">
          <div className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-1 group-hover:text-indigo-500 transition-colors">Загальний обсяг</div>
          <div className="text-3xl font-black text-slate-900 tabular-nums">{batchesArray.reduce((s, b) => s + b.quantity, 0).toLocaleString()} <span className="text-xs font-medium text-slate-400">од.</span></div>
        </div>
        <div className="bg-white border border-slate-200 p-5 rounded-3xl shadow-sm hover:border-slate-300 transition-colors group">
          <div className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-1 group-hover:text-indigo-500 transition-colors">Поточне завантаження</div>
          <div className="text-3xl font-black text-indigo-600 tabular-nums">{activeCnt} <span className="text-xs font-medium text-slate-400 italic">активних</span></div>
        </div>
        <div className="bg-white border border-slate-200 p-5 rounded-3xl shadow-sm hover:border-slate-300 transition-colors group relative overflow-hidden">
          <div className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-1 group-hover:text-red-500 transition-colors">Прострочено</div>
          <div className={`text-3xl font-black tabular-nums transition-colors ${overdueCnt > 0 ? 'text-red-600' : 'text-slate-300'}`}>{overdueCnt}</div>
          {overdueCnt > 0 && <div className="absolute top-0 right-0 p-4 bg-red-500/5 blur-xl rounded-full translate-x-1/2 -translate-y-1/2 animate-pulse"></div>}
        </div>
      </div>

      {urgentCnt > 0 && (
        <div className="flex items-center gap-3 bg-red-500/10 border border-red-500/20 rounded-2xl p-4 text-red-500 text-sm">
          <AlertTriangle className="h-5 w-5 shrink-0" />
          <span><strong>{urgentCnt}</strong> термінових партій потребують уваги</span>
        </div>
      )}

      {/* Status Tabs Navigation */}
      <div className="flex items-center gap-1 p-1 bg-slate-50/50 border border-slate-200 rounded-2xl w-fit overflow-x-auto no-scrollbar max-w-full shadow-sm">
        <button
          onClick={() => setStatusFilter('all')}
          className={`px-5 py-2.5 rounded-xl text-xs font-black transition-all whitespace-nowrap ${
            statusFilter === 'all' 
              ? 'bg-white text-indigo-600 shadow-sm border border-slate-200' 
              : 'text-slate-500 hover:text-slate-900 hover:bg-white/40'
          }`}
        >
          Всі партії
        </button>
        {Object.entries(STATUS_MAP).map(([status, info]) => (
          <button
            key={status}
            onClick={() => setStatusFilter(status)}
            className={`px-5 py-2.5 rounded-xl text-xs font-black transition-all whitespace-nowrap flex items-center gap-2 group ${
              statusFilter === status 
                ? 'bg-white text-indigo-600 shadow-sm border border-slate-200' 
                : 'text-slate-500 hover:text-slate-900 hover:bg-white/40'
            }`}
          >
            {info.label}
            <span className={`px-2 py-0.5 rounded-lg text-[10px] font-bold tabular-nums transition-colors ${
              statusFilter === status ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-500 group-hover:bg-slate-300'
            }`}>
              {batchesArray.filter(b => b.status === status).length}
            </span>
          </button>
        ))}
      </div>

      <div className="flex gap-4 items-center">
        <div className="relative flex-1 group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
          <input type="text" placeholder="Пошук за номером партії, SKU або моделлю..." value={search} onChange={e => setSearch(e.target.value)}
            className="w-full bg-white border border-slate-200 rounded-2xl pl-11 pr-4 py-3 text-sm outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/5 shadow-sm transition-all placeholder:text-slate-400 font-medium" />
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-indigo-500" /></div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-[32px] overflow-hidden shadow-sm">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/30">
                <th className="px-6 py-4 text-left text-[10px] font-black uppercase tracking-widest text-slate-400">Партія / SKU</th>
                <th className="px-6 py-4 text-left text-[10px] font-black uppercase tracking-widest text-slate-400">Модель виробу</th>
                <th className="px-6 py-4 text-right text-[10px] font-black uppercase tracking-widest text-slate-400">Кількість</th>
                <th className="px-6 py-4 text-left text-[10px] font-black uppercase tracking-widest text-slate-400">Етап та Прогрес</th>
                <th className="px-6 py-4 text-left text-[10px] font-black uppercase tracking-widest text-slate-400">Дедлайн</th>
                <th className="px-6 py-4 text-right text-[10px] font-black uppercase tracking-widest text-slate-400">Дії</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtered.map(b => {
                const isOverdue = b.planned_end_date && new Date(b.planned_end_date) < new Date() && !['ready', 'shipped', 'cancelled'].includes(b.status);
                const statusInfo = STATUS_MAP[b.status] || STATUS_MAP.created;
                
                const steps = ['created', 'cutting', 'sewing', 'ready'];
                const currentStepIdx = steps.indexOf(b.status);
                
                return (
                  <tr key={b.id} 
                    onClick={() => setSelectedBatch(b)}
                    className="hover:bg-slate-50/80 transition-all cursor-pointer group">
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-3">
                        <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 border border-slate-100 shadow-sm bg-white`}>
                          <Package className={`h-5 w-5 ${b.is_urgent ? 'text-red-500' : 'text-slate-400'}`} />
                        </div>
                        <div>
                          <div className="font-black text-slate-900 flex items-center gap-2">
                            {b.batch_number}
                            {b.is_urgent && (
                              <span className="bg-red-50 text-red-600 text-[10px] font-black px-1.5 py-0.5 rounded border border-red-100 animate-pulse">HOT</span>
                            )}
                          </div>
                          <div className="text-[10px] font-mono text-slate-400 mt-0.5 uppercase tracking-tighter">
                            {b.sku || b.product_models?.sku || 'No SKU'}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <div className="font-bold text-slate-700 max-w-[200px] truncate">{b.product_models?.name || 'Вільна партія'}</div>
                      <div className="text-[10px] text-slate-400 font-medium">MES Production Unit</div>
                    </td>
                    <td className="px-6 py-5 text-right font-black text-slate-900 tabular-nums">
                      {b.quantity.toLocaleString()} <span className="text-[10px] font-medium text-slate-400">шт</span>
                    </td>
                    <td className="px-6 py-5">
                      <div className="space-y-2 max-w-[180px]">
                        <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black border ${statusInfo.bg} ${statusInfo.color} border-current/10`}>
                          <div className={`h-1.5 w-1.5 rounded-full ${statusInfo.dot}`} />
                          {statusInfo.label}
                        </div>
                        <div className="flex gap-1.5">
                          {PRODUCTION_STEPS.map((step) => {
                            const confirmed = b.operations_progress?.[step.id] || 0;
                            const percent = Math.min(100, Math.round((confirmed / b.quantity) * 100));
                            const isCompleted = percent >= 100;
                            const isStarted = percent > 0;
                            
                            return (
                              <div key={step.id} className="relative group/step flex-1">
                                <div className={`h-2 rounded-full transition-all duration-500 ${
                                  isCompleted ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.3)]' : 
                                  isStarted ? 'bg-indigo-400 animate-pulse' : 'bg-slate-100'
                                }`} />
                                <div className="absolute -top-6 left-1/2 -translate-x-1/2 opacity-0 group-hover/step:opacity-100 transition-opacity bg-slate-900 text-white text-[9px] px-1.5 py-0.5 rounded whitespace-nowrap pointer-events-none z-20">
                                  {step.label}: {percent}%
                                </div>
                                <div className={`text-[8px] mt-1 text-center font-black ${
                                  isCompleted ? 'text-emerald-600' : isStarted ? 'text-indigo-500' : 'text-slate-300'
                                }`}>
                                  {step.short}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <div className={`flex items-center gap-2 text-xs font-bold ${isOverdue ? 'text-red-600' : 'text-slate-600'}`}>
                        <Calendar className="h-3.5 w-3.5 opacity-50" />
                        {b.planned_end_date ? new Date(b.planned_end_date).toLocaleDateString('uk-UA') : '—'}
                      </div>
                      {isOverdue && <div className="text-[10px] text-red-400 font-black uppercase mt-1">Критично!</div>}
                    </td>
                    <td className="px-6 py-5 text-right">
                      <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={(e) => { e.stopPropagation(); handleEditBatch(b); }}
                          className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"
                        >
                          <Layers className="h-4 w-4" />
                        </button>
                        {b.status === 'created' && (
                          <button
                            onClick={(e) => { e.stopPropagation(); handleDeleteBatch(b.id); }}
                            className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div className="text-center py-24 text-slate-300 bg-slate-50/30">
              <Package className="h-12 w-12 mx-auto mb-4 opacity-20" />
              <p className="font-black uppercase tracking-widest text-xs">{search ? 'Нічого не знайдено' : 'Партій ще не створено'}</p>
              <p className="text-[10px] font-medium mt-1">Спробуйте змінити фільтри або створити нову партію</p>
            </div>
          )}
        </div>
      )}

      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white border border-slate-200 rounded-[32px] p-8 w-full max-w-3xl shadow-2xl my-8 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h3 className="text-2xl font-black text-slate-900 flex items-center gap-3">
                  <div className="h-10 w-10 bg-indigo-50 rounded-xl flex items-center justify-center">
                    {editingId ? <Layers className="h-5 w-5 text-indigo-600" /> : <Plus className="h-5 w-5 text-indigo-600" />}
                  </div>
                  {editingId ? 'Редагувати партію' : 'Нова партія'}
                </h3>
                <p className="text-slate-500 text-sm font-medium mt-1">Заповніть параметри виробничого замовлення</p>
              </div>
              <button onClick={() => { setShowAddModal(false); setEditingId(null); setForm(EMPTY_FORM); setSearchModel(''); }} 
                className="h-10 w-10 flex items-center justify-center rounded-full hover:bg-slate-100 text-slate-400 transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>
            
            {error && (
              <div className="mb-6 flex items-center gap-3 text-red-600 text-sm bg-red-50 border border-red-100 px-4 py-3 rounded-2xl animate-in fade-in slide-in-from-top-2">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span className="font-bold">{error}</span>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
              <div className="md:col-span-5 space-y-5">
                <div className="bg-slate-50 px-5 py-6 rounded-3xl border border-slate-100 space-y-4">
                  <div>
                    <label className="text-[10px] text-slate-400 mb-1.5 block font-black uppercase tracking-widest">Номер партії *</label>
                    <input value={form.batch_number} onChange={e => setForm(f => ({...f, batch_number: e.target.value}))}
                      className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/5 transition-all"
                      placeholder="BP-2024-001" />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400 mb-1.5 block font-black uppercase tracking-widest">Кількість одиниць *</label>
                    <input type="number" value={form.quantity} onChange={e => setForm(f => ({...f, quantity: e.target.value}))}
                      className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-lg font-black text-indigo-600 outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/5 transition-all"
                      placeholder="0" />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400 mb-1.5 block font-black uppercase tracking-widest">Пріоритет</label>
                    <select value={form.priority} onChange={e => setForm(f => ({...f, priority: e.target.value as any}))}
                      className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold outline-none focus:border-indigo-500 transition-all appearance-none cursor-pointer">
                      <option value="low">Низький</option>
                      <option value="normal">Нормальний</option>
                      <option value="high">Високий</option>
                      <option value="urgent">Терміново 🔥</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-4 px-1">
                   <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-100 cursor-pointer hover:border-indigo-200 transition-colors group"
                        onClick={() => setForm(f => ({...f, is_urgent: !f.is_urgent}))}>
                      <div className={`h-6 w-6 rounded-md border-2 flex items-center justify-center transition-all ${
                        form.is_urgent ? 'bg-red-500 border-red-500' : 'border-slate-300 group-hover:border-indigo-400'
                      }`}>
                        {form.is_urgent && <Check className="h-4 w-4 text-white stroke-[4]" />}
                      </div>
                      <span className={`text-sm font-black transition-colors ${form.is_urgent ? 'text-red-600' : 'text-slate-600'}`}>
                        Термінова партія
                      </span>
                   </div>
                </div>
              </div>

              <div className="md:col-span-7 space-y-6">
                <div>
                  <label className="text-[10px] text-slate-400 mb-2 block font-black uppercase tracking-widest">Обрати модель виробу</label>
                  
                  {form.product_model_id ? (
                    <div className="p-4 bg-indigo-50 border-2 border-indigo-100 rounded-3xl flex items-center gap-4 animate-in zoom-in-95">
                      {(() => {
                        const m = models.find(mod => String(mod.id) === form.product_model_id);
                        return (
                          <>
                            <div className="h-16 w-16 rounded-2xl bg-white border border-indigo-100 shadow-sm overflow-hidden flex items-center justify-center shrink-0">
                              {m?.thumbnail_url ? (
                                <img src={m.thumbnail_url} alt="" className="h-full w-full object-cover" />
                              ) : (
                                <Package className="h-8 w-8 text-indigo-200" />
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="text-xs text-indigo-500 font-black uppercase tracking-widest mb-0.5">Обрано</div>
                              <div className="font-black text-slate-900 truncate leading-tight">{m?.name}</div>
                              <div className="text-[10px] font-mono text-indigo-400 mt-0.5">{m?.sku}</div>
                            </div>
                            <button 
                              type="button" 
                              onClick={() => { setForm(f => ({...f, product_model_id: ''})); setSearchModel(''); }}
                              className="h-8 w-8 flex items-center justify-center rounded-full hover:bg-white text-slate-400 hover:text-red-500 transition-all border border-transparent hover:border-red-100"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </>
                        );
                      })()}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="relative">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <input
                          type="text"
                          placeholder="Пошук моделі за назвою або артикулом..."
                          value={searchModel}
                          onChange={e => setSearchModel(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-11 pr-4 py-3 text-sm font-bold outline-none focus:border-indigo-500 transition-all"
                        />
                      </div>
                      <div className="grid grid-cols-1 gap-2 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                        {models
                          .filter(m => !searchModel || m.name.toLowerCase().includes(searchModel.toLowerCase()) || m.sku.toLowerCase().includes(searchModel.toLowerCase()))
                          .slice(0, 5)
                          .map(m => (
                            <button key={m.id} type="button" onClick={() => setForm(f => ({...f, product_model_id: String(m.id)}))}
                              className="flex items-center gap-3 p-2.5 rounded-2xl border border-slate-100 hover:border-indigo-200 hover:bg-slate-50 transition-all text-left group">
                              <div className="h-10 w-10 flex items-center justify-center bg-white rounded-xl border border-slate-100 group-hover:border-indigo-100 shadow-sm shrink-0 overflow-hidden">
                                {m.thumbnail_url ? <img src={m.thumbnail_url} alt="" className="h-full w-full object-cover" /> : <Package className="h-5 w-5 text-slate-300" />}
                              </div>
                              <div className="min-w-0">
                                <div className="text-sm font-black text-slate-700 truncate">{m.name}</div>
                                <div className="text-[10px] font-mono text-slate-400 uppercase tracking-tighter">{m.sku}</div>
                              </div>
                            </button>
                          ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] text-slate-400 mb-1.5 block font-black uppercase tracking-widest">Майстер</label>
                    <select value={form.supervisor_id} onChange={e => setForm(f => ({...f, supervisor_id: e.target.value}))}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:border-indigo-500 transition-all appearance-none cursor-pointer">
                      <option value="">— Не призначено —</option>
                      {employees.map(e => <option key={e.id} value={e.id}>{e.full_name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400 mb-1.5 block font-black uppercase tracking-widest">Дедлайн</label>
                    <input type="date" value={form.planned_end_date} onChange={e => setForm(f => ({...f, planned_end_date: e.target.value}))}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:border-indigo-500 transition-all" />
                  </div>
                </div>
              </div>
            </div>

            <div className="flex gap-4 pt-10 border-t border-slate-100 mt-8">
              <button type="button" onClick={() => setShowAddModal(false)}
                className="flex-1 bg-slate-50 hover:bg-slate-100 text-slate-600 py-4 rounded-[20px] text-sm font-black transition-all border border-slate-100 uppercase tracking-widest">
                Скасувати
              </button>
              <button type="button" onClick={handleSave} disabled={saving || !form.batch_number || !form.quantity}
                className="flex-[2] bg-indigo-600 hover:bg-slate-900 text-white disabled:opacity-50 py-4 rounded-[20px] text-sm font-black transition-all shadow-xl shadow-indigo-100 flex items-center justify-center gap-3">
                {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : (editingId ? <Check className="h-5 w-5" /> : <Plus className="h-5 w-5" />)}
                {editingId ? 'Оновити партію' : 'Запустити партію'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Batch Detail Panel */}
      {selectedBatch && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/25 backdrop-blur-[2px] px-3 py-4 sm:px-6">
           <div className="h-full w-full max-w-2xl overflow-hidden rounded-[36px] bg-white border border-slate-200 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="h-full flex flex-col">
              <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-white/80 backdrop-blur-md sticky top-0 z-10">
                <div>
                  <h2 className="text-xl font-black text-slate-900 flex items-center gap-3">
                    <Package className="h-6 w-6 text-indigo-600" />
                    Партія {selectedBatch.batch_number}
                  </h2>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`text-[10px] uppercase font-black px-2.5 py-1 rounded-full ${STATUS_MAP[selectedBatch.status]?.bg} ${STATUS_MAP[selectedBatch.status]?.color}`}>
                      {STATUS_MAP[selectedBatch.status]?.label}
                    </span>
                    {selectedBatch.is_urgent && (
                      <span className="bg-red-50 text-red-600 text-[10px] uppercase font-black px-2.5 py-1 rounded-full flex items-center gap-1 border border-red-100">
                        <AlertTriangle className="h-3 w-3" /> Терміново
                      </span>
                    )}
                  </div>
                </div>
                <button onClick={() => setSelectedBatch(null)} className="p-2.5 hover:bg-slate-100 rounded-xl transition-all text-slate-400 hover:text-slate-900 border border-transparent hover:border-slate-200">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">
                {/* Model Info */}
                <div className="bg-slate-50 border border-slate-200 rounded-[32px] p-6 flex gap-6 items-center shadow-sm relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-12 bg-indigo-500/5 blur-3xl rounded-full translate-x-1/2 -translate-y-1/2 group-hover:bg-indigo-500/10 transition-all duration-700"></div>
                  
                  <div className="h-28 w-28 rounded-2xl bg-white flex items-center justify-center border border-slate-100 shadow-md shrink-0 overflow-hidden relative z-10 transition-transform group-hover:scale-105 duration-500">
                    {selectedBatch.product_models?.thumbnail_url ? (
                      <img src={selectedBatch.product_models.thumbnail_url} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <Package className="h-12 w-12 text-slate-200" />
                    )}
                  </div>
                  
                  <div className="min-w-0 flex-1 relative z-10">
                    <div className="text-[10px] text-indigo-600 font-black uppercase tracking-widest mb-1.5 opacity-80">Модель виробу</div>
                    <div className="text-2xl font-black text-slate-900 leading-tight mb-3 truncate group-hover:text-indigo-600 transition-colors">
                      {selectedBatch.product_models?.name || 'Вільна партія'}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <div className="bg-white px-3 py-1.5 rounded-xl text-[10px] font-mono font-bold text-slate-500 border border-slate-100 uppercase tracking-tighter">
                        {selectedBatch.product_models?.sku || selectedBatch.sku || 'Без SKU'}
                      </div>
                      <div className="bg-indigo-600 px-3 py-1.5 rounded-xl text-[10px] font-black text-white shadow-lg shadow-indigo-100 transition-transform group-hover:scale-110">
                        {selectedBatch.quantity} шт.
                      </div>
                    </div>
                  </div>
                </div>

                {/* Info Grid */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-white border border-slate-100 p-5 rounded-2xl shadow-sm hover:border-indigo-100 transition-all group">
                    <div className="text-[10px] text-slate-400 font-black uppercase mb-1.5 tracking-widest group-hover:text-indigo-400 transition-colors">Майстер</div>
                    <div className="text-sm font-black text-slate-700">
                      {employees.find(e => e.id === selectedBatch.supervisor_id)?.full_name || '—'}
                    </div>
                  </div>
                  <div className="bg-white border border-slate-100 p-5 rounded-2xl shadow-sm hover:border-indigo-100 transition-all group">
                    <div className="text-[10px] text-slate-400 font-black uppercase mb-1.5 tracking-widest group-hover:text-indigo-400 transition-colors">Пріоритет</div>
                    <div className="flex items-center gap-2 text-sm font-black text-slate-700 capitalize">
                      <div className={`h-2 w-2 rounded-full ${selectedBatch.priority === 'high' ? 'bg-red-500' : selectedBatch.priority === 'urgent' ? 'bg-orange-500' : 'bg-slate-300'}`}></div>
                      {selectedBatch.priority}
                    </div>
                  </div>
                  <div className="bg-white border border-slate-100 p-5 rounded-2xl shadow-sm hover:border-indigo-100 transition-all group">
                    <div className="text-[10px] text-slate-400 font-black uppercase mb-1.5 tracking-widest group-hover:text-indigo-400 transition-colors">Тканина</div>
                    <div className="text-sm font-black text-slate-700 truncate">{selectedBatch.fabric_type || '—'}</div>
                    <div className="text-[10px] font-bold text-slate-400 mt-1">{selectedBatch.fabric_color || '—'}</div>
                  </div>
                  <div className="bg-white border border-slate-100 p-5 rounded-2xl shadow-sm hover:border-indigo-100 transition-all group">
                    <div className="text-[10px] text-slate-400 font-black uppercase mb-1.5 tracking-widest group-hover:text-indigo-400 transition-colors">Настил</div>
                    <div className="text-sm font-black text-slate-700">№ {selectedBatch.nastyl_number || '—'}</div>
                  </div>
                </div>

                {/* Size Breakdown */}
                {(batchFlowLoading || batchFlowError || batchFlow) && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between px-1">
                      <h3 className="text-xs font-black uppercase text-slate-900 tracking-widest flex items-center gap-2">
                        <Scissors className="h-4 w-4 text-emerald-500" />
                        Розкрій (Розмірна сітка)
                      </h3>
                      <div className="text-[10px] font-black text-slate-400 bg-slate-50 px-2 py-0.5 rounded-lg border border-slate-100">DETAILED VIEW</div>
                    </div>

                    {batchFlowLoading && (
                      <div className="bg-emerald-50/30 border border-emerald-100 p-6 rounded-[32px] flex items-center gap-3 text-sm font-bold text-slate-600">
                        <Loader2 className="h-4 w-4 animate-spin text-emerald-500" />
                        Завантажуємо етапи партії...
                      </div>
                    )}

                    {batchFlowError && (
                      <div className="bg-red-50 border border-red-100 p-4 rounded-2xl text-sm font-bold text-red-600">
                        {batchFlowError}
                      </div>
                    )}

                    {batchFlow && (
                      <div className="space-y-3">
                        {batchFlow.stages.map(stage => {
                          const statusLabel = stage.is_completed ? 'Завершено' : stage.is_current ? 'Поточний' : 'Очікує';
                          const stageTaskLabel = stage.task?.status || 'без завдання';
                          return (
                            <button
                              key={stage.id}
                              type="button"
                              onClick={() => {
                                setActiveStageCode(stage.code);
                                setActiveNastilId(null);
                              }}
                              className="w-full text-left bg-white border border-slate-100 p-4 rounded-[24px] transition-all shadow-sm hover:shadow-md hover:border-emerald-100 cursor-pointer"
                            >
                              <div className="flex items-start justify-between gap-4">
                                <div className="min-w-0">
                                  <div className="text-[10px] text-slate-400 font-black uppercase tracking-widest">{stage.sequence_order}</div>
                                  <div className="text-sm font-black text-slate-900">{stage.name}</div>
                                  <div className="text-[10px] font-bold text-slate-400 mt-0.5">
                                    {stage.code} · {stageTaskLabel}
                                  </div>
                                </div>
                                <div className="flex flex-col items-end gap-2 shrink-0">
                                  <span className={`text-[10px] uppercase font-black px-2.5 py-1 rounded-full ${stage.is_current ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                                    {statusLabel}
                                  </span>
                                  <span className="text-[10px] font-bold text-slate-400">
                                    {stage.entries_count} записів · {stage.quantity_total} шт
                                  </span>
                                </div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* Execution Timeline */}
                <div className="space-y-4">
                  <h3 className="text-xs font-black uppercase text-slate-900 tracking-widest px-1 flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-indigo-600" />
                    Графік виконання
                  </h3>
                  <div className="grid grid-cols-2 gap-4 bg-indigo-50/30 border border-indigo-100 p-6 rounded-[32px] relative overflow-hidden group">
                     <div className="absolute top-0 right-0 p-10 bg-indigo-500/5 blur-3xl rounded-full translate-x-1/2 -translate-y-1/2 group-hover:bg-indigo-500/10 transition-all duration-700"></div>
                     <div className="relative z-10">
                        <div className="text-[10px] text-indigo-400 font-black uppercase mb-1.5 tracking-widest">Запуск</div>
                        <div className="flex items-center gap-2.5 text-slate-900">
                          <div className="h-8 w-8 rounded-xl bg-white flex items-center justify-center border border-indigo-100 shadow-sm group-hover:scale-110 transition-transform">
                            <ArrowRight className="h-4 w-4 text-indigo-500 rotate-[-45deg]" />
                          </div>
                          <span className="font-black text-sm">{selectedBatch.planned_start_date ? new Date(selectedBatch.planned_start_date).toLocaleDateString('uk-UA', { day: 'numeric', month: 'short' }) : '—'}</span>
                        </div>
                     </div>
                     <div className="relative z-10 border-l border-indigo-100 pl-4">
                        <div className="text-[10px] text-indigo-400 font-black uppercase mb-1.5 tracking-widest">Дедлайн</div>
                        <div className="flex items-center gap-2.5 text-slate-900">
                          <div className="h-8 w-8 rounded-xl bg-white flex items-center justify-center border border-indigo-100 shadow-sm group-hover:scale-110 transition-transform">
                            <Clock className="h-4 w-4 text-indigo-500" />
                          </div>
                          <span className="font-black text-sm">{selectedBatch.planned_end_date ? new Date(selectedBatch.planned_end_date).toLocaleDateString('uk-UA', { day: 'numeric', month: 'short' }) : '—'}</span>
                        </div>
                     </div>
                  </div>
                </div>

                {/* Additional Info */}
                <div className="space-y-4">
                  <div className="bg-slate-50 border border-slate-100 p-6 rounded-[32px] group hover:border-slate-200 transition-all">
                    <div className="text-[10px] text-slate-400 font-black uppercase mb-4 tracking-widest group-hover:text-indigo-500 transition-colors">Специфікація вишивки</div>
                    <div className="grid grid-cols-2 gap-8 relative">
                      <div className="absolute inset-y-0 left-1/2 w-px bg-slate-200 hidden sm:block"></div>
                      <div>
                        <div className="text-[10px] text-slate-400 mb-1 font-bold uppercase tracking-tighter">Метод / Тип</div>
                        <div className="text-sm font-black text-slate-700">{selectedBatch.embroidery_type || 'Стандарт'}</div>
                      </div>
                      <div className="pl-4 sm:pl-0">
                        <div className="text-[10px] text-slate-400 mb-1 font-bold uppercase tracking-tighter">Колірна гама</div>
                        <div className="text-sm font-black text-slate-700">{selectedBatch.embroidery_color || 'За кроєм'}</div>
                      </div>
                    </div>
                  </div>

                  {selectedBatch.notes && (
                    <div className="bg-amber-50/50 border border-amber-100 p-6 rounded-[32px] relative overflow-hidden group">
                      <div className="absolute top-0 right-0 p-8 bg-amber-500/5 blur-2xl rounded-full translate-x-1/2 -translate-y-1/2"></div>
                      <div className="text-[10px] text-amber-600 font-black uppercase mb-2 tracking-widest flex items-center gap-2">
                        <MessageSquare className="h-3.5 w-3.5" /> Вказівки
                      </div>
                      <p className="text-sm text-amber-800 font-medium leading-relaxed italic relative z-10 transition-colors group-hover:text-slate-900">
                        "{selectedBatch.notes}"
                      </p>
                    </div>
                  )}
                </div>
              </div>

              <div className="p-6 border-t border-slate-100 bg-white/80 backdrop-blur-md flex gap-4 sticky bottom-0 z-10">
                <button 
                  onClick={() => handleEditBatch(selectedBatch)}
                  className="flex-1 bg-white hover:bg-slate-50 text-slate-900 py-4 rounded-[20px] text-sm font-black transition-all border border-slate-200 shadow-sm active:scale-95 flex items-center justify-center gap-2">
                  <Edit3 className="h-4 w-4 text-indigo-500" /> Редагувати
                </button>
                <button 
                  onClick={() => handleDeleteBatch(selectedBatch.id)}
                  className="bg-red-50 hover:bg-red-100 text-red-600 px-8 py-4 rounded-[20px] text-sm font-black transition-all border border-red-100 shadow-sm active:scale-95 flex items-center justify-center gap-2">
                  <Trash2 className="h-4 w-4" /> Видалити
                </button>
              </div>
            </div>
           </div>
        </div>
      )}

      {selectedBatch && batchFlow && activeStageCode && (() => {
        const activeStage = batchFlow.stages.find(stage => stage.code === activeStageCode) || batchFlow.current_stage || batchFlow.stages[0] || null;
        if (!activeStage) return null;

        const entries = activeStage.entries || [];
        const nastilEntries = activeStage.code === 'cutting' ? getNastilEntries(entries) : [];
        const stageEntries = activeStage.code === 'cutting'
          ? entries.filter((entry) => entry.operation_code !== 'nastil')
          : entries;

        return (
          <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/35 backdrop-blur-sm px-3 py-4 sm:px-6">
            <div className="h-full w-full max-w-2xl overflow-hidden rounded-[36px] bg-white border border-slate-200 shadow-2xl animate-in zoom-in-95 duration-200">
              <div className="h-full flex flex-col">
                <div className="p-6 border-b border-slate-100 flex items-start justify-between bg-white/90 backdrop-blur-md sticky top-0 z-10">
                  <div>
                    <div className="text-[10px] text-emerald-600 font-black uppercase tracking-widest">Етап партії</div>
                    <h2 className="text-xl font-black text-slate-900 flex items-center gap-3 mt-1">
                      <Scissors className="h-5 w-5 text-emerald-500" />
                      {activeStage.name}
                    </h2>
                    <div className="text-[10px] font-bold text-slate-500 mt-1">
                      {activeStage.code} · {activeStage.entries_count} записів · {activeStage.quantity_total} шт
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveStageCode(null);
                      setActiveNastilId(null);
                    }}
                    className="p-2.5 hover:bg-slate-100 rounded-xl transition-all text-slate-400 hover:text-slate-900 border border-transparent hover:border-slate-200"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
                  {activeStage.code === 'cutting' ? (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between px-1">
                        <h3 className="text-xs font-black uppercase text-slate-900 tracking-widest flex items-center gap-2">
                          <Scissors className="h-4 w-4 text-emerald-500" />
                          Настили
                        </h3>
                        <div className="text-[10px] font-black text-slate-400 bg-slate-50 px-2 py-0.5 rounded-lg border border-slate-100">
                          {nastilEntries.length} записів
                        </div>
                      </div>

                      {nastilEntries.length > 0 ? (
                        <div className="space-y-3">
                          {nastilEntries
                            .slice()
                            .sort((a, b) => Number(a.data?.nastil_number || a.entry_number || 0) - Number(b.data?.nastil_number || b.entry_number || 0))
                            .map((entry) => {
                              const nastilNumber = entry.data?.nastil_number ?? entry.entry_number ?? '—';
                              const quantityPerNastil = entry.data?.quantity_per_nastil ?? entry.quantity ?? '—';
                              const color = entry.data?.fabric_color || '—';
                              const details = [
                                entry.data?.reel_width_cm ? `${entry.data.reel_width_cm} см` : null,
                                entry.data?.reel_length_m ? `${entry.data.reel_length_m} м` : null,
                                entry.data?.weight_kg ? `${entry.data.weight_kg} кг` : null,
                                entry.data?.remainder_kg ? `залишок ${entry.data.remainder_kg} кг` : null,
                              ].filter(Boolean);

                              return (
                                <button
                                  key={entry.id}
                                  type="button"
                                  onClick={() => setActiveNastilId(entry.id)}
                                  className="w-full text-left bg-white/90 border border-emerald-100 rounded-2xl p-4 shadow-sm hover:border-emerald-300 hover:shadow-md transition-all cursor-pointer"
                                >
                                  <div className="flex items-start justify-between gap-4">
                                    <div>
                                      <div className="text-[10px] font-black uppercase tracking-widest text-emerald-600">Настил №{nastilNumber}</div>
                                      <div className="text-sm font-black text-slate-900">{color}</div>
                                      <div className="text-[10px] font-bold text-slate-400 mt-0.5">{new Date(entry.recorded_at).toLocaleString('uk-UA')}</div>
                                    </div>
                                    <div className="text-right">
                                      <div className="text-xs font-black text-slate-900 tabular-nums">{quantityPerNastil} <span className="text-[10px] font-bold text-slate-400">шт</span></div>
                                    </div>
                                  </div>

                                  {details.length > 0 && (
                                    <div className="mt-3 flex flex-wrap gap-2">
                                      {details.map((detail) => (
                                        <span key={detail} className="text-[11px] text-slate-600 font-medium bg-slate-50 border border-slate-100 px-2.5 py-1 rounded-lg">
                                          {detail}
                                        </span>
                                      ))}
                                    </div>
                                  )}

                                  {entry.notes && (
                                    <div className="mt-3 text-[11px] text-slate-500 italic">{entry.notes}</div>
                                  )}
                                </button>
                              );
                            })}
                        </div>
                      ) : (
                        <div className="bg-emerald-50/30 border border-emerald-100 p-6 rounded-[32px] text-sm font-medium text-slate-500">
                          У цьому розкрої ще немає настилів.
                        </div>
                      )}

                      {stageEntries.length > 0 && (
                        <div className="space-y-3 pt-2">
                          <div className="flex items-center justify-between px-1">
                            <h3 className="text-xs font-black uppercase text-slate-900 tracking-widest flex items-center gap-2">
                              <Layers className="h-4 w-4 text-indigo-500" />
                              Інші записи етапу
                            </h3>
                            <div className="text-[10px] font-black text-slate-400 bg-slate-50 px-2 py-0.5 rounded-lg border border-slate-100">
                              {stageEntries.length} записів
                            </div>
                          </div>
                          <div className="space-y-3">
                            {stageEntries.map((entry) => (
                              <div key={entry.id} className="bg-slate-50/70 border border-slate-100 rounded-2xl p-4">
                                <div className="flex items-start justify-between gap-4">
                                  <div>
                                    <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                                      {entry.operation_name || entry.operation_code || 'Запис'}
                                    </div>
                                    <div className="text-sm font-black text-slate-900 tabular-nums">{entry.quantity ?? '—'} <span className="text-[10px] font-bold text-slate-400">шт</span></div>
                                  </div>
                                  <div className="text-[10px] font-bold text-slate-400">
                                    {new Date(entry.recorded_at).toLocaleString('uk-UA')}
                                  </div>
                                </div>
                                {formatStageDataEntries(entry.data).length > 0 && (
                                  <div className="mt-3 flex flex-wrap gap-2">
                                    {formatStageDataEntries(entry.data).map((item) => (
                                      <span key={item} className="text-[11px] text-slate-600 font-medium bg-white border border-slate-100 px-2.5 py-1 rounded-lg">
                                        {item}
                                      </span>
                                    ))}
                                  </div>
                                )}
                                {entry.notes && (
                                  <div className="mt-3 text-[11px] text-slate-500 italic">{entry.notes}</div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : stageEntries.length > 0 ? (
                    <div className="space-y-3">
                      {stageEntries.map((entry) => (
                        <div key={entry.id} className="bg-slate-50 border border-slate-100 rounded-[28px] p-5">
                          <div className="flex items-start justify-between gap-4">
                            <div>
                              <div className="text-[10px] text-slate-400 font-black uppercase tracking-widest">
                                {entry.operation_name || entry.operation_code || 'Запис'}
                              </div>
                              <div className="text-sm font-black text-slate-900 mt-1">
                                {entry.quantity ?? '—'} <span className="text-[10px] font-bold text-slate-400">шт</span>
                              </div>
                            </div>
                            <div className="text-[10px] font-bold text-slate-400">
                              {new Date(entry.recorded_at).toLocaleString('uk-UA')}
                            </div>
                          </div>
                          {formatStageDataEntries(entry.data).length > 0 && (
                            <div className="mt-3 flex flex-wrap gap-2">
                              {formatStageDataEntries(entry.data).map((item) => (
                                <span key={item} className="text-[11px] text-slate-600 font-medium bg-white border border-slate-100 px-2.5 py-1 rounded-lg">
                                  {item}
                                </span>
                              ))}
                            </div>
                          )}
                          {entry.notes && (
                            <div className="mt-3 text-[11px] text-slate-500 italic">{entry.notes}</div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="bg-slate-50 border border-slate-100 p-6 rounded-[32px] text-sm text-slate-600">
                      Для цього етапу записів ще немає.
                    </div>
                  )}
                </div>

                <div className="p-6 border-t border-slate-100 bg-white/90 backdrop-blur-md flex gap-4 sticky bottom-0 z-10">
                  <button
                    type="button"
                    onClick={() => {
                      setActiveStageCode(null);
                      setActiveNastilId(null);
                    }}
                    className="flex-1 bg-white hover:bg-slate-50 text-slate-900 py-4 rounded-[20px] text-sm font-black transition-all border border-slate-200 shadow-sm active:scale-95 flex items-center justify-center gap-2"
                  >
                    <ArrowRight className="h-4 w-4 text-indigo-500 rotate-180" />
                    Назад до етапів
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {selectedBatch && batchFlow && activeStageCode === 'cutting' && activeNastilId && (() => {
        const activeStage = batchFlow.stages.find(stage => stage.code === 'cutting') || batchFlow.current_stage || batchFlow.stages[0] || null;
        if (!activeStage) return null;
        const activeNastil = getNastilEntries(activeStage.entries || []).find((entry) => entry.id === activeNastilId) || null;
        if (!activeNastil) return null;
        const sizeLabels = getBatchSizeLabels(selectedBatch, batchFlow.batch);
        const sizeEntries = sizeLabels.length > 0
          ? sizeLabels.map((size) => [size, activeNastil.data?.quantity_per_nastil ?? activeNastil.quantity ?? 0] as const)
          : getSizeVariantEntries(selectedBatch.size_variants);
        const quantityPerSize = Number(activeNastil.data?.quantity_per_nastil ?? activeNastil.quantity ?? 0);
        const totalPerNastil = sizeEntries.length > 0 && Number.isFinite(quantityPerSize) ? quantityPerSize * sizeEntries.length : quantityPerSize;

        const nastilDetails = [
          activeNastil.data?.reel_width_cm ? `${activeNastil.data.reel_width_cm} см` : null,
          activeNastil.data?.reel_length_m ? `${activeNastil.data.reel_length_m} м` : null,
          activeNastil.data?.weight_kg ? `${activeNastil.data.weight_kg} кг` : null,
          activeNastil.data?.remainder_kg ? `залишок ${activeNastil.data.remainder_kg} кг` : null,
        ].filter(Boolean);

        return (
          <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/45 backdrop-blur-sm px-3 py-4 sm:px-6">
            <div className="w-full max-w-xl overflow-hidden rounded-[36px] bg-white border border-slate-200 shadow-2xl animate-in zoom-in-95 duration-200">
              <div className="p-6 border-b border-slate-100 flex items-start justify-between bg-white/90 backdrop-blur-md">
                <div>
                  <div className="text-[10px] text-emerald-600 font-black uppercase tracking-widest">Настил</div>
                  <h2 className="text-xl font-black text-slate-900 flex items-center gap-3 mt-1">
                    <Scissors className="h-5 w-5 text-emerald-500" />
                    №{activeNastil.data?.nastil_number ?? activeNastil.entry_number ?? '—'}
                  </h2>
                  <div className="text-[10px] font-bold text-slate-500 mt-1">
                    {activeNastil.data?.fabric_color || '—'} · {activeNastil.data?.quantity_per_nastil ?? activeNastil.quantity ?? '—'} шт
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveNastilId(null)}
                  className="p-2.5 hover:bg-slate-100 rounded-xl transition-all text-slate-400 hover:text-slate-900 border border-transparent hover:border-slate-200"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="p-6 space-y-4 overflow-y-auto max-h-[calc(90vh-120px)]">
                {/* Batch info */}
                <div className="bg-slate-50 border border-slate-100 rounded-[24px] p-4">
                  <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                    <div>
                      <div className="text-[9px] text-slate-400 font-black uppercase tracking-widest mb-0.5">Модель</div>
                      <div className="text-sm font-black text-slate-900 truncate">{selectedBatch?.product_models?.name || '—'}</div>
                    </div>
                    <div>
                      <div className="text-[9px] text-slate-400 font-black uppercase tracking-widest mb-0.5">Замовлення №</div>
                      <div className="text-sm font-black text-slate-900">{selectedBatch?.source_order || selectedBatch?.nastyl_number || '—'}</div>
                    </div>
                    <div className="col-span-2">
                      <div className="text-[9px] text-slate-400 font-black uppercase tracking-widest mb-0.5">Тканина</div>
                      <div className="text-sm font-semibold text-slate-700">
                        {[selectedBatch?.fabric_type, selectedBatch?.fabric_color].filter(Boolean).join(' · ') || '—'}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Nastil fields */}
                <div className="bg-emerald-50/30 border border-emerald-100 rounded-[28px] p-5">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-1">Колір тканини</div>
                      <div className="text-sm font-black text-slate-900">{activeNastil.data?.fabric_color || '—'}</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-1">Настил №</div>
                      <div className="text-sm font-black text-slate-900">{activeNastil.data?.nastil_number ?? activeNastil.entry_number ?? '—'}</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-1">Кількість</div>
                      <div className="text-sm font-black text-slate-900">{activeNastil.data?.quantity_per_nastil ?? activeNastil.quantity ?? '—'} шт</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-1">Час</div>
                      <div className="text-sm font-black text-slate-900">{new Date(activeNastil.recorded_at).toLocaleString('uk-UA')}</div>
                    </div>
                  </div>
                </div>

                <div className="bg-white border border-emerald-100 rounded-[30px] p-5 shadow-sm">
                  <div className="flex items-center justify-between gap-3 mb-4">
                    <div>
                      <div className="text-[10px] text-emerald-600 font-black uppercase tracking-widest mb-1">Розмірна сітка замовлення</div>
                      <div className="text-sm font-black text-slate-900">К-сть на кожен розмір</div>
                    </div>
                    <div className="text-[10px] font-black text-slate-400 bg-slate-50 px-2 py-0.5 rounded-lg border border-slate-100">
                      {sizeEntries.length || 0} розмірів
                    </div>
                  </div>

                  {sizeEntries.length > 0 ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {sizeEntries.map(([size, sizeQuantity]) => (
                        <div key={size} className="rounded-2xl border border-slate-100 bg-slate-50/80 p-4">
                          <div className="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-1">{size}</div>
                          <div className="text-lg font-black text-slate-900 tabular-nums">
                            {Number.isFinite(Number(sizeQuantity)) && Number(sizeQuantity) > 0 ? Number(sizeQuantity) : '—'}
                            {Number.isFinite(Number(sizeQuantity)) && Number(sizeQuantity) > 0 ? <span className="text-[10px] font-bold text-slate-400 ml-1">шт</span> : null}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 text-sm text-slate-500">
                      Розмірна сітка не вказана в замовленні.
                    </div>
                  )}

                  <div className="mt-4 flex items-center justify-between text-sm font-bold text-slate-700">
                    <span>Всього по настилу</span>
                    <span className="text-slate-900 tabular-nums">
                      {Number.isFinite(totalPerNastil) && totalPerNastil > 0 ? totalPerNastil : '—'} <span className="text-[10px] font-bold text-slate-400">шт</span>
                    </span>
                  </div>
                </div>

                {nastilDetails.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {nastilDetails.map((detail) => (
                      <span key={detail} className="text-[11px] text-slate-600 font-medium bg-slate-50 border border-slate-100 px-2.5 py-1 rounded-lg">
                        {detail}
                      </span>
                    ))}
                  </div>
                )}

                {activeNastil.notes && (
                  <div className="bg-amber-50/60 border border-amber-100 rounded-[28px] p-5 text-sm text-amber-800">
                    {activeNastil.notes}
                  </div>
                )}

                {/* Embroidery */}
                <div className="border border-indigo-100 rounded-[24px] p-4 space-y-3 bg-indigo-50/20">
                  <div className="flex items-center justify-between">
                    <div className="text-[10px] text-indigo-600 font-black uppercase tracking-widest">Вишивка</div>
                    {activeNastil.data?.embroidery_sent ? (
                      <div className="text-[9px] text-emerald-600 font-black bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-lg">Передано ✓</div>
                    ) : embroideryPending ? (
                      <div className="text-[9px] text-slate-400 font-semibold">Збереження...</div>
                    ) : null}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <div className="text-[9px] text-slate-400 font-black uppercase tracking-widest mb-1.5">Тип вишивки</div>
                      <select
                        value={nastilEmbroidery.type}
                        onChange={(e) => handleEmbroideryChange('type', e.target.value)}
                        disabled={!!activeNastil.data?.embroidery_sent}
                        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-semibold text-slate-900 outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-100 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                      >
                        {EMBROIDERY_TYPES.map((opt) => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <div className="text-[9px] text-slate-400 font-black uppercase tracking-widest mb-1.5">Колір вишивки</div>
                      <select
                        value={nastilEmbroidery.color}
                        onChange={(e) => handleEmbroideryChange('color', e.target.value)}
                        disabled={nastilEmbroidery.type === 'немає' || nastilEmbroidery.type === '' || !!activeNastil.data?.embroidery_sent}
                        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-semibold text-slate-900 outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        {EMBROIDERY_COLORS.map((opt) => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  {!activeNastil.data?.embroidery_sent && (
                    <div className="flex gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => handleEmbroiderySave(activeNastil.id)}
                        disabled={embroideryPending || !embroideryDirty}
                        className="flex-1 bg-white hover:bg-slate-50 text-slate-700 py-2.5 rounded-[14px] text-xs font-black transition-all border border-slate-200 disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        Зберегти зміни
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSendToEmbroidery(activeNastil.id)}
                        disabled={embroideryPending || !nastilEmbroidery.type || nastilEmbroidery.type === 'немає'}
                        className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white py-2.5 rounded-[14px] text-xs font-black transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        Передати на вишивальний
                      </button>
                    </div>
                  )}
                </div>

                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => setActiveNastilId(null)}
                    className="w-full bg-white hover:bg-slate-50 text-slate-900 py-4 rounded-[20px] text-sm font-black transition-all border border-slate-200 shadow-sm active:scale-95 flex items-center justify-center gap-2"
                  >
                    <ArrowRight className="h-4 w-4 text-indigo-500 rotate-180" />
                    Назад до розкрою
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

    </div>
  );
}

export default function BatchesPage() {
  return (
    <Suspense fallback={<div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-indigo-500" /></div>}>
      <BatchesContent />
    </Suspense>
  );
}
