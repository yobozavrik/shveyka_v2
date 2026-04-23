# Candidate Sourcing System (CandidateScout)

## Overview

AI-powered candidate sourcing and analysis system for Shveyka CRM. Automatically searches job boards for resumes, analyzes candidates with Groq AI, and imports them into the recruitment pipeline.

## Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Work.ua       │     │   Djinni.co     │     │   LinkedIn      │
│   Resume Search │     │   Job Search    │     │   Profile       │
└────────┬────────┘     └────────┬────────┘     └────────┬────────┘
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 ▼
                    ┌────────────────────────┐
                    │  Python Scrapers       │
                    │  - workua_scraper.py   │
                    │  - djinni_scraper.py   │
                    └───────────┬────────────┘
                                │
                                ▼
                    ┌────────────────────────┐
                    │  Groq AI Analysis      │
                    │  analyze_candidates.py │
                    │  (Llama 3.3 70B)       │
                    └───────────┬────────────┘
                                │
                                ▼
                    ┌────────────────────────┐
                    │  Shveyka CRM           │
                    │  - Candidates Table    │
                    │  - Pipeline UI         │
                    │  - AI Scores           │
                    └────────────────────────┘
```

## Components

### Database (`supabase/migrations/20260417_candidate_sourcing.sql`)

- **Enhanced `candidates` table** with fields for:
  - Sewing-specific specializations (seamstress, cutter, master, etc.)
  - Machine experience tracking (overlock, straight_stitch, coverlock)
  - AI analysis results (score, strengths, concerns, recommendations)
  - Pipeline status tracking (new → reviewed → contacted → interview → offer → hired/rejected)
  - Source tracking (workua, djinni, linkedin, etc.)
  - Contact history
  - Full-text search on resume content

### Python Scrapers (`scrapers/`)

| File | Description |
|------|-------------|
| `workua_scraper.py` | Scrapes resume listings from Work.ua |
| `djinni_scraper.py` | Scrapes job listings from Djinni.co |
| `analyze_candidates.py` | Analyzes candidates using Groq AI |
| `config_workua.py.example` | Configuration template for Work.ua scraper |
| `config_djinni.py.example` | Configuration template for Djinni scraper |
| `config_analyze.py.example` | Configuration template for AI analyzer |

### CRM Integration (`crm/src/lib/recruitment/`)

| File | Description |
|------|-------------|
| `CandidateScout.ts` | Main service for sourcing, analysis, and import |
| `index.ts` | Module exports |

### API Routes

| Route | Method | Description |
|-------|--------|-------------|
| `/api/recruitment/sourcing` | GET | Get sourcing stats |
| `/api/recruitment/sourcing` | POST | Run sourcing cycle (search → analyze → import) |
| `/api/candidates` | GET | List candidates with filters |
| `/api/candidates` | POST | Create candidate manually |

## Usage

### 1. Configure Groq API Key

Set the `GROQ_API_KEY` environment variable or edit `scrapers/config_analyze.py`:

```bash
export GROQ_API_KEY=gsk_xxxxx
```

### 2. Run Scrapers Manually

```bash
cd ../scrapers

# Search Work.ua for resumes
python workua_scraper.py шваля Київ --pages 3

# Search Djinni
python djinni_scraper.py seamstress --pages 2

# Analyze scraped candidates
python analyze_candidates.py workua_resumes.json
```

### 3. Use CRM UI

1. Navigate to **Кандидати** in the sidebar
2. Click **AI Пошук** button
3. Enter keywords (comma-separated): `шваля, закрійник, майстер швейного`
4. Select sources: Work.ua, Djinni
5. Click **Запустити пошук**

The system will:
1. Search job boards for matching resumes
2. Analyze each candidate with Groq AI (score 1-10)
3. Import candidates with score ≥ 4 into the database
4. Display results in the Kanban pipeline view

### 4. API Usage

```javascript
// Full sourcing cycle
const response = await fetch('/api/recruitment/sourcing', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    action: 'full_cycle',
    keywords: ['шваля', 'закрійник'],
    sources: ['workua', 'djinni'],
    pages: 2,
    vacancyId: 'uuid-of-vacancy'
  })
});

// Get stats
const stats = await fetch('/api/recruitment/sourcing?action=stats');
```

## Pipeline Statuses

| Status | Description |
|--------|-------------|
| `new` | Freshly sourced, not reviewed |
| `reviewed` | HR reviewed, needs follow-up |
| `contacted` | HR reached out |
| `interview` | Interview scheduled |
| `offer` | Offer sent |
| `hired` | Candidate hired |
| `rejected` | Not a fit |

## Specializations

| Key | Label |
|-----|-------|
| `seamstress` | Шваля |
| `cutter` | Закрійник |
| `master` | Майстер |
| `technologist` | Технолог |
| `qc` | Контроль якості |
| `overlock` | Оверлок |
| `straight_stitch` | Прямострочка |
| `packaging` | Пакування |
| `cutting_master` | Закрійник-розкрійник |
| `designer` | Конструктор одягу |

## Notes

- Rabota.ua API is for **job seekers**, not employers. Use Work.ua and Djinni for candidate sourcing.
- AI scoring threshold is configurable (default: score ≥ 4 to import)
- All data stored locally in `scrapers/` directory before import
- Rate limiting built-in to respect job board limits