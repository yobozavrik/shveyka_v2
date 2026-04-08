'use client';

import { useState, useEffect } from 'react';
import { showConfirm } from '@/lib/confirm';
import { 
  UserPlus, Search, Loader2, X, Check, BrainCircuit, 
  ChevronRight, Phone, FileText, UserCheck, Trash2, 
  AlertCircle, Briefcase, TrendingUp
} from 'lucide-react';
import { useSearchParams } from 'next/navigation';

interface Candidate {
  id: number;
  vacancy_id: number;
  full_name: string;
  phone: string;
  resume_text: string;
  status: string;
  ai_score: number | null;
  ai_analysis: any;
  ai_questions?: string[]; // Added for next feature
  created_at: string;
  source?: string;
  external_id?: string;
  external_url?: string;
  vacancies?: { title: string };
}

const PIPELINE_STAGES = [
  { id: 'applied',   name: 'Нові',       color: 'border-blue-500/50',  bg: 'bg-blue-500/5' },
  { id: 'interview', name: 'Інтерв’ю',   color: 'border-purple-500/50', bg: 'bg-purple-500/5' },
  { id: 'test',      name: 'Тест',       color: 'border-orange-500/50', bg: 'bg-orange-500/5' },
  { id: 'offer',     name: 'Оффер',      color: 'border-indigo-500/50', bg: 'bg-indigo-500/5' },
  { id: 'hired',     name: 'Найнято',    color: 'border-green-500/50', bg: 'bg-green-500/5' },
  { id: 'rejected',  name: 'Відмова',    color: 'border-red-500/50',   bg: 'bg-red-500/5' },
];

export default function CandidatesPage() {
  const searchParams = useSearchParams();
  const vacancyFilter = searchParams.get('vacancyId');
  
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [viewing, setViewing] = useState<Candidate | null>(null);
  const [scoring, setScoring] = useState<number | null>(null);
  const [hiring, setHiring] = useState<number | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [vacancies, setVacancies] = useState<any[]>([]);
  const [error, setError] = useState('');
  const [syncing, setSyncing] = useState(false);

  const [form, setForm] = useState({
    vacancy_id: vacancyFilter || '',
    full_name: '',
    phone: '',
    resume_text: '',
  });

  useEffect(() => { load(); loadVacancies(); }, []);

  async function loadVacancies() {
    try {
      const res = await fetch('/api/vacancies');
      const data = await res.json();
      if (Array.isArray(data)) setVacancies(data);
      else if (data.error) setError(data.error);
    } catch (e: any) {
      setError(e.message);
    }
  }

  async function load() {
    setLoading(true);
    setError('');
    try {
      const url = vacancyFilter ? `/api/candidates?vacancyId=${vacancyFilter}` : '/api/candidates';
      const res = await fetch(url);
      const data = await res.json();
      if (Array.isArray(data)) {
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

  async function handleAdd() {
    try {
      const res = await fetch('/api/candidates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        setShowAddModal(false);
        setForm({ vacancy_id: '', full_name: '', phone: '', resume_text: '' });
        load();
      }
    } catch (e) { console.error(e); }
  }

  async function updateStatus(id: number, newStatus: string) {
    try {
      await fetch(`/api/candidates/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      load();
    } catch (e) { console.error(e); }
  }

  async function runScoring(id: number) {
    setScoring(id);
    try {
      const res = await fetch(`/api/candidates/${id}/score`, { method: 'POST' });
      if (res.ok) {
        const updated = await res.json();
        setCandidates(prev => prev.map(c => c.id === id ? updated : c));
        if (viewing?.id === id) setViewing(updated);
      }
    } finally { setScoring(null); }
  }

  async function handleHire(candidate: Candidate) {
    if (!await showConfirm(`Зарахувати ${candidate.full_name} до штату?`)) return;
    setHiring(candidate.id);
    try {
      const res = await fetch(`/api/candidates/${candidate.id}/hire`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          position: candidate.vacancies?.title || 'Швея',
          department: 'Цех'
        }),
      });
      if (res.ok) {
        alert('Кандидата успішно зараховано до штату!');
        load();
      }
    } finally { setHiring(null); }
  }

  async function handleSyncWorkUA() {
    const vId = vacancyFilter || (vacancies.length > 0 ? vacancies[0].id : null);
    if (!vId) {
      alert('Будь ласка, створіть або виберіть вакансію для синхронізації');
      return;
    }

    setSyncing(true);
    try {
      const res = await fetch('/api/candidates/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vacancyId: vId }),
      });
      const data = await res.json();
      if (data.success) {
        alert(`Синхронізація завершена!`);
        load();
      } else {
        alert(`Помилка: ${data.error}`);
      }
    } catch (e: any) {
      alert(`Помилка з'єднання: ${e.message}`);
    } finally {
      setSyncing(false);
    }
  }

  const getCandidatesByStage = (stageId: string) => {
    if (!Array.isArray(candidates)) return [];
    return candidates.filter(c => {
      const matchesStage = c.status === stageId;
      const matchesSearch = !search || 
        c.full_name.toLowerCase().includes(search.toLowerCase()) ||
        c.resume_text?.toLowerCase().includes(search.toLowerCase());
      return matchesStage && matchesSearch;
    });
  };

  return (
    <div className="h-[calc(100vh-6rem)] overflow-hidden flex flex-col space-y-6">
      <div className="flex items-end justify-between px-2">
        <div>
          <h1 className="text-2xl font-black flex items-center gap-3">
            <TrendingUp className="h-7 w-7 text-indigo-500" />
            Кандидати
          </h1>
          <p className="text-[var(--text-2)] text-sm mt-1">AI-Рекрутинг та воронка найму</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={handleSyncWorkUA}
            disabled={syncing}
            className="flex items-center gap-2 bg-[var(--bg-card)] border border-indigo-500/30 hover:border-indigo-500 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-sm text-indigo-500"
          >
            {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            Work.ua (Чернівці)
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 px-4 py-2.5 rounded-xl text-xs font-black transition-all shadow-lg shadow-indigo-600/20 text-white font-black uppercase tracking-widest"
          >
            <UserPlus className="h-4 w-4" /> Додати
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-2xl flex items-center gap-3 mx-2">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <div className="flex-grow">
            <p className="font-bold text-sm">Помилка бази даних</p>
            <p className="text-xs opacity-80">{error}</p>
          </div>
        </div>
      )}

      {/* Search and Filter Bar */}
      <div className="flex flex-col md:flex-row gap-4 px-2">
        <div className="relative flex-grow">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--text-3)]" />
          <input 
            type="text" 
            placeholder="Пошук за ім'ям або текстом резюме..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl pl-11 pr-4 py-3 text-sm outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/5 transition-all shadow-sm"
          />
        </div>
        <div className="flex gap-2">
           <select 
            value={vacancyFilter || ''} 
            onChange={(e) => {
              const val = e.target.value;
              const params = new URLSearchParams(window.location.search);
              if (val) params.set('vacancyId', val);
              else params.delete('vacancyId');
              window.history.replaceState({}, '', `${window.location.pathname}?${params.toString()}`);
              load();
            }}
            className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl px-4 py-3 text-xs font-black uppercase tracking-widest outline-none focus:border-indigo-500 transition-all shadow-sm cursor-pointer"
           >
             <option value="">Всі вакансії</option>
             {vacancies.map(v => <option key={v.id} value={v.id}>{v.title}</option>)}
           </select>
        </div>
      </div>

      {loading ? (
        <div className="flex-grow flex items-center justify-center"><Loader2 className="h-10 w-10 animate-spin text-indigo-500" /></div>
      ) : (
        <div className="flex-grow overflow-x-auto pb-4 custom-scrollbar">
          <div className="flex gap-4 min-w-max h-full p-2">
            {PIPELINE_STAGES.map(stage => (
              <div key={stage.id} className={`w-72 flex flex-col bg-[var(--bg-card)] border-t-4 ${stage.color} rounded-2xl overflow-hidden shadow-sm border border-[var(--border)]`}>
                <div className={`p-4 ${stage.bg} flex justify-between items-center border-b border-[var(--border)]`}>
                  <h3 className="text-xs font-black uppercase tracking-wider">{stage.name}</h3>
                  <span className="text-[10px] font-black bg-[var(--bg-card)] px-2 py-0.5 rounded-lg border border-[var(--border)]">{getCandidatesByStage(stage.id).length}</span>
                </div>
                
                <div className="flex-grow overflow-y-auto p-3 space-y-3 custom-scrollbar">
                  {getCandidatesByStage(stage.id).map(c => (
                    <div 
                      key={c.id} 
                      onClick={() => setViewing(c)}
                      className="bg-[var(--bg-base)] border border-[var(--border)] rounded-xl p-3 hover:border-indigo-500/50 transition-all cursor-pointer group relative overflow-hidden shadow-sm"
                    >
                      {c.ai_score !== null && (
                        <div className={`absolute top-0 right-0 px-2 py-0.5 text-[9px] font-black rounded-bl-lg ${c.ai_score >= 80 ? 'bg-green-500 text-black' : c.ai_score >= 60 ? 'bg-indigo-600 text-white' : 'bg-[var(--bg-card)] text-[var(--text-2)] border-l border-b border-[var(--border)]'}`}>
                          {c.ai_score}% MATCH
                        </div>
                      )}
                      
                      <h4 className="text-sm font-bold line-clamp-1 pr-12">{c.full_name}</h4>
                      <div className="flex items-center gap-2 mt-1">
                        <p className="text-[10px] text-[var(--text-3)] font-bold uppercase truncate">{c.vacancies?.title}</p>
                        {c.source === 'work.ua' && (
                          <div className="flex gap-2 items-center">
                            <span className="text-[9px] font-black bg-blue-500/10 text-blue-500 px-1 py-0.5 rounded border border-blue-500/20 uppercase tracking-tighter">Work.ua</span>
                            {c.external_id && (
                              <a 
                                href={`https://www.work.ua/resumes/${c.external_id.replace('workua_res_', '')}/`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[9px] font-bold text-blue-400 hover:text-blue-300 transition-all border-b border-blue-400/30"
                              >
                                Резюме →
                              </a>
                            )}
                          </div>
                        )}
                      </div>
                      
                      <div className="mt-3 flex items-center justify-between">
                        <div className="flex -space-x-1">
                          {c.ai_score !== null ? <BrainCircuit className="h-4 w-4 text-indigo-400" /> : <div className="h-4 w-4 bg-[var(--bg-card)] rounded-full border border-[var(--border)]" />}
                        </div>
                        <div className="text-[9px] font-bold text-[var(--text-3)] bg-[var(--bg-card)] px-2 py-0.5 rounded uppercase border border-[var(--border)]">{new Date(c.created_at).toLocaleDateString()}</div>
                      </div>
                    </div>
                  ))}
                  {getCandidatesByStage(stage.id).length === 0 && (
                    <div className="border-2 border-dashed border-[var(--border)] rounded-xl h-24 flex items-center justify-center text-[var(--text-3)] opacity-20 text-[10px] font-black uppercase">
                      Порожньо
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Candidate Details Modal */}
      {viewing && (
        <div className="fixed inset-0 z-50 flex items-center justify-end bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-[var(--bg-card)] border-l border-[var(--border)] h-full w-full max-w-2xl flex flex-col shadow-2xl relative">
            <div className="p-6 border-b border-[var(--border)] flex items-center justify-between">
              <div>
                <h3 className="text-2xl font-black">{viewing.full_name}</h3>
                <div className="flex items-center gap-4 mt-2">
                  <span className="flex items-center gap-1.5 text-xs font-bold text-indigo-500"><Briefcase className="h-3.5 w-3.5" /> {viewing.vacancies?.title}</span>
                  <span className="flex items-center gap-1.5 text-xs font-bold text-[var(--text-2)]"><Phone className="h-3.5 w-3.5" /> {viewing.phone}</span>
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
                    AI-Аналіз резюме
                  </h4>
                  {viewing.ai_score === null ? (
                    <button 
                      onClick={() => runScoring(viewing.id)}
                      disabled={scoring !== null}
                      className="bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all disabled:opacity-50"
                    >
                      {scoring ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Запустити скоринг'}
                    </button>
                  ) : (
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <div className="text-2xl font-black text-indigo-500">{viewing.ai_score}%</div>
                        <div className="text-[8px] font-black uppercase tracking-widest text-indigo-500/60">Match Score</div>
                      </div>
                      <button onClick={() => runScoring(viewing.id)} className="p-2 hover:text-indigo-500 transition-colors"><TrendingUp className="h-4 w-4" /></button>
                    </div>
                  )}
                </div>

                {viewing.ai_analysis && (
                  <div className="space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-green-500/5 border border-green-500/10 p-4 rounded-2xl">
                        <h5 className="text-[10px] font-black uppercase text-green-500 tracking-widest mb-3">Плюси</h5>
                        <ul className="space-y-2">
                          {(viewing.ai_analysis.pros || []).map((p: string, i: number) => (
                            <li key={i} className="text-xs flex gap-2"><Check className="h-3 w-3 text-green-500 mt-0.5 shrink-0" /> {p}</li>
                          ))}
                        </ul>
                      </div>
                      <div className="bg-red-500/5 border border-red-500/10 p-4 rounded-2xl">
                        <h5 className="text-[10px] font-black uppercase text-red-500 tracking-widest mb-3">Ризики</h5>
                        <ul className="space-y-2">
                          {(viewing.ai_analysis.cons || []).map((c: string, i: number) => (
                            <li key={i} className="text-xs flex gap-2"><AlertCircle className="h-3 w-3 text-red-500 mt-0.5 shrink-0" /> {c}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                    <div className="bg-[var(--bg-base)] p-4 rounded-2xl border border-[var(--border)]">
                       <h5 className="text-[10px] font-black uppercase text-[var(--text-3)] tracking-widest mb-2">Заключення AI</h5>
                       <p className="text-sm font-medium italic text-[var(--text-2)]">"{viewing.ai_analysis.summary}"</p>
                    </div>
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

              <div className="space-y-4">
                <h4 className="text-[10px] font-black uppercase tracking-widest text-[var(--text-3)] flex items-center gap-2">
                   <FileText className="h-3 w-3" /> Текст резюме
                </h4>
                <div className="bg-[var(--bg-base)] rounded-2xl p-6 text-sm font-medium leading-relaxed whitespace-pre-wrap border border-[var(--border)] text-[var(--text-2)]">
                  {viewing.resume_text || 'Текст відсутній'}
                </div>
              </div>
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
               <button className="flex-1 bg-[var(--bg-card2)] hover:bg-red-50 text-red-500 py-4 rounded-2xl text-xs font-black uppercase tracking-widest transition-all border border-[var(--border)] decoration-red-500/20 hover:border-red-200">
                 Відхилити
               </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Candidate Modal */}
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
                    <label className="text-[10px] font-black uppercase tracking-widest text-[var(--text-3)] mb-2 block">Вакансія *</label>
                    <select value={form.vacancy_id} onChange={e => setForm(f => ({...f, vacancy_id: e.target.value}))}
                      className="w-full bg-[var(--bg-base)] border border-[var(--border)] rounded-xl px-4 py-3 text-sm outline-none focus:border-indigo-600 uppercase font-black text-[10px] tracking-widest transition-all">
                      <option value="">Виберіть вакансію</option>
                      {vacancies.map(v => <option key={v.id} value={v.id} className="bg-[var(--bg-card)]">{v.title}</option>)}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-[var(--text-3)] mb-2 block">Текст резюме</label>
                  <textarea value={form.resume_text} onChange={e => setForm(f => ({...f, resume_text: e.target.value}))}
                    rows={6}
                    className="w-full bg-[var(--bg-base)] border border-[var(--border)] rounded-xl px-4 py-3 text-sm outline-none focus:border-indigo-600 transition-all resize-none font-medium text-[var(--text-2)]"
                    placeholder="Вставте текст резюме тут..." />
                </div>

                <div className="flex gap-4 pt-4">
                  <button onClick={() => setShowAddModal(false)} className="flex-1 bg-[var(--bg-card2)] hover:bg-[var(--bg-base)] py-4 rounded-xl text-xs font-black uppercase tracking-widest border border-[var(--border)] transition-all">Скасувати</button>
                  <button onClick={handleAdd} disabled={!form.full_name || !form.vacancy_id} className="flex-[2] bg-indigo-600 hover:bg-indigo-500 py-4 rounded-xl text-xs font-black uppercase tracking-widest shadow-xl shadow-indigo-600/20 text-white transition-all disabled:opacity-50">Створити запис</button>
                </div>
             </div>
          </div>
        </div>
      )}
    </div>
  );
}
