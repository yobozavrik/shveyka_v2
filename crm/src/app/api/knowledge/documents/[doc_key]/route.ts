import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(
  request: Request,
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
    
    if (error || !doc) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }
    
    const { data: chunks } = await supabase
      .from('knowledge_chunks')
      .select('chunk_index, heading_path, content')
      .eq('document_id', doc.id)
      .order('chunk_index');
    
    return NextResponse.json({
      document: doc,
      chunks,
      total_chunks: chunks?.length || 0
    });
  } catch (error: any) {
    console.error('Get document error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
