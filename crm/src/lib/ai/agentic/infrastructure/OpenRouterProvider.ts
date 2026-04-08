import axios from 'axios';
import { AIProvider } from './AIProvider';

export class OpenRouterProvider implements AIProvider {
  private apiKey: string;
  private model: string;
  private apiUrl: string = 'https://openrouter.ai/api/v1/chat/completions';

  constructor() {
    this.apiKey = process.env.OPENROUTER_API_KEY || '';
    this.model = process.env.OPENROUTER_MODEL || 'google/gemini-2.0-flash-001';

    if (!this.apiKey) {
      throw new Error("OPENROUTER_API_KEY не задан.");
    }
  }

  async generateResponse(prompt: string, history: any[] = []): Promise<string> {
    try {
      // 1. Формируем историю сообщений с учетом различных форматов (Gemini/OpenAI)
      const mappedHistory = history.map(h => {
        let role = h.role === 'user' ? 'user' : 'assistant';
        if (h.role === 'model') role = 'assistant';
        
        let content = '';
        if (typeof h.content === 'string') {
          content = h.content;
        } else if (Array.isArray(h.parts)) {
          content = h.parts.map((p: any) => p.text).join(' ');
        } else if (h.content?.text) {
          content = h.content.text;
        }

        return { role, content: content.trim() };
      }).filter(m => m.content.length > 0);

      // 2. Внедряем системную инструкцию прямо в финальный пользовательский промпт
      // Это делает запрос совместимым даже с самыми капризными моделями (как Minimax Free)
      const systemInstructions = `[ИНСТРУКЦИЯ]: Ты — профильный ассистент швейного производства "Швейка" (раскрой, пошив, склад). ОБЩАЙСЯ СТРОГО НА РУССКОМ ЯЗЫКЕ. Будь краток.\n\n`;
      const finalPrompt = systemInstructions + prompt;

      const messages = [
        ...mappedHistory,
        { role: 'user', content: finalPrompt }
      ];

      console.log(`[OpenRouter] Запрос к ${this.model}. Скорректированный режим.`);

      const response = await axios.post(this.apiUrl, {
        model: this.model,
        messages: messages,
        temperature: 0.6,
        max_tokens: 1500
      }, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'HTTP-Referer': 'https://shveyka.online',
          'X-Title': 'Shveyka ERP',
          'Content-Type': 'application/json'
        },
        timeout: 40000 // 40 секунд таймаут
      });

      if (response.data?.choices?.[0]?.message?.content) {
        return response.data.choices[0].message.content;
      }

      console.error('OpenRouter Unexpected Response Structure:', JSON.stringify(response.data, null, 2));
      throw new Error('Некорректная структура ответа от OpenRouter');
    } catch (error: any) {
      const apiError = error.response?.data?.error;
      // Если тело ответа содержит детальное сообщение об ошибке, забираем его
      const errorDetail = typeof error.response?.data === 'string' ? error.response.data : JSON.stringify(error.response?.data);
      const errorMsg = apiError?.message || error.message;
      
      console.error('OpenRouter Provider ERROR DETAILS:', {
        status: error.response?.status,
        model: this.model,
        raw_error: errorDetail
      });
      
      throw new Error(`Ошибка OpenRouter: ${errorMsg}`);
    }
  }
}
