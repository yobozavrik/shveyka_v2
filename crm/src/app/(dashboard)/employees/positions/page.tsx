'use client';

import { useEffect, useState } from 'react';
import { Loader2, Plus, Pencil, Trash2, Briefcase } from 'lucide-react';
import { showConfirm } from '@/lib/confirm';

type PositionRow = {
  id: number;
  name: string;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

type PositionForm = {
  name: string;
  sort_order: string;
  is_active: boolean;
};

const EMPTY_FORM: PositionForm = {
  name: '',
  sort_order: '0',
  is_active: true,
};

export default function PositionsPage() {
  const [positions, setPositions] = useState<PositionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState<PositionRow | null>(null);
  const [form, setForm] = useState<PositionForm>(EMPTY_FORM);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/positions', { cache: 'no-store' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Не вдалося завантажити посади');
      setPositions(Array.isArray(json) ? json : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не вдалося завантажити посади');
      setPositions([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
  };

  const openEdit = (position: PositionRow) => {
    setEditing(position);
    setForm({
      name: position.name,
      sort_order: String(position.sort_order ?? 0),
      is_active: position.is_active,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');

    const payload = {
      name: form.name.trim(),
      sort_order: Number(form.sort_order || 0),
      is_active: form.is_active,
    };

    try {
      const res = await fetch(editing ? `/api/positions/${editing.id}` : '/api/positions', {
        method: editing ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Не вдалося зберегти посаду');
      setForm(EMPTY_FORM);
      setEditing(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не вдалося зберегти посаду');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (position: PositionRow) => {
    if (!await showConfirm(`Приховати посаду "${position.name}"?`)) return;

    setSaving(true);
    try {
      const res = await fetch(`/api/positions/${position.id}`, { method: 'DELETE' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Не вдалося приховати посаду');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не вдалося приховати посаду');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-3 text-3xl font-black text-[var(--text-1)]">
            <Briefcase className="h-8 w-8 text-emerald-500" />
            Посади
          </h1>
          <p className="mt-1 text-sm text-[var(--text-2)]">
            Довідник посад для вибору у картці співробітника.
          </p>
        </div>
        <button
          onClick={openCreate}
          className="inline-flex items-center gap-2 rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-black text-white"
        >
          <Plus className="h-4 w-4" />
          Нова посада
        </button>
      </div>

      {error && (
        <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="overflow-hidden rounded-[28px] border border-[var(--border)] bg-[var(--bg-card)]">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
            </div>
          ) : positions.length === 0 ? (
            <div className="px-6 py-20 text-center text-sm text-[var(--text-3)]">
              Посад ще немає.
            </div>
          ) : (
            <div className="divide-y divide-[var(--border)]">
              {positions.map((position) => (
                <div key={position.id} className="flex items-center justify-between gap-4 px-6 py-4">
                  <div>
                    <div className="font-bold text-[var(--text-1)]">{position.name}</div>
                    <div className="text-xs text-[var(--text-3)]">
                      {position.is_active ? 'Активна' : 'Прихована'} · Порядок {position.sort_order}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => openEdit(position)}
                      className="inline-flex items-center gap-1 rounded-xl border border-[var(--border)] bg-[var(--bg-base)] px-3 py-2 text-xs font-bold"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      Редагувати
                    </button>
                    <button
                      onClick={() => handleDelete(position)}
                      className="inline-flex items-center gap-1 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs font-bold text-red-600"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Видалити
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-[28px] border border-[var(--border)] bg-[var(--bg-card)] p-6">
          <div className="mb-5">
            <div className="text-xs font-black uppercase tracking-widest text-emerald-500">
              {editing ? 'Редагування' : 'Нова посада'}
            </div>
            <h2 className="mt-1 text-2xl font-black text-[var(--text-1)]">
              {editing ? editing.name : 'Створити посаду'}
            </h2>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <label className="block space-y-2">
              <span className="text-xs font-black uppercase tracking-widest text-[var(--text-3)]">Назва</span>
              <input
                value={form.name}
                onChange={(e) => setForm((current) => ({ ...current, name: e.target.value }))}
                className="w-full rounded-2xl border border-[var(--border)] bg-[var(--bg-base)] px-4 py-3 text-sm outline-none"
                placeholder="Розкрійник"
                required
              />
            </label>

            <label className="block space-y-2">
              <span className="text-xs font-black uppercase tracking-widest text-[var(--text-3)]">Порядок</span>
              <input
                type="number"
                value={form.sort_order}
                onChange={(e) => setForm((current) => ({ ...current, sort_order: e.target.value }))}
                className="w-full rounded-2xl border border-[var(--border)] bg-[var(--bg-base)] px-4 py-3 text-sm outline-none"
                min={0}
              />
            </label>

            <label className="flex items-center gap-3 text-sm font-semibold text-[var(--text-2)]">
              <input
                type="checkbox"
                checked={form.is_active}
                onChange={(e) => setForm((current) => ({ ...current, is_active: e.target.checked }))}
                className="h-4 w-4 rounded border-[var(--border)]"
              />
              Активна
            </label>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={openCreate}
                className="rounded-2xl border border-[var(--border)] bg-[var(--bg-base)] px-4 py-3 text-sm font-black text-[var(--text-2)]"
              >
                Очистити
              </button>
              <button
                type="submit"
                disabled={saving}
                className="rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-black text-white disabled:opacity-60"
              >
                {saving ? 'Збереження...' : editing ? 'Оновити' : 'Створити'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
