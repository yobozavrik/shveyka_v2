'use client';

import { useEffect, useMemo, useState } from 'react';
import { showConfirm } from '@/lib/confirm';
import { ArrowRight, ChevronRight, Calculator, Loader2, Plus, Search, Trash2, X, Shirt } from 'lucide-react';

type Model = {
  id: number;
  name: string;
  sku: string;
  category: string | null;
  description: string | null;
  is_active: boolean;
  source_payload?: { seed?: boolean } | null;
};

type WarehouseItem = {
  id: number;
  name: string;
  sku: string | null;
  unit?: string | null;
  price_per_unit?: number | null;
};

type MaterialNorm = {
  id: number;
  material_id: number;
  quantity_per_unit: number;
  item_type: string | null;
  unit_of_measure: string | null;
  notes: string | null;
  items?: { id: number; name: string; sku: string | null; unit: string | null; price_per_unit: number | null } | null;
};

type MaterialForm = {
  id: number | null;
  material_id: string;
  quantity_per_unit: string;
  item_type: string;
  unit_of_measure: string;
  notes: string;
};

type ModelForm = {
  name: string;
  sku: string;
  category: string;
  description: string;
  is_active: boolean;
};

const emptyMaterialForm = (): MaterialForm => ({
  id: null,
  material_id: '',
  quantity_per_unit: '',
  item_type: '',
  unit_of_measure: '',
  notes: '',
});

async function readJson<T>(res: Response): Promise<T | null> {
  try {
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export default function ProductModelsPage() {
  const [models, setModels] = useState<Model[]>([]);
  const [items, setItems] = useState<WarehouseItem[]>([]);
  const [materials, setMaterials] = useState<MaterialNorm[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMaterials, setLoadingMaterials] = useState(false);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [materialModalOpen, setMaterialModalOpen] = useState(false);
  
  const [materialForm, setMaterialForm] = useState<MaterialForm>(emptyMaterialForm());
  const [modelForm, setModelForm] = useState<ModelForm>({
    name: '',
    sku: '',
    category: '',
    description: '',
    is_active: true,
  });

  const selectedModel = models.find((m) => m.id === selectedId) || null;

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    if (selectedId) {
      void loadMaterials(selectedId);
    } else {
      setMaterials([]);
    }
  }, [selectedId]);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const [modelsRes, itemsRes] = await Promise.all([
        fetch('/api/product-models'),
        fetch('/api/warehouse/items'),
      ]);

      const [modelsJson, itemsJson] = await Promise.all([
        readJson<unknown>(modelsRes),
        readJson<unknown>(itemsRes),
      ]);

      if (!modelsRes.ok) throw new Error((modelsJson as any)?.error || 'Не вдалося завантажити моделі');
      if (!itemsRes.ok) throw new Error((itemsJson as any)?.error || 'Не вдалося завантажити матеріали');

      setModels(Array.isArray(modelsJson) ? (modelsJson as Model[]) : []);
      setItems(Array.isArray(itemsJson) ? (itemsJson as WarehouseItem[]) : []);
    } catch (e: any) {
      console.error(e);
      setError(e?.message || 'Помилка завантаження');
    } finally {
      setLoading(false);
    }
  }

  async function loadMaterials(modelId: number) {
    setLoadingMaterials(true);
    try {
      const res = await fetch(`/api/product-models/${modelId}/materials`);
      const json = await readJson<unknown>(res);
      if (!res.ok) throw new Error((json as any)?.error || 'Не вдалося завантажити матеріали');
      setMaterials(Array.isArray(json) ? (json as MaterialNorm[]) : []);
    } catch (e: any) {
      console.error(e);
      setMaterials([]);
      setError(e?.message || 'Помилка завантаження матеріалів');
    } finally {
      setLoadingMaterials(false);
    }
  }

  function resetForm() {
    setModelForm({
      name: '',
      sku: '',
      category: '',
      description: '',
      is_active: true,
    });
  }

  async function handleSaveModel() {
    setSaving(true);
    setError('');
    try {
      if (!modelForm.name) throw new Error('Введіть назву моделі');
      if (!modelForm.sku) throw new Error('Введіть артикул');

      const res = await fetch('/api/product-models', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(modelForm),
      });

      const json = await readJson<{ error?: string }>(res);
      if (!res.ok) throw new Error(json?.error || 'Помилка збереження');

      setShowModal(false);
      resetForm();
      await load();
    } catch (e: any) {
      console.error(e);
      setError(e?.message || 'Помилка збереження');
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveMaterial() {
    if (!selectedId || !materialForm.material_id || !materialForm.quantity_per_unit) return;

    const endpoint = materialForm.id 
        ? `/api/product-models/${selectedId}/materials/${materialForm.id}` 
        : `/api/product-models/${selectedId}/materials`;
        
    const res = await fetch(endpoint, {
        method: materialForm.id ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          material_id: Number(materialForm.material_id),
          quantity_per_unit: Number(materialForm.quantity_per_unit),
          item_type: materialForm.item_type || null,
          unit_of_measure: materialForm.unit_of_measure || null,
          notes: materialForm.notes || null,
        }),
      });

    const json = await readJson<{ error?: string }>(res);
    if (!res.ok) {
      setError(json?.error || 'Помилка збереження матеріалу');
      return;
    }

    setMaterialModalOpen(false);
    setMaterialForm(emptyMaterialForm());
    await loadMaterials(selectedId);
  }

  async function handleDeleteMaterial(id: number) {
    if (!selectedId) return;
    if (!await showConfirm('Видалити норму?')) return;
    const res = await fetch(`/api/product-models/${selectedId}/materials/${id}`, { method: 'DELETE' });
    const json = await readJson<{ error?: string }>(res);
    if (!res.ok) {
      setError(json?.error || 'Помилка видалення');
      return;
    }
    await loadMaterials(selectedId);
  }

  // Розрахунок планової собівартості матеріалів
  const plannedMaterialCost = useMemo(() => {
    return materials.reduce((sum, norm) => {
        const p = norm.items?.price_per_unit || 0;
        return sum + (p * norm.quantity_per_unit);
    }, 0);
  }, [materials]);

  const filteredModels = models.filter((m) => {
    const q = search.toLowerCase();
    return (
      (m.name || '').toLowerCase().includes(q) ||
      (m.sku || '').toLowerCase().includes(q) ||
      (m.description || '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="mx-auto max-w-7xl p-6 relative flex h-[calc(100vh-120px)] gap-6 overflow-hidden">
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="mb-6 flex items-end justify-between">
          <div>
            <h1 className="flex items-center gap-3 text-3xl font-black tracking-tight text-[var(--text-1)]">
              <Shirt className="h-8 w-8 text-indigo-600" />
              Довідник Моделей (BOM)
            </h1>
            <p className="mt-2 text-sm text-[var(--text-2)]">
              Керування виробами, специфікаціями та нормами витрат матеріалів
            </p>
          </div>
          <button
            onClick={() => {
              resetForm();
              setShowModal(true);
            }}
            className="flex items-center gap-2 rounded-2xl bg-indigo-600 px-4 py-3 font-bold text-white"
          >
            <Plus className="h-5 w-5" />
            Створити модель
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--bg-card)]">
          <div className="border-b border-[var(--border)] p-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-2xl border border-[var(--border)] bg-[var(--bg-base)] py-3 pl-10 pr-4"
                placeholder="Пошук моделей..."
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            {loading ? (
              <div className="py-24 text-center">
                <Loader2 className="mx-auto h-8 w-8 animate-spin text-indigo-500" />
              </div>
            ) : filteredModels.length === 0 ? (
              <div className="py-24 text-center text-[var(--text-muted)]">Моделі не знайдені</div>
            ) : (
              filteredModels.map((model) => (
                <button
                  key={model.id}
                  onClick={() => setSelectedId((prev) => (prev === model.id ? null : model.id))}
                  className={`mb-3 flex w-full items-center gap-4 rounded-2xl border p-4 text-left transition-colors ${
                    selectedId === model.id ? 'border-indigo-600/30 bg-indigo-600/5' : 'border-[var(--border)] bg-[var(--bg-base)] hover:border-gray-300'
                  }`}
                >
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] font-black text-indigo-600">
                    {model.name?.[0] || '?'}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-bold text-gray-900">
                      {model.name}
                    </div>
                    <div className="flex gap-2 text-xs text-gray-500 mt-1">
                      <span className="bg-gray-100 px-2 py-0.5 rounded text-gray-700">{model.sku}</span>
                      {model.category && <span>{model.category}</span>}
                    </div>
                  </div>
                  <ArrowRight className="h-5 w-5 text-gray-400" />
                </button>
              ))
            )}
          </div>
        </div>
      </div>

      <div
        className={`absolute bottom-0 right-0 top-0 z-40 flex w-[480px] flex-col border-l border-[var(--border)] bg-[var(--bg-card)] shadow-2xl transition-transform ${
          selectedId ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {selectedModel ? (
          <>
            <div className="border-b border-[var(--border)] p-6 bg-gray-50">
              <div className="mb-4 flex items-center justify-between">
                <button onClick={() => setSelectedId(null)} className="rounded-xl border border-[var(--border)] bg-white p-2 shadow-sm hover:bg-gray-50">
                  <ChevronRight className="h-5 w-5 text-gray-600" />
                </button>
              </div>
              <div className="flex items-center gap-3 mb-2">
                 <h2 className="text-2xl font-black text-gray-900">{selectedModel.name}</h2>
                 {!selectedModel.is_active && <span className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded border border-red-200">Неактивна</span>}
              </div>
              <div className="flex gap-2">
                <span className="text-sm font-semibold text-indigo-600 bg-indigo-50 px-2 py-1 rounded">{selectedModel.sku}</span>
                {selectedModel.category && <span className="text-sm text-gray-600 bg-gray-100 px-2 py-1 rounded">{selectedModel.category}</span>}
              </div>
              {selectedModel.description && <div className="mt-4 text-sm text-gray-600 leading-relaxed bg-white p-3 rounded-lg border border-gray-200">{selectedModel.description}</div>}
            </div>

            <div className="flex items-center justify-between border-b border-[var(--border)] px-6 py-4 bg-white">
              <div className="text-sm font-black uppercase tracking-wider text-gray-800">Специфікація (BOM)</div>
              <button
                onClick={() => {
                  setMaterialForm(emptyMaterialForm());
                  setMaterialModalOpen(true);
                }}
                className="text-sm font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
              >
                <Plus size={16}/> Додати
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 bg-white">
              {loadingMaterials ? (
                <div className="py-8 text-center">
                  <Loader2 className="mx-auto h-6 w-6 animate-spin text-indigo-500" />
                </div>
              ) : materials.length === 0 ? (
                <div className="rounded-2xl border-2 border-dashed border-gray-200 p-8 text-center text-sm text-gray-400">
                   <p>Специфікація не заповнена</p>
                   <p className="mt-1 text-xs">Додайте тканину, нитки та фурнітуру</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {materials.map((material) => (
                    <div key={material.id} className="rounded-xl border border-gray-200 bg-gray-50/50 p-4 transition-colors hover:border-indigo-200 hover:bg-indigo-50/10">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="truncate font-bold text-gray-900">{material.items?.name || 'Дані відсутні'}</div>
                          <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1 text-xs text-gray-500">
                            <span>{material.items?.sku}</span>
                            {material.item_type && <span className="text-indigo-600 bg-indigo-50 px-1 rounded">{material.item_type}</span>}
                            <span>{material.items?.price_per_unit ? `${material.items?.price_per_unit} ₴` : 'Без ціни'}</span>
                          </div>
                          {material.notes && <div className="mt-2 text-xs italic text-gray-500">{material.notes}</div>}
                        </div>
                        
                        <div className="flex flex-col items-end gap-2">
                          <div className="text-right text-base font-black text-indigo-600 bg-white border border-indigo-100 px-3 py-1 rounded-lg">
                            {material.quantity_per_unit} <span className="text-xs font-semibold text-indigo-400">{material.items?.unit || material.unit_of_measure}</span>
                          </div>
                          <div className="flex items-center gap-1 mt-1">
                            <button
                              onClick={() => {
                                setMaterialForm({
                                  id: material.id,
                                  material_id: String(material.material_id),
                                  quantity_per_unit: String(material.quantity_per_unit),
                                  item_type: material.item_type || '',
                                  unit_of_measure: material.unit_of_measure || '',
                                  notes: material.notes || '',
                                });
                                setMaterialModalOpen(true);
                              }}
                              className="text-gray-400 hover:text-indigo-600 p-1"
                            >
                              <span className="text-sm">✎</span>
                            </button>
                            <button onClick={() => void handleDeleteMaterial(material.id)} className="text-gray-400 hover:text-red-500 p-1">
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                  
                  {/* Підсумок */}
                  <div className="mt-6 border-t border-gray-200 pt-4 px-2">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-gray-700 font-semibold">
                           <Calculator size={16} className="text-gray-400"/> Загальна вартість матеріалів:
                        </div>
                        <div className="text-lg font-black text-gray-900">{plannedMaterialCost.toFixed(2)} ₴</div>
                    </div>
                    <div className="text-xs text-gray-400 text-right mt-1">* на основі облікових цін складу</div>
                  </div>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex h-full items-center justify-center text-[var(--text-muted)] bg-gray-50">
            <ChevronRight className="h-12 w-12 opacity-10" />
          </div>
        )}
      </div>

      {/* Model Creation Modal */}
      {showModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md overflow-hidden rounded-[24px] border border-[var(--border)] bg-[var(--bg-card)] p-6 shadow-2xl">
            <div className="mb-6 flex items-center justify-between">
              <h3 className="text-2xl font-black">Створити модель</h3>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="h-6 w-6" />
              </button>
            </div>

            {error && <div className="mb-4 rounded-xl border border-red-500/20 bg-red-50 p-3 text-sm text-red-600">{error}</div>}

            <div className="space-y-4">
               <div>
                  <label className="text-sm font-semibold text-gray-700 mb-1 block">Назва</label>
                  <input
                    value={modelForm.name}
                    onChange={(e) => setModelForm((prev) => ({ ...prev, name: e.target.value }))}
                    className="w-full rounded-xl border border-[var(--border)] px-4 py-2"
                    placeholder="Напр., Футболка Базова"
                  />
               </div>
               <div>
                   <label className="text-sm font-semibold text-gray-700 mb-1 block">Артикул (SKU)</label>
                   <input
                    value={modelForm.sku}
                    onChange={(e) => setModelForm((prev) => ({ ...prev, sku: e.target.value }))}
                    className="w-full rounded-xl border border-[var(--border)] px-4 py-2 uppercase"
                    placeholder="TSH-001"
                   />
               </div>
               <div>
                   <label className="text-sm font-semibold text-gray-700 mb-1 block">Категорія</label>
                   <input
                    value={modelForm.category}
                    onChange={(e) => setModelForm((prev) => ({ ...prev, category: e.target.value }))}
                    className="w-full rounded-xl border border-[var(--border)] px-4 py-2"
                    placeholder="Одяг"
                   />
               </div>
               <div>
                   <label className="text-sm font-semibold text-gray-700 mb-1 block">Опис</label>
                   <textarea
                    value={modelForm.description}
                    onChange={(e) => setModelForm((prev) => ({ ...prev, description: e.target.value }))}
                    className="w-full rounded-xl border border-[var(--border)] px-4 py-2 h-20"
                    placeholder="Додаткова інформація"
                   />
               </div>

              <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                <input
                  type="checkbox"
                  checked={modelForm.is_active}
                  onChange={(e) => setModelForm((prev) => ({ ...prev, is_active: e.target.checked }))}
                  className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                />
                Активна модель
              </label>

            </div>

            <div className="mt-8 flex gap-3">
              <button onClick={() => setShowModal(false)} className="flex-1 rounded-xl border border-gray-300 py-2 font-semibold text-gray-700 hover:bg-gray-50">
                Скасувати
              </button>
              <button onClick={handleSaveModel} disabled={saving} className="flex-1 rounded-xl bg-indigo-600 py-2 font-bold text-white hover:bg-indigo-700 disabled:opacity-50">
                {saving ? 'Збереження...' : 'Зберегти'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Material Modal */}
      {materialModalOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-[24px] border border-[var(--border)] bg-[var(--bg-card)] p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-xl font-black text-gray-900">{materialForm.id ? 'Редагувати матеріал' : 'Додати матеріал'}</h3>
              <button onClick={() => setMaterialModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            {error && <div className="mb-4 rounded-xl border border-red-500/20 bg-red-50 p-3 text-sm text-red-600">{error}</div>}

            <div className="space-y-4">
              <div>
                  <label className="text-sm font-semibold text-gray-700 mb-1 block">Матеріал зі складу</label>
                  <select
                    value={materialForm.material_id}
                    onChange={(e) => {
                      const item = items.find((entry) => String(entry.id) === e.target.value);
                      setMaterialForm((prev) => ({
                        ...prev,
                        material_id: e.target.value,
                        unit_of_measure: item?.unit || prev.unit_of_measure,
                      }));
                    }}
                    className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-base)] px-4 py-3 font-medium text-gray-800"
                  >
                    <option value="">Оберіть матеріал...</option>
                    {items.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name} ({item.sku || 'без арт.'})
                      </option>
                    ))}
                  </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                 <div>
                    <label className="text-sm font-semibold text-gray-700 mb-1 block">Норма витрат</label>
                    <input
                      type="number"
                      step="0.001"
                      value={materialForm.quantity_per_unit}
                      onChange={(e) => setMaterialForm((prev) => ({ ...prev, quantity_per_unit: e.target.value }))}
                      className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-base)] px-4 py-3"
                      placeholder="1.5"
                    />
                 </div>
                 <div>
                    <label className="text-sm font-semibold text-gray-700 mb-1 block">Од. виміру</label>
                    <input
                      value={materialForm.unit_of_measure}
                      onChange={(e) => setMaterialForm((prev) => ({ ...prev, unit_of_measure: e.target.value }))}
                      className="w-full rounded-xl border border-[var(--border)] bg-gray-50 px-4 py-3 text-gray-500"
                      placeholder="м, шт..."
                    />
                 </div>
              </div>

              <div>
                  <label className="text-sm font-semibold text-gray-700 mb-1 block">Тип деталі (опціонально)</label>
                  <input
                    value={materialForm.item_type}
                    onChange={(e) => setMaterialForm((prev) => ({ ...prev, item_type: e.target.value }))}
                    className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-base)] px-4 py-3"
                    placeholder="Основна тканина, підкладка..."
                  />
              </div>

              <div>
                 <label className="text-sm font-semibold text-gray-700 mb-1 block">Примітка</label>
                 <textarea
                  value={materialForm.notes}
                  onChange={(e) => setMaterialForm((prev) => ({ ...prev, notes: e.target.value }))}
                  className="h-20 w-full rounded-xl border border-[var(--border)] bg-[var(--bg-base)] px-4 py-3"
                  placeholder="Вказівки для розкрою..."
                 />
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              <button onClick={() => setMaterialModalOpen(false)} className="flex-1 rounded-xl border border-[var(--border)] py-3 font-semibold text-gray-700 hover:bg-gray-50">
                Скасувати
              </button>
              <button onClick={handleSaveMaterial} className="flex-1 rounded-xl bg-indigo-600 py-3 font-bold text-white hover:bg-indigo-700 transition-colors">
                Зберегти норму
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
