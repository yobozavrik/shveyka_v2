import { supabaseAdmin } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

export interface ChatMessage {
  id?: string;
  user_id: number;
  role: 'user' | 'assistant' | 'system';
  content: string;
  session_id?: string;
  message_type?: string;
  metadata?: Record<string, any>;
  created_at?: Date;
}

export interface ChatContext {
  userId: number;
  messageCount?: number;
  sessionId?: string;
}

export class ChatMemoryService {
  async addMessage(
    userId: number,
    role: 'user' | 'assistant' | 'system',
    content: string,
    sessionId?: string,
    messageType: string = 'text',
    metadata: Record<string, any> = {}
  ): Promise<string> {
    const { data, error } = await supabaseAdmin
      .from('chat_conversations')
      .insert({
        user_id: userId,
        role,
        content,
        session_id: sessionId,
        message_type: messageType,
        metadata
      })
      .select('id')
      .single();

    if (error) {
      console.error('ChatMemory addMessage error:', error);
      throw error;
    }

    return data.id;
  }

  async addUserMessage(userId: number, content: string, sessionId?: string): Promise<string> {
    return this.addMessage(userId, 'user', content, sessionId, 'text');
  }

  async addAssistantMessage(userId: number, content: string, sessionId?: string): Promise<string> {
    return this.addMessage(userId, 'assistant', content, sessionId, 'text');
  }

  async getHistory(userId: number, limit: number = 50, offset: number = 0): Promise<ChatMessage[]> {
    const { data, error } = await supabaseAdmin
      .from('chat_conversations')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('ChatMemory getHistory error:', error);
      return [];
    }

    return data || [];
  }

  async getContextForLLM(userId: number, messageCount: number = 10): Promise<any[]> {
    const history = await this.getHistory(userId, messageCount, 0);

    return history
      .reverse()
      .map(msg => ({
        role: msg.role === 'assistant' ? 'assistant' : 'user',
        content: msg.content
      }));
  }

  async clearHistory(userId: number): Promise<number> {
    const { error } = await supabaseAdmin
      .from('chat_conversations')
      .delete()
      .eq('user_id', userId);

    if (error) {
      console.error('ChatMemory clearHistory error:', error);
      throw error;
    }

    return 0;
  }

  async getConversationCount(userId: number): Promise<number> {
    const { count, error } = await supabaseAdmin
      .from('chat_conversations')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);

    if (error) {
      console.error('ChatMemory getConversationCount error:', error);
      return 0;
    }

    return count || 0;
  }
}

let chatMemoryInstance: ChatMemoryService | null = null;

export function getChatMemory(): ChatMemoryService {
  if (!chatMemoryInstance) {
    chatMemoryInstance = new ChatMemoryService();
  }
  return chatMemoryInstance;
}