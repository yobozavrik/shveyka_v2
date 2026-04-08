import { Tool, ToolResult, Citation } from './ToolRegistry';
import { createClient } from '@/lib/supabase/server';

export const payrollTools: Tool[] = [
  {
    name: 'get_worker_payroll_summary',
    description: 'Сводка ЗП работника за период',
    inputSchema: { 
      type: 'object', 
      properties: { 
        worker_id: { type: 'number' },
        period_id: { type: 'number' }
      }, 
      required: ['worker_id', 'period_id'] 
    },
    execute: async (params) => {
      const supabase = await createClient();
      
      const { data: accruals } = await supabase
        .from('payroll_accruals')
        .select('id, total_amount, piece_rate_amount, confirmed_quantity, entry_id')
        .eq('employee_id', params.worker_id)
        .eq('period_id', params.period_id);
      
      const { data: adjustments } = await supabase
        .from('payroll_adjustments')
        .select('id, amount, adjustment_type, reason')
        .eq('employee_id', params.worker_id)
        .eq('period_id', params.period_id);
      
      const totalAccruals = accruals?.reduce((sum, a) => sum + (a.total_amount || 0), 0) || 0;
      const totalAdjustments = adjustments?.reduce((sum, a) => sum + (a.amount || 0), 0) || 0;
      
      return {
        success: true,
        data: {
          worker_id: params.worker_id,
          period_id: params.period_id,
          accruals_count: accruals?.length || 0,
          total_accruals: totalAccruals,
          adjustments_count: adjustments?.length || 0,
          total_adjustments: totalAdjustments,
          grand_total: totalAccruals + totalAdjustments,
          currency: 'UAH'
        },
        citations: []
      };
    }
  },
  
  {
    name: 'get_entry_payroll_explanation',
    description: 'Объяснение начисления по конкретной entry',
    inputSchema: { type: 'object', properties: { entry_id: { type: 'number' } }, required: ['entry_id'] },
    execute: async (params) => {
      const supabase = await createClient();
      
      const { data: entry } = await supabase
        .from('operation_entries')
        .select('id, quantity, confirmed_quantity, status, employee_id, operation_id')
        .eq('id', params.entry_id)
        .single();
      
      const { data: accrual } = await supabase
        .from('payroll_accruals')
        .select('id, total_amount, piece_rate_amount')
        .eq('entry_id', params.entry_id)
        .single();
      
      const calculation = accrual
        ? `${accrual.piece_rate_amount} грн × ${entry?.confirmed_quantity} шт = ${accrual.total_amount} грн`
        : 'Начисление не найдено';
      
      return {
        success: true,
        data: {
          entry_id: params.entry_id,
          entry_status: entry?.status,
          quantity: entry?.quantity,
          confirmed_quantity: entry?.confirmed_quantity,
          rate: accrual?.piece_rate_amount,
          amount: accrual?.total_amount,
          calculation
        },
        citations: []
      };
    }
  },
  
  {
    name: 'get_pending_entries',
    description: 'Entries без начислений за период',
    inputSchema: { type: 'object', properties: { period_id: { type: 'number' } }, required: ['period_id'] },
    execute: async (params) => {
      const supabase = await createClient();
      
      const { data: period } = await supabase
        .from('payroll_periods')
        .select('date_from, date_to')
        .eq('id', params.period_id)
        .single();
      
      const { data: entries } = await supabase
        .from('operation_entries')
        .select('id, employee_id, quantity, confirmed_quantity, status, created_at')
        .eq('status', 'confirmed')
        .gte('created_at', period?.date_from)
        .lte('created_at', period?.date_to);
      
      const entryIds = entries?.map(e => e.id) || [];
      
      const { data: accruals } = await supabase
        .from('payroll_accruals')
        .select('entry_id')
        .in('entry_id', entryIds);
      
      const accrualEntryIds = new Set(accruals?.map(a => a.entry_id) || []);
      
      const pending = entries?.filter(e => !accrualEntryIds.has(e.id)) || [];
      
      return {
        success: true,
        data: {
          total_confirmed: entries?.length || 0,
          with_accruals: accruals?.length || 0,
          pending_count: pending.length,
          pending_entries: pending.map(e => ({ id: e.id, employee_id: e.employee_id }))
        },
        citations: []
      };
    }
  }
];
