import { AIProvider } from './AIProvider';
import axios from 'axios';

export class GroqProvider implements AIProvider {
  private apiKey: string;
  private model: string;
  private apiUrl: string = 'https://api.groq.com/openai/v1/chat/completions';

  constructor() {
    this.apiKey = process.env.GROQ_API_KEY || '';
    this.model = 'llama-3.3-70b-versatile';
    
    if (!this.apiKey) {
      throw new Error('GROQ_API_KEY is required but not configured in environment variables');
    }
  }

  async generateResponse(query: string, history: any[] = []): Promise<string> {
    try {
      const messages = [
        ...history.map(h => ({
          role: h.role === 'user' ? 'user' : 'assistant',
          content: h.parts?.[0]?.text || h.content || ''
        })),
        { role: 'user', content: query }
      ];

      const response = await axios.post(
        this.apiUrl,
        {
          model: this.model,
          messages: messages,
          temperature: 0.2
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      return response.data.choices[0].message.content || '';
    } catch (error: any) {
      console.error('Groq AI Error:', error.response?.data || error.message);
      throw new Error(`Groq API error: ${error.message}`);
    }
  }
}
