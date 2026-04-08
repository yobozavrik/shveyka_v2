import { AIProvider } from './AIProvider';
import { OpenRouterProvider } from './OpenRouterProvider';
import { GroqProvider } from './GroqProvider';
import { HuggingFaceProvider } from './HuggingFaceProvider';

export class AIProviderFactory {
  static getProvider(): AIProvider {
    const providerType = process.env.SCOUT_AGENT_PROVIDER || 'huggingface-gemma';

    if (providerType === 'openrouter-sdk') {
      return new OpenRouterProvider();
    }

    if (providerType === 'groq') {
      return new GroqProvider();
    }

    if (providerType === 'huggingface-gemma') {
      return new HuggingFaceProvider();
    }

    return new HuggingFaceProvider();
  }
}
