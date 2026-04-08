'use client';

import React, { useState, useEffect } from 'react';
import { Bot, X, Send, Loader2, Sparkles, Zap, History, Settings2, Scissors } from 'lucide-react';

export default function AssistantSidebar() {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [insights, setInsights] = useState<string | null>(null);
  const [chat, setChat] = useState<{ role: 'user' | 'assistant'; content: string }[]>([]);
  const [input, setInput] = useState('');
  
  // Режим работы: Classic или Agentic (сохраняется в local storage)
  const [mounted, setMounted] = useState(false);
  const [isAgentic, setIsAgentic] = useState<boolean>(false);

  useEffect(() => {
    setMounted(true);
    const savedMode = localStorage.getItem('ai_mode');
    if (savedMode === 'agentic') setIsAgentic(true);
  }, []);

  const toggleMode = () => {
    const newMode = !isAgentic;
    setIsAgentic(newMode);
    localStorage.setItem('ai_mode', newMode ? 'agentic' : 'classic');
    // Сбрасываем инсайты при смене режима для чистоты
    setInsights(null);
  };

  const fetchInsights = async () => {
    setLoading(true);
    try {
      const modeParam = isAgentic ? '?mode=agentic' : '?mode=classic';
      const res = await fetch(`/api/ai/assistant${modeParam}`);
      
      if (!res.ok) {
        setInsights(`Ошибка сервера (${res.status}).`);
        return;
      }
      
      const data = await res.json();
      setInsights(data.insights);
    } catch (e) {
      console.error('Fetch error:', e);
      setInsights('Не удалось получить анализ.');
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
          mode: isAgentic ? 'agentic' : 'classic'
        }),
      });
      const data = await res.json();
      setChat(prev => [...prev, { role: 'assistant', content: data.answer }]);
    } catch (e) {
      console.error(e);
      setChat(prev => [...prev, { role: 'assistant', content: 'Ошибка связи с ИИ.' }]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && !insights && chat.length === 0) {
      fetchInsights();
    }
  }, [isOpen, isAgentic, insights, chat.length]);

  if (!mounted) return null;

  return (
    <>
      {/* Кнопка вызова */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className={`fixed bottom-6 right-6 p-4 text-white rounded-full shadow-2xl transition-all z-50 flex items-center gap-2 group ${
            isAgentic 
              ? 'bg-gradient-to-r from-violet-600 to-indigo-600 shadow-indigo-500/40 hover:scale-110 active:scale-95' 
              : 'bg-slate-800 shadow-slate-500/40 hover:bg-slate-700'
          }`}
        >
          <div className="relative">
            <SewingIcon size={24} className="text-white" />
            {isAgentic && <Zap size={10} className="absolute -top-1 -right-1 fill-yellow-400 stroke-yellow-400 animate-pulse" />}
          </div>
          <span className="max-w-0 overflow-hidden group-hover:max-w-xs transition-all duration-300 font-medium whitespace-nowrap">
            {isAgentic ? 'Agentic Швейка' : 'Швейка AI'}
          </span>
        </button>
      )}

      {/* Панель ассистента */}
      <div
        className={`fixed top-0 right-0 h-full w-[400px] bg-white dark:bg-slate-900 shadow-2xl z-50 transform transition-transform duration-300 ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        } flex flex-col border-l dark:border-slate-800`}
      >
        {/* Шапка */}
        <div className={`p-4 border-b dark:border-slate-800 flex justify-between items-center ${
          isAgentic ? 'bg-indigo-50/80 dark:bg-indigo-900/20' : 'bg-slate-50 dark:bg-slate-800/50'
        }`}>
          <div className="flex items-center gap-3">
            <div className={`p-1.5 rounded-lg ${isAgentic ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/30' : 'bg-slate-200 dark:bg-slate-700'}`}>
              <div className="relative">
                <SewingIcon size={18} className={isAgentic ? 'text-white' : 'text-slate-800 dark:text-white'} />
                {isAgentic && <Zap size={8} className="absolute -top-1 -right-1 fill-yellow-400 stroke-yellow-400" />}
              </div>
            </div>
            <div>
              <h2 className="font-bold text-slate-800 dark:text-white text-sm leading-tight">Швейка AI Помічник</h2>
              <span className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">
                {isAgentic ? 'Production Agent v2.0' : 'MES Assistant v1.0'}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button 
              onClick={toggleMode}
              title={isAgentic ? "Вернуться к Classic" : "Попробовать Agentic"}
              className={`p-2 rounded-lg transition-all ${
                isAgentic ? 'text-indigo-600 hover:bg-indigo-100' : 'text-slate-400 hover:bg-slate-100'
              }`}
            >
              <Settings2 size={18} />
            </button>
            <button onClick={() => setIsOpen(false)} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Контент */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {/* Блок Инсайтов (3-30-300) */}
          <div className={`p-5 rounded-2xl border transition-all ${
            isAgentic 
              ? 'bg-gradient-to-br from-indigo-50 to-white dark:from-indigo-900/10 dark:to-slate-900 border-indigo-100 dark:border-indigo-900/30 shadow-sm' 
              : 'bg-slate-50 dark:bg-slate-800/30 border-slate-100 dark:border-slate-800'
          }`}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2 text-indigo-700 dark:text-indigo-400 font-bold text-xs uppercase tracking-widest">
                <Sparkles size={14} /> 
                <span>Оперативный анализ</span>
              </div>
              <button onClick={fetchInsights} className="p-1 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 rounded transition-all">
                <History size={14} className={loading ? 'animate-spin' : ''} />
              </button>
            </div>

            {loading && !insights ? (
              <div className="py-8 flex flex-col items-center justify-center gap-3 text-slate-400 text-sm">
                <Loader2 size={24} className="animate-spin text-indigo-600" />
                <span className="italic animate-pulse">Анализирую производство...</span>
              </div>
            ) : (
              <div className="whitespace-pre-wrap text-sm leading-relaxed text-slate-600 dark:text-slate-300 font-sans">
                {insights || "Нажмите обновить для запуска анализа."}
              </div>
            )}
            
            {isAgentic && !loading && insights && (
              <div className="mt-4 pt-4 border-t border-indigo-100 dark:border-indigo-900/30 flex items-center gap-2 px-1">
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-bold uppercase tracking-tighter">
                  Сгенерировано согласно Domain Skills
                </span>
              </div>
            )}
          </div>

          {/* Чат */}
          <div className="space-y-4">
            {chat.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[85%] p-3.5 rounded-2xl text-[13px] shadow-sm leading-snug ${
                    msg.role === 'user'
                      ? 'bg-indigo-600 text-white rounded-br-none'
                      : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-bl-none border dark:border-slate-700'
                  }`}
                >
                  {msg.content}
                </div>
              </div>
            ))}
            {loading && chat.length > 0 && (
              <div className="flex justify-start">
                <div className="bg-white dark:bg-slate-800 p-3 rounded-2xl rounded-bl-none border dark:border-slate-700 animate-pulse">
                  <div className="flex gap-1.5">
                    <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" />
                    <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce delay-75" />
                    <div className="w-1.5 h-1.5 bg-indigo-600 rounded-full animate-bounce delay-150" />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Поле ввода */}
        <div className="p-4 border-t dark:border-slate-800 bg-white dark:bg-slate-900">
          <div className="relative group">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder="Спросить ассистента..."
              className="w-full p-4 pr-14 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 outline-none transition-all text-sm"
              disabled={loading}
            />
            <button
              onClick={handleSend}
              disabled={loading || !input.trim()}
              className="absolute right-2.5 top-2.5 p-2 bg-indigo-600 text-white hover:bg-indigo-700 rounded-xl transition-all disabled:opacity-50 disabled:bg-slate-400 shadow-md shadow-indigo-500/20"
            >
              <Send size={18} />
            </button>
          </div>
          <div className="flex justify-between items-center mt-3 px-1">
             <p className="text-[10px] text-slate-400">
              Agentic Shveika AI v2.0
            </p>
            {isAgentic && <Zap size={10} className="text-indigo-500 animate-pulse" />}
          </div>
        </div>
      </div>
    </>
  );
}

// Кастомна іконка Швейної Машини
const SewingIcon = ({ className, size = 24 }: { className?: string; size?: number }) => (
  <svg 
    width={size} 
    height={size} 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round"
    className={className}
  >
    <path d="M12 2C12 2 12 18 12 18" /> {/* Голка */}
    <circle cx="12" cy="4" r="1.5" /> {/* Вушко */}
    <path d="M14 4C18 4 21 7 21 11C21 15 18 18 14 18H12" strokeDasharray="2 2" /> {/* Нитка */}
    <path d="M3 20H21" /> {/* Станина */}
    <path d="M5 20V9C5 7.34315 6.34315 6 8 6H12" />
  </svg>
);
