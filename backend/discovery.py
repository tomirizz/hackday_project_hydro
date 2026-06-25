import requests
from backend.dedup import find_duplicate

# Overpass API — открытая база OpenStreetMap.
# Ищем водные объекты (каналы, плотины, шлюзы) в заданной области.
OVERPASS_URL = "https://overpass-api.de/api/interpreter"

# Bounding box Жамбылской области
ZHAMBYL_BBOX = (42.5, 69.5, 45.0, 74.5)  # south, west, north, east

OSM_TYPE_MAP = {
    "canal":     "canal",
    "ditch":     "canal",
    "drain":     "canal",
    "dam":       "dam",
    "weir":      "dam",
    "sluice_gate": "gate",
    "lock_gate": "gate",
}


def _build_query(bbox):
    s, w, n, e = bbox
    # Запрашиваем waterway-каналы и плотины внутри bbox
    return f"""
    [out:json][timeout:25];
    (
      way["waterway"~"canal|ditch|drain"]({s},{w},{n},{e});
      way["waterway"="dam"]({s},{w},{n},{e});
      node["waterway"="sluice_gate"]({s},{w},{n},{e});
      way["water"="reservoir"]({s},{w},{n},{e});
    );
    out center tags 50;
    """


def discover_from_osm(bbox=ZHAMBYL_BBOX, limit=50):
    """
    Запрашивает реальные гидрообъекты из OpenStreetMap и сверяет каждый
    с нашей базой через алгоритм дедупликации.

    Возвращает список найденных объектов с пометкой:
      exists / unverified / new
    """
    query = _build_query(bbox)
    try:
        resp = requests.post(OVERPASS_URL, data={"data": query}, timeout=30)
        resp.raise_for_status()
        data = resp.json()
    except Exception as e:
        return {"error": f"OSM недоступен: {e}", "items": []}

    results = []
    for el in data.get("elements", [])[:limit]:
        tags = el.get("tags", {})

        # Координаты: node — напрямую, way — из center
        if el["type"] == "node":
            lat, lon = el.get("lat"), el.get("lon")
        else:
            center = el.get("center", {})
            lat, lon = center.get("lat"), center.get("lon")
        if lat is None or lon is None:
            continue

        waterway = tags.get("waterway") or tags.get("water") or "unknown"
        type_code = OSM_TYPE_MAP.get(waterway, "canal")
        name = tags.get("name") or tags.get("name:ru") or f"OSM {waterway} {el['id']}"

        candidate = {"lat": lat, "lon": lon, "name": name, "type_code": type_code}
        dedup = find_duplicate(candidate)

        results.append({
            "osm_id": el["id"],
            "osm_type": el["type"],
            "name": name,
            "type_code": type_code,
            "waterway": waterway,
            "lat": lat,
            "lon": lon,
            "status": dedup["status"],
            "match": dedup.get("match"),
            "score": dedup.get("score"),
        })

    summary = {
        "new":        sum(1 for r in results if r["status"] == "new"),
        "unverified": sum(1 for r in results if r["status"] == "unverified"),
        "exists":     sum(1 for r in results if r["status"] == "exists"),
    }
    return {"total": len(results), "summary": summary, "items": results}
