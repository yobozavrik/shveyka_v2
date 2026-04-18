"""
Voice Message Handler
Handles voice messages with Whisper transcription
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
    voice_service,
    TelegramUser,
)

logger = logging.getLogger(__name__)


class VoiceHandler:
    """Handler for voice messages"""

    async def handle(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        """Handle incoming voice message"""
        start_time = time.time()

        user = await self._authenticate(update)
        if not user:
            await update.message.reply_text("⛔ Доступ заборонено.")
            return

        voice = update.message.voice
        file_id = voice.file_id
        file_unique_id = voice.file_unique_id
        duration = voice.duration

        # Log voice message
        from bot.services import MessageLog

        audit_service.log_message(
            MessageLog(
                telegram_user_id=user.telegram_id,
                telegram_message_id=update.message.message_id,
                chat_id=update.message.chat_id,
                message_type="voice",
                content_text=None,  # Will be filled after transcription
                content_raw={
                    "file_id": file_id,
                    "duration": duration,
                    "mime_type": voice.mime_type,
                },
                processing_time_ms=int((time.time() - start_time) * 1000),
            )
        )

        # Send processing message
        processing_msg = await update.message.reply_text(
            "🎤 Обробляю голосове повідомлення..."
        )

        try:
            # Transcribe voice
            (
                transcript,
                transcript_duration,
                error,
            ) = await voice_service.transcribe_telegram_voice(
                context.bot, file_id, file_unique_id
            )

            if error:
                await processing_msg.edit_text(f"❌ Помилка розпізнавання: {error}")
                # Log error
                audit_service.log_voice(
                    telegram_user_id=user.telegram_id,
                    file_id=file_id,
                    duration_seconds=duration,
                    error=error,
                )
                return

            if not transcript:
                await processing_msg.edit_text("❌ Не вдалося розпізнати мовлення")
                return

            # Log successful transcription
            audit_service.log_voice(
                telegram_user_id=user.telegram_id,
                file_id=file_id,
                duration_seconds=transcript_duration or duration,
                transcript=transcript,
                transcript_raw=transcript,
                whisper_model="whisper-1",
            )

            # Show transcript to user
            await processing_msg.edit_text(f'🎤 "{transcript}"')

            # Send to AI
            ai_msg = await update.message.reply_text("🤔 AI аналізує...")

            response = await ai_client.send_message(
                question=transcript,
                telegram_user_id=user.telegram_id,
                crm_user_id=user.crm_user_id,
                role=user.role,
            )

            answer = ai_client.format_answer(
                response["answer"], response.get("citations")
            )
            await ai_msg.edit_text(answer)

            # Log AI response for voice
            from bot.services import MessageLog

            audit_service.log_message(
                MessageLog(
                    telegram_user_id=user.telegram_id,
                    telegram_message_id=update.message.message_id,
                    chat_id=update.message.chat_id,
                    message_type="voice",
                    content_text=transcript,
                    ai_response=response["answer"],
                    ai_model=response.get("model"),
                    ai_processing_time_ms=response.get("processing_time_ms"),
                    parsed_command="ai_voice",
                )
            )

            # Log action
            from bot.services import ActionLog

            audit_service.log_action(
                ActionLog(
                    telegram_user_id=user.telegram_id,
                    action_type="voice_process",
                    action_details={"transcript": transcript, "duration": duration},
                    result={"response_length": len(response["answer"])},
                    success=True,
                    execution_time_ms=response.get("processing_time_ms"),
                )
            )

        except Exception as e:
            logger.error(f"Voice handling error: {e}")
            await processing_msg.edit_text(f"❌ Помилка: {str(e)}")

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


voice_handler = VoiceHandler()
