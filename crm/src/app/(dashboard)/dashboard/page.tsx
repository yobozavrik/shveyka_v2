'use client';

import { useState, useEffect } from 'react';
import { Users, Package, ClipboardCheck, Zap, TrendingUp, DollarSign, Clock, ArrowRight, Activity, CheckCircle2, AlertCircle, Info } from 'lucide-react';
import Link from 'next/link';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import './linear-dashboard.css';

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

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  created:  { label: 'Нові',           color: 'text-sky-500',    bg: 'rgba(14, 165, 233, 0.15)' },
  cutting:  { label: 'Розкрій',        color: 'text-orange-500', bg: 'rgba(249, 115, 22, 0.15)' },
  sewing:   { label: 'Пошив',          color: 'text-indigo-500', bg: 'rgba(99, 102, 241, 0.15)' },
  ready:    { label: 'Готові',         color: 'text-emerald-500', bg: 'rgba(16, 185, 129, 0.15)' },
  shipped:  { label: 'Відвантажено',   color: 'text-slate-500',  bg: 'rgba(100, 116, 139, 0.15)' },
};

function KpiCard({
  icon: Icon, label, value, sub, accent, href, glow
}: {
  icon: React.ElementType; label: string; value: string | number; sub?: string;
  accent: string; href?: string; glow?: boolean;
}) {
  const inner = (
    <div className={`kpi-card ${glow ? 'ring-2 ring-red-500/20' : ''}`}>
      <div className="flex items-start justify-between relative z-10">
        <div className={`w-10 h-10 rounded-comfortable flex items-center justify-center bg-opacity-10 ${accent}`}>
          <Icon className={`h-5 w-5 ${accent.replace('bg-', 'text-')}`} />
        </div>
        {href && (
          <ArrowRight className="h-4 w-4 text-[var(--text-4)] group-hover:text-[var(--text-2)] group-hover:translate-x-0.5 transition-all" />
        )}
      </div>
      <div className="relative z-10">
        <div className="kpi-value">{value}</div>
        <div className="kpi-label">{label}</div>
        {sub && <div className="kpi-sub">{sub}</div>}
      </div>
    </div>
  );
  return href ? <Link href={href} className="block h-full">{inner}</Link> : <div className="h-full">{inner}</div>;
}

function InsightsBlock({ data }: { data: Analytics }) {
  const critical = data.summary.pending_approvals > 5;
  const isGrowing = data.daily.length > 1 && data.daily[data.daily.length-1].qty > data.daily[data.daily.length-2].qty;

  return (
    <div className="insights-block">
      <div className="flex items-center gap-2 mb-4">
        <Info className="h-4 w-4 text-[var(--accent)]" />
        <h3 className="text-[10px] font-medium uppercase tracking-widest text-[var(--text-3)]">Аналіз виробництва</h3>
      </div>
      <div className="space-y-3 relative z-10">
        <p className="text-sm text-[var(--text-2)] leading-relaxed">
          {critical ? (
            <span className="text-amber-400 font-medium">Увага! {data.summary.pending_approvals} записів очікують завершення етапу. </span>
          ) : (
            <span className="text-[var(--success-em)] font-medium">Виробничий процес в нормі. </span>
          )}
          На даний момент у роботі {data.summary.active_batches} активних партій.
          {isGrowing ? ' Спостерігається позитивна динаміка виробітку.' : ' Обсяги виробництва стабільні.'}
        </p>
        <div className="flex gap-2">
          <Link href="/batches?status=active" className="text-xs bg-blue-500/20 text-blue-300 px-3 py-1.5 rounded-comfortable font-medium hover:bg-blue-500/30 transition-colors">
            Виробничі партії
          </Link>
          <Link href="/analytics" className="btn-ghost text-xs">
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
      <div className="bg-[var(--bg-card2)] border border-[var(--border)] shadow-xl rounded-comfortable px-4 py-3">
        <div className="text-[10px] font-medium uppercase tracking-wider text-[var(--text-4)] mb-1">{label}</div>
        <div className="text-[var(--accent)] font-medium text-lg">{payload[0].value.toLocaleString()} <span className="text-xs font-normal text-[var(--text-3)]">од.</span></div>
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
    const controller = new AbortController();
    setLoading(true);
    fetch(`/api/analytics/dashboard?period=${period}`, { signal: controller.signal })
      .then(async r => {
        if (!r.ok) throw new Error(`Dashboard analytics request failed: ${r.status}`);
        return r.json();
      })
      .then((payload: Analytics) => { if (!controller.signal.aborted) setData(payload); })
      .catch(() => { if (!controller.signal.aborted) setData(null); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [period]);

  const chartData = data?.daily?.map(d => ({
    date: new Date(d.date + 'T12:00:00').toLocaleDateString('uk-UA', { day: 'numeric', month: 'short' }),
    qty: d.qty,
  })) ?? [];

  const totalBatches = data?.batches_by_status ? Object.values(data.batches_by_status).reduce((a, b) => a + b, 0) : 0;
  const now = new Date().toLocaleDateString('uk-UA', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <div className="min-h-full space-y-8 pb-12">
      {/* Header — Linear style */}
      <div className="dashboard-header flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-h1">Головна панель</h1>
          <p className="date-text text-sm font-medium mt-1 flex items-center gap-2 capitalize italic">
            <Clock className="h-3.5 w-3.5" /> {now}
          </p>
        </div>
        <div className="period-selector">
          {(['today', 'week', 'month'] as const).map(p => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`period-btn ${period === p ? 'active' : ''}`}
              aria-pressed={period === p}
            >
              {p === 'today' ? 'Сьогодні' : p === 'week' ? 'Тиждень' : 'Місяць'}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-32 bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-comfortable animate-pulse" />
          ))}
        </div>
      ) : data && data.summary ? (
        <div className="space-y-8">
          {/* Зона 3: KPI Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <KpiCard
              icon={Zap}
              label="Загальний виробіток"
              value={data.summary.confirmed_qty?.toLocaleString() ?? '0'}
              sub={period === 'today' ? 'Зафіксовано сьогодні' : 'Сумарно за період'}
              accent="bg-emerald-500"
              href="/payroll"
            />
            <KpiCard
              icon={Package}
              label="Активні партії"
              value={data.summary.active_batches ?? 0}
              sub={`У роботі з ${totalBatches} всього`}
              accent="bg-amber-500"
              href="/batches"
            />
            <KpiCard
              icon={Users}
              label="Команда в зміні"
              value={data.summary.active_employees ?? 0}
              sub="Виконують операції"
              accent="bg-sky-500"
              href="/employees"
            />
            <KpiCard
              icon={ClipboardCheck}
              label="Готові до передачі"
              value={data.summary.pending_approvals ?? 0}
              sub="Завершили етап"
              accent="bg-indigo-500"
              href="/batches?status=active"
              glow={data.summary.pending_approvals > 0}
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-8">
              {/* Зона 30: Insights */}
              <InsightsBlock data={data} />

              {/* Зона 300: Production Dynamics Chart */}
              <div className="chart-container">
                <div className="flex items-center justify-between mb-8">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-comfortable bg-[var(--primary)]/10 flex items-center justify-center">
                       <Activity className="h-4 w-4 text-[var(--accent)]" />
                    </div>
                    <div>
                      <h3 className="text-sm font-medium text-[var(--text-1)]">Динаміка виробництва</h3>
                      <p className="text-[10px] text-[var(--text-4)] uppercase tracking-wider">Обсяги виробітку по днях</p>
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
                            <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.15} />
                            <stop offset="95%" stopColor="var(--primary)" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" vertical={false} />
                        <XAxis
                          dataKey="date"
                          tick={{ fill: 'var(--text-3)', fontSize: 10, fontWeight: 500 }}
                          axisLine={false}
                          tickLine={false}
                        />
                        <YAxis
                          tick={{ fill: 'var(--text-3)', fontSize: 10, fontWeight: 500 }}
                          axisLine={false}
                          tickLine={false}
                        />
                        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'var(--bg-hover)' }} />
                        <Area
                          type="monotone"
                          dataKey="qty"
                          stroke="var(--primary)"
                          strokeWidth={3}
                          fill="url(#pdiGrad)"
                          dot={{ fill: 'var(--primary)', strokeWidth: 2, stroke: 'var(--bg-card)', r: 4 }}
                          activeDot={{ r: 6, fill: 'var(--primary)', strokeWidth: 3, stroke: 'var(--bg-card)' }}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>
            </div>

            {/* Right Column: Status & Secondary Info */}
            <div className="space-y-8">
              {/* Batches by Status Panel — Linear style */}
              <div className="status-panel">
                <div className="flex items-center gap-3 mb-6">
                  <div className="h-8 w-8 rounded-comfortable bg-amber-500/10 flex items-center justify-center">
                     <Package className="h-4 w-4 text-amber-500" />
                  </div>
                  <h3 className="text-sm font-medium text-[var(--text-1)]">Потік партій</h3>
                </div>
                
                <div className="space-y-5">
                  {Object.entries(data.batches_by_status ?? {}).length === 0 ? (
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
                              <span className={`font-medium uppercase tracking-widest ${cfg.color}`}>{cfg.label}</span>
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-[var(--text-1)]">{count}</span>
                                <span className="text-[10px] text-[var(--text-4)]">{pct}%</span>
                              </div>
                            </div>
                            <div className="progress-bar">
                              <div
                                className="h-full rounded-full transition-all duration-500"
                                style={{ width: `${pct}%`, backgroundColor: cfg.bg }}
                              />
                            </div>
                          </div>
                        );
                      })
                  )}
                </div>
              </div>

              {/* Earnings — Linear indigo card */}
              <div className="earnings-card">
                <div className="relative z-10">
                  <div className="flex items-center gap-2 mb-1">
                    <DollarSign className="h-4 w-4 opacity-80" />
                    <span className="text-[10px] font-medium uppercase tracking-wider opacity-80">
                      Фінансовий виробіток
                    </span>
                  </div>
                  <div className="text-3xl font-medium mt-2 tabular-nums">
                    {data.summary.total_earnings.toLocaleString('uk-UA', { maximumFractionDigits: 0 })} <span className="text-lg opacity-70">₴</span>
                  </div>
                  <div className="text-[10px] font-medium mt-1 opacity-70">сума підтверджених робіт за період</div>

                  <Link href="/payroll" className="mt-6 flex items-center justify-between bg-white/15 hover:bg-white/25 border border-white/10 rounded-comfortable px-4 py-2 text-xs font-medium transition-all">
                    До відомостей
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Actions Row — Linear style */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4">
            {[
              { label: 'Партії',       href: '/batches',    icon: Package,        color: 'text-amber-500',   bg: 'bg-amber-500/10' },
              { label: 'Виробництво',  href: '/batches?status=active', icon: CheckCircle2,   color: 'text-purple-400',  bg: 'bg-purple-500/10' },
              { label: 'Зарплата',     href: '/payroll',    icon: DollarSign,     color: 'text-[var(--success-em)]', bg: 'bg-emerald-500/10' },
              { label: 'Аналітика',    href: '/analytics',  icon: TrendingUp,     color: 'text-sky-400',     bg: 'bg-sky-500/10' },
            ].map(a => (
              <Link key={a.href} href={a.href}
                className="action-card">
                <div className={`h-10 w-10 rounded-comfortable ${a.bg} flex items-center justify-center`}>
                   <a.icon className={`h-5 w-5 ${a.color}`} />
                </div>
                <span className="text-sm font-medium text-[var(--text-2)]">{a.label}</span>
                <ArrowRight className="h-4 w-4 text-[var(--text-4)] ml-auto group-hover:translate-x-0.5 transition-all" />
              </Link>
            ))}
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-32 text-[var(--text-3)] gap-4">
          <div className="h-16 w-16 rounded-full bg-[var(--bg-card)] flex items-center justify-center border border-[var(--border-subtle)]">
             <AlertCircle className="h-8 w-8 opacity-20" />
          </div>
          <p className="text-sm font-medium uppercase tracking-widest">Не вдалося завантажити дані</p>
        </div>
      )}
    </div>
  );
}
