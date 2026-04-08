import fs from 'fs';
import path from 'path';
import { SupabaseRepository } from '../infrastructure/SupabaseRepository';
import { AIProvider } from '../infrastructure/AIProvider';
import { AIProviderFactory } from '../infrastructure/AIProviderFactory';
import { KnowledgeRepository } from '../../knowledge/KnowledgeRepository';
import { KnowledgeTools } from '../infrastructure/KnowledgeTools';

export class AgenticOrchestrator {
  private repo: SupabaseRepository;
  private ai: AIProvider | null;
  private knowledgeRepo: KnowledgeRepository;
  private tools: KnowledgeTools;

  constructor() {
    this.repo = new SupabaseRepository();
    this.ai = null;
    this.knowledgeRepo = new KnowledgeRepository();
    this.tools = new KnowledgeTools();
  }

  private getAi(): AIProvider {
    if (!this.ai) {
      this.ai = AIProviderFactory.getProvider();
    }

    return this.ai;
  }

  private readSkill(fileName: string): string {
    try {
      const filePath = path.join(process.cwd(), 'src/lib/ai/agentic/domain', fileName);
      return fs.readFileSync(filePath, 'utf-8');
    } catch (error) {
      console.error(`Ошибка чтения навыка ${fileName}:`, error);
      return "";
    }
  }

  async getSmartInsights() {
    const productionRules = this.readSkill('production-rules.md');
    const uxGuidelines = this.readSkill('ux-guidelines.md');

    const batches = await this.repo.getActiveBatches();
    const recentActivity = await this.repo.getRecentOperationEntries();

    const context = {
      batches,
      recentActivity,
      timestamp: new Date().toLocaleString('ru-RU')
    };

    const prompt = `
      ТЫ: Профессиональный AI-ассистент системы "Швейка".
      ТВОЯ ЗАДАЧА: Проанализировать данные производства и дать инсайты в формате UX 3-30-300.

      БИЗНЕС-ПРАВИЛА (GROUND TRUTH):
      ${productionRules}

      ПРАВИЛА ВИЗУАЛИЗАЦИИ:
      ${uxGuidelines}

      АКТУАЛЬНЫЕ ДАННЫЕ ИЗ БАЗЫ:
      ${JSON.stringify(context, null, 2)}

      ИНСТРУКЦИЯ:
      1. Сначала выведи Зону 3 (KPI) — кратко.
      2. Затем Зону 30 (Аналитика) — 1-2 предложения.
      3. Затем Зону 300 (Действие) — список рекомендаций.
      
      Генерируй ответ строго на РУССКОМ языке.
    `;

    return await this.getAi().generateResponse(prompt);
  }

  async searchKnowledge(query: string, limit: number = 5) {
    return this.knowledgeRepo.searchKnowledge(query, limit);
  }

  async handleUserQuery(message: string, history: any[] = []) {
    const productionRules = this.readSkill('production-rules.md');
    
    const knowledgeResults = await this.knowledgeRepo.searchKnowledge(message, 3);
    const knowledgeContext = knowledgeResults.length > 0
      ? knowledgeResults.map(r => `[${r.source_path}]: ${r.content}`).join('\n\n')
      : '';

    const prompt = `
      ТЫ: AI-ассистент системы "Швейка". Отвечай на вопросы пользователя.

      БИЗНЕС-ПРАВИЛА:
      ${productionRules}

      ${knowledgeContext ? `РЕЛЕВАНТНЫЕ ЗНАНИЯ ИЗ БАЗЫ:\n${knowledgeContext}` : ''}

      Вопрос пользователя: ${message}

      Отвечай кратко и по существу на русском языке.
    `;

    return await this.getAi().generateResponse(prompt, history);
  }

  async handleAgenticQuery(message: string, history: any[] = []) {
    const toolDescriptions = this.tools.getToolDescriptions();
    
    const systemPrompt = `
      ТЫ: AI-ассистент с доступом к инструментам системы "Швейка".
      
      ДОСТУПНЫЕ ИНСТРУМЕНТЫ:
      ${toolDescriptions}

      ПРАВИЛА:
      1. Если вопрос требует данных из базы - используй инструменты
      2. Если вопрос о процессах - ищи в knowledge base
      3. Всегда отвечай на русском языке
      4. Будь краток и информативен

      Для вызова инструмента используй JSON формат:
      {"tool": "название_инструмента", "params": {...параметры}}
    `;

    const fullPrompt = `${systemPrompt}\n\nВопрос: ${message}`;
    const response = await this.getAi().generateResponse(fullPrompt, history);

    const toolCallMatch = response.match(/\{"tool":\s*"([^"]+)",\s*"params":\s*(\{[^}]+\})\}/);
    
    if (toolCallMatch) {
      const toolName = toolCallMatch[1];
      const params = JSON.parse(toolCallMatch[2]);
      
      const toolResult = await this.tools.executeTool(toolName, params);
      
      if (toolResult.success) {
        const resultPrompt = `
          Результат выполнения инструмента ${toolName}:
          ${JSON.stringify(toolResult.data, null, 2)}

          Сформулируй ответ пользователю на основе этих данных.
        `;
        return await this.getAi().generateResponse(resultPrompt, history);
      }
    }

    return response;
  }

  async explainOrder(orderId: number) {
    const orderResult = await this.tools.executeTool('get_order_info', { orderId });
    
    if (!orderResult.success) {
      return `Не удалось найти заказ #${orderId}`;
    }

    const order = orderResult.data;
    const knowledgeResults = await this.knowledgeRepo.searchKnowledge(`статус заказа ${order.status}`, 2);
    
    const knowledgeContext = knowledgeResults.length > 0
      ? knowledgeResults.map(r => r.content).join('\n\n')
      : '';

    const prompt = `
      Объясни пользователю статус заказа в понятных терминах.

      ДАННЫЕ ЗАКАЗА:
      ${JSON.stringify(order, null, 2)}

      ${knowledgeContext ? `КОНТЕКСТ СТАТУСА:\n${knowledgeContext}` : ''}

      Ответ должен быть кратким и информативным на русском языке.
    `;

    return await this.getAi().generateResponse(prompt);
  }

  async explainPayroll(employeeId?: number, periodId?: number) {
    const payrollResult = await this.tools.executeTool('get_payroll_info', { employeeId, periodId });
    
    if (!payrollResult.success) {
      return 'Не удалось получить данные о зарплате';
    }

    const payroll = payrollResult.data;
    const knowledgeResults = await this.knowledgeRepo.searchKnowledge('расчет зарплаты премиальная часть', 2);
    
    const knowledgeContext = knowledgeResults.length > 0
      ? knowledgeResults.map(r => r.content).join('\n\n')
      : '';

    const prompt = `
      Объясни пользователю расчет зарплаты.

      ДАННЫЕ О ЗАРПЛАТЕ:
      ${JSON.stringify(payroll, null, 2)}

      ${knowledgeContext ? `ПРАВИЛА РАСЧЕТА:\n${knowledgeContext}` : ''}

      Ответ должен быть кратким и информативным на русском языке.
    `;

    return await this.getAi().generateResponse(prompt);
  }

  async retrieveSOP(sopName: string) {
    const sopResult = await this.tools.executeTool('get_sop', { name: sopName });
    
    if (!sopResult.success) {
      return `SOP "${sopName}" не найден`;
    }

    return sopResult.data.content;
  }
}
