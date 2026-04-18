"""
Telegram Bot Configuration
All environment variables and settings
"""

import os
from dataclasses import dataclass
from typing import List
from dotenv import load_dotenv

load_dotenv()


@dataclass
class BotConfig:
    """Bot configuration"""

    telegram_bot_token: str
    crm_url: str
    crm_api_key: str
    openai_api_key: str
    supabase_url: str
    supabase_key: str
    allowed_telegram_ids: List[int]
    admin_telegram_ids: List[int]
    environment: str
    log_level: str
    whisper_model: str


def load_config() -> BotConfig:
    """Load configuration from environment variables"""
    allowed_ids_str = os.getenv("ALLOWED_TELEGRAM_IDS", "")
    admin_ids_str = os.getenv("ADMIN_TELEGRAM_IDS", "")

    return BotConfig(
        telegram_bot_token=os.getenv("TELEGRAM_BOT_TOKEN", ""),
        crm_url=os.getenv("CRM_URL", "http://localhost:3000"),
        crm_api_key=os.getenv("CRM_API_KEY", ""),
        openai_api_key=os.getenv("OPENAI_API_KEY", ""),
        supabase_url=os.getenv("SUPABASE_URL", ""),
        supabase_key=os.getenv("SUPABASE_KEY", ""),
        allowed_telegram_ids=[
            int(x.strip()) for x in allowed_ids_str.split(",") if x.strip()
        ],
        admin_telegram_ids=[
            int(x.strip()) for x in admin_ids_str.split(",") if x.strip()
        ],
        environment=os.getenv("ENVIRONMENT", "development"),
        log_level=os.getenv("LOG_LEVEL", "INFO"),
        whisper_model=os.getenv("WHISPER_MODEL", "whisper-1"),
    )


config = load_config()
