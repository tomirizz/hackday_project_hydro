import math
from datetime import date
from backend.database import get_db
from backend.models import (compute_risk, risk_to_category, compute_importance,
                            compute_next_inspection, compute_risk_factors)


def create_object(payload: dict) -> dict:
    """
    Создаёт новый объект в базе. Координаты обязательны.
    Риск, категория, период осмотра рассчитываются автоматически.
    Объект помечается как is_verified=0 (требует проверки, добавлен вручную).
    """
    lat = payload.get("lat")
    lon = payload.get("lon")
    if lat is None or lon is None:
        return {"error": "Координаты обязательны"}

    name = payload.get("name") or "Новый объект"
    type_code = payload.get("type_code") or "canal"
    year_built = payload.get("year_built")
    tech_state = payload.get("tech_state_raw")
    capacity = payload.get("capacity_m3s")
    wear = payload.get("wear_percent")
    district_name = payload.get("district_name")

    age = (date.today().year - int(year_built)) if year_built else None

    rec = {
        "tech_state_raw": tech_state, "age": age,
        "efficiency_drop": 0.0, "wear_percent": wear,
        "capacity_m3s": capacity, "suspended_area_ha": 0,
    }
    risk = compute_risk(rec)
    category = risk_to_category(risk)
    importance = compute_importance(rec)
    next_insp = compute_next_inspection(risk, importance).isoformat()

    conn = get_db()
    type_row = conn.execute("SELECT id FROM object_types WHERE code = ?", (type_code,)).fetchone()
    type_id = type_row["id"] if type_row else None

    district_id = None
    if district_name:
        conn.execute("INSERT OR IGNORE INTO districts (name) VALUES (?)", (district_name,))
        dr = conn.execute("SELECT id FROM districts WHERE name = ?", (district_name,)).fetchone()
        district_id = dr["id"] if dr else None

    # to_sql пересоздаёт objects без AUTOINCREMENT, поэтому id вычисляем сами
    max_id = conn.execute("SELECT COALESCE(MAX(id), 0) FROM objects").fetchone()[0]
    new_id = max_id + 1

    conn.execute("""
        INSERT INTO objects (
            id, name, type_id, district_id, lat, lon, year_built,
            capacity_m3s, wear_percent, age, tech_state_raw,
            risk_score, category, importance, next_inspection_date,
            source, is_verified
        ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    """, (new_id, name, type_id, district_id, lat, lon, year_built,
          capacity, wear, age, tech_state,
          risk, category, importance, next_insp,
          "manual", 0))
    conn.commit()
    conn.close()

    return {
        "id": new_id, "name": name, "lat": lat, "lon": lon,
        "risk_score": risk, "category": category,
        "next_inspection_date": next_insp, "is_verified": 0,
    }


def get_inspections(object_id: int) -> list:
    """Возвращает журнал осмотров объекта, новые сверху."""
    conn = get_db()
    rows = conn.execute("""
        SELECT id, object_id, inspect_date, inspector, state_found, notes
        FROM inspections
        WHERE object_id = ?
        ORDER BY inspect_date DESC, id DESC
    """, (object_id,)).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def add_inspection(object_id: int, payload: dict) -> dict:
    """
    Добавляет запись осмотра. Если указано новое состояние —
    обновляет tech_state_raw объекта и пересчитывает риск.
    """
    inspect_date = payload.get("inspect_date") or date.today().isoformat()
    inspector = payload.get("inspector") or "—"
    state_found = payload.get("state_found")
    notes = payload.get("notes") or ""

    conn = get_db()
    # Проверяем что объект существует
    obj = conn.execute("SELECT id FROM objects WHERE id = ?", (object_id,)).fetchone()
    if not obj:
        conn.close()
        return {"error": "Объект не найден"}

    cur = conn.execute("""
        INSERT INTO inspections (object_id, inspect_date, inspector, state_found, notes)
        VALUES (?,?,?,?,?)
    """, (object_id, inspect_date, inspector, state_found, notes))
    insp_id = cur.lastrowid

    # Обновляем last_inspection_date
    conn.execute("UPDATE objects SET last_inspection_date = ? WHERE id = ?",
                 (inspect_date, object_id))

    # Если осмотр выявил новое состояние — пересчитываем риск
    recalculated = None
    if state_found in ("удов.", "не удов."):
        full = dict(conn.execute("SELECT * FROM objects WHERE id = ?", (object_id,)).fetchone())
        full["tech_state_raw"] = state_found
        risk = compute_risk(full)
        category = risk_to_category(risk)
        importance = full.get("importance") or compute_importance(full)
        next_insp = compute_next_inspection(risk, importance, date.fromisoformat(inspect_date)).isoformat()

        conn.execute("""
            UPDATE objects
            SET tech_state_raw = ?, risk_score = ?, category = ?, next_inspection_date = ?
            WHERE id = ?
        """, (state_found, risk, category, next_insp, object_id))
        recalculated = {"risk_score": risk, "category": category, "next_inspection_date": next_insp}

    conn.commit()
    conn.close()

    return {
        "id": insp_id, "object_id": object_id,
        "inspect_date": inspect_date, "inspector": inspector,
        "state_found": state_found, "notes": notes,
        "recalculated": recalculated,
    }
