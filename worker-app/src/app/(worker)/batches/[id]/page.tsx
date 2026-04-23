'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft, Loader2, AlertTriangle, Lock, CheckCircle2,
  ChevronRight, Play, Tag, ShieldCheck
} from 'lucide-react';
import { clsx } from 'clsx';
import { extractSelectedSizes } from '@/lib/sizeVariants';

interface SizeQty { size: string; confirmed_qty: number; submitted_qty: number }
interface PipelineOp {
  id: number;
  rco_id: number;
  sequence_number: number;
  name: string;
  code: string;
  operation_type: string;
  base_rate: number;
  custom_rate: number | null;
  is_control_point: boolean;
  status: 'locked' | 'available' | 'in_progress' | 'completed';
  total_confirmed: number;
  total_submitted: number;
  sizes: SizeQty[];
}
interface BatchInfo {
  id: number;
  batch_number: string;
  status: string;
  quantity: number;
  size_variants: Record<string, number> | null;
  is_urgent: boolean;
  product_models: { name: string; sku: string } | null;
  fabric_type: string | null;
  fabric_color: string | null;
  notes: string | null;
  production_orders?: {
    id: number;
    order_number: string;
    customer_name: string | null;
    status: string;
    priority: string;
  } | null;
}

type BatchTaskRow = {
  id: number;
  batch_id: number;
  assigned_role: string;
  status: string;
  accepted_by_employee_id: number | null;
  stage?: {
    id: number;
    code: string;
    name: string;
    assigned_role: string;
  } | null;
};

// SizePicker modal
function SizePickerModal({
  sizes,
  prevSizes,
  onSelect,
  onSkip,
  onClose,
}: {
  sizes: SizeQty[];
  prevSizes: SizeQty[];
  onSelect: (size: string, max: number) => void;
  onSkip: () => void;
  onClose: () => void;
}) {
  // Available = prevOp confirmed - curOp (confirmed+submitted) per size
  const available = prevSizes.map((ps) => {
    const cur = sizes.find((s) => s.size === ps.size);
    const used = (cur?.confirmed_qty || 0) + (cur?.submitted_qty || 0);
    return { size: ps.size, max: ps.confirmed_qty - used };
  }).filter((s) => s.max > 0);

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-[var(--bg-card)] border-t border-[var(--border)] rounded-t-3xl p-5 pb-8 space-y-4 max-h-[80vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-10 h-1.5 bg-[var(--bg-card2)] rounded-full mx-auto mb-2" />
        <h3 className="text-lg font-black text-center mb-1">Оберіть розмір</h3>
        <p className="text-center text-[var(--text-2)] text-xs mb-4">Доступно для внесення</p>

        {available.length === 0 ? (
          <p className="text-center text-[var(--text-3)] py-4">Немає доступних розмірів</p>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {available.map(({ size, max }) => (
              <button
                key={size}
                onClick={() => onSelect(size, max)}
                className="bg-[var(--bg-card2)] active:bg-emerald-600 border-2 border-[var(--border)] active:border-emerald-500
                           rounded-2xl p-4 text-left transition-colors"
              >
                <div className="text-2xl font-black">{size}</div>
                <div className="text-sm text-[var(--text-2)] mt-1">
                  макс. <span className="text-emerald-300 font-bold">{max}</span> шт
                </div>
              </button>
            ))}
          </div>
        )}

        <button
          onClick={onSkip}
          className="w-full py-4 rounded-2xl border-2 border-[var(--border)] text-[var(--text-2)] font-semibold
                     active:bg-[var(--bg-card2)] transition-colors mt-2"
        >
          Без розміру
        </button>
      </div>
    </div>
  );
}

// RouteCardModal
function RouteCardModal({
  onSelect,
  onClose,
}: {
  onSelect: (id: number) => void;
  onClose: () => void;
}) {
  const [cards, setCards] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/mobile/route-cards')
      .then(res => res.json())
      .then(data => setCards(Array.isArray(data) ? data : []))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-[var(--bg-card)] border-t border-[var(--border)] rounded-t-3xl p-5 pb-8 space-y-4 max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-10 h-1.5 bg-[var(--bg-card2)] rounded-full mx-auto mb-2" />
        <h3 className="text-lg font-black text-center mb-1">Призначити техпроцес</h3>
        
        {loading ? (
          <div className="flex justify-center py-10"><Loader2 className="animate-spin" /></div>
        ) : (
          <div className="flex-1 overflow-y-auto space-y-2 min-h-[300px]">
            {Array.isArray(cards) && cards.map(card => (
              <button
                key={card.id}
                onClick={() => onSelect(card.id)}
                className="w-full bg-[var(--bg-card2)] border border-[var(--border)] rounded-xl p-4 text-left active:bg-emerald-600 transition-colors"
              >
                <div className="font-bold">{card.product_models?.name}</div>
                <div className="text-xs text-[var(--text-3)] mt-1">
                  Версія {card.version} · {card.description || 'Без опису'}
                </div>
              </button>
            ))}
          </div>
        )}

        <button onClick={onClose} className="w-full py-3 text-[var(--text-3)] font-bold">Скасувати</button>
      </div>
    </div>
  );
}

const OP_STATUS_CONFIG = {
  locked:      { color: 'border-[var(--border)] opacity-50',              badge: 'bg-[var(--bg-card2)] text-[var(--text-2)]',    icon: Lock,          label: 'Заблоковано' },
  available:   { color: 'border-[var(--border)] active:border-emerald-500', badge: 'bg-[var(--bg-card2)] text-[var(--text-1)]',    icon: Play,          label: 'Доступно' },
  in_progress: { color: 'border-emerald-500/60',                      badge: 'bg-emerald-500/20 text-emerald-400', icon: ChevronRight, label: 'В процесі' },
  completed:   { color: 'border-green-500/40',                        badge: 'bg-green-500/20 text-green-400',  icon: CheckCircle2, label: 'Готово' },
};

export default function BatchPipelinePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [batch, setBatch] = useState<BatchInfo | null>(null);
  const [pipeline, setPipeline] = useState<PipelineOp[]>([]);
  const [totalQty, setTotalQty] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isMaster, setIsMaster] = useState(false);
  const [showRCModal, setShowRCModal] = useState(false);
  const [sizeModal, setSizeModal] = useState<{ op: PipelineOp; prevOp: PipelineOp | null } | null>(null);
  const [freeMode, setFreeMode] = useState(false);
  const [taskRouteMap, setTaskRouteMap] = useState<Record<string, number>>({});

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [batchRes, pipeRes] = await Promise.all([
        fetch(`/api/mobile/batches/${id}`),
        fetch(`/api/mobile/batches/${id}/pipeline`),
      ]);
      if (!batchRes.ok) throw new Error('Партія не знайдена');
      setBatch(await batchRes.json());
      const pipeData = await pipeRes.json();
      setPipeline(pipeData.pipeline || []);
      setTotalQty(pipeData.total_qty || 0);
      setFreeMode(!!pipeData.free_mode);

      const tasksRes = await fetch('/api/mobile/tasks', { cache: 'no-store' });
      if (tasksRes.ok) {
        const tasksJson = await tasksRes.json();
        const rows = Array.isArray(tasksJson) ? (tasksJson as BatchTaskRow[]) : [];
        const map: Record<string, number> = {};

        rows
          .filter((task) => Number(task.batch_id) === Number(id))
          .forEach((task) => {
            const stageCode = String(task.stage?.code || task.assigned_role || '').trim().toLowerCase();
            if (stageCode && !map[stageCode]) {
              map[stageCode] = task.id;
            }
          });

        setTaskRouteMap(map);
      } else {
        setTaskRouteMap({});
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadData();
    fetch('/api/mobile/auth/me', { cache: 'no-store' })
      .then(res => res.json())
      .then(data => {
        const role = (data.role || '').toLowerCase();
        const pos = (data.employee?.position || '').toLowerCase().trim();
        const name = (data.employee?.full_name || '').toLowerCase();
        
        const privileged = ['master', 'supervisor', 'admin'].includes(role) || 
                          ['майстер', 'мастер', 'адміністратор', 'администратор', 'бригадир'].includes(pos);
                          
        setIsMaster(privileged);
      })
      .catch(err => console.error('Auth check error:', err));
  }, [loadData]);

  const handleOperationPress = async (op: PipelineOp, _index: number) => {
    if (op.status === 'locked') return;

    const stageCode = String(op.operation_type || op.code || '').trim().toLowerCase();
    const taskId = stageCode ? taskRouteMap[stageCode] : null;

    if (taskId) {
      router.push(`/tasks/${taskId}`);
      return;
    }

    // Если задачи нет — создаём её автоматически
    try {
      const res = await fetch('/api/mobile/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          batch_id: parseInt(id),
          stage_code: stageCode,
          operation_id: op.id,
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Не удалось создать задачу');
      }

      const data = await res.json();
      router.push(`/tasks/${data.task.id}`);
    } catch (err) {
      console.error('Task creation error:', err);
      alert('Ошибка: не удалось создать задачу для этого этапа');
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen">
      <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
    </div>
  );

  if (error) return (
    <div className="p-6 text-center">
      <AlertTriangle className="w-10 h-10 text-red-400 mx-auto mb-3" />
      <p className="text-red-400 font-semibold">{error}</p>
      <button onClick={() => router.back()} className="mt-4 text-emerald-400 font-bold">← Назад</button>
    </div>
  );

  return (
    <>
      <div className="px-4 py-4">
        {/* Back + title */}
        <button onClick={() => router.back()} className="flex items-center gap-2 text-[var(--text-2)] mb-4">
          <ArrowLeft className="w-5 h-5" />
          <span className="text-sm font-medium">Партії</span>
        </button>

        {/* Batch info */}
        {batch && (
          <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-4 mb-5">
            <div className="flex items-start gap-3">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  {batch.is_urgent && (
                    <span className="text-[10px] font-black bg-red-500/20 text-red-400 px-2 py-0.5 rounded-full uppercase">
                      ТЕРМІНОВО
                    </span>
                  )}
                  <span className="text-xs text-emerald-300 font-mono font-bold">{batch.batch_number}</span>
                </div>
                <h2 className="font-black text-xl">{batch.product_models?.name}</h2>
                {batch.production_orders?.order_number && (
                  <div className="text-xs text-[var(--text-2)] mt-1">
                    Замовлення: <span className="font-semibold text-emerald-300">{batch.production_orders.order_number}</span>
                    {batch.production_orders.customer_name && (
                      <span> · {batch.production_orders.customer_name}</span>
                    )}
                  </div>
                )}
                <div className="flex flex-wrap gap-3 mt-2 text-xs text-[var(--text-2)]">
                  <span>{batch.quantity} шт</span>
                  {batch.fabric_color && <span>{batch.fabric_color}</span>}
                  {batch.fabric_type && <span>{batch.fabric_type}</span>}
                </div>
                {(() => {
                  const sizes = extractSelectedSizes(batch.size_variants);
                  return sizes.length > 0 ? (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {sizes.map((sz) => (
                        <span key={sz} className="bg-[var(--bg-card2)] text-xs font-bold px-2 py-0.5 rounded-full text-[var(--text-1)]">
                          {sz}
                        </span>
                      ))}
                    </div>
                  ) : null;
                })()}
              </div>
            </div>
          </div>
        )}

        {/* Quick Action for Cutting */}
        {batch?.status === 'created' && pipeline[0] && (pipeline[0].operation_type === 'cutting' || pipeline[0].name.toLowerCase().includes('розкрій')) && (
          <button
            onClick={() => void handleOperationPress(pipeline[0], 0)}
            className="w-full bg-emerald-600 active:bg-emerald-700 py-5 rounded-2xl mb-6 flex items-center justify-center gap-3 shadow-lg shadow-emerald-500/20"
          >
            <Play className="w-6 h-6 fill-white" />
            <span className="text-xl font-black uppercase text-white">Почати розкрій</span>
          </button>
        )}

        {/* Pipeline */}
        <h3 className="text-xs font-black text-[var(--text-2)] uppercase tracking-wider mb-3">
          Операції · {pipeline.length}
        </h3>

        {pipeline.length === 0 ? (
          <div className="bg-[var(--bg-card)] border-2 border-dashed border-[var(--border)] rounded-2xl p-8 flex flex-col items-center justify-center text-center">
            <AlertTriangle className="w-8 h-8 text-amber-500/50 mb-3" />
            <p className="font-bold text-[var(--text-2)]">Немає доступних операцій</p>
            {isMaster && (
              <button
                onClick={() => setShowRCModal(true)}
                className="mt-6 w-full bg-indigo-600 active:bg-indigo-700 text-white font-bold px-6 py-4 rounded-2xl shadow-lg shadow-indigo-500/20 text-lg uppercase tracking-tight"
              >
                Призначити техпроцес
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {pipeline.map((op, index) => {
              const cfg = OP_STATUS_CONFIG[op.status];
              const StatusIcon = cfg.icon;
              const rate = op.custom_rate ?? op.base_rate;

              return (
                <button
                  key={op.id}
                  onClick={() => void handleOperationPress(op, index)}
                  disabled={op.status === 'locked'}
                  className={clsx(
                    'w-full text-left bg-[var(--bg-card)] border-2 rounded-2xl p-4 transition-colors',
                    cfg.color
                  )}
                >
                  <div className="flex items-start gap-3">
                    {/* Sequence number */}
                    <div className="w-7 h-7 rounded-xl bg-[var(--bg-card2)] flex items-center justify-center text-xs font-black text-[var(--text-2)] shrink-0">
                      {op.sequence_number}
                    </div>

                    <div className="flex-1 min-w-0">
                      {/* Name + control badge */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-base">{op.name}</span>
                        {op.is_control_point && (
                          <span className="flex items-center gap-1 text-[10px] font-black bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded-full">
                            <ShieldCheck className="w-3 h-3" /> КТ
                          </span>
                        )}
                      </div>

                      {/* Rate + status */}
                      <div className="flex items-center gap-3 mt-1 text-xs text-[var(--text-2)]">
                        <span className="text-emerald-300 font-semibold">{rate?.toFixed(2)} грн</span>
                        <span>·</span>
                        <span className={clsx('font-semibold', cfg.badge, 'px-2 py-0.5 rounded-full')}>
                          {cfg.label}
                        </span>
                      </div>

                      {/* Progress */}
                      {(op.total_confirmed > 0 || op.total_submitted > 0) && (
                        <div className="mt-2 text-xs text-[var(--text-2)]">
                          ✓ {op.total_confirmed} підтв.
                          {op.total_submitted > 0 && <span className="text-amber-400"> · {op.total_submitted} очікує</span>}
                          <span className="text-[var(--text-3)]"> / {totalQty} шт</span>
                        </div>
                      )}

                      {/* Sizes in current operation */}
                      {op.sizes.filter(s => s.confirmed_qty > 0 || s.submitted_qty > 0).length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {op.sizes.filter(s => s.confirmed_qty > 0 || s.submitted_qty > 0).map((sz) => (
                            <span
                              key={sz.size}
                              className="flex items-center gap-1 text-[11px] font-bold bg-[var(--bg-card2)] px-2 py-0.5 rounded-full"
                            >
                              <Tag className="w-2.5 h-2.5 text-emerald-400" />
                              {sz.size}
                              <span className="text-green-400">{sz.confirmed_qty}</span>
                              {sz.submitted_qty > 0 && <span className="text-amber-400">+{sz.submitted_qty}</span>}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Available to work on (from previous op) */}
                      {op.status !== 'locked' && op.status !== 'completed' && index > 0 && (
                        <div className="mt-3 p-2 bg-indigo-500/5 border border-indigo-500/10 rounded-xl">
                          <div className="text-[10px] font-black text-indigo-400 uppercase mb-1 flex items-center gap-1">
                            <Tag className="w-3 h-3" /> Доступно для роботи:
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {pipeline[index-1].sizes.filter(ps => ps.confirmed_qty > 0).map(ps => {
                              const cur = op.sizes.find(s => s.size === ps.size);
                              const used = (cur?.confirmed_qty || 0) + (cur?.submitted_qty || 0);
                              const left = ps.confirmed_qty - used;
                              if (left <= 0) return null;
                              return (
                                <span key={ps.size} className="text-[11px] font-bold bg-indigo-500/20 text-indigo-200 px-2 py-0.5 rounded-md">
                                  {ps.size}: <span className="text-white">{left}</span>
                                </span>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>

                    <StatusIcon className={clsx(
                      'w-5 h-5 shrink-0',
                      op.status === 'completed' ? 'text-green-400' :
                      op.status === 'in_progress' ? 'text-emerald-400' :
                      op.status === 'available' ? 'text-[var(--text-1)]' : 'text-slate-700'
                    )} />
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Size Picker Modal */}
      {sizeModal && (
        <SizePickerModal
          sizes={sizeModal.op.sizes}
          prevSizes={sizeModal.prevOp?.sizes || []}
          onSelect={(size, max) => {
            setSizeModal(null);
            router.push(
              `/entry?batchId=${id}&opId=${sizeModal.op.id}&rcoId=${sizeModal.op.rco_id}` +
              `&opName=${encodeURIComponent(sizeModal.op.name)}&size=${size}&maxQty=${max}`
            );
          }}
          onSkip={() => {
            setSizeModal(null);
            router.push(
              `/entry?batchId=${id}&opId=${sizeModal.op.id}&rcoId=${sizeModal.op.rco_id}` +
              `&opName=${encodeURIComponent(sizeModal.op.name)}&maxQty=${totalQty}`
            );
          }}
          onClose={() => setSizeModal(null)}
        />
      )}
      {/* Route Card Assignment Modal */}
      {showRCModal && (
        <RouteCardModal
          onClose={() => setShowRCModal(false)}
          onSelect={async (rcId) => {
            setShowRCModal(false);
            setLoading(true);
            try {
              const res = await fetch(`/api/mobile/batches/${id}/route-card`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ route_card_id: rcId }),
              });
              if (res.ok) {
                await loadData();
              }
            } catch (e) {
              console.error(e);
            } finally {
              setLoading(false);
            }
          }}
        />
      )}
    </>
  );
}
