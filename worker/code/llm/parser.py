"""
LLM output parsing utilities.
"""

import json
import re
from typing import Any


class LLMParseError(Exception):
    """Raised when LLM output is invalid JSON."""


def _extract_json_array(text: str) -> str | None:
    """Attempt to extract the first JSON array substring from arbitrary text.

    This handles cases where the LLM prepends or appends commentary around the
    JSON array. We look for the first '[' and the last ']' and return that
    substring if it appears to be a valid JSON array.
    """
    # find first '[' and last ']' and return that slice
    start = text.find("[")
    end = text.rfind("]")
    if start == -1 or end == -1 or end <= start:
        return None
    return text[start : end + 1]


def parse_json_array(text: str) -> list[dict[str, Any]]:
    """
    Parse JSON array from LLM output.

    Strategy:
    - Try to parse the whole text as JSON (happy path).
    - If that fails, attempt to extract a JSON array substring and parse it.
    - If still failing, raise LLMParseError with the original text attached.

    Raises:
        LLMParseError
    """
    try:
        result = json.loads(text)
        if isinstance(result, list):
            return result
        # If it's a dict or other, try to locate a nested list at top-level values
        if isinstance(result, dict):
            # common pattern: {"choices": [{"message": {"content": "[...]"}}]}
            # attempt to find any list value
            for v in result.values():
                if isinstance(v, list):
                    return v
        # not a list — fallthrough to try extraction
    except Exception:
        pass

    # try to extract JSON array substring
    extracted = _extract_json_array(text)
    if extracted is not None:
        try:
            parsed = json.loads(extracted)
            if isinstance(parsed, list):
                return parsed
        except Exception:
            pass

    # final attempt: try to unescape a quoted JSON string inside the text
    # e.g. "\u005b{...}\u005d" or '"[... ]"' patterns
    # Find quoted substring that contains '['
    m = re.search(r"([\'\"])\s*(\[.*\])\s*\1", text, flags=re.DOTALL)
    if m:
        try:
            parsed = json.loads(m.group(2))
            if isinstance(parsed, list):
                return parsed
        except Exception:
            pass

    # give up — include text for diagnostics
    raise LLMParseError(text)
