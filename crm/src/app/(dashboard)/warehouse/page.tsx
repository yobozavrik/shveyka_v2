'use client';

import { Activity, Package, Scale, TrendingUp } from 'lucide-react';
import Link from 'next/link';

export default function WarehouseDashboardPage() {
  const stats = [
    { label: 'Активна номенклатура', value: '0', icon: Package, link: '/warehouse/items' },
    { label: 'Складські зони', value: '6', icon: Scale, link: '/warehouse/locations' },
    { label: 'Рухів за сьогодні', value: '0', icon: Activity, link: '/warehouse/movements' },
  ];

  return (
    <div className="flex flex-col gap-6 animate-in fade-in zoom-in-95 duration-500">
      
      {/* 1. Statistics / KPIs */}
      <div className="grid grid-cols-3 gap-6">
        {stats.map((stat, idx) => (
          <Link key={idx} href={stat.link} className="block group">
            <div className="bg-[var(--bg-card)] border border-[var(--border)] group-hover:border-indigo-500/50 rounded-[32px] p-6 transition-all duration-300 shadow-sm group-hover:shadow-xl group-hover:shadow-indigo-500/10">
              <div className="flex justify-between items-start mb-4">
                 <div className="p-3 bg-[var(--bg-card2)] group-hover:bg-indigo-500/10 rounded-2xl transition-colors">
                   <stat.icon className="w-6 h-6 text-[var(--text-3)] group-hover:text-indigo-600 transition-colors" />
                 </div>
                 <TrendingUp className="w-5 h-5 text-emerald-500" />
              </div>
              <div>
                <p className="text-[var(--text-3)] text-sm font-bold uppercase tracking-wider mb-1">{stat.label}</p>
                <h3 className="text-4xl font-black text-[var(--text-1)]">{stat.value}</h3>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* 2. Quick Actions Panel */}
      <div className="bg-gradient-to-br from-indigo-600 to-violet-700 rounded-[32px] p-8 text-white shadow-2xl shadow-indigo-600/20 relative overflow-hidden">
        {/* Decorative elements */}
        <div className="absolute top-0 right-0 -mr-20 -mt-20 w-64 h-64 bg-white/10 rounded-full blur-3xl mix-blend-overlay"></div>
        <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-80 h-80 bg-black/10 rounded-full blur-3xl mix-blend-overlay"></div>
        
        <div className="relative z-10 max-w-xl">
           <h2 className="text-2xl font-black mb-2">Double-Entry Склад</h2>
           <p className="text-indigo-100 font-medium mb-6">Ваша нова система обробляє складські рухи між локаціями. Використовуйте Журнал для будь-яких коригувань.</p>
           
           <div className="flex gap-4">
             <Link href="/warehouse/movements" className="bg-white text-indigo-700 px-6 py-3 rounded-xl font-bold hover:bg-indigo-50 transition-colors shadow-xl">
               Створити переміщення
             </Link>
             <Link href="/warehouse/items" className="bg-indigo-800/40 backdrop-blur-md border border-indigo-400/30 text-white px-6 py-3 rounded-xl font-bold hover:bg-indigo-800/60 transition-colors">
               Додати номенклатуру
             </Link>
           </div>
        </div>
      </div>

    </div>
  );
}
