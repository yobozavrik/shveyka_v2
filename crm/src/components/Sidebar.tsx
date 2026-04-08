'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useTheme } from 'next-themes';
import {
  LayoutDashboard, Users, Package, ClipboardCheck,
  CircleDollarSign, Map, Wrench, Warehouse, BarChart3,
  LogOut, Scissors, AlertTriangle, ShoppingCart, Sun, Moon,
  Briefcase, UserPlus, FileText, Truck, ChevronDown, ChevronRight, GraduationCap, BookOpen, 
  ArrowRightLeft, CreditCard, ListTodo, Calendar as CalendarIcon, Clock, Filter, Plus, 
  ChevronLeft, Smartphone, Share2
} from 'lucide-react';

type MenuItem = {
  name: string;
  icon: React.ComponentType<{ className?: string }>;
  href: string;
  roles: string[];
};

type MenuGroup = {
  label: string;
  items: MenuItem[];
};

const menuGroups: MenuGroup[] = [
  {
    label: 'Головне',
    items: [
      { name: 'Дашборд',       icon: LayoutDashboard,  href: '/dashboard',    roles: ['admin', 'manager'] },
      { name: 'Задачі',        icon: ListTodo,         href: '/tasks',        roles: ['admin', 'manager', 'hr'] },
      { name: 'Замовлення',    icon: FileText,         href: '/orders?tab=orders', roles: ['admin', 'manager'] },
      { name: 'KeyCRM',        icon: ShoppingCart,     href: '/keycrm',       roles: ['admin'] },
      { name: 'Склад',         icon: Warehouse,        href: '/warehouse',          roles: ['admin', 'manager'] },
      { name: 'Постачання',    icon: Truck,            href: '/supply',             roles: ['admin', 'manager'] },
      { name: 'Працівники',    icon: Users,            href: '/employees',    roles: ['admin', 'manager'] },
      { name: 'Підтвердження', icon: ClipboardCheck,   href: '/master',       roles: ['admin', 'manager', 'master'] },
      { name: 'Аналітика',     icon: BarChart3,        href: '/analytics',    roles: ['admin', 'manager'] },
    ]
  },
  {
    label: 'Виробництво',
    items: [
      { name: 'Маршрути',      icon: Map,              href: '/route-cards',  roles: ['admin', 'manager'] },
      { name: 'Вир. замовлення', icon: FileText,        href: '/production-orders',  roles: ['admin', 'manager'] },
      { name: 'Партії',        icon: Package,          href: '/batches',      roles: ['admin', 'manager', 'master', 'quality'] },
      { name: 'Дефекти',       icon: AlertTriangle,    href: '/defects',      roles: ['admin', 'manager', 'master'] },
      { name: 'Операції',      icon: Wrench,           href: '/operations',   roles: ['admin', 'manager'] },
    ]
  },
  {
    label: 'Фінанси',
    items: [
      { name: 'Нарахування ЗП', icon: CircleDollarSign, href: '/payroll',        roles: ['admin', 'manager'] },
      { name: 'Рух коштів',    icon: ArrowRightLeft,   href: '/finance/cash-flow', roles: ['admin', 'manager'] },
      { name: 'Платежі',       icon: CreditCard,       href: '/finance/payments',  roles: ['admin', 'manager'] },
    ]
  },
  {
    label: 'HR Відділ',
    items: [
      { name: 'Вакансії',      icon: Briefcase,        href: '/vacancies',    roles: ['admin', 'manager', 'hr'] },
      { name: 'Кандидати',     icon: UserPlus,         href: '/candidates',   roles: ['admin', 'manager', 'hr'] },
      { name: 'Навчання',      icon: GraduationCap,    href: '/hr/training',  roles: ['admin', 'manager', 'hr'] },
      { name: 'Матеріали',     icon: BookOpen,         href: '/hr/materials', roles: ['admin', 'manager', 'hr'] },
    ]
  }
];

export default function Sidebar({ userRole, username }: { userRole: string; username: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const [pendingCount, setPendingCount] = useState(0);
  const [mounted, setMounted] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    const fetchPending = async () => {
      try {
        const res = await fetch('/api/entries?status=submitted&limit=1');
        if (res.ok) {
          const data = await res.json();
          setPendingCount(Array.isArray(data) ? data.length : 0);
        }
      } catch { /* ignore */ }
    };
    if (['admin', 'manager', 'master'].includes(userRole)) {
      fetchPending();
      const interval = setInterval(fetchPending, 30000);
      return () => clearInterval(interval);
    }
  }, [userRole]);

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  };

  const toggleGroup = (label: string) => {
    setCollapsedGroups(prev => ({ ...prev, [label]: !prev[label] }));
  };

  return (
    <aside className="w-60 bg-[var(--bg-sidebar)] border-r border-[var(--border)] flex flex-col shrink-0 overflow-hidden">
      {/* Logo */}
      <div className="px-4 py-5 border-b border-[var(--border)] shrink-0">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 bg-emerald-600 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-600/25">
            <Scissors className="h-5 w-5 text-white" />
          </div>
          <div>
            <div className="font-bold text-sm leading-tight text-[var(--text-1)]">Швейка MES</div>
            <div className="text-[10px] text-[var(--text-3)] font-medium tracking-wide">ВИРОБНИЧИЙ МОДУЛЬ</div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 py-3 space-y-4 overflow-y-auto custom-scrollbar">
        {menuGroups.map((group) => {
          const filteredItems = group.items.filter(item => item.roles.includes(userRole));
          if (filteredItems.length === 0) return null;

          const isCollapsed = collapsedGroups[group.label];
          // Determine if any child is active to auto-expand or highlight
          const hasActiveChild = filteredItems.some(item => pathname === item.href || pathname.startsWith(item.href + '/'));

          return (
            <div key={group.label} className="space-y-1">
              <button 
                onClick={() => toggleGroup(group.label)}
                className="w-full flex items-center gap-2 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-[var(--text-3)] hover:text-[var(--text-2)] transition-colors group"
              >
                <div className="flex-1 text-left">{group.label}</div>
                <div className={`transition-transform duration-200 ${isCollapsed ? '-rotate-90' : ''}`}>
                  <ChevronDown className="h-4 w-4 opacity-50 group-hover:opacity-100" />
                </div>
              </button>
              
              {!isCollapsed && (
                <div className="space-y-0.5">
                  {filteredItems.map((item) => {
                    const itemPath = item.href.split('?')[0];
                    const isActive = pathname === itemPath || pathname.startsWith(itemPath + '/');
                    const showBadge = itemPath === '/master' && pendingCount > 0;
                    return (
                      <Link
                        key={item.name}
                        href={item.href}
                        className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-medium transition-all ${
                          isActive
                            ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                            : 'text-[var(--text-2)] hover:text-[var(--text-1)] hover:bg-black/5 dark:hover:bg-white/5 border border-transparent'
                        }`}
                      >
                        <item.icon className={`h-4 w-4 shrink-0 ${isActive ? 'text-emerald-500' : 'text-[var(--text-3)]'}`} />
                        <span className="flex-1">{item.name}</span>
                        {showBadge && (
                          <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center leading-none">
                            {pendingCount > 9 ? '9+' : pendingCount}
                          </span>
                        )}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* User + theme toggle + Logout */}
      <div className="px-2 py-3 border-t border-[var(--border)] space-y-1">
        {/* Theme toggle */}
        {mounted && (
          <button
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="flex items-center gap-2.5 px-3 py-2 w-full rounded-xl text-sm font-medium text-[var(--text-2)] hover:text-[var(--text-1)] hover:bg-black/5 dark:hover:bg-white/5 transition-all cursor-pointer"
          >
            {theme === 'dark'
              ? <Sun className="h-4 w-4 text-amber-400" />
              : <Moon className="h-4 w-4 text-indigo-500" />
            }
            {theme === 'dark' ? 'Світла тема' : 'Темна тема'}
          </button>
        )}

        <div className="flex items-center gap-2.5 px-3 py-2.5 bg-black/5 dark:bg-white/5 rounded-xl border border-[var(--border)]">
          <div className="h-7 w-7 rounded-lg bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase shrink-0">
            {username?.[0] || 'A'}
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold truncate text-[var(--text-1)]">{username}</div>
            <div className="text-[10px] text-emerald-600 dark:text-emerald-500 uppercase font-bold tracking-wide">{userRole}</div>
          </div>
        </div>

        <button
          onClick={handleLogout}
          className="flex items-center gap-2.5 px-3 py-2 w-full rounded-xl text-sm font-medium text-[var(--text-3)] hover:text-red-500 hover:bg-red-500/8 transition-all cursor-pointer"
        >
          <LogOut className="h-4 w-4" />
          Вийти
        </button>
      </div>
    </aside>
  );
}
