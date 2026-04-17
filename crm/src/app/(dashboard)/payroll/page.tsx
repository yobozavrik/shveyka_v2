'use client';

import { useState, useEffect } from 'react';
import { 
  CircleDollarSign, TrendingUp, Users, Calendar, 
  X, ChevronRight, Loader2 
} from 'lucide-react';

// Типы данных
type EmployeeSummary = {
  id: number;
  name: string;
  role: string;
  position: string;
  department: string;
  totalQty: number;
  totalAmount: number;
  entryCount: number;
};

type HistoryEntry = {
  id: number;
  date: string;
  quantity: number;
  sizes: Record<string, number>;
  batch_number: string;
  order_number: string;
  operation_name: string;
};

const SECTIONS = [
  { id: 'all', label: 'Все сотрудники' },
  { id: 'cutting', label: 'Раскрой' },
  { id: 'sewing', label: 'Пошив' },
  { id: 'overlock', label: 'Оверлок' },
  { id: 'packaging', label: 'Упаковка' },
];

export default function PayrollPage() {
  const [activeSection, setActiveSection] = useState('all');
  const [employees, setEmployees] = useState<EmployeeSummary[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Для модалки
  const [selectedEmployee, setSelectedEmployee] = useState<EmployeeSummary | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // 1. Загрузка сводной информации из API
  useEffect(() => {
    fetch('/api/payroll/summary')
      .then(res => res.json())
      .then(data => {
        setEmployees(data);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  }, []);

  // 2. Функция загрузки истории при клике
  const openHistory = async (emp: EmployeeSummary) => {
    setSelectedEmployee(emp);
    setHistoryLoading(true);
    setHistory([]);

    try {
      const res = await fetch(`/api/employees/${emp.id}/production-history`);
      if (res.ok) {
        const data = await res.json();
        setHistory(data);
      }
    } catch (e) {
      console.error('Failed to load history', e);
    } finally {
      setHistoryLoading(false);
    }
  };

  const filteredEmployees = Array.isArray(employees) ? employees.filter(emp => 
    activeSection === 'all' ? true : emp.role === activeSection
  ) : [];

  const totalAmount = filteredEmployees.reduce((sum, emp) => sum + emp.totalAmount, 0);
  const totalQty = filteredEmployees.reduce((sum, emp) => sum + emp.totalQty, 0);

  return (
    <div className="p-6 space-y-6 text-[var(--text-1)] bg-[var(--bg-base)] min-h-screen">
      
      {/* Шапка */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Нарахування ЗП</h1>
          <p className="text-sm text-[var(--text-3)] mt-1">
            Розрахунок заробітної плати за виробничі операції
          </p>
        </div>
        <div className="flex gap-3">
           <div className="flex items-center gap-2 px-4 py-2 bg-[var(--bg-card2)] rounded-lg border border-[var(--border)]">
             <Calendar className="h-4 w-4 text-[var(--text-3)]" />
             <span className="text-sm font-medium">Квітень 2026</span>
          </div>
        </div>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-[var(--bg-panel)] p-5 rounded-2xl border border-[var(--border)] shadow-sm">
          <div className="flex items-center gap-3 mb-3 text-[var(--text-3)] uppercase text-[10px] font-bold tracking-widest">
            <TrendingUp className="h-4 w-4" /> Фонд ЗП
          </div>
          <div className="text-2xl font-black">₴ {totalAmount.toLocaleString()}</div>
        </div>
        <div className="bg-[var(--bg-panel)] p-5 rounded-2xl border border-[var(--border)] shadow-sm">
          <div className="flex items-center gap-3 mb-3 text-[var(--text-3)] uppercase text-[10px] font-bold tracking-widest">
            <Users className="h-4 w-4" /> Працівників
          </div>
          <div className="text-2xl font-black">{filteredEmployees.length}</div>
        </div>
        <div className="bg-[var(--bg-panel)] p-5 rounded-2xl border border-[var(--border)] shadow-sm">
          <div className="flex items-center gap-3 mb-3 text-[var(--text-3)] uppercase text-[10px] font-bold tracking-widest">
             Виробіток
          </div>
          <div className="text-2xl font-black text-emerald-500">{totalQty.toLocaleString()} од.</div>
        </div>
      </div>

      {/* Вкладки */}
      <div className="flex overflow-x-auto pb-2 gap-2 no-scrollbar">
        {SECTIONS.map((section) => (
          <button
            key={section.id}
            onClick={() => setActiveSection(section.id)}
            className={`
              px-4 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap transition-all border
              ${activeSection === section.id 
                ? 'bg-[var(--primary)] text-white border-[var(--primary)] shadow-md' 
                : 'bg-[var(--bg-card)] text-[var(--text-2)] border-[var(--border)] hover:bg-[var(--bg-hover)]'
              }
            `}
          >
            {section.label}
          </button>
        ))}
      </div>

      {/* Сетка сотрудников */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filteredEmployees.map(emp => (
          <div 
            key={emp.id} 
            onClick={() => openHistory(emp)}
            className="group bg-[var(--bg-panel)] border border-[var(--border)] rounded-2xl p-5 hover:border-[var(--primary)] transition-all cursor-pointer shadow-sm hover:shadow-md"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="h-10 w-10 rounded-full bg-indigo-500/10 flex items-center justify-center text-[var(--primary)] font-bold text-sm">
                {emp.name.charAt(0)}
              </div>
              <div className="text-right">
                <div className="text-lg font-black text-emerald-500">₴ {emp.totalAmount.toLocaleString()}</div>
              </div>
            </div>
            
            <h3 className="font-bold text-base mb-1 group-hover:text-[var(--primary)] transition-colors">{emp.name}</h3>
            
            <div className="space-y-1 text-xs text-[var(--text-2)] mb-4">
              <div className="flex items-center gap-1.5">
                <span className="font-semibold text-[var(--text-1)]">{emp.position}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded text-[10px] uppercase font-bold">{emp.role}</span>
              </div>
            </div>

            <div className="pt-3 border-t border-[var(--border)] flex items-center justify-between text-xs">
              <span className="text-[var(--text-3)]">Виробіток</span>
              <span className="font-bold">{emp.totalQty} од.</span>
            </div>
          </div>
        ))}
      </div>

      {/* МОДАЛЬНОЕ ОКНО ИСТОРИИ */}
      {selectedEmployee && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur p-4">
          <div className="bg-[var(--bg-panel)] w-full max-w-4xl max-h-[90vh] rounded-2xl border border-[var(--border)] shadow-2xl flex flex-col">
            
            {/* Header */}
            <div className="p-5 border-b border-[var(--border)] flex items-center justify-between bg-[var(--bg-card2)]">
              <div>
                <h2 className="text-xl font-black text-[var(--text-1)]">
                  Історія виробітку: {selectedEmployee.name}
                </h2>
                <p className="text-xs text-[var(--text-3)] mt-1">
                  {selectedEmployee.position} • {selectedEmployee.department}
                </p>
              </div>
              <button 
                onClick={() => setSelectedEmployee(null)}
                className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Content */}
            <div className="overflow-y-auto p-0 flex-1">
              {historyLoading ? (
                <div className="flex flex-col items-center justify-center py-20 text-[var(--text-3)]">
                  <Loader2 className="h-8 w-8 animate-spin mb-3" />
                  Завантаження історії...
                </div>
              ) : history.length === 0 ? (
                <div className="text-center py-20 text-[var(--text-3)]">
                  Немає підтверджених записів
                </div>
              ) : (
                <table className="w-full text-left text-sm">
                  <thead className="bg-[var(--bg-card2)] sticky top-0 z-10">
                    <tr>
                      <th className="px-6 py-3 text-[10px] font-bold uppercase tracking-wider text-[var(--text-3)]">Дата</th>
                      <th className="px-6 py-3 text-[10px] font-bold uppercase tracking-wider text-[var(--text-3)]">Заказ / Партия</th>
                      <th className="px-6 py-3 text-[10px] font-bold uppercase tracking-wider text-[var(--text-3)]">Операція</th>
                      <th className="px-6 py-3 text-[10px] font-bold uppercase tracking-wider text-[var(--text-3)] text-right">Кількість</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border)]">
                    {history.map(row => (
                      <tr key={row.id} className="hover:bg-[var(--bg-hover)]">
                        <td className="px-6 py-4 text-[var(--text-2)]">
                          {new Date(row.date).toLocaleDateString('uk-UA')}
                        </td>
                        <td className="px-6 py-4">
                          <div className="font-bold text-[var(--text-1)]">Зам. {row.order_number}</div>
                          <div className="text-xs text-[var(--text-3)]">Партія {row.batch_number}</div>
                        </td>
                        <td className="px-6 py-4 font-medium">{row.operation_name}</td>
                        <td className="px-6 py-4 text-right font-black text-emerald-500">
                          {row.quantity}
                          {/* Если есть размеры, показываем их */}
                          {Object.keys(row.sizes).length > 0 && (
                             <div className="text-[10px] font-bold text-[var(--text-3)] mt-1">
                               {Object.entries(row.sizes).map(([s, q]) => `${s}:${q}`).join(', ')}
                             </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}