"""
Services Module
"""

from bot.services.auth import auth_service, AuthService, TelegramUser
from bot.services.audit import audit_service, AuditService, MessageLog, ActionLog
from bot.services.ai_client import ai_client, AIClient
from bot.services.voice import voice_service, VoiceService
from bot.services.file_processor import file_processor, FileProcessor, FileAnalysis

__all__ = [
    "auth_service",
    "AuditService",
    "TelegramUser",
    "MessageLog",
    "ActionLog",
    "ai_client",
    "AIClient",
    "voice_service",
    "VoiceService",
    "file_processor",
    "FileProcessor",
    "FileAnalysis",
]
