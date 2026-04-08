import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    
    const { query, domain, limit = 5 } = await request.json();
    
    if (!query) {
      return NextResponse.json({ error: 'Query required' }, { status: 400 });
    }
    
    const { data: chunks, error } = await supabase
      .from('knowledge_chunks')
      .select('id, content, heading_path, document_id')
      .textSearch('content', query)
      .limit(limit);
    
    if (error) {
      throw error;
    }
    
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
    
    return NextResponse.json({ results, count: results.length });
  } catch (error: any) {
    console.error('Knowledge search error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
