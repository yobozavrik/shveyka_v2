'use client';

import { useState, useEffect, useCallback } from 'react';
import { AlertTriangle, Filter, Plus, Search, CheckCircle, XCircle, Clock } from 'lucide-react';

type Defect = {
  id: number;
  quantity: number;
  description: string;
  defect_type: string;
  severity: string;
  status: string;
  created_at: string;
  employees?: { id: number; full_name: string } | null;
  operations?: { id: number; name: string } | null;
  production_batches?: { id: number; batch_number: string } | null;
};

const severityColors: Record<string, string> = {
  minor: 'bg-yellow-400/10 text-yellow-400',
  major: 'bg-orange-400/10 text-orange-400',
  critical: 'bg-red-400/10 text-red-400',
};

const statusColors: Record<string, string> = {
  reported: 'bg-slate-400/10 text-[var(--text-2)]',
  in_review: 'bg-blue-400/10 text-blue-400',
  resolved: 'bg-green-400/10 text-green-400',
  rejected: 'bg-red-400/10 text-red-400',
};

const defectTypeLabels: Record<string, string> = {
  fabric: 'Тканина',
  sewing: 'Пошив',
  cutting: 'Крій',
  accessory: 'Фурнітура',
  other: 'Інше',
};

export default function DefectsPage() {
  const [defects, setDefects] = useState<Defect[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [filter, setFilter] = useState({ status: '', severity: '' });
  const [form, setForm] = useState({
    production_batch_id: '',
    operation_id: '',
    quantity: '1',
    description: '',
    defect_type: 'sewing',
    severity: 'minor',
  });

  const fetchDefects = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (filter.status) params.set('status', filter.status);
    if (filter.severity) params.set('severity', filter.severity);
    const res = await fetch(`/api/defects?${params}`);
    if (res.ok) setDefects(await res.json());
    setLoading(false);
  }, [filter]);

  useEffect(() => { fetchDefects(); }, [fetchDefects]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch('/api/defects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        production_batch_id: parseInt(form.production_batch_id),
        operation_id: form.operation_id ? parseInt(form.operation_id) : null,
        quantity: parseInt(form.quantity),
      }),
    });
    if (res.ok) {
      setShowForm(false);
      setForm({ production_batch_id: '', operation_id: '', quantity: '1', description: '', defect_type: 'sewing', severity: 'minor' });
      fetchDefects();
    }
  };

  const updateStatus = async (id: number, status: string) => {
    await fetch(`/api/defects/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    fetchDefects();
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black flex items-center gap-2">
            <AlertTriangle className="h-7 w-7 text-orange-400" /> Дефекти
          </h1>
          <p className="text-[var(--text-2)] text-sm mt-1">Облік та контроль дефектів виробництва</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 rounded-xl text-sm font-bold transition-all"
        >
          <Plus className="h-4 w-4" /> Зареєструвати
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-3 items-center flex-wrap">
        <Filter className="h-4 w-4 text-[var(--text-2)]" />
        <select
          value={filter.status}
          onChange={(e) => setFilter({ ...filter, status: e.target.value })}
          className="bg-[var(--bg-card)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm"
        >
          <option value="">Всі статуси</option>
          <option value="reported">Зареєстровано</option>
          <option value="in_review">На перевірці</option>
          <option value="resolved">Вирішено</option>
          <option value="rejected">Відхилено</option>
        </select>
        <select
          value={filter.severity}
          onChange={(e) => setFilter({ ...filter, severity: e.target.value })}
          className="bg-[var(--bg-card)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm"
        >
          <option value="">Всі серйозності</option>
          <option value="minor">Незначний</option>
          <option value="major">Значний</option>
          <option value="critical">Критичний</option>
        </select>
      </div>

      {/* Form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="bg-black/5 dark:bg-white/5 border border-[var(--border)] rounded-2xl p-6 space-y-4">
          <h3 className="font-bold text-lg">Новий дефект</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-xs text-[var(--text-2)] mb-1 block">Партія ID *</label>
              <input type="number" required value={form.production_batch_id} onChange={(e) => setForm({ ...form, production_batch_id: e.target.value })}
                className="w-full bg-[var(--bg-card)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm" placeholder="ID партії" />
            </div>
            <div>
              <label className="text-xs text-[var(--text-2)] mb-1 block">Операція ID</label>
              <input type="number" value={form.operation_id} onChange={(e) => setForm({ ...form, operation_id: e.target.value })}
                className="w-full bg-[var(--bg-card)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm" placeholder="ID операції" />
            </div>
            <div>
              <label className="text-xs text-[var(--text-2)] mb-1 block">Кількість *</label>
              <input type="number" required min="1" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })}
                className="w-full bg-[var(--bg-card)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="text-xs text-[var(--text-2)] mb-1 block">Тип дефекту</label>
              <select value={form.defect_type} onChange={(e) => setForm({ ...form, defect_type: e.target.value })}
                className="w-full bg-[var(--bg-card)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm">
                <option value="fabric">Тканина</option>
                <option value="sewing">Пошив</option>
                <option value="cutting">Крій</option>
                <option value="accessory">Фурнітура</option>
                <option value="other">Інше</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-[var(--text-2)] mb-1 block">Серйозність</label>
              <select value={form.severity} onChange={(e) => setForm({ ...form, severity: e.target.value })}
                className="w-full bg-[var(--bg-card)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm">
                <option value="minor">Незначний</option>
                <option value="major">Значний</option>
                <option value="critical">Критичний</option>
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs text-[var(--text-2)] mb-1 block">Опис</label>
            <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="w-full bg-[var(--bg-card)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm" rows={3} placeholder="Опис дефекту..." />
          </div>
          <div className="flex gap-3">
            <button type="submit" className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 rounded-xl text-sm font-bold transition-all">Зберегти</button>
            <button type="button" onClick={() => setShowForm(false)} className="px-6 py-2.5 bg-[var(--bg-card2)] hover:bg-black/10 dark:hover:bg-white/10 rounded-xl text-sm font-medium transition-all">Скасувати</button>
          </div>
        </form>
      )}

      {/* Table */}
      {loading ? (
        <div className="text-center py-12 text-[var(--text-2)]">Завантаження...</div>
      ) : defects.length === 0 ? (
        <div className="text-center py-12">
          <Search className="h-12 w-12 text-slate-700 mx-auto mb-3" />
          <p className="text-[var(--text-2)]">Дефектів не знайдено</p>
        </div>
      ) : (
        <div className="bg-black/5 dark:bg-white/5 border border-[var(--border)] rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border)]">
                <th className="text-left px-4 py-3 text-xs text-[var(--text-2)] font-semibold">Партія</th>
                <th className="text-left px-4 py-3 text-xs text-[var(--text-2)] font-semibold">Операція</th>
                <th className="text-left px-4 py-3 text-xs text-[var(--text-2)] font-semibold">Тип</th>
                <th className="text-center px-4 py-3 text-xs text-[var(--text-2)] font-semibold">Кільк.</th>
                <th className="text-center px-4 py-3 text-xs text-[var(--text-2)] font-semibold">Серйозність</th>
                <th className="text-center px-4 py-3 text-xs text-[var(--text-2)] font-semibold">Статус</th>
                <th className="text-left px-4 py-3 text-xs text-[var(--text-2)] font-semibold">Працівник</th>
                <th className="text-left px-4 py-3 text-xs text-[var(--text-2)] font-semibold">Дата</th>
                <th className="text-center px-4 py-3 text-xs text-[var(--text-2)] font-semibold">Дії</th>
              </tr>
            </thead>
            <tbody>
              {defects.map((d) => (
                <tr key={d.id} className="border-b border-[var(--border)]/50 hover:bg-black/5 dark:bg-white/5 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs">{d.production_batches?.batch_number || '-'}</td>
                  <td className="px-4 py-3 text-[var(--text-1)]">{d.operations?.name || '-'}</td>
                  <td className="px-4 py-3">{defectTypeLabels[d.defect_type] || d.defect_type}</td>
                  <td className="px-4 py-3 text-center font-bold">{d.quantity}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`px-2 py-1 rounded-lg text-xs font-bold ${severityColors[d.severity] || ''}`}>
                      {d.severity}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`px-2 py-1 rounded-lg text-xs font-bold ${statusColors[d.status] || ''}`}>
                      {d.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-[var(--text-1)]">{d.employees?.full_name || '-'}</td>
                  <td className="px-4 py-3 text-xs text-[var(--text-2)]">{new Date(d.created_at).toLocaleDateString('uk-UA')}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1 justify-center">
                      {d.status === 'reported' && (
                        <>
                          <button onClick={() => updateStatus(d.id, 'in_review')} title="На перевірку" className="p-1.5 hover:bg-blue-400/10 rounded-lg transition-colors">
                            <Clock className="h-4 w-4 text-blue-400" />
                          </button>
                          <button onClick={() => updateStatus(d.id, 'resolved')} title="Вирішено" className="p-1.5 hover:bg-green-400/10 rounded-lg transition-colors">
                            <CheckCircle className="h-4 w-4 text-green-400" />
                          </button>
                        </>
                      )}
                      {d.status === 'in_review' && (
                        <>
                          <button onClick={() => updateStatus(d.id, 'resolved')} title="Вирішено" className="p-1.5 hover:bg-green-400/10 rounded-lg transition-colors">
                            <CheckCircle className="h-4 w-4 text-green-400" />
                          </button>
                          <button onClick={() => updateStatus(d.id, 'rejected')} title="Відхилити" className="p-1.5 hover:bg-red-400/10 rounded-lg transition-colors">
                            <XCircle className="h-4 w-4 text-red-400" />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
