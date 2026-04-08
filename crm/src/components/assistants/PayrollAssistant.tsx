'use client';

import React, { useState } from 'react';
import { HelpCircle, X, Loader2, MessageCircle, Send, DollarSign } from 'lucide-react';

interface PayrollAssistantProps {
  employeeId?: number;
  employeeName?: string;
  periodId?: number;
  periodName?: string;
}

export function PayrollAssistant({ employeeId, employeeName, periodId, periodName }: PayrollAssistantProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [explanation, setExplanation] = useState<string | null>(null);
  const [chat, setChat] = useState<{ role: 'user' | 'assistant'; content: string }[]>([]);
  const [input, setInput] = useState('');

  const fetchExplanation = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('action', 'explain-payroll');
      if (employeeId) params.set('employeeId', employeeId.toString());
      if (periodId) params.set('periodId', periodId.toString());
      
      const res = await fetch(`/api/ai/assistant?${params.toString()}`);
      const data = await res.json();
      setExplanation(data.explanation);
    } catch (e) {
      setExplanation('Не удалось получить объяснение.');
    } finally {
      setLoading(false);
    }
  };

  const handleSend = async () => {
    if (!input.trim()) return;
    const userMsg = { role: 'user' as const, content: input };
    setChat(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const res = await fetch('/api/ai/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: input,
          history: chat.map(m => ({ role: m.role, content: m.content })),
          mode: 'agentic'
        }),
      });
      const data = await res.json();
      setChat(prev => [...prev, { role: 'assistant', content: data.answer }]);
    } catch (e) {
      setChat(prev => [...prev, { role: 'assistant', content: 'Ошибка связи с ИИ.' }]);
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    if (isOpen && !explanation) {
      fetchExplanation();
    }
  }, [isOpen, employeeId, periodId]);

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 px-3 py-2 text-sm bg-green-50 hover:bg-green-100 text-green-700 rounded-lg transition-colors"
        title="Объяснить расчет зарплаты"
      >
        <DollarSign size={16} />
        <span>Объяснить</span>
      </button>

      {isOpen && (
        <div className="fixed bottom-4 right-4 w-96 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl z-50 border border-slate-200 dark:border-slate-700 flex flex-col max-h-[70vh]">
          <div className="p-4 border-b dark:border-slate-700 flex justify-between items-center bg-green-50 dark:bg-green-900/20 rounded-t-2xl">
            <div className="flex items-center gap-2">
              <DollarSign size={18} className="text-green-600" />
              <div>
                <h3 className="font-semibold text-sm text-slate-800 dark:text-white">
                  {employeeName || 'Расчет зарплаты'}
                </h3>
                <span className="text-xs text-slate-500">{periodName || 'Текущий период'}</span>
              </div>
            </div>
            <button onClick={() => setIsOpen(false)} className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg">
              <X size={16} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {loading && !explanation ? (
              <div className="flex items-center justify-center py-8 gap-2 text-slate-400">
                <Loader2 size={20} className="animate-spin" />
                <span className="text-sm">Анализирую расчет...</span>
              </div>
            ) : (
              <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl text-sm">
                <div className="text-xs text-green-600 font-semibold mb-2 uppercase tracking-wider">Структура оплаты</div>
                <div className="whitespace-pre-wrap text-slate-600 dark:text-slate-300">{explanation}</div>
              </div>
            )}

            {chat.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] p-3 rounded-xl text-sm ${
                  msg.role === 'user'
                    ? 'bg-green-600 text-white rounded-br-none'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-bl-none'
                }`}>
                  {msg.content}
                </div>
              </div>
            ))}
          </div>

          <div className="p-3 border-t dark:border-slate-700">
            <div className="relative">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                placeholder="Спросить о зарплате..."
                className="w-full p-3 pr-12 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-green-500/50 outline-none"
                disabled={loading}
              />
              <button
                onClick={handleSend}
                disabled={loading || !input.trim()}
                className="absolute right-2 top-2 p-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
              >
                <Send size={16} />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
