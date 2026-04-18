"""
Voice Processing Service
Speech-to-text using OpenAI Whisper
"""

import logging
import os
import tempfile
from typing import Optional, Tuple
import openai

from bot.config import config

logger = logging.getLogger(__name__)


class VoiceService:
    """Service for voice message processing"""

    def __init__(self):
        self.client = None
        if config.openai_api_key:
            openai.api_key = config.openai_api_key
            self.client = openai.OpenAI()

    async def transcribe_audio(
        self, file_path: str, language: str = "uk"
    ) -> Tuple[Optional[str], Optional[str]]:
        """
        Transcribe audio file to text using Whisper

        Args:
            file_path: Path to audio file (.ogg from Telegram)
            language: Language code (default: uk)

        Returns:
            Tuple of (transcript, error_message)
        """
        if not self.client:
            return None, "OpenAI API key not configured"

        try:
            # Open audio file
            with open(file_path, "rb") as audio_file:
                # Call Whisper API
                response = self.client.audio.transcriptions.create(
                    model="whisper-1",
                    file=audio_file,
                    language=language,
                    response_format="verbose_json",
                    timestamp_granularities=["word"],
                )

                transcript = response.text.strip()
                logger.info(f"Transcription successful: {len(transcript)} chars")

                return transcript, None

        except openai.APIError as e:
            logger.error(f"OpenAI API error: {e}")
            return None, f"Whisper API error: {str(e)}"
        except Exception as e:
            logger.error(f"Transcription error: {e}")
            return None, f"Transcription failed: {str(e)}"

    async def transcribe_telegram_voice(
        self, bot, file_id: str, file_unique_id: str
    ) -> Tuple[Optional[str], Optional[float], Optional[str]]:
        """
        Download voice from Telegram and transcribe

        Args:
            bot: Telegram bot instance
            file_id: Telegram file_id
            file_unique_id: Telegram file_unique_id

        Returns:
            Tuple of (transcript, duration_seconds, error)
        """
        try:
            # Get file path from Telegram
            file = await bot.get_file(file_id)

            # Create temp directory if not exists
            temp_dir = os.path.join(tempfile.gettempdir(), "telegram_voice")
            os.makedirs(temp_dir, exist_ok=True)

            # Download file
            ogg_path = os.path.join(temp_dir, f"{file_unique_id}.ogg")
            await file.download_to_drive(ogg_path)

            logger.info(f"Downloaded voice file to {ogg_path}")

            # Get duration from file
            duration = None
            try:
                # Try to get duration - Telegram voice messages have duration
                # We'll get it from the file object
                duration = getattr(file, "duration", None)
            except:
                pass

            # Transcribe
            transcript, error = await self.transcribe_audio(ogg_path)

            # Cleanup
            try:
                os.remove(ogg_path)
            except:
                pass

            return transcript, duration, error

        except Exception as e:
            logger.error(f"Failed to process Telegram voice: {e}")
            return None, None, str(e)

    def cleanup_temp_files(self):
        """Clean up temporary voice files"""
        try:
            temp_dir = os.path.join(tempfile.gettempdir(), "telegram_voice")
            if os.path.exists(temp_dir):
                for file in os.listdir(temp_dir):
                    try:
                        os.remove(os.path.join(temp_dir, file))
                    except:
                        pass
        except Exception as e:
            logger.error(f"Cleanup error: {e}")


voice_service = VoiceService()
