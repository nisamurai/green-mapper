import json
import os
import asyncio
import base64
import logging
import time

from aiohttp import ClientSession, ClientTimeout
from aiohttp_retry import RetryClient, RandomRetry


logging.basicConfig(
    level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s"
)
logger = logging.getLogger(__name__)

OLLAMA_API_URL = f"http://{os.getenv("OLLAMA_HOST")}/api/chat"
MODEL = os.getenv("OLLAMA_MODEL")
SKIP_LLM = os.getenv("SKIP_LLM") == "true"

timeout = ClientTimeout(total=10)
retry_options = RandomRetry(attempts=5)

async def moderate_image(issue: dict, files: list[bytes]) -> dict:
    if SKIP_LLM:
        time.sleep(3)
        shortenIsuse = {
            "address": issue["address"],
            "detailedDescription": issue["detailedDescription"],
            "shortDescription": issue["shortDescription"],
        }
        logger.info(
            f"issue:\n{json.dumps(issue, indent=2)}\n"
            f"files len:\n{len(files)}\n"
            f"issue shorten:\n{json.dumps(shortenIsuse, indent=2)}"
            )
        return {"verified": True, "message": "testing, no llm asked"}
    
    images_b64  =  [base64.b64encode(file).decode("utf-8") for file in files ] 
    request_json = json.dumps(issue, ensure_ascii=False)

    payload = {
        "model": MODEL,
        "stream": False,
        "format": {
            "type": "object",
            "properties": {
                "verified": {"type": "boolean"},
                "message": {"type": "string"},
            },
            "required": ["verified", "message"],
        },
        "messages": [
            {
                "role": "system",
                "content": (
                    "Ты модератор изображений для заявок граждан. "
                    "Твоей задачей является модерация заявок, оставленных просыми людьми "
                    "Тебе необходимо проанализировать все поля в заданном json заявки, "
                    "а также изображения, прикрепленные к заявке, ели они есть."
                    "Запрещенным считай: порнографию/обнаженку, жестокость, кровь и шок-контент, "
                    "самоповреждение, оружие, наркотики, экстремистскую символику. "
                    "Несоответвие изображения данным заявки не является основанием для её отклонения, "
                    "Однако о несоответвии можно сообщить в поле message"
                    "Ответ верни строго в JSON: "
                    '{"verified": true|false, "message": "..."}. '
                    "Если verified=false, message должен быть пояснением на русском."
                ),
            },
            {
                "role": "user",
                "content": (
                    "Проверь изображение и контекст заявки ниже. "
                    "Ответ верни только в заданном JSON-формате.\n\n"
                    f"Данные заявки:\n{request_json}"
                ),
                "images": images_b64,
            },
        ],
    }

    body = json.dumps(payload).encode("utf-8")
    try:
        async with ClientSession(timeout=timeout) as session:
            retry_client = RetryClient(session)
            async with retry_client.post(
                OLLAMA_API_URL,
                headers={"Content-Type": "application/json"},
                retry_options=retry_options,
                json=body
            ) as request:
                request.raise_for_status()

                raw = await request.json()
                response = json.loads(raw)
    except Exception as e:
        logger.error(f"ошибка при обращении к ollama: {e}", exc_info=True)
        raise e


    content = response.get("message", {}).get("content", "")
    if not content:
        logger.error(f"Ollama вернул пустой message.content. Raw response: {response}")
        raise RuntimeError(f"Ollama returned empty message.content. Raw response: {response}")

    try:
        parsed = json.loads(content)
    except json.JSONDecodeError as e:
        logger.error(f"Не удалось распарсить ответ: {content}")
        raise RuntimeError(f"Failed to parse model JSON content: {content}") from e

    required_keys = {"verified", "message"}
    if not required_keys.issubset(parsed.keys()):
        logger.error(f"В ответе отсутсвуют необходимые поля: {parsed}. Необхожимы: {required_keys}")
        raise RuntimeError(f"Parsed JSON misses required fields. Got: {parsed}, required: {required_keys}")

    parsed["verified"] = bool(parsed["verified"])
    parsed["message"] = str(parsed["message"]).strip()

    return parsed



def read_image_bytes(path: str) -> bytes:
    with open(path, "rb") as f:
        return f.read()

async def main() -> int:
    checks = [
        {
            "image_base": ["test_images/pic1.png", "test_images/pic2.png"],
            "request_data": {
                "shortDescription": "Огурец",
                "fullDescription": "На фото виден огурец.",
                "address": "г. Тест, ул. Примерная, д. 52",
            },
        },
    ]
    has_error = False

    for index, item in enumerate(checks):
        base = item["image_base"]
        try:
            images = [read_image_bytes(file) for file in base]
            result = moderate_image(item["request_data"], images)
            print(f"\n=== test {index} ===")
            print(json.dumps(result, ensure_ascii=False, indent=2))
        except Exception as e:
            has_error = True
            print(f"\n=== {base} ===")
            print(f"ERROR: {e}")

    return 1 if has_error else 0


if __name__ == "__main__":
    asyncio.run(main())
