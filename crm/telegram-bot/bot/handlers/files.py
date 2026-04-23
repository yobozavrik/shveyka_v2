"""
File Handler
Handles document uploads (Excel, PDF, images)
"""

import logging
import time
from typing import Optional

from telegram import Update
from telegram.ext import ContextTypes

from bot.services import (
    auth_service,
    audit_service,
    ai_client,
    file_processor,
    TelegramUser,
)

logger = logging.getLogger(__name__)


class FileHandler:
    """Handler for file uploads"""

    def __init__(self):
        self.pending_files = {}  # user_id -> {file_id, file_type, file_name}

    async def handle(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        """Handle incoming file"""
        start_time = time.time()

        user = await self._authenticate(update)
        if not user:
            await update.message.reply_text("⛔ Доступ заборонено.")
            return

        # Get file info
        document = update.message.document
        file_id = document.file_id
        file_name = document.file_name
        mime_type = document.mime_type
        file_size = document.file_size

        # Determine file type
        file_type = self._get_file_type(mime_type, file_name)

        # Log file message
        from bot.services import MessageLog

        audit_service.log_message(
            MessageLog(
                telegram_user_id=user.telegram_id,
                telegram_message_id=update.message.message_id,
                chat_id=update.message.chat_id,
                message_type="file",
                content_text=f"File: {file_name}",
                content_raw={
                    "file_id": file_id,
                    "file_name": file_name,
                    "mime_type": mime_type,
                    "file_size": file_size,
                },
                processing_time_ms=int((time.time() - start_time) * 1000),
            )
        )

        # Process file
        processing_msg = await update.message.reply_text(f"📄 Обробляю {file_name}...")

        try:
            result = await file_processor.process_file(
                context.bot, file_id, file_type, file_name
            )

            if result.error:
                await processing_msg.edit_text(f"❌ Помилка: {result.error}")
                audit_service.log_file(
                    telegram_user_id=user.telegram_id,
                    file_id=file_id,
                    file_type=file_type,
                    file_name=file_name,
                    file_size=file_size,
                    error=result.error,
                )
                return

            # Show summary
            await processing_msg.edit_text(result.summary)

            # Log successful processing
            audit_service.log_file(
                telegram_user_id=user.telegram_id,
                file_id=file_id,
                file_type=file_type,
                file_name=file_name,
                file_size=file_size,
                processing_result=result.data,
                extracted_text=result.extracted_text[:1000]
                if result.extracted_text
                else None,
            )

            # Send for AI analysis if there's extracted text
            if result.extracted_text:
                # Store file context for next message
                self.pending_files[user.telegram_id] = {
                    "file_id": file_id,
                    "file_type": file_type,
                    "file_name": file_name,
                    "extracted_text": result.extracted_text,
                }

                await update.message.reply_text(
                    "📊 Файл оброблено! Напишіть ваше запитання про файл."
                )
            else:
                await update.message.reply_text("⚠️ Не вдалося витягти текст з файлу.")

        except Exception as e:
            logger.error(f"File handling error: {e}")
            await processing_msg.edit_text(f"❌ Помилка обробки: {str(e)}")

    async def handle_with_question(
        self, update: Update, context: ContextTypes.DEFAULT_TYPE, question: str
    ):
        """Handle file with a question (sent after file upload)"""
        user = await self._authenticate(update)
        if not user:
            return

        # Check if user has pending file
        file_context = self.pending_files.get(user.telegram_id)
        if not file_context:
            await update.message.reply_text("⚠️ Спочатку надішліть файл для аналізу.")
            return

        # Send to AI with file context
        ai_msg = await update.message.reply_text("🤔 Аналізую...")

        try:
            prompt = f"""Користувач запитує про файл: {file_context["file_name"]}

Запитання: {question}

Вміст файлу:
{file_context["extracted_text"][:8000]}

Відповідь українською мовою."""

            response = await ai_client.send_message(
                question=prompt,
                telegram_user_id=user.telegram_id,
                crm_user_id=user.crm_user_id,
                role=user.role,
            )

            answer = ai_client.format_answer(
                response["answer"], response.get("citations")
            )
            await ai_msg.edit_text(answer)

            # Log action
            from bot.services import ActionLog

            audit_service.log_action(
                ActionLog(
                    telegram_user_id=user.telegram_id,
                    action_type="file_process",
                    action_details={
                        "file_name": file_context["file_name"],
                        "file_type": file_context["file_type"],
                        "question": question,
                    },
                    result={"response_length": len(response["answer"])},
                    success=True,
                    execution_time_ms=response.get("processing_time_ms"),
                )
            )

            # Clear pending file
            del self.pending_files[user.telegram_id]

        except Exception as e:
            logger.error(f"File analysis error: {e}")
            await ai_msg.edit_text(f"❌ Помилка аналізу: {str(e)}")

    def _get_file_type(self, mime_type: str, file_name: str) -> str:
        """Determine file type from mime or extension"""
        # From mime type
        mime_map = {
            "application/pdf": "pdf",
            "application/vnd.ms-excel": "xls",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
            "text/csv": "csv",
            "image/png": "png",
            "image/jpeg": "jpg",
        }

        if mime_type in mime_map:
            return mime_map[mime_type]

        # From extension
        if "." in file_name:
            ext = file_name.rsplit(".", 1)[-1].lower()
            return ext

        return "unknown"

    async def _authenticate(self, update: Update) -> Optional[TelegramUser]:
        """Authenticate user"""
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


file_handler = FileHandler()
