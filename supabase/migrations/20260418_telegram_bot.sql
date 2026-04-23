-- Telegram Bot Database Schema
-- Migration: 20260418_telegram_bot
-- Purpose: Telegram users, audit logging, voice/file processing

-- =====================================================
-- ENUM: Message types
-- =====================================================
DO $$ BEGIN
  CREATE TYPE telegram_message_type AS ENUM (
    'voice',
    'text',
    'file',
    'command',
    'callback'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- =====================================================
-- ENUM: Action types for audit
-- =====================================================
DO $$ BEGIN
  CREATE TYPE telegram_action_type AS ENUM (
    'ai_query',
    'task_create',
    'task_complete',
    'task_update',
    'order_launch',
    'batch_start',
    'batch_update',
    'payroll_view',
    'kb_search',
    'file_upload',
    'file_process',
    'voice_process',
    'auth_success',
    'auth_fail',
    'command_execute',
    'navigation'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- =====================================================
-- TABLE: Telegram Users
-- Maps Telegram users to CRM users
-- =====================================================
CREATE TABLE IF NOT EXISTS telegram_users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  telegram_id BIGINT NOT NULL UNIQUE,
  crm_user_id INTEGER REFERENCES auth.users(id),
  username VARCHAR(255),
  first_name VARCHAR(255),
  last_name VARCHAR(255),
  language_code VARCHAR(10) DEFAULT 'uk',
  is_active BOOLEAN DEFAULT true,
  last_seen_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_telegram_users_telegram_id ON telegram_users(telegram_id);
CREATE INDEX IF NOT EXISTS idx_telegram_users_crm_user_id ON telegram_users(crm_user_id);

-- =====================================================
-- TABLE: Telegram Messages (Full Audit Log)
-- Every message is logged with full content
-- =====================================================
CREATE TABLE IF NOT EXISTS telegram_messages (
  id BIGSERIAL PRIMARY KEY,
  telegram_user_id BIGINT REFERENCES telegram_users(telegram_id),
  telegram_message_id BIGINT,
  chat_id BIGINT NOT NULL,
  message_type telegram_message_type NOT NULL,

  -- Full text content (including punctuation, commas, etc.)
  content_text TEXT,
  content_raw JSONB,

  -- AI related
  ai_response TEXT,
  ai_model VARCHAR(100),
  ai_processing_time_ms INTEGER,

  -- Parsing
  parsed_command VARCHAR(255),
  command_args JSONB,

  -- Processing
  processing_time_ms INTEGER,
  error TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_telegram_messages_user ON telegram_messages(telegram_user_id);
CREATE INDEX IF NOT EXISTS idx_telegram_messages_chat ON telegram_messages(chat_id);
CREATE INDEX IF NOT EXISTS idx_telegram_messages_type ON telegram_messages(message_type);
CREATE INDEX IF NOT EXISTS idx_telegram_messages_created ON telegram_messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_telegram_messages_text ON telegram_messages USING gin(to_tsvector('ukrainian', coalesce(content_text, '')));

-- =====================================================
-- TABLE: Telegram Files
-- File processing audit
-- =====================================================
CREATE TABLE IF NOT EXISTS telegram_files (
  id BIGSERIAL PRIMARY KEY,
  telegram_user_id BIGINT REFERENCES telegram_users(telegram_id),
  file_id VARCHAR(255) NOT NULL,
  file_unique_id VARCHAR(255),
  file_type VARCHAR(50) NOT NULL,
  file_name VARCHAR(255),
  file_size INTEGER,
  mime_type VARCHAR(100),

  -- Processing results
  processing_result JSONB,
  extracted_text TEXT,
  analyzed_data JSONB,
  error TEXT,

  -- AI analysis
  ai_analysis TEXT,
  ai_processing_time_ms INTEGER,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_telegram_files_user ON telegram_files(telegram_user_id);
CREATE INDEX IF NOT EXISTS idx_telegram_files_type ON telegram_files(file_type);
CREATE INDEX IF NOT EXISTS idx_telegram_files_created ON telegram_files(created_at DESC);

-- =====================================================
-- TABLE: Telegram Voice Messages
-- Voice processing audit
-- =====================================================
CREATE TABLE IF NOT EXISTS telegram_voice (
  id BIGSERIAL PRIMARY KEY,
  telegram_user_id BIGINT REFERENCES telegram_users(telegram_id),

  file_id VARCHAR(255) NOT NULL,
  duration_seconds NUMERIC(10, 2),
  mime_type VARCHAR(100),

  -- Whisper transcription (full transcript including punctuation)
  transcript TEXT,
  transcript_raw TEXT,
  transcript_language VARCHAR(10),
  whisper_model VARCHAR(100),
  whisper_confidence NUMERIC(5, 4),

  -- AI processing
  ai_response TEXT,
  ai_processing_time_ms INTEGER,

  -- Errors
  error TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_telegram_voice_user ON telegram_voice(telegram_user_id);
CREATE INDEX IF NOT EXISTS idx_telegram_voice_created ON telegram_voice(created_at DESC);

-- =====================================================
-- TABLE: Telegram Actions
-- Action audit (task creation, order launch, etc.)
-- =====================================================
CREATE TABLE IF NOT EXISTS telegram_actions (
  id BIGSERIAL PRIMARY KEY,
  telegram_user_id BIGINT REFERENCES telegram_users(telegram_id),
  action_type telegram_action_type NOT NULL,

  -- Action details
  action_details JSONB NOT NULL,
  -- Example: {"task_id": 123, "task_title": "...", "batch_id": null, "order_id": null}

  -- Result
  result JSONB,
  success BOOLEAN DEFAULT true,
  error TEXT,

  -- Execution time
  execution_time_ms INTEGER,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_telegram_actions_user ON telegram_actions(telegram_user_id);
CREATE INDEX IF NOT EXISTS idx_telegram_actions_type ON telegram_actions(action_type);
CREATE INDEX IF NOT EXISTS idx_telegram_actions_created ON telegram_actions(created_at DESC);

-- =====================================================
-- TABLE: Telegram Sessions
-- Bot sessions for audit
-- =====================================================
CREATE TABLE IF NOT EXISTS telegram_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  telegram_user_id BIGINT REFERENCES telegram_users(telegram_id),
  session_id VARCHAR(255) NOT NULL,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  message_count INTEGER DEFAULT 0,
  actions_count INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_telegram_sessions_user ON telegram_sessions(telegram_user_id);
CREATE INDEX IF NOT EXISTS idx_telegram_sessions_started ON telegram_sessions(started_at DESC);

-- =====================================================
-- Helper function: log telegram message
-- =====================================================
CREATE OR REPLACE FUNCTION log_telegram_message(
  p_telegram_user_id BIGINT,
  p_telegram_message_id BIGINT,
  p_chat_id BIGINT,
  p_message_type telegram_message_type,
  p_content_text TEXT DEFAULT NULL,
  p_content_raw JSONB DEFAULT NULL,
  p_ai_response TEXT DEFAULT NULL,
  p_ai_model VARCHAR(100) DEFAULT NULL,
  p_ai_processing_time_ms INTEGER DEFAULT NULL,
  p_parsed_command VARCHAR(255) DEFAULT NULL,
  p_command_args JSONB DEFAULT NULL,
  p_processing_time_ms INTEGER DEFAULT NULL,
  p_error TEXT DEFAULT NULL
) RETURNS BIGINT AS $$
DECLARE
  v_id BIGINT;
BEGIN
  INSERT INTO telegram_messages (
    telegram_user_id, telegram_message_id, chat_id, message_type,
    content_text, content_raw, ai_response, ai_model, ai_processing_time_ms,
    parsed_command, command_args, processing_time_ms, error
  ) VALUES (
    p_telegram_user_id, p_telegram_message_id, p_chat_id, p_message_type,
    p_content_text, p_content_raw, p_ai_response, p_ai_model, p_ai_processing_time_ms,
    p_parsed_command, p_command_args, p_processing_time_ms, p_error
  ) RETURNING id INTO v_id;

  RETURN v_id;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- Helper function: log telegram action
-- =====================================================
CREATE OR REPLACE FUNCTION log_telegram_action(
  p_telegram_user_id BIGINT,
  p_action_type telegram_action_type,
  p_action_details JSONB,
  p_result JSONB DEFAULT NULL,
  p_success BOOLEAN DEFAULT true,
  p_error TEXT DEFAULT NULL,
  p_execution_time_ms INTEGER DEFAULT NULL
) RETURNS BIGINT AS $$
DECLARE
  v_id BIGINT;
BEGIN
  INSERT INTO telegram_actions (
    telegram_user_id, action_type, action_details, result, success, error, execution_time_ms
  ) VALUES (
    p_telegram_user_id, p_action_type, p_action_details, p_result, p_success, p_error, p_execution_time_ms
  ) RETURNING id INTO v_id;

  RETURN v_id;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- Helper function: log voice processing
-- =====================================================
CREATE OR REPLACE FUNCTION log_telegram_voice(
  p_telegram_user_id BIGINT,
  p_file_id VARCHAR(255),
  p_duration_seconds NUMERIC(10, 2) DEFAULT NULL,
  p_transcript TEXT DEFAULT NULL,
  p_transcript_raw TEXT DEFAULT NULL,
  p_whisper_model VARCHAR(100) DEFAULT NULL,
  p_ai_response TEXT DEFAULT NULL,
  p_ai_processing_time_ms INTEGER DEFAULT NULL,
  p_error TEXT DEFAULT NULL
) RETURNS BIGINT AS $$
DECLARE
  v_id BIGINT;
BEGIN
  INSERT INTO telegram_voice (
    telegram_user_id, file_id, duration_seconds, transcript, transcript_raw,
    whisper_model, ai_response, ai_processing_time_ms, error
  ) VALUES (
    p_telegram_user_id, p_file_id, p_duration_seconds, p_transcript, p_transcript_raw,
    p_whisper_model, p_ai_response, p_ai_processing_time_ms, p_error
  ) RETURNING id INTO v_id;

  RETURN v_id;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- Helper function: log file processing
-- =====================================================
CREATE OR REPLACE FUNCTION log_telegram_file(
  p_telegram_user_id BIGINT,
  p_file_id VARCHAR(255),
  p_file_type VARCHAR(50),
  p_file_name VARCHAR(255) DEFAULT NULL,
  p_file_size INTEGER DEFAULT NULL,
  p_processing_result JSONB DEFAULT NULL,
  p_extracted_text TEXT DEFAULT NULL,
  p_ai_analysis TEXT DEFAULT NULL,
  p_ai_processing_time_ms INTEGER DEFAULT NULL,
  p_error TEXT DEFAULT NULL
) RETURNS BIGINT AS $$
DECLARE
  v_id BIGINT;
BEGIN
  INSERT INTO telegram_files (
    telegram_user_id, file_id, file_type, file_name, file_size,
    processing_result, extracted_text, ai_analysis, ai_processing_time_ms, error
  ) VALUES (
    p_telegram_user_id, p_file_id, p_file_type, p_file_name, p_file_size,
    p_processing_result, p_extracted_text, p_ai_analysis, p_ai_processing_time_ms, p_error
  ) RETURNING id INTO v_id;

  RETURN v_id;
END;
$$ LANGUAGE plpgsql;