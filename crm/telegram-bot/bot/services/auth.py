"""
Authentication Service
Maps Telegram users to CRM users
"""

import logging
from typing import Optional, Dict, Any
from dataclasses import dataclass
import psycopg2
from psycopg2.extras import RealDictCursor

from bot.config import config

logger = logging.getLogger(__name__)


@dataclass
class TelegramUser:
    """Telegram user data"""

    telegram_id: int
    crm_user_id: Optional[int]
    username: Optional[str]
    first_name: str
    last_name: Optional[str]
    is_active: bool
    role: Optional[str] = None


class AuthService:
    """Authentication service for Telegram users"""

    def __init__(self):
        self._conn = None

    def _get_connection(self):
        """Get database connection"""
        if not self._conn or self._conn.closed:
            self._conn = psycopg2.connect(
                host=config.supabase_url.replace("https://", "").split(".")[0],
                port=5432,
                database="postgres",
                user="postgres",
                password=config.supabase_key,
            )
        return self._conn

    def get_user_by_telegram_id(self, telegram_id: int) -> Optional[TelegramUser]:
        """
        Get CRM user by Telegram ID
        First checks telegram_users table, then maps to auth.users
        """
        try:
            conn = self._get_connection()
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                # Get telegram user with CRM user info
                cur.execute(
                    """
                    SELECT
                        tu.telegram_id,
                        tu.crm_user_id,
                        tu.username,
                        tu.first_name,
                        tu.last_name,
                        tu.is_active,
                        au.role
                    FROM telegram_users tu
                    LEFT JOIN auth.users au ON tu.crm_user_id = au.id
                    WHERE tu.telegram_id = %s
                """,
                    (telegram_id,),
                )

                row = cur.fetchone()
                if row:
                    return TelegramUser(
                        telegram_id=row["telegram_id"],
                        crm_user_id=row["crm_user_id"],
                        username=row["username"],
                        first_name=row["first_name"] or "Користувач",
                        last_name=row["last_name"],
                        is_active=row["is_active"],
                        role=row["role"],
                    )
                return None
        except Exception as e:
            logger.error(f"Failed to get user by telegram_id: {e}")
            return None

    def register_user(
        self,
        telegram_id: int,
        username: Optional[str] = None,
        first_name: str = "Користувач",
        last_name: Optional[str] = None,
    ) -> TelegramUser:
        """
        Register a new Telegram user
        Creates mapping in telegram_users table
        """
        try:
            conn = self._get_connection()
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute(
                    """
                    INSERT INTO telegram_users (telegram_id, username, first_name, last_name)
                    VALUES (%s, %s, %s, %s)
                    ON CONFLICT (telegram_id) DO UPDATE SET
                        username = EXCLUDED.username,
                        first_name = EXCLUDED.first_name,
                        last_name = EXCLUDED.last_name,
                        last_seen_at = NOW(),
                        updated_at = NOW()
                    RETURNING telegram_id, crm_user_id, username, first_name, last_name, is_active
                """,
                    (telegram_id, username, first_name, last_name),
                )

                row = cur.fetchone()
                conn.commit()

                return TelegramUser(
                    telegram_id=row["telegram_id"],
                    crm_user_id=row["crm_user_id"],
                    username=row["username"],
                    first_name=row["first_name"],
                    last_name=row["last_name"],
                    is_active=row["is_active"],
                )
        except Exception as e:
            logger.error(f"Failed to register user: {e}")
            conn.rollback()
            raise

    def link_to_crm_user(self, telegram_id: int, crm_user_id: int) -> bool:
        """Link Telegram user to CRM user"""
        try:
            conn = self._get_connection()
            with conn.cursor() as cur:
                cur.execute(
                    """
                    UPDATE telegram_users
                    SET crm_user_id = %s, updated_at = NOW()
                    WHERE telegram_id = %s
                """,
                    (crm_user_id, telegram_id),
                )
                conn.commit()
                return cur.rowcount > 0
        except Exception as e:
            logger.error(f"Failed to link user: {e}")
            conn.rollback()
            return False

    def update_last_seen(self, telegram_id: int):
        """Update last seen timestamp"""
        try:
            conn = self._get_connection()
            with conn.cursor() as cur:
                cur.execute(
                    """
                    UPDATE telegram_users
                    SET last_seen_at = NOW()
                    WHERE telegram_id = %s
                """,
                    (telegram_id,),
                )
                conn.commit()
        except Exception as e:
            logger.error(f"Failed to update last_seen: {e}")

    def is_allowed(self, telegram_id: int) -> bool:
        """Check if user is allowed to use the bot"""
        return telegram_id in config.allowed_telegram_ids

    def is_admin(self, telegram_id: int) -> bool:
        """Check if user is admin"""
        return telegram_id in config.admin_telegram_ids

    def get_or_create_user(
        self,
        telegram_id: int,
        username: Optional[str],
        first_name: str,
        last_name: Optional[str],
    ) -> Optional[TelegramUser]:
        """Get existing user or create new one if allowed"""
        if not self.is_allowed(telegram_id):
            return None

        user = self.get_user_by_telegram_id(telegram_id)
        if not user:
            user = self.register_user(telegram_id, username, first_name, last_name)
        else:
            self.update_last_seen(telegram_id)

        return user


auth_service = AuthService()
