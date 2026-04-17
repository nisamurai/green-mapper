import aiohttp
import ndjson
import json
import os
import logging
from typing import Any

from core.config import config

log = logging.getLogger(__name__)


class QwenClient:
    """Async client for Qwen-like APIs.

    Notes:
    - Uses a short per-request aiohttp timeout to avoid hanging requests.
    - Tries several parsing strategies (ndjson, JSON) and performs a best-effort
      extraction of textual content from common provider envelopes.
    """

    async def generate(self, prompt: str) -> str:
        headers = {
            "Authorization": f"Bearer {config.llm.api_key}",
            "Content-Type": "application/json",
        }

        payload = {
            "model": config.llm.model,
            "messages": [
                {"role": "system", "content": "Ты генератор тестовых данных."},
                {"role": "user", "content": f"{prompt} Формат ответа: ТОЛЬКО JSON массив"},
            ],
            "temperature": config.llm.temperature,
        }

        # Allow per-request timeout override via env var LLM_REQUEST_TIMEOUT (seconds).
        # If not set, prefer LLM_TIMEOUT (worker-level) so aiohttp doesn't time out
        # earlier than the worker's asyncio.wait_for wrapper. Special values:
        # '0' or 'none' disable the aiohttp timeout (ClientTimeout(total=None)).
        _req_env = os.getenv("LLM_REQUEST_TIMEOUT", os.getenv("LLM_TIMEOUT", None))
        try:
            if _req_env is None:
                req_timeout = 60
            else:
                if str(_req_env).strip().lower() in ("0", "none", "off", "disable"):
                    req_timeout = None
                else:
                    req_timeout = int(_req_env)
        except Exception:
            req_timeout = 60

        timeout = aiohttp.ClientTimeout(total=req_timeout)

        async with aiohttp.ClientSession(timeout=timeout) as session:
            async with session.post(config.llm.api_url, headers=headers, json=payload) as resp:
                resp.raise_for_status()

                # Read full text payload first and attempt multiple parsing strategies
                raw = await resp.text()

                parsed: Any
                # Try ndjson first if content type claims ndjson or text looks like ndjson
                try:
                    if resp.content_type == "application/x-ndjson" or "\n" in raw and raw.strip().startswith("{"):
                        parsed = ndjson.loads(raw)
                    else:
                        parsed = json.loads(raw)
                except Exception:
                    # second chance: try ndjson even if first json parse failed
                    try:
                        parsed = ndjson.loads(raw)
                    except Exception:
                        # give up parsing into structured objects — return raw for caller to handle
                        log.debug("Failed to parse response as JSON/NDJSON; returning raw text")
                        return raw

                # parsed is typically a list of messages or envelopes — do a robust extraction
                def _extract_text(obj: Any) -> str:
                    pieces: list[str] = []

                    if isinstance(obj, str):
                        return obj

                    if isinstance(obj, dict):
                        # Common provider shapes: {"message": {"content": "..."}}, {"content": "..."}
                        if "message" in obj and isinstance(obj["message"], dict) and "content" in obj["message"]:
                            return str(obj["message"]["content"]) or ""
                        if "content" in obj and isinstance(obj["content"], str):
                            return obj["content"]
                        # OpenAI-like choices: {"choices": [{"message": {...}}]}
                        if "choices" in obj and isinstance(obj["choices"], list):
                            for c in obj["choices"]:
                                pieces.append(_extract_text(c))
                            return "".join(pieces)
                        # fall back to JSON string
                        return json.dumps(obj, ensure_ascii=False)

                    if isinstance(obj, list):
                        for item in obj:
                            pieces.append(_extract_text(item))
                        return "".join(pieces)

                    # other scalars
                    return str(obj)

                return _extract_text(parsed)


if __name__ == "__main__":
    import asyncio

    async def _t():
        out = await QwenClient().generate("Say hello")
        print(out)

    asyncio.run(_t())