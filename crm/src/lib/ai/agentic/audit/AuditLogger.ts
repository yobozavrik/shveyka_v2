import { createClient } from '@/lib/supabase/server';

export interface AssistantSession {
  id?: string;
  user_id: string;
  role: string;
  context: Record<string, any>;
  started_at?: Date;
  ended_at?: Date;
}

export interface ToolCallLog {
  id?: string;
  session_id: string;
  tool_name: string;
  tool_input: Record<string, any>;
  tool_output?: Record<string, any>;
  latency_ms?: number;
  created_at?: Date;
}

export interface FeedbackLog {
  session_id: string;
  rating: number;
  comment?: string;
  created_at?: Date;
}

export class AuditLogger {
  async logSession(session: AssistantSession): Promise<string> {
    const supabase = await createClient();
    
    const { data, error } = await supabase
      .from('assistant_sessions')
      .insert({
        user_id: session.user_id,
        role: session.role,
        context: session.context,
        started_at: session.started_at || new Date()
      })
      .select('id')
      .single();
    
    if (error) {
      console.error('AuditLogger session error:', error);
      throw error;
    }
    
    return data.id;
  }
  
  async endSession(sessionId: string): Promise<void> {
    const supabase = await createClient();
    
    await supabase
      .from('assistant_sessions')
      .update({ ended_at: new Date() })
      .eq('id', sessionId);
  }
  
  async logToolCall(call: ToolCallLog): Promise<void> {
    const supabase = await createClient();
    
    const { error } = await supabase
      .from('assistant_tool_calls')
      .insert({
        session_id: call.session_id,
        tool_name: call.tool_name,
        tool_input: call.tool_input,
        tool_output: call.tool_output,
        latency_ms: call.latency_ms
      });
    
    if (error) {
      console.error('AuditLogger tool call error:', error);
    }
  }
  
  async logFeedback(feedback: FeedbackLog): Promise<void> {
    const supabase = await createClient();
    
    const { error } = await supabase
      .from('assistant_feedback')
      .insert({
        session_id: feedback.session_id,
        rating: feedback.rating,
        comment: feedback.comment
      });
    
    if (error) {
      console.error('AuditLogger feedback error:', error);
    }
  }
  
  async getSessionStats(sessionId: string): Promise<any> {
    const supabase = await createClient();
    
    const { data: toolCalls } = await supabase
      .from('assistant_tool_calls')
      .select('tool_name, latency_ms')
      .eq('session_id', sessionId);
    
    const avgLatency = toolCalls && toolCalls.length > 0
      ? toolCalls.reduce((sum, tc) => sum + (tc.latency_ms || 0), 0) / toolCalls.length
      : 0;
    
    return {
      session_id: sessionId,
      tool_calls_count: toolCalls?.length || 0,
      tools_used: toolCalls?.map(tc => tc.tool_name) || [],
      avg_latency_ms: avgLatency
    };
  }
}
