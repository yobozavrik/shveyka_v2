'use client';

import React, { useState } from 'react';
import { HelpCircle, X, Loader2, MessageCircle, Send } from 'lucide-react';

interface OrderAssistantProps {
  orderId: number;
  orderNumber?: string;
  orderStatus?: string;
}

export function OrderAssistant({ orderId, orderNumber, orderStatus }: OrderAssistantProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [explanation, setExplanation] = useState<string | null>(null);
  const [chat, setChat] = useState<{ role: 'user' | 'assistant'; content: string }[]>([]);
  const [input, setInput] = useState('');

  const fetchExplanation = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/ai/assistant?action=explain-order&orderId=${orderId}`);
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
  }, [isOpen, orderId]);

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 px-3 py-2 text-sm bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 rounded-lg transition-colors"
        title="Пояснити статус замовлення"
      >
        <HelpCircle size={16} />
        <span>Пояснити</span>
      </button>

      {isOpen && (
        <div className="fixed bottom-4 right-4 w-96 bg-[var(--bg-card)] rounded-2xl shadow-2xl z-50 border border-[var(--border)] flex flex-col max-h-[70vh]">
          <div className="p-4 border-b border-[var(--border)] flex justify-between items-center bg-blue-500/10 rounded-t-2xl">
            <div className="flex items-center gap-2">
              <MessageCircle size={18} className="text-blue-500" />
              <div>
                <h3 className="font-semibold text-sm text-[var(--text-1)]">
                  Замовлення #{orderNumber || orderId}
                </h3>
                <span className="text-xs text-[var(--text-3)]">AI Асистент</span>
              </div>
            </div>
            <button onClick={() => setIsOpen(false)} className="p-1 hover:bg-[var(--bg-hover)] rounded-lg">
              <X size={16} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {loading && !explanation ? (
              <div className="flex items-center justify-center py-8 gap-2 text-[var(--text-3)]">
                <Loader2 size={20} className="animate-spin" />
                <span className="text-sm">Аналізую замовлення...</span>
              </div>
            ) : (
              <div className="p-3 bg-[var(--bg-card2)] rounded-xl text-sm">
                <div className="text-xs text-blue-500 font-semibold mb-2 uppercase tracking-wider">Статус: {orderStatus}</div>
                <div className="whitespace-pre-wrap text-[var(--text-2)]">{explanation}</div>
              </div>
            )}

            {chat.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] p-3 rounded-xl text-sm ${
                  msg.role === 'user'
                    ? 'bg-blue-600 text-white rounded-br-none'
                    : 'bg-[var(--bg-card2)] text-[var(--text-2)] rounded-bl-none'
                }`}>
                  {msg.content}
                </div>
              </div>
            ))}
          </div>

          <div className="p-3 border-t border-[var(--border)]">
            <div className="relative">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                placeholder="Запитати про замовлення..."
                className="w-full p-3 pr-12 bg-[var(--bg-card2)] border border-[var(--border)] rounded-xl text-sm focus:ring-2 focus:ring-blue-500/50 outline-none"
                disabled={loading}
              />
              <button
                onClick={handleSend}
                disabled={loading || !input.trim()}
                className="absolute right-2 top-2 p-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
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
