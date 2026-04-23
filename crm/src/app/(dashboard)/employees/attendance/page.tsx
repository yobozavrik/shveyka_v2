'use client';

import { useState, useEffect } from 'react';
import { Clock, User, Calendar, Loader2, ArrowRight } from 'lucide-react';
import { format } from 'date-fns';
import { uk } from 'date-fns/locale';

export default function AttendancePage() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    try {
      const res = await fetch('/api/attendance'); // We need this API or use the existing active one + history
      const data = await res.json();
      if (res.ok) setLogs(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl overflow-hidden shadow-sm">
      <div className="p-6 border-b border-[var(--border)] bg-[var(--bg-card)]/50">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <Clock className="h-5 w-5 text-indigo-500" />
          Робочий табель (Активність)
        </h2>
        <p className="text-xs text-[var(--text-3)] mt-1 uppercase font-bold tracking-wider">Лог входу та виходу з системи</p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-[var(--bg-card2)] text-[var(--text-2)] font-medium">
            <tr>
              <th className="px-6 py-4">Співробітник</th>
              <th className="px-6 py-4">Дата</th>
              <th className="px-6 py-4">Вхід</th>
              <th className="px-6 py-4">Вихід</th>
              <th className="px-6 py-4">Тривалість</th>
              <th className="px-6 py-4">Статус</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {loading ? (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center">
                  <Loader2 className="h-8 w-8 animate-spin mx-auto text-indigo-500" />
                </td>
              </tr>
            ) : logs.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-[var(--text-2)]">
                  Записів не знайдено. Спробуйте увійти в мобільний додаток.
                </td>
              </tr>
            ) : logs.map((log) => (
              <tr key={log.id} className="hover:bg-[var(--bg-hover)] transition-colors">
                <td className="px-6 py-4 font-medium flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-indigo-500/10 flex items-center justify-center text-indigo-500 font-bold text-xs">
                    {log.employees?.full_name?.[0]}
                  </div>
                  {log.employees?.full_name || 'Невідомо'}
                </td>
                <td className="px-6 py-4 text-[var(--text-2)] uppercase text-[10px] font-bold">
                  {format(new Date(log.check_in), 'dd MMMM yyyy', { locale: uk })}
                </td>
                <td className="px-6 py-4 font-mono text-emerald-500 font-bold">
                  {format(new Date(log.check_in), 'HH:mm:ss')}
                </td>
                <td className="px-6 py-4 font-mono text-[var(--text-3)]">
                  {log.check_out ? format(new Date(log.check_out), 'HH:mm:ss') : '--:--:--'}
                </td>
                <td className="px-6 py-4 text-[var(--text-2)]">
                   {log.check_out ? '8 год' : 'В процесі'} 
                </td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                    log.status === 'active' ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' : 'bg-slate-500/10 text-slate-500'
                  }`}>
                    {log.status === 'active' ? 'На роботі' : 'Завершено'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
