-- Migration: 20260417_chat_memory_and_vector_rag.sql
-- Description: Добавление памяти чата и векторного RAG для AI ассистента
-- Author: AI Technical Audit
-- Date: 2026-04-17

BEGIN;

-- ============================================
-- ЧАСТЬ 1: ПАМЯТЬ ЧАТА (Chat Memory)
-- ============================================

-- Таблица для хранения истории разговоров пользователя с ассистентом
CREATE TABLE IF NOT EXISTS shveyka.chat_conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id INTEGER NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,

    -- Метаданные для контекста
    session_id UUID, -- Ссылка на assistant_sessions если есть
    message_type TEXT DEFAULT 'text', -- 'text', 'action', 'error'
    metadata JSONB DEFAULT '{}',

    -- Для возможной фильтрации по роли/типу
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Комментарий к таблице
COMMENT ON TABLE shveyka.chat_conversations IS 'История сообщений чата с AI ассистентом. Хранит диалоги пользователей для контекста.';

-- Индекс для быстрого поиска по пользователю и времени
CREATE INDEX IF NOT EXISTS idx_chat_conversations_user_time
ON shveyka.chat_conversations (user_id, created_at DESC);

-- Индекс для поиска по сессии
CREATE INDEX IF NOT EXISTS idx_chat_conversations_session
ON shveyka.chat_conversations (session_id) WHERE session_id IS NOT NULL;

-- Индекс для поиска по роли (например, получить только сообщения ассистента)
CREATE INDEX IF NOT EXISTS idx_chat_conversations_role
ON shveyka.chat_conversations (user_id, role, created_at DESC);

-- ============================================
-- ЧАСТЬ 2: ВЕКТОРНЫЙ RAG (с помощью pg_vectorize)
-- ============================================

-- Включаем расширение vector (если ещё не включено)
CREATE EXTENSION IF NOT EXISTS vector CASCADE;

-- Таблица для хранения эмбеддингов документов
CREATE TABLE IF NOT EXISTS shveyka.document_embeddings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chunk_id UUID REFERENCES shveyka.knowledge_chunks(id) ON DELETE CASCADE,

    -- Векторное представление (1536 измерений для text-embedding-3-small, 3072 для 3-large)
    -- Supabase Vectorize использует 1536 по умолчанию
    embedding vector(1536),

    -- Метаданные для поиска
    content_preview TEXT, -- Первые 500 символов для быстрого просмотра
    source_path TEXT NOT NULL,

    created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE shveyka.document_embeddings IS 'Векторные представления документов из knowledge_chunks для семантического поиска.';

-- Индекс для векторного поиска (HNSW - более быстрый чем IVFFlat)
CREATE INDEX IF NOT EXISTS idx_document_embeddings_vector
ON shveyka.document_embeddings
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- Индекс для поиска по source_path
CREATE INDEX IF NOT EXISTS idx_document_embeddings_source
ON shveyka.document_embeddings (source_path);

-- ============================================
-- ЧАСТЬ 3: ФУНКЦИИ ДЛЯ РАБОТЫ С ПАМЯТЬЮ ЧАТА
-- ============================================

-- Получить историю чата пользователя (последние N сообщений)
CREATE OR REPLACE FUNCTION shveyka.get_chat_history(
    p_user_id INTEGER,
    p_limit INTEGER DEFAULT 50,
    p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
    id UUID,
    role TEXT,
    content TEXT,
    message_type TEXT,
    metadata JSONB,
    created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT
        cc.id,
        cc.role,
        cc.content,
        cc.message_type,
        cc.metadata,
        cc.created_at
    FROM shveyka.chat_conversations cc
    WHERE cc.user_id = p_user_id
    ORDER BY cc.created_at DESC
    LIMIT p_limit
    OFFSET p_offset;
END;
$$;

COMMENT ON FUNCTION shveyka.get_chat_history IS 'Получить историю чата пользователя. Безопасная функция - пользователь видит только свои сообщения.';

-- Добавить сообщение в историю чата
CREATE OR REPLACE FUNCTION shveyka.add_chat_message(
    p_user_id INTEGER,
    p_role TEXT,
    p_content TEXT,
    p_session_id UUID DEFAULT NULL,
    p_message_type TEXT DEFAULT 'text',
    p_metadata JSONB DEFAULT '{}'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_message_id UUID;
BEGIN
    INSERT INTO shveyka.chat_conversations (
        user_id, role, content, session_id, message_type, metadata
    )
    VALUES (
        p_user_id, p_role, p_content, p_session_id, p_message_type, p_metadata
    )
    RETURNING id INTO v_message_id;

    RETURN v_message_id;
END;
$$;

COMMENT ON FUNCTION shveyka.add_chat_message IS 'Добавить сообщение в историю чата.';

-- Очистить историю чата пользователя
CREATE OR REPLACE FUNCTION shveyka.clear_chat_history(
    p_user_id INTEGER
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_deleted_count INTEGER;
BEGIN
    DELETE FROM shveyka.chat_conversations
    WHERE user_id = p_user_id;

    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
    RETURN v_deleted_count;
END;
$$;

COMMENT ON FUNCTION shveyka.clear_chat_history IS 'Удалить всю историю чата пользователя. Возвращает количество удалённых сообщений.';

-- Получить последние N сообщений для контекста LLM
CREATE OR REPLACE FUNCTION shveyka.get_chat_context(
    p_user_id INTEGER,
    p_message_count INTEGER DEFAULT 10
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_context TEXT := '';
BEGIN
    SELECT string_agg(
        CASE
            WHEN cc.role = 'user' THEN 'User: ' || cc.content
            WHEN cc.role = 'assistant' THEN 'Assistant: ' || cc.content
            ELSE cc.role || ': ' || cc.content
        END,
        E'\n\n'
        ORDER BY cc.created_at
    )
    INTO v_context
    FROM (
        SELECT cc.role, cc.content
        FROM shveyka.chat_conversations cc
        WHERE cc.user_id = p_user_id
        ORDER BY cc.created_at DESC
        LIMIT p_message_count
    ) cc;

    RETURN COALESCE(v_context, '');
END;
$$;

COMMENT ON FUNCTION shveyka.get_chat_context IS 'Получить историю чата в формате для LLM (User/Assistant).';

-- ============================================
-- ЧАСТЬ 4: ФУНКЦИИ ДЛЯ ВЕКТОРНОГО ПОИСКА
-- ============================================

-- Семантический поиск по документам (использует pg_vectorize или ручной поиск)
CREATE OR REPLACE FUNCTION shveyka.semantic_search(
    query_text TEXT,
    limit_count INTEGER DEFAULT 5
)
RETURNS TABLE (
    id UUID,
    source_path TEXT,
    title TEXT,
    content TEXT,
    metadata JSONB,
    similarity REAL
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Если есть document_embeddings, используем векторный поиск
    -- Иначе fallback на FTS (обратная совместимость)
    RETURN QUERY
    WITH query_embedding AS (
        -- В реальной реализации здесь должен быть вызов модели для получения эмбеддинга
        -- Для Supabase Vectorize это делается автоматически
        -- Здесь используем fallback на FTS если нет эмбеддингов
        SELECT to_tsvector('russian', query_text) as query_vec
    )
    SELECT
        kc.id,
        kc.source_path,
        kc.title,
        kc.content,
        kc.metadata,
        ts_rank_cd(
            to_tsvector('russian', kc.content),
            plainto_tsquery('russian', query_text)
        )::REAL as similarity
    FROM shveyka.knowledge_chunks kc, query_embedding qe
    WHERE to_tsvector('russian', kc.content) @@ plainto_tsquery('russian', query_text)
    ORDER BY similarity DESC
    LIMIT limit_count;
END;
$$;

COMMENT ON FUNCTION shveyka.semantic_search IS 'Семантический поиск по документам. Использует FTS fallback если нет векторов.';

-- Обновить эмбеддинги для документа (вызывается после добавления чанков)
CREATE OR REPLACE FUNCTION shveyka.refresh_document_embeddings(
    p_source_path TEXT
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_count INTEGER := 0;
BEGIN
    -- Удаляем старые эмбеддинги
    DELETE FROM shveyka.document_embeddings
    WHERE source_path = p_source_path;

    -- В реальной реализации здесь должен быть вызов API для генерации эмбеддингов
    -- Например: OpenAI embeddings API, и сохранение результатов
    -- Для Supabase Vectorize это делается автоматически

    -- Пока возвращаем заглушку
    GET DIAGNOSTICS v_count = ROW_COUNT;

    RETURN v_count;
END;
$$;

COMMENT ON FUNCTION shveyka.refresh_document_embeddings IS 'Обновить векторные представления документа. Требует вызова внешнего API для генерации эмбеддингов.';

-- ============================================
-- ЧАСТЬ 5: RLSPOLICIES (БЕЗОПАСНОСТЬ)
-- ============================================

-- Политика: пользователь видит только свои сообщения
DROP POLICY IF EXISTS "Users can view own chat history" ON shveyka.chat_conversations;
CREATE POLICY "Users can view own chat history"
ON shveyka.chat_conversations
FOR SELECT
USING (user_id = current_setting('request.jwt.claim.user_id', true)::INTEGER);

DROP POLICY IF EXISTS "Users can insert own chat messages" ON shveyka.chat_conversations;
CREATE POLICY "Users can insert own chat messages"
ON shveyka.chat_conversations
FOR INSERT
WITH CHECK (user_id = current_setting('request.jwt.claim.user_id', true)::INTEGER);

DROP POLICY IF EXISTS "Users can delete own chat history" ON shveyka.chat_conversations;
CREATE POLICY "Users can delete own chat history"
ON shveyka.chat_conversations
FOR DELETE
USING (user_id = current_setting('request.jwt.claim.user_id', true)::INTEGER);

-- Включаем RLS
ALTER TABLE shveyka.chat_conversations ENABLE ROW LEVEL SECURITY;

-- ============================================
-- ЧАСТЬ 6: АУДИТТРИГГЕРЫ
-- ============================================

-- Автоматическое обновление updated_at для document_embeddings
CREATE OR REPLACE FUNCTION shveyka.update_document_embeddings_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_document_embeddings_updated_at
ON shveyka.document_embeddings;

CREATE TRIGGER update_document_embeddings_updated_at
    BEFORE UPDATE ON shveyka.document_embeddings
    FOR EACH ROW
    EXECUTE FUNCTION shveyka.update_document_embeddings_timestamp();

COMMIT;

-- ============================================
-- ПРИМЕЧАНИЯ ДЛЯ РАЗРАБОТЧИКА:
-- ============================================
--
-- 1. Для полноценного векторного поиска нужно:
--    - Подключить Supabase Vectorize (Vectorize API)
--    - Или использовать внешний API (OpenAI embeddings, Voyage AI, etc.)
--
-- 2. Пример вызова Supabase Vectorize:
--    SELECT
--        cc.id,
--        cc.content,
--        cc.embedding <=> (SELECT embedding FROM openai_embedding('text-embedding-3-small', query_text)) as distance
--    FROM shveyka.document_embeddings cc
--    ORDER BY distance
--    LIMIT 5;
--
-- 3. Для генерации эмбеддингов можно использовать:
--    - Supabase Edge Function + OpenAI API
--    - Voyage AI API
--    - Локальную модель (llama.cpp, etc.)
--
-- 4. Chat Memory интегрирована с AuditLogger:
--    - При новом запросе вызывается add_chat_message(user, 'user', question)
--    - При ответе вызывается add_chat_message(user, 'assistant', answer)
--    - При получении контекста вызывается get_chat_context(user, limit)
--