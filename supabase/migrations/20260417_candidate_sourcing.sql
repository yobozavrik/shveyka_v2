-- Migration: Enhanced candidates table with sourcing fields
-- Purpose: Store candidates sourced from job boards (Work.ua, Djinni, etc.)
-- Supports: Resume parsing, AI scoring, pipeline tracking

-- =====================================================
-- ENUM: Candidate status in pipeline
-- =====================================================
DO $$ BEGIN
  CREATE TYPE candidate_pipeline_status AS ENUM (
    'new',           -- Freshly sourced, not reviewed
    'reviewed',      -- HR reviewed, needs follow-up
    'contacted',     -- HR reached out
    'interview',     -- Interview scheduled
    'offer',         -- Offer sent
    'hired',         -- Hired
    'rejected'       -- Not a fit
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- =====================================================
-- ENUM: Source of candidate
-- =====================================================
DO $$ BEGIN
  CREATE TYPE candidate_source AS ENUM (
    'workua',        -- Work.ua resume search
    'djinni',        -- Djinni.co
    'linkedin',      -- LinkedIn
    'rabota_ua',     -- Rabota.ua
    'manual',        -- Manually added
    'referral'       -- Employee referral
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- =====================================================
-- ENUM: Work type preference
-- =====================================================
DO $$ BEGIN
  CREATE TYPE work_type AS ENUM (
    'full_time',
    'part_time',
    'contract',
    'freelance',
    'internship'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- =====================================================
-- ENUM: Sewing-specific specializations
-- =====================================================
DO $$ BEGIN
  CREATE TYPE sewing_specialization AS ENUM (
    'seamstress',        -- Шваля
    'cutter',            -- Закрійник
    'master',            -- Майстер/начальник цеху
    'technologist',      -- Технолог
    'qc',                -- Контроль якості
    'overlock',          -- Оверлок
    'straight_stitch',   -- Прямострочка
    'packaging',         -- Пакування
    'cutting_master',    -- Закрійник-розкрійник
    'designer'           -- Конструктор одягу
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- =====================================================
-- TABLE: candidates (enhanced)
-- =====================================================
CREATE TABLE IF NOT EXISTS candidates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  
  -- Basic info
  full_name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  
  -- CV/Resume data
  resume_text TEXT,                      -- Full resume text for AI analysis
  resume_url TEXT,                       -- Original resume link
  resume_raw_html TEXT,                  -- Raw HTML for re-parsing if needed
  
  -- Parsed resume fields
  birth_date DATE,
  city TEXT,
  position_desired TEXT,                 -- Desired position from resume
  salary_expected INTEGER,               -- Expected salary in UAH
  experience_years INTEGER,
  
  -- Sewing-specific fields
  specialization sewing_specialization,  -- Primary sewing specialization
  specializations sewing_specialization[], -- All mentioned specializations
  machine_experience TEXT[],             -- e.g., ['overlock', 'straight_stitch', 'coverlock']
  production_type_experience TEXT[],     -- e.g., ['outerwear', 'jeans', 'lingerie']
  skill_level INTEGER CHECK (skill_level BETWEEN 1 AND 5),
  
  -- Work preferences
  work_type_preference work_type,
  remote_preference BOOLEAN DEFAULT false,
  schedule_preferred TEXT,               -- e.g., 'full_day', 'flexible'
  
  -- Experience entries (JSONB for flexible storage)
  work_experience JSONB DEFAULT '[]'::jsonb,
  -- Structure: [{"company": "...", "position": "...", "date_from": "...", "date_to": "...", "description": "...", "current": true}]
  
  education JSONB DEFAULT '[]'::jsonb,
  -- Structure: [{"institution": "...", "degree": "...", "faculty": "...", "year": 2020}]
  
  languages JSONB DEFAULT '[]'::jsonb,
  -- Structure: [{"language": "Українська", "level": "native"}, {"language": "Англійська", "level": "B1"}]
  
  skills TEXT[],
  training JSONB DEFAULT '[]'::jsonb,
  -- Structure: [{"course": "...", "institution": "...", "year": 2024, "duration": "3 months"}]
  
  -- Source tracking
  source candidate_source NOT NULL,
  source_job_id TEXT,                    -- ID from source site
  source_url TEXT,                       -- Direct URL to resume
  sourced_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- AI Analysis results
  ai_score INTEGER CHECK (ai_score BETWEEN 1 AND 10),
  ai_analysis JSONB,                     -- Full AI analysis result
  ai_strengths TEXT[],                   -- Extracted strengths
  ai_concerns TEXT[],                    -- Potential concerns
  ai_recommended_position TEXT,          -- AI-recommended position match
  ai_analyzed_at TIMESTAMPTZ,
  
  -- Pipeline status
  status candidate_pipeline_status DEFAULT 'new',
  
  -- HR review
  assigned_hr_id INTEGER REFERENCES auth.users(id),
  hr_notes TEXT,
  interview_date TIMESTAMPTZ,
  interview_notes TEXT,
  
  -- Vacancy linkage
  vacancy_id UUID REFERENCES vacancies(id),
  
  -- Contact history
  contact_history JSONB DEFAULT '[]'::jsonb,
  -- Structure: [{"date": "2026-04-15", "type": "call", "notes": "...", "by": "HR Name"}]
  
  -- Audit
  created_by INTEGER REFERENCES auth.users(id),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- INDEXES
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_candidates_status ON candidates(status);
CREATE INDEX IF NOT EXISTS idx_candidates_source ON candidates(source);
CREATE INDEX IF NOT EXISTS idx_candidates_specialization ON candidates(specialization);
CREATE INDEX IF NOT EXISTS idx_candidates_ai_score ON candidates(ai_score);
CREATE INDEX IF NOT EXISTS idx_candidates_city ON candidates(city);
CREATE INDEX IF NOT EXISTS idx_candidates_salary_expected ON candidates(salary_expected);
CREATE INDEX IF NOT EXISTS idx_candidates_created_at ON candidates(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_candidates_vacancy_id ON candidates(vacancy_id);
CREATE INDEX IF NOT EXISTS idx_candidates_phone ON candidates(phone);
CREATE INDEX IF NOT EXISTS idx_candidates_email ON candidates(email);

-- Full-text search index for resume content
CREATE INDEX IF NOT EXISTS idx_candidates_resume_fts ON candidates USING gin(to_tsvector('ukrainian', coalesce(resume_text, '')));

-- =====================================================
-- UPDATED_AT trigger
-- =====================================================
CREATE OR REPLACE FUNCTION update_candidates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_candidates_updated_at ON candidates;
CREATE TRIGGER trg_candidates_updated_at
  BEFORE UPDATE ON candidates
  FOR EACH ROW EXECUTE FUNCTION update_candidates_updated_at();

-- =====================================================
-- RLS Policies
-- =====================================================
ALTER TABLE candidates ENABLE ROW LEVEL SECURITY;

-- HR, managers, and admins can see all candidates
CREATE POLICY candidates_read_all ON candidates
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM auth.users 
      WHERE id = auth.uid() 
      AND (role IN ('admin', 'manager', 'hr') OR raw_user_meta_data->>'role' IN ('admin', 'manager', 'hr'))
    )
  );

-- Only admins and managers can insert
CREATE POLICY candidates_insert ON candidates
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM auth.users 
      WHERE id = auth.uid() 
      AND (role IN ('admin', 'manager', 'hr') OR raw_user_meta_data->>'role' IN ('admin', 'manager', 'hr'))
    )
  );

-- Only admins and managers can update
CREATE POLICY candidates_update ON candidates
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM auth.users 
      WHERE id = auth.uid() 
      AND (role IN ('admin', 'manager', 'hr') OR raw_user_meta_data->>'role' IN ('admin', 'manager', 'hr'))
    )
  );

-- Only admins can delete
CREATE POLICY candidates_delete ON candidates
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM auth.users 
      WHERE id = auth.uid() 
      AND (role = 'admin' OR raw_user_meta_data->>'role' = 'admin')
    )
  );

-- =====================================================
-- Migration tracking
-- =====================================================
INSERT INTO schema_migrations (name, applied_at)
VALUES ('20260417_candidate_sourcing', NOW())
ON CONFLICT (name) DO NOTHING;