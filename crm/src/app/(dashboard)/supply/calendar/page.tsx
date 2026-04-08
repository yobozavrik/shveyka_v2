'use client';

import { useState, useEffect, useCallback } from 'react';
import { 
  Calendar as CalendarIcon, DollarSign, AlertTriangle, CheckCircle2, Clock, Loader2, ChevronLeft, ChevronRight
} from 'lucide-react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isToday, addMonths, subMonths, isPast, parseISO } from 'date-fns';
import { uk } from 'date-fns/locale';

interface Payment {
  id: number;
  doc_number: string;
  supplier_name: string;
  amount: number;
  due_date: string;
  status: 'pending' | 'paid' | 'overdue';
  supply_document_id: number;
}

const STATUS_CONFIG = {
  pending: { label: 'Очікує', color: 'bg-amber-100 text-amber-700 border-amber-200', icon: Clock },
  paid: { label: 'Оплачено', color: 'bg-emerald-100 text-emerald-700 border-emerald-200', icon: CheckCircle2 },
  overdue: { label: 'Прострочено', color: 'bg-red-100 text-red-700 border-red-200', icon: AlertTriangle },
};

export default function PaymentCalendarPage() {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);

  const loadPayments = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/warehouse/supply-documents');
      const data = await res.json();
      
      if (Array.isArray(data)) {
        const paymentData: Payment[] = data
          .filter((doc: any) => doc.status !== 'confirmed')
          .map((doc: any) => ({
            id: doc.id,
            doc_number: doc.doc_number,
            supplier_name: doc.suppliers?.name || 'Невідомий постачальник',
            amount: doc.total_amount,
            due_date: doc.doc_date,
            status: isPast(parseISO(doc.doc_date)) ? 'overdue' : 'pending',
            supply_document_id: doc.id,
          }));
        setPayments(paymentData);
      }
    } catch (e) {
      console.error('Error loading payments:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadPayments(); }, [loadPayments]);

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

  const getPaymentsForDay = (date: Date) => {
    return payments.filter(p => {
      const paymentDate = parseISO(p.due_date);
      return format(paymentDate, 'yyyy-MM-dd') === format(date, 'yyyy-MM-dd');
    });
  };

  const totalPending = payments.filter(p => p.status === 'pending').reduce((sum, p) => sum + p.amount, 0);
  const totalOverdue = payments.filter(p => p.status === 'overdue').reduce((sum, p) => sum + p.amount, 0);

  const prevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));
  const nextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));

  return (
    <div className="flex gap-6 h-full border-t border-transparent">
      <div className="flex-1 flex flex-col gap-6">
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2.5 bg-amber-500/10 rounded-xl">
                <Clock className="h-5 w-5 text-amber-600" />
              </div>
              <span className="text-sm font-bold text-[var(--text-3)] uppercase">До сплати</span>
            </div>
            <p className="text-2xl font-black text-[var(--text-1)]">
              {new Intl.NumberFormat('uk-UA', { style: 'currency', currency: 'UAH' }).format(totalPending)}
            </p>
          </div>
          
          <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2.5 bg-red-500/10 rounded-xl">
                <AlertTriangle className="h-5 w-5 text-red-600" />
              </div>
              <span className="text-sm font-bold text-[var(--text-3)] uppercase">Прострочено</span>
            </div>
            <p className="text-2xl font-black text-red-600">
              {new Intl.NumberFormat('uk-UA', { style: 'currency', currency: 'UAH' }).format(totalOverdue)}
            </p>
          </div>
          
          <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2.5 bg-indigo-500/10 rounded-xl">
                <DollarSign className="h-5 w-5 text-indigo-600" />
              </div>
              <span className="text-sm font-bold text-[var(--text-3)] uppercase">Всього</span>
            </div>
            <p className="text-2xl font-black text-[var(--text-1)]">
              {payments.length} платежів
            </p>
          </div>
        </div>

        <div className="flex-1 bg-[var(--bg-card)] border border-[var(--border)] rounded-[24px] shadow-sm flex flex-col overflow-hidden">
          <div className="p-4 border-b border-[var(--border)] flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button onClick={prevMonth} className="p-2 hover:bg-[var(--bg-card2)] rounded-xl transition-colors">
                <ChevronLeft className="h-5 w-5 text-[var(--text-2)]" />
              </button>
              <h2 className="text-xl font-black text-[var(--text-1)] capitalize">
                {format(currentMonth, 'MMMM yyyy', { locale: uk })}
              </h2>
              <button onClick={nextMonth} className="p-2 hover:bg-[var(--bg-card2)] rounded-xl transition-colors">
                <ChevronRight className="h-5 w-5 text-[var(--text-2)]" />
              </button>
            </div>
            <button 
              onClick={() => setCurrentMonth(new Date())}
              className="px-4 py-2 text-sm font-bold text-indigo-600 hover:bg-indigo-500/10 rounded-xl transition-colors"
            >
              Сьогодні
            </button>
          </div>

          {loading ? (
            <div className="flex-1 flex items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
            </div>
          ) : (
            <div className="flex-1 p-4 overflow-auto">
              <div className="grid grid-cols-7 gap-1 mb-2">
                {['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд'].map(day => (
                  <div key={day} className="text-center text-xs font-bold text-[var(--text-3)] uppercase py-2">
                    {day}
                  </div>
                ))}
              </div>
              
              <div className="grid grid-cols-7 gap-1">
                {Array.from({ length: (monthStart.getDay() + 6) % 7 }).map((_, i) => (
                  <div key={`empty-${i}`} className="aspect-square" />
                ))}
                
                {days.map((day, idx) => {
                  const dayPayments = getPaymentsForDay(day);
                  const hasPayments = dayPayments.length > 0;
                  const hasOverdue = dayPayments.some(p => p.status === 'overdue');
                  
                  return (
                    <div
                      key={idx}
                      onClick={() => dayPayments.length > 0 && setSelectedPayment(dayPayments[0])}
                      className={`aspect-square border rounded-xl p-1.5 flex flex-col items-center justify-start cursor-pointer transition-all ${
                        isToday(day) 
                          ? 'bg-indigo-500/10 border-indigo-500/30' 
                          : hasOverdue
                          ? 'bg-red-500/5 border-red-500/20 hover:bg-red-500/10'
                          : hasPayments
                          ? 'bg-amber-500/5 border-amber-500/20 hover:bg-amber-500/10'
                          : 'border-[var(--border)] hover:bg-[var(--bg-card2)]'
                      }`}
                    >
                      <span className={`text-sm font-bold ${isToday(day) ? 'text-indigo-600' : 'text-[var(--text-1)]'}`}>
                        {format(day, 'd')}
                      </span>
                      {hasPayments && (
                        <div className="mt-1 flex flex-wrap gap-0.5 justify-center">
                          {dayPayments.slice(0, 3).map((p, i) => (
                            <div 
                              key={i}
                              className={`w-1.5 h-1.5 rounded-full ${
                                p.status === 'overdue' ? 'bg-red-500' : 'bg-amber-500'
                              }`}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="w-[380px] bg-[var(--bg-card)] border border-[var(--border)] rounded-[24px] shadow-sm flex flex-col overflow-hidden">
        <div className="p-4 border-b border-[var(--border)]">
          <h3 className="text-lg font-black text-[var(--text-1)] flex items-center gap-2">
            <CalendarIcon className="h-5 w-5 text-indigo-500" />
            Очікують оплати
          </h3>
        </div>
        
        <div className="flex-1 overflow-auto custom-scrollbar">
          {payments.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-[var(--text-3)] p-6">
              <CheckCircle2 className="h-12 w-12 mb-3 opacity-20" />
              <p className="font-bold">Всі платежі виконано</p>
            </div>
          ) : (
            <div className="p-3 space-y-2">
              {payments
                .sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime())
                .map(payment => {
                  const statusConfig = STATUS_CONFIG[payment.status];
                  return (
                    <div 
                      key={payment.id}
                      onClick={() => setSelectedPayment(payment)}
                      className={`p-4 rounded-xl border cursor-pointer transition-all ${
                        selectedPayment?.id === payment.id 
                          ? 'bg-indigo-500/10 border-indigo-500/30' 
                          : 'hover:bg-[var(--bg-card2)] border-[var(--border)]'
                      }`}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <p className="font-bold text-sm text-[var(--text-1)]">{payment.supplier_name}</p>
                          <p className="text-xs text-[var(--text-3)] font-mono">{payment.doc_number}</p>
                        </div>
                        <span className={`text-[10px] font-bold px-2 py-1 rounded-lg border ${statusConfig.color}`}>
                          {statusConfig.label}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-[var(--text-3)]">
                          {format(parseISO(payment.due_date), 'd MMM yyyy', { locale: uk })}
                        </span>
                        <span className="text-sm font-black text-[var(--text-1)]">
                          {new Intl.NumberFormat('uk-UA', { style: 'currency', currency: 'UAH', minimumFractionDigits: 0 }).format(payment.amount)}
                        </span>
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      </div>

      <style jsx>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: var(--border); border-radius: 10px; }
      `}</style>
    </div>
  );
}
