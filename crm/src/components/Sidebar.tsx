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
      { name: 'Аналітика',     icon: BarChart3,        href: '/analytics',    roles: ['admin', 'manager'] },
    ]
  },
  {
    label: 'Виробництво',
    items: [
      { name: 'Каталог',       icon: BookOpen,         href: '/catalog',      roles: ['admin', 'manager'] },
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
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

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
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch (err) {
      console.error('Logout failed:', err);
    }
    router.push('/login');
    router.refresh();
  };

  const toggleGroup = (label: string) => {
    setCollapsedGroups(prev => ({ ...prev, [label]: !prev[label] }));
  };

  return (
    <aside className="w-64 bg-[var(--bg-sidebar)] border-r border-[var(--border-subtle)] flex flex-col shrink-0 overflow-hidden">
      {/* Logo — Linear style */}
      <div className="px-4 py-4 border-b border-[var(--border-subtle)] shrink-0">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 bg-[var(--primary)] rounded-lg flex items-center justify-center">
            <Scissors className="h-4 w-4 text-white" />
          </div>
          <div>
            <div className="font-medium text-sm leading-tight text-[var(--text-1)] tracking-tight">Швейка</div>
            <div className="text-[10px] text-[var(--text-4)] font-medium tracking-wider uppercase">Production</div>
          </div>
        </div>
      </div>

      {/* Nav — Linear style */}
      <nav className="flex-1 px-2 py-3 space-y-5 overflow-y-auto custom-scrollbar" aria-label="Головна навігація">
        {menuGroups.map((group) => {
          const filteredItems = group.items.filter(item => item.roles.includes(userRole));
          if (filteredItems.length === 0) return null;

          const isCollapsed = collapsedGroups[group.label];
          // Determine if any child is active to auto-expand or highlight
          const hasActiveChild = filteredItems.some(item => pathname === item.href || pathname?.startsWith(item.href + '/'));

          return (
            <div key={group.label} className="space-y-1">
              <button
                onClick={() => toggleGroup(group.label)}
                className="w-full flex items-center gap-2 px-3 py-1 text-[10px] font-medium uppercase tracking-widest text-[var(--text-4)] hover:text-[var(--text-3)] transition-colors"
                aria-expanded={!isCollapsed}
                aria-label={`${group.label} секція`}
              >
                <div className="flex-1 text-left">{group.label}</div>
                <div className={`transition-transform duration-200 ${isCollapsed ? '-rotate-90' : ''}`}>
                  <ChevronDown className="h-3.5 w-3.5 opacity-40" />
                </div>
              </button>

              {!isCollapsed && (
                <div className="space-y-px">
                  {filteredItems.map((item) => {
                    const itemPath = item.href.split('?')[0];
                    const isActive = pathname === itemPath || pathname?.startsWith(itemPath + '/');
                    return (
                      <Link
                        key={item.name}
                        href={item.href}
                        className={`flex items-center gap-2.5 px-2.5 py-1.5 rounded-comfortable text-sm font-medium transition-all ${
                          isActive
                            ? 'text-[var(--accent)]'
                            : 'text-[var(--text-2)] hover:text-[var(--text-1)] hover:bg-[var(--bg-hover)]'
                        }`}
                        style={isActive ? { backgroundColor: 'rgba(94, 106, 210, 0.10)' } : undefined}
                      >
                        <item.icon className={`h-4 w-4 shrink-0 ${isActive ? 'text-[var(--accent)]' : 'text-[var(--text-4)]'}`} />
                        <span className="flex-1 truncate">{item.name}</span>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* User + theme toggle + Logout — Linear style */}
      <div className="px-2 py-3 border-t border-[var(--border-subtle)] space-y-1">
        {/* Theme toggle */}
        <button
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          className="flex items-center gap-2 px-3 py-2 w-full rounded-comfortable text-xs font-medium text-[var(--text-3)] hover:text-[var(--text-2)] hover:bg-[var(--bg-hover)] transition-all cursor-pointer"
          suppressHydrationWarning
        >
          {theme === 'dark'
            ? <Sun className="h-3.5 w-3.5" />
            : <Moon className="h-3.5 w-3.5" />
          }
          {theme === 'dark' ? 'Light' : 'Dark'}
        </button>

        {/* User card — Linear style */}
        <div className="flex items-center gap-2.5 px-2.5 py-2 rounded-comfortable bg-[var(--bg-hover)]/50 border border-[var(--border-subtle)]">
          <div className="h-7 w-7 rounded-comfortable bg-[var(--primary)]/15 flex items-center justify-center text-xs font-medium text-[var(--accent)] shrink-0">
            {username?.[0]?.toUpperCase() || 'A'}
          </div>
          <div className="min-w-0">
            <div className="text-sm font-medium truncate text-[var(--text-1)]">{username}</div>
            <div className="text-[10px] text-[var(--text-4)] uppercase font-medium tracking-wide">{userRole}</div>
          </div>
        </div>

        {/* Logout */}
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 px-2.5 py-1.5 w-full rounded-comfortable text-xs font-medium text-[var(--text-4)] hover:text-red-400 hover:bg-red-500/5 transition-all cursor-pointer"
        >
          <LogOut className="h-3.5 w-3.5" />
          Вийти
        </button>
      </div>
    </aside>
  );
}
