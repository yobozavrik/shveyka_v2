# ADR-002: Впровадження дизайн-системи Linear (CSS Variables)

## Статус
**ACCEPTED** → Реалізовано 2026-04-11

## Дата
2026-04-11

## Контекст

До цього змінення система використовувала комбінацію:
1. CSS custom properties (`--bg-base`, `--text-1`, тощо) в `globals.css`
2. Tailwind `dark:` utility classes для темної/світлої теми
3. Tailwind utility кольори (slate-*, emerald-*, indigo-*) в JSX

Це призвело до:
- 128 `dark:` occurrences в 40+ файлів
- Дублювання логіки: одні компоненти використовували CSS змінні, інші — `dark:` utility
- Візуальна неузгодженість між компонентами
- Складність підтримки: зміна палітри вимагала правки в десятках файлів

## Розглянуті варіанти

### Варіант A: Залишити `dark:` utility як є
**Плюси:**
- Ніяких змін
- Tailwind автоматично обробляє теми

**Мінуси:**
- Кольори Tailwind (slate, emerald) не відповідають Linear палітрі
- Кожен новий компонент потребує `dark:` classes
- Неможливість 3-ї теми
- 128 дублікатів логіки теми

### Варіант B: Використати Tailwind `darkMode: 'class'` + custom colors
**Плюси:**
- Tailwind генерує обидва варіанти
- Не треба вручну писати `.dark` селектори

**Мінуси:**
- Потрібно визначити кожен колір в tailwind.config
- Збільшений CSS bundle
- Все ще два набори класів на кожен елемент

### Варіант C: Повний перехід на CSS Variables
**Плюси:**
- Єдине джерело правди — `globals.css`
- Нова тема = зміна значень змінних, не коду
- Підтримка необмеженої кількості тем
- Компоненти не знають про теми — використовують токени
- Менший bundle (Tailwind не генерує dark variants)

**Мінуси:**
- Потрібно замінити 128 `dark:` occurrences
- `bg-[var(--primary)]/10` не працює — потрібні inline styles
- Втрачається Tailwind `dark:` зручність для швидкого прототипування

## Прийняте рішення

**Варіант C** — повний перехід на CSS Variables.

### Обґрунтування

1. **Масштабованість:** Нова тема = зміна CSS, не JSX
2. **Консистентність:** Всі компоненти використовують одні токени
3. **Продуктивність:** Менший CSS bundle (немає dark variants)
4. **Architectural purity:** Presentation шари не залежить від теми

### Що було змінено

| Зміна | Файли | Ефект |
|-------|-------|-------|
| Видалено `dark:` utility | 40+ файлів | Всі кольори через `var(--*)` |
| Оновлено `globals.css` | 1 файл | Нова палітра Linear |
| Оновлено `tailwind.config.ts` | 1 файл | Кольори → CSS vars |
| Змінено font-weight 510/590 → 500/600 | globals.css, tailwind.config.ts | Стандартні CSS значення |
| Видалено `* { border-color }` | globals.css | Усунення specificity конфлікту |
| Об'єднано дублікати `.light` правил | linear-dashboard.css | ~30 рядків → 6 |

### Наслідки

1. **Позитивні:**
   - Кожен новий компонент автоматично підтримує обидві теми
   - Зміна кольору = 1 рядок в `globals.css`
   - Tailwind bundle менший (немає dark variants)
   - Consistent Linear aesthetic

2. **Негативні:**
   - `bg-[var(--primary)]/10` не працює — використовуємо inline `style={{ backgroundColor: 'rgba(...)' }}`
   - Деякі Tailwind utility (bg-emerald-500/10) замінено на CSS vars

### Обмеження

1. **Opacity з CSS vars:** Tailwind не підтримує `/10` opacity modifier для `var()` colors. Потрібно використовувати inline styles або попередньо визначені rgba значення.

2. **Recharts:** Бібліотека не підтримує CSS vars в деяких конфігах — потрібно конвертувати в hex через JS.

3. **Зовнішні бібліотеки:** Компоненти з `dark:` classes (наприклад, Recharts tooltip) не адаптуються автоматично.

## Пов'язані документи

- `/docs/architecture/overview.md` — загальна архітектура
- `/docs/adr/001-task-entries-vs-operation-entries.md` — інше архітектурне рішення

## Файли реалізації

| Файл | Зміна |
|------|-------|
| `src/app/globals.css` | Повна перезапис з Linear палітрою |
| `tailwind.config.ts` | Кольори → CSS vars, видалено dead entries |
| `src/components/Sidebar.tsx` | Emerald → indigo accent |
| `src/app/(dashboard)/dashboard/page.tsx` | Chart colors → CSS vars |
| `src/components/AssistantSidebar.tsx` | Всі dark: → CSS vars |
| `src/components/assistant/*.tsx` | Всі dark: → CSS vars |
| `src/app/(dashboard)/**` | Всі dark: → CSS vars (40+ файлів) |
