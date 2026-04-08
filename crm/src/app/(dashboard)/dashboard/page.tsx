'use client';

import { useState, useEffect } from 'react';
import { Users, Package, ClipboardCheck, Zap, TrendingUp, DollarSign, Clock, ArrowRight, Activity, CheckCircle2, AlertCircle, Info } from 'lucide-react';
import Link from 'next/link';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';

interface Analytics {
  summary: {
    active_batches: number;
    active_employees: number;
    confirmed_qty: number;
    total_earnings: number;
    pending_approvals: number;
    total_batch_qty?: number;
    entries_count?: number;
  };
  daily: { date: string; qty: number; count: number }[];
  top_workers?: { employee_id: number; full_name: string; qty: number; count: number }[];
  batches_by_status: Record<string, number>;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; border: string }> = {
  created:  { label: 'Нові',           color: 'text-sky-600 dark:text-sky-400',    bg: 'bg-sky-50 dark:bg-sky-950/30',     border: 'border-sky-100 dark:border-sky-900/50' },
  cutting:  { label: 'Розкрій',        color: 'text-orange-600 dark:text-orange-400', bg: 'bg-orange-50 dark:bg-orange-950/30',  border: 'border-orange-100 dark:border-orange-900/50' },
  sewing:   { label: 'Пошив',          color: 'text-indigo-600 dark:text-indigo-400',  bg: 'bg-indigo-50 dark:bg-indigo-950/30',  border: 'border-indigo-100 dark:border-indigo-900/50' },
  ready:    { label: 'Готові',         color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-950/30', border: 'border-emerald-100 dark:border-emerald-900/50' },
  shipped:  { label: 'Відвантажено',   color: 'text-slate-600 dark:text-slate-400',  bg: 'bg-slate-50 dark:bg-slate-800',    border: 'border-slate-100 dark:border-slate-700' },
};

function KpiCard({
  icon: Icon, label, value, sub, accent, href, glow
}: {
  icon: React.ElementType; label: string; value: string | number; sub?: string;
  accent: string; href?: string; glow?: boolean;
}) {
  const inner = (
    <div className={`relative h-full bg-white border border-slate-200 rounded-2xl p-5 flex flex-col justify-between overflow-hidden transition-all duration-300 group cursor-pointer hover:shadow-lg hover:border-slate-300
      ${glow ? 'ring-2 ring-red-500/20 border-red-200 shadow-[0_0_20px_rgba(239,68,68,0.05)]' : ''}
    `}>
      <div className="flex items-start justify-between relative z-10">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${accent} bg-opacity-10`}>
          <Icon className={`h-5 w-5 ${accent.replace('bg-', 'text-')}`} />
        </div>
        {href && (
          <ArrowRight className="h-4 w-4 text-slate-300 group-hover:text-slate-600 group-hover:translate-x-0.5 transition-all" />
        )}
      </div>
      <div className="relative z-10">
        <div className="text-3xl font-black tracking-tight text-slate-900 mt-4">{value}</div>
        <div className="text-slate-500 text-xs font-bold uppercase tracking-wider mt-1">{label}</div>
        {sub && <div className="text-[10px] text-slate-400 mt-1 font-medium">{sub}</div>}
      </div>
      {/* Background decoration */}
      <Icon className={`absolute -right-4 -bottom-4 h-24 w-24 opacity-[0.03] rotate-12 group-hover:scale-110 transition-transform ${accent.replace('bg-', 'text-')}`} />
    </div>
  );
  return href ? <Link href={href} className="block h-full">{inner}</Link> : <div className="h-full">{inner}</div>;
}

function InsightsBlock({ data }: { data: Analytics }) {
  const critical = data.summary.pending_approvals > 5;
  const isGrowing = data.daily.length > 1 && data.daily[data.daily.length-1].qty > data.daily[data.daily.length-2].qty;

  return (
    <div className="bg-[var(--bg-base)] border-[var(--border)] rounded-3xl p-6 relative overflow-hidden">
      <div className="absolute top-0 right-0 p-8 bg-indigo-500/5 blur-3xl rounded-full translate-x-1/2 -translate-y-1/2"></div>
      <div className="flex items-center gap-2 mb-4">
        <Info className="h-4 w-4 text-indigo-500" />
        <h3 className="text-xs font-black uppercase tracking-widest text-[var(--text-muted)]">Зона 30: Аналіз виробництва</h3>
      </div>
      <div className="space-y-3 relative z-10">
        <p className="text-sm text-slate-700 leading-relaxed font-medium">
          {critical ? (
            <span className="text-red-600 font-bold decoration-red-200 underline underline-offset-4 decoration-2">Увага! {data.summary.pending_approvals} записів потребують підтвердження. </span>
          ) : (
            <span className="text-emerald-600 font-bold">Процес підтвердження в нормі. </span>
          )}
          На даний момент у роботі {data.summary.active_batches} активних партій. 
          {isGrowing ? ' Спостерігається позитивна динаміка виробітку в порівнянні з вчорашнім днем.' : ' Обсяги виробництва стабільні.'}
        </p>
        <div className="flex gap-2">
          {critical && (
             <Link href="/master" className="text-[10px] bg-red-600 text-white px-3 py-1.5 rounded-full font-black uppercase tracking-wider hover:bg-red-700 transition-colors">
               Терміново підтвердити
             </Link>
          )}
          <Link href="/analytics" className="text-[10px] bg-white border border-slate-200 text-slate-600 px-3 py-1.5 rounded-full font-black uppercase tracking-wider hover:border-slate-300 transition-colors">
            Детальний звіт
          </Link>
        </div>
      </div>
    </div>
  );
}

const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: { value: number }[]; label?: string }) => {
  if (active && payload?.length) {
    return (
      <div className="bg-white border border-slate-200 shadow-xl rounded-xl px-4 py-3 animate-in fade-in zoom-in duration-200">
        <div className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">{label}</div>
        <div className="text-indigo-600 font-black text-lg">{payload[0].value.toLocaleString()} <span className="text-xs font-medium text-slate-500">од.</span></div>
      </div>
    );
  }
  return null;
};

export default function DashboardPage() {
  const [data, setData] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<'today' | 'week' | 'month'>('week');

  useEffect(() => {
    setLoading(true);
    fetch(`/api/analytics/dashboard?period=${period}`)
      .then(async r => {
        if (!r.ok) {
          throw new Error(`Dashboard analytics request failed: ${r.status}`);
        }
        return r.json();
      })
      .then((payload: Analytics) => setData(payload))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [period]);

  const chartData = data?.daily?.map(d => ({
    date: new Date(d.date + 'T12:00:00').toLocaleDateString('uk-UA', { day: 'numeric', month: 'short' }),
    qty: d.qty,
  })) ?? [];

  const totalBatches = data?.batches_by_status ? Object.values(data.batches_by_status).reduce((a, b) => a + b, 0) : 0;
  const now = new Date().toLocaleDateString('uk-UA', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <div className="min-h-full space-y-8 pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-slate-100 pb-6">
        <div>
          <h1 className="text-3xl font-black tracking-tighter text-slate-900">Головна панель</h1>
          <p className="text-slate-500 text-sm font-medium mt-1 flex items-center gap-2 capitalize italic">
            <Clock className="h-3.5 w-3.5" /> {now}
          </p>
        </div>
        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl w-fit">
          {(['today', 'week', 'month'] as const).map(p => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-4 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer whitespace-nowrap ${
                period === p
                  ? 'bg-white text-indigo-600 shadow-sm'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              {p === 'today' ? 'Сьогодні' : p === 'week' ? 'Тиждень' : 'Місяць'}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-32 bg-white border border-slate-100 rounded-3xl animate-pulse" />
          ))}
        </div>
      ) : data ? (
        <div className="space-y-8">
          {/* Зона 3: KPI Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <KpiCard
              icon={Zap}
              label="Загальний виробіток"
              value={data.summary.confirmed_qty.toLocaleString()}
              sub={period === 'today' ? 'Зафіксовано сьогодні' : 'Сумарно за період'}
              accent="bg-emerald-500"
              href="/master"
            />
            <KpiCard
              icon={Package}
              label="Активні партії"
              value={data.summary.active_batches}
              sub={`У роботі з ${totalBatches} всього`}
              accent="bg-amber-500"
              href="/batches"
            />
            <KpiCard
              icon={Users}
              label="Команда в зміні"
              value={data.summary.active_employees}
              sub="Виконують операції"
              accent="bg-sky-500"
              href="/employees"
            />
            <KpiCard
              icon={ClipboardCheck}
              label="На підтвердження"
              value={data.summary.pending_approvals}
              sub="Очікують майстра"
              accent="bg-indigo-500"
              href="/master"
              glow={data.summary.pending_approvals > 0}
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-8">
              {/* Зона 30: Insights */}
              <InsightsBlock data={data} />

              {/* Зона 300: Production Dynamics Chart */}
              <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between mb-8">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-lg bg-indigo-50 flex items-center justify-center">
                       <Activity className="h-4 w-4 text-indigo-600" />
                    </div>
                    <div>
                      <h3 className="text-sm font-black text-slate-900">Динаміка виробництва</h3>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Обсяги виробітку по днях</p>
                    </div>
                  </div>
                </div>
                
                <div className="h-64">
                  {chartData.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-slate-300 gap-3">
                      <TrendingUp className="h-10 w-10 opacity-20" />
                      <p className="text-xs font-medium">Дані відсутні</p>
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <defs>
                          <linearGradient id="pdiGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.15} />
                            <stop offset="95%" stopColor="#4f46e5" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                        <XAxis 
                          dataKey="date" 
                          tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 700 }} 
                          axisLine={false} 
                          tickLine={false} 
                        />
                        <YAxis 
                          tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 700 }} 
                          axisLine={false} 
                          tickLine={false} 
                        />
                        <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f8fafc' }} />
                        <Area
                          type="monotone"
                          dataKey="qty"
                          stroke="#4f46e5"
                          strokeWidth={4}
                          fill="url(#pdiGrad)"
                          dot={{ fill: '#4f46e5', strokeWidth: 2, stroke: '#fff', r: 4 }}
                          activeDot={{ r: 6, fill: '#4f46e5', strokeWidth: 3, stroke: '#fff' }}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>
            </div>

            {/* Right Column: Status & Secondary Info */}
            <div className="space-y-8">
              {/* Batches by Status Panel */}
              <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
                <div className="flex items-center gap-3 mb-6">
                  <div className="h-8 w-8 rounded-lg bg-amber-50 flex items-center justify-center">
                     <Package className="h-4 w-4 text-amber-600" />
                  </div>
                  <h3 className="text-sm font-black text-slate-900">Потік партій</h3>
                </div>
                
                <div className="space-y-5">
                  {Object.entries(data.batches_by_status).length === 0 ? (
                    <p className="text-slate-400 text-xs text-center py-4">Активні партії відсутні</p>
                  ) : (
                    Object.entries(data.batches_by_status)
                      .sort((a,b) => (STATUS_CONFIG[a[0]] ? 0 : 1) - (STATUS_CONFIG[b[0]] ? 0 : 1))
                      .map(([status, count]) => {
                        const cfg = STATUS_CONFIG[status] || { label: status, color: 'text-slate-600', bg: 'bg-slate-100', border: 'border-slate-200' };
                        const pct = totalBatches > 0 ? Math.round((count / totalBatches) * 100) : 0;
                        return (
                          <div key={status} className="group">
                            <div className="flex items-center justify-between text-xs mb-2">
                              <span className={`font-black uppercase tracking-widest ${cfg.color}`}>{cfg.label}</span>
                              <div className="flex items-center gap-2">
                                <span className="font-black text-slate-900">{count}</span>
                                <span className="text-[10px] text-slate-400 font-bold">{pct}%</span>
                              </div>
                            </div>
                            <div className="h-2 bg-slate-50 rounded-full overflow-hidden border border-slate-100">
                              <div
                                className={`h-full ${cfg.bg.replace('bg-', 'bg-')} ${cfg.color.replace('text-', 'bg-')} bg-opacity-80 rounded-full transition-all duration-1000 group-hover:bg-opacity-100`}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </div>
                        );
                      })
                  )}
                </div>
              </div>

              {/* Earnings (Financial Health) */}
              <div className="bg-indigo-600 rounded-3xl p-6 text-white shadow-lg shadow-indigo-200 relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-12 bg-white/10 blur-3xl rounded-full translate-x-1/2 -translate-y-1/2 group-hover:scale-110 transition-transform duration-500"></div>
                <div className="relative z-10">
                  <div className="flex items-center gap-2 mb-1">
                    <DollarSign className="h-4 w-4 opacity-80" />
                    <span className="text-[10px] font-black uppercase tracking-widest opacity-80">
                      Фінансовий виробіток
                    </span>
                  </div>
                  <div className="text-3xl font-black mt-2 tabular-nums">
                    {data.summary.total_earnings.toLocaleString('uk-UA', { maximumFractionDigits: 0 })} <span className="text-lg opacity-70">₴</span>
                  </div>
                  <div className="text-[10px] font-medium mt-1 opacity-70">сума підтверджених робіт за період</div>
                  
                  <Link href="/payroll" className="mt-6 flex items-center justify-between bg-white/15 hover:bg-white/25 border border-white/10 rounded-xl px-4 py-2 text-xs font-bold transition-all">
                    До відомостей
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Actions Row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4">
            {[
              { label: 'Партії',       href: '/batches',    icon: Package,        color: 'text-amber-600',   bg: 'bg-amber-50' },
              { label: 'Майстер',      href: '/master',     icon: CheckCircle2,   color: 'text-purple-600',  bg: 'bg-purple-50' },
              { label: 'Зарплата',     href: '/payroll',    icon: DollarSign,     color: 'text-emerald-600', bg: 'bg-emerald-50' },
              { label: 'Аналітика',    href: '/analytics',  icon: TrendingUp,     color: 'text-sky-600',     bg: 'bg-sky-50' },
            ].map(a => (
              <Link key={a.href} href={a.href}
                className="flex items-center gap-3 bg-white border border-slate-200 rounded-2xl px-5 py-4 transition-all hover:shadow-md hover:border-slate-300 group">
                <div className={`h-10 w-10 rounded-xl ${a.bg} flex items-center justify-center`}>
                   <a.icon className={`h-5 w-5 ${a.color}`} />
                </div>
                <span className="text-sm font-black text-slate-700 group-hover:text-slate-900">{a.label}</span>
                <ArrowRight className="h-4 w-4 text-slate-300 ml-auto group-hover:text-slate-600 group-hover:translate-x-0.5 transition-all" />
              </Link>
            ))}
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-32 text-slate-400 gap-4">
          <div className="h-16 w-16 rounded-full bg-slate-50 flex items-center justify-center border border-slate-100">
             <AlertCircle className="h-8 w-8 opacity-20" />
          </div>
          <p className="text-sm font-bold uppercase tracking-widest">Не вдалося завантажити дані</p>
        </div>
      )}
    </div>
  );
}
