'use client';

import { useState, useEffect } from 'react';
import {
  CircleDollarSign,
  Download,
  ChevronRight,
  ChevronDown,
  Loader2,
} from 'lucide-react';

export default function PayrollPage() {
  const [payroll, setPayroll] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState({
    start: new Date(new Date().setDate(1)).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0]
  });
  const [expandedId, setExpandedId] = useState<number | null>(null);

  useEffect(() => {
    fetchPayroll();
  }, [range]);

  const fetchPayroll = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/payroll?startDate=${range.start}&endDate=${range.end}`);
      const data = await res.json();
      setPayroll(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const totalSum = payroll.reduce((acc, curr) => acc + curr.total, 0);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <CircleDollarSign className="h-8 w-8 text-green-500" />
            Розрахунок зарплати
          </h1>
          <p className="text-[var(--text-2)]">Нарахування за відрядною формою оплати</p>
        </div>
        <div className="flex gap-3">
          <button className="bg-[var(--bg-card)] hover:bg-black/8 dark:hover:bg-white/8 text-[var(--text-1)] px-4 py-2 rounded-lg flex items-center gap-2 transition-all">
            <Download className="h-4 w-4" />
            Експорт XLS
          </button>
        </div>
      </div>

      {/* Stats & Filters */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
         <div className="lg:col-span-1 bg-[var(--bg-card)] border border-[var(--border)] p-6 rounded-2xl flex flex-col justify-between">
            <div className="space-y-4">
               <div>
                  <label className="text-[10px] font-black text-[var(--text-2)] uppercase">З дати</label>
                  <input 
                    type="date"
                    className="w-full bg-[var(--bg-card)] border-none rounded-lg p-2 mt-1 text-sm text-[var(--text-1)]"
                    value={range.start}
                    onChange={(e) => setRange({...range, start: e.target.value})}
                  />
               </div>
               <div>
                  <label className="text-[10px] font-black text-[var(--text-2)] uppercase">По дату</label>
                  <input 
                    type="date"
                    className="w-full bg-[var(--bg-card)] border-none rounded-lg p-2 mt-1 text-sm text-[var(--text-1)]"
                    value={range.end}
                    onChange={(e) => setRange({...range, end: e.target.value})}
                  />
               </div>
            </div>
            <div className="mt-8 pt-6 border-t border-[var(--border)]">
               <div className="text-[var(--text-2)] text-xs font-bold uppercase mb-1">Фонд оплати праці</div>
               <div className="text-3xl font-black text-green-500">{totalSum.toLocaleString()} ₴</div>
            </div>
         </div>

         <div className="lg:col-span-3 bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
               <table className="w-full text-left text-sm">
                  <thead className="bg-black/5 dark:bg-white/5 text-[var(--text-2)] font-medium">
                     <tr>
                        <th className="px-6 py-4">Співробітник</th>
                        <th className="px-6 py-4 text-center">Записів</th>
                        <th className="px-6 py-4 text-right">Сума нарахована</th>
                        <th className="px-6 py-4 w-10"></th>
                     </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                     {loading ? (
                        <tr>
                           <td colSpan={4} className="px-6 py-12 text-center">
                              <Loader2 className="h-8 w-8 animate-spin mx-auto text-indigo-500" />
                           </td>
                        </tr>
                     ) : payroll.length === 0 ? (
                        <tr>
                           <td colSpan={4} className="px-6 py-12 text-center text-[var(--text-2)] italic">
                              Немає підтверджених нарахувань за цей період
                           </td>
                        </tr>
                     ) : payroll.map((row) => (
                        <>
                           <tr 
                              key={row.id} 
                              className={`hover:bg-black/5 dark:bg-white/5 transition-colors cursor-pointer ${expandedId === row.id ? 'bg-black/5 dark:bg-white/5' : ''}`}
                              onClick={() => setExpandedId(expandedId === row.id ? null : row.id)}
                           >
                              <td className="px-6 py-4 font-bold">{row.full_name}</td>
                              <td className="px-6 py-4 text-center text-[var(--text-2)]">{row.count}</td>
                              <td className="px-6 py-4 text-right">
                                 <span className="text-lg font-black">{row.total.toLocaleString()} ₴</span>
                              </td>
                              <td className="px-6 py-4 text-[var(--text-2)]">
                                 {expandedId === row.id ? <ChevronDown /> : <ChevronRight />}
                              </td>
                           </tr>
                           {expandedId === row.id && (
                              <tr className="bg-[var(--bg-base)]/50 shadow-inner">
                                 <td colSpan={4} className="px-6 py-4 border-l-4 border-indigo-600">
                                    <div className="space-y-2">
                                       <div className="text-[10px] font-black text-[var(--text-3)] uppercase mb-2">Деталізація операцій</div>
                                       {Array.isArray(row.entries) ? row.entries.map((ent: any) => (
                                          <div key={ent.id} className="flex justify-between items-center text-xs py-1">
                                             <div className="flex gap-4">
                                                <span className="text-[var(--text-2)] w-12">{new Date(ent.created_at).toLocaleDateString('uk-UA')}</span>
                                                <span className="text-[var(--text-1)] font-medium">{ent.operations.name}</span>
                                             </div>
                                             <div className="flex gap-4">
                                                <span className="text-[var(--text-2)]">{ent.quantity} шт × {ent.operations.base_rate}</span>
                                                <span className="font-bold">{ent.amount.toFixed(2)} ₴</span>
                                             </div>
                                          </div>
                                        )) : (
                                          <div className="text-xs text-[var(--text-2)] italic">Деталізація недоступна</div>
                                        )}
                                    </div>
                                 </td>
                              </tr>
                           )}
                        </>
                     ))}
                  </tbody>
               </table>
            </div>
         </div>
      </div>
    </div>
  );
}
