"""
Text Message Handler
Handles all text messages and commands
"""

import logging
import time
from typing import Optional

from telegram import Update
from telegram.ext import ContextTypes

from bot.services import auth_service, audit_service, ai_client, TelegramUser
from bot.utils.parser import parser, ParsedCommand
from bot.keyboards.reply import get_main_menu_keyboard, get_ai_menu_keyboard
from bot.config import config

logger = logging.getLogger(__name__)


class TextHandler:
    """Handler for text messages"""

    async def handle(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        """Handle incoming text message"""
        start_time = time.time()

        user = await self._authenticate(update)
        if not user:
            await update.message.reply_text("⛔ Доступ заборонено. Ви не авторизовані.")
            return

        text = update.message.text
        parsed = parser.parse(text)

        # Log the message
        from bot.services import MessageLog

        audit_service.log_message(
            MessageLog(
                telegram_user_id=user.telegram_id,
                telegram_message_id=update.message.message_id,
                chat_id=update.message.chat_id,
                message_type="text",
                content_text=text,  # Full text including commas
                content_raw={"update_id": update.update_id},
                parsed_command=parsed.command,
                command_args={"args": parsed.args},
                processing_time_ms=int((time.time() - start_time) * 1000),
            )
        )

        # Route to appropriate handler
        if parsed.command == "ai":
            await self._handle_ai(update, user, parsed.args[0] if parsed.args else "")
        elif parsed.command == "analyze":
            await self._handle_analyze(
                update, user, parsed.args[0] if parsed.args else ""
            )
        elif parsed.command == "start":
            await self._handle_start(update, user)
        elif parsed.command == "help":
            await self._handle_help(update)
        elif parsed.command == "status":
            await self._handle_status(update)
        elif parsed.command == "me":
            await self._handle_me(update, user)
        elif parsed.command == "history":
            await self._handle_history(update, user)
        elif parsed.command == "clear":
            await self._handle_clear(update, user)
        else:
            # Default: send to AI
            await self._handle_ai(update, user, text)

    async def _authenticate(self, update: Update) -> Optional[TelegramUser]:
        """Authenticate user by Telegram ID"""
        telegram_id = update.message.from_user.id
        username = update.message.from_user.username
        first_name = update.message.from_user.first_name or "Користувач"
        last_name = update.message.from_user.last_name

        return auth_service.get_or_create_user(
            telegram_id=telegram_id,
            username=username,
            first_name=first_name,
            last_name=last_name,
        )

    async def _handle_start(self, update: Update, user: TelegramUser):
        """Handle /start command"""
        welcome = f"""👋 Вітаю, {user.first_name}!

Я — AI ассистент виробництва "Швейка".

Доступні команди:
• Напишіть будь-яке питання — відповм AI ассистент
• AI: [питання] — пряме питання до AI
• /help — список команд
• /status — статус системи
• /me — ваш профіль

🎯 Виробничі функції:
• Замовлення та партії
• Працівники та зарплата
• Задачі та планування
• Аналітика
"""
        await update.message.reply_text(welcome, reply_markup=get_main_menu_keyboard())

    async def _handle_help(self, update: Update):
        """Handle /help command"""
        help_text = """
📚 Доступні команди:

👤 Профіль:
• /me — ваш профіль
• /history — історія повідомлень
• /clear — очистити історію

📊 Виробництво:
• AI: покажи замовлення
• AI: статус партії #123
• AI: запусти партію

💰 HR:
• AI: зарплата за місяць
• AI: список працівників
• AI: топ працівників

📋 Задачі:
• AI: створи задачу [опиc]
• AI: мої задачі
• AI: нагадай про [задача]

🤖 AI:
• AI: [будь-яке питання]
• Аналіз: [файл або дані]
"""
        await update.message.reply_text(help_text)

    async def _handle_status(self, update: Update):
        """Handle /status command"""
        status = f"""
🔧 Статус системи

🟢 Telegram бот: Активний
🟢 AI ассистент: Підключено
🟢 База даних: Підключено

📊 Версія: 2.2.0
🌐 Середовище: {config.environment}
"""
        await update.message.reply_text(status)

    async def _handle_me(self, update: Update, user: TelegramUser):
        """Handle /me command"""
        me_text = f"""
👤 Ваш профіль

Telegram ID: {user.telegram_id}
Ім'я: {user.first_name} {user.last_name or ""}
Username: @{user.username or "немає"}
Статус: {"Активний" if user.is_active else "Заблокований"}
Роль в CRM: {user.role or "не призначена"}
"""
        await update.message.reply_text(me_text)

    async def _handle_history(self, update: Update, user: TelegramUser):
        """Handle /history command"""
        history = audit_service.get_user_history(user.telegram_id, limit=5)

        if not history:
            await update.message.reply_text("📭 Історія порожня")
            return

        text = "📜 Останні повідомлення:\n\n"
        for i, msg in enumerate(history, 1):
            time_str = (
                msg["created_at"].strftime("%H:%M")
                if hasattr(msg["created_at"], "strftime")
                else "??:??"
            )
            content = (msg["content_text"] or "")[:50]
            text += f"{i}. [{time_str}] {content}...\n"

        await update.message.reply_text(text)

    async def _handle_clear(self, update: Update, user: TelegramUser):
        """Handle /clear command"""
        await update.message.reply_text("🗑️ Історію очищено (в CRM)")

    async def _handle_ai(self, update: Update, user: TelegramUser, question: str):
        """Handle AI query"""
        typing_msg = await update.message.reply_text("🤔 Думаю...")

        try:
            response = await ai_client.send_message(
                question=question,
                telegram_user_id=user.telegram_id,
                crm_user_id=user.crm_user_id,
                role=user.role,
            )

            answer = ai_client.format_answer(
                response["answer"], response.get("citations")
            )

            # Edit typing message with response
            await typing_msg.edit_text(answer)

            # Log AI response
            from bot.services import MessageLog

            audit_service.log_message(
                MessageLog(
                    telegram_user_id=user.telegram_id,
                    telegram_message_id=update.message.message_id,
                    chat_id=update.message.chat_id,
                    message_type="text",
                    content_text=question,
                    ai_response=response["answer"],
                    ai_model=response.get("model"),
                    ai_processing_time_ms=response.get("processing_time_ms"),
                    parsed_command="ai",
                )
            )

            # Log action
            from bot.services import ActionLog

            audit_service.log_action(
                ActionLog(
                    telegram_user_id=user.telegram_id,
                    action_type="ai_query",
                    action_details={"question": question},
                    result={"response_length": len(response["answer"])},
                    success=True,
                    execution_time_ms=response.get("processing_time_ms"),
                )
            )

        except Exception as e:
            logger.error(f"AI error: {e}")
            await typing_msg.edit_text(f"❌ Помилка AI: {str(e)}")

    async def _handle_analyze(self, update: Update, user: TelegramUser, query: str):
        """Handle analysis request"""
        await update.message.reply_text(
            "📎 Надішліть файл для аналізу (Excel, PDF, CSV, зображення)\n\n"
            "Після надсилання файлу напишіть ваше запитання."
        )


text_handler = TextHandler()
