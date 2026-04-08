'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Users, Clock, CircleDollarSign, Briefcase, BookOpen } from 'lucide-react';
import { clsx } from 'clsx';

const TABS = [
  { name: 'Штат', href: '/employees/staff', icon: Users },
  { name: 'Посади', href: '/employees/positions', icon: BookOpen },
  { name: 'Робочий табель', href: '/employees/attendance', icon: Clock },
  { name: 'Зарплата', href: '/employees/payroll', icon: CircleDollarSign },
  { name: 'Вакансії', href: '/employees/vacancies', icon: Briefcase },
];

export default function EmployeesLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="space-y-6">
      <div className="flex w-fit items-center gap-1 rounded-2xl bg-black/5 p-1 dark:bg-white/5">
        {TABS.map((tab) => {
          const isActive = pathname === tab.href;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={clsx(
                'flex cursor-pointer items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-all',
                isActive
                  ? 'border border-[var(--border)] bg-[var(--bg-card)] text-indigo-500 shadow-sm'
                  : 'text-[var(--text-2)] hover:text-[var(--text-1)]'
              )}
            >
              <tab.icon className={clsx('h-4 w-4', isActive ? 'text-indigo-500' : 'text-[var(--text-3)]')} />
              {tab.name}
            </Link>
          );
        })}
      </div>

      <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">{children}</div>
    </div>
  );
}
