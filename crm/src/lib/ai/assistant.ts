// Gemini Assistant Service V2 -> Universal AI Assistant Service
import { supabaseAdmin } from '@/lib/supabase/admin';
import { AIProviderFactory } from './agentic/infrastructure/AIProviderFactory';
import { AIProvider } from './agentic/infrastructure/AIProvider';

let aiProvider: AIProvider | null = null;

function getAiProvider(): AIProvider {
  if (!aiProvider) {
    aiProvider = AIProviderFactory.getProvider();
  }

  return aiProvider;
}

export async function getProductionInsights() {
  try {
    // 1. Fetch current active batches
    const { data: batches } = await supabaseAdmin
      .from('production_batches')
      .select(`
        batch_number, 
        quantity, 
        status, 
        is_urgent,
        priority,
        planned_end_date,
        product_models(name)
      `)
      .in('status', ['created', 'cutting', 'sewing'])
      .order('created_at', { ascending: false })
      .limit(10);

    // 2. Fetch recent operation entries
    const { data: recentEntries } = await supabaseAdmin
      .from('operation_entries')
      .select(`
        quantity, 
        status, 
        created_at,
        operations(name),
        production_batches(batch_number)
      `)
      .order('created_at', { ascending: false })
      .limit(20);

    const context = {
      batches: batches || [],
      recentActivity: recentEntries || [],
      timestamp: new Date().toISOString()
    };

    const prompt = `
      Ты — интеллектуальный помощник системы управления швейным производством "Швейка". 
      Твоя специализация: раскрой, пошив, склад материалов, учет брака и аналитика партий. 
      Анализируй текущее состояние данных:
      ${JSON.stringify(context)}
      Дай краткие инсайты (2-3) на РУССКОМ языке. Будь конструктивен.
    `;

    return await getAiProvider().generateResponse(prompt);
  } catch (error: any) {
    console.error('AI Error:', error);
    return `Ошибка: ${error.message || 'Ошибка генерации'}`;
  }
}

export async function askAssistant(question: string, history: any[] = []) {
  try {
    return await getAiProvider().generateResponse(question, history);
  } catch (error: any) {
    console.error('Chat Error:', error);
    return `Ошибка чата: ${error.message}`;
  }
}
