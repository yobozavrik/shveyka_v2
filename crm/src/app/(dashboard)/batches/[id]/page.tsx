'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Play, CheckCircle, Loader2, Package, Scissors, Shirt, AlertTriangle } from 'lucide-react';

type BatchDetail = {
  id: number;
  batch_number: string;
  status: string;
  quantity: number;
  is_urgent: boolean;
  fabric_type: string | null;
  fabric_color: string | null;
  notes: string | null;
  size_variants: Record<string, any> | null;
  product_models: { id: number; name: string; sku: string | null } | null;
  production_orders: { id: number; order_number: string; customer_name: string | null } | null;
};

type TaskEntry = {
  id: number;
  quantity: number;
  status: string;
  recorded_at: string;
  data: Record<string, any>;
  employees: { id: number; full_name: string; position: string } | null;
  stage_operations: { id: number; code: string; name: string } | null;
};

type BatchTask = {
  id: number;
  status: string;
  assigned_role: string;
  accepted_by_employee_id: number | null;
  completed_at: string | null;
};

const STAGE_CONFIG: Record<string, { label: string; icon: any; color: string; nextStage: string }> = {
  cutting: { label: 'Розкрій', icon: Scissors, color: 'text-orange-500', nextStage: 'sewing' },
  sewing: { label: 'Пошив', icon: Shirt, color: 'text-blue-500', nextStage: 'overlock' },
  overlock: { label: 'Оверлок', icon: Shirt, color: 'text-purple-500', nextStage: 'straight_stitch' },
  straight_stitch: { label: 'Прямострочка', icon: Shirt, color: 'text-indigo-500', nextStage: 'coverlock' },
  coverlock: { label: 'Розпошив', icon: Shirt, color: 'text-teal-500', nextStage: 'packaging' },
  packaging: { label: 'Упаковка', icon: Package, color: 'text-emerald-500', nextStage: 'ready' },
};

export default function BatchDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const router = useRouter();

  const [batch, setBatch] = useState<BatchDetail | null>(null);
  const [entries, setEntries] = useState<TaskEntry[]>([]);
  const [tasks, setTasks] = useState<BatchTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferFields, setTransferFields] = useState({
    thread_color: '',
    embroidery_type: '',
    embroidery_color: '',
    notes: '',
    rate: '',
  });
  const [transferring, setTransferring] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [batchRes, entriesRes, tasksRes] = await Promise.all([
        fetch(`/api/batches/${id}`),
        fetch(`/api/batches/${id}/entries`),
        fetch(`/api/batches/${id}/tasks`),
      ]);

      if (!batchRes.ok) throw new Error('Не вдалося завантажити партію');
      setBatch(await batchRes.json());
      setEntries(entriesRes.ok ? await entriesRes.json() : []);
      setTasks(tasksRes.ok ? await tasksRes.json() : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Помилка завантаження');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  // Определяем текущий активный этап
  const currentStageCode = batch ? getStageFromStatus(batch.status) : null;
  const currentStage = currentStageCode ? STAGE_CONFIG[currentStageCode] : null;
  const isStageComplete = tasks.some(t => t.status === 'completed');

  // Обработка кнопки "Передати на наступний етап"
  const handleTransfer = async () => {
    if (!batch || !currentStage) return;
    setTransferring(true);
    setError('');

    try {
      const res = await fetch(`/api/batches/${id}/transfer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          next_stage: currentStage.nextStage,
          next_role: currentStage.nextStage === 'ready' ? '' : currentStage.nextStage,
          ...transferFields,
          rate: transferFields.rate ? Number(transferFields.rate) : undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Не вдалося передати партію');

      setShowTransferModal(false);
      setTransferFields({ thread_color: '', embroidery_type: '', embroidery_color: '', notes: '', rate: '' });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Помилка передачі');
    } finally {
      setTransferring(false);
    }
  };

  if (loading) return <div className="p-6 flex justify-center"><Loader2 className="h-8 w-8 animate-spin text-blue-600" /></div>;
  if (!batch) return <div className="p-6 text-center text-gray-500">Партію не знайдено</div>;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button onClick={() => router.back()} className="p-2 hover:bg-gray-100 rounded-lg"><ArrowLeft size={20} /></button>
        <div>
          <h1 className="text-2xl font-bold">Партія {batch.batch_number}</h1>
          <p className="text-sm text-gray-500">
            {batch.product_models?.name} {batch.production_orders?.order_number ? `· Замовлення ${batch.production_orders.order_number}` : ''}
          </p>
        </div>
        <div className="ml-auto">
          <span className={`px-3 py-1 rounded-full text-sm font-semibold ${getStatusColor(batch.status)}`}>
            {getStatusLabel(batch.status)}
          </span>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-600">
          <AlertTriangle size={16} /> {error}
        </div>
      )}

      {/* Info Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="text-xs text-gray-400 uppercase font-bold mb-1">Кількість</div>
          <div className="text-xl font-bold">{batch.quantity} шт</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="text-xs text-gray-400 uppercase font-bold mb-1">Тканина</div>
          <div className="text-lg font-semibold">{batch.fabric_type || '—'} {batch.fabric_color ? `· ${batch.fabric_color}` : ''}</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="text-xs text-gray-400 uppercase font-bold mb-1">Поточний етап</div>
          <div className={`text-lg font-semibold ${currentStage?.color || 'text-gray-500'}`}>
            {currentStage ? currentStage.label : '—'}
          </div>
        </div>
      </div>

      {/* Выполненные записи */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100">
          <h3 className="font-bold text-sm">Виконані записи ({entries.length})</h3>
        </div>
        {entries.length === 0 ? (
          <div className="p-8 text-center text-gray-400 text-sm">Записів поки немає</div>
        ) : (
          <div className="divide-y divide-gray-100">
            {entries.map(entry => (
              <div key={entry.id} className="px-5 py-3 flex items-center justify-between">
                <div>
                  <div className="font-medium text-sm">{entry.stage_operations?.name || entry.stage_operations?.code || 'Операція'}</div>
                  <div className="text-xs text-gray-400">{entry.employees?.full_name || '—'} · {new Date(entry.recorded_at).toLocaleString('uk-UA')}</div>
                  {entry.data?.size_breakdown && (
                    <div className="text-[10px] text-gray-500 font-mono mt-0.5">
                      {Object.entries(entry.data.size_breakdown).map(([s, q]) => `${s}:${q}`).join(', ')}
                    </div>
                  )}
                </div>
                <div className="text-right">
                  <div className="font-bold text-emerald-600">{entry.quantity} шт</div>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${entry.status === 'approved' ? 'bg-green-100 text-green-700' : entry.status === 'submitted' ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-600'}`}>
                    {entry.status === 'approved' ? 'Підтверджено' : entry.status === 'submitted' ? 'На перевірці' : entry.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Кнопка передачи */}
      {currentStage && isStageComplete && batch.status !== 'ready' && (
        <div className="flex justify-end">
          <button
            onClick={() => setShowTransferModal(true)}
            className="flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-blue-700 transition-colors shadow-lg shadow-blue-500/20"
          >
            <Play size={18} />
            Підтвердити та передати на {STAGE_CONFIG[currentStage.nextStage]?.label || 'наступний етап'}
          </button>
        </div>
      )}

      {/* Модалка передачи */}
      {showTransferModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 space-y-5">
            <h2 className="text-lg font-bold">Підтвердити та передати</h2>
            <p className="text-sm text-gray-500">
              Параметри для етапу: <span className="font-semibold">{currentStage?.nextStage ? STAGE_CONFIG[currentStage.nextStage]?.label : ''}</span>
            </p>

            <div className="space-y-3">
              {currentStage && (currentStage.nextStage === 'sewing' || currentStage.nextStage === 'embroidery') && (
                <>
                  <label className="block">
                    <span className="text-xs font-medium text-gray-500">Колір нитки</span>
                    <input
                      type="text"
                      value={transferFields.thread_color}
                      onChange={e => setTransferFields(f => ({ ...f, thread_color: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      placeholder="Наприклад: чорний"
                    />
                  </label>
                  <label className="block">
                    <span className="text-xs font-medium text-gray-500">Тип вишивки / узору</span>
                    <input
                      type="text"
                      value={transferFields.embroidery_type}
                      onChange={e => setTransferFields(f => ({ ...f, embroidery_type: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      placeholder="Наприклад: логотип"
                    />
                  </label>
                  <label className="block">
                    <span className="text-xs font-medium text-gray-500">Колір нитки</span>
                    <input
                      type="text"
                      value={transferFields.embroidery_color} // Используем старое поле для простоты, но подпись верная
                      onChange={e => setTransferFields(f => ({ ...f, embroidery_color: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      placeholder="Наприклад: чорний #000"
                    />
                  </label>
                </>
              )}
              <label className="block">
                <span className="text-xs font-medium text-gray-500">Примітки</span>
                <textarea
                  value={transferFields.notes}
                  onChange={e => setTransferFields(f => ({ ...f, notes: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  rows={2}
                  placeholder="Додаткові вказівки..."
                />
              </label>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowTransferModal(false)}
                className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50"
              >
                Скасувати
              </button>
              <button
                onClick={handleTransfer}
                disabled={transferring}
                className="flex-1 flex items-center justify-center gap-2 bg-emerald-600 text-white px-4 py-2.5 rounded-lg text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50"
              >
                {transferring ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle size={16} />}
                Підтвердити
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Хелперы
function getStageFromStatus(status: string): string | null {
  const map: Record<string, string> = {
    created: 'cutting',
    cutting: 'cutting',
    sewing: 'sewing',
    overlock: 'overlock',
    straight_stitch: 'straight_stitch',
    coverlock: 'coverlock',
    packaging: 'packaging',
    ready: 'packaging',
  };
  return map[status] || null;
}

function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    created: 'Створено',
    cutting: 'Розкрій',
    sewing: 'Пошив',
    overlock: 'Оверлок',
    straight_stitch: 'Прямострочка',
    coverlock: 'Розпошив',
    packaging: 'Упаковка',
    ready: 'Готово',
    shipped: 'Відправлено',
    closed: 'Закрито',
    cancelled: 'Скасовано',
  };
  return labels[status] || status;
}

function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    created: 'bg-gray-100 text-gray-700',
    cutting: 'bg-orange-100 text-orange-700',
    sewing: 'bg-blue-100 text-blue-700',
    overlock: 'bg-purple-100 text-purple-700',
    straight_stitch: 'bg-indigo-100 text-indigo-700',
    coverlock: 'bg-teal-100 text-teal-700',
    packaging: 'bg-emerald-100 text-emerald-700',
    ready: 'bg-green-100 text-green-700',
    shipped: 'bg-sky-100 text-sky-700',
    closed: 'bg-gray-200 text-gray-700',
    cancelled: 'bg-red-100 text-red-700',
  };
  return colors[status] || 'bg-gray-100 text-gray-600';
}