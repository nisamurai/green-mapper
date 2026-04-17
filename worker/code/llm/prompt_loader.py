"""
Utility for loading and rendering prompt templates.
"""

from pathlib import Path
from typing import Any

PROMPTS_DIR = Path(__file__).resolve().parent.parent / "prompts"


def load_prompt(name: str, **kwargs: Any) -> str:
    """
    Load prompt template and substitute placeholders.

    Args:
        name: prompt file name
        **kwargs: values for {{placeholders}}
        prompt = load_prompt(config.prompt_name, count=count, country=payload.get("country"))

    Returns:
        Rendered prompt string.
    """
    text = (PROMPTS_DIR / name).read_text(encoding="utf-8")
    for key, value in kwargs.items():
        text = text.replace(f"{{{{{key}}}}}", str(value))
    return text
