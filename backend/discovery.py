import requests
from backend.dedup import find_duplicate

# Несколько зеркал Overpass API — если одно тормозит, пробуем следующее
OVERPASS_MIRRORS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
]

# Полная Жамбылская область, разбитая на сетку 3×2 ячеек.
# Каждая ячейка запрашивается отдельно — мелкие запросы не дают таймаут,
# а вместе они покрывают весь регион (42.5–45°N, 69.5–74.5°E).
FULL_BBOX = (42.5, 69.5, 45.0, 74.5)  # south, west, north, east
GRID_ROWS = 2
GRID_COLS = 3

OSM_TYPE_MAP = {
    "canal":       "canal",
    "ditch":       "canal",
    "drain":       "canal",
    "dam":         "dam",
    "weir":        "dam",
    "sluice_gate": "gate",
    "lock_gate":   "gate",
}


def _grid_cells(bbox, rows, cols):
    s, w, n, e = bbox
    dlat = (n - s) / rows
    dlon = (e - w) / cols
    cells = []
    for i in range(rows):
        for j in range(cols):
            cells.append((s + i*dlat, w + j*dlon, s + (i+1)*dlat, w + (j+1)*dlon))
    return cells


def _build_query(cell):
    s, w, n, e = cell
    return f"""[out:json][timeout:15];(way["waterway"="canal"]({s},{w},{n},{e});way["waterway"="dam"]({s},{w},{n},{e});node["waterway"="sluice_gate"]({s},{w},{n},{e}););out center tags 20;"""


def _fetch_osm(query):
    """Пробует зеркала по очереди, возвращает первый успешный ответ."""
    last_err = None
    for url in OVERPASS_MIRRORS:
        try:
            resp = requests.post(
                url,
                data={"data": query},
                headers={"User-Agent": "HydroCadastre/1.0", "Accept": "application/json"},
                timeout=20,
            )
            resp.raise_for_status()
            return resp.json(), None
        except Exception as e:
            last_err = e
            continue
    return None, last_err


def discover_from_osm(bbox=FULL_BBOX, limit=50):
    """
    Запрашивает реальные гидрообъекты из OpenStreetMap по всей Жамбылской
    области (через сетку ячеек) и сверяет каждый с базой через дедупликацию.
    Возвращает список с пометкой: exists / unverified / new
    """
    cells = _grid_cells(bbox, GRID_ROWS, GRID_COLS)
    all_elements = []
    seen_ids = set()
    any_success = False
    last_err = None

    for cell in cells:
        data, err = _fetch_osm(_build_query(cell))
        if data is None:
            last_err = err
            continue
        any_success = True
        for el in data.get("elements", []):
            key = (el["type"], el["id"])
            if key not in seen_ids:
                seen_ids.add(key)
                all_elements.append(el)
        if len(all_elements) >= limit:
            break

    # Если ни одна ячейка не ответила — ошибка
    if not any_success:
        return {"error": f"OSM недоступен: {last_err}", "items": [], "total": 0,
                "summary": {"new": 0, "unverified": 0, "exists": 0}}

    results = []
    for el in all_elements[:limit]:
        tags = el.get("tags", {})

        if el["type"] == "node":
            lat, lon = el.get("lat"), el.get("lon")
        else:
            center = el.get("center", {})
            lat, lon = center.get("lat"), center.get("lon")
        if lat is None or lon is None:
            continue

        waterway = tags.get("waterway") or "canal"
        type_code = OSM_TYPE_MAP.get(waterway, "canal")
        name = tags.get("name") or tags.get("name:ru") or f"OSM {waterway} {el['id']}"

        candidate = {"lat": lat, "lon": lon, "name": name, "type_code": type_code}
        dedup = find_duplicate(candidate)

        results.append({
            "osm_id":    el["id"],
            "osm_type":  el["type"],
            "name":      name,
            "type_code": type_code,
            "waterway":  waterway,
            "lat":       lat,
            "lon":       lon,
            "status":    dedup["status"],
            "match":     dedup.get("match"),
            "score":     dedup.get("score"),
        })

    summary = {
        "new":        sum(1 for r in results if r["status"] == "new"),
        "unverified": sum(1 for r in results if r["status"] == "unverified"),
        "exists":     sum(1 for r in results if r["status"] == "exists"),
    }
    return {"total": len(results), "summary": summary, "items": results}
