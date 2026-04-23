"""
Telegram Bot Main Entry Point
Shveyka ERP AI Assistant
"""

import logging
import os
import sys
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from telegram import Update
from telegram.ext import (
    Application,
    CommandHandler,
    MessageHandler,
    CallbackQueryHandler,
    filters,
    ContextTypes,
)

from bot.config import config
from bot.handlers.text import text_handler
from bot.handlers.voice import voice_handler
from bot.handlers.files import file_handler
from bot.services import auth_service, audit_service

# Setup logging
logging.basicConfig(
    level=getattr(logging, config.log_level),
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler("telegram_bot.log"),
    ],
)

logger = logging.getLogger(__name__)


async def error_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle errors"""
    logger.error(f"Error: {context.error}")
    if update and update.message:
        await update.message.reply_text(f"❌ Сталася помилка: {str(context.error)}")


async def start_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle /start command"""
    user = update.message.from_user

    # Authenticate
    t_user = auth_service.get_or_create_user(
        telegram_id=user.id,
        username=user.username,
        first_name=user.first_name,
        last_name=user.last_name,
    )

    if not t_user:
        await update.message.reply_text("⛔ Доступ заборонено.")
        return

    # Log action
    audit_service.log_action(
        {
            "telegram_user_id": user.id,
            "action_type": "auth_success",
            "action_details": {"start": True},
        }
    )

    await text_handler._handle_start(update, t_user)


async def help_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle /help command"""
    await text_handler._handle_help(update)


async def status_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle /status command"""
    await text_handler._handle_status(update)


async def me_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle /me command"""
    user = update.message.from_user
    t_user = auth_service.get_user_by_telegram_id(user.id)
    if t_user:
        await text_handler._handle_me(update, t_user)


async def history_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle /history command"""
    user = update.message.from_user
    t_user = auth_service.get_user_by_telegram_id(user.id)
    if t_user:
        await text_handler._handle_history(update, t_user)


async def clear_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle /clear command"""
    user = update.message.from_user
    t_user = auth_service.get_user_by_telegram_id(user.id)
    if t_user:
        await text_handler._handle_clear(update, t_user)


async def text_message(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle text messages"""
    await text_handler.handle(update, context)


async def voice_message(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle voice messages"""
    await voice_handler.handle(update, context)


async def document_message(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle document uploads"""
    await file_handler.handle(update, context)


async def photo_message(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle photo uploads"""
    await file_handler.handle(update, context)


async def callback_query(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle inline button callbacks"""
    query = update.callback_query
    await query.answer()

    data = query.data
    user = query.from_user

    t_user = auth_service.get_user_by_telegram_id(user.id)
    if not t_user:
        await query.edit_message_text("⛔ Доступ заборонено.")
        return

    # Log callback
    audit_service.log_message(
        {
            "telegram_user_id": user.id,
            "telegram_message_id": query.message.message_id,
            "chat_id": query.message.chat_id,
            "message_type": "callback",
            "content_text": data,
            "parsed_command": data,
        }
    )

    # Route callbacks
    if data.startswith("ai_"):
        await handle_ai_callback(query, data, t_user)
    elif data.startswith("order_"):
        await handle_order_callback(query, data, t_user)
    elif data.startswith("batch_"):
        await handle_batch_callback(query, data, t_user)
    elif data == "noop":
        pass
    else:
        await query.edit_message_text(f"Обробляю: {data}")


async def handle_ai_callback(query, data: str, user):
    """Handle AI-related callbacks"""
    from bot.services import ai_client

    if data == "ai_kb_search":
        await query.edit_message_text("🔍 Введіть запит для пошуку в документах:")
    elif data == "ai_explain_order":
        await query.edit_message_text("📝 Введіть ID замовлення:")
    elif data == "ai_production":
        response = await ai_client.send_message(
            question="Покажи аналіз продуктивності цеху за останній тиждень",
            telegram_user_id=user.telegram_id,
            crm_user_id=user.crm_user_id,
            role=user.role,
        )
        answer = ai_client.format_answer(response["answer"])
        await query.edit_message_text(answer)


async def handle_order_callback(query, data: str, user):
    """Handle order-related callbacks"""
    await query.edit_message_text(f"Замовлення: {data}")


async def handle_batch_callback(query, data: str, user):
    """Handle batch-related callbacks"""
    await query.edit_message_text(f"Партія: {data}")


def main():
    """Main entry point"""
    logger.info("Starting Telegram Bot...")
    logger.info(f"Environment: {config.environment}")
    logger.info(f"Allowed users: {len(config.allowed_telegram_ids)}")

    # Create application
    app = Application.builder().token(config.telegram_bot_token).build()

    # Add handlers
    app.add_handler(CommandHandler("start", start_command))
    app.add_handler(CommandHandler("help", help_command))
    app.add_handler(CommandHandler("status", status_command))
    app.add_handler(CommandHandler("me", me_command))
    app.add_handler(CommandHandler("history", history_command))
    app.add_handler(CommandHandler("clear", clear_command))

    # Message handlers
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, text_message))
    app.add_handler(MessageHandler(filters.VOICE, voice_message))
    app.add_handler(MessageHandler(filters.Document.ALL, document_message))
    app.add_handler(MessageHandler(filters.PHOTO, photo_message))

    # Callback handler
    app.add_handler(CallbackQueryHandler(callback_query))

    # Error handler
    app.add_error_handler(error_handler)

    # Start polling
    logger.info("Bot is running...")
    app.run_polling(allowed_updates=Update.ALL_TYPES, drop_pending_updates=True)


if __name__ == "__main__":
    main()
