'use client';

import { CircleDollarSign, TrendingUp, Users, Calendar } from 'lucide-react';

export default function PayrollPage() {
  return (
    <div className="p-6 space-y-6 text-[var(--text-1)]">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Нарахування ЗП</h1>
          <p className="text-sm text-[var(--text-3)] mt-1">
            Розрахунок заробітної плати за виробничі операції
          </p>
        </div>
        <div className="flex gap-3">
          <button className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-sm font-bold hover:bg-emerald-700 transition-colors shadow-lg shadow-emerald-500/20">
            Сформирувати відомість
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-[var(--bg-panel)] p-5 rounded-2xl border border-[var(--border)] shadow-sm">
          <div className="flex items-center gap-3 mb-3 text-[var(--text-3)] uppercase text-[10px] font-bold tracking-widest">
            <TrendingUp className="h-4 w-4" /> Нараховано за місяць
          </div>
          <div className="text-2xl font-black">₴ 425,800</div>
        </div>
        <div className="bg-[var(--bg-panel)] p-5 rounded-2xl border border-[var(--border)] shadow-sm">
          <div className="flex items-center gap-3 mb-3 text-[var(--text-3)] uppercase text-[10px] font-bold tracking-widest">
            <Users className="h-4 w-4" /> Працівників
          </div>
          <div className="text-2xl font-black">42</div>
        </div>
        <div className="bg-[var(--bg-panel)] p-5 rounded-2xl border border-[var(--border)] shadow-sm">
          <div className="flex items-center gap-3 mb-3 text-[var(--text-3)] uppercase text-[10px] font-bold tracking-widest">
             До виплати
          </div>
          <div className="text-2xl font-black text-emerald-500">₴ 158,200</div>
        </div>
        <div className="bg-[var(--bg-panel)] p-5 rounded-2xl border border-[var(--border)] shadow-sm">
          <div className="flex items-center gap-3 mb-3 text-[var(--text-3)] uppercase text-[10px] font-bold tracking-widest">
            <Calendar className="h-4 w-4" /> Період
          </div>
          <div className="text-sm font-bold">Квітень 2026</div>
        </div>
      </div>

      <div className="bg-[var(--bg-panel)] rounded-2xl border border-[var(--border)] overflow-hidden shadow-sm">
        <div className="px-6 py-4 border-b border-[var(--border)] bg-black/5 dark:bg-white/5">
          <h3 className="font-bold">Відомість нарахувань</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-black/5 dark:bg-white/5 text-[10px] font-bold text-[var(--text-3)] uppercase tracking-wider">
              <tr>
                <th className="px-6 py-4">Працівник</th>
                <th className="px-6 py-4">Операції</th>
                <th className="px-6 py-4">Виробіток</th>
                <th className="px-6 py-4 text-right">Сума</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)] text-sm">
              <tr className="hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
                <td className="px-6 py-4">Олена Коваленко</td>
                <td className="px-6 py-4">156 (Оверлок)</td>
                <td className="px-6 py-4">98%</td>
                <td className="px-6 py-4 text-right font-bold text-emerald-500">₴ 12,450</td>
              </tr>
              <tr className="hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
                <td className="px-6 py-4">Ігор Стеценко</td>
                <td className="px-6 py-4">210 (Прямострок)</td>
                <td className="px-6 py-4">102%</td>
                <td className="px-6 py-4 text-right font-bold text-emerald-500">₴ 14,200</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
