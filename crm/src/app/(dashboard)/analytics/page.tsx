'use client';

import { useState, useEffect } from 'react';
import { BarChart3, Loader2, TrendingUp, Users, Package, CheckCircle2, DollarSign, Clock } from 'lucide-react';

interface Analytics {
  period: string;
  summary: {
    active_batches: number;
    total_batch_qty: number;
    active_employees: number;
    entries_count: number;
    confirmed_qty: number;
    total_earnings: number;
    pending_approvals: number;
  };
  daily: { date: string; qty: number; count: number }[];
  top_workers: { employee_id: number; full_name: string; qty: number; count: number }[];
  batches_by_status: Record<string, number>;
}

const STATUS_LABELS: Record<string, string> = {
  created: 'Нові', cutting: 'Розкрій', sewing: 'Пошив', ready: 'Готові', shipped: 'Відвантажено'
};

export default function AnalyticsPage() {
  const [data, setData] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('week');

  useEffect(() => { load(); }, [period]);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch(`/api/analytics/dashboard?period=${period}`);
      setData(await res.json());
    } finally { setLoading(false); }
  }

  const maxDailyQty = data ? Math.max(...data.daily.map(d => d.qty), 1) : 1;

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-black flex items-center gap-3">
            <BarChart3 className="h-7 w-7 text-indigo-500" />
            Аналітика
          </h1>
          <p className="text-[var(--text-2)] text-sm mt-1">Статистика виробництва та зарплата</p>
        </div>
        <div className="flex bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-1 gap-1">
          {[{ v: 'today', l: 'Сьогодні' }, { v: 'week', l: 'Тиждень' }, { v: 'month', l: 'Місяць' }].map(p => (
            <button key={p.v} onClick={() => setPeriod(p.v)}
              className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors ${period === p.v ? 'bg-indigo-600 text-[var(--text-1)]' : 'text-[var(--text-2)] hover:text-[var(--text-1)]'}`}>
              {p.l}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-indigo-500" /></div>
      ) : data ? (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: 'Активних партій', value: data.summary.active_batches, icon: Package, color: 'text-amber-400', bg: 'bg-amber-500/10' },
              { label: 'Активних швачок', value: data.summary.active_employees, icon: Users, color: 'text-sky-400', bg: 'bg-sky-500/10' },
              { label: 'Підтверджено шт', value: data.summary.confirmed_qty.toLocaleString(), icon: CheckCircle2, color: 'text-green-400', bg: 'bg-green-500/10' },
              { label: 'Нараховано, грн', value: data.summary.total_earnings.toLocaleString('uk-UA', { maximumFractionDigits: 0 }), icon: DollarSign, color: 'text-indigo-400', bg: 'bg-indigo-500/10' },
            ].map(card => (
              <div key={card.label} className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-5">
                <div className={`${card.bg} w-10 h-10 rounded-xl flex items-center justify-center mb-4`}>
                  <card.icon className={`h-5 w-5 ${card.color}`} />
                </div>
                <div className="text-2xl font-black">{card.value}</div>
                <div className="text-[var(--text-2)] text-xs mt-1 font-medium">{card.label}</div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Daily chart */}
            <div className="lg:col-span-2 bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-5">
              <h3 className="font-bold mb-4 flex items-center gap-2 text-sm">
                <TrendingUp className="h-4 w-4 text-indigo-400" />
                Динаміка виробітку (підтверджено шт/день)
              </h3>
              {data.daily.length === 0 ? (
                <div className="h-40 flex items-center justify-center text-[var(--text-3)] text-sm">Немає даних</div>
              ) : (
                <div className="flex items-end gap-1.5 h-40">
                  {data.daily.map(d => {
                    const pct = maxDailyQty > 0 ? (d.qty / maxDailyQty) * 100 : 0;
                    return (
                      <div key={d.date} className="flex-1 flex flex-col items-center gap-1 group">
                        <div className="text-[10px] text-indigo-400 font-bold opacity-0 group-hover:opacity-100 transition-opacity">{d.qty}</div>
                        <div
                          className="w-full bg-indigo-600/30 hover:bg-indigo-500/50 rounded-t transition-colors relative"
                          style={{ height: `${Math.max(pct, 2)}%` }}
                        />
                        <div className="text-[9px] text-[var(--text-2)] truncate w-full text-center">
                          {new Date(d.date + 'T12:00:00').toLocaleDateString('uk-UA', { day: 'numeric', month: 'short' })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Right column */}
            <div className="space-y-4">
              {/* By status */}
              <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-5">
                <h3 className="font-bold mb-3 text-sm flex items-center gap-2">
                  <Package className="h-4 w-4 text-amber-400" />
                  Партії за статусами
                </h3>
                <div className="space-y-2">
                  {Object.entries(data.batches_by_status).map(([status, count]) => (
                    <div key={status} className="flex items-center justify-between text-sm">
                      <span className="text-[var(--text-2)]">{STATUS_LABELS[status] || status}</span>
                      <span className="font-bold">{count}</span>
                    </div>
                  ))}
                  {Object.keys(data.batches_by_status).length === 0 && (
                    <p className="text-[var(--text-3)] text-xs">Немає даних</p>
                  )}
                </div>
              </div>

              {/* Pending */}
              {data.summary.pending_approvals > 0 && (
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4">
                  <div className="flex items-center gap-2 text-amber-400">
                    <Clock className="h-4 w-4" />
                    <span className="font-bold text-sm">{data.summary.pending_approvals} очікує підтвердження</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Top workers */}
          {data.top_workers.length > 0 && (
            <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-5">
              <h3 className="font-bold mb-4 text-sm flex items-center gap-2">
                <Users className="h-4 w-4 text-sky-400" />
                Топ швачок за виробітком
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-[var(--text-2)] text-xs">
                    <tr>
                      <th className="pb-2 text-left">#</th>
                      <th className="pb-2 text-left">Швачка</th>
                      <th className="pb-2 text-right">Кількість шт</th>
                      <th className="pb-2 text-right">Записів</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/50">
                    {data.top_workers.map((w, i) => (
                      <tr key={w.employee_id}>
                        <td className="py-2 text-[var(--text-2)] font-mono text-xs">{i + 1}</td>
                        <td className="py-2 font-medium">{w.full_name}</td>
                        <td className="py-2 text-right font-black text-indigo-300">{w.qty.toLocaleString()}</td>
                        <td className="py-2 text-right text-[var(--text-2)]">{w.count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      ) : null}
    </div>
  );
}
