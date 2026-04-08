import { Tool, ToolResult, Citation } from './ToolRegistry';
import { createClient } from '@/lib/supabase/server';

export const orderTools: Tool[] = [
  {
    name: 'get_order_summary',
    description: 'Получить сводку по заказу: статус, партии, прогресс',
    inputSchema: { type: 'object', properties: { order_id: { type: 'number' } }, required: ['order_id'] },
    execute: async (params) => {
      const supabase = await createClient();
      
      const { data: order } = await supabase
        .from('production_orders')
        .select('id, order_number, status, priority, order_date, planned_completion_date')
        .eq('id', params.order_id)
        .single();
      
      const { data: batches } = await supabase
        .from('production_batches')
        .select('id, batch_number, status, quantity')
        .eq('order_id', params.order_id);
      
      const { data: entries } = await supabase
        .from('operation_entries')
        .select('id, status')
        .in('batch_id', batches?.map(b => b.id) || []);
      
      const confirmed = entries?.filter(e => e.status === 'confirmed').length || 0;
      const total = entries?.length || 0;
      
      return {
        success: true,
        data: {
          order,
          batches,
          progress: { confirmed, total, percentage: total > 0 ? (confirmed / total * 100).toFixed(1) : 0 }
        },
        citations: [{
          type: 'table',
          source: 'production_orders',
          title: `Заказ #${params.order_id}`,
          excerpt: `status: ${order?.status}`
        }]
      };
    }
  },
  
  {
    name: 'get_order_blockers',
    description: 'Найти блокирующие факторы заказа',
    inputSchema: { type: 'object', properties: { order_id: { type: 'number' } }, required: ['order_id'] },
    execute: async (params) => {
      const supabase = await createClient();
      
      const blockers: any[] = [];
      
      const { data: batches } = await supabase
        .from('production_batches')
        .select('id, batch_number, status')
        .eq('order_id', params.order_id)
        .in('status', ['created', 'cutting', 'sewing']);
      
      for (const batch of batches || []) {
        if (batch.status === 'created') {
          blockers.push({ type: 'batch_stuck', batch_id: batch.id, message: `Партия ${batch.batch_number} не запущена` });
        }
        
        const { data: recentEntries } = await supabase
          .from('operation_entries')
          .select('created_at')
          .eq('batch_id', batch.id)
          .order('created_at', { ascending: false })
          .limit(1);
        
        if (!recentEntries || recentEntries.length === 0) {
          blockers.push({ type: 'no_activity', batch_id: batch.id, message: `Нет записей по партии ${batch.batch_number}` });
        }
      }
      
      return {
        success: true,
        data: { blockers, count: blockers.length },
        citations: []
      };
    }
  },
  
  {
    name: 'get_order_timeline',
    description: 'Timeline заказа с датами переходов статусов',
    inputSchema: { type: 'object', properties: { order_id: { type: 'number' } }, required: ['order_id'] },
    execute: async (params) => {
      const supabase = await createClient();
      
      const { data: order } = await supabase
        .from('production_orders')
        .select('order_number, status, order_date, approved_at, launched_at, completed_at')
        .eq('id', params.order_id)
        .single();
      
      const timeline = [
        { status: 'created', date: order?.order_date, label: 'Создан' },
        { status: 'approved', date: order?.approved_at, label: 'Одобрен' },
        { status: 'launched', date: order?.launched_at, label: 'Запущен' },
        { status: 'completed', date: order?.completed_at, label: 'Завершен' }
      ].filter(t => t.date);
      
      return {
        success: true,
        data: { order_number: order?.order_number, timeline },
        citations: []
      };
    }
  },
  
  {
    name: 'get_order_payroll_impact',
    description: 'Влияние заказа на ЗП',
    inputSchema: { type: 'object', properties: { order_id: { type: 'number' } }, required: ['order_id'] },
    execute: async (params) => {
      const supabase = await createClient();
      
      const { data: batches } = await supabase
        .from('production_batches')
        .select('id')
        .eq('order_id', params.order_id);
      
      const batchIds = batches?.map(b => b.id) || [];
      
      const { data: accruals } = await supabase
        .from('payroll_accruals')
        .select('id, total_amount')
        .in('batch_id', batchIds);
      
      const totalAmount = accruals?.reduce((sum, a) => sum + (a.total_amount || 0), 0) || 0;
      
      return {
        success: true,
        data: {
          total_accruals: accruals?.length || 0,
          total_amount: totalAmount,
          currency: 'UAH'
        },
        citations: []
      };
    }
  }
];
