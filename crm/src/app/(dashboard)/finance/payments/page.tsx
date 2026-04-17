'use client';

import { CreditCard, Plus, Clock, Search, ExternalLink } from 'lucide-react';

export default function PaymentsPage() {
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-1)]">Платежі</h1>
          <p className="text-sm text-[var(--text-3)] mt-1">
            Керування рахунками та виплатами
          </p>
        </div>
        <div className="flex gap-2">
          <div className="relative">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-3)]" />
            <input 
              type="text" 
              placeholder="Пошук платежу..."
              className="pl-9 pr-4 py-2 bg-[var(--bg-panel)] border border-[var(--border)] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all min-w-[240px]"
            />
          </div>
          <button className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-sm font-bold hover:bg-emerald-700 transition-colors flex items-center gap-2">
            <Plus className="h-4 w-4" /> Новий платіж
          </button>
        </div>
      </div>

      <div className="bg-[var(--bg-panel)] rounded-2xl border border-[var(--border)] shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[var(--bg-card2)] border-b border-[var(--border)] text-[10px] font-bold text-[var(--text-3)] uppercase tracking-wider">
                <th className="px-6 py-4">Отримувач</th>
                <th className="px-6 py-4">Дата</th>
                <th className="px-6 py-4">Статус</th>
                <th className="px-6 py-4">Призначення</th>
                <th className="px-6 py-4 text-right">Сума</th>
                <th className="px-6 py-4 w-[60px]"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)] text-sm">
              <tr className="hover:bg-[var(--bg-hover)] transition-colors group">
                <td className="px-6 py-4">
                  <div className="font-bold text-[var(--text-1)]">КиївЕнерго</div>
                  <div className="text-[10px] text-[var(--text-3)]">Оренда</div>
                </td>
                <td className="px-6 py-4 text-[var(--text-2)]">03.04.2026</td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-1.5 px-2 py-1 bg-yellow-500/10 text-yellow-600 text-[10px] font-bold uppercase rounded-md w-fit">
                    <Clock className="h-3 w-3" /> Очікує
                  </div>
                </td>
                <td className="px-6 py-4 text-[var(--text-2)] font-medium">Оренда цеху #2</td>
                <td className="px-6 py-4 text-right font-black text-[var(--text-1)]">₴ 15,000</td>
                <td className="px-6 py-4 text-right">
                  <button className="p-2 text-[var(--text-3)] hover:text-emerald-500 transition-colors">
                    <ExternalLink className="h-4 w-4" />
                  </button>
                </td>
              </tr>
              <tr className="hover:bg-[var(--bg-hover)] transition-colors group">
                <td className="px-6 py-4">
                  <div className="font-bold text-[var(--text-1)]">ФОП Степаненко П.</div>
                  <div className="text-[10px] text-[var(--text-3)]">Постачальник</div>
                </td>
                <td className="px-6 py-4 text-[var(--text-2)]">01.04.2026</td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-1.5 px-2 py-1 bg-emerald-500/10 text-emerald-600 text-[10px] font-bold uppercase rounded-md w-fit">
                    Оплачено
                  </div>
                </td>
                <td className="px-6 py-4 text-[var(--text-2)] font-medium">Поставка фурнітури</td>
                <td className="px-6 py-4 text-right font-black text-[var(--text-1)]">₴ 4,700</td>
                <td className="px-6 py-4 text-right text-[var(--text-3)] group-hover:text-emerald-500">
                  <button className="p-2 transition-colors">
                    <ExternalLink className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
