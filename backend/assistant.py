import os
import json
import sqlite3
import urllib.request
from backend.database import get_db

ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY", "")
ANTHROPIC_URL = "https://openrouter.ai/api/v1/chat/completions"
MODEL = "anthropic/claude-haiku-4-5"

# Описание фильтра, который Claude заполняет на основе запроса пользователя.
# Claude видит схему и сам решает, какие поля установить.
FILTER_TOOL = {
    "name": "filter_objects",
    "description": (
        "Фильтрует каталог гидротехнических сооружений по заданным критериям. "
        "Вызывай эту функцию, когда пользователь просит найти, показать или "
        "перечислить объекты по какому-либо признаку."
    ),
    "input_schema": {
        "type": "object",
        "properties": {
            "category": {
                "type": "string",
                "enum": ["normal", "watch", "repair", "critical"],
                "description": "Категория состояния: normal=исправное, watch=наблюдение, repair=требует ремонта, critical=аварийное",
            },
            "min_age": {"type": "integer", "description": "Минимальный возраст в годах"},
            "max_age": {"type": "integer", "description": "Максимальный возраст в годах"},
            "min_risk": {"type": "number", "description": "Минимальный риск от 0 до 1"},
            "year_from": {"type": "integer", "description": "Построен не раньше этого года"},
            "year_to": {"type": "integer", "description": "Построен не позже этого года"},
            "district": {"type": "string", "description": "Фильтр по названию района"},
            "order_by": {
                "type": "string",
                "enum": ["risk", "age", "year"],
                "description": "Сортировка результата",
            },
            "limit": {"type": "integer", "description": "Сколько объектов вернуть (по умолчанию 20)"},
        },
    },
}

SYSTEM_PROMPT = (
    "Ты ГидроБот — помощник по каталогу гидротехнических сооружений Жамбылской "
    "области. Пользователь задаёт вопросы на естественном языке. Твоя задача — "
    "вызвать filter_objects с подходящими параметрами. После получения "
    "результатов кратко опиши находку на русском: сколько объектов, какие "
    "самые проблемные. Будь лаконичным."
)


def _apply_filter(args: dict) -> list:
    """Применяет фильтр от Claude к базе данных."""
    where, params = [], []

    if args.get("category"):
        where.append("o.category = ?"); params.append(args["category"])
    if args.get("min_age") is not None:
        where.append("o.age >= ?"); params.append(args["min_age"])
    if args.get("max_age") is not None:
        where.append("o.age <= ?"); params.append(args["max_age"])
    if args.get("min_risk") is not None:
        where.append("o.risk_score >= ?"); params.append(args["min_risk"])
    if args.get("year_from") is not None:
        where.append("o.year_built >= ?"); params.append(args["year_from"])
    if args.get("year_to") is not None:
        where.append("o.year_built <= ?"); params.append(args["year_to"])
    if args.get("district"):
        where.append("d.name LIKE ?"); params.append(f"%{args['district']}%")

    order_map = {"risk": "o.risk_score DESC", "age": "o.age DESC", "year": "o.year_built ASC"}
    order = order_map.get(args.get("order_by"), "o.risk_score DESC")
    limit = min(args.get("limit", 20), 100)

    clause = "WHERE " + " AND ".join(where) if where else ""
    sql = f"""
        SELECT o.id, o.name, o.category, o.risk_score, o.age, o.year_built,
               o.lat, o.lon, d.name AS district_name
        FROM objects o
        LEFT JOIN districts d ON o.district_id = d.id
        {clause}
        ORDER BY {order}
        LIMIT {limit}
    """
    conn = get_db()
    rows = conn.execute(sql, params).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def _call_claude(messages: list, tools=None) -> dict:
    """Вызов через OpenRouter API (OpenAI-совместимый формат)."""
    payload = {
        "model": MODEL,
        "max_tokens": 1024,
        "messages": [{"role": "system", "content": SYSTEM_PROMPT}] + messages,
    }
    if tools:
        payload["tools"] = [{"type": "function", "function": {
            "name": t["name"],
            "description": t["description"],
            "parameters": t["input_schema"],
        }} for t in tools]
        payload["tool_choice"] = "auto"

    req = urllib.request.Request(
        ANTHROPIC_URL,
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "content-type": "application/json",
            "authorization": f"Bearer {ANTHROPIC_API_KEY}",
            "http-referer": "https://hydrocadastre.kz",
        },
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.loads(resp.read().decode("utf-8"))


def ask(user_message: str) -> dict:
    """
    Главная функция ГидроБота. Принимает вопрос на русском,
    возвращает текстовый ответ + список найденных объектов для подсветки на карте.
    """
    if not ANTHROPIC_API_KEY:
        return {
            "answer": "ГидроБот недоступен: не задан ANTHROPIC_API_KEY.",
            "objects": [],
            "filter": None,
        }

    messages = [{"role": "user", "content": user_message}]

    try:
        resp = _call_claude(messages, tools=[FILTER_TOOL])
    except Exception as e:
        return {"answer": f"Ошибка запроса: {e}", "objects": [], "filter": None}

    filter_args = None
    matched = []
    answer = ""

    choice = resp.get("choices", [{}])[0]
    msg = choice.get("message", {})

    # Проверяем tool_calls (OpenRouter формат)
    tool_calls = msg.get("tool_calls")
    if tool_calls:
        tc = tool_calls[0]
        filter_args = json.loads(tc["function"]["arguments"])
        matched = _apply_filter(filter_args)

        # Второй вызов — Claude формулирует ответ на русском
        messages.append({"role": "assistant", "content": None, "tool_calls": tool_calls})
        messages.append({
            "role": "tool",
            "tool_call_id": tc["id"],
            "content": json.dumps({
                "found": len(matched),
                "objects": matched[:10],
            }, ensure_ascii=False),
        })

        try:
            final = _call_claude(messages)
            answer = final.get("choices", [{}])[0].get("message", {}).get("content", "")
        except Exception:
            answer = f"Найдено объектов: {len(matched)}."
    else:
        answer = msg.get("content", "Не удалось обработать запрос.")

    return {"answer": answer.strip(), "objects": matched, "filter": filter_args}
