"""
Inline Keyboards
Callback and action keyboards
"""

from telegram import InlineKeyboardButton, InlineKeyboardMarkup


def get_ai_menu_keyboard():
    """AI assistant menu"""
    keyboard = [
        [
            InlineKeyboardButton(
                "🔍 Шукати в документах", callback_data="ai_kb_search"
            ),
            InlineKeyboardButton(
                "📝 Поясни замовлення", callback_data="ai_explain_order"
            ),
        ],
        [
            InlineKeyboardButton(
                "📈 Аналіз продуктивності", callback_data="ai_production"
            ),
            InlineKeyboardButton("📋 Мої задачі", callback_data="ai_tasks"),
        ],
        [
            InlineKeyboardButton("💰 Зарплата", callback_data="ai_payroll"),
            InlineKeyboardButton("👥 Працівники", callback_data="ai_workers"),
        ],
    ]

    return InlineKeyboardMarkup(keyboard)


def get_order_actions_keyboard(order_id: int):
    """Order action buttons"""
    keyboard = [
        [
            InlineKeyboardButton("📋 Деталі", callback_data=f"order_detail_{order_id}"),
            InlineKeyboardButton(
                "🏭 Партії", callback_data=f"order_batches_{order_id}"
            ),
        ],
        [
            InlineKeyboardButton(
                "📊 Статистика", callback_data=f"order_stats_{order_id}"
            ),
            InlineKeyboardButton(
                "▶️ Запустити", callback_data=f"order_launch_{order_id}"
            ),
        ],
    ]

    return InlineKeyboardMarkup(keyboard)


def get_batch_actions_keyboard(batch_id: int):
    """Batch action buttons"""
    keyboard = [
        [
            InlineKeyboardButton("📋 Статус", callback_data=f"batch_status_{batch_id}"),
            InlineKeyboardButton(
                "✅ Підтвердити", callback_data=f"batch_confirm_{batch_id}"
            ),
        ],
        [
            InlineKeyboardButton("📝 Операції", callback_data=f"batch_ops_{batch_id}"),
            InlineKeyboardButton(
                "❌ Дефекти", callback_data=f"batch_defects_{batch_id}"
            ),
        ],
    ]

    return InlineKeyboardMarkup(keyboard)


def get_task_actions_keyboard(task_id: int):
    """Task action buttons"""
    keyboard = [
        [
            InlineKeyboardButton("✅ Виконати", callback_data=f"task_done_{task_id}"),
            InlineKeyboardButton("❌ Видалити", callback_data=f"task_delete_{task_id}"),
        ],
        [
            InlineKeyboardButton("🔔 Нагадати", callback_data=f"task_remind_{task_id}"),
            InlineKeyboardButton("✏️ Редагувати", callback_data=f"task_edit_{task_id}"),
        ],
    ]

    return InlineKeyboardMarkup(keyboard)


def get_confirmation_keyboard(action: str, item_id: int):
    """Generic confirmation keyboard"""
    keyboard = [
        [
            InlineKeyboardButton("✅ Так", callback_data=f"confirm_{action}_{item_id}"),
            InlineKeyboardButton("❌ Ні", callback_data=f"cancel_{action}_{item_id}"),
        ],
    ]

    return InlineKeyboardMarkup(keyboard)


def get_pagination_keyboard(page: int, total_pages: int, prefix: str):
    """Pagination keyboard"""
    keyboard = []

    row = []
    if page > 1:
        row.append(InlineKeyboardButton("◀️", callback_data=f"{prefix}_page_{page - 1}"))
    else:
        row.append(InlineKeyboardButton("◀️", callback_data="noop"))

    row.append(InlineKeyboardButton(f"{page}/{total_pages}", callback_data="noop"))

    if page < total_pages:
        row.append(InlineKeyboardButton("▶️", callback_data=f"{prefix}_page_{page + 1}"))
    else:
        row.append(InlineKeyboardButton("▶️", callback_data="noop"))

    keyboard.append(row)

    return InlineKeyboardMarkup(keyboard)
