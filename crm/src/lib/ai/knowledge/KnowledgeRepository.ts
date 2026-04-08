import { supabaseAdmin } from '@/lib/supabase/admin';

export interface KnowledgeChunk {
  id: string;
  source_path: string;
  chunk_index: number;
  title: string | null;
  content: string;
  metadata: Record<string, any>;
}

export interface SearchResult {
  id: string;
  source_path: string;
  title: string | null;
  content: string;
  metadata: Record<string, any>;
  rank: number;
}

export class KnowledgeRepository {
  async searchKnowledge(query: string, limit: number = 5): Promise<SearchResult[]> {
    const { data, error } = await supabaseAdmin.rpc('search_knowledge', {
      query_text: query,
      limit_count: limit
    });

    if (error) {
      console.error('Knowledge search error:', error);
      throw new Error(`Ошибка поиска знаний: ${error.message}`);
    }

    return data || [];
  }

  async getKnowledgeBySource(sourcePath: string): Promise<KnowledgeChunk[]> {
    const { data, error } = await supabaseAdmin.rpc('get_knowledge_by_source', {
      source_path_param: sourcePath
    });

    if (error) {
      console.error('Get knowledge by source error:', error);
      throw new Error(`Ошибка получения знаний: ${error.message}`);
    }

    return data || [];
  }

  async insertChunk(chunk: Omit<KnowledgeChunk, 'id'>): Promise<void> {
    const { error } = await supabaseAdmin
      .from('knowledge_chunks')
      .insert({
        source_path: chunk.source_path,
        chunk_index: chunk.chunk_index,
        title: chunk.title,
        content: chunk.content,
        metadata: chunk.metadata
      });

    if (error) {
      throw new Error(`Ошибка вставки чанка: ${error.message}`);
    }
  }

  async clearSource(sourcePath: string): Promise<number> {
    const { data, error } = await supabaseAdmin.rpc('clear_knowledge_source', {
      source_path_param: sourcePath
    });

    if (error) {
      throw new Error(`Ошибка очистки источника: ${error.message}`);
    }

    return data || 0;
  }

  async logIngestion(sourcePath: string, fileHash: string, chunksCount: number): Promise<void> {
    const { error } = await supabaseAdmin
      .from('knowledge_ingestion_log')
      .insert({
        source_path: sourcePath,
        file_hash: fileHash,
        chunks_count: chunksCount
      });

    if (error) {
      console.error('Log ingestion error:', error);
    }
  }

  async getIngestionLog(sourcePath: string): Promise<{ file_hash: string } | null> {
    const { data, error } = await supabaseAdmin
      .from('knowledge_ingestion_log')
      .select('file_hash')
      .eq('source_path', sourcePath)
      .order('ingested_at', { ascending: false })
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Get ingestion log error:', error);
      return null;
    }

    return data;
  }
}
