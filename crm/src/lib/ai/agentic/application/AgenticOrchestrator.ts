import fs from 'fs';
import path from 'path';
import { z } from 'zod';
import { SupabaseRepository } from '../infrastructure/SupabaseRepository';
import { AIProvider } from '../infrastructure/AIProvider';
import { AIProviderFactory } from '../infrastructure/AIProviderFactory';
import { KnowledgeRepository } from '../../knowledge/KnowledgeRepository';
import { KnowledgeTools } from '../infrastructure/KnowledgeTools';

const ToolCallSchema = z.object({
  tool: z.string(),
  params: z.record(z.string(), z.any())
});

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
      console.error(`Error reading skill file ${fileName}:`, error);
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
      You are an AI assistant for the "Shveyka" manufacturing system.
      Your goal is to identify and explain production anomalies based on KPI metrics and UX guidelines 3-30-300.

      GROUND TRUTH:
      ${productionRules}

      UX Guidelines:
      ${uxGuidelines}

      Current data:
      ${JSON.stringify(context, null, 2)}

      Tasks:
      1. Identify the top 3 KPI anomalies
      2. Identify 1-2 UX friction points
      3. Provide specific recommendations for improvement
      
      Respond concisely and clearly.
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
      You are an AI assistant for "Shveyka". Answer user questions about production clearly.

      Ground truth:
      ${productionRules}

      ${knowledgeContext ? `Relevant knowledge base data:\n${knowledgeContext}` : ''}

      User question: ${message}

      Answer clearly and helpfully.
    `;

    return await this.getAi().generateResponse(prompt, history);
  }

  async handleAgenticQuery(message: string, history: any[] = []) {
    const toolDescriptions = this.tools.getToolDescriptions();
    
    const systemPrompt = `
      You are an AI assistant with agentic capabilities for "Shveyka".
      
      Available tools:
      ${toolDescriptions}

      Instructions:
      1. First check if you need additional data: if yes - execute a tool call
      2. Then search for relevant info in knowledge base
      3. Formulate a clear response
      4. Add citations to sources

      To call a tool, return JSON format:
      {"tool": "tool_name", "params": {...parameters}}
    `;

    const fullPrompt = `${systemPrompt}\n\nUser: ${message}`;
    const response = await this.getAi().generateResponse(fullPrompt, history);

    const toolCallMatch = response.match(/\{"tool":\s*"([^"]+)",\s*"params":\s*(\{[^}]+\})\}/);
    
if (toolCallMatch) {
    try {
      const toolName = toolCallMatch[1];
      const paramsJson = toolCallMatch[2];

      let params: Record<string, any>;
      try {
        params = JSON.parse(paramsJson);
      } catch (jsonError) {
        console.error('Failed to parse tool params JSON:', jsonError);
        return `Ошибка парсинга параметров инструмента: получен некорректный JSON`;
      }

      const parseResult = ToolCallSchema.safeParse({ tool: toolName, params });

      if (!parseResult.success) {
        console.error('Invalid tool call format:', parseResult.error);
        return `Некорректный формат вызова инструмента: ${parseResult.error.message}`;
      }

const validatedParams = parseResult.data.params;

    const toolResult = await this.tools.executeTool(toolName, validatedParams);
        
        if (toolResult.success) {
          const resultPrompt = `
            Tool ${toolName} execution result:
            ${JSON.stringify(toolResult.data, null, 2)}

            Based on this data, provide a clear and helpful answer to the user.
          `;
          return await this.getAi().generateResponse(resultPrompt, history);
        }
      } catch (parseError) {
        console.error('Failed to parse tool call:', parseError);
        return response;
      }
    }

    return response;
  }

  async explainOrder(orderId: number) {
    const orderResult = await this.tools.executeTool('get_order_info', { orderId });
    
    if (!orderResult.success) {
      return `Could not find order #${orderId}`;
    }

    const order = orderResult.data;
    const knowledgeResults = await this.knowledgeRepo.searchKnowledge(`order status ${order.status}`, 2);
    
    const knowledgeContext = knowledgeResults.length > 0
      ? knowledgeResults.map(r => r.content).join('\n\n')
      : '';

    const prompt = `
      Explain order status in simple terms for workers.

      Order data:
      ${JSON.stringify(order, null, 2)}

      ${knowledgeContext ? `Additional context:\n${knowledgeContext}` : ''}

      Provide a concise and simple explanation for non-technical users.
    `;

    return await this.getAi().generateResponse(prompt);
  }

  async explainPayroll(employeeId?: number, periodId?: number) {
    const payrollResult = await this.tools.executeTool('get_payroll_info', { employeeId, periodId });
    
    if (!payrollResult.success) {
      return 'Could not find payroll data for the specified parameters';
    }

    const payroll = payrollResult.data;
    const knowledgeResults = await this.knowledgeRepo.searchKnowledge('payroll calculation formula components', 2);
    
    const knowledgeContext = knowledgeResults.length > 0
      ? knowledgeResults.map(r => r.content).join('\n\n')
      : '';

    const prompt = `
      Explain payroll calculation.

      Payroll data:
      ${JSON.stringify(payroll, null, 2)}

      ${knowledgeContext ? `Additional formulas:\n${knowledgeContext}` : ''}

      Provide a concise and simple explanation for non-technical users.
    `;

    return await this.getAi().generateResponse(prompt);
  }

  async retrieveSOP(sopName: string) {
    const sopResult = await this.tools.executeTool('get_sop', { name: sopName });
    
    if (!sopResult.success) {
      return `SOP "${sopName}" not found`;
    }

    return sopResult.data.content;
  }
}
