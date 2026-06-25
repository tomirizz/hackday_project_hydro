import os
import json
import sqlite3
import urllib.request
from backend.database import get_db

ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY", "")
ANTHROPIC_URL = "https://api.anthropic.com/v1/messages"
MODEL = "claude-haiku-4-5-20251001"

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
    """Вызов Claude API через стандартную библиотеку (без внешних зависимостей)."""
    payload = {
        "model": MODEL,
        "max_tokens": 1024,
        "system": SYSTEM_PROMPT,
        "messages": messages,
    }
    if tools:
        payload["tools"] = tools

    req = urllib.request.Request(
        ANTHROPIC_URL,
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "content-type": "application/json",
            "x-api-key": ANTHROPIC_API_KEY,
            "anthropic-version": "2023-06-01",
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

    # Первый вызов — Claude решает, какой фильтр применить
    resp = _call_claude(messages, tools=[FILTER_TOOL])

    filter_args = None
    matched = []

    # Ищем вызов инструмента
    for block in resp.get("content", []):
        if block.get("type") == "tool_use" and block.get("name") == "filter_objects":
            filter_args = block["input"]
            matched = _apply_filter(filter_args)

            # Возвращаем результат Claude, чтобы он сформулировал ответ
            messages.append({"role": "assistant", "content": resp["content"]})
            messages.append({
                "role": "user",
                "content": [{
                    "type": "tool_result",
                    "tool_use_id": block["id"],
                    "content": json.dumps({
                        "found": len(matched),
                        "objects": matched[:10],
                    }, ensure_ascii=False),
                }],
            })
            break

    if filter_args is not None:
        final = _call_claude(messages)
        answer = "".join(
            b.get("text", "") for b in final.get("content", []) if b.get("type") == "text"
        )
    else:
        # Claude ответил без фильтрации (общий вопрос)
        answer = "".join(
            b.get("text", "") for b in resp.get("content", []) if b.get("type") == "text"
        )

    return {"answer": answer.strip(), "objects": matched, "filter": filter_args}
