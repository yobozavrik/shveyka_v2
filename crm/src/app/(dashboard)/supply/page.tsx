'use client';

import { useState, useEffect, useCallback, Fragment } from 'react';
import { showConfirm } from '@/lib/confirm';
import { Loader2, Truck, Plus, CheckCircle2, Search, FileText, ChevronDown, ChevronRight, Edit3, MoreHorizontal } from 'lucide-react';
import { format } from 'date-fns';
import { uk } from 'date-fns/locale';
import Link from 'next/link';

interface SupplyDoc {
  id: number;
  doc_number: string;
  doc_date: string;
  status: string;
  total_amount: number;
  target_location_id: number;
  suppliers: { id: number; name: string };
  supply_items: any[];
}

export default function SupplyPage() {
  const [documents, setDocuments] = useState<SupplyDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [confirmingId, setConfirmingId] = useState<number | null>(null);
  
  const [expandedRows, setExpandedRows] = useState<Record<number, boolean>>({});

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/warehouse/supply-documents');
      const data = await res.json();
      if (Array.isArray(data)) setDocuments(data);
    } catch (e) {
      console.error('API Error:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleConfirm = async (id: number) => {
    if (!await showConfirm('Ви впевнені, що хочете провести цей документ? Відмінити це буде неможливо.')) return;
    setConfirmingId(id);
    try {
      const res = await fetch(`/api/warehouse/supply-documents/${id}/confirm`, { method: 'POST' });
      if (!res.ok) {
        const error = await res.json();
        alert(`Помилка: ${error.error}`);
        return;
      }
      await loadData();
    } catch (e) {
      alert('Виникла помилка під час спроби підтвердження');
    } finally {
      setConfirmingId(null);
    }
  };

  const toggleRow = (id: number) => {
    setExpandedRows(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const filtered = documents.filter(d => 
    d.doc_number.toLowerCase().includes(search.toLowerCase()) || 
    d.suppliers?.name.toLowerCase().includes(search.toLowerCase()) ||
    d.supply_items?.some(i => i.items?.name.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="flex gap-6 h-full border-t border-transparent">
      <div className="flex-1 bg-[var(--bg-card)] border border-[var(--border)] rounded-[24px] shadow-sm flex flex-col overflow-hidden">
        
        <div className="p-4 border-b border-[var(--border)] flex items-center justify-between gap-4 bg-[var(--bg-card2)]/50">
          <div className="relative flex-1 max-w-sm group">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--text-3)] group-focus-within:text-indigo-500 transition-colors" />
            <input 
              type="text" 
              placeholder="Швидкий пошук..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full bg-[var(--bg-card)] border border-[var(--border)] rounded-lg pl-11 pr-4 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500/30 transition-all font-medium"
            />
          </div>
          
          <div className="flex items-center gap-4 text-sm font-semibold text-indigo-600">
             <span className="cursor-pointer hover:text-indigo-500">Постачальник ▼</span>
             <span className="cursor-pointer hover:text-indigo-500">Склад ▼</span>
             <span className="cursor-pointer hover:text-indigo-500">+ Фільтр</span>
          </div>

          <div className="flex-1"></div>

          <Link 
             href="/supply/create"
             className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-white px-6 py-2.5 rounded-lg font-bold shadow-sm transition-all text-sm"
          >
             Додати
          </Link>
        </div>

        <div className="m-4 mb-2 bg-sky-500/10 border border-sky-500/20 p-4 rounded-xl flex items-start gap-4">
            <Truck className="h-5 w-5 text-sky-600 shrink-0 mt-0.5" />
            <div>
               <h4 className="text-sm font-bold text-sky-500 mb-1">Додавайте постачання в 5 разів швидше!</h4>
               <p className="text-xs text-sky-500/80 font-medium">Штучний інтелект скоро з'явиться для розпізнавання накладних з фотографії чи PDF-документа.</p>
            </div>
            <button className="ml-auto px-4 py-1.5 border border-sky-300 text-sky-700 font-bold rounded-lg text-xs hover:bg-sky-100 transition-colors">
               Розпізнати
            </button>
        </div>

        <div className="flex-1 overflow-auto custom-scrollbar">
          {loading ? (
            <div className="h-full flex flex-col items-center justify-center text-[var(--text-3)] py-12">
              <Loader2 className="h-10 w-10 animate-spin text-indigo-500 mb-4" />
              <p className="font-bold">Завантаження...</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-[var(--text-3)] py-12">
               <FileText className="h-16 w-16 mb-4 opacity-10" />
               <p className="text-lg font-bold italic">Документи відсутні</p>
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead className="sticky top-0 bg-[var(--bg-card)]/90 backdrop-blur-md border-b border-[var(--border)] z-10">
                <tr className="text-[11px] font-semibold text-[var(--text-3)] uppercase">
                  <th className="px-4 py-3 font-normal">№</th>
                  <th className="px-4 py-3 font-normal">Дата ▼</th>
                  <th className="px-4 py-3 font-normal">Постачальник</th>
                  <th className="px-4 py-3 font-normal">Склад</th>
                  <th className="px-4 py-3 font-normal">Рахунок</th>
                  <th className="px-4 py-3 font-normal">Товари</th>
                  <th className="px-4 py-3 font-normal">Коментар</th>
                  <th className="px-4 py-3 font-normal">Статус</th>
                  <th className="px-4 py-3 font-normal text-right">Сума</th>
                  <th className="px-4 py-3 font-normal text-right">Заборгованість</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]/50">
                {filtered.map(doc => {
                  const firstItem = doc.supply_items?.[0]?.items?.name || 'Немає товарів';
                  const otherCount = doc.supply_items?.length > 1 ? ` (+ ще ${doc.supply_items.length - 1})` : '';
                  const itemsPreview = `${firstItem}${otherCount}`;
                  const isExpanded = expandedRows[doc.id];

                  return (
                  <Fragment key={doc.id}>
                    <tr className={`hover:bg-[var(--bg-hover)] transition-colors ${isExpanded ? 'bg-[var(--bg-card2)]' : ''}`}>
                      <td className="px-4 py-4 text-xs font-medium text-[var(--text-2)]">{doc.id}</td>
                      <td className="px-4 py-4 text-xs font-bold text-[var(--text-1)]">
                         {doc.doc_date ? format(new Date(doc.doc_date), 'd MMM, HH:mm', { locale: uk }) : '-'}
                      </td>
                      <td className="px-4 py-4 text-xs font-medium text-[var(--text-1)]">{doc.suppliers?.name || 'ФОП Невідомий'}</td>
                      <td className="px-4 py-4 text-xs font-medium text-[var(--text-2)]">ЦЕХ "Головний склад"</td>
                      <td className="px-4 py-4 text-xs font-medium text-[var(--text-2)]">Сейф "Готівка"</td>
                      <td className="px-4 py-4 text-xs font-medium text-[var(--text-1)] truncate max-w-[200px]" title={itemsPreview}>
                         {itemsPreview}
                      </td>
                      <td className="px-4 py-4 text-xs font-medium text-[var(--text-3)]">—</td>
                      <td className="px-4 py-4">
                         {doc.status === 'confirmed' ? (
                            <span className="text-[10px] font-bold px-2 py-1 rounded border border-emerald-200 text-emerald-600 bg-emerald-50">
                               ОПЛАЧЕНЕ
                            </span>
                         ) : (
                            <button 
                               onClick={() => handleConfirm(doc.id)} 
                               disabled={confirmingId === doc.id}
                               className="text-[10px] font-bold px-2 py-1 rounded border border-amber-300 text-amber-600 bg-amber-50 hover:bg-amber-100 transition-colors"
                            >
                               {confirmingId === doc.id ? '...' : 'НЕОПЛАЧЕНЕ'}
                            </button>
                         )}
                      </td>
                      <td className="px-4 py-4 text-xs font-bold text-right text-[var(--text-1)]">
                         {new Intl.NumberFormat('uk-UA', { style: 'currency', currency: 'UAH' }).format(doc.total_amount)}
                      </td>
                      <td className="px-4 py-4 text-xs font-bold text-right text-[var(--text-3)]">
                         {doc.status === 'confirmed' ? '0,00 ₴' : new Intl.NumberFormat('uk-UA', { style: 'currency', currency: 'UAH' }).format(doc.total_amount)}
                      </td>
                      <td className="px-4 py-4 text-xs">
                         <div className="flex items-center justify-end gap-3 text-indigo-500 font-bold">
                            <span className="cursor-pointer flex items-center" onClick={() => toggleRow(doc.id)}>
                               Деталі {isExpanded ? <ChevronDown className="h-4 w-4 ml-1" /> : <ChevronRight className="h-4 w-4 ml-1" />}
                            </span>
                            <span className="cursor-pointer text-indigo-400">Ред.</span>
                            <MoreHorizontal className="h-4 w-4 cursor-pointer text-indigo-400" />
                         </div>
                      </td>
                    </tr>
                    
                    {isExpanded && (
                      <tr className="bg-[var(--bg-card2)] border-b-2 border-[var(--border)] shadow-inner">
                         <td colSpan={11} className="p-0">
                            <div className="p-6 bg-[var(--bg-card)] rounded-xl m-4 border border-[var(--border)] shadow-sm">
                               <table className="w-full text-left">
                                  <thead>
                                     <tr className="text-[11px] font-semibold text-[var(--text-3)] border-b border-[var(--border)]">
                                        <th className="pb-3 text-slate-400">Товар</th>
                                        <th className="pb-3 text-slate-400 text-right w-32">К-сть</th>
                                        <th className="pb-3 text-slate-400 text-right w-32">Сума</th>
                                     </tr>
                                  </thead>
                                  <tbody className="divide-y divide-[var(--border)]/30">
                                     {doc.supply_items?.map((item: any) => (
                                        <tr key={item.id}>
                                           <td className="py-3 text-xs font-bold text-[var(--text-1)]">{item.items?.name || 'Невідомий товар'}</td>
                                           <td className="py-3 text-xs font-bold text-[var(--text-2)] text-right">
                                              {item.quantity} <span className="font-normal text-[var(--text-3)]">{item.items?.unit}</span>
                                           </td>
                                           <td className="py-3 text-xs font-bold text-[var(--text-1)] text-right">
                                              {new Intl.NumberFormat('uk-UA', { style: 'currency', currency: 'UAH' }).format(item.total || (item.quantity * item.price))}
                                           </td>
                                        </tr>
                                     ))}
                                  </tbody>
                               </table>
                            </div>
                         </td>
                      </tr>
                    )}
                  </Fragment>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
      <style jsx>{`
        .custom-scrollbar::-webkit-scrollbar { width: 6px; height: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: var(--border); border-radius: 10px; }
      `}</style>
    </div>
  );
}
