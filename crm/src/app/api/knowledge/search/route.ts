import { createClient } from '@/lib/supabase/server';
import { ApiResponse } from '@/lib/api-response';
import { ERROR_CODES } from '@shveyka/shared';

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    
    const { query, limit = 5 } = await request.json();
    
    if (!query) return ApiResponse.error('Query required', ERROR_CODES.BAD_REQUEST, 400);
    
    const { data: chunks, error } = await supabase
      .from('knowledge_chunks')
      .select('id, content, heading_path, document_id')
      .textSearch('content', query)
      .limit(limit);
    
    if (error) throw error;
    
    const results = await Promise.all(
      (chunks || []).map(async (chunk) => {
        const { data: doc } = await supabase
          .from('knowledge_documents')
          .select('doc_key, title, domain, vault_path')
          .eq('id', chunk.document_id)
          .single();
        
        return {
          chunk_id: chunk.id,
          heading: chunk.heading_path,
          content: chunk.content.substring(0, 300) + '...',
          document: doc
        };
      })
    );
    
    return ApiResponse.success({ results, count: results.length });
  } catch (error: any) {
    return ApiResponse.handle(error, 'knowledge_search_post');
  }
}
