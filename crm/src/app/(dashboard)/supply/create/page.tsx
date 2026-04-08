'use client';

import { useState, useEffect } from 'react';
import { ChevronLeft, Save, Plus, Trash2, FileOutput, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function CreateSupplyDocument() {
  const router = useRouter();
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  const [items, setItems] = useState<any[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    supplier_id: '',
    target_location_id: '',
    doc_date: new Date().toISOString().slice(0, 16),
    notes: ''
  });

  const [supplyItems, setSupplyItems] = useState([
    { item_id: '', quantity: '', price: '' }
  ]);

  useEffect(() => {
    async function load() {
      try {
        const [locRes, supRes, itemRes] = await Promise.all([
          fetch('/api/warehouse/locations'),
          fetch('/api/warehouse/suppliers'), 
          fetch('/api/warehouse/items')
        ]);
        
        const locData = locRes.ok ? await locRes.json() : [];
        const supData = supRes.ok ? await supRes.json() : [];
        const itemData = itemRes.ok ? await itemRes.json() : [];

        setLocations(Array.isArray(locData) ? locData.filter(l => l.type === 'internal') : []);
        setSuppliers(Array.isArray(supData) ? supData : []);
        setItems(Array.isArray(itemData) ? itemData : []);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const totalSum = supplyItems.reduce((acc, curr) => {
    return acc + (parseFloat(curr.quantity || '0') * parseFloat(curr.price || '0'));
  }, 0);

  const handleSave = async () => {
     if (!form.supplier_id || supplyItems.length === 0 || supplyItems.some(i => !i.item_id || !i.quantity || !i.price)) {
       alert("Заповніть всі обов'язкові поля!");
       return;
     }

     setSaving(true);
     try {
       const res = await fetch('/api/warehouse/supply-documents', {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({
            ...form,
            items: supplyItems.map(i => ({
               item_id: parseInt(i.item_id),
               quantity: parseFloat(i.quantity),
               price: parseFloat(i.price)
            }))
         })
       });

       if (!res.ok) throw new Error('Помилка збереження');
       router.push('/supply');
     } catch (e) {
       alert('Не вдалося зберегти документ');
     } finally {
       setSaving(false);
     }
  };

  if (loading) return <div className="p-8"><Loader2 className="animate-spin h-8 w-8 text-indigo-500" /></div>;

  return (
    <div className="flex flex-col gap-6 h-full max-w-6xl mx-auto pb-20 animate-in fade-in zoom-in-95 duration-300">
      <div className="flex items-center justify-between border-b border-[var(--border)] pb-4">
         <div className="flex items-center gap-4">
            <Link href="/supply" className="p-2 hover:bg-[var(--bg-card2)] rounded-full transition-colors">
               <ChevronLeft className="h-6 w-6 text-[var(--text-2)]" />
            </Link>
            <h1 className="text-2xl font-black text-[var(--text-1)]">Додавання постачання</h1>
         </div>
         <div className="flex items-center gap-3">
            <button className="flex items-center gap-2 px-4 py-2 border border-[var(--border)] rounded-xl font-bold hover:bg-[var(--bg-card2)] transition-colors text-sm">
               <FileOutput className="h-4 w-4" /> Друк
            </button>
            <button 
               onClick={handleSave} 
               disabled={saving}
               className="flex items-center gap-2 px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold shadow-lg shadow-indigo-500/20 transition-colors text-sm"
            >
               {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Зберегти
            </button>
         </div>
      </div>

      <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-[24px] shadow-sm p-8">
         <div className="grid grid-cols-12 gap-8 max-w-4xl">
            <div className="col-span-3 text-right pt-3 font-semibold text-[var(--text-2)] text-sm">Дата та час постачання</div>
            <div className="col-span-9">
               <input 
                 type="datetime-local" 
                 value={form.doc_date}
                 onChange={e => setForm({...form, doc_date: e.target.value})}
                 className="bg-[var(--bg-card2)] border border-[var(--border)] rounded-xl px-4 py-2.5 text-sm outline-none focus:border-indigo-500 min-w-[250px] font-medium" 
               />
            </div>

            <div className="col-span-3 text-right pt-3 font-semibold text-[var(--text-2)] text-sm">Постачальник</div>
            <div className="col-span-9">
               <select 
                 value={form.supplier_id}
                 onChange={e => setForm({...form, supplier_id: e.target.value})}
                 className="w-full bg-[var(--bg-card2)] border border-[var(--border)] rounded-xl px-4 py-3 text-sm outline-none focus:border-indigo-500 appearance-none font-bold text-[var(--text-1)] lg:max-w-[400px]"
               >
                  <option value="">Оберіть постачальника...</option>
                  <option value="1">ТОВ "Тканини-Опт"</option>
                  {suppliers.map(s => <option key={s.id} value={s.id}>{s.name || s.title}</option>)}
               </select>
            </div>

            <div className="col-span-3 text-right pt-3 font-semibold text-[var(--text-2)] text-sm">Склад</div>
            <div className="col-span-9">
               <select 
                 value={form.target_location_id}
                 onChange={e => setForm({...form, target_location_id: e.target.value})}
                 className="w-full bg-[var(--bg-card2)] border border-[var(--border)] rounded-xl px-4 py-3 text-sm outline-none focus:border-indigo-500 appearance-none font-bold text-[var(--text-1)] lg:max-w-[400px]"
               >
                  <option value="">Основний склад...</option>
                  {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
               </select>
            </div>

            <div className="col-span-3 text-right pt-3 font-semibold text-[var(--text-2)] text-sm">Коментар</div>
            <div className="col-span-9">
               <textarea 
                 value={form.notes}
                 onChange={e => setForm({...form, notes: e.target.value})}
                 rows={3}
                 className="w-full bg-[var(--bg-card2)] border border-[var(--border)] rounded-xl px-4 py-3 text-sm outline-none focus:border-indigo-500 font-medium"
               />
            </div>
         </div>
      </div>

      <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-[24px] shadow-sm overflow-hidden flex flex-col">
         <table className="w-full text-left">
           <thead className="bg-[var(--bg-card2)] border-b border-[var(--border)]">
             <tr className="text-[10px] uppercase font-black tracking-widest text-[var(--text-3)]">
               <th className="px-6 py-4 w-[40%]">Найменування</th>
               <th className="px-6 py-4">Фасування</th>
               <th className="px-6 py-4">Кількість</th>
               <th className="px-6 py-4">Ціна за одиницю</th>
               <th className="px-6 py-4 text-right">Загальна сума</th>
               <th className="px-6 py-4 w-12 text-center"></th>
             </tr>
           </thead>
           <tbody className="divide-y divide-[var(--border)]">
              {supplyItems.map((item, index) => {
                 const selectedItem = items.find(i => i.id.toString() === item.item_id);
                 const sum = (parseFloat(item.quantity) || 0) * (parseFloat(item.price) || 0);

                 return (
                   <tr key={index} className="hover:bg-[var(--bg-base)] transition-colors">
                      <td className="px-6 py-3">
                         <select 
                           value={item.item_id}
                           onChange={e => {
                             const newItems = [...supplyItems];
                             newItems[index].item_id = e.target.value;
                             setSupplyItems(newItems);
                           }}
                           className="w-full bg-transparent border-none p-1 text-sm outline-none font-bold appearance-none cursor-pointer hover:bg-black/5 dark:hover:bg-white/5 rounded-lg"
                         >
                            <option value="">Виберіть товар...</option>
                            {items.map(i => <option key={i.id} value={i.id}>{i.name} ({i.sku})</option>)}
                         </select>
                      </td>
                      <td className="px-6 py-3">
                         <span className="text-sm font-semibold text-[var(--text-3)] bg-[var(--bg-card)] px-3 py-1.5 rounded-lg border border-[var(--border)]">
                            {selectedItem?.unit || 'шт'}
                         </span>
                      </td>
                      <td className="px-6 py-3">
                         <div className="flex items-center gap-2">
                            <input 
                              type="number"
                              min="0"
                              value={item.quantity}
                              onChange={e => {
                                const newItems = [...supplyItems];
                                newItems[index].quantity = e.target.value;
                                setSupplyItems(newItems);
                              }}
                              className="w-24 text-right bg-[var(--bg-card)] border border-[var(--border)] rounded-lg px-2 py-1.5 text-sm font-bold outline-none focus:border-indigo-500"
                            />
                         </div>
                      </td>
                      <td className="px-6 py-3">
                         <input 
                           type="number"
                           min="0"
                           step="0.01"
                           value={item.price}
                           onChange={e => {
                             const newItems = [...supplyItems];
                             newItems[index].price = e.target.value;
                             setSupplyItems(newItems);
                           }}
                           className="w-28 text-right bg-[var(--bg-card)] border border-[var(--border)] rounded-lg px-2 py-1.5 text-sm font-bold outline-none focus:border-indigo-500"
                         />
                      </td>
                      <td className="px-6 py-3 text-right">
                         <span className="text-md font-black font-mono text-indigo-600">
                           {sum.toFixed(2)} ₴
                         </span>
                      </td>
                      <td className="px-6 py-3 text-center">
                         <button 
                           onClick={() => setSupplyItems(supplyItems.filter((_, i) => i !== index))}
                           className="p-1.5 text-red-400 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
                         >
                           <Trash2 className="h-4 w-4" />
                         </button>
                      </td>
                   </tr>
                 );
              })}
           </tbody>
         </table>
         <div className="p-4 bg-[var(--bg-card2)] flex items-center justify-between">
            <button 
               onClick={() => setSupplyItems([...supplyItems, { item_id: '', quantity: '', price: '' }])}
               className="flex items-center gap-1.5 text-indigo-600 font-bold hover:text-indigo-700 text-sm p-2"
            >
               <Plus className="h-4 w-4" /> Додати ще
            </button>
            <div className="text-right px-6 font-black text-2xl text-[var(--text-1)]">
               Разом: <span className="font-mono text-indigo-600">{totalSum.toFixed(2)} ₴</span>
            </div>
         </div>
      </div>
    </div>
  );
}
