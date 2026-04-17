# Архитектура AI Ассистента (MES Shveyka)

## Обзор

AI Ассистент MES Shveyka — повнофункціональна agentic система з підтримкою:

- **Role-based Access Control (RBAC)** — PolicyGuard
- **Tool-based Execution** — інструменти для роботи з даними
- **Audit Logging** — логування всіх операцій
- **Chat Memory** — збереження історії розмов користувача
- **Vector RAG** — семантичний пошук по документах
- **Citations** — посилання на джерела даних
- **Українська мова** — системний промпт

---

## Clean Architecture

```mermaid
graph TD
    subgraph Presentation ["Presentation Layer"]
        UI["OrderAssistant.tsx<br/>PayrollAssistant.tsx"]
        API["api/ai/assistant/route.ts"]
    end

    subgraph Application ["Application Layer"]
        OrchV2["AgenticOrchestratorV2<br/>(v2 - Production)"]
        Policy["PolicyGuard<br/>(RBAC)"]
        Audit["AuditLogger<br/>(Аудит)"]
        ChatMem["ChatMemoryService<br/>(Пам'ять чату)"]
    end

    subgraph Domain ["Domain Layer"]
        Skills["skills/*.md<br/>(Бізнес-правила)"]
        Tools["ToolRegistry<br/>(Інструменти)"]
        Entities["Entities<br/>(Order, Payroll, Knowledge)"]
    end

    subgraph Infrastructure ["Infrastructure Layer"]
        OpenRouter["OpenRouterProvider<br/>(OpenRouter AI)"]
        Groq["GroqProvider<br/>(Groq AI)"]
        HF["HuggingFaceProvider<br/>(HuggingFace)"]
        SupabaseRepo["SupabaseRepository"]
        KnowledgeRepo["KnowledgeRepository"]
        VectorIndex["DocumentEmbeddings<br/>(Vector RAG)"]
        ChatConv["chat_conversations<br/>(Chat Memory)"]
    end

    %% UI -> API
    UI --> API

    %% API -> Orchestrators
    API --> OrchV2

    %% V2 -> Policy, Audit, ChatMemory
    OrchV2 --> Policy
    OrchV2 --> Audit
    OrchV2 --> ChatMem

    %% V2 -> Tools
    OrchV2 --> Tools
    Tools --> Domain

    %% V2 -> Repositories
    OrchV2 --> KnowledgeRepo
    OrchV2 --> SupabaseRepo
    OrchV2 --> VectorIndex
    OrchV2 --> ChatConv

    %% Providers
    OrchV2 --> OpenRouter
    OrchV2 --> Groq
    OrchV2 --> HF

    %% Skills (ground truth)
    OrchV2 --> Skills

    %% Legend
    classDef production fill:#90EE90
    classDef infrastructure fill:#87CEEB
    class OrchV2,Policy,Audit,ChatMem production
    class OpenRouter,Groq,HF,VectorIndex,ChatConv infrastructure
```

---

## Компоненти

### 1. Presentation Layer

| Компонент | Опис |
|-----------|------|
| `OrderAssistant.tsx` | UI для пояснення статусу замовлень |
| `PayrollAssistant.tsx` | UI для пояснення розрахунку зарплати |
| `AssistantSidebar.tsx` | Бічна панель з AI чатом |

### 2. API Layer (`/api/ai/assistant`)

#### Endpoints

| Метод | Endpoint | Опис |
|-------|----------|------|
| POST | `/api/ai/assistant` | Основний чат з ассистентом |
| GET | `/api/ai/assistant/history` | Отримати історію чату користувача |
| DELETE | `/api/ai/assistant/history` | Очистити історію чату |

#### POST Request

```yaml
/api/ai/assistant:
  post:
    summary: Чат з AI ассистентом
    description: |
      Повідомлення від користувача + отримання відповіді ассистента.
      Відповідь зберігається в chat_conversations.
    tags:
      - AI Assistant
    security:
      - bearerAuth: []
    requestBody:
      required: true
      content:
        application/json:
          schema:
            type: object
            required:
              - question
            properties:
              question:
                type: string
                description: Питання користувача українською мовою
                example: "Скільки замовлень у статусі cutting?"
              history:
                type: array
                description: Історія попередніх повідомлень
                items:
                  $ref: '#/components/schemas/ChatMessage'
              mode:
                type: string
                enum: [agentic, direct]
                default: agentic
              action:
                type: string
                enum: [explain-order, explain-payroll]
              orderId:
                type: integer
                description: ID замовлення для action=explain-order
              employeeId:
                type: integer
                description: ID працівника для action=explain-payroll
              periodId:
                type: integer
                description: ID періоду для action=explain-payroll
    responses:
      '200':
        description: Відповідь ассистента
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/AIResponse'
```

### 3. Application Layer

#### AgenticOrchestratorV2

Головний оркестратор з повним функціоналом:

```typescript
class AgenticOrchestratorV2 {
  private policyGuard: PolicyGuard;      // RBAC
  private auditLogger: AuditLogger;      // Аудит
  private toolRegistry: ToolRegistry;    // Інструменти
  private knowledgeRepo: KnowledgeRepository;
  private ai: AIProvider;                // AI провайдер

  // Основні методи
  async handleQuery(
    message: string,
    context: { order_id?, worker_id?, period_id? },
    history: any[]
  ): Promise<{ answer: string, citations: Citation[] }>

  async explainOrder(orderId: number): Promise<string>
  async explainPayroll(employeeId?: number, periodId?: number): Promise<string>
  async retrieveSOP(sopName: string): Promise<string>
  async searchKnowledge(query: string, limit?: number): Promise<SearchResult[]>
  async getSmartInsights(): Promise<string>
}
```

#### PolicyGuard (RBAC)

Контроль доступу на основі ролей:

```mermaid
graph LR
    A["worker"] --> B["search_knowledge, get_document"]
    A --> C["get_worker_payroll_summary"]
    A -.-> D["Немає доступу до чужих даних"]

    E["master"] --> B
    E --> F["get_order_summary, get_order_blockers"]
    E --> G["get_pending_entries"]

    H["manager"] --> I["get_order_payroll_impact"]
    H --> F
    H --> G

    J["accountant"] --> I
    J --> G
    J --> K["full payroll access"]
```

**Ролі та дозволи:**

| Інструмент | worker | master | manager | accountant |
|------------|--------|--------|---------|------------|
| `search_knowledge` | ✅ | ✅ | ✅ | ✅ |
| `get_document` | ✅ | ✅ | ✅ | ✅ |
| `get_order_summary` | ✅ | ✅ | ✅ | ✅ |
| `get_order_blockers` | ❌ | ✅ | ✅ | ❌ |
| `get_order_timeline` | ❌ | ✅ | ✅ | ❌ |
| `get_order_payroll_impact` | ❌ | ❌ | ✅ | ✅ |
| `get_worker_payroll_summary` | Власна | Власна | ✅ | ✅ |
| `get_pending_entries` | ❌ | ✅ | ✅ | ✅ |

**Sensitive поля (фільтруються за роллю):**

| Роль | Приховані поля |
|------|---------------|
| worker | other_employee_payroll, cost_prices, margins |
| master | cost_prices, margins |
| manager | (немає) |
| accountant | (немає) |

#### AuditLogger

Логування всіх операцій:

```typescript
interface AuditSession {
  session_id: string;
  user_id: string;
  role: string;
  context: Record<string, any>;
  started_at: string;
  ended_at?: string;
}

interface ToolCallLog {
  session_id: string;
  tool_name: string;
  tool_input: Record<string, any>;
  tool_output?: Record<string, any>;
  latency_ms: number;
  created_at: string;
}
```

#### ChatMemoryService

Сервіс пам'яті чату для збереження історії розмов:

```typescript
class ChatMemoryService {
  // Додати повідомлення
  async addMessage(userId, role, content, sessionId?, messageType?, metadata?): Promise<string>
  async addUserMessage(userId, content, sessionId?): Promise<string>
  async addAssistantMessage(userId, content, sessionId?): Promise<string>

  // Отримати історію
  async getHistory(userId, limit?, offset?): Promise<ChatMessage[]>
  async getContextForLLM(userId, messageCount?): Promise<any[]>

  // Управління
  async clearHistory(userId): Promise<number>
  async getConversationCount(userId): Promise<number>
}
```

### 4. Domain Layer

#### ToolRegistry

Реєстр доступних інструментів:

```mermaid
graph TD
    TR["ToolRegistry"]
    TR --> OrderTools
    TR --> PayrollTools
    TR --> KnowledgeTools

    OrderTools["OrderTools"]
    OrderTools --> get_order_summary
    OrderTools --> get_order_blockers
    OrderTools --> get_order_timeline
    OrderTools --> get_order_payroll_impact

    PayrollTools["PayrollTools"]
    PayrollTools --> get_worker_payroll_summary
    PayrollTools --> get_entry_payroll_explanation
    PayrollTools --> get_pending_entries

    KnowledgeTools["KnowledgeTools"]
    KnowledgeTools --> search_knowledge
    KnowledgeTools --> get_sop
```

### 5. Infrastructure Layer

#### AI Providers

```mermaid
graph TD
    A["AIProviderFactory"] --> B["OpenRouterProvider"]
    A --> C["GroqProvider"]
    A --> D["HuggingFaceProvider"]

    B --> E["OpenRouter API<br/>minimax/minimax-m2.5:free"]
    C --> F["Groq API<br/>llama-3.3-70b"]
    D --> G["HuggingFace<br/>gemma-2-9b"]
```

#### Vector RAG Architecture

```mermaid
graph LR
    subgraph Ingestion ["Індексація документів"]
        Doc["Документи<br/>(Markdown)"]
        Chunker["Chunker<br/>(Розбивка на чанки)"]
        Embedder["Embedding API<br/>(OpenAI/VoyageAI)"]
        VectorDB["document_embeddings<br/>(pgvector)"]
    end

    subgraph Search ["Пошук"]
        Query["Запит користувача"]
        QueryEmb["Embedding запиту"]
        VectorSearch["Vector Search<br/>(cosine similarity)"]
        Results["Топ-K чанків"]
    end

    Doc --> Chunker
    Chunker --> Embedder
    Embedder --> VectorDB
    Query --> QueryEmb
    QueryEmb --> VectorSearch
    VectorSearch --> Results
```

#### Chat Memory Storage

```mermaid
graph TD
    subgraph Storage ["Зберігання"]
        Table["chat_conversations"]
        Idx1["idx_user_time<br/>(user_id, created_at)"]
        Idx2["idx_session<br/>(session_id)"]
        Idx3["idx_role<br/>(user_id, role)"]
    end

    subgraph Usage ["Використання"]
        LLM["LLM (для контексту)"]
        UI["UI (історія чату)"]
    end

    Table --> Idx1
    Table --> Idx2
    Table --> Idx3
    Table --> LLM
    Table --> UI
```

---

## Flow: Обробка запиту користувача

```mermaid
sequenceDiagram
    participant U as Користувач
    participant API as /api/ai/assistant
    participant CM as ChatMemory
    participant Orch as AgenticOrchestratorV2
    participant PG as PolicyGuard
    participant AL as AuditLogger
    participant AI as OpenRouterProvider
    participant DB as Supabase

    U->>API: POST { question: "Скільки замовлень?" }

    API->>API: getAuth() - перевірка JWT
    API->>CM: getContextForLLM(userId, 10)
    CM->>DB: SELECT FROM chat_conversations
    DB-->>CM: Останні 10 повідомлень
    CM-->>API: [{ role: 'user', content: '...' }]

    API->>Orch: new AgenticOrchestratorV2(role)
    Orch->>AL: logSession({ user_id, role })

    Orch->>AI: generateResponse(prompt, history)
    AI-->>Orch: LLM response

    Orch->>Orch: Parse tool call if present
    Orch->>PG: canUseTool(toolName)?
    PG-->>Orch: true/false

    Orch->>AL: logToolCall({ ... })
    Orch->>AL: endSession(session_id)

    Orch-->>API: { answer, citations }
    API->>CM: addUserMessage(userId, question)
    API->>CM: addAssistantMessage(userId, answer)

    API-->>U: { answer, version: '2.1.0' }
```

---

## Версії

| Версія | Опис | Статус |
|--------|------|--------|
| 1.0.0-classic | Простий wrapper | Legacy |
| 2.0.0-agentic | AgenticOrchestrator з tools | Legacy |
| **2.1.0** | V2 + PolicyGuard + Audit + ChatMemory | **Production** |

---

## Мовна підтримка

### Системний промпт (українська мова)

Всі відповіді ассистента генеруються **виключно українською мовою**:

```typescript
const systemInstructions = `[СИСТЕМНА ІНСТРУКЦІЯ]:
Ти — професійний AI-асистент швейного виробництва "Швейка".
Твоя спеціалізація: розкрій, пошив, склад матеріалів, облік браку та аналітика партій.

ВИМОГИ:
1. СПІЛКУВАННЯ ВИКЛЮЧНО УКРАЇНСЬКОЮ МОВОЮ
2. Відповідай коротко і по суті
3. Використовуй простий язык, зрозумілий працівникам виробництва
4. Форматуй відповіді структуровано: факт → висновок → дія
5. Посилання на джерела обов'язкові
`;
```

---

## Змінні оточення

```bash
# AI Configuration
SCOUT_AGENT_PROVIDER=openrouter-sdk  # google, openrouter-sdk, groq, huggingface-gemma

# OpenRouter (основний провайдер)
OPENROUTER_API_KEY=sk-or-v1-...
OPENROUTER_MODEL=minimax/minimax-m2.5:free

# Groq
GROQ_API_KEY=gsk_...

# HuggingFace
HUGGINGFACE_API_KEY=hf_...
GEMMA_MODEL=google/gemma-2-9b-it
```

---

## Безопасність

### Аутентификация
- Всі endpoints вимагають валідний JWT токен
- Токен перевіряється через `getAuth()` з `@/lib/auth-server`

### Авторизация (RBAC)
- Кожен запит створює orchestrator з роллю користувача
- PolicyGuard перевіряє доступ до інструментів
- Sensitive дані фільтруються на виході

### Аудит
- Всі сесії логуються в `assistant_sessions`
- Всі виклики інструментів логуються в `assistant_tool_calls`
- Логи включають: user_id, role, tool_name, input, output, latency

### Chat Memory Security
- RLS політика: користувач бачить тільки свої повідомлення
- `user_id = current_setting('request.jwt.claim.user_id')`

---

## Бази даних

### Таблиці

| Таблиця | Опис |
|---------|------|
| `shveyka.chat_conversations` | Історія повідомлень чату |
| `shveyka.document_embeddings` | Векторні представлення документів |
| `shveyka.knowledge_chunks` | Чанки документів для пошуку |
| `shveyka.assistant_sessions` | Сесії ассистента (аудит) |
| `shveyka.assistant_tool_calls` | Виклики інструментів (аудит) |

### Функції

| Функція | Опис |
|---------|------|
| `get_chat_history(user_id, limit, offset)` | Отримати історію чату |
| `add_chat_message(...)` | Додати повідомлення |
| `clear_chat_history(user_id)` | Очистити історію |
| `get_chat_context(user_id, count)` | Контекст для LLM |
| `semantic_search(query, limit)` | Семантичний пошук |

---

## Обмеження

1. **Vector RAG** — таблиця створена, але потребує підключення embedding provider (Supabase Vectorize / OpenAI)
2. **Chat Memory** — повністю інтегрована, але потребує міграції БД
3. **Admin client** — інструменти використовують `supabaseAdmin`, обходять RLS
4. **Rate limits** — безкоштовні моделі OpenRouter мають обмеження
5. **No streaming** — відповідь повертається цілком після генерації
6. **Knowledge base** — використовує FTS, не векторний пошук (fallback)

---

## Наступні кроки

1. Застосувати міграцію `20260417_chat_memory_and_vector_rag.sql`
2. Підключити Supabase Vectorize для семантичного пошуку
3. Інтегрувати ChatMemory в UI компоненти
4. Додати rate limiting для AI endpoints