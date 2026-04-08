import { KnowledgeRepository } from '../../knowledge/KnowledgeRepository';

export interface ToolResult {
  success: boolean;
  data?: any;
  error?: string;
}

export interface KnowledgeTool {
  name: string;
  description: string;
  execute: (params: any) => Promise<ToolResult>;
}

export class SearchKnowledgeTool implements KnowledgeTool {
  name = 'search_knowledge';
  description = 'Поиск по базе знаний SOP и процессов. Возвращает релевантные чанки знаний.';
  private repo: KnowledgeRepository;

  constructor() {
    this.repo = new KnowledgeRepository();
  }

  async execute(params: { query: string; limit?: number }): Promise<ToolResult> {
    try {
      const results = await this.repo.searchKnowledge(
        params.query,
        params.limit || 3
      );
      return { success: true, data: results };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }
}

export class GetSOPTool implements KnowledgeTool {
  name = 'get_sop';
  description = 'Получить конкретный SOP по имени файла.';
  private repo: KnowledgeRepository;

  constructor() {
    this.repo = new KnowledgeRepository();
  }

  async execute(params: { name: string }): Promise<ToolResult> {
    try {
      const sourcePath = `sop/${params.name}.md`;
      const chunks = await this.repo.getKnowledgeBySource(sourcePath);
      
      if (chunks.length === 0) {
        return { success: false, error: `SOP "${params.name}" не найден` };
      }

      const fullContent = chunks
        .sort((a, b) => a.chunk_index - b.chunk_index)
        .map(c => c.content)
        .join('\n\n');

      return { success: true, data: { source: sourcePath, content: fullContent } };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }
}

export class GetOrderInfoTool implements KnowledgeTool {
  name = 'get_order_info';
  description = 'Получить информацию о заказе из базы данных.';
  private repo: KnowledgeRepository;

  constructor() {
    this.repo = new KnowledgeRepository();
  }

  async execute(params: { orderId: number }): Promise<ToolResult> {
    try {
      const { supabaseAdmin } = await import('../../../../lib/supabase/admin');
      
      const { data, error } = await supabaseAdmin
        .from('production_orders')
        .select(`
          id,
          order_number,
          status,
          priority,
          total_quantity,
          order_date,
          planned_start_date,
          planned_completion_date,
          notes,
          customers(name)
        `)
        .eq('id', params.orderId)
        .single();

      if (error) {
        return { success: false, error: `Заказ #${params.orderId} не найден` };
      }

      return { success: true, data };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }
}

export class GetPayrollInfoTool implements KnowledgeTool {
  name = 'get_payroll_info';
  description = 'Получить информацию о расчете зарплаты за период.';
  
  async execute(params: { employeeId?: number; periodId?: number }): Promise<ToolResult> {
    try {
      const { supabaseAdmin } = await import('../../../../lib/supabase/admin');
      
      let query = supabaseAdmin
        .from('payroll_accruals')
        .select(`
          id,
          employee_id,
          period_id,
          total_amount,
          piece_rate_amount,
          confirmed_quantity,
          employees(full_name, position),
          payroll_periods(name, date_from, date_to)
        `);

      if (params.employeeId) {
        query = query.eq('employee_id', params.employeeId);
      }
      if (params.periodId) {
        query = query.eq('period_id', params.periodId);
      }

      const { data, error } = await query.limit(10);

      if (error) {
        return { success: false, error: 'Ошибка получения данных о зарплате' };
      }

      return { success: true, data };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }
}

export class KnowledgeTools {
  private tools: Map<string, KnowledgeTool>;

  constructor() {
    this.tools = new Map();
    this.register(new SearchKnowledgeTool());
    this.register(new GetSOPTool());
    this.register(new GetOrderInfoTool());
    this.register(new GetPayrollInfoTool());
  }

  register(tool: KnowledgeTool): void {
    this.tools.set(tool.name, tool);
  }

  getTool(name: string): KnowledgeTool | undefined {
    return this.tools.get(name);
  }

  getAllTools(): KnowledgeTool[] {
    return Array.from(this.tools.values());
  }

  getToolDescriptions(): string {
    return this.getAllTools()
      .map(t => `- ${t.name}: ${t.description}`)
      .join('\n');
  }

  async executeTool(name: string, params: any): Promise<ToolResult> {
    const tool = this.getTool(name);
    if (!tool) {
      return { success: false, error: `Инструмент "${name}" не найден` };
    }
    return tool.execute(params);
  }
}
