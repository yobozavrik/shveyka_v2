'use client';

import React, { useState } from 'react';
import { Calculator, TrendingDown, HelpCircle } from 'lucide-react';

interface PayrollAssistantProps {
  workerId?: number;
  periodId?: number;
}

const CONTEXT_PROMPTS = [
  { label: 'Почему такая сумма?', icon: Calculator, prompt: 'Объясни расчет зарплаты' },
  { label: 'Какие записи вошли?', icon: HelpCircle, prompt: 'Какие записи вошли в расчет?' },
  { label: 'Спорные записи', icon: TrendingDown, prompt: 'Есть ли спорные записи?' }
];

export default function PayrollAssistant({ workerId, periodId }: PayrollAssistantProps) {
  const [loading, setLoading] = useState(false);
  const [answer, setAnswer] = useState<string | null>(null);
  
  const askQuestion = async (question: string) => {
    setLoading(true);
    setAnswer(null);
    
    try {
      const res = await fetch('/api/ai/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question,
          context: { worker_id: workerId, period_id: periodId },
          mode: 'agentic'
        })
      });
      
      const data = await res.json();
      setAnswer(data.answer);
    } catch (e) {
      console.error(e);
      setAnswer('Ошибка связи');
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div className="bg-[var(--bg-card2)] rounded-lg p-3">
      <div className="flex flex-wrap gap-2">
        {CONTEXT_PROMPTS.map((cp) => (
          <button
            key={cp.label}
            onClick={() => askQuestion(cp.prompt)}
            disabled={loading}
            className="px-3 py-1.5 bg-[var(--bg-card)] rounded-md text-xs hover:bg-[var(--bg-hover)] transition-colors flex items-center gap-1.5 disabled:opacity-50"
          >
            <cp.icon size={12} />
            {cp.label}
          </button>
        ))}
      </div>

      {answer && (
        <div className="mt-3 text-sm text-[var(--text-2)]">
          {answer}
        </div>
      )}
    </div>
  );
}
