'use client';

import { Briefcase, Plus, Search } from 'lucide-react';

export default function VacanciesPage() {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Briefcase className="h-5 w-5 text-indigo-500" />
            Вакансії
          </h2>
          <p className="text-xs text-[var(--text-3)] mt-1 uppercase font-bold tracking-wider">Управління відкритими позиціями та кандидатами</p>
        </div>
        <button className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-sm font-bold transition-all shadow-lg shadow-indigo-600/20 flex items-center gap-2">
          <Plus className="h-4 w-4" />
          Створити вакансію
        </button>
      </div>

      <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-12 text-center">
        <div className="w-16 h-16 bg-indigo-500/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <Briefcase className="h-8 w-8 text-indigo-500" />
        </div>
        <h3 className="text-lg font-bold mb-2">Наразі немає активних вакансій</h3>
        <p className="text-[var(--text-3)] max-w-sm mx-auto text-sm">
          Тут ви зможете керувати процесом найму, публікувати нові вакансії та переглядати відгуки кандидатів.
        </p>
      </div>
    </div>
  );
}
