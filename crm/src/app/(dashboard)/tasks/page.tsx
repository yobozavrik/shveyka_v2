'use client';

import { 
  Plus, Calendar as CalendarIcon, ListTodo, ChevronLeft, ChevronRight, 
  Clock, CheckCircle2, Circle, AlertCircle, Share2, Smartphone, Loader2
} from 'lucide-react';
import { useState } from 'react';

type Task = {
  id: string;
  title: string;
  date: string;
  priority: 'high' | 'medium' | 'low';
  status: 'todo' | 'done';
  category: string;
};

const MOCK_TASKS: Task[] = [
  { id: '1', title: 'Здати звіт по виробництву', date: '2026-04-02', priority: 'high', status: 'todo', category: 'Виробництво' },
  { id: '2', title: 'Зустріч з постачальником тканин', date: '2026-04-03', priority: 'medium', status: 'todo', category: 'Постачання' },
  { id: '3', title: 'Перевірка якості партії #42', date: '2026-04-02', priority: 'high', status: 'done', category: 'QC' },
  { id: '4', title: 'Оплата оренди цеху', date: '2026-04-05', priority: 'low', status: 'todo', category: 'Фінанси' },
];

export default function TasksPage() {
  const [view, setView] = useState<'list' | 'calendar'>('calendar');
  const [currentDate, setCurrentDate] = useState(new Date(2026, 3, 2)); // April 2026
  
  const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
  const firstDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getDay(); // 0 is Sunday
  
  // Adjusted for Monday start (standard in Ukraine)
  const startOffset = (firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1);
  
  const calendarDays = Array.from({ length: 42 }, (_, i) => {
    const day = i - startOffset + 1;
    return day > 0 && day <= daysInMonth ? day : null;
  });

  const getDayTasks = (day: number) => {
    const dateStr = `2026-04-${String(day).padStart(2, '0')}`;
    return MOCK_TASKS.filter(t => t.date === dateStr);
  };

  return (
    <div className="p-6 space-y-6 flex flex-col h-[calc(100vh-64px)]">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-1)]">Задачі та планувальник</h1>
          <p className="text-sm text-[var(--text-3)] mt-1">Організація робочого процесу та дедлайнів</p>
        </div>
        
        <div className="flex items-center gap-2 bg-[var(--bg-card2)] p-1 rounded-xl border border-[var(--border)]">
          <button
            onClick={() => setView('calendar')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${
              view === 'calendar' ? 'bg-[var(--bg-card)] shadow-sm text-emerald-500' : 'text-[var(--text-3)] hover:text-[var(--text-1)]'
            }`}
          >
            <CalendarIcon className="h-4 w-4" /> Календар
          </button>
          <button 
            onClick={() => setView('list')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${
              view === 'list' ? 'bg-[var(--bg-card)] shadow-sm text-emerald-500' : 'text-[var(--text-3)] hover:text-[var(--text-1)]'
            }`}
          >
            <ListTodo className="h-4 w-4" /> Список
          </button>
        </div>
      </div>

      <div className="flex-1 flex flex-col min-h-0 gap-6">
        {view === 'calendar' ? (
          <div className="flex-1 flex flex-col gap-4 min-h-0">
            {/* Month Nav */}
            <div className="flex items-center justify-between bg-[var(--bg-panel)] p-4 rounded-2xl border border-[var(--border)]">
              <div className="flex items-center gap-4">
                <h2 className="text-xl font-bold capitalize text-[var(--text-1)]">
                  {currentDate.toLocaleString('uk-UA', { month: 'long', year: 'numeric' })}
                </h2>
                <div className="flex items-center gap-1">
                  <button className="p-1.5 hover:bg-[var(--bg-hover)] rounded-lg transition-colors">
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                  <button className="p-1.5 hover:bg-[var(--bg-hover)] rounded-lg transition-colors">
                    <ChevronRight className="h-5 w-5" />
                  </button>
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                <button className="flex items-center gap-2 px-3 py-1.5 text-xs font-bold text-emerald-600 bg-emerald-500/10 rounded-lg hover:bg-emerald-500/20 transition-all">
                  <Smartphone className="h-4 w-4" /> Синхронізувати (Google/iOS)
                </button>
                <button className="flex items-center gap-2 px-4 py-1.5 text-xs font-bold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-all">
                  <Plus className="h-4 w-4" /> Нова задача
                </button>
              </div>
            </div>

            {/* Grid */}
            <div className="flex-1 bg-[var(--bg-panel)] rounded-2xl border border-[var(--border)] overflow-hidden flex flex-col shadow-sm">
              <div className="grid grid-cols-7 border-b border-[var(--border)] bg-[var(--bg-card2)]">
                {['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд'].map(d => (
                  <div key={d} className="py-2 text-center text-[10px] font-black uppercase tracking-widest text-[var(--text-3)]">{d}</div>
                ))}
              </div>
              <div className="flex-1 grid grid-cols-7 auto-rows-fr">
                {calendarDays.map((day, i) => {
                  const tasks = day ? getDayTasks(day) : [];
                  const isToday = day === 2;
                  return (
                    <div 
                      key={i} 
                      className={`min-h-[100px] border-r border-b border-[var(--border)] p-2 transition-colors hover:bg-[var(--bg-hover)] group relative ${
                        !day ? 'bg-[var(--bg-card2)]' : ''
                      }`}
                    >
                      {day && (
                        <>
                          <div className={`text-xs font-bold mb-1 ${isToday ? 'bg-emerald-600 text-white h-6 w-6 rounded-full flex items-center justify-center -ml-1 -mt-1' : 'text-[var(--text-3)]'}`}>
                            {day}
                          </div>
                          <div className="space-y-1">
                            {tasks.map(t => (
                              <div 
                                key={t.id} 
                                className={`text-[10px] p-1.5 rounded-lg border flex flex-col gap-0.5 truncate ${
                                  t.priority === 'high' ? 'bg-rose-500/10 border-rose-500/20 text-rose-600' : 
                                  t.priority === 'medium' ? 'bg-yellow-500/10 border-yellow-500/20 text-yellow-600' : 
                                  'bg-emerald-500/10 border-emerald-500/20 text-emerald-600'
                                } ${t.status === 'done' ? 'opacity-50 line-through' : ''}`}
                              >
                                <div className="font-bold">{t.title}</div>
                              </div>
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto space-y-8 pr-2 custom-scrollbar">
            {['На сьогодні', 'Найближчі', 'Пізніше'].map((section, idx) => (
              <div key={section} className="space-y-4">
                <div className="flex items-center gap-3">
                  <h3 className="font-black text-sm uppercase tracking-widest text-[var(--text-3)]">{section}</h3>
                  <div className="h-[1px] flex-1 bg-[var(--border)]"></div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {MOCK_TASKS.filter(t => (idx === 0 ? t.date === '2026-04-02' : t.date !== '2026-04-02')).map(t => (
                    <div key={t.id} className="bg-[var(--bg-panel)] p-4 rounded-2xl border border-[var(--border)] hover:border-emerald-500/50 transition-all cursor-pointer group shadow-sm">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <div className={`h-2.5 w-2.5 rounded-full ${
                            t.priority === 'high' ? 'bg-rose-500' : t.priority === 'medium' ? 'bg-yellow-500' : 'bg-emerald-500'
                          }`}></div>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-3)]">{t.category}</span>
                        </div>
                        <button className="p-1 hover:bg-[var(--bg-hover)] rounded-lg opacity-0 group-hover:opacity-100 transition-all">
                          <Share2 className="h-4 w-4 text-[var(--text-3)]" />
                        </button>
                      </div>
                      <h4 className={`font-bold text-[var(--text-1)] mb-4 ${t.status === 'done' ? 'line-through text-[var(--text-3)]' : ''}`}>{t.title}</h4>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 text-xs text-[var(--text-3)]">
                          <Clock className="h-3.5 w-3.5" />
                          {new Date(t.date).toLocaleDateString('uk-UA', { day: 'numeric', month: 'short' })}
                        </div>
                        <button className={`p-1 rounded-full transition-colors ${t.status === 'done' ? 'text-emerald-500' : 'text-[var(--text-3)] hover:text-emerald-500'}`}>
                          {t.status === 'done' ? <CheckCircle2 className="h-5 w-5" /> : <Circle className="h-5 w-5" />}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Sync Footer Mock */}
      <div className="shrink-0 bg-emerald-500/5 border border-emerald-500/10 p-4 rounded-2xl flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 bg-emerald-500/10 rounded-xl flex items-center justify-center text-emerald-600">
            <Smartphone className="h-6 w-6" />
          </div>
          <div>
            <div className="text-sm font-bold text-[var(--text-1)]">Мобільний доступ</div>
            <div className="text-xs text-[var(--text-3)]">Ви можете підключити Google Calendar або Apple Calendar для синхронізації задач.</div>
          </div>
        </div>
        <button className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-700 transition-all shadow-md shadow-emerald-600/10">
          Підключити календар
        </button>
      </div>
    </div>
  );
}
