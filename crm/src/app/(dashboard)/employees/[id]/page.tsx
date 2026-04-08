'use client';

import { useState, useEffect, useCallback, use, FormEvent } from 'react';
import { 
  User, ArrowLeft, Calendar, DollarSign, AlertTriangle, 
  BarChart3, Loader2, Plus, X, CheckCircle2, 
  TrendingUp, Clock, Plane, Stethoscope, Heart 
} from 'lucide-react';
import Link from 'next/link';

type Stats = {
  employee: {
    id: number;
    full_name: string;
    position: string;
    phone: string;
    status: string;
    payment_type: string;
    department: string;
    hire_date: string;
    birth_date?: string;
    family_info?: string;
    address?: string;
    skill_level?: number;
    individual_coefficient?: number;
    supervisor?: { full_name: string };
  };
  total_entries: number;
  total_quantity: number;
  total_earned: number;
  total_defects: number;
  ptm_rate: number;
  efficiency_index: number;
  earned_minutes: number;
  worked_minutes: number;
  payroll_history: any[];
};

type Entry = {
  id: number;
  quantity: number;
  size: string | null;
  status: string;
  entry_date: string;
  operations: { name: string } | null;
  production_batches: { batch_number: string } | null;
};

type Absence = {
  id: number;
  type: string;
  start_date: string;
  end_date: string;
  status: string;
  notes: string;
};

type PositionOption = {
  id: number;
  name: string;
  is_active: boolean;
  sort_order: number;
};

function fmt(n: number) { return (n || 0).toLocaleString('uk-UA'); }

export default function EmployeeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [stats, setStats] = useState<Stats | null>(null);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [absences, setAbsences] = useState<Absence[]>([]);
  const [positions, setPositions] = useState<PositionOption[]>([]);
  const [trend, setTrend] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'personal' | 'analysis' | 'absences' | 'payroll'>('personal');
  const [showAbsenceModal, setShowAbsenceModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [statsRes, entriesRes, absencesRes, trendRes] = await Promise.all([
        fetch(`/api/analytics/employees/${id}/stats`),
        fetch(`/api/entries?employee_id=${id}&status=all&limit=50`),
        fetch(`/api/employees/${id}/absences`),
        fetch(`/api/analytics/production-trend?days=30&employee_id=${id}`)
      ]);
      if (statsRes.ok) setStats(await statsRes.json());
      if (entriesRes.ok) setEntries(await entriesRes.json());
      if (absencesRes.ok) setAbsences(await absencesRes.json());
      if (trendRes.ok) setTrend(await trendRes.json());
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [id]);

  const fetchPositions = useCallback(async () => {
    try {
      const res = await fetch('/api/positions', { cache: 'no-store' });
      const json = await res.json();
      if (res.ok && Array.isArray(json)) {
        setPositions(json);
      }
    } catch (error) {
      console.error(error);
    }
  }, []);

  useEffect(() => {
    fetchData();
    fetchPositions();
  }, [fetchData, fetchPositions]);

  if (loading && !stats) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="p-6">
        <p className="text-red-400 font-bold">Співробітника не знайдено</p>
        <Link href="/employees" className="text-indigo-400 hover:underline mt-2 inline-block">← До списку</Link>
      </div>
    );
  }

  const emp = stats.employee;

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <Link href="/employees" className="text-xs font-black uppercase tracking-widest text-indigo-400 hover:text-indigo-300 flex items-center gap-1 mb-4">
            <ArrowLeft className="h-3.5 w-3.5" /> Назад до списку
          </Link>
          <div className="flex items-center gap-5">
            <div className="h-16 w-16 bg-gradient-to-br from-indigo-500 to-indigo-700 rounded-3xl flex items-center justify-center shadow-xl shadow-indigo-600/20">
              <User className="h-8 w-8 text-white" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-3">
                 <h1 className="text-3xl font-black text-white tracking-tight">{emp.full_name}</h1>
                 <button onClick={() => setShowEditModal(true)} className="p-2 rounded-xl bg-white/5 border border-white/10 text-white/60 hover:text-indigo-400 transition-all">
                   <Plus className="h-4 w-4 rotate-45" />
                 </button>
              </div>
              <p className="text-sm font-black text-indigo-400 uppercase tracking-widest mt-1">{emp.position || 'Посада не вказана'}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <StatCard label="Записів" value={stats.total_entries} icon={CheckCircle2} color="indigo" />
        <StatCard label="Випущено (од)" value={stats.total_quantity} icon={BarChart3} color="blue" />
        <StatCard label="Зароблено" value={`₴ ${fmt(stats.total_earned)}`} icon={DollarSign} color="emerald" />
        <StatCard label="Ефективність (EI)" value={`${stats.efficiency_index || '0'}%`} icon={TrendingUp} color={(stats.efficiency_index || 0) > 90 ? 'emerald' : 'amber'} />
        <StatCard label="ПТМ (Брак %)" value={`${stats.ptm_rate || '0.0'}%`} icon={AlertTriangle} color={(stats.ptm_rate || 0) > 3 ? 'rose' : 'amber'} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="flex gap-1 bg-white/5 p-1.5 rounded-2xl w-fit border border-white/10 overflow-x-auto">
            {(['personal', 'analysis', 'payroll', 'absences'] as const).map((t) => (
              <button key={t} onClick={() => setTab(t)}
                className={`px-6 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all whitespace-nowrap ${tab === t ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' : 'text-white/60 hover:text-white'}`}>
                {t === 'personal' ? 'Профіль' : t === 'analysis' ? 'Аналіз' : t === 'payroll' ? 'Зарплата' : 'Відпустки'}
              </button>
            ))}
          </div>

          <div className="bg-white/5 border border-white/10 rounded-3xl overflow-hidden min-h-[400px]">
             {tab === 'personal' && (
                <div className="p-8 space-y-10">
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                      <div className="space-y-6">
                        <h4 className="text-[10px] font-black uppercase tracking-widest text-white/40">Контактна інформація</h4>
                        <div className="space-y-4 text-sm">
                           <InfoRow label="Телефон" value={emp.phone || '—'} />
                           <InfoRow label="Дата народження" value={emp.birth_date ? new Date(emp.birth_date).toLocaleDateString() : '—'} />
                           <InfoRow label="Дата прийому" value={emp.hire_date ? new Date(emp.hire_date).toLocaleDateString() : '—'} />
                           <InfoRow label="Тип оплати" value={emp.payment_type === 'piecework' ? 'Відрядна' : 'Ставка'} highlight />
                           <InfoRow label="Адреса" value={emp.address || '—'} />
                        </div>
                      </div>
                      <div className="space-y-6">
                        <h4 className="text-[10px] font-black uppercase tracking-widest text-white/40">Робочі показники</h4>
                        <div className="space-y-4 text-sm">
                           <InfoRow label="Розряд" value={emp.skill_level ? `${emp.skill_level} разряд` : '—'} color="text-indigo-400" />
                           <InfoRow label="Коефіцієнт (КТУ)" value={`x${emp.individual_coefficient || '1.0'}`} color="text-emerald-400" />
                           <InfoRow label="Майстер" value={(emp as any).supervisor?.full_name || '—'} />
                        </div>
                        <div className="mt-8 p-6 bg-white/5 rounded-2xl border border-white/5">
                           <h5 className="text-[10px] font-black uppercase tracking-widest text-white/40 mb-2">Склад сім'ї</h5>
                           <p className="text-sm text-white/80 italic">"{emp.family_info || 'Інформація відсутня'}"</p>
                        </div>
                      </div>
                   </div>
                </div>
             )}

             {tab === 'analysis' && (
                <div className="p-0">
                   <div className="p-8 border-b border-white/10">
                      <h4 className="text-[10px] font-black uppercase tracking-widest text-white/40 mb-8">Продуктивність (30 днів)</h4>
                      <div className="h-48 flex items-end gap-1 px-4">
                        {trend.map((d, i) => (
                           <div key={i} className="flex-1 bg-indigo-500/40 hover:bg-indigo-500 transition-all rounded-t-sm" style={{ height: `${(d.confirmed_units / (Math.max(...trend.map(x=>x.confirmed_units), 1))) * 100}%` }} />
                        ))}
                      </div>
                   </div>
                   <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                         <thead className="bg-white/5 text-white/40 uppercase font-black tracking-widest">
                            <tr>
                               <th className="px-6 py-4">Дата</th>
                               <th className="px-6 py-4">Операція</th>
                               <th className="px-6 py-4 text-center">К-сть</th>
                               <th className="px-6 py-4 text-center">Статус</th>
                            </tr>
                         </thead>
                         <tbody className="divide-y divide-white/5">
                            {entries.map(e => (
                               <tr key={e.id} className="hover:bg-white/5">
                                  <td className="px-6 py-4 font-bold">{new Date(e.entry_date).toLocaleDateString()}</td>
                                  <td className="px-6 py-4 font-black">{e.operations?.name || '—'}</td>
                                  <td className="px-6 py-4 text-center font-black text-sm">{e.quantity}</td>
                                  <td className="px-6 py-4 text-center">
                                     <span className="px-2 py-1 rounded bg-white/10 font-bold uppercase text-[9px]">{e.status}</span>
                                  </td>
                               </tr>
                            ))}
                         </tbody>
                      </table>
                   </div>
                </div>
             )}

             {tab === 'payroll' && (
                <div className="p-8 space-y-6">
                   <div className="flex justify-between items-center mb-4">
                      <h4 className="text-[10px] font-black uppercase tracking-widest text-white/40">Історія виплат</h4>
                      <div className="text-xs font-black text-emerald-400">Баланс: ₴ {fmt(stats.total_earned)}</div>
                   </div>
                   <div className="space-y-4">
                      {stats.payroll_history?.map(p => (
                         <div key={p.id} className="p-6 bg-white/5 rounded-3xl border border-white/5 flex justify-between items-center">
                            <div>
                               <div className="text-sm font-black uppercase">{p.payroll_periods?.period_name}</div>
                               <div className="text-[10px] text-white/40 uppercase mt-1">{new Date(p.created_at).toLocaleDateString()}</div>
                            </div>
                            <div className="text-xl font-black text-emerald-400">₴ {fmt(p.total_amount)}</div>
                         </div>
                      )) || <div className="text-center py-12 text-white/20">Немає записів</div>}
                   </div>
                </div>
             )}

             {tab === 'absences' && (
                <div className="p-8 space-y-6">
                   <div className="flex justify-between items-center">
                      <h4 className="text-[10px] font-black uppercase tracking-widest text-white/40">Відсутності</h4>
                      <button onClick={() => setShowAbsenceModal(true)} className="text-[10px] font-black uppercase text-indigo-400">+ Додати</button>
                   </div>
                   <div className="space-y-3">
                      {absences.map(a => (
                         <div key={a.id} className="p-4 bg-white/5 rounded-2xl border border-white/5 flex justify-between items-center">
                            <div>
                               <div className="text-xs font-bold uppercase">{a.type}</div>
                               <div className="text-[10px] text-white/40">{a.start_date} - {a.end_date}</div>
                            </div>
                            <div className="text-[10px] text-white/60 italic">{a.notes}</div>
                         </div>
                      ))}
                   </div>
                </div>
             )}
          </div>
        </div>

        <div className="space-y-6">
           <div className="bg-white/5 p-6 rounded-3xl border border-white/10">
              <h3 className="text-[10px] font-black uppercase tracking-widest text-white/40 mb-4">Остання активність</h3>
              <div className="space-y-4">
                 <div>
                    <div className="text-[10px] text-white/40 uppercase">Дільниця</div>
                    <div className="text-sm font-black text-white">{emp.department || '—'}</div>
                 </div>
                 <div>
                    <div className="text-[10px] text-white/40 uppercase">Остання операція</div>
                    <div className="text-sm font-black text-white">{entries[0]?.operations?.name || '—'}</div>
                 </div>
              </div>
           </div>
           <div className="bg-indigo-600/10 p-6 rounded-3xl border border-indigo-500/20">
              <h3 className="text-[10px] font-black uppercase tracking-widest text-indigo-400 mb-2">Кваліфікація</h3>
              <p className="text-xs text-white/80 leading-relaxed">Пройшов навчання по роботі з оверлоком (Березень 2026).</p>
           </div>
        </div>
      </div>

      {showAbsenceModal && (
        <AbsenceModal 
          onClose={() => setShowAbsenceModal(false)} 
          onSaved={() => { fetchData(); setShowAbsenceModal(false); }} 
          empId={parseInt(id)} 
        />
      )}

      {showEditModal && (
        <EditEmployeeModal 
          onClose={() => setShowEditModal(false)} 
          onSaved={() => { fetchData(); setShowEditModal(false); }} 
          employee={emp}
          positions={positions}
        />
      )}
    </div>
  );
}

function InfoRow({ label, value, highlight, color }: any) {
  return (
    <div className="flex justify-between border-b border-white/5 pb-2 items-center">
       <span className="text-white/40 font-medium">{label}</span>
       <span className={`font-black ${color || 'text-white'} ${highlight ? 'text-indigo-400' : ''}`}>{value}</span>
    </div>
  );
}

function StatCard({ label, value, icon: Icon, color }: any) {
  const colors: any = {
    indigo: 'text-indigo-400 bg-indigo-500/10',
    blue: 'text-blue-400 bg-blue-500/10',
    emerald: 'text-emerald-400 bg-emerald-500/10',
    amber: 'text-amber-400 bg-amber-500/10',
    rose: 'text-rose-400 bg-rose-500/10',
  };
  return (
    <div className="bg-white/5 p-5 rounded-3xl border border-white/10 flex items-start justify-between">
      <div className="space-y-1">
        <p className="text-[10px] font-black uppercase tracking-widest text-white/40">{label}</p>
        <h3 className="text-2xl font-black text-white">{value}</h3>
      </div>
      <div className={`p-2.5 rounded-xl ${colors[color]}`}>
        <Icon className="h-5 w-5" />
      </div>
    </div>
  );
}

function AbsenceModal({ onClose, onSaved, empId }: any) {
  const [form, setForm] = useState({ type: 'vacation', start_date: '', end_date: '', notes: '' });
  const [loading, setLoading] = useState(false);
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await fetch(`/api/employees/${empId}/absences`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });
      onSaved();
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="bg-[#111] w-full max-w-md rounded-[2.5rem] border border-white/10 p-8 space-y-6 shadow-2xl">
         <div className="flex justify-between items-center">
            <h3 className="text-xl font-black text-white uppercase tracking-tight">Додати відсутність</h3>
            <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-full text-white/40"><X size={20}/></button>
         </div>
         <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-2 gap-2">
               {['vacation', 'sick', 'other'].map(t => (
                  <button key={t} type="button" onClick={() => setForm({...form, type: t})}
                    className={`py-3 rounded-2xl text-[10px] font-black uppercase transition-all border ${form.type === t ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-transparent text-white/40 border-white/5'}`}>{t}</button>
               ))}
            </div>
            <div className="grid grid-cols-2 gap-4">
               <input type="date" value={form.start_date} onChange={(e) => setForm({...form, start_date: e.target.value})} className="bg-white/5 border-white/10 rounded-xl px-4 py-2 text-sm text-white" required />
               <input type="date" value={form.end_date} onChange={(e) => setForm({...form, end_date: e.target.value})} className="bg-white/5 border-white/10 rounded-xl px-4 py-2 text-sm text-white" required />
            </div>
            <textarea value={form.notes} onChange={(e) => setForm({...form, notes: e.target.value})} placeholder="Примітка..." className="w-full bg-white/5 border-white/10 rounded-xl px-4 py-2 text-sm text-white h-20 resize-none" />
            <button type="submit" disabled={loading} className="w-full py-4 bg-indigo-600 rounded-2xl text-white font-black uppercase tracking-widest">{loading ? '...' : 'Зберегти'}</button>
         </form>
      </div>
    </div>
  );
}

function EditEmployeeModal({ onClose, onSaved, employee, positions }: any) {
  const [form, setForm] = useState({ full_name: employee.full_name, position: employee.position || '', phone: employee.phone || '', address: employee.address || '' });
  const [loading, setLoading] = useState(false);
  const activePositionOptions = Array.isArray(positions)
    ? positions.filter((position: PositionOption) => position.is_active)
    : [];
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await fetch(`/api/employees`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, id: employee.id })
      });
      onSaved();
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="bg-[#111] w-full max-w-2xl rounded-[3rem] border border-white/10 p-10 space-y-8 shadow-2xl">
         <div className="flex justify-between items-center">
            <h3 className="text-2xl font-black text-white uppercase tracking-tight">Редагувати профіль</h3>
            <button onClick={onClose} className="p-3 hover:bg-white/5 rounded-full text-white/40"><X size={24}/></button>
         </div>
         <form onSubmit={handleSubmit} className="space-y-6">
            <input value={form.full_name} onChange={e => setForm({...form, full_name: e.target.value})} placeholder="ПІБ" className="w-full bg-white/5 border-white/10 rounded-2xl px-5 py-3 text-white" required />
            <select value={form.position} onChange={e => setForm({...form, position: e.target.value})} className="w-full bg-white/5 border-white/10 rounded-2xl px-5 py-3 text-white" required>
              <option value="">Оберіть посаду</option>
              {activePositionOptions.map((position: PositionOption) => (
                <option key={position.id} value={position.name}>{position.name}</option>
              ))}
            </select>
            <input value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} placeholder="Телефон" className="w-full bg-white/5 border-white/10 rounded-2xl px-5 py-3 text-white" />
            <input value={form.address} onChange={e => setForm({...form, address: e.target.value})} placeholder="Адреса" className="w-full bg-white/5 border-white/10 rounded-2xl px-5 py-3 text-white" />
            <button type="submit" disabled={loading} className="w-full py-4 bg-indigo-600 rounded-2xl text-white font-black uppercase">{loading ? '...' : 'Оновити'}</button>
         </form>
      </div>
    </div>
  );
}
