'use client';

import { BookOpen, FileText, Video, Download } from 'lucide-react';

export default function MaterialsPage() {
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-1)]">Навчальні матеріали</h1>
          <p className="text-sm text-[var(--text-3)] mt-1">
            Інструкції, регламенти та відеоуроки
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Document */}
        <div className="bg-[var(--bg-panel)] p-5 rounded-2xl border border-[var(--border)] shadow-sm group hover:border-emerald-500/50 transition-colors cursor-pointer">
          <div className="flex items-start justify-between mb-4">
            <div className="h-10 w-10 bg-indigo-500/10 text-indigo-500 rounded-xl flex items-center justify-center">
              <FileText className="h-5 w-5" />
            </div>
            <button className="p-2 bg-[var(--bg-card2)] rounded-lg text-[var(--text-3)] hover:text-emerald-500 transition-colors">
              <Download className="h-4 w-4" />
            </button>
          </div>
          <h3 className="font-bold text-lg text-[var(--text-1)] mb-1">Регламент якості v2.0</h3>
          <p className="text-sm text-[var(--text-3)] mb-4">Оновлені стандарти перевірки готової продукції.</p>
          <div className="text-xs font-medium text-[var(--text-3)]">PDF • 2.4 MB</div>
        </div>

        {/* Video */}
        <div className="bg-[var(--bg-panel)] p-5 rounded-2xl border border-[var(--border)] shadow-sm group hover:border-emerald-500/50 transition-colors cursor-pointer">
          <div className="flex items-start justify-between mb-4">
            <div className="h-10 w-10 bg-rose-500/10 text-rose-500 rounded-xl flex items-center justify-center">
              <Video className="h-5 w-5" />
            </div>
          </div>
          <h3 className="font-bold text-lg text-[var(--text-1)] mb-1">Налаштування машинки</h3>
          <p className="text-sm text-[var(--text-3)] mb-4">Відеоінструкція по базовому обслуговуванню.</p>
          <div className="text-xs font-medium text-[var(--text-3)]">Video • 12:45 хв</div>
        </div>
        
      </div>
    </div>
  );
}
