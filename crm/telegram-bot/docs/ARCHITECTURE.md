# Telegram Bot — Повна Архітектура

## Overview

Telegram бот для керування виробництвом "Швейка" через мобільний телефон з голосовим управлінням.

**Користувачі:** до 3 осіб з повним логуванням всіх дій.

---

## System Architecture

```mermaid
graph TB
    subgraph Telegram["Telegram"]
        Voice["🎤 Voice Message"]
        Text["💬 Text Message"]
        File["📎 File Upload"]
        Keyboard["⌨️ Keyboard"]
    end

    subgraph Bot["Telegram Bot (Python)"]
        Dispatcher["📨 Dispatcher"]
        Auth["🔐 Auth Service"]
        Audit["📝 Audit Service"]

        subgraph Handlers["Handlers"]
            VoiceH["🎤 Voice Handler"]
            TextH["💬 Text Handler"]
            FileH["📎 File Handler"]
            CmdH["⚡ Command Handler"]
        end

        subgraph Services["Services"]
            AI["🤖 AI Client"]
            Whisper["🎤 Whisper STT"]
            FileProc["📄 File Processor"]
        end

        subgraph Keyboards["Keyboards"]
            ReplyKB["Reply Keyboard"]
            InlineKB["Inline Keyboard"]
        end
    end

    subgraph External["External Services"]
        CRM["🏭 CRM API<br/>/api/ai/assistant"]
        OpenAI["🤖 OpenAI API<br/>(Whisper)"]
        Supabase["🗄️ Supabase<br/>(Audit DB)"]
    end

    Voice --> Dispatcher
    Text --> Dispatcher
    File --> Dispatcher
    Keyboard --> Dispatcher

    Dispatcher --> Auth
    Auth --> TelegramUsers

    Dispatcher --> Audit
    Audit --> Supabase

    Dispatcher --> VoiceH
    Dispatcher --> TextH
    Dispatcher --> FileH
    Dispatcher --> CmdH

    VoiceH --> Whisper
    Whisper --> OpenAI

    VoiceH --> AI
    TextH --> AI
    FileH --> FileProc
    CmdH --> AI

    AI --> CRM
    FileProc --> AI

    TextH --> ReplyKB
    TextH --> InlineKB

    class Voice,Text,File,Keyboard external
    class CRM,OpenAI,Supabase external
```

---

## Message Flow

```mermaid
sequenceDiagram
    participant U as Користувач
    participant TG as Telegram
    participant Bot as Bot
    participant Auth as Auth Service
    participant Audit as Audit
    participant AI as AI Client
    participant CRM as CRM API
    participant DB as Supabase

    U->>TG: Надсилає повідомлення
    TG->>Bot: Update
    Bot->>Auth: get_or_create_user(telegram_id)
    Auth->>DB: SELECT telegram_users
    DB-->>Auth: TelegramUser
    Auth-->>Bot: TelegramUser

    alt Голосове
        Bot->>Bot: Download .ogg file
        Bot->>OpenAI: Whisper transcription
        OpenAI-->>Bot: transcript
        Bot->>Audit: log_voice(transcript)
        Audit->>DB: INSERT telegram_voice
    end

    alt Текст
        Bot->>Bot: Parse command
        Bot->>Audit: log_message(text)
        Audit->>DB: INSERT telegram_messages
    end

    Bot->>AI: send_message(question)
    AI->>CRM: POST /api/ai/assistant
    CRM-->>AI: {answer, citations}
    AI-->>Bot: formatted_answer

    Bot->>Audit: log_action(ai_query)
    Audit->>DB: INSERT telegram_actions

    Bot->>TG: Send response
    TG-->>U: Відповідь
```

---

## Voice Processing Flow

```mermaid
graph LR
    subgraph Input["Input"]
        OGG[".ogg Voice<br/>Telegram"]
    end

    subgraph Processing["Processing"]
        Download["📥 Download"]
        Whisper["🎤 Whisper API"]
        Parser["🔍 Parse"]
    end

    subgraph Output["Output"]
        Transcript["📝 Transcript"]
        AI["🤖 AI"]
        Response["💬 Response"]
    end

    OGG --> Download
    Download --> Whisper
    Whisper --> Transcript
    Transcript --> Parser
    Parser --> AI
    AI --> Response
```

---

## File Processing Flow

```mermaid
graph TB
    subgraph FileTypes["File Types"]
        XLSX["📊 Excel<br/>.xlsx, .xls"]
        PDF["📑 PDF"]
        CSV["📄 CSV"]
        IMG["🖼️ Image<br/>PNG, JPG"]
    end

    subgraph Processors["Processors"]
        ExcelProc["📊 Excel Parser<br/>pandas"]
        PDFProc["📑 PDF Parser<br/>pdfplumber"]
        CSVProc["📄 CSV Parser<br/>pandas"]
        OCR["🔤 OCR<br/>pytesseract"]
    end

    subgraph Result["Result"]
        Text["📝 Extracted Text"]
        Summary["📋 Summary"]
        AIAnalysis["🤖 AI Analysis"]
    end

    XLSX --> ExcelProc
    PDF --> PDFProc
    CSV --> CSVProc
    IMG --> OCR

    ExcelProc --> Text
    PDFProc --> Text
    CSVProc --> Text
    OCR --> Text

    Text --> Summary
    Summary --> AIAnalysis
```

---

## Database Schema

```mermaid
erDiagram
    telegram_users {
        bigint telegram_id PK
        int crm_user_id FK
        varchar username
        varchar first_name
        boolean is_active
        timestamptz last_seen_at
    }

    telegram_messages {
        bigint id PK
        bigint telegram_user_id FK
        bigint chat_id
        enum message_type
        text content_text
        jsonb content_raw
        text ai_response
        varchar ai_model
        int ai_processing_time_ms
        varchar parsed_command
        jsonb command_args
        timestamptz created_at
    }

    telegram_voice {
        bigint id PK
        bigint telegram_user_id FK
        varchar file_id
        numeric duration_seconds
        text transcript
        text transcript_raw
        varchar whisper_model
        text ai_response
        int ai_processing_time_ms
        text error
        timestamptz created_at
    }

    telegram_files {
        bigint id PK
        bigint telegram_user_id FK
        varchar file_id
        varchar file_type
        varchar file_name
        int file_size
        jsonb processing_result
        text extracted_text
        text ai_analysis
        timestamptz created_at
    }

    telegram_actions {
        bigint id PK
        bigint telegram_user_id FK
        enum action_type
        jsonb action_details
        jsonb result
        boolean success
        text error
        int execution_time_ms
        timestamptz created_at
    }

    telegram_users ||--o{ telegram_messages : has
    telegram_users ||--o{ telegram_voice : has
    telegram_users ||--o{ telegram_files : has
    telegram_users ||--o{ telegram_actions : has
```

---

## Directory Structure

```mermaid
graph TD
    tg["telegram-bot/"]
    bot["bot/"]
    services["bot/services/"]
    handlers["bot/handlers/"]
    keyboards["bot/keyboards/"]
    utils["bot/utils/"]
    docs["bot/docs/"]

    tg --> bot
    bot --> services
    bot --> handlers
    bot --> keyboards
    bot --> utils
    bot --> docs

    services --> auth["auth.py"]
    services --> audit["audit.py"]
    services --> ai_client["ai_client.py"]
    services --> voice["voice.py"]
    services --> file_processor["file_processor.py"]

    handlers --> text["text.py"]
    handlers --> voice["voice.py"]
    handlers --> files["files.py"]

    keyboards --> reply["reply.py"]
    keyboards --> inline["inline.py"]

    utils --> parser["parser.py"]

    class tg,bot,handlers,services,keyboards,utils,docs folder
```

---

## Audit Logging

### What is Logged

| Event | Details Stored |
|-------|----------------|
| **Messages** | Full text (including punctuation), timestamp, type |
| **Voice** | Transcript (verbatim), duration, Whisper model |
| **Files** | File name, type, size, extracted text |
| **Actions** | Type, parameters, result, execution time |
| **AI Responses** | Full response text, model, processing time |

### Tables

| Table | Purpose |
|-------|---------|
| `telegram_messages` | All messages with AI responses |
| `telegram_voice` | Voice transcription records |
| `telegram_files` | File processing records |
| `telegram_actions` | Action audit (task creation, etc.) |
| `telegram_users` | User mapping |
| `telegram_sessions` | Session tracking |

---

## Security

```mermaid
graph LR
    subgraph Users["Allowed Users"]
        U1["User 1"]
        U2["User 2"]
        U3["User 3"]
    end

    subgraph Auth["Authorization"]
        Check["Telegram ID Check"]
        ALLOWED["ALLOWED_TELEGRAM_IDS"]
    end

    subgraph Access["Access Control"]
        RBAC["Role-based Access"]
        CRM["CRM User Role"]
    end

    U1 --> Check
    U2 --> Check
    U3 --> Check
    Check --> ALLOWED
    Check --> RBAC
    RBAC --> CRM
```

### Authorization Flow

1. User sends message
2. Extract `telegram_id` from update
3. Check if `telegram_id` in `ALLOWED_TELEGRAM_IDS`
4. Get or create `telegram_users` record
5. Map to `crm_user_id` for CRM access
6. Log all activity to audit tables

---

## Deployment

### Environment Variables

```bash
TELEGRAM_BOT_TOKEN=xxx
CRM_URL=https://crm.example.com
CRM_API_KEY=xxx
OPENAI_API_KEY=sk-xxx
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_KEY=xxx
ALLOWED_TELEGRAM_IDS=123,456,789
```

### Run

```bash
cd telegram-bot
pip install -r requirements.txt
cp .env.example .env
python -m bot.main
```

### Docker (Optional)

```dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt
COPY . .
CMD ["python", "-m", "bot.main"]
```

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2026-04-18 | Initial implementation |
| 1.1.0 | 2026-04-18 | Added voice processing, file handling |
| 1.2.0 | 2026-04-18 | Added comprehensive audit logging |

---

## Notes

- All text is logged including punctuation (commas, periods)
- Voice transcripts are stored verbatim from Whisper
- File contents are partially stored for audit
- AI responses are fully logged
- Sessions are tracked with message/action counts