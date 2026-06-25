"""
Анализ фотографий гидротехнических сооружений через Claude Vision (OpenRouter).
Инспектор загружает фото объекта → ИИ определяет тип, состояние, видимые дефекты.
Это закрывает требование ТЗ об анализе изображений и реализует Industry 4.0:
ИИ помогает инспектору принимать решения прямо в поле.
"""
import os
import json
import requests

API_KEY = os.environ.get("ANTHROPIC_API_KEY", "")
API_URL = "https://openrouter.ai/api/v1/chat/completions"
# Vision-совместимая модель в OpenRouter
MODEL = "anthropic/claude-haiku-4-5"

VISION_PROMPT = """Ты эксперт по гидротехническим сооружениям. Проанализируй фотографию объекта (канал, плотина, шлюз, насосная станция, водозабор или гидропост).

Определи и верни СТРОГО валидный JSON без markdown, без пояснений, в формате:
{
  "object_type": "канал|плотина|шлюз|насосная станция|водозабор|гидропост|не определено",
  "condition": "удовлетворительное|требует наблюдения|требует ремонта|аварийное",
  "defects": ["список видимых дефектов на русском, например: трещины в облицовке, эрозия откосов, заиление, разрушение бетона, протечки"],
  "confidence": 0.85,
  "description": "краткое описание на русском, 1-2 предложения"
}

Если на фото нет гидротехнического сооружения, верни object_type "не определено" и confidence 0.0.
Отвечай ТОЛЬКО JSON-объектом."""


def analyze_image(image_base64: str, media_type: str = "image/jpeg") -> dict:
    """
    Отправляет изображение в Claude Vision и возвращает структурированный
    анализ: тип объекта, состояние, дефекты, уверенность.
    """
    if not API_KEY:
        return {"error": "Не задан ANTHROPIC_API_KEY"}

    # Формат OpenRouter (OpenAI-совместимый) для изображений
    payload = {
        "model": MODEL,
        "max_tokens": 1024,
        "messages": [
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": VISION_PROMPT},
                    {
                        "type": "image_url",
                        "image_url": {"url": f"data:{media_type};base64,{image_base64}"},
                    },
                ],
            }
        ],
    }

    try:
        resp = requests.post(
            API_URL,
            headers={
                "Authorization": f"Bearer {API_KEY}",
                "Content-Type": "application/json",
            },
            json=payload,
            timeout=60,
        )
        resp.raise_for_status()
        data = resp.json()
        content = data["choices"][0]["message"]["content"]

        # Чистим возможную markdown-обёртку ```json ... ```
        content = content.strip()
        if content.startswith("```"):
            content = content.split("```")[1]
            if content.startswith("json"):
                content = content[4:]
            content = content.strip()

        result = json.loads(content)
        return result
    except json.JSONDecodeError:
        return {"error": "ИИ вернул некорректный формат", "raw": content[:200]}
    except Exception as e:
        return {"error": f"Ошибка анализа: {e}"}
