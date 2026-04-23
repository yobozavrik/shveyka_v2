import { createClient } from '@/lib/supabase/server';
import { ApiResponse } from '@/lib/api-response';
import { ERROR_CODES } from '@shveyka/shared';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ doc_key: string }> }
) {
  try {
    const supabase = await createClient();
    const { doc_key } = await params;
    
    const { data: doc, error } = await supabase
      .from('knowledge_documents')
      .select('id, doc_key, title, domain, doc_type, vault_path, frontmatter')
      .eq('doc_key', doc_key)
      .single();
    
    if (error || !doc) return ApiResponse.error('Document not found', ERROR_CODES.NOT_FOUND, 404);
    
    const { data: chunks, error: chunksError } = await supabase
      .from('knowledge_chunks')
      .select('chunk_index, heading_path, content')
      .eq('document_id', doc.id)
      .order('chunk_index');
    
    if (chunksError) return ApiResponse.handle(chunksError, 'knowledge_document_get');
    
    return ApiResponse.success({
      document: doc,
      chunks,
      total_chunks: chunks?.length || 0
    });
  } catch (error: any) {
    return ApiResponse.handle(error, 'knowledge_document_get');
  }
}
