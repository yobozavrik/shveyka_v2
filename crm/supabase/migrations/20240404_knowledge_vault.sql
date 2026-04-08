-- Knowledge Vault Tables
-- Stores markdown chunks for full-text search

-- Main knowledge chunks table
CREATE TABLE IF NOT EXISTS shveyka.knowledge_chunks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_path TEXT NOT NULL,
    chunk_index INTEGER NOT NULL,
    title TEXT,
    content TEXT NOT NULL,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT unique_chunk UNIQUE (source_path, chunk_index)
);

-- Full-text search index (Russian language)
CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_search 
ON shveyka.knowledge_chunks 
USING GIN (to_tsvector('russian', content));

-- Index for source path lookups
CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_source 
ON shveyka.knowledge_chunks (source_path);

-- Ingestion log for tracking updates
CREATE TABLE IF NOT EXISTS shveyka.knowledge_ingestion_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_path TEXT NOT NULL,
    file_hash TEXT NOT NULL,
    chunks_count INTEGER NOT NULL,
    ingested_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT unique_ingestion UNIQUE (source_path, file_hash)
);

-- Search function with ranking
CREATE OR REPLACE FUNCTION shveyka.search_knowledge(
    query_text TEXT,
    limit_count INTEGER DEFAULT 5
)
RETURNS TABLE (
    id UUID,
    source_path TEXT,
    title TEXT,
    content TEXT,
    metadata JSONB,
    rank REAL
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        kc.id,
        kc.source_path,
        kc.title,
        kc.content,
        kc.metadata,
        ts_rank_cd(
            to_tsvector('russian', kc.content),
            plainto_tsquery('russian', query_text)
        ) as rank
    FROM shveyka.knowledge_chunks kc
    WHERE to_tsvector('russian', kc.content) @@ plainto_tsquery('russian', query_text)
    ORDER BY rank DESC
    LIMIT limit_count;
END;
$$;

-- Get all chunks for a source file
CREATE OR REPLACE FUNCTION shveyka.get_knowledge_by_source(
    source_path_param TEXT
)
RETURNS TABLE (
    id UUID,
    chunk_index INTEGER,
    title TEXT,
    content TEXT,
    metadata JSONB
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        kc.id,
        kc.chunk_index,
        kc.title,
        kc.content,
        kc.metadata
    FROM shveyka.knowledge_chunks kc
    WHERE kc.source_path = source_path_param
    ORDER BY kc.chunk_index;
END;
$$;

-- Clear chunks for a source (before re-ingestion)
CREATE OR REPLACE FUNCTION shveyka.clear_knowledge_source(
    source_path_param TEXT
)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM shveyka.knowledge_chunks 
    WHERE knowledge_chunks.source_path = source_path_param;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$;

COMMENT ON TABLE shveyka.knowledge_chunks IS 'Markdown chunks for AI knowledge base';
COMMENT ON TABLE shveyka.knowledge_ingestion_log IS 'Track file ingestion history';
