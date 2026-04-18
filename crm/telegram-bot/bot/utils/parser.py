"""
Command Parser
Parses text commands from users
"""

import re
from dataclasses import dataclass
from typing import Optional, List, Tuple


@dataclass
class ParsedCommand:
    """Parsed command result"""

    command: str
    args: List[str]
    raw: str
    is_command: bool


class CommandParser:
    """Parser for Telegram commands"""

    # System commands
    SYSTEM_COMMANDS = {
        "/start": "start",
        "/help": "help",
        "/status": "status",
        "/me": "me",
        "/history": "history",
        "/clear": "clear",
        "/cancel": "cancel",
    }

    # Production commands
    PRODUCTION_COMMANDS = {
        "/order": "order",
        "/партія": "batch",
        "/batch": "batch",
        "/запуск": "launch",
        "/launch": "launch",
    }

    # AI prefixes
    AI_PREFIXES = ["ai:", "AI:", "АІ:", "аі:", "ask:", "ASK:"]

    # File analysis prefix
    ANALYSIS_PREFIXES = ["аналіз:", "анализ:", "проаналізуй:", "прочитай:"]

    def parse(self, text: str) -> ParsedCommand:
        """
        Parse user text into command and arguments

        Args:
            text: Raw user input

        Returns:
            ParsedCommand with command type and args
        """
        if not text:
            return ParsedCommand(command="", args=[], raw="", is_command=False)

        text = text.strip()

        # Check for exact command match
        if text.split()[0] in self.SYSTEM_COMMANDS:
            parts = text.split(maxsplit=1)
            cmd = parts[0].lower()
            args = parts[1].split() if len(parts) > 1 else []
            return ParsedCommand(
                command=self.SYSTEM_COMMANDS[cmd], args=args, raw=text, is_command=True
            )

        # Check for production commands
        words = text.split()
        if words[0].lower() in self.PRODUCTION_COMMANDS:
            cmd = words[0].lower()
            args = words[1:] if len(words) > 1 else []
            return ParsedCommand(
                command=self.PRODUCTION_COMMANDS[cmd],
                args=args,
                raw=text,
                is_command=True,
            )

        # Check for AI prefix
        for prefix in self.AI_PREFIXES:
            if text.lower().startswith(prefix.lower()):
                query = text[len(prefix) :].strip()
                return ParsedCommand(
                    command="ai", args=[query], raw=text, is_command=True
                )

        # Check for analysis prefix
        for prefix in self.ANALYSIS_PREFIXES:
            if text.lower().startswith(prefix.lower()):
                query = text[len(prefix) :].strip()
                return ParsedCommand(
                    command="analyze", args=[query], raw=text, is_command=True
                )

        # Default: AI query
        return ParsedCommand(command="ai", args=[text], raw=text, is_command=False)

    def extract_id_from_args(self, args: List[str]) -> Optional[int]:
        """Extract numeric ID from arguments"""
        for arg in args:
            # Try to find a number
            match = re.search(r"\d+", arg)
            if match:
                return int(match.group())
        return None

    def extract_text_after_command(self, text: str, command: str) -> str:
        """Extract text after command word"""
        pattern = rf"{re.escape(command)}\s+"
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            return text[match.end() :].strip()
        return text


parser = CommandParser()
