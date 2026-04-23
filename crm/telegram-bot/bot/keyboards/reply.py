"""
Reply Keyboards
Main menu and context keyboards
"""

from telegram import ReplyKeyboardMarkup, KeyboardButton

from bot.config import config


def get_main_menu_keyboard():
    """Main menu keyboard"""
    keyboard = [
        [KeyboardButton("📦 Замовлення"), KeyboardButton("🏭 Партії")],
        [KeyboardButton("👥 Працівники"), KeyboardButton("💰 Зарплата")],
        [KeyboardButton("📋 Задачі"), KeyboardButton("📊 Аналітика")],
        [KeyboardButton("🔍 Пошук в документах")],
    ]

    return ReplyKeyboardMarkup(keyboard, resize_keyboard=True, one_time_keyboard=False)


def get_production_keyboard():
    """Production submenu keyboard"""
    keyboard = [
        [KeyboardButton("📋 Мої замовлення"), KeyboardButton("🏭 Мої партії")],
        [KeyboardButton("➕ Нова партія"), KeyboardButton("▶️ Запустити")],
        [KeyboardButton("◀️ Назад до меню")],
    ]

    return ReplyKeyboardMarkup(keyboard, resize_keyboard=True)


def get_hr_keyboard():
    """HR submenu keyboard"""
    keyboard = [
        [KeyboardButton("👥 Список працівників"), KeyboardButton("📅 Розклад")],
        [KeyboardButton("💰 Зарплата"), KeyboardButton("🏆 Топ працівників")],
        [KeyboardButton("◀️ Назад до меню")],
    ]

    return ReplyKeyboardMarkup(keyboard, resize_keyboard=True)


def get_tasks_keyboard():
    """Tasks submenu keyboard"""
    keyboard = [
        [KeyboardButton("📋 Мої задачі"), KeyboardButton("➕ Нова задача")],
        [KeyboardButton("🔔 Нагадування"), KeyboardButton("✅ Виконані")],
        [KeyboardButton("◀️ Назад до меню")],
    ]

    return ReplyKeyboardMarkup(keyboard, resize_keyboard=True)


def get_analytics_keyboard():
    """Analytics submenu keyboard"""
    keyboard = [
        [KeyboardButton("📊 Дашборд"), KeyboardButton("📈 Продуктивність")],
        [KeyboardButton("🏭 Цех"), KeyboardButton("💰 Фінанси")],
        [KeyboardButton("◀️ Назад до меню")],
    ]

    return ReplyKeyboardMarkup(keyboard, resize_keyboard=True)


def get_back_to_menu_keyboard():
    """Simple back to menu keyboard"""
    keyboard = [
        [KeyboardButton("◀️ Головне меню")],
    ]

    return ReplyKeyboardMarkup(keyboard, resize_keyboard=True)
