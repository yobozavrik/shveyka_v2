'use client';

import { FileText, Play, CheckCircle } from 'lucide-react';

export default function TrainingPage() {
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-1)]">Навчання</h1>
          <p className="text-sm text-[var(--text-3)] mt-1">
            Курси та тренінги для працівників
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Placeholder cards */}
        <div className="bg-[var(--bg-panel)] p-5 rounded-2xl border border-[var(--border)] shadow-sm">
          <div className="flex items-start justify-between mb-4">
            <div className="h-10 w-10 bg-emerald-500/10 text-emerald-500 rounded-xl flex items-center justify-center">
              <Play className="h-5 w-5" />
            </div>
            <span className="px-2.5 py-1 bg-yellow-500/10 text-yellow-600 text-[10px] font-bold uppercase rounded-full">В процесі</span>
          </div>
          <h3 className="font-bold text-lg text-[var(--text-1)] mb-1">Основи оверлоку</h3>
          <p className="text-sm text-[var(--text-3)] mb-4">Базовий курс для новачків.</p>
          <div className="w-full bg-[var(--bg-card2)] rounded-full h-1.5 mb-2">
            <div className="bg-emerald-500 h-1.5 rounded-full" style={{ width: '45%' }}></div>
          </div>
          <div className="text-xs text-[var(--text-3)] text-right">45% пройдено</div>
        </div>

        <div className="bg-[var(--bg-panel)] p-5 rounded-2xl border border-[var(--border)] shadow-sm opacity-60">
          <div className="flex items-start justify-between mb-4">
            <div className="h-10 w-10 bg-emerald-500/10 text-emerald-500 rounded-xl flex items-center justify-center">
              <CheckCircle className="h-5 w-5" />
            </div>
            <span className="px-2.5 py-1 bg-emerald-500/10 text-emerald-600 text-[10px] font-bold uppercase rounded-full">Завершено</span>
          </div>
          <h3 className="font-bold text-lg text-[var(--text-1)] mb-1">Техніка безпеки</h3>
          <p className="text-sm text-[var(--text-3)] mb-4">Обов'язковий вступний інструктаж.</p>
          <div className="w-full bg-[var(--bg-card2)] rounded-full h-1.5 mb-2">
            <div className="bg-emerald-500 h-1.5 rounded-full" style={{ width: '100%' }}></div>
          </div>
          <div className="text-xs text-[var(--text-3)] text-right">100% пройдено</div>
        </div>
      </div>
    </div>
  );
}
