import { Tool, ToolResult, Citation } from './ToolRegistry';
import { createClient } from '@/lib/supabase/server';

export const knowledgeTools: Tool[] = [
  {
    name: 'search_knowledge',
    description: 'Поиск по документам знаний',
    inputSchema: { 
      type: 'object', 
      properties: { 
        query: { type: 'string' },
        domain: { type: 'string' },
        limit: { type: 'number' }
      }, 
      required: ['query'] 
    },
    execute: async (params) => {
      const supabase = await createClient();
      
      const limit = params.limit || 5;
      
      let query = supabase
        .from('knowledge_chunks')
        .select('id, content, heading_path, document_id')
        .textSearch('content', params.query)
        .limit(limit);
      
      if (params.domain) {
        const { data: docs } = await supabase
          .from('knowledge_documents')
          .select('id')
          .eq('domain', params.domain)
          .eq('status', 'active');
        
        const docIds = docs?.map(d => d.id) || [];
        query = query.in('document_id', docIds);
      }
      
      const { data: chunks } = await query;
      
      const results = await Promise.all(
        (chunks || []).map(async (chunk) => {
          const { data: doc } = await supabase
            .from('knowledge_documents')
            .select('doc_key, title, vault_path')
            .eq('id', chunk.document_id)
            .single();
          
          return {
            chunk_id: chunk.id,
            heading: chunk.heading_path,
            content: chunk.content.substring(0, 200) + '...',
            document: doc
          };
        })
      );
      
      return {
        success: true,
        data: { results, count: results.length },
        citations: results.map(r => ({
          type: 'document',
          source: r.document?.doc_key || '',
          title: r.document?.title || '',
          excerpt: r.content,
          url: r.document?.vault_path
        }))
      };
    }
  },
  
  {
    name: 'get_document',
    description: 'Получить документ по ключу',
    inputSchema: { type: 'object', properties: { doc_key: { type: 'string' } }, required: ['doc_key'] },
    execute: async (params) => {
      const supabase = await createClient();
      
      const { data: doc } = await supabase
        .from('knowledge_documents')
        .select('id, doc_key, title, domain, doc_type, vault_path, frontmatter')
        .eq('doc_key', params.doc_key)
        .single();
      
      if (!doc) {
        return {
          success: false,
          data: null,
          citations: [],
          error: 'Document not found'
        };
      }
      
      const { data: chunks } = await supabase
        .from('knowledge_chunks')
        .select('chunk_index, heading_path, content')
        .eq('document_id', doc.id)
        .order('chunk_index');
      
      return {
        success: true,
        data: {
          document: doc,
          chunks,
          total_chunks: chunks?.length || 0
        },
        citations: [{
          type: 'document',
          source: doc.doc_key,
          title: doc.title,
          url: doc.vault_path
        }]
      };
    }
  }
];
