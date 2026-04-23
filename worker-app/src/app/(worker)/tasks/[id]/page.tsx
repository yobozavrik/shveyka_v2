'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import clsx from 'clsx';
import { extractSelectedSizes, extractSizeVariantQuantities } from '@/lib/sizeVariants';
import {
  getStageConfig,
  isCuttingStage,
  isPackagingStage,
  isOverlockStage,
  isSimpleQuantityStage,
} from '@/lib/stageConfig';
import StageHeader from '@/components/StageHeader';
import EntryHistory from '@/components/EntryHistory';
import { EmbroideryQueueCard as TaskEmbroideryQueueCard } from '@/components/task-page-shared';
import {
  CuttingOperationCard as TaskCuttingOperationCard,
  SimpleQuantityOperationCard as TaskSimpleQuantityOperationCard,
  PackagingOperationCard as TaskPackagingOperationCard,
  DynamicFormOperationCard as TaskDynamicFormOperationCard,
  ConfirmModal as TaskConfirmModal,
  ValidationModal as TaskValidationModal,
} from '@/components/task-operation-cards';
import OverlockOperationCard from '@/components/OverlockOperationCard';
import { useActivityLogger } from '@/hooks/useActivityLogger';

/* в”Ђв”Ђв”Ђ Icon helpers вЂ” Material Symbols в”Ђв”Ђв”Ђ */
function IcExpandMore() { return <span className="material-symbols-outlined text-[16px]">expand_more</span>; }
function IcExpandLess() { return <span className="material-symbols-outlined text-[16px]">expand_less</span>; }
function IcEditNote() { return <span className="material-symbols-outlined text-[20px]">edit_note</span>; }
function IcContentCut() { return <span className="material-symbols-outlined text-[20px]">content_cut</span>; }
function IcSpinner({ className = '' }: { className?: string }) { return <span className={`material-symbols-outlined animate-spin ${className}`.trim()}>progress_activity</span>; }
function IcAddTask() { return <span className="material-symbols-outlined text-[20px]">add_task</span>; }
function IcCheckCircle() { return <span className="material-symbols-outlined text-[20px]" style={{fontVariationSettings:"'FILL' 1"}}>check_circle</span>; }
function IcArrowBack() { return <span className="material-symbols-outlined text-[16px]">arrow_back</span>; }
function IcInventory() { return <span className="material-symbols-outlined text-[40px] mx-auto mb-2 opacity-30">inventory_2</span>; }
function IcWarning() { return <span className="material-symbols-outlined text-[20px]">warning</span>; }

type FieldSchema = {
  key: string;
  label: string;
  type: 'text' | 'number' | 'select' | 'boolean' | 'date';
  required?: boolean;
  source?: string;
  options?: Array<{ label: string; value: string }>;
  placeholder?: string;
};

type StageOp = {
  id: number;
  stage_id: number;
  code: string;
  name: string;
  field_schema: FieldSchema[];
  sort_order: number;
  is_active: boolean;
};

type Stage = {
  id: number;
  code: string;
  name: string;
  assigned_role: string;
  sequence_order: number;
  color: string | null;
  is_active: boolean;
  operations: StageOp[];
};

type Entry = {
  id: number | string;
  task_id: number;
  batch_id: number;
  employee_id: number;
  stage_id: number | null;
  operation_id: number | null;
  entry_number: number;
  quantity: number | null;
  data: Record<string, any>;
  notes: string | null;
  recorded_at: string;
  source?: string;
  operation_code?: string | null;
  operation_name?: string | null;
};

type ColorOption = {
  color: string;
  rolls: number;
};

type TaskResponse = {
  task: any;
  batch: any;
  stage: Stage | null;
  entries: Entry[];
  legacy_nastils: any[];
  display_entries: Entry[];
  embroidery_nastils: Entry[];
  source_size_breakdown?: Record<string, number>;
  summary?: {
    entries: number;
    quantity: number;
  };
  available_colors: string[];
};

function firstRelation<T>(value: T | T[] | null | undefined) {
  if (Array.isArray(value)) return value[0] || null;
  return value || null;
}

function parseColors(value?: string | null) {
  if (!value) return [] as ColorOption[];

  return value
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
    .flatMap((part) => {
      const match = part.match(/^(.*?)(?:\s*\((\d+)\))?$/);
      const color = match?.[1]?.trim() || part;
      const rolls = Math.max(1, Number(match?.[2] || 1));
      return Array.from({ length: rolls }, () => ({ color, rolls: 1 }));
    })
    .sort((left, right) => left.color.localeCompare(right.color, 'uk'));
}

function parseSizes(value: any): string[] {
  return extractSelectedSizes(value);
}

function parseLegacySizes(value: any): Array<[string, number]> {
  if (!value || Array.isArray(value)) return [];

  return Object.entries(extractSizeVariantQuantities(value)) as Array<[string, number]>;
}

function getFields(schema: any) {
  return Array.isArray(schema) ? schema : [];
}

function inferQuantity(data: Record<string, any>, operationCode: string) {
  for (const key of [
    'quantity',
    'quantity_done',
    'quantity_cut',
    'quantity_packed',
    'quantity_per_nastil',
  ]) {
    const numeric = Number(data[key]);
    if (Number.isFinite(numeric) && numeric > 0) return Math.trunc(numeric);
  }

  if (operationCode === 'nastil') {
    const numeric = Number(data.quantity_per_nastil);
    if (Number.isFinite(numeric) && numeric > 0) return Math.trunc(numeric);
  }

  return null;
}

function createDraft(fields: FieldSchema[], primaryColor: string, nextNastilNumber: string) {
  const draft: Record<string, any> = {};

  fields.forEach((field) => {
    if (field.type === 'boolean') {
      draft[field.key] = false;
      return;
    }

    if (field.key === 'nastil_number') {
      draft[field.key] = nextNastilNumber;
      return;
    }

    if (field.type === 'select' && field.source === 'batch_colors' && field.key === 'fabric_color') {
      draft[field.key] = primaryColor || '';
      return;
    }

    draft[field.key] = '';
  });

  return draft;
}

function isDraftReady(fields: FieldSchema[], draft: Record<string, any>) {
  return fields.every((field) => {
    if (!field.required) return true;
    if (field.type === 'boolean') return true;
    return String(draft[field.key] ?? '').trim() !== '';
  });
}

function normalizeTaskEntries(entries: Entry[], ops: StageOp[]) {
  return entries.map((entry) => {
    const op = ops.find((item) => item.id === entry.operation_id);
    return {
      ...entry,
      operation_code: op?.code || entry.operation_code || null,
      operation_name: op?.name || entry.operation_name || null,
    };
  });
}

function normalizeLegacyNastils(rows: any[], stageId: number | null): Entry[] {
  return rows.map((row, index) => ({
    id: `legacy-${row.id}`,
    task_id: row.task_id,
    batch_id: row.batch_id,
    employee_id: row.employee_id || 0,
    stage_id: stageId,
    operation_id: null,
    entry_number: index + 1,
    quantity: Number(row.quantity_per_nastil || 0),
    data: {
      nastil_number: row.nastil_number,
      reel_width_cm: row.reel_width_cm,
      reel_length_m: row.reel_length_m,
      fabric_color: row.fabric_color,
      weight_kg: row.weight_kg,
      quantity_per_nastil: row.quantity_per_nastil,
      remainder_kg: row.remainder_kg,
    },
    notes: row.notes,
    recorded_at: row.created_at,
    source: 'legacy_cutting_nastils',
    operation_code: 'nastil',
    operation_name: 'РќР°СЃС‚РёР»',
  }));
}

export default function TaskPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const taskId = Number(params?.id);

  const [data, setData] = useState<TaskResponse | null>(null);
  const [stages, setStages] = useState<Stage[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [validationErrors, setValidationErrors] = useState<{ field: string; label: string; operation: string }[]>([]);
  const [forms, setForms] = useState<Record<number, Record<string, any>>>({});
  const [simpleQuantityForms, setSimpleQuantityForms] = useState<Record<number, { quantity: string; defect: string; notes: string }>>({});
  const [packagingForms, setPackagingForms] = useState<Record<number, { quantity: string; packagingType: string; notes: string }>>({});
  const logger = useActivityLogger();

  const task = data?.task || null;
  const batch = data?.batch || task?.batch || firstRelation(task?.production_batches) || null;
  const stage = useMemo(() => {
    const raw = firstRelation(task?.stage) || data?.stage || firstRelation(task?.production_stages) || null;
    if (!raw) return null;
    return stages.find((item) => item.id === raw.id || item.code === raw.code) || raw;
  }, [data?.stage, stages, task?.production_stages, task?.stage]);

  const stageCode = stage?.code || null;
  const stageConfig = getStageConfig(stageCode);

  // Р”Р»СЏ СЂР°СЃРєСЂРѕСЏ РїРѕРєР°Р·С‹РІР°РµРј РўРћР›Р¬РљРћ РѕРїРµСЂР°С†РёСЋ nastil (СѓР±РёСЂР°РµРј РґСѓР±Р»РёСЂСѓСЋС‰СѓСЋ cutting)
  const rawOperations: StageOp[] = stage?.operations || data?.stage?.operations || task?.stage?.operations || [];
  const operations: StageOp[] = useMemo(() =>
    isCuttingStage(stageCode)
      ? rawOperations.filter(op => op.code === 'nastil')
      : rawOperations
  , [stageCode, rawOperations]);
  const entries: Entry[] = useMemo(() => {
    const mapped = normalizeTaskEntries((data?.entries || []) as Entry[], operations);
    if (mapped.length > 0) return mapped;
    return normalizeLegacyNastils((data?.legacy_nastils || []) as any[], stage?.id || null);
  }, [data?.entries, data?.legacy_nastils, operations, stage?.id]);

  const embroideryNastils: Entry[] = useMemo(() => data?.embroidery_nastils || [], [data?.embroidery_nastils]);
  const isEmbroideryStage = stage?.code === 'embroidery';

  const availableColors = useMemo<ColorOption[]>(() => {
    const fromApi = data?.available_colors;
    if (Array.isArray(fromApi) && fromApi.length > 0) {
      return fromApi
        .map((item: any) => {
          if (typeof item === 'string') {
            return { color: item, rolls: 1 };
          }

          return {
            color: String(item?.color || '').trim(),
            rolls: Number(item?.rolls || 1),
          };
        })
        .filter((item): item is ColorOption => Boolean(item.color));
    }

    return parseColors(batch?.fabric_color);
  }, [batch?.fabric_color, data?.available_colors]);
  const nastilEntriesCount = useMemo(
    () =>
      entries.filter((entry) => {
        const code = String(entry.operation_code || '').toLowerCase();
        const name = String(entry.operation_name || '').toLowerCase();
        return code === 'nastil' || name === 'РЅР°СЃС‚РёР»';
      }).length,
    [entries],
  );
  const nextNastilColor = useMemo(
    () => availableColors[nastilEntriesCount]?.color || availableColors[0]?.color || '',
    [availableColors, nastilEntriesCount],
  );
  const selectedSizes = useMemo(() => parseSizes(batch?.size_variants), [batch?.size_variants]);
  const legacySizes = useMemo(() => parseLegacySizes(batch?.size_variants), [batch?.size_variants]);
  const sourceSizeRows = useMemo(() => {
    const breakdown = data?.source_size_breakdown || {};
    const orderedSizes = selectedSizes.length > 0 ? selectedSizes : Object.keys(breakdown);
    const remainingSizes = Object.keys(breakdown).filter((size) => !orderedSizes.includes(size));
    return [...orderedSizes, ...remainingSizes]
      .map((size) => ({
        size,
        planned_qty: Number(breakdown[size] || 0),
      }))
      .filter((row) => row.size && row.planned_qty > 0);
  }, [data?.source_size_breakdown, selectedSizes]);

  const entriesByOperation = useMemo(() => {
    const map = new Map<string, Entry[]>();

    entries.forEach((entry) => {
      const key = entry.operation_id ? `id:${entry.operation_id}` : `code:${entry.operation_code || 'legacy'}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(entry);
    });

    return map;
  }, [entries]);

  const summaryQuantity = data?.summary?.quantity || entries.reduce((sum, entry) => sum + Number(entry.quantity || 0), 0);
  const nextNastilNumber = useMemo(() => {
    const nastilCount = entries.filter((entry) => {
      const code = String(entry.operation_code || '').toLowerCase();
      const name = String(entry.operation_name || '').toLowerCase();
      return code === 'nastil' || name === 'РЅР°СЃС‚РёР»';
    }).length;

    return String(nastilCount + 1);
  }, [entries]);
  const isPending = task?.status === 'pending';
  const isActive = task?.status === 'accepted' || task?.status === 'in_progress';
  const isCompleted = task?.status === 'completed';

  const load = async () => {
    if (!Number.isFinite(taskId)) {
      setErr('РќРµРєРѕСЂРµРєС‚РЅРёР№ С–РґРµРЅС‚РёС„С–РєР°С‚РѕСЂ Р·Р°РІРґР°РЅРЅСЏ');
      setLoading(false);
      return;
    }

    setLoading(true);
    setErr('');

    try {
      const [taskRes, stagesRes] = await Promise.all([
        fetch(`/api/mobile/tasks/${taskId}`, { cache: 'no-store' }),
        fetch('/api/mobile/stages', { cache: 'no-store' }),
      ]);

      const taskJson = await taskRes.json();
      const stagesJson = await stagesRes.json();

      if (!taskRes.ok) throw new Error(taskJson.error || 'РќРµ РІРґР°Р»РѕСЃСЏ Р·Р°РІР°РЅС‚Р°Р¶РёС‚Рё Р·Р°РІРґР°РЅРЅСЏ');
      if (!stagesRes.ok) throw new Error(stagesJson.error || 'РќРµ РІРґР°Р»РѕСЃСЏ Р·Р°РІР°РЅС‚Р°Р¶РёС‚Рё РµС‚Р°РїРё');

      setData(taskJson as TaskResponse);
      setStages(Array.isArray(stagesJson) ? stagesJson : []);
    } catch (error) {
      setErr(error instanceof Error ? error.message : 'РќРµ РІРґР°Р»РѕСЃСЏ Р·Р°РІР°РЅС‚Р°Р¶РёС‚Рё Р·Р°РІРґР°РЅРЅСЏ');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskId]);

  useEffect(() => {
    if (!operations.length || !availableColors.length) return;

    setForms((current) => {
      const next = { ...current };

      operations.forEach((operation) => {
        if (!next[operation.id]) {
          next[operation.id] = createDraft(
            operation.field_schema || [],
            operation.code === 'nastil' ? nextNastilColor : '',
            operation.code === 'nastil' ? nextNastilNumber : '',
          );
        }
      });

      return next;
    });
  }, [availableColors, nextNastilNumber, operations]);

  const acceptTask = async () => {
    setBusy(true);
    try {
      const response = await fetch(`/api/mobile/tasks/${taskId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'accept' }),
      });

      const json = await response.json();
      if (!response.ok) throw new Error(json.error || 'РќРµ РІРґР°Р»РѕСЃСЏ РїСЂРёР№РЅСЏС‚Рё Р·Р°РІРґР°РЅРЅСЏ');
      logger.logTaskAction('task_accept', taskId, batch?.id, stageCode);
      window.dispatchEvent(new CustomEvent('task-accepted'));
      await load();
    } catch (error) {
      setErr(error instanceof Error ? error.message : 'РќРµ РІРґР°Р»РѕСЃСЏ РїСЂРёР№РЅСЏС‚Рё Р·Р°РІРґР°РЅРЅСЏ');
    } finally {
      setBusy(false);
    }
  };

  const completeTask = async () => {
    setBusy(true);
    try {
      const response = await fetch(`/api/mobile/tasks/${taskId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'complete' }),
      });

      const json = await response.json();
      if (!response.ok) throw new Error(json.error || 'РќРµ РІРґР°Р»РѕСЃСЏ Р·Р°РІРµСЂС€РёС‚Рё Р·Р°РІРґР°РЅРЅСЏ');
      logger.logTaskAction('task_complete', taskId, batch?.id, stageCode);
      setConfirmOpen(false);
      await load();
    } catch (error) {
      setErr(error instanceof Error ? error.message : 'РќРµ РІРґР°Р»РѕСЃСЏ Р·Р°РІРµСЂС€РёС‚Рё Р·Р°РІРґР°РЅРЅСЏ');
    } finally {
      setBusy(false);
    }
  };

  const addEntry = async (operation: StageOp) => {
    setSaving(true);

    try {
      const draft = forms[operation.id] || {};
      const response = await fetch(`/api/mobile/tasks/${taskId}/entries`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          operation_id: operation.id,
          data: draft,
          notes: typeof draft.notes === 'string' ? draft.notes : null,
        }),
      });

      const json = await response.json();
      if (!response.ok) throw new Error(json.error || 'РќРµ РІРґР°Р»РѕСЃСЏ Р·Р±РµСЂРµРіС‚Рё Р·Р°РїРёСЃ');

      logger.logTaskAction('entry_add', taskId, batch?.id, stageCode, {
        action_label: `Р”РѕРґР°С‚Рё Р·Р°РїРёСЃ: ${operation.name}`,
        input_data: draft,
      });

      setForms((current) => ({
        ...current,
        [operation.id]: createDraft(
          operation.field_schema || [],
          operation.code === 'nastil' ? nextNastilColor : '',
          operation.code === 'nastil' ? nextNastilNumber : '',
        ),
      }));

      await load();
    } catch (error) {
      setErr(error instanceof Error ? error.message : 'РќРµ РІРґР°Р»РѕСЃСЏ Р·Р±РµСЂРµРіС‚Рё Р·Р°РїРёСЃ');
    } finally {
      setSaving(false);
    }
  };

  const addEntryWithCustomData = async (operation: StageOp, data: Record<string, any>) => {
    setSaving(true);

    try {
      const response = await fetch(`/api/mobile/tasks/${taskId}/entries`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          operation_id: operation.id,
          data,
          notes: typeof data.notes === 'string' ? data.notes : null,
        }),
      });

      const json = await response.json();
      if (!response.ok) throw new Error(json.error || 'РќРµ РІРґР°Р»РѕСЃСЏ Р·Р±РµСЂРµРіС‚Рё Р·Р°РїРёСЃ');

      await load();
    } catch (error) {
      setErr(error instanceof Error ? error.message : 'РќРµ РІРґР°Р»РѕСЃСЏ Р·Р±РµСЂРµРіС‚Рё Р·Р°РїРёСЃ');
    } finally {
      setSaving(false);
    }
  };

  const addOverlockEntry = async (operation: StageOp, rows: Array<{ size: string; quantity: number; defect_quantity: number }>, notes: string) => {
    setSaving(true);

    try {
      const response = await fetch(`/api/mobile/tasks/${taskId}/entries`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          operation_id: operation.id,
          data: {
            size_rows: rows,
            notes,
          },
          notes,
        }),
      });

      const json = await response.json();
      if (!response.ok) throw new Error(json.error || 'Не вдалося зберегти запис');

      await load();
    } catch (error) {
      setErr(error instanceof Error ? error.message : 'Не вдалося зберегти запис');
    } finally {
      setSaving(false);
    }
  };

  const validateBeforeComplete = () => {
    const errors: { field: string; label: string; operation: string }[] = [];

    // РџСЂРѕРІРµСЂСЏРµРј С‡С‚Рѕ РµСЃС‚СЊ Р·Р°РїРёСЃРё
    if (entries.length === 0) {
      setValidationErrors([{
        field: 'entries',
        label: 'РќРµРјР°С” Р¶РѕРґРЅРѕРіРѕ Р·Р°РїРёСЃСѓ. Р”РѕРґР°Р№С‚Рµ С…РѕС‡Р° Р± РѕРґРёРЅ Р·Р°РїРёСЃ РїРµСЂРµРґ Р·Р°РІРµСЂС€РµРЅРЅСЏРј.',
        operation: '',
      }]);
      return false;
    }

    // Р”Р»СЏ РєР°Р¶РґРѕР№ РѕРїРµСЂР°С†РёРё РїСЂРѕРІРµСЂСЏРµРј С‡С‚Рѕ РµСЃС‚СЊ Р·Р°РїРёСЃРё
    operations.forEach((operation) => {
      const operationEntries =
        entriesByOperation.get(`id:${operation.id}`) ||
        entriesByOperation.get(`code:${operation.code}`) ||
        [];

      // Р•СЃР»Рё Сѓ РѕРїРµСЂР°С†РёРё РЅРµС‚ РЅРё РѕРґРЅРѕРіРѕ Р·Р°РїРёСЃРё - СЌС‚Рѕ РѕС€РёР±РєР°
      if (operationEntries.length === 0) {
        errors.push({
          field: operation.id.toString(),
          label: `РћРїРµСЂР°С†С–СЏ "${operation.name}" РЅРµ РјР°С” Р¶РѕРґРЅРѕРіРѕ Р·Р°РїРёСЃСѓ. Р”РѕРґР°Р№С‚Рµ Р·Р°РїРёСЃ РїРµСЂРµРґ Р·Р°РІРµСЂС€РµРЅРЅСЏРј.`,
          operation: operation.name,
        });
      }
    });

    setValidationErrors(errors);
    return errors.length === 0;
  };

  const handleCompleteClick = () => {
    const isValid = validateBeforeComplete();

    if (!isValid) {
      // РџРѕРєР°Р·С‹РІР°РµРј РјРѕРґР°Р»РєСѓ СЃ РѕС€РёР±РєР°РјРё
      return;
    }

    // Р’СЃС‘ РІР°Р»РёРґРЅРѕ - РѕС‚РєСЂС‹РІР°РµРј РїРѕРґС‚РІРµСЂР¶РґРµРЅРёРµ
    setConfirmOpen(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <IcSpinner className="text-[32px] text-emerald-500" />
      </div>
    );
  }

  if (err && !data) {
    return (
      <div className="px-4 py-5">
        <button
          onClick={() => router.back()}
          className="mb-4 inline-flex items-center gap-2 text-xs font-bold text-[var(--text-3)]"
        >
          <IcArrowBack />
          РќР°Р·Р°Рґ
        </button>
        <div className="rounded-3xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-500">
          {err}
        </div>
      </div>
    );
  }

  const batchNumber = batch?.batch_number || `#${task?.batch_id}`;
  const modelName = batch?.product_models?.name || 'Р‘РµР· РјРѕРґРµР»С–';

  return (
    <div className="flex flex-col gap-6 px-4 py-6 pb-24">
      {/* в”Ђв”Ђв”Ђ Bento Info Header в”Ђв”Ђв”Ђ */}
      <section className="bg-white dark:bg-surface-container-lowest rounded-[32px] p-6 shadow-sm border border-outline-variant/10 flex flex-col gap-6">
        <div className="flex justify-between items-start">
          <div className="flex flex-col">
            <span className="text-[10px] font-black text-primary uppercase tracking-[0.2em] leading-none mb-1">
              Р—Р°РІРґР°РЅРЅСЏ РїРѕ РїР°СЂС‚С–С—
            </span>
            <h1 className="text-3xl font-black text-on-surface leading-tight tracking-tight">{batchNumber}</h1>
            <p className="text-sm font-bold text-on-surface-variant/60">
              {modelName} {batch?.product_models?.sku ? `вЂў ${batch.product_models.sku}` : ''}
            </p>
          </div>
          <div className={clsx(
            "px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider",
            isPending ? "bg-amber-100 text-amber-700" : isActive ? "bg-primary/10 text-primary" : "bg-emerald-100 text-emerald-700"
          )}>
            {isPending ? 'РћС‡С–РєСѓС”' : isActive ? 'Р’ СЂРѕР±РѕС‚С–' : 'Р“РѕС‚РѕРІРѕ'}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="bg-surface-container-low rounded-[24px] p-4 border border-outline-variant/5">
            <span className="material-symbols-outlined text-primary mb-2">category</span>
            <p className="text-[10px] font-bold text-on-surface-variant/40 uppercase tracking-widest leading-none mb-1">РўРєР°РЅРёРЅР°</p>
            <p className="text-sm font-black text-on-surface">{batch?.fabric_type || 'вЂ”'}</p>
          </div>
          <div className="bg-surface-container-low rounded-[24px] p-4 border border-outline-variant/5">
            <span className="material-symbols-outlined text-primary mb-2">inventory_2</span>
            <p className="text-[10px] font-bold text-on-surface-variant/40 uppercase tracking-widest leading-none mb-1">РџР»Р°РЅ</p>
            <p className="text-sm font-black text-on-surface">{batch?.quantity || 0} С€С‚</p>
          </div>
        </div>

        {availableColors.length > 0 && (
          <div className="flex flex-col gap-2">
            <p className="text-[10px] font-bold text-on-surface-variant/40 uppercase tracking-widest px-1">РљРѕР»СЊРѕСЂРё С‚РєР°РЅРёРЅРё</p>
            <div className="flex flex-wrap gap-1.5">
              {availableColors.map((color, index) => (
                <span key={index} className="px-3 py-1.5 rounded-full bg-surface-container text-[11px] font-bold text-on-surface-variant flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary/40" />
                  {color.color}
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="flex flex-col gap-2">
          <div className="flex justify-between items-center px-1">
            <p className="text-[10px] font-bold text-on-surface-variant/40 uppercase tracking-widest">Р РѕР·РјС–СЂРЅР° СЃС–С‚РєР°</p>
            <p className="text-[10px] font-black text-primary uppercase">{selectedSizes.length || legacySizes.length} С‚РёРїС–РІ</p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {selectedSizes.length > 0 ? (
              selectedSizes.map((size) => (
                <span key={size} className="w-10 h-10 rounded-full bg-surface-container-low border border-outline-variant/10 flex items-center justify-center text-xs font-black text-on-surface shadow-sm">
                  {size}
                </span>
              ))
            ) : legacySizes.length > 0 ? (
              legacySizes.map(([size, qty]) => (
                <span key={size} className="px-3 py-1.5 rounded-full bg-surface-container-low border border-outline-variant/10 flex items-center gap-2 text-xs font-black text-on-surface shadow-sm">
                  {size} <span className="opacity-30">В·</span> {qty}
                </span>
              ))
            ) : (
              <span className="text-xs font-bold text-on-surface-variant/40 italic px-1">РќРµ РІРєР°Р·Р°РЅРѕ</span>
            )}
          </div>
        </div>

        {batch?.notes && (
          <div className="p-4 rounded-[24px] bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-900/30 flex items-start gap-3">
            <span className="material-symbols-outlined text-amber-600 text-[20px]">info</span>
            <p className="text-xs font-medium text-amber-800 dark:text-amber-200/70 italic">"{batch.notes}"</p>
          </div>
        )}
      </section>

      {isPending && (
        <section className="rounded-[28px] border border-[var(--border)] bg-[var(--bg-card)] p-5 space-y-4">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-amber-500/15 p-3 text-amber-500">
              <IcContentCut />
            </div>
            <div>
              <div className="text-sm font-black text-[var(--text-1)]">
                РџРѕС‚СЂС–Р±РЅРѕ РїСЂРёР№РЅСЏС‚Рё Р·Р°РІРґР°РЅРЅСЏ
              </div>
              <div className="text-xs text-[var(--text-3)]">
                РџС–СЃР»СЏ РїСЂРёР№РЅСЏС‚С‚СЏ РІС–РґРєСЂРёС”С‚СЊСЃСЏ СЂРѕР±РѕС‡Рµ РІС–РєРЅРѕ Р· РѕРїРµСЂР°С†С–СЏРјРё
              </div>
            </div>
          </div>

          <button
            onClick={acceptTask}
            disabled={busy}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-amber-500 px-4 py-4 text-sm font-black text-white disabled:opacity-60"
          >
            {busy ? <IcSpinner className="text-[20px]" /> : <IcCheckCircle />}
            РџСЂРёР№РЅСЏС‚Рё РІ СЂРѕР±РѕС‚Сѓ
          </button>
        </section>
      )}

      {isActive && (
        <section className="space-y-4">
          <div className="rounded-[28px] border border-[var(--border)] bg-[var(--bg-card)] p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-[10px] font-black uppercase tracking-widest text-[var(--text-3)]">
                  РџСЂРѕРіСЂРµСЃ
                </div>
                <div className="mt-1 text-sm font-semibold text-[var(--text-1)]">
                  {isEmbroideryStage
                    ? `${embroideryNastils.length} РЅР°СЃС‚РёР»С–РІ Сѓ С‡РµСЂР·С–`
                    : `${entries.length} Р·Р°РїРёСЃС–РІ В· ${summaryQuantity} С€С‚`}
                </div>
              </div>
              <div className="rounded-2xl bg-emerald-500/15 px-3 py-2 text-xs font-black text-emerald-500">
                {batch?.quantity || 0} РїР»Р°РЅ
              </div>
            </div>
          </div>

          {isEmbroideryStage ? (
            <TaskEmbroideryQueueCard nastils={embroideryNastils} selectedSizes={selectedSizes} />
          ) : operations.length > 0 ? (
            operations.map((operation) => {
              const operationEntries =
                entriesByOperation.get(`id:${operation.id}`) ||
                entriesByOperation.get(`code:${operation.code}`) ||
                [];

              // Cutting stage with nastil operation - use full form with schema
              if (isCuttingStage(stageCode) && operation.code === 'nastil') {
                const operationDraft =
                  forms[operation.id] ||
                  createDraft(
                    operation.field_schema || [],
                    nextNastilColor,
                    nextNastilNumber,
                  );

                return (
                  <TaskCuttingOperationCard
                    key={operation.id}
                    operation={operation}
                    entries={operationEntries}
                    draft={operationDraft}
                    setDraft={(next) =>
                      setForms((current) => ({
                        ...current,
                        [operation.id]: next,
                      }))
                    }
                    onSubmit={() => addEntry(operation)}
                    availableColors={availableColors}
                    selectedSizes={selectedSizes}
                    legacySizes={legacySizes}
                    saving={saving}
                  />
                );
              }

              if (isOverlockStage(stageCode)) {
                return (
                  <OverlockOperationCard
                    key={operation.id}
                    operation={operation}
                    entries={operationEntries}
                    stageCode={stageCode}
                    sizeRows={sourceSizeRows}
                    saving={saving}
                    onSubmit={(rows, notes) => addOverlockEntry(operation, rows, notes)}
                  />
                );
              }

              // Simple quantity stages (sewing, straight_stitch, coverlock)
              if (isSimpleQuantityStage(stageCode)) {
                const formState = simpleQuantityForms[operation.id] || { quantity: '', defect: '', notes: '' };

                const handleSubmit = (quantity: string, defect: string, notes: string) => {
                  const data: Record<string, any> = {
                    quantity_done: Number(quantity) || 0,
                  };
                  if (defect && Number(defect) > 0) {
                    data.defect_quantity = Number(defect);
                  }
                  if (notes.trim()) {
                    data.notes = notes.trim();
                  }

                  addEntryWithCustomData(operation, data);
                  setSimpleQuantityForms((current) => ({
                    ...current,
                    [operation.id]: { quantity: '', defect: '', notes: '' },
                  }));
                };

                return (
                  <TaskSimpleQuantityOperationCard
                    key={operation.id}
                    operation={operation}
                    entries={operationEntries}
                    stageCode={stageCode}
                    saving={saving}
                    onSubmit={handleSubmit}
                  />
                );
              }

              // Packaging stage
              if (isPackagingStage(stageCode)) {
                const formState = packagingForms[operation.id] || { quantity: '', packagingType: '', notes: '' };

                const handleSubmit = (quantity: string, packagingType: string, notes: string) => {
                  const data: Record<string, any> = {
                    quantity_packed: Number(quantity) || 0,
                    packaging_type: packagingType,
                  };
                  if (notes.trim()) {
                    data.notes = notes.trim();
                  }

                  addEntryWithCustomData(operation, data);
                  setPackagingForms((current) => ({
                    ...current,
                    [operation.id]: { quantity: '', packagingType: '', notes: '' },
                  }));
                };

                return (
                  <TaskPackagingOperationCard
                    key={operation.id}
                    operation={operation}
                    entries={operationEntries}
                    stageCode={stageCode}
                    saving={saving}
                    onSubmit={handleSubmit}
                  />
                );
              }

              // Default: use dynamic form from field_schema
              const operationDraft =
                forms[operation.id] ||
                createDraft(
                  operation.field_schema || [],
                  operation.code === 'nastil' ? nextNastilColor : '',
                  operation.code === 'nastil' ? nextNastilNumber : '',
                );

              return (
                <TaskDynamicFormOperationCard
                  key={operation.id}
                  operation={operation}
                  entries={operationEntries}
                  draft={operationDraft}
                  setDraft={(next) =>
                    setForms((current) => ({
                      ...current,
                      [operation.id]: next,
                    }))
                  }
                  onSubmit={() => addEntry(operation)}
                  availableColors={availableColors}
                  saving={saving}
                  stageCode={stageCode}
                />
              );
            })
          ) : (
            <section className="rounded-[28px] border border-[var(--border)] bg-[var(--bg-card)] p-5 text-center text-sm text-[var(--text-3)]">
              <IcInventory />
              Р”Р»СЏ С†СЊРѕРіРѕ РµС‚Р°РїСѓ С‰Рµ РЅРµ РЅР°Р»Р°С€С‚РѕРІР°РЅС– РѕРїРµСЂР°С†С–С—
            </section>
          )}

          <button
            onClick={handleCompleteClick}
            disabled={busy}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 px-4 py-4 text-sm font-black text-white disabled:opacity-60"
          >
            {busy ? <IcSpinner className="text-[20px]" /> : <IcCheckCircle />}
            {stageConfig.completeButtonText || 'Р—Р°РІРµСЂС€РёС‚Рё РµС‚Р°Рї'}
          </button>
        </section>
      )}

      {isCompleted && (
        <section className="rounded-[28px] border border-emerald-500/20 bg-emerald-500/10 p-6 text-center">
          <IcCheckCircle />
          <div className="text-lg font-black text-[var(--text-1)]">Р•С‚Р°Рї Р·Р°РІРµСЂС€РµРЅРѕ</div>
          <div className="mt-1 text-sm text-[var(--text-2)]">
            {batchNumber} В· {modelName}
          </div>
          <div className="mt-4 flex items-center justify-center gap-4 text-sm font-bold text-[var(--text-1)]">
            <span>{entries.length} Р·Р°РїРёСЃС–РІ</span>
            <span>вЂў</span>
            <span>{summaryQuantity} С€С‚</span>
          </div>
        </section>
      )}

      {err && !data && (
        <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-500">
          {err}
        </div>
      )}

      <div className="h-4" />

      <TaskValidationModal errors={validationErrors} onClose={() => setValidationErrors([])} />

      <TaskConfirmModal
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={completeTask}
        batchNumber={batchNumber}
        modelName={modelName}
        entriesCount={entries.length}
        quantityTotal={summaryQuantity}
        busy={busy}
        confirmButtonText={stageConfig.completeButtonText}
      />
    </div>
  );
}



