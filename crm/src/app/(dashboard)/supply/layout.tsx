'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Truck, Users2, FileText, Plus, Calendar } from 'lucide-react';

export default function SupplyLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  const navLinks = [
    { href: '/supply', label: 'Документи', icon: FileText, exact: true },
    { href: '/supply/calendar', label: 'Платіжний календар', icon: Calendar },
    { href: '/supply/suppliers', label: 'Постачальники', icon: Users2 },
  ];

  return (
    <div className="flex flex-col h-full overflow-hidden animate-in fade-in duration-500">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-[var(--text-1)]">Постачання</h1>
          <p className="text-[var(--text-2)] text-sm font-medium mt-1">Закупівлі сировини та матеріалів</p>
        </div>
        <Link
          href="/supply/create"
          className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-5 py-2.5 rounded-xl font-bold shadow-lg shadow-emerald-500/20 transition-all text-sm"
        >
          <Plus className="w-4 h-4" /> Нове постачання
        </Link>
      </div>

      <nav className="flex gap-2 mb-6 border-b border-[var(--border)] px-1">
        {navLinks.map((link) => {
          const isActive = link.exact ? pathname === link.href : pathname.startsWith(link.href);
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`flex items-center gap-2 px-5 py-3 -mb-[1px] border-b-2 font-bold transition-all ${
                isActive
                  ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400'
                  : 'border-transparent text-[var(--text-3)] hover:text-[var(--text-1)] hover:border-slate-300 dark:hover:border-slate-700'
              }`}
            >
              <link.icon className="w-4 h-4" />
              {link.label}
            </Link>
          );
        })}
      </nav>

      <div className="flex-1 overflow-hidden">
        {children}
      </div>
    </div>
  );
}
