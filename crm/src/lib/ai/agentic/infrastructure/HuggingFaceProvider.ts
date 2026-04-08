import { AIProvider } from './AIProvider';

interface GemmaResponse {
  content: string;
  tool_calls?: Array<{
    name: string;
    params: Record<string, any>;
  }>;
}

export class HuggingFaceProvider implements AIProvider {
  private apiKey: string;
  private model: string;
  private endpoint: string;
  
  constructor() {
    this.apiKey = process.env.HUGGINGFACE_API_KEY || '';
    this.model = process.env.GEMMA_MODEL || 'google/gemma-2-9b-it';
    this.endpoint = `https://api-inference.huggingface.co/models/${this.model}`;
  }
  
  async generateResponse(prompt: string, history: any[] = []): Promise<string> {
    try {
      const response = await fetch(this.endpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          inputs: this._buildPrompt(prompt, history),
          parameters: {
            max_new_tokens: 1024,
            temperature: 0.7,
            return_full_text: false
          }
        })
      });
      
      if (!response.ok) {
        throw new Error(`HuggingFace API error: ${response.status}`);
      }
      
      const data = await response.json();
      return data[0]?.generated_text || '';
    } catch (error: any) {
      console.error('HuggingFace Provider Error:', error);
      throw new Error(`Ошибка HuggingFace: ${error.message}`);
    }
  }
  
  async generateStructuredResponse(
    prompt: string,
    history: any[] = []
  ): Promise<GemmaResponse> {
    const structuredPrompt = `${prompt}

Ответ в формате JSON:
{
  "content": "Текст ответа",
  "tool_calls": [{"name": "...", "params": {...}}]
}`;
    
    const response = await this.generateResponse(structuredPrompt, history);
    
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch (e) {
      console.warn('Failed to parse structured response');
    }
    
    return { content: response };
  }
  
  private _buildPrompt(prompt: string, history: any[]): string {
    if (history.length === 0) {
      return prompt;
    }
    
    const historyText = history
      .map(h => `${h.role === 'user' ? 'Пользователь' : 'Ассистент'}: ${h.content}`)
      .join('\n');
    
    return `${historyText}\n\nПользователь: ${prompt}`;
  }
}
