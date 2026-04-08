import fs from 'fs';
import path from 'path';
import { SupabaseRepository } from '../infrastructure/SupabaseRepository';
import { AIProvider } from '../infrastructure/AIProvider';
import { AIProviderFactory } from '../infrastructure/AIProviderFactory';
import { createToolRegistry, ToolRegistry, Citation } from '../tools';
import { PolicyGuard, UserRole } from '../guard/PolicyGuard';
import { AuditLogger } from '../audit/AuditLogger';

export class AgenticOrchestratorV2 {
  private repo: SupabaseRepository;
  private ai: AIProvider | null;
  private toolRegistry: ToolRegistry;
  private policyGuard: PolicyGuard;
  private auditLogger: AuditLogger;

  constructor(userRole: UserRole = 'manager') {
    this.repo = new SupabaseRepository();
    this.ai = null;
    this.toolRegistry = createToolRegistry();
    this.policyGuard = new PolicyGuard(userRole);
    this.auditLogger = new AuditLogger();
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

  async handleQuery(
    message: string, 
    context: { order_id?: number; worker_id?: number; period_id?: number } = {},
    history: any[] = []
  ) {
    const sessionId = await this.auditLogger.logSession({
      user_id: 'system',
      role: this.policyGuard['role'],
      context
    });

    try {
      const productionRules = this.readSkill('production-rules.md');
      
      const toolDescriptions = this.toolRegistry.getToolDescriptions();
      
      const systemPrompt = `
        ТЫ: AI-ассистент системы "Швейка" с доступом к инструментам.
        
        БИЗНЕС-ПРАВИЛА:
        ${productionRules}

        ДОСТУПНЫЕ ИНСТРУМЕНТЫ:
        ${toolDescriptions}

        КОНТЕКСТ ВОПРОСА:
        ${JSON.stringify(context)}

        ПРАВИЛА:
        1. Используй инструменты для получения данных
        2. Отвечай кратко и по существу
        3. Всегда указывай источники (citations)
        4. Отвечай на русском языке

        Формат вызова инструмента:
        {"tool": "название", "params": {...}}
      `;

      const fullPrompt = `${systemPrompt}\n\nВопрос: ${message}`;
      const response = await this.getAi().generateResponse(fullPrompt, history);

      const toolCallMatch = response.match(/\{"tool":\s*"([^"]+)",\s*"params":\s*(\{[^}]+\})\}/);
      
      let finalAnswer = response;
      let citations: Citation[] = [];

      if (toolCallMatch) {
        const toolName = toolCallMatch[1];
        const params = JSON.parse(toolCallMatch[2]);

        if (!this.policyGuard.canUseTool(toolName)) {
          await this.auditLogger.logToolCall({
            session_id: sessionId,
            tool_name: toolName,
            tool_input: params,
            tool_output: { error: 'Policy denied' }
          });
          return { answer: 'Недостаточно прав для выполнения операции', citations: [] };
        }

        const startTime = Date.now();
        const tool = this.toolRegistry.get(toolName);
        
        if (tool) {
          try {
            const toolResult = await tool.execute(params);
            const latency = Date.now() - startTime;

            await this.auditLogger.logToolCall({
              session_id: sessionId,
              tool_name: toolName,
              tool_input: params,
              tool_output: toolResult.data,
              latency_ms: latency
            });

            if (toolResult.success) {
              const filteredData = this.policyGuard.filterOutput(toolResult.data, toolName);
              citations = toolResult.citations;

              const resultPrompt = `
                Результат: ${JSON.stringify(filteredData, null, 2)}
                
                Сформулируй ответ пользователю на основе этих данных.
                Ответ должен быть структурированным:
                - Факт: что происходит
                - Вывод: что это значит
                - Действие: что делать
              `;
              
              finalAnswer = await this.getAi().generateResponse(resultPrompt, history);
            }
          } catch (error: any) {
            console.error('Tool execution error:', error);
            finalAnswer = `Ошибка выполнения: ${error.message}`;
          }
        }
      }

      await this.auditLogger.endSession(sessionId);

      return { answer: finalAnswer, citations };
    } catch (error: any) {
      console.error('Orchestrator error:', error);
      return { answer: 'Ошибка обработки запроса', citations: [] };
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
}
