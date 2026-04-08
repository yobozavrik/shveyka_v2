'use client';

import { useState, useEffect } from 'react';
import { Briefcase, Plus, Search, Loader2, X, Check, Edit2, Trash2, ExternalLink } from 'lucide-react';
import { showConfirm } from '@/lib/confirm';

interface Vacancy {
  id: number;
  title: string;
  description: string;
  requirements: any;
  status: string;
  source?: string;
  external_url?: string;
  created_at: string;
}

const STATUS_LABELS: Record<string, string> = {
  active: 'Активна',
  closed: 'Закрита',
  open: 'Відкрита',
};

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-green-500/10 text-green-400',
  open: 'bg-green-500/10 text-green-400',
  closed: 'bg-red-500/10 text-red-400',
};

const EMPTY_FORM = { title: '', description: '', requirements: '', status: 'active' };

export default function VacanciesPage() {
  const [vacancies, setVacancies] = useState<Vacancy[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch('/api/vacancies');
      setVacancies(await res.json());
    } catch (e) {
      console.error('Fetch error:', e);
    } finally { setLoading(false); }
  }


  async function handleSave() {
    setSaving(true);
    setError('');
    try {
      const method = editingId ? 'PATCH' : 'POST';
      const url = editingId ? `/api/vacancies/${editingId}` : '/api/vacancies';
      
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          requirements: typeof form.requirements === 'string' ? form.requirements.split('\n').filter(r => r.trim()) : form.requirements
        }),
      });
      
      const data = await res.json();
      if (!res.ok) { setError(data.error); return; }
      
      setShowModal(false);
      setForm(EMPTY_FORM);
      setEditingId(null);
      load();
    } finally { setSaving(false); }
  }

  async function handleDelete(id: number) {
    if (!await showConfirm('Ви впевнені, що хочете видалити цю вакансію?')) return;
    try {
      const res = await fetch(`/api/vacancies/${id}`, { method: 'DELETE' });
      if (res.ok) load();
    } catch (e) { console.error(e); }
  }

  const filtered = Array.isArray(vacancies) ? vacancies.filter(v =>
    v.title.toLowerCase().includes(search.toLowerCase()) ||
    v.description.toLowerCase().includes(search.toLowerCase())
  ) : [];

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-black flex items-center gap-3">
            <Briefcase className="h-7 w-7 text-indigo-500" />
            Вакансії
          </h1>
          <p className="text-[var(--text-2)] text-sm mt-1">Управління відкритими позиціями для найму</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => { setEditingId(null); setForm(EMPTY_FORM); setShowModal(true); }}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 px-4 py-2.5 rounded-xl text-sm font-bold transition-colors shadow-lg shadow-indigo-500/20"
          >
            <Plus className="h-4 w-4" /> Створити вакансію
          </button>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--text-2)]" />
        <input
          type="text"
          placeholder="Пошук за назвою..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full bg-[var(--bg-card)] border border-[var(--border)] rounded-xl pl-10 pr-4 py-2.5 text-sm outline-none focus:border-indigo-500 transition-colors"
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-indigo-500" /></div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map(v => (
            <div key={v.id} className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-5 hover:border-indigo-500/50 transition-all group flex flex-col h-full shadow-sm">
              <div className="flex justify-between items-start mb-3">
                <div className="flex gap-2">
                  <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${STATUS_COLORS[v.status] || STATUS_COLORS.active}`}>
                    {STATUS_LABELS[v.status] || v.status}
                  </span>
                  {v.source === 'work.ua' && (
                    <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400">
                      Work.ua
                    </span>
                  )}
                </div>
                <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  {v.external_url && (
                    <a href={v.external_url} target="_blank" rel="noreferrer" className="p-1.5 hover:text-blue-400 transition-colors bg-blue-500/10 rounded-lg">
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  )}
                  <button onClick={() => {
                    setEditingId(v.id);
                    setForm({
                      title: v.title,
                      description: v.description,
                      requirements: Array.isArray(v.requirements) ? v.requirements.join('\n') : '',
                      status: v.status
                    });
                    setShowModal(true);
                  }} className="p-1.5 hover:text-indigo-400 transition-colors bg-indigo-500/10 rounded-lg"><Edit2 className="h-3.5 w-3.5" /></button>
                  <button onClick={() => handleDelete(v.id)} className="p-1.5 hover:text-red-400 transition-colors bg-red-500/10 rounded-lg"><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
              </div>
              
              <h3 className="text-lg font-bold mb-2 group-hover:text-indigo-400 transition-colors">{v.title}</h3>
              <p className="text-sm text-[var(--text-2)] line-clamp-3 mb-4 flex-grow">{v.description}</p>
              
              <div className="pt-4 border-t border-[var(--border)] mt-auto flex items-center justify-between text-[10px] text-[var(--text-3)] font-bold uppercase tracking-widest">
                <span>{new Date(v.created_at).toLocaleDateString()}</span>
                <a href={`/candidates?vacancyId=${v.id}`} className="text-indigo-500 hover:text-indigo-400 flex items-center gap-1 transition-colors">
                  Кандидати <Plus className="h-3 w-3" />
                </a>
              </div>
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="col-span-full text-center py-20 bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl">
              <Briefcase className="h-12 w-12 mx-auto mb-4 text-[var(--text-3)] opacity-20" />
              <p className="text-[var(--text-2)] font-medium">Вакансій поки немає</p>
            </div>
          )}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-3xl p-8 w-full max-w-xl shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 left-0 w-1.5 h-full bg-indigo-600"></div>
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-xl font-black uppercase tracking-tighter">{editingId ? 'Редагувати' : 'Нова'} вакансія</h3>
              <button onClick={() => setShowModal(false)} className="p-2 hover:bg-[var(--bg-base)] rounded-full transition-colors"><X className="h-6 w-6" /></button>
            </div>

            {error && <div className="mb-6 bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-xl text-sm font-medium flex items-center gap-3">
              <div className="h-2 w-2 rounded-full bg-red-500 animate-pulse"></div>
              {error}
            </div>}

            <div className="space-y-6">
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-[var(--text-3)] mb-2 block">Назва вакансії *</label>
                <input value={form.title} onChange={e => setForm(f => ({...f, title: e.target.value}))}
                  className="w-full bg-[var(--bg-base)] border border-[var(--border)] rounded-xl px-4 py-3 text-sm outline-none focus:border-indigo-600 transition-all font-medium"
                  placeholder="Наприклад: Старша швея (трикотаж)" />
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-[var(--text-3)] mb-2 block">Статус</label>
                  <select value={form.status} onChange={e => setForm(f => ({...f, status: e.target.value}))}
                    className="w-full bg-[var(--bg-base)] border border-[var(--border)] rounded-xl px-4 py-3 text-sm outline-none focus:border-indigo-600 transition-all font-medium">
                    <option value="active" className="bg-[var(--bg-card)]">Активна</option>
                    <option value="closed" className="bg-[var(--bg-card)]">Закрита</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-[var(--text-3)] mb-2 block">Опис вакансії</label>
                <textarea value={form.description} onChange={e => setForm(f => ({...f, description: e.target.value}))}
                  rows={3}
                  className="w-full bg-[var(--bg-base)] border border-[var(--border)] rounded-xl px-4 py-3 text-sm outline-none focus:border-indigo-600 transition-all font-medium resize-none text-[var(--text-2)]"
                  placeholder="Короткий опис ролі та завдань..." />
              </div>

              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-[var(--text-3)] mb-2 block">Вимоги (кожна з нового рядка)</label>
                <textarea value={form.requirements} onChange={e => setForm(f => ({...f, requirements: e.target.value}))}
                  rows={4}
                  className="w-full bg-[var(--bg-base)] border border-[var(--border)] rounded-xl px-4 py-3 text-sm outline-none focus:border-indigo-600 transition-all font-medium resize-none text-[var(--text-2)]"
                  placeholder="Досвід від 2 років&#10;Знання промислового обладнання&#10;Охайність" />
              </div>

              <div className="flex gap-4 pt-4">
                <button onClick={() => setShowModal(false)}
                  className="flex-1 bg-[var(--bg-card2)] hover:bg-[var(--bg-base)] py-4 rounded-xl text-xs font-black uppercase tracking-widest border border-[var(--border)] transition-all">
                  Скасувати
                </button>
                <button onClick={handleSave} disabled={saving || !form.title}
                  className="flex-[2] bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 py-4 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center justify-center gap-3 shadow-xl shadow-indigo-600/20 text-white">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                  {editingId ? 'Оновити вакансію' : 'Створити вакансію'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
