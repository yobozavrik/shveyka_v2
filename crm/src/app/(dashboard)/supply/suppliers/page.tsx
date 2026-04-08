'use client';

import { useState, useEffect, useCallback } from 'react';
import { 
  Plus, Search, Loader2, Users2, X, Phone, Mail, MapPin, Edit3, Trash2
} from 'lucide-react';

interface Supplier {
  id: number;
  name: string;
  contact_person: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  notes: string | null;
}

const EMPTY_FORM = {
  name: '',
  contact_person: '',
  phone: '',
  email: '',
  address: '',
  notes: ''
};

export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/warehouse/suppliers');
      const data = await res.json();
      if (Array.isArray(data)) setSuppliers(data);
    } catch (e) {
      console.error('Failed to load suppliers:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSave = async () => {
    if (!form.name) return;
    setSaving(true);
    setError('');
    try {
      const res = await fetch('/api/warehouse/suppliers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save');
      setShowModal(false);
      setForm(EMPTY_FORM);
      load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const filtered = suppliers.filter(s => 
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    (s.contact_person && s.contact_person.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="flex gap-6 h-full border-t border-transparent">
      <div className="flex-1 bg-[var(--bg-card)] border border-[var(--border)] rounded-[24px] shadow-sm flex flex-col overflow-hidden">
        
        <div className="p-4 border-b border-[var(--border)] flex items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md group">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--text-3)] group-focus-within:text-indigo-500 transition-colors" />
            <input 
              type="text" 
              placeholder="Пошук постачальника..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full bg-[var(--bg-card2)] border border-transparent rounded-2xl pl-11 pr-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500/30 transition-all font-medium"
            />
          </div>
          <button 
            onClick={() => { setForm(EMPTY_FORM); setShowModal(true); }}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-5 py-2.5 rounded-xl font-bold shadow-lg shadow-emerald-500/20 transition-all active:scale-95 text-sm"
          >
            <Plus className="h-4 w-4" /> Додати постачальника
          </button>
        </div>

        <div className="flex-1 overflow-auto custom-scrollbar">
          {loading ? (
            <div className="h-full flex flex-col items-center justify-center text-[var(--text-3)]">
              <Loader2 className="h-10 w-10 animate-spin text-indigo-500 mb-4" />
              <p className="font-bold">Завантаження...</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-[var(--text-3)] py-12">
              <Users2 className="h-16 w-16 mb-4 opacity-10" />
              <p className="text-lg font-bold italic">Постачальників не знайдено</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-6">
              {filtered.map(supplier => (
                <div 
                  key={supplier.id} 
                  className="border border-[var(--border)] bg-[var(--bg-base)] p-5 rounded-2xl shadow-sm hover:shadow-md transition-shadow"
                >
                  <div className="flex justify-between items-start mb-4">
                    <div className="p-3 bg-emerald-500/10 rounded-xl border border-emerald-500/20">
                      <Users2 className="h-5 w-5 text-emerald-600" />
                    </div>
                  </div>
                  
                  <h3 className="font-black text-lg text-[var(--text-1)] mb-2">{supplier.name}</h3>
                  
                  {supplier.contact_person && (
                    <p className="text-sm text-[var(--text-2)] mb-3">{supplier.contact_person}</p>
                  )}
                  
                  <div className="space-y-2 text-xs text-[var(--text-3)]">
                    {supplier.phone && (
                      <div className="flex items-center gap-2">
                        <Phone className="h-3 w-3" />
                        <span>{supplier.phone}</span>
                      </div>
                    )}
                    {supplier.email && (
                      <div className="flex items-center gap-2">
                        <Mail className="h-3 w-3" />
                        <span>{supplier.email}</span>
                      </div>
                    )}
                    {supplier.address && (
                      <div className="flex items-center gap-2">
                        <MapPin className="h-3 w-3" />
                        <span>{supplier.address}</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-md p-4 animate-in fade-in zoom-in duration-300">
          <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-[32px] p-8 w-full max-w-lg shadow-2xl space-y-6 overflow-auto max-h-[90vh] custom-scrollbar">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-2xl font-black text-[var(--text-1)]">Новий постачальник</h3>
                <p className="text-[var(--text-3)] text-xs font-medium">Додавання контрагента</p>
              </div>
              <button onClick={() => setShowModal(false)} className="p-2 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-500 rounded-2xl transition-all">
                <X className="h-6 w-6" />
              </button>
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/20 px-4 py-3 rounded-2xl flex items-center gap-3 text-red-500 text-sm font-bold italic">
                <span>{error}</span>
              </div>
            )}

            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] text-[var(--text-3)] font-black uppercase tracking-tighter ml-1">Назва *</label>
                <input 
                  value={form.name} 
                  onChange={e => setForm(f => ({...f, name: e.target.value}))}
                  className="w-full bg-[var(--bg-card2)] border border-[var(--border)] rounded-2xl px-4 py-3 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 transition-all font-bold"
                  placeholder="ТОВ 'Тканини-Опт'" 
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] text-[var(--text-3)] font-black uppercase tracking-tighter ml-1">Контактна особа</label>
                <input 
                  value={form.contact_person} 
                  onChange={e => setForm(f => ({...f, contact_person: e.target.value}))}
                  className="w-full bg-[var(--bg-card2)] border border-[var(--border)] rounded-2xl px-4 py-3 text-sm outline-none focus:border-indigo-500 transition-all"
                  placeholder="Іванов Іван" 
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] text-[var(--text-3)] font-black uppercase tracking-tighter ml-1">Телефон</label>
                  <input 
                    value={form.phone} 
                    onChange={e => setForm(f => ({...f, phone: e.target.value}))}
                    className="w-full bg-[var(--bg-card2)] border border-[var(--border)] rounded-2xl px-4 py-3 text-sm outline-none focus:border-indigo-500 transition-all"
                    placeholder="+380..." 
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] text-[var(--text-3)] font-black uppercase tracking-tighter ml-1">Email</label>
                  <input 
                    type="email"
                    value={form.email} 
                    onChange={e => setForm(f => ({...f, email: e.target.value}))}
                    className="w-full bg-[var(--bg-card2)] border border-[var(--border)] rounded-2xl px-4 py-3 text-sm outline-none focus:border-indigo-500 transition-all"
                    placeholder="email@example.com" 
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] text-[var(--text-3)] font-black uppercase tracking-tighter ml-1">Адреса</label>
                <input 
                  value={form.address} 
                  onChange={e => setForm(f => ({...f, address: e.target.value}))}
                  className="w-full bg-[var(--bg-card2)] border border-[var(--border)] rounded-2xl px-4 py-3 text-sm outline-none focus:border-indigo-500 transition-all"
                  placeholder="м. Київ, вул. ..." 
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] text-[var(--text-3)] font-black uppercase tracking-tighter ml-1">Примітки</label>
                <textarea 
                  value={form.notes} 
                  onChange={e => setForm(f => ({...f, notes: e.target.value}))}
                  rows={3}
                  className="w-full bg-[var(--bg-card2)] border border-[var(--border)] rounded-2xl px-4 py-3 text-sm outline-none focus:border-indigo-500 transition-all resize-none"
                  placeholder="Додаткова інформація..." 
                />
              </div>
            </div>

            <div className="flex gap-4 pt-4">
              <button 
                onClick={() => setShowModal(false)}
                className="flex-[1] bg-[var(--bg-base)] border border-[var(--border)] hover:bg-[var(--bg-card2)] py-4 rounded-[20px] text-sm font-black transition-all"
              >
                Скасувати
              </button>
              <button 
                onClick={handleSave} 
                disabled={saving || !form.name}
                className="flex-[3] bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white py-4 rounded-[20px] text-sm font-black transition-all flex items-center justify-center gap-3"
              >
                {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : <Plus className="h-5 w-5" />}
                Зберегти
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: var(--border); border-radius: 10px; }
      `}</style>
    </div>
  );
}
