"""
Audit Service
Comprehensive logging of all Telegram bot activities
"""

import logging
import json
import time
from typing import Optional, Dict, Any, List
from dataclasses import dataclass, asdict
from datetime import datetime
import psycopg2
from psycopg2.extras import RealDictCursor, Json

from bot.config import config

logger = logging.getLogger(__name__)


@dataclass
class MessageLog:
    """Message log entry"""

    telegram_user_id: int
    telegram_message_id: Optional[int]
    chat_id: int
    message_type: str
    content_text: Optional[str]
    content_raw: Optional[Dict]
    ai_response: Optional[str]
    ai_model: Optional[str]
    ai_processing_time_ms: Optional[int]
    parsed_command: Optional[str]
    command_args: Optional[Dict]
    processing_time_ms: Optional[int]
    error: Optional[str]


@dataclass
class ActionLog:
    """Action log entry"""

    telegram_user_id: int
    action_type: str
    action_details: Dict
    result: Optional[Dict] = None
    success: bool = True
    error: Optional[str] = None
    execution_time_ms: Optional[int] = None


class AuditService:
    """Service for comprehensive audit logging"""

    def __init__(self):
        self._conn = None

    def _get_connection(self):
        """Get database connection"""
        if not self._conn or self._conn.closed:
            try:
                # Parse Supabase connection string
                url = config.supabase_url
                host = url.replace("https://", "").split(".")[0]
                self._conn = psycopg2.connect(
                    host=f"db.{host}",
                    port=5432,
                    database="postgres",
                    user="postgres",
                    password=config.supabase_key,
                    sslmode="require",
                )
            except Exception as e:
                logger.warning(f"DB connection failed, using fallback logging: {e}")
                return None
        return self._conn

    def log_message(self, log: MessageLog) -> Optional[int]:
        """
        Log a message to telegram_messages table
        Returns message ID if successful
        """
        start_time = time.time()

        # Always log to file as backup
        self._log_to_file("message", asdict(log))

        conn = self._get_connection()
        if not conn:
            return None

        try:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO telegram_messages (
                        telegram_user_id, telegram_message_id, chat_id, message_type,
                        content_text, content_raw, ai_response, ai_model, ai_processing_time_ms,
                        parsed_command, command_args, processing_time_ms, error
                    ) VALUES (
                        %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s
                    )
                    RETURNING id
                """,
                    (
                        log.telegram_user_id,
                        log.telegram_message_id,
                        log.chat_id,
                        log.message_type,
                        log.content_text,
                        Json(log.content_raw) if log.content_raw else None,
                        log.ai_response,
                        log.ai_model,
                        log.ai_processing_time_ms,
                        log.parsed_command,
                        Json(log.command_args) if log.command_args else None,
                        log.processing_time_ms,
                        log.error,
                    ),
                )
                conn.commit()
                result = cur.fetchone()
                return result[0] if result else None
        except Exception as e:
            logger.error(f"Failed to log message: {e}")
            try:
                conn.rollback()
            except:
                pass
            return None
        finally:
            elapsed = int((time.time() - start_time) * 1000)
            logger.debug(f"Message logged in {elapsed}ms")

    def log_action(self, log: ActionLog) -> Optional[int]:
        """
        Log an action to telegram_actions table
        Returns action ID if successful
        """
        start_time = time.time()

        # Always log to file as backup
        self._log_to_file("action", asdict(log))

        conn = self._get_connection()
        if not conn:
            return None

        try:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO telegram_actions (
                        telegram_user_id, action_type, action_details, result, success, error, execution_time_ms
                    ) VALUES (
                        %s, %s, %s, %s, %s, %s, %s
                    )
                    RETURNING id
                """,
                    (
                        log.telegram_user_id,
                        log.action_type,
                        Json(log.action_details),
                        Json(log.result) if log.result else None,
                        log.success,
                        log.error,
                        log.execution_time_ms,
                    ),
                )
                conn.commit()
                result = cur.fetchone()
                return result[0] if result else None
        except Exception as e:
            logger.error(f"Failed to log action: {e}")
            try:
                conn.rollback()
            except:
                pass
            return None
        finally:
            elapsed = int((time.time() - start_time) * 1000)
            logger.debug(f"Action logged in {elapsed}ms")

    def log_voice(
        self,
        telegram_user_id: int,
        file_id: str,
        duration_seconds: Optional[float] = None,
        transcript: Optional[str] = None,
        transcript_raw: Optional[str] = None,
        whisper_model: Optional[str] = None,
        ai_response: Optional[str] = None,
        ai_processing_time_ms: Optional[int] = None,
        error: Optional[str] = None,
    ) -> Optional[int]:
        """Log voice message processing"""
        conn = self._get_connection()

        # File log backup
        self._log_to_file(
            "voice",
            {
                "telegram_user_id": telegram_user_id,
                "file_id": file_id,
                "transcript": transcript,
                "error": error,
            },
        )

        if not conn:
            return None

        try:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO telegram_voice (
                        telegram_user_id, file_id, duration_seconds, transcript, transcript_raw,
                        whisper_model, ai_response, ai_processing_time_ms, error
                    ) VALUES (
                        %s, %s, %s, %s, %s, %s, %s, %s, %s
                    )
                    RETURNING id
                """,
                    (
                        telegram_user_id,
                        file_id,
                        duration_seconds,
                        transcript,
                        transcript_raw,
                        whisper_model,
                        ai_response,
                        ai_processing_time_ms,
                        error,
                    ),
                )
                conn.commit()
                result = cur.fetchone()
                return result[0] if result else None
        except Exception as e:
            logger.error(f"Failed to log voice: {e}")
            try:
                conn.rollback()
            except:
                pass
            return None

    def log_file(
        self,
        telegram_user_id: int,
        file_id: str,
        file_type: str,
        file_name: Optional[str] = None,
        file_size: Optional[int] = None,
        processing_result: Optional[Dict] = None,
        extracted_text: Optional[str] = None,
        ai_analysis: Optional[str] = None,
        ai_processing_time_ms: Optional[int] = None,
        error: Optional[str] = None,
    ) -> Optional[int]:
        """Log file processing"""
        conn = self._get_connection()

        # File log backup
        self._log_to_file(
            "file",
            {
                "telegram_user_id": telegram_user_id,
                "file_id": file_id,
                "file_type": file_type,
                "file_name": file_name,
                "error": error,
            },
        )

        if not conn:
            return None

        try:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO telegram_files (
                        telegram_user_id, file_id, file_type, file_name, file_size,
                        processing_result, extracted_text, ai_analysis, ai_processing_time_ms, error
                    ) VALUES (
                        %s, %s, %s, %s, %s, %s, %s, %s, %s, %s
                    )
                    RETURNING id
                """,
                    (
                        telegram_user_id,
                        file_id,
                        file_type,
                        file_name,
                        file_size,
                        Json(processing_result) if processing_result else None,
                        extracted_text,
                        ai_analysis,
                        ai_processing_time_ms,
                        error,
                    ),
                )
                conn.commit()
                result = cur.fetchone()
                return result[0] if result else None
        except Exception as e:
            logger.error(f"Failed to log file: {e}")
            try:
                conn.rollback()
            except:
                pass
            return None

    def start_session(self, telegram_user_id: int) -> Optional[str]:
        """Start a new bot session"""
        import uuid

        session_id = str(uuid.uuid4())

        conn = self._get_connection()
        if not conn:
            return session_id  # Return anyway for tracking

        try:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO telegram_sessions (telegram_user_id, session_id)
                    VALUES (%s, %s)
                    RETURNING id
                """,
                    (telegram_user_id, session_id),
                )
                conn.commit()
                return session_id
        except Exception as e:
            logger.error(f"Failed to start session: {e}")
            try:
                conn.rollback()
            except:
                pass
            return session_id

    def end_session(
        self, telegram_user_id: int, message_count: int = 0, actions_count: int = 0
    ):
        """End bot session"""
        conn = self._get_connection()
        if not conn:
            return

        try:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    UPDATE telegram_sessions
                    SET ended_at = NOW(), message_count = %s, actions_count = %s
                    WHERE telegram_user_id = %s AND ended_at IS NULL
                """,
                    (message_count, actions_count, telegram_user_id),
                )
                conn.commit()
        except Exception as e:
            logger.error(f"Failed to end session: {e}")
            try:
                conn.rollback()
            except:
                pass

    def _log_to_file(self, log_type: str, data: Dict):
        """Fallback logging to file"""
        timestamp = datetime.now().isoformat()
        log_file = f"telegram_{log_type}_audit.log"

        try:
            with open(log_file, "a", encoding="utf-8") as f:
                f.write(f"[{timestamp}] {json.dumps(data, ensure_ascii=False)}\n")
        except Exception as e:
            logger.error(f"Fallback log failed: {e}")

    def get_user_history(self, telegram_user_id: int, limit: int = 10) -> List[Dict]:
        """Get recent message history for user"""
        conn = self._get_connection()
        if not conn:
            return []

        try:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute(
                    """
                    SELECT created_at, message_type, content_text, ai_response, parsed_command
                    FROM telegram_messages
                    WHERE telegram_user_id = %s
                    ORDER BY created_at DESC
                    LIMIT %s
                """,
                    (telegram_user_id, limit),
                )
                return list(cur.fetchall())
        except Exception as e:
            logger.error(f"Failed to get history: {e}")
            return []

    def get_user_actions(self, telegram_user_id: int, limit: int = 20) -> List[Dict]:
        """Get recent actions for user"""
        conn = self._get_connection()
        if not conn:
            return []

        try:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute(
                    """
                    SELECT created_at, action_type, action_details, success, result
                    FROM telegram_actions
                    WHERE telegram_user_id = %s
                    ORDER BY created_at DESC
                    LIMIT %s
                """,
                    (telegram_user_id, limit),
                )
                return list(cur.fetchall())
        except Exception as e:
            logger.error(f"Failed to get actions: {e}")
            return []


audit_service = AuditService()
