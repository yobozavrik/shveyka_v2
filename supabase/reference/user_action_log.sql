-- ═══════════════════════════════════════════════════
-- User Action Log — Полный аудит действий в Worker App
-- ═══════════════════════════════════════════════════
-- Назначение: Логирование КАЖДОГО действия пользователя
--             для аналитики, аудита, отладки и безопасности.

CREATE TABLE IF NOT EXISTS shveyka.user_action_log (
    id              BIGSERIAL PRIMARY KEY,
    employee_id     INTEGER         NOT NULL,          -- Кто выполнил действие
    session_id      UUID            NOT NULL,          -- ID сессии (генерируется при входе)

    -- Что произошло
    action_type     VARCHAR(50)     NOT NULL,          -- Тип действия (см. enum ниже)
    action_label    VARCHAR(200),                      -- Человекочитаемое описание
    target_element  VARCHAR(200),                      -- CSS селектор / ID элемента
    target_text     TEXT,                              -- Текст элемента (кнопки, ссылки)

    -- Где произошло
    page_path       VARCHAR(500)    NOT NULL,          -- URL страницы (/tasks/8)
    page_title      VARCHAR(200),                      -- Заголовок страницы

    -- Контекст
    task_id         INTEGER,                           -- Связанная задача
    batch_id        INTEGER,                           -- Связанная партия
    stage_code      VARCHAR(50),                       -- Связанный этап

    -- Данные ввода
    input_data      JSONB,                             -- Введённые данные (form values)
    previous_value  TEXT,                              -- Предыдущее значение (для изменений)
    new_value       TEXT,                              -- Новое значение (для изменений)

    -- Время
    duration_ms     INTEGER,                           -- Сколько мс заняло действие
    time_on_page_ms INTEGER,                           -- Сколько мс на странице (при уходе)
    recorded_at     TIMESTAMPTZ     NOT NULL DEFAULT NOW(),

    -- Технические данные
    user_agent      VARCHAR(500),                      -- Browser UA
    screen_size     VARCHAR(20),                       -- 360x800, 1024x768 и т.д.
    network_type    VARCHAR(20) DEFAULT 'unknown'      -- wifi, 4g, 3g, unknown
);

-- ═══════════════════════════════════════════════════
-- Индексы для быстрого поиска
-- ═══════════════════════════════════════════════════

-- Поиск по сотруднику + дате
CREATE INDEX idx_ual_employee_date ON shveyka.user_action_log (employee_id, recorded_at DESC);

-- Поиск по сессии
CREATE INDEX idx_ual_session ON shveyka.user_action_log (session_id);

-- Поиск по задаче
CREATE INDEX idx_ual_task ON shveyka.user_action_log (task_id);

-- Поиск по партии
CREATE INDEX idx_ual_batch ON shveyka.user_action_log (batch_id);

-- Поиск по типу действия
CREATE INDEX idx_ual_action_type ON shveyka.user_action_log (action_type);

-- ═══════════════════════════════════════════════════
-- Типы действий (action_type)
-- ═══════════════════════════════════════════════════
--
-- НАВИГАЦИЯ:
--   page_view         — Открытие страницы
--   page_leave        — Уход со страницы (с duration)
--   navigation_click  — Клик по ссылке/кнопке навигации
--
-- ФОРМЫ:
--   form_open         — Открытие формы (task detail)
--   form_input        — Ввод данных в поле (debounced 500ms)
--   form_submit       — Отправка формы
--   form_error        — Ошибка валидации формы
--   form_reset        — Сброс формы
--
-- КЛИКИ:
--   button_click      — Клик по кнопке
--   card_click        — Клик по карточке (задача, партия)
--   dropdown_open     — Открытие выпадающего списка
--   modal_open        — Открытие модалки
--   modal_close       — Закрытие модалки
--
-- ЗАДАЧИ:
--   task_accept       — Принятие задачи
--   task_complete     — Завершение задачи
--   entry_add         — Добавление записи
--   entry_delete      — Удаление записи
--
-- АУТЕНТИФИКАЦИЯ:
--   login_success     — Успешный вход
--   login_fail        — Неудачный вход
--   logout            — Выход
--
-- СИСТЕМНЫЕ:
--   theme_change      — Смена темы
--   error             — Ошибка приложения
--   api_error         — Ошибка API
--   notification_click— Клик по уведомлению
--
-- ═══════════════════════════════════════════════════
-- Примеры записей
-- ═══════════════════════════════════════════════════
--
-- Открытие страницы задач:
-- INSERT INTO shveyka.user_action_log
--   (employee_id, session_id, action_type, page_path, page_title, user_agent, screen_size)
-- VALUES
--   (42, '550e8400-e29b-41d4-a716-446655440000', 'page_view', '/tasks', 'Завдання', 'Mozilla/5.0...', '390x844');
--
-- Ввод количества в форму:
-- INSERT INTO shveyka.user_action_log
--   (employee_id, session_id, action_type, action_label, target_element, input_data, page_path, task_id)
-- VALUES
--   (42, '550e8400-...', 'form_input', 'Ввод количества', '#quantity_done', '{"quantity_done":"42"}', '/tasks/8', 8);
--
-- Принятие задачи:
-- INSERT INTO shveyka.user_action_log
--   (employee_id, session_id, action_type, action_label, page_path, task_id, batch_id, stage_code)
-- VALUES
--   (42, '550e8400-...', 'task_accept', 'Прийняти в роботу', '/tasks/8', 8, 234, 'cutting');
--
-- ═══════════════════════════════════════════════════
-- Очистка старых логов (cron, раз в 30 дней)
-- ═══════════════════════════════════════════════════
-- DELETE FROM shveyka.user_action_log
-- WHERE recorded_at < NOW() - INTERVAL '90 days';
