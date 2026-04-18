"""
AI Client Service
Connects to CRM AI Assistant API
"""

import logging
import time
import json
from typing import Optional, Dict, Any, List
import httpx

from bot.config import config

logger = logging.getLogger(__name__)


class AIClient:
    """Client for CRM AI Assistant API"""

    def __init__(self):
        self.base_url = config.crm_url.rstrip('/')
        self.api_key = config.crm_api_key
        self.timeout = 120.0  # AI can take time

    def _get_headers(self) -> Dict[str, str]:
        """Get request headers"""
        headers = {
            'Content-Type': 'application/json',
            'User-Agent': 'TelegramBot/1.0'
        }
        if self.api_key:
            headers['Authorization'] = f'Bearer {self.api_key}'
        return headers

    async def send_message(
        self,
        question: str,
        telegram_user_id: int,
        crm_user_id: Optional[int] = None,
        role: Optional[str] = None,
        history: Optional[List[Dict]] = None
    ) -> Dict[str, Any]:
        """
        Send message to AI Assistant

        Args:
            question: User's question
            telegram_user_id: Telegram user ID (for tracking)
            crm_user_id: CRM user ID (if linked)
            role: User role from CRM
            history: Previous messages for context

        Returns:
            Dict with 'answer', 'citations', 'version'
        """
        start_time = time.time()

        payload = {
            'question': question,
            'user_telegram_id': telegram_user_id,
            'source': 'telegram'
        }

        if crm_user_id:
            payload['user_id'] = crm_user_id
        if role:
            payload['role'] = role
        if history:
            payload['history'] = history

        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.post(
                    f'{self.base_url}/api/ai/assistant',
                    headers=self._get_headers(),
                    json=payload
                )

                elapsed_ms = int((time.time() - start_time) * 1000)

                if response.status_code == 200:
                    data = response.json()
                    logger.info(f"AI response in {elapsed_ms}ms for user {telegram_user_id}")

                    return {
                        'answer': data.get('answer', data.get('data', {}).get('answer', 'Немає відповіді')),
                        'citations': data.get('citations', []),
                        'version': data.get('version', 'unknown'),
                        'processing_time_ms': elapsed_ms,
                        'model': data.get('model', 'unknown')
                    }
                else:
                    logger.error(f"AI API error: {response.status_code} - {response.text}")
                    return {
                        'answer': f'Помилка AI сервісу: {response.status_code}',
                        'citations': [],
                        'version': 'error',
                        'processing_time_ms': elapsed_ms,
                        'error': response.text
                    }

        except httpx.TimeoutException:
            logger.error(f"AI API timeout for user {telegram_user_id}")
            return {
                'answer': '⏱️ AI ассистент не відповідає. Спробуйте пізніше.',
                'citations': [],
                'version': 'timeout',
                'processing_time_ms': int((time.time() - start_time) * 1000)
            }
        except Exception as e:
            logger.error(f"AI API exception: {e}")
            return {
                'answer': f'❌ Помилка з'єднання з AI: {str(e)}',
                'citations': [],
                'version': 'error',
                'processing_time_ms': int((time.time() - start_time) * 1000)
            }

    async def analyze_file(
        self,
        file_content: str,
        file_type: str,
        question: str,
        telegram_user_id: int
    ) -> Dict[str, Any]:
        """
        Analyze file content with AI

        Args:
            file_content: Extracted text from file
            file_type: xlsx, pdf, csv, etc.
            question: What to analyze
            telegram_user_id: User ID

        Returns:
            Analysis result
        """
        start_time = time.time()

        # Construct prompt for file analysis
        prompt = f"""Проаналізуй файл типу {file_type}:

Вміст файлу:
{file_content[:8000]}

Запитання користувача: {question}

Відповідь українською мовою."""

        payload = {
            'question': prompt,
            'user_telegram_id': telegram_user_id,
            'source': 'telegram_file',
            'file_type': file_type
        }

        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.post(
                    f'{self.base_url}/api/ai/assistant',
                    headers=self._get_headers(),
                    json=payload
                )

                elapsed_ms = int((time.time() - start_time) * 1000)

                if response.status_code == 200:
                    data = response.json()
                    return {
                        'answer': data.get('answer', 'Аналіз завершено'),
                        'processing_time_ms': elapsed_ms,
                        'success': True
                    }
                else:
                    return {
                        'answer': f'Помилка аналізу: {response.status_code}',
                        'processing_time_ms': elapsed_ms,
                        'success': False
                    }

        except Exception as e:
            logger.error(f"File analysis error: {e}")
            return {
                'answer': f'Помилка аналізу файлу: {str(e)}',
                'processing_time_ms': int((time.time() - start_time) * 1000),
                'success': False
            }

    def format_answer(self, answer: str, citations: List[Dict] = None) -> str:
        """
        Format AI answer for Telegram
        Converts markdown-like syntax to Telegram format
        """
        # Basic formatting
        text = answer

        # Headers
        text = text.replace('### ', '🎯 ')
        text = text.replace('## ', '📋 ')
        text = text.replace('# ', 'ℹ️ ')

        # Bold
        import re
        text = re.sub(r'\*\*(.+?)\*\*', r'🔸\1🔸', text)
        text = re.sub(r'\*(.+?)\*', r'_\1_', text)

        # Lists
        lines = text.split('\n')
        formatted_lines = []
        for line in lines:
            if line.strip().startswith('- '):
                line = '  ▪️ ' + line[2:]
            elif line.strip().startswith('• '):
                line = '  ▪️ ' + line[2:]
            elif line.strip()[0].isdigit() and '. ' in line[:4]:
                # numbered list
                idx = line.index('. ')
                line = '  ' + line
            formatted_lines.append(line)

        text = '\n'.join(formatted_lines)

        # Add citations if present
        if citations:
            text += '\n\n📚 Джерела:'
            for i, cite in enumerate(citations[:3], 1):
                source = cite.get('source', 'Документ')
                text += f'\n{i}. {source}'

        return text


ai_client = AIClient()