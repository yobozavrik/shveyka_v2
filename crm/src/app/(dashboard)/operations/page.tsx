'use client';

import { useState, useEffect } from 'react';
import { Wrench, Plus, Search, Loader2, X, Check } from 'lucide-react';

interface Operation {
  id: number;
  code: string;
  name: string;
  operation_type: string;
  base_rate: number;
  time_norm_minutes: number | null;
  unit: string;
  is_active: boolean;
}

const TYPE_LABEL: Record<string, string> = {
  cutting: 'Розкрій',
  sewing: 'Пошив',
};

const TYPE_COLOR: Record<string, string> = {
  cutting: 'bg-orange-500/10 text-orange-400',
  sewing: 'bg-indigo-500/10 text-indigo-400',
};

const EMPTY_FORM = { code: '', name: '', operation_type: 'sewing', base_rate: '', time_norm_minutes: '', unit: 'pcs', is_active: true };

export default function OperationsPage() {
  const [operations, setOperations] = useState<Operation[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch('/api/operations');
      setOperations(await res.json());
    } finally { setLoading(false); }
  }

  async function handleSave() {
    setSaving(true);
    setError('');
    try {
      const res = await fetch('/api/operations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          base_rate: parseFloat(form.base_rate) || 0,
          time_norm_minutes: form.time_norm_minutes ? parseFloat(form.time_norm_minutes) : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error); return; }
      setShowModal(false);
      setForm(EMPTY_FORM);
      load();
    } finally { setSaving(false); }
  }

  const filtered = operations.filter(op =>
    op.name.toLowerCase().includes(search.toLowerCase()) ||
    op.code.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-black flex items-center gap-3">
            <Wrench className="h-7 w-7 text-indigo-500" />
            Операції
          </h1>
          <p className="text-[var(--text-2)] text-sm mt-1">Довідник технологічних операцій та розцінок</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 px-4 py-2.5 rounded-xl text-sm font-bold transition-colors"
        >
          <Plus className="h-4 w-4" /> Додати операцію
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--text-2)]" />
        <input
          type="text"
          placeholder="Пошук за назвою або кодом..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full bg-[var(--bg-card)] border border-[var(--border)] rounded-xl pl-10 pr-4 py-2.5 text-sm outline-none focus:border-indigo-500 transition-colors"
        />
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-indigo-500" /></div>
      ) : (
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="border-b border-[var(--border)] text-[var(--text-2)]">
              <tr>
                <th className="px-4 py-3 text-left font-semibold">Код</th>
                <th className="px-4 py-3 text-left font-semibold">Назва операції</th>
                <th className="px-4 py-3 text-left font-semibold">Тип</th>
                <th className="px-4 py-3 text-right font-semibold">Розцінка, грн</th>
                <th className="px-4 py-3 text-right font-semibold">Норма, хв</th>
                <th className="px-4 py-3 text-center font-semibold">Статус</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {filtered.map(op => (
                <tr key={op.id} className="hover:bg-[var(--bg-hover)] transition-colors">
                  <td className="px-4 py-3 font-mono text-xs text-indigo-300">{op.code}</td>
                  <td className="px-4 py-3 font-medium">{op.name}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-bold px-2 py-1 rounded-full ${TYPE_COLOR[op.operation_type] || 'bg-[var(--bg-card2)] text-[var(--text-2)]'}`}>
                      {TYPE_LABEL[op.operation_type] || op.operation_type}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-bold text-green-400">{op.base_rate?.toFixed(2)}</td>
                  <td className="px-4 py-3 text-right text-[var(--text-2)]">{op.time_norm_minutes ?? '—'}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${op.is_active ? 'bg-green-500/10 text-green-400' : 'bg-[var(--bg-card2)] text-[var(--text-2)]'}`}>
                      {op.is_active ? <><Check className="h-3 w-3" /> Активна</> : 'Неактивна'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div className="text-center py-12 text-[var(--text-3)]">
              <Wrench className="h-8 w-8 mx-auto mb-2 opacity-40" />
              <p>{search ? 'Нічого не знайдено' : 'Немає операцій'}</p>
            </div>
          )}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-6 w-full max-w-md space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold">Нова операція</h3>
              <button onClick={() => setShowModal(false)} className="p-1 hover:text-red-400 transition-colors"><X className="h-5 w-5" /></button>
            </div>

            {error && <p className="text-red-400 text-sm bg-red-500/10 px-3 py-2 rounded-lg">{error}</p>}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-[var(--text-2)] mb-1 block font-semibold uppercase">Код *</label>
                <input value={form.code} onChange={e => setForm(f => ({...f, code: e.target.value}))}
                  className="w-full bg-[var(--bg-card)] border border-[var(--border)] rounded-xl px-3 py-2.5 text-sm outline-none focus:border-indigo-500"
                  placeholder="SEW-01" />
              </div>
              <div>
                <label className="text-xs text-[var(--text-2)] mb-1 block font-semibold uppercase">Тип</label>
                <select value={form.operation_type} onChange={e => setForm(f => ({...f, operation_type: e.target.value}))}
                  className="w-full bg-[var(--bg-card)] border border-[var(--border)] rounded-xl px-3 py-2.5 text-sm outline-none focus:border-indigo-500">
                  <option value="sewing">Пошив</option>
                  <option value="cutting">Розкрій</option>
                </select>
              </div>
            </div>

            <div>
              <label className="text-xs text-[var(--text-2)] mb-1 block font-semibold uppercase">Назва *</label>
              <input value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))}
                className="w-full bg-[var(--bg-card)] border border-[var(--border)] rounded-xl px-3 py-2.5 text-sm outline-none focus:border-indigo-500"
                placeholder="Пошив основного шва" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-[var(--text-2)] mb-1 block font-semibold uppercase">Розцінка, грн *</label>
                <input type="number" step="0.01" value={form.base_rate} onChange={e => setForm(f => ({...f, base_rate: e.target.value}))}
                  className="w-full bg-[var(--bg-card)] border border-[var(--border)] rounded-xl px-3 py-2.5 text-sm outline-none focus:border-indigo-500"
                  placeholder="3.50" />
              </div>
              <div>
                <label className="text-xs text-[var(--text-2)] mb-1 block font-semibold uppercase">Норма, хв</label>
                <input type="number" value={form.time_norm_minutes} onChange={e => setForm(f => ({...f, time_norm_minutes: e.target.value}))}
                  className="w-full bg-[var(--bg-card)] border border-[var(--border)] rounded-xl px-3 py-2.5 text-sm outline-none focus:border-indigo-500"
                  placeholder="5" />
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button onClick={() => setShowModal(false)}
                className="flex-1 bg-[var(--bg-card)] hover:bg-[var(--bg-hover)] py-2.5 rounded-xl text-sm font-semibold transition-colors">
                Скасувати
              </button>
              <button onClick={handleSave} disabled={saving || !form.code || !form.name || !form.base_rate}
                className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 py-2.5 rounded-xl text-sm font-bold transition-colors flex items-center justify-center gap-2">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Зберегти
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
