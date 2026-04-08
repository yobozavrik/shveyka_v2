# Архитектура Агентского Ассистента (Clean Architecture)

```mermaid
graph TD
    subgraph Presentation ["Слой презентации (Presentation)"]
        UI["AssistantSidebar.tsx (React)"]
        API["api/ai/assistant/route.ts (API)"]
    end

    subgraph Application ["Прикладной слой (Application)"]
        Orch["AgenticOrchestrator.ts (Оркестратор)"]
        IG["InsightGenerator.ts (Генератор)"]
    end

    subgraph Domain ["Доменный слой (Domain)"]
        Skills["Skills (Markdown Бизнес-правила)"]
        Entities["Entities (Инсайты / Рекомендации)"]
    end

    subgraph Infrastructure ["Инфраструктурный слой (Infrastructure)"]
        Gemini["GeminiProvider.ts (Google AI)"]
        Supabase["SupabaseRepository.ts (База данных)"]
    end

    %% Взаимодействия
    UI <--> API
    API <--> Orch
    Orch --> IG
    Orch --> Skills
    Orch --> Gemini
    Orch --> Supabase
```

### Описание слоев:
1.  **Presentation**: Обработка запросов пользователя и визуализация по правилу 3-30-300.
2.  **Application**: Главный дирижер (Orchestrator). Не знает о деталях реализации Gemini или Supabase, только координирует их.
3.  **Domain**: "Чистые" правила швейного производства и дизайна, хранящиеся в Markdown.
4.  **Infrastructure**: Технические детали — как именно мы ходим в Gemini или Supabase.
