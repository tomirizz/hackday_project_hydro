import math
import re
from backend.database import get_db

RADIUS_M = 200  # радиус поиска кандидатов на совпадение


def _haversine(lat1, lon1, lat2, lon2) -> float:
    R = 6371000
    p = math.pi / 180
    a = (math.sin((lat2 - lat1) * p / 2) ** 2
         + math.cos(lat1 * p) * math.cos(lat2 * p)
         * math.sin((lon2 - lon1) * p / 2) ** 2)
    return 2 * R * math.asin(math.sqrt(a))


def _normalize_name(s: str) -> set:
    """Приводим имя к набору значимых токенов для сравнения."""
    if not s:
        return set()
    s = str(s).lower()
    s = re.sub(r"[№#()]", " ", s)
    s = re.sub(r"\b(канал|шлюз|плотина|дамба|гидропост|им|имени)\b", " ", s)
    tokens = {t for t in s.split() if len(t) > 1}
    return tokens


def _name_similarity(a: str, b: str) -> float:
    ta, tb = _normalize_name(a), _normalize_name(b)
    if not ta or not tb:
        return 0.0
    inter = len(ta & tb)
    union = len(ta | tb)
    return inter / union if union else 0.0


def find_duplicate(candidate: dict) -> dict:
    """
    Проверяет новый объект против базы по трём признакам:
      - геоблизость (вес 0.5)
      - схожесть названия (вес 0.3)
      - совпадение типа (вес 0.2)

    Статусы:
      exists     (score >= 0.70) — дубликат, уже есть в базе
      unverified (0.40-0.70)     — похож, требует ручной проверки
      new        (< 0.40)        — новый объект, добавить в каталог
    """
    lat = candidate.get("lat")
    lon = candidate.get("lon")
    name = candidate.get("name", "")
    tcode = candidate.get("type_code", "")

    if lat is None or lon is None:
        return {"status": "error", "message": "Не указаны координаты (lat/lon)"}

    deg_lat = RADIUS_M / 111320
    deg_lon = RADIUS_M / (111320 * math.cos(math.radians(lat)))

    conn = get_db()
    rows = conn.execute("""
        SELECT o.id, o.name, o.lat, o.lon, t.code AS type_code,
               d.name AS district_name
        FROM objects o
        LEFT JOIN object_types t ON o.type_id = t.id
        LEFT JOIN districts d ON o.district_id = d.id
        WHERE o.lat BETWEEN ? AND ? AND o.lon BETWEEN ? AND ?
    """, (lat - deg_lat, lat + deg_lat, lon - deg_lon, lon + deg_lon)).fetchall()
    conn.close()

    best_score = 0.0
    best_match = None
    breakdown = None

    for r in rows:
        dist = _haversine(lat, lon, r["lat"], r["lon"])
        if dist > RADIUS_M:
            continue

        dist_score = 1 - dist / RADIUS_M
        name_score = _name_similarity(name, r["name"])
        type_score = 1.0 if tcode and tcode == r["type_code"] else 0.0

        score = dist_score * 0.5 + name_score * 0.3 + type_score * 0.2

        if score > best_score:
            best_score = score
            best_match = {
                "id": r["id"], "name": r["name"],
                "district_name": r["district_name"],
                "distance_m": round(dist),
            }
            breakdown = {
                "geo": round(dist_score, 3),
                "name": round(name_score, 3),
                "type": round(type_score, 3),
            }

    if best_score >= 0.70:
        status = "exists"
    elif best_score >= 0.40:
        status = "unverified"
    else:
        status = "new"

    return {
        "status": status,
        "score": round(best_score, 3),
        "match": best_match if status != "new" else None,
        "breakdown": breakdown,
        "candidates_checked": len(rows),
    }
