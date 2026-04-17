'use client';

import React, { useState } from 'react';
import { Send, Loader2, FileText, AlertTriangle, TrendingUp } from 'lucide-react';

interface OrderAssistantProps {
  orderId: number;
}

const CONTEXT_PROMPTS = [
  { label: 'Что блокирует заказ?', icon: AlertTriangle, prompt: 'Какие блокирующие факторы у заказа?' },
  { label: 'Следующий шаг', icon: TrendingUp, prompt: 'Что делать дальше с заказом?' },
  { label: 'Риски по сроку', icon: AlertTriangle, prompt: 'Какие риски по сроку выполнения?' },
  { label: 'Влияние на ЗП', icon: FileText, prompt: 'Как это влияет на зарплату?' }
];

export default function OrderAssistant({ orderId }: OrderAssistantProps) {
  const [loading, setLoading] = useState(false);
  const [answer, setAnswer] = useState<string | null>(null);
  const [citations, setCitations] = useState<any[]>([]);
  
  const askQuestion = async (question: string) => {
    setLoading(true);
    setAnswer(null);
    
    try {
      const res = await fetch('/api/ai/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question,
          context: { order_id: orderId },
          mode: 'agentic'
        })
      });
      
      const data = await res.json();
      setAnswer(data.answer);
      setCitations(data.citations || []);
    } catch (e) {
      console.error(e);
      setAnswer('Ошибка связи с ассистентом');
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] p-4">
      <h3 className="font-bold text-sm mb-3 flex items-center gap-2 text-[var(--text-1)]">
        <FileText size={16} />
        AI Асистент
      </h3>

      <div className="space-y-2 mb-4">
        {CONTEXT_PROMPTS.map((cp) => (
          <button
            key={cp.label}
            onClick={() => askQuestion(cp.prompt)}
            disabled={loading}
            className="w-full text-left px-3 py-2 bg-[var(--bg-card2)] hover:bg-[var(--bg-hover)] rounded-lg text-sm transition-colors flex items-center gap-2 disabled:opacity-50"
          >
            <cp.icon size={14} className="text-[var(--accent)]" />
            {cp.label}
          </button>
        ))}
      </div>

      {loading && (
        <div className="py-4 flex items-center justify-center gap-2 text-[var(--text-3)] text-sm">
          <Loader2 size={16} className="animate-spin" />
          Аналізую...
        </div>
      )}

      {answer && !loading && (
        <div className="mt-4 space-y-3">
          <div className="text-sm text-[var(--text-2)] whitespace-pre-wrap">
            {answer}
          </div>

          {citations.length > 0 && (
            <div className="pt-3 border-t border-[var(--border-subtle)]">
              <p className="text-xs text-[var(--text-3)] mb-2">Джерела:</p>
              <div className="space-y-1">
                {citations.map((c, i) => (
                  <div key={i} className="text-xs text-[var(--accent)]">
                    📄 {c.title || c.source}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
