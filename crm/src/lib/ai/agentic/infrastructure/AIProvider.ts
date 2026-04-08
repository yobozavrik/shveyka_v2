export interface AIProvider {
  /**
   * Генерирует ответ на основе промпта и истории сообщений
   */
  generateResponse(prompt: string, history?: any[]): Promise<string>;
}
