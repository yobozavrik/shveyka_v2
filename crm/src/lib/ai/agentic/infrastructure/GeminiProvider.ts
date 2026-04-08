import { GoogleGenerativeAI } from '@google/generative-ai';
import { AIProvider } from './AIProvider';

export class GeminiProvider implements AIProvider {
  private genAI: GoogleGenerativeAI;
  private model: any;

  constructor() {
    const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY || '';
    if (!apiKey || apiKey === 'your_api_key_here') {
      throw new Error("GOOGLE_GENERATIVE_AI_API_KEY не задан.");
    }
    this.genAI = new GoogleGenerativeAI(apiKey);
    this.model = this.genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
  }

  /**
   * Генерация контента на основе правил (Skills) и данных контекста
   */
  async generateResponse(prompt: string, history: any[] = []): Promise<string> {
    try {
      if (history.length > 0) {
        const chat = this.model.startChat({
          history: history.map(h => ({
            role: h.role === 'user' ? 'user' : 'model',
            parts: [{ text: h.content || h.parts?.[0]?.text || '' }]
          })),
        });
        const result = await chat.sendMessage(prompt);
        return result.response.text();
      } else {
        const result = await this.model.generateContent(prompt);
        return result.response.text();
      }
    } catch (error: any) {
      console.error('Gemini Provider Error:', error);
      throw new Error(`Ошибка Gemini: ${error.message}`);
    }
  }
}
