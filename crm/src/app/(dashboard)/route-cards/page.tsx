'use client';

import { useEffect, useMemo, useState } from 'react';
import { showConfirm } from '@/lib/confirm';
import { ChevronRight, GitBranch, Loader2, Plus, Search, Trash2, X } from 'lucide-react';

type Model = {
  id: number;
  name: string;
  sku: string;
  is_active: boolean;
  source_payload?: { seed?: boolean } | null;
};

type RouteCard = {
  id: number;
  version: number;
  is_active: boolean;
  description: string | null;
  weight_grams: number | null;
  created_at: string;
  product_models: Model | null;
};

type RouteCardForm = {
  product_model_id: string;
  version: string;
  description: string;
  weight_grams: string;
  is_active: boolean;
};

async function readJson<T>(res: Response): Promise<T | null> {
  try {
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export default function RouteCardsPage() {
  const [cards, setCards] = useState<RouteCard[]>([]);
  const [models, setModels] = useState<Model[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState<RouteCardForm>({
    product_model_id: '',
    version: '1',
    description: '',
    weight_grams: '',
    is_active: true,
  });

  const selectedCard = cards.find((card) => card.id === selectedId) || null;
  const seedModels = useMemo(() => models.filter((model) => Boolean(model.source_payload?.seed)), [models]);

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const [cardsRes, modelsRes] = await Promise.all([
        fetch('/api/route-cards'),
        fetch('/api/product-models?source=keycrm'),
      ]);

      const [cardsJson, modelsJson] = await Promise.all([
        readJson<unknown>(cardsRes),
        readJson<unknown>(modelsRes),
      ]);

      if (!cardsRes.ok) throw new Error((cardsJson as any)?.error || 'Не вдалося завантажити маршрутні карти');
      if (!modelsRes.ok) throw new Error((modelsJson as any)?.error || 'Не вдалося завантажити моделі');

      setCards(Array.isArray(cardsJson) ? (cardsJson as RouteCard[]) : []);
      setModels(Array.isArray(modelsJson) ? (modelsJson as Model[]) : []);
    } catch (e: any) {
      console.error(e);
      setError(e?.message || 'Помилка завантаження');
    } finally {
      setLoading(false);
    }
  }

  function resetForm() {
    setForm({
      product_model_id: '',
      version: '1',
      description: '',
      weight_grams: '',
      is_active: true,
    });
  }

  async function handleSave() {
    setSaving(true);
    setError('');
    try {
      if (!form.product_model_id) throw new Error('Оберіть модель');

      const res = await fetch('/api/route-cards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product_model_id: Number(form.product_model_id),
          version: Number(form.version) || 1,
          description: form.description || null,
          weight_grams: form.weight_grams ? Number(form.weight_grams) : 0,
          is_active: form.is_active,
        }),
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

  async function handleDeleteCard(id: number) {
    if (!await showConfirm('Видалити маршрутну карту?')) return;
    const res = await fetch(`/api/route-cards/${id}`, { method: 'DELETE' });
    const json = await readJson<{ error?: string }>(res);
    if (!res.ok) {
      setError(json?.error || 'Помилка видалення');
      return;
    }
    if (selectedId === id) setSelectedId(null);
    await load();
  }

  const filteredCards = cards.filter((card) => {
    const q = search.toLowerCase();
    return (
      (card.product_models?.name || '').toLowerCase().includes(q) ||
      (card.product_models?.sku || '').toLowerCase().includes(q) ||
      (card.description || '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="relative flex h-[calc(100vh-120px)] gap-6 overflow-hidden p-6 mx-auto max-w-7xl">
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="mb-6 flex items-end justify-between">
          <div>
            <h1 className="flex items-center gap-3 text-3xl font-black tracking-tight text-[var(--text-1)]">
               <GitBranch className="h-8 w-8 text-indigo-600" />
               Маршрутні карти
            </h1>
            <p className="mt-2 text-sm text-[var(--text-2)]">
              Операції та процеси для виробництва моделей.
            </p>
          </div>
          <button
            onClick={() => {
              resetForm();
              setShowModal(true);
            }}
            className="flex items-center gap-2 rounded-2xl bg-indigo-600 px-4 py-3 font-bold text-white hover:bg-indigo-700 transition"
          >
            <Plus className="h-5 w-5" />
            Створити карту
          </button>
        </div>

        <div className="mb-4 grid grid-cols-3 gap-4">
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-4 shadow-sm">
            Всього: <b>{cards.length}</b>
          </div>
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-4 shadow-sm">
            Активні: <b>{cards.filter((card) => card.is_active).length}</b>
          </div>
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-4 shadow-sm">
            Seed-моделі: <b>{seedModels.length}</b>
          </div>
        </div>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--bg-card)] shadow-sm">
          <div className="border-b border-[var(--border)] p-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-2xl border border-[var(--border)] bg-gray-50 py-3 pl-10 pr-4 outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="Пошук..."
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 bg-gray-50/30">
            {loading ? (
              <div className="py-24 text-center">
                <Loader2 className="mx-auto h-8 w-8 animate-spin text-indigo-500" />
              </div>
            ) : filteredCards.length === 0 ? (
              <div className="py-24 text-center text-[var(--text-muted)]">Маршрути не знайдені</div>
            ) : (
              filteredCards.map((card) => (
                <button
                  key={card.id}
                  onClick={() => setSelectedId((prev) => (prev === card.id ? null : card.id))}
                  className={`mb-3 flex w-full items-center gap-4 rounded-xl border p-4 text-left transition-colors ${
                    selectedId === card.id 
                      ? 'border-indigo-600/30 bg-indigo-50' 
                      : 'border-[var(--border)] bg-white hover:border-gray-300'
                  }`}
                >
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-[var(--border)] bg-white font-black text-indigo-600 shadow-sm">
                    {card.product_models?.name?.[0] || '?'}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-bold text-gray-900">
                      {card.product_models?.name || 'Без назви'} <span className="text-xs text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded ml-1 font-semibold">v{card.version}</span>
                    </div>
                    <div className="truncate text-xs text-gray-500 mt-1">
                      {card.product_models?.sku} • {card.description || 'Без опису'}
                    </div>
                  </div>
                  <ChevronRight className="h-5 w-5 text-gray-400" />
                </button>
              ))
            )}
          </div>
        </div>
      </div>

      <div
        className={`absolute bottom-0 right-0 top-0 z-40 flex w-[480px] flex-col border-l border-[var(--border)] bg-white shadow-2xl transition-transform ${
          selectedId ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {selectedCard ? (
          <>
            <div className="border-b border-[var(--border)] p-6 bg-gray-50">
              <div className="mb-4 flex items-center justify-between">
                <button onClick={() => setSelectedId(null)} className="rounded-xl border border-[var(--border)] bg-white p-2 shadow-sm hover:bg-gray-50 transition">
                  <ChevronRight className="h-5 w-5" />
                </button>
                <button onClick={() => handleDeleteCard(selectedCard.id)} className="rounded-xl border border-red-200 bg-white p-2 text-red-500 hover:bg-red-50 transition">
                  <Trash2 className="h-5 w-5" />
                </button>
              </div>
              <h2 className="text-2xl font-black text-gray-900">{selectedCard.product_models?.name}</h2>
              <div className="text-sm font-semibold text-indigo-600 mt-1 bg-indigo-50 w-fit px-2 py-0.5 rounded">{selectedCard.product_models?.sku}</div>
              <div className="mt-4 text-sm text-gray-600 leading-relaxed bg-white border border-gray-200 p-3 rounded-lg">{selectedCard.description || 'Без опису'}</div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 flex items-center justify-center">
              <div className="text-center">
                <GitBranch className="h-12 w-12 text-gray-200 mx-auto mb-3" />
                <h3 className="text-base font-semibold text-gray-800">Операції</h3>
                <p className="text-sm text-gray-500 mt-1">Функціонал управління операціями в розробці.</p>
              </div>
            </div>
          </>
        ) : (
          <div className="flex h-full items-center justify-center text-[var(--text-muted)] bg-gray-50">
            <ChevronRight className="h-12 w-12 opacity-10" />
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg overflow-hidden rounded-[24px] border border-[var(--border)] bg-white p-6 shadow-xl">
            <div className="mb-6 flex items-center justify-between">
              <h3 className="text-2xl font-black text-gray-900">Нова маршрутна карта</h3>
              <button className="text-gray-400 hover:text-gray-600" onClick={() => setShowModal(false)}>
                <X className="h-6 w-6" />
              </button>
            </div>

            {error && <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-600">{error}</div>}

            <div className="grid gap-4 pr-2">
              <div>
                  <label className="text-sm font-semibold text-gray-700 mb-1 block">Модель</label>
                  <select
                    value={form.product_model_id}
                    onChange={(e) => setForm((prev) => ({ ...prev, product_model_id: e.target.value }))}
                    className="w-full rounded-xl border border-[var(--border)] bg-gray-50 px-4 py-3 outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">— Оберіть модель —</option>
                    {seedModels.map((model) => (
                      <option key={model.id} value={model.id}>
                        {model.name} ({model.sku})
                      </option>
                    ))}
                  </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                 <div>
                    <label className="text-sm font-semibold text-gray-700 mb-1 block">Версія</label>
                    <input
                      type="number"
                      min="1"
                      value={form.version}
                      onChange={(e) => setForm((prev) => ({ ...prev, version: e.target.value }))}
                      className="w-full rounded-xl border border-[var(--border)] bg-gray-50 px-4 py-3 outline-none focus:ring-2 focus:ring-indigo-500"
                      placeholder="Версія"
                    />
                 </div>
                 <div>
                    <label className="text-sm font-semibold text-gray-700 mb-1 block">Вага (грами)</label>
                    <input
                      type="number"
                      min="0"
                      value={form.weight_grams}
                      onChange={(e) => setForm((prev) => ({ ...prev, weight_grams: e.target.value }))}
                      className="w-full rounded-xl border border-[var(--border)] bg-gray-50 px-4 py-3 outline-none focus:ring-2 focus:ring-indigo-500"
                      placeholder="Напр. 250"
                    />
                 </div>
              </div>

              <div>
                  <label className="text-sm font-semibold text-gray-700 mb-1 block">Опис</label>
                  <textarea
                    value={form.description}
                    onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                    className="h-24 w-full rounded-xl border border-[var(--border)] bg-gray-50 px-4 py-3 outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                    placeholder="Додаткові вказівки до виробництва..."
                  />
              </div>

              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mt-2">
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={(e) => setForm((prev) => ({ ...prev, is_active: e.target.checked }))}
                  className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                />
                Карта активна
              </label>

            </div>

            <div className="mt-8 flex gap-3 pt-4">
              <button onClick={() => setShowModal(false)} className="flex-1 rounded-xl border border-gray-300 py-3 font-semibold text-gray-700 hover:bg-gray-50 transition">
                Скасувати
              </button>
              <button onClick={handleSave} disabled={saving} className="flex-1 rounded-xl bg-indigo-600 py-3 font-bold text-white hover:bg-indigo-700 disabled:opacity-50 transition">
                {saving ? 'Збереження...' : 'Зберегти карту'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
