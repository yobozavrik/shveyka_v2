'use client';

import { ArrowRightLeft, TrendingUp, TrendingDown, DollarSign } from 'lucide-react';

export default function CashFlowPage() {
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-1)]">Рух коштів</h1>
          <p className="text-sm text-[var(--text-3)] mt-1">
            Моніторинг доходів та витрат
          </p>
        </div>
        <button className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-sm font-bold hover:bg-emerald-700 transition-colors shadow-lg shadow-emerald-600/20">
          Додати запис
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-[var(--bg-panel)] p-5 rounded-2xl border border-[var(--border)]">
          <div className="text-[var(--text-3)] text-xs font-bold uppercase tracking-wider mb-1">Надходження</div>
          <div className="text-2xl font-black text-emerald-500">₴ 124,500</div>
          <div className="flex items-center gap-1 mt-2 text-[10px] text-emerald-600 font-bold">
            <TrendingUp className="h-3 w-3" /> +12% за місяць
          </div>
        </div>
        <div className="bg-[var(--bg-panel)] p-5 rounded-2xl border border-[var(--border)]">
          <div className="text-[var(--text-3)] text-xs font-bold uppercase tracking-wider mb-1">Витрати</div>
          <div className="text-2xl font-black text-rose-500">₴ 86,200</div>
          <div className="flex items-center gap-1 mt-2 text-[10px] text-rose-600 font-bold">
            <TrendingDown className="h-3 w-3" /> +5% за місяць
          </div>
        </div>
        <div className="bg-[var(--bg-panel)] p-5 rounded-2xl border border-[var(--border)]">
          <div className="text-[var(--text-3)] text-xs font-bold uppercase tracking-wider mb-1">Чистий прибуток</div>
          <div className="text-2xl font-black text-[var(--text-1)]">₴ 38,300</div>
          <div className="flex items-center gap-1 mt-2 text-[10px] text-emerald-600 font-bold">
            <TrendingUp className="h-3 w-3" /> +18% за місяць
          </div>
        </div>
      </div>

      <div className="bg-[var(--bg-panel)] rounded-2xl border border-[var(--border)] overflow-hidden shadow-sm">
        <div className="px-6 py-4 border-b border-[var(--border)]">
          <h3 className="font-bold text-[var(--text-1)]">Останні транзакції</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-black/5 dark:bg-white/5 border-b border-[var(--border)]">
                <th className="px-6 py-3 text-[10px] font-bold text-[var(--text-3)] uppercase">Дата</th>
                <th className="px-6 py-3 text-[10px] font-bold text-[var(--text-3)] uppercase">Категорія</th>
                <th className="px-6 py-3 text-[10px] font-bold text-[var(--text-3)] uppercase">Опис</th>
                <th className="px-6 py-3 text-[10px] font-bold text-[var(--text-3)] uppercase text-right">Сума</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)] text-sm">
              <tr className="hover:bg-black/2.5 dark:hover:bg-white/2.5 transition-colors">
                <td className="px-6 py-4 text-[var(--text-2)]">02.04.2026</td>
                <td className="px-6 py-4">
                  <span className="px-2 py-1 bg-emerald-500/10 text-emerald-600 text-[10px] font-bold uppercase rounded-md">Продаж</span>
                </td>
                <td className="px-6 py-4 text-[var(--text-1)] font-medium">Оплата замовлення #171</td>
                <td className="px-6 py-4 text-right text-emerald-500 font-bold">+ ₴ 12,400</td>
              </tr>
              <tr className="hover:bg-black/2.5 dark:hover:bg-white/2.5 transition-colors">
                <td className="px-6 py-4 text-[var(--text-2)]">01.04.2026</td>
                <td className="px-6 py-4">
                  <span className="px-2 py-1 bg-rose-500/10 text-rose-600 text-[10px] font-bold uppercase rounded-md">Закупівля</span>
                </td>
                <td className="px-6 py-4 text-[var(--text-1)] font-medium">Тканина Silk (batch #44)</td>
                <td className="px-6 py-4 text-right text-rose-500 font-bold">- ₴ 5,200</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
