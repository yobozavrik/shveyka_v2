'use client';

import { useState, useEffect } from 'react';
import { showConfirm } from '@/lib/confirm';
import {
  UserPlus, Search, Loader2, X, Check, BrainCircuit,
  ChevronRight, Phone, FileText, UserCheck, Trash2,
  AlertCircle, Briefcase, TrendingUp, Download, RefreshCw,
  Star, MapPin, Zap, Target, Filter, Eye, ExternalLink, Sparkles,
  Bot, Users, FileSearch, Database, ArrowRight
} from 'lucide-react';
import { useSearchParams } from 'next/navigation';

interface Candidate {
  id: string;
  vacancy_id: string | null;
  full_name: string;
  phone: string | null;
  email: string | null;
  resume_text: string | null;
  resume_url: string | null;
  city: string | null;
  position_desired: string | null;
  salary_expected: number | null;
  experience_years: number | null;
  specialization: string | null;
  specializations: string[] | null;
  machine_experience: string[] | null;
  skill_level: number | null;
  work_type_preference: string | null;
  remote_preference: boolean | null;
  source: string;
  source_job_id: string | null;
  source_url: string | null;
  ai_score: number | null;
  ai_analysis: any;
  ai_strengths: string[] | null;
  ai_concerns: string[] | null;
  ai_recommended_position: string | null;
  ai_analyzed_at: string | null;
  status: string;
  hr_notes: string | null;
  interview_date: string | null;
  interview_notes: string | null;
  created_at: string;
  updated_at: string;
  vacancies?: { title: string };
}

const PIPELINE_STAGES = [
  { id: 'new', name: 'Нові', color: 'border-blue-500/50', bg: 'bg-blue-500/5', icon: Sparkles },
  { id: 'reviewed', name: 'Переглянуто', color: 'border-cyan-500/50', bg: 'bg-cyan-500/5', icon: Eye },
  { id: 'contacted', name: 'Контакт', color: 'border-yellow-500/50', bg: 'bg-yellow-500/5', icon: Phone },
  { id: 'interview', name: 'Інтерв’ю', color: 'border-purple-500/50', bg: 'bg-purple-500/5', icon: Users },
  { id: 'offer', name: 'Оффер', color: 'border-indigo-500/50', bg: 'bg-indigo-500/5', icon: Target },
  { id: 'hired', name: 'Найнято', color: 'border-green-500/50', bg: 'bg-green-500/5', icon: Check },
  { id: 'rejected', name: 'Відмова', color: 'border-red-500/50', bg: 'bg-red-500/5', icon: X },
];

const SOURCE_LABELS: Record<string, { label: string; color: string }> = {
  workua: { label: 'Work.ua', color: 'bg-blue-500/10 text-blue-500 border-blue-500/20' },
  
  linkedin: { label: 'LinkedIn', color: 'bg-sky-500/10 text-sky-500 border-sky-500/20' },
  rabota_ua: { label: 'Rabota.ua', color: 'bg-orange-500/10 text-orange-500 border-orange-500/20' },
  manual: { label: 'Вручну', color: 'bg-gray-500/10 text-gray-500 border-gray-500/20' },
  referral: { label: 'Рекомендація', color: 'bg-violet-500/10 text-violet-500 border-violet-500/20' },
};

const SPECIALIZATION_LABELS: Record<string, string> = {
  seamstress: 'Шваля',
  cutter: 'Закрійник',
  master: 'Майстер',
  technologist: 'Технолог',
  qc: 'Контроль якості',
  overlock: 'Оверлок',
  straight_stitch: 'Прямострочка',
  packaging: 'Пакування',
  cutting_master: 'Закрійник-розкрійник',
  designer: 'Конструктор',
};

export default function CandidatesPage() {
  const searchParams = useSearchParams();
  const vacancyFilter = searchParams?.get('vacancyId');

  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [viewing, setViewing] = useState<Candidate | null>(null);
  const [scoring, setScoring] = useState<number | null>(null);
  const [hiring, setHiring] = useState<number | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showSourcingModal, setShowSourcingModal] = useState(false);
  const [vacancies, setVacancies] = useState<any[]>([]);
  const [error, setError] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [sourcingStats, setSourcingStats] = useState<any>(null);

  const [filters, setFilters] = useState({
    status: '',
    source: '',
    specialization: '',
    minScore: '',
    maxScore: '',
  });

  const [form, setForm] = useState({
    vacancy_id: vacancyFilter || '',
    full_name: '',
    phone: '',
    email: '',
    resume_text: '',
    position_desired: '',
    salary_expected: '',
    city: '',
    specialization: '',
    source: 'manual',
  });

  const [sourcingForm, setSourcingForm] = useState({
    keywords: 'шваля, закрійник, майстер швейного',
    sources: ['workua'],
    pages: 2,
    vacancyId: '',
  });

  useEffect(() => { load(); loadVacancies(); loadStats(); }, []);

  async function loadStats() {
    try {
      const res = await fetch('/api/recruitment/sourcing?action=stats');
      if (res.ok) {
        const data = await res.json();
        setSourcingStats(data);
      }
    } catch (e) { /* ignore */ }
  }

  async function loadVacancies() {
    try {
      const res = await fetch('/api/vacancies');
      const data = await res.json();
      if (Array.isArray(data)) setVacancies(data);
    } catch (e: any) { setError(e.message); }
  }

  async function load() {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (vacancyFilter) params.set('vacancyId', vacancyFilter);
      if (filters.status) params.set('status', filters.status);
      if (filters.source) params.set('source', filters.source);
      if (filters.specialization) params.set('specialization', filters.specialization);
      if (filters.minScore) params.set('minScore', filters.minScore);
      if (filters.maxScore) params.set('maxScore', filters.maxScore);
      if (search) params.set('search', search);
      params.set('limit', '100');

      const res = await fetch(`/api/candidates?${params.toString()}`);
      const data = await res.json();
      
      if (data.data) {
        setCandidates(data.data);
      } else if (Array.isArray(data)) {
        setCandidates(data);
      } else {
        setCandidates([]);
        if (data.error) setError(data.error);
      }
    } catch (e: any) {
      setError(e.message);
      setCandidates([]);
    } finally { setLoading(false); }
  }

  useEffect(() => {
    const debounce = setTimeout(() => load(), 300);
    return () => clearTimeout(debounce);
  }, [search, filters]);

  async function handleAdd() {
    try {
      const res = await fetch('/api/candidates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          salary_expected: form.salary_expected ? parseInt(form.salary_expected) : null,
          vacancy_id: form.vacancy_id || null,
        }),
      });
      if (res.ok) {
        setShowAddModal(false);
        setForm({ vacancy_id: '', full_name: '', phone: '', email: '', resume_text: '', position_desired: '', salary_expected: '', city: '', specialization: '', source: 'manual' });
        load();
      }
    } catch (e) { console.error(e); }
  }

  async function updateStatus(id: string, newStatus: string) {
    try {
      await fetch(`/api/candidates/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      load();
      if (viewing?.id === id) setViewing({ ...viewing, status: newStatus });
    } catch (e) { console.error(e); }
  }

  async function runScoring(id: number) {
    setScoring(id);
    try {
      const res = await fetch(`/api/candidates/${id}/score`, { method: 'POST' });
      if (res.ok) {
        const updated = await res.json();
        const idStr = String(id);
        setCandidates(prev => prev.map(c => c.id === idStr ? updated : c));
        if (viewing?.id === idStr) setViewing(updated);
      }
    } finally { setScoring(null); }
  }

  async function handleHire(candidate: Candidate) {
    if (!await showConfirm(`Зарахувати ${candidate.full_name} до штату?`)) return;
    setHiring(candidate.id as unknown as number);
    try {
      const res = await fetch(`/api/candidates/${candidate.id}/hire`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          position: candidate.position_desired || candidate.vacancies?.title || 'Швея',
          department: 'Цех'
        }),
      });
      if (res.ok) {
        alert('Кандидата успішно зараховано до штату!');
        load();
      }
    } finally { setHiring(null); }
  }

  async function handleSourcing() {
    setSyncing(true);
    try {
      const res = await fetch('/api/recruitment/sourcing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'full_cycle',
          keywords: sourcingForm.keywords.split(',').map(k => k.trim()),
          sources: sourcingForm.sources,
          pages: sourcingForm.pages,
          vacancyId: sourcingForm.vacancyId || null,
        }),
      });
      const data = await res.json();
      if (data.success) {
        alert(`Синхронізація завершена!\n\nЗнайдено: ${data.search?.candidatesFound}\nПроаналізовано: ${data.analysis?.analyzedCount}\nІмпортовано: ${data.import?.imported}`);
        load();
        loadStats();
      } else {
        alert(`Помилка на етапі ${data.stage}: ${data.errors?.join(', ')}`);
      }
    } catch (e: any) {
      alert(`Помилка: ${e.message}`);
    } finally { setSyncing(false); setShowSourcingModal(false); }
  }

  async function handleDelete(id: string) {
    if (!await showConfirm('Видалити кандидата?')) return;
    try {
      await fetch(`/api/candidates/${id}`, { method: 'DELETE' });
      load();
      if (viewing?.id === id) setViewing(null);
    } catch (e) { console.error(e); }
  }

  const getCandidatesByStage = (stageId: string) => {
    if (!Array.isArray(candidates)) return [];
    return candidates.filter(c => {
      const matchesSearch = !search ||
        c.full_name.toLowerCase().includes(search.toLowerCase()) ||
        c.resume_text?.toLowerCase().includes(search.toLowerCase()) ||
        c.position_desired?.toLowerCase().includes(search.toLowerCase());
      return c.status === stageId && matchesSearch;
    });
  };

  const getScoreColor = (score: number | null) => {
    if (score === null) return 'bg-gray-500/10 text-gray-500';
    if (score >= 8) return 'bg-green-500/10 text-green-500';
    if (score >= 6) return 'bg-indigo-500/10 text-indigo-500';
    if (score >= 4) return 'bg-yellow-500/10 text-yellow-500';
    return 'bg-red-500/10 text-red-500';
  };

  return (
    <div className="h-[calc(100vh-6rem)] overflow-hidden flex flex-col space-y-6">
      <div className="flex items-end justify-between px-2">
        <div>
          <h1 className="text-2xl font-black flex items-center gap-3">
            <Users className="h-7 w-7 text-indigo-500" />
            Кандидати
            {sourcingStats && (
              <span className="text-xs font-bold bg-indigo-500/10 text-indigo-500 px-2 py-1 rounded-lg">
                {sourcingStats.totalCandidates} всього
              </span>
            )}
          </h1>
          <p className="text-[var(--text-2)] text-sm mt-1">AI-Рекрутинг та воронка найму швалей</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setShowSourcingModal(true)}
            className="flex items-center gap-2 bg-[var(--bg-card)] border border-indigo-500/30 hover:border-indigo-500 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-sm text-indigo-500"
          >
            <Bot className="h-4 w-4" />
            AI Пошук
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 px-4 py-2.5 rounded-xl text-xs font-black transition-all shadow-lg shadow-indigo-600/20 text-white uppercase tracking-widest"
          >
            <UserPlus className="h-4 w-4" />
            Додати
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-2xl flex items-center gap-3 mx-2">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <div className="flex-grow">
            <p className="font-bold text-sm">Помилка</p>
            <p className="text-xs opacity-80">{error}</p>
          </div>
        </div>
      )}

      <div className="flex flex-col md:flex-row gap-4 px-2">
        <div className="relative flex-grow">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--text-3)]" />
          <input
            type="text"
            placeholder="Пошук за ім'ям, посадою, резюме..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl pl-11 pr-4 py-3 text-sm outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/5 transition-all shadow-sm"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          <select
            value={filters.source}
            onChange={(e) => setFilters(f => ({ ...f, source: e.target.value }))}
            className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl px-4 py-3 text-xs font-black uppercase tracking-widest outline-none focus:border-indigo-500 transition-all shadow-sm cursor-pointer"
          >
<option value="">Всі джерела</option>
              <option value="workua">Work.ua</option>
              <option value="manual">Вручну</option>
          </select>
          <select
            value={filters.specialization}
            onChange={(e) => setFilters(f => ({ ...f, specialization: e.target.value }))}
            className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl px-4 py-3 text-xs font-black uppercase tracking-widest outline-none focus:border-indigo-500 transition-all shadow-sm cursor-pointer"
          >
            <option value="">Всі спеціалізації</option>
            {Object.entries(SPECIALIZATION_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
          <select
            value={filters.minScore}
            onChange={(e) => setFilters(f => ({ ...f, minScore: e.target.value }))}
            className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl px-4 py-3 text-xs font-black uppercase tracking-widest outline-none focus:border-indigo-500 transition-all shadow-sm cursor-pointer"
          >
            <option value="">Мін. бал</option>
            <option value="8">8+</option>
            <option value="6">6+</option>
            <option value="4">4+</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="flex-grow flex items-center justify-center">
          <Loader2 className="h-10 w-10 animate-spin text-indigo-500" />
        </div>
      ) : (
        <div className="flex-grow overflow-x-auto pb-4 custom-scrollbar">
          <div className="flex gap-4 min-w-max h-full p-2">
            {PIPELINE_STAGES.map(stage => {
              const StageIcon = stage.icon;
              const stageCandidates = getCandidatesByStage(stage.id);
              return (
                <div key={stage.id} className={`w-72 flex flex-col bg-[var(--bg-card)] border-t-4 ${stage.color} rounded-2xl overflow-hidden shadow-sm border border-[var(--border)]`}>
                  <div className={`p-4 ${stage.bg} flex justify-between items-center border-b border-[var(--border)]`}>
                    <h3 className="text-xs font-black uppercase tracking-wider flex items-center gap-2">
                      <StageIcon className="h-3.5 w-3.5" />
                      {stage.name}
                    </h3>
                    <span className="text-[10px] font-black bg-[var(--bg-card)] px-2 py-0.5 rounded-lg border border-[var(--border)]">
                      {stageCandidates.length}
                    </span>
                  </div>

                  <div className="flex-grow overflow-y-auto p-3 space-y-3 custom-scrollbar">
                    {stageCandidates.map(c => (
                      <div
                        key={c.id}
                        onClick={() => setViewing(c)}
                        className="bg-[var(--bg-base)] border border-[var(--border)] rounded-xl p-3 hover:border-indigo-500/50 transition-all cursor-pointer group relative overflow-hidden shadow-sm"
                      >
                        {c.ai_score !== null && (
                          <div className={`absolute top-0 right-0 px-2 py-0.5 text-[9px] font-black rounded-bl-lg ${getScoreColor(c.ai_score)}`}>
                            {c.ai_score}/10
                          </div>
                        )}

                        <h4 className="text-sm font-bold line-clamp-1 pr-12">{c.full_name}</h4>
                        <p className="text-[10px] text-[var(--text-3)] font-medium truncate mt-1">
                          {c.position_desired || c.vacancies?.title || 'Не вказано'}
                        </p>

                        <div className="flex items-center gap-2 mt-2 flex-wrap">
                          {c.source && SOURCE_LABELS[c.source] && (
                            <span className={`text-[9px] font-black px-1.5 py-0.5 rounded border ${SOURCE_LABELS[c.source].color}`}>
                              {SOURCE_LABELS[c.source].label}
                            </span>
                          )}
                          {c.specialization && SPECIALIZATION_LABELS[c.specialization] && (
                            <span className="text-[9px] font-black bg-violet-500/10 text-violet-500 px-1.5 py-0.5 rounded border border-violet-500/20">
                              {SPECIALIZATION_LABELS[c.specialization]}
                            </span>
                          )}
                        </div>

                        <div className="mt-3 flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            {c.city && <><MapPin className="h-3 w-3 text-[var(--text-4)]" /><span className="text-[9px] text-[var(--text-4)]">{c.city}</span></>}
                          </div>
                          <span className="text-[9px] font-bold text-[var(--text-3)]">
                            {new Date(c.created_at).toLocaleDateString('uk-UA', { day: '2-digit', month: '2-digit' })}
                          </span>
                        </div>
                      </div>
                    ))}
                    {stageCandidates.length === 0 && (
                      <div className="border-2 border-dashed border-[var(--border)] rounded-xl h-24 flex items-center justify-center text-[var(--text-3)] opacity-20 text-[10px] font-black uppercase">
                        Порожньо
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {viewing && (
        <div className="fixed inset-0 z-50 flex items-center justify-end bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-[var(--bg-card)] border-l border-[var(--border)] h-full w-full max-w-2xl flex flex-col shadow-2xl relative">
            <div className="p-6 border-b border-[var(--border)] flex items-center justify-between">
              <div>
                <h3 className="text-2xl font-black">{viewing.full_name}</h3>
                <div className="flex items-center gap-4 mt-2 flex-wrap">
                  <span className="flex items-center gap-1.5 text-xs font-bold text-indigo-500">
                    <Briefcase className="h-3.5 w-3.5" />
                    {viewing.position_desired || viewing.vacancies?.title || 'Не вказано'}
                  </span>
                  {viewing.phone && <span className="flex items-center gap-1.5 text-xs font-bold text-[var(--text-2)]"><Phone className="h-3.5 w-3.5" /> {viewing.phone}</span>}
                  {viewing.city && <span className="flex items-center gap-1.5 text-xs font-bold text-[var(--text-2)]"><MapPin className="h-3.5 w-3.5" /> {viewing.city}</span>}
                </div>
              </div>
              <button onClick={() => setViewing(null)} className="p-2 hover:bg-[var(--bg-base)] rounded-full transition-colors"><X className="h-7 w-7" /></button>
            </div>

            <div className="flex-grow overflow-y-auto p-8 custom-scrollbar space-y-10">
              <div className="bg-indigo-500/5 border border-indigo-500/10 rounded-3xl p-6 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-5 text-indigo-500"><BrainCircuit className="h-24 w-24" /></div>

                <div className="flex items-center justify-between mb-6">
                  <h4 className="text-lg font-black uppercase tracking-tighter flex items-center gap-3">
                    <BrainCircuit className="h-6 w-6 text-indigo-500" />
                    AI-Аналіз
                  </h4>
                  {viewing.ai_score === null ? (
                    <button
                      onClick={() => runScoring(parseInt(viewing.id))}
                      disabled={scoring !== null}
                      className="bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all disabled:opacity-50"
                    >
                      {scoring ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Запустити скоринг'}
                    </button>
                  ) : (
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <div className="text-2xl font-black text-indigo-500">{viewing.ai_score}/10</div>
                        <div className="text-[8px] font-black uppercase tracking-widest text-indigo-500/60">Match Score</div>
                      </div>
                      <button onClick={() => runScoring(parseInt(viewing.id))} className="p-2 hover:text-indigo-500 transition-colors">
                        <RefreshCw className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </div>

                {viewing.ai_analysis && (
                  <div className="space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-green-500/5 border border-green-500/10 p-4 rounded-2xl">
                        <h5 className="text-[10px] font-black uppercase text-green-500 tracking-widest mb-3">Сильні сторони</h5>
                        <ul className="space-y-2">
                          {(viewing.ai_strengths || viewing.ai_analysis.strengths || []).map((p: string, i: number) => (
                            <li key={i} className="text-xs flex gap-2"><Check className="h-3 w-3 text-green-500 mt-0.5 shrink-0" /> {p}</li>
                          ))}
                        </ul>
                      </div>
                      <div className="bg-red-500/5 border border-red-500/10 p-4 rounded-2xl">
                        <h5 className="text-[10px] font-black uppercase text-red-500 tracking-widest mb-3">Сумніви</h5>
                        <ul className="space-y-2">
                          {(viewing.ai_concerns || viewing.ai_analysis.concerns || []).map((c: string, i: number) => (
                            <li key={i} className="text-xs flex gap-2"><AlertCircle className="h-3 w-3 text-red-500 mt-0.5 shrink-0" /> {c}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                    {viewing.ai_analysis.summary && (
                      <div className="bg-[var(--bg-base)] p-4 rounded-2xl border border-[var(--border)]">
                        <h5 className="text-[10px] font-black uppercase text-[var(--text-3)] tracking-widest mb-2">Висновок AI</h5>
                        <p className="text-sm font-medium italic text-[var(--text-2)]">"{viewing.ai_analysis.summary}"</p>
                      </div>
                    )}
                    {viewing.ai_recommended_position && (
                      <div className="bg-indigo-500/5 p-4 rounded-2xl border border-indigo-500/10">
                        <h5 className="text-[10px] font-black uppercase text-indigo-500 tracking-widest mb-2">Рекомендована посада</h5>
                        <p className="text-sm font-bold text-indigo-400">{viewing.ai_recommended_position}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="space-y-4">
                <h4 className="text-[10px] font-black uppercase tracking-widest text-[var(--text-3)]">Етап воронки</h4>
                <div className="flex flex-wrap gap-2">
                  {PIPELINE_STAGES.map(s => (
                    <button
                      key={s.id}
                      onClick={() => updateStatus(viewing.id, s.id)}
                      className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest border transition-all ${viewing.status === s.id ? 'bg-indigo-600 border-indigo-600 text-white shadow-md' : 'bg-[var(--bg-card2)] border-[var(--border)] text-[var(--text-3)] hover:text-indigo-500 hover:border-indigo-500'}`}
                    >
                      {s.name}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {viewing.experience_years && (
                  <div className="bg-[var(--bg-base)] p-4 rounded-2xl border border-[var(--border)]">
                    <h5 className="text-[10px] font-black uppercase text-[var(--text-3)] tracking-widest mb-2">Досвід</h5>
                    <p className="text-lg font-black text-indigo-500">{viewing.experience_years}років</p>
                  </div>
                )}
                {viewing.salary_expected && (
                  <div className="bg-[var(--bg-base)] p-4 rounded-2xl border border-[var(--border)]">
                    <h5 className="text-[10px] font-black uppercase text-[var(--text-3)] tracking-widest mb-2">Очікування</h5>
                    <p className="text-lg font-black text-green-500">{viewing.salary_expected.toLocaleString()}грн</p>
                  </div>
                )}
              </div>

              {viewing.resume_text && (
                <div className="space-y-4">
                  <h4 className="text-[10px] font-black uppercase tracking-widest text-[var(--text-3)] flex items-center gap-2">
                    <FileText className="h-3 w-3" /> Текст резюме
                  </h4>
                  <div className="bg-[var(--bg-base)] rounded-2xl p-6 text-sm font-medium leading-relaxed whitespace-pre-wrap border border-[var(--border)] text-[var(--text-2)] max-h-64 overflow-y-auto">
                    {viewing.resume_text}
                  </div>
                </div>
              )}

              {viewing.resume_url && (
                <a href={viewing.resume_url} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-2 text-indigo-500 hover:text-indigo-400 text-sm font-bold">
                  <ExternalLink className="h-4 w-4" /> Відкрити оригінал резюме
                </a>
              )}
            </div>

            <div className="p-6 border-t border-[var(--border)] flex gap-4 bg-[var(--bg-card2)] mt-auto">
              {viewing.status !== 'hired' && (
                <button
                  onClick={() => handleHire(viewing)}
                  disabled={hiring !== null}
                  className="flex-[2] bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 py-4 rounded-2xl text-xs font-black uppercase tracking-widest transition-all flex items-center justify-center gap-3 shadow-lg shadow-indigo-600/20 text-white"
                >
                  {hiring ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserCheck className="h-5 w-5" />}
                  Зарахувати до штату
                </button>
              )}
              <button
                onClick={() => handleDelete(viewing.id)}
                className="flex-1 bg-[var(--bg-card2)] hover:bg-red-50 text-red-500 py-4 rounded-2xl text-xs font-black uppercase tracking-widest transition-all border border-[var(--border)] hover:border-red-200"
              >
                <Trash2 className="h-4 w-4 mx-auto" />
              </button>
            </div>
          </div>
        </div>
      )}

      {showSourcingModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-3xl p-8 w-full max-w-xl shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 left-0 w-1.5 h-full bg-indigo-600"></div>
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-xl font-black uppercase tracking-tighter flex items-center gap-3">
                <Bot className="h-6 w-6 text-indigo-500" />
                AI Пошук кандидатів
              </h3>
              <button onClick={() => setShowSourcingModal(false)} className="p-2 hover:bg-[var(--bg-base)] rounded-full transition-colors"><X className="h-6 w-6" /></button>
            </div>

            <div className="space-y-6">
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-[var(--text-3)] mb-2 block">Ключові слова для пошуку</label>
                <input
                  value={sourcingForm.keywords}
                  onChange={e => setSourcingForm(f => ({ ...f, keywords: e.target.value }))}
                  className="w-full bg-[var(--bg-base)] border border-[var(--border)] rounded-xl px-4 py-3 text-sm outline-none focus:border-indigo-600 transition-all font-medium"
                  placeholder="шваля, закрійник, майстер швейного"
                />
                <p className="text-[10px] text-[var(--text-4)] mt-1">Через кому для кількох посіб</p>
              </div>

              <div className="bg-blue-500/5 border border-blue-500/10 rounded-2xl p-4 flex items-center gap-3">
                <span className="text-sm font-bold text-blue-500">Work.ua</span>
                <span className="text-xs text-[var(--text-3)]">— основне джерело пошуку резюме</span>
              </div>

              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-[var(--text-3)] mb-2 block">Сторінок на джерело</label>
                <input
                  type="number"
                  value={sourcingForm.pages}
                  onChange={e => setSourcingForm(f => ({ ...f, pages: parseInt(e.target.value) || 2 }))}
                  className="w-full bg-[var(--bg-base)] border border-[var(--border)] rounded-xl px-4 py-3 text-sm outline-none focus:border-indigo-600 transition-all font-medium"
                  min={1}
                  max={10}
                />
              </div>

              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-[var(--text-3)] mb-2 block">Прив'язати до вакансії</label>
                <select
                  value={sourcingForm.vacancyId}
                  onChange={e => setSourcingForm(f => ({ ...f, vacancyId: e.target.value }))}
                  className="w-full bg-[var(--bg-base)] border border-[var(--border)] rounded-xl px-4 py-3 text-sm outline-none focus:border-indigo-600 uppercase font-black text-[10px] tracking-widest transition-all"
                >
                  <option value="">Без прив'язки</option>
                  {vacancies.map(v => <option key={v.id} value={v.id}>{v.title}</option>)}
                </select>
              </div>

              <div className="bg-indigo-500/5 border border-indigo-500/10 rounded-2xl p-4">
                <p className="text-xs text-[var(--text-2)]">
                  <strong>Автоматично:</strong> пошук → AI-аналіз → імпорт у базу
                </p>
              </div>

              <div className="flex gap-4 pt-4">
                <button onClick={() => setShowSourcingModal(false)} className="flex-1 bg-[var(--bg-card2)] hover:bg-[var(--bg-base)] py-4 rounded-xl text-xs font-black uppercase tracking-widest border border-[var(--border)] transition-all">
                  Скасувати
                </button>
                <button
                  onClick={handleSourcing}
                  disabled={syncing || sourcingForm.sources.length === 0 || !sourcingForm.keywords}
                  className="flex-[2] bg-indigo-600 hover:bg-indigo-500 py-4 rounded-xl text-xs font-black uppercase tracking-widest shadow-xl shadow-indigo-600/20 text-white transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {syncing ? <><Loader2 className="h-4 w-4 animate-spin" /> Пошук...</> : <><Zap className="h-4 w-4" /> Запустити пошук</>}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-3xl p-8 w-full max-w-xl shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 left-0 w-1.5 h-full bg-indigo-600"></div>
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-xl font-black uppercase tracking-tighter">Новий кандидат</h3>
              <button onClick={() => setShowAddModal(false)} className="p-2 hover:bg-[var(--bg-base)] rounded-full transition-colors"><X className="h-6 w-6" /></button>
            </div>

            <div className="space-y-6">
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-[var(--text-3)] mb-2 block">ПІБ *</label>
                <input value={form.full_name} onChange={e => setForm(f => ({...f, full_name: e.target.value}))}
                  className="w-full bg-[var(--bg-base)] border border-[var(--border)] rounded-xl px-4 py-3 text-sm outline-none focus:border-indigo-600 transition-all font-medium"
                  placeholder="Іван Іванов" />
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-[var(--text-3)] mb-2 block">Телефон</label>
                  <input value={form.phone} onChange={e => setForm(f => ({...f, phone: e.target.value}))}
                    className="w-full bg-[var(--bg-base)] border border-[var(--border)] rounded-xl px-4 py-3 text-sm outline-none focus:border-indigo-600 transition-all font-medium"
                    placeholder="+380..." />
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-[var(--text-3)] mb-2 block">Email</label>
                  <input value={form.email} onChange={e => setForm(f => ({...f, email: e.target.value}))}
                    className="w-full bg-[var(--bg-base)] border border-[var(--border)] rounded-xl px-4 py-3 text-sm outline-none focus:border-indigo-600 transition-all font-medium"
                    placeholder="email@example.com" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-[var(--text-3)] mb-2 block">Бажана посада</label>
                  <input value={form.position_desired} onChange={e => setForm(f => ({...f, position_desired: e.target.value}))}
                    className="w-full bg-[var(--bg-base)] border border-[var(--border)] rounded-xl px-4 py-3 text-sm outline-none focus:border-indigo-600 transition-all font-medium"
                    placeholder="Шваля" />
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-[var(--text-3)] mb-2 block">Місто</label>
                  <input value={form.city} onChange={e => setForm(f => ({...f, city: e.target.value}))}
                    className="w-full bg-[var(--bg-base)] border border-[var(--border)] rounded-xl px-4 py-3 text-sm outline-none focus:border-indigo-600 transition-all font-medium"
                    placeholder="Київ" />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-[var(--text-3)] mb-2 block">Резюме (текст)</label>
                <textarea value={form.resume_text} onChange={e => setForm(f => ({...f, resume_text: e.target.value}))}
                  rows={6}
                  className="w-full bg-[var(--bg-base)] border border-[var(--border)] rounded-xl px-4 py-3 text-sm outline-none focus:border-indigo-600 transition-all resize-none font-medium text-[var(--text-2)]"
                  placeholder="Вставте текст резюме тут..." />
              </div>

              <div className="flex gap-4 pt-4">
                <button onClick={() => setShowAddModal(false)} className="flex-1 bg-[var(--bg-card2)] hover:bg-[var(--bg-base)] py-4 rounded-xl text-xs font-black uppercase tracking-widest border border-[var(--border)] transition-all">
                  Скасувати
                </button>
                <button onClick={handleAdd} disabled={!form.full_name}
                  className="flex-[2] bg-indigo-600 hover:bg-indigo-500 py-4 rounded-xl text-xs font-black uppercase tracking-widest shadow-xl shadow-indigo-600/20 text-white transition-all disabled:opacity-50">
                  Створити
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}