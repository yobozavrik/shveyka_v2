# Поток Навыков (Skill Flow) 

Эта диаграмма описывает, как ИИ-агент подтягивает "знания" (Skills) из файлов перед ответом пользователю.

```mermaid
sequenceDiagram
    participant User as Пользователь (Sidebar UI)
    participant API as API Route (NestJS/Next)
    participant Orch as AgenticOrchestrator
    participant Domain as Domain (Skills/Markdown)
    participant Infra as Infra (Supabase)
    participant LLM as Gemini 1.5 Flash

    User->>API: Запрос (Инсайты / Вопрос)
    API->>Orch: Вызов (context_type="production")
    
    Orch->>Domain: Считать правила (production-rules.md)
    Domain-->>Orch: Правила (Markdown текст)
    
    Orch->>Infra: Запрос данных (Партии / Операции)
    Infra-->>Orch: Данные (JSON)
    
    Orch->>LLM: Промпт (Правила + Данные + Вопрос)
    LLM-->>Orch: Ответ (Инсайт / Рекомендация)
    
    Orch->>API: Результат
    API->>User: Отображение (Zona 3-30-300)
```

### Ключевые моменты:
1.  **Skills (Domain)**: Это наш "Первоисточник истины". Мы можем менять правила без переписывания кода.
2.  **Infrastructure**: Отвечает за доставку "свежих" данных из БД.
3.  **Gemini**: Выполняет финальную обработку, следуя правилам из Markdown.
