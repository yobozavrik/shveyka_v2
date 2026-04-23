'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { PackageSearch, MapPin, ArrowLeftRight, Activity, ClipboardList } from 'lucide-react';

export default function WarehouseLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  const navLinks = [
    { href: '/warehouse', label: 'Огляд', icon: Activity, exact: true },
    { href: '/warehouse/items', label: 'Номенклатура', icon: PackageSearch },
    { href: '/warehouse/norms', label: 'Норми витрат', icon: ClipboardList },
    { href: '/warehouse/locations', label: 'Локації', icon: MapPin },
    { href: '/warehouse/movements', label: 'Журнал рухів', icon: ArrowLeftRight },
  ];

  return (
    <div className="flex flex-col h-full overflow-hidden animate-in fade-in duration-500">
      <div className="mb-6">
        <h1 className="text-3xl font-black tracking-tight text-[var(--text-1)]">Складський модуль</h1>
        <p className="text-[var(--text-2)] text-sm font-medium mt-1">Керування товарами, локаціями та партіями (Double-Entry)</p>
      </div>

      <nav className="flex gap-2 mb-6 border-b border-[var(--border)] px-1">
        {navLinks.map((link) => {
          const isActive = link.exact ? pathname === link.href : pathname?.startsWith(link.href);
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`flex items-center gap-2 px-5 py-3 -mb-[1px] border-b-2 font-bold transition-all ${
                isActive
                  ? 'border-indigo-500 text-indigo-500'
                  : 'border-transparent text-[var(--text-3)] hover:text-[var(--text-1)] hover:border-[var(--border)]'
              }`}
            >
              <link.icon className="w-4 h-4" />
              {link.label}
            </Link>
          );
        })}
      </nav>

      {/* Контент табів займає залишок простору */}
      <div className="flex-1 overflow-hidden">
        {children}
      </div>
    </div>
  );
}
