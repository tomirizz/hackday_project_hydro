from fastapi import FastAPI, Query, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from typing import Optional
import sqlite3
import os
import math
import json

from backend.database import get_db, init_db, DB_PATH
from backend.dedup import find_duplicate
from backend.models import compute_risk_factors

app = FastAPI(title="HydroCadastre API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def startup():
    if not os.path.exists(DB_PATH):
        print("БД не найдена, инициализирую...")
        init_db()


def row_to_dict(row: sqlite3.Row) -> dict:
    return dict(row)


# ── /objects ─────────────────────────────────────────────────────────────────

@app.get("/objects")
def get_objects(
    category: Optional[str] = Query(None, description="normal|watch|repair|critical"),
    district: Optional[str] = Query(None),
    type_code: Optional[str] = Query(None),
    year_from: Optional[int] = Query(None),
    year_to:   Optional[int] = Query(None),
    min_risk:  Optional[float] = Query(None),
    limit: int = Query(500, le=1000),
    offset: int = Query(0),
):
    conn = get_db()
    where, params = [], []

    if category:
        where.append("o.category = ?"); params.append(category)
    if district:
        where.append("d.name LIKE ?"); params.append(f"%{district}%")
    if type_code:
        where.append("t.code = ?"); params.append(type_code)
    if year_from:
        where.append("o.year_built >= ?"); params.append(year_from)
    if year_to:
        where.append("o.year_built <= ?"); params.append(year_to)
    if min_risk is not None:
        where.append("o.risk_score >= ?"); params.append(min_risk)

    clause = "WHERE " + " AND ".join(where) if where else ""
    sql = f"""
        SELECT o.*, d.name AS district_name, t.code AS type_code, t.name AS type_name
        FROM objects o
        LEFT JOIN districts d ON o.district_id = d.id
        LEFT JOIN object_types t ON o.type_id = t.id
        {clause}
        ORDER BY o.risk_score DESC
        LIMIT ? OFFSET ?
    """
    params += [limit, offset]
    rows = conn.execute(sql, params).fetchall()
    total = conn.execute(
        f"SELECT COUNT(*) FROM objects o LEFT JOIN districts d ON o.district_id=d.id LEFT JOIN object_types t ON o.type_id=t.id {clause}",
        params[:-2]
    ).fetchone()[0]
    conn.close()
    return {"total": total, "items": [row_to_dict(r) for r in rows]}


@app.get("/objects/{object_id}")
def get_object(object_id: int):
    conn = get_db()
    row = conn.execute("""
        SELECT o.*, d.name AS district_name, t.code AS type_code, t.name AS type_name
        FROM objects o
        LEFT JOIN districts d ON o.district_id = d.id
        LEFT JOIN object_types t ON o.type_id = t.id
        WHERE o.id = ?
    """, (object_id,)).fetchone()
    conn.close()
    if not row:
        raise HTTPException(status_code=404, detail="Объект не найден")
    obj = row_to_dict(row)
    # Объяснимость риска: из каких факторов он складывается
    obj["risk_factors"] = compute_risk_factors(obj)
    return obj


# ── /stats ───────────────────────────────────────────────────────────────────

@app.get("/stats")
def get_stats():
    conn = get_db()

    by_category = conn.execute("""
        SELECT category, COUNT(*) as count
        FROM objects GROUP BY category
    """).fetchall()

    by_type = conn.execute("""
        SELECT t.name, COUNT(*) as count
        FROM objects o
        LEFT JOIN object_types t ON o.type_id = t.id
        GROUP BY t.name
    """).fetchall()

    by_year = conn.execute("""
        SELECT year_built, COUNT(*) as count
        FROM objects
        WHERE year_built IS NOT NULL
        GROUP BY year_built ORDER BY year_built
    """).fetchall()

    avg_risk = conn.execute("SELECT AVG(risk_score) FROM objects").fetchone()[0]
    total    = conn.execute("SELECT COUNT(*) FROM objects").fetchone()[0]

    conn.close()
    return {
        "total": total,
        "avg_risk": round(avg_risk or 0, 4),
        "by_category": [dict(r) for r in by_category],
        "by_type": [dict(r) for r in by_type],
        "by_year": [dict(r) for r in by_year],
    }


# ── /search (для ГидроБота и поиска по тексту) ───────────────────────────────

@app.get("/search")
def search_objects(q: str = Query(..., min_length=1)):
    conn = get_db()
    rows = conn.execute("""
        SELECT o.id, o.name, o.category, o.risk_score, o.lat, o.lon,
               d.name AS district_name, t.name AS type_name
        FROM objects o
        LEFT JOIN districts d ON o.district_id = d.id
        LEFT JOIN object_types t ON o.type_id = t.id
        WHERE o.name LIKE ? OR d.name LIKE ? OR o.cadastral_no LIKE ?
        LIMIT 50
    """, (f"%{q}%", f"%{q}%", f"%{q}%")).fetchall()
    conn.close()
    return [dict(r) for r in rows]


# ── /nearby (алгоритм обнаружения объектов по координатам) ───────────────────

@app.get("/nearby")
def nearby_objects(
    lat: float = Query(...),
    lon: float = Query(...),
    radius_m: int = Query(500),
):
    """
    Возвращает объекты в радиусе radius_m метров от точки (lat, lon).
    Используется для алгоритма обнаружения: пользователь кликает на карте,
    система проверяет — есть ли объект рядом в базе.
    """
    conn = get_db()
    # Берём с запасом по bounding box, потом фильтруем точно
    deg_lat = radius_m / 111320
    deg_lon = radius_m / (111320 * math.cos(math.radians(lat)))

    rows = conn.execute("""
        SELECT o.id, o.name, o.category, o.risk_score, o.lat, o.lon,
               d.name AS district_name, t.name AS type_name
        FROM objects o
        LEFT JOIN districts d ON o.district_id = d.id
        LEFT JOIN object_types t ON o.type_id = t.id
        WHERE o.lat BETWEEN ? AND ?
          AND o.lon BETWEEN ? AND ?
    """, (lat - deg_lat, lat + deg_lat, lon - deg_lon, lon + deg_lon)).fetchall()
    conn.close()

    # Точный расчёт расстояния (формула гаверсинуса)
    def haversine(lat1, lon1, lat2, lon2):
        R = 6371000
        p = math.pi / 180
        a = (math.sin((lat2 - lat1) * p / 2) ** 2
             + math.cos(lat1 * p) * math.cos(lat2 * p)
             * math.sin((lon2 - lon1) * p / 2) ** 2)
        return 2 * R * math.asin(math.sqrt(a))

    results = []
    for r in rows:
        dist = haversine(lat, lon, r["lat"], r["lon"])
        if dist <= radius_m:
            d = dict(r)
            d["distance_m"] = round(dist)
            results.append(d)

    results.sort(key=lambda x: x["distance_m"])
    return {"found": len(results), "items": results}


# ── /check-duplicate (алгоритм дедупликации) ─────────────────────────────────

@app.post("/check-duplicate")
def check_duplicate(body: dict):
    """
    Принимает новый объект {lat, lon, name, type_code}.
    Возвращает: exists / unverified / new
    """
    result = find_duplicate(body)
    return result


# ── /dashboard (агрегаты для аналитики) ──────────────────────────────────────

@app.get("/dashboard")
def dashboard():
    """Агрегированные данные для графиков дашборда."""
    conn = get_db()

    # Pie: распределение по категориям состояния
    by_category = conn.execute("""
        SELECT category, COUNT(*) as count
        FROM objects GROUP BY category
    """).fetchall()

    # Histogram: распределение по возрастным группам
    age_buckets = conn.execute("""
        SELECT
          CASE
            WHEN age < 20 THEN '0–20'
            WHEN age < 40 THEN '20–40'
            WHEN age < 60 THEN '40–60'
            WHEN age < 80 THEN '60–80'
            WHEN age < 100 THEN '80–100'
            ELSE '100+'
          END AS bucket,
          COUNT(*) as count
        FROM objects WHERE age IS NOT NULL
        GROUP BY bucket
    """).fetchall()

    # Bar: средний риск по десятилетиям постройки
    by_decade = conn.execute("""
        SELECT
          (CAST(year_built / 10 AS INTEGER) * 10) AS decade,
          COUNT(*) as count,
          ROUND(AVG(risk_score), 3) as avg_risk
        FROM objects
        WHERE year_built IS NOT NULL
        GROUP BY decade
        HAVING count >= 3
        ORDER BY decade
    """).fetchall()

    # Heatmap аварийности
    heat_points = conn.execute("""
        SELECT lat, lon, risk_score
        FROM objects
        WHERE risk_score >= 0.5
    """).fetchall()

    # Топ-5 самых опасных объектов (для дашборда)
    top_critical = conn.execute("""
        SELECT o.id, o.name, o.risk_score, o.category, o.year_built,
               d.name AS district_name
        FROM objects o LEFT JOIN districts d ON o.district_id = d.id
        WHERE o.category = 'critical'
        ORDER BY o.risk_score DESC LIMIT 5
    """).fetchall()

    # Сводные метрики (расширенные)
    metrics = conn.execute("""
        SELECT
          COUNT(*) as total,
          ROUND(AVG(risk_score), 3) as avg_risk,
          ROUND(AVG(efficiency_actual), 3) as avg_kpd,
          ROUND(AVG(efficiency_design), 3) as avg_kpd_design,
          ROUND(AVG(age), 1) as avg_age,
          SUM(CASE WHEN category = 'critical' THEN 1 ELSE 0 END) as critical_count,
          SUM(CASE WHEN category = 'repair' THEN 1 ELSE 0 END) as repair_count,
          SUM(CASE WHEN category = 'watch' THEN 1 ELSE 0 END) as watch_count,
          SUM(CASE WHEN category = 'normal' THEN 1 ELSE 0 END) as normal_count,
          ROUND(AVG(wear_percent) * 100, 1) as avg_wear_pct
        FROM objects
    """).fetchone()

    conn.close()

    # Прогноз региона
    from backend.forecast import region_forecast
    forecast = region_forecast(10)

    return {
        "metrics": dict(metrics),
        "by_category": [dict(r) for r in by_category],
        "age_histogram": [dict(r) for r in age_buckets],
        "by_decade": [dict(r) for r in by_decade],
        "heat_points": [list(r) for r in heat_points],
        "top_critical": [dict(r) for r in top_critical],
        "region_forecast": forecast,
    }


# ── /discover (алгоритм обнаружения объектов из OpenStreetMap) ────────────────

@app.get("/discover")
def discover(limit: int = Query(50, le=100)):
    """
    Запрашивает реальные гидрообъекты из OpenStreetMap по Жамбылской области
    и сверяет каждый с базой. Помечает новые / требующие проверки / существующие.
    Требует доступ в интернет (Overpass API).
    """
    from backend.discovery import discover_from_osm
    return discover_from_osm(limit=limit)


# ── /assistant (ГидроБот на Claude API) ──────────────────────────────────────

@app.post("/assistant")
def assistant(body: dict):
    """
    ГидроБот: принимает вопрос на естественном языке, возвращает текстовый
    ответ + список объектов для подсветки на карте.
    Тело: {"message": "покажи аварийные каналы старше 50 лет"}
    """
    from backend.assistant import ask
    message = body.get("message", "").strip()
    if not message:
        raise HTTPException(status_code=400, detail="Пустой запрос")
    return ask(message)


# ── /forecast (predictive-прогноз деградации) ────────────────────────────────

@app.get("/forecast/{object_id}")
def forecast_object(object_id: int):
    """Траектория деградации конкретного объекта на 25 лет вперёд."""
    from backend.forecast import degradation_trajectory
    result = degradation_trajectory(object_id)
    if "error" in result:
        raise HTTPException(status_code=404, detail=result["error"])
    return result


@app.get("/forecast")
def forecast_region(years: int = Query(10, le=50)):
    """Прогноз по региону: сколько объектов станет аварийными за N лет."""
    from backend.forecast import region_forecast
    return region_forecast(years)


# ── /report (PDF-отчёт для министерства) ─────────────────────────────────────

@app.get("/report")
def report(lang: str = Query("ru", description="ru | kz | en")):
    """
    Генерирует и отдаёт PDF-отчёт о состоянии гидротехнических сооружений
    региона на выбранном языке: сводка, аварийные объекты, план осмотров.
    """
    from backend.report import generate_report
    pdf = generate_report(lang)
    return Response(
        content=pdf,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="hydro_report_{lang}.pdf"'},
    )


# ── /objects (создание нового объекта вручную) ───────────────────────────────

@app.post("/objects")
def create_new_object(body: dict):
    """
    Создаёт новый объект вручную (например, кликом на карте).
    Координаты обязательны. Риск и категория считаются автоматически.
    Объект помечается is_verified=0 (добавлен вручную, требует проверки).
    """
    from backend.crud import create_object
    result = create_object(body)
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    return result


# ── /inspections (журнал осмотров) ───────────────────────────────────────────

@app.get("/objects/{object_id}/inspections")
def list_inspections(object_id: int):
    """Возвращает журнал осмотров объекта (новые сверху)."""
    from backend.crud import get_inspections
    return {"items": get_inspections(object_id)}


@app.post("/objects/{object_id}/inspections")
def create_inspection(object_id: int, body: dict):
    """
    Добавляет запись осмотра. Если указано новое состояние (удов./не удов.) —
    обновляет состояние объекта и пересчитывает риск и дату следующего осмотра.
    """
    from backend.crud import add_inspection
    result = add_inspection(object_id, body)
    if "error" in result:
        raise HTTPException(status_code=404, detail=result["error"])
    return result


# ── /export/excel (выгрузка в Excel) ─────────────────────────────────────────

@app.get("/export/excel")
def export_excel(
    category: Optional[str] = Query(None),
    type_code: Optional[str] = Query(None),
):
    """Выгружает объекты в форматированный Excel-файл с цветовой разметкой."""
    from backend.export_excel import export_objects_xlsx
    data = export_objects_xlsx(category=category, type_code=type_code)
    return Response(
        content=data,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": 'attachment; filename="hydro_objects.xlsx"'},
    )


# ── /inspections/overdue (просроченные осмотры) ──────────────────────────────

@app.get("/inspections/overdue")
def overdue_inspections():
    """
    Возвращает объекты, у которых плановая дата осмотра уже прошла.
    Это ядро практической пользы: инспектор сразу видит, что просрочено.
    """
    from datetime import date
    conn = get_db()
    today = date.today().isoformat()
    rows = conn.execute("""
        SELECT o.id, o.name, o.lat, o.lon, o.risk_score, o.category,
               o.next_inspection_date, d.name AS district_name,
               CAST(julianday(?) - julianday(o.next_inspection_date) AS INTEGER) AS days_overdue
        FROM objects o
        LEFT JOIN districts d ON o.district_id = d.id
        WHERE o.next_inspection_date IS NOT NULL
          AND o.next_inspection_date < ?
        ORDER BY o.next_inspection_date ASC
    """, (today, today)).fetchall()
    conn.close()
    items = [dict(r) for r in rows]
    return {"total": len(items), "items": items}


# ── Фотографии объектов + Claude Vision анализ ───────────────────────────────

import base64
from datetime import datetime

PHOTOS_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "photos")
os.makedirs(PHOTOS_DIR, exist_ok=True)


@app.get("/objects/{object_id}/photos")
def list_photos(object_id: int):
    """Возвращает список фотографий объекта с результатами ИИ-анализа."""
    conn = get_db()
    rows = conn.execute("""
        SELECT id, object_id, filename, uploaded_at,
               vision_type, vision_state, vision_defects,
               vision_confidence, vision_description
        FROM photos WHERE object_id = ? ORDER BY uploaded_at DESC
    """, (object_id,)).fetchall()
    conn.close()
    items = []
    for r in rows:
        d = dict(r)
        if d.get("vision_defects"):
            try:
                d["vision_defects"] = json.loads(d["vision_defects"])
            except Exception:
                d["vision_defects"] = []
        items.append(d)
    return {"items": items}


@app.post("/objects/{object_id}/photos")
def upload_photo(object_id: int, body: dict):
    """
    Принимает фото в base64, сохраняет на диск, анализирует через Claude Vision
    и сохраняет результат. body = {image_base64, media_type, analyze: true/false}
    """
    image_b64 = body.get("image_base64", "")
    media_type = body.get("media_type", "image/jpeg")
    do_analyze = body.get("analyze", True)

    if not image_b64:
        raise HTTPException(status_code=400, detail="Нет изображения")

    # Сохраняем файл на диск
    ext = "jpg" if "jpeg" in media_type or "jpg" in media_type else "png"
    ts = datetime.now().strftime("%Y%m%d_%H%M%S_%f")
    filename = f"obj{object_id}_{ts}.{ext}"
    filepath = os.path.join(PHOTOS_DIR, filename)
    try:
        with open(filepath, "wb") as f:
            f.write(base64.b64decode(image_b64))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Ошибка сохранения: {e}")

    # Анализ через Claude Vision
    vision = {}
    if do_analyze:
        from backend.vision import analyze_image
        vision = analyze_image(image_b64, media_type)

    conn = get_db()
    cur = conn.execute("""
        INSERT INTO photos (object_id, filename, vision_type, vision_state,
                            vision_defects, vision_confidence, vision_description)
        VALUES (?,?,?,?,?,?,?)
    """, (
        object_id, filename,
        vision.get("object_type"), vision.get("condition"),
        json.dumps(vision.get("defects", []), ensure_ascii=False),
        vision.get("confidence"), vision.get("description"),
    ))
    conn.commit()
    photo_id = cur.lastrowid
    conn.close()

    return {
        "id": photo_id, "filename": filename,
        "vision": vision if do_analyze else None,
    }


@app.get("/photos/{filename}")
def get_photo(filename: str):
    """Отдаёт файл фотографии."""
    from fastapi.responses import FileResponse
    # Защита от path traversal
    safe = os.path.basename(filename)
    path = os.path.join(PHOTOS_DIR, safe)
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail="Фото не найдено")
    return FileResponse(path)
