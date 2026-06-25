import sqlite3
import os
import pandas as pd
from backend.models import enrich_dataframe

DB_PATH  = os.path.join(os.path.dirname(__file__), "..", "data", "database.db")
CSV_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "objects.csv")


def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    schema = os.path.join(os.path.dirname(__file__), "schema.sql")
    conn = get_db()
    with open(schema) as f:
        conn.executescript(f.read())

    # Справочники
    conn.execute("INSERT OR IGNORE INTO object_types (code, name) VALUES ('canal',        'Канал')")
    conn.execute("INSERT OR IGNORE INTO object_types (code, name) VALUES ('hydropost',    'Гидропост')")
    conn.execute("INSERT OR IGNORE INTO object_types (code, name) VALUES ('gate',         'Шлюз')")
    conn.execute("INSERT OR IGNORE INTO object_types (code, name) VALUES ('pump_station', 'Насосная станция')")
    conn.execute("INSERT OR IGNORE INTO object_types (code, name) VALUES ('dam',          'Плотина/дамба')")
    conn.execute("INSERT OR IGNORE INTO object_types (code, name) VALUES ('waterintake',  'Водозабор')")
    conn.commit()

    _load_csv(conn)
    conn.close()


def _load_csv(conn: sqlite3.Connection):
    if not os.path.exists(CSV_PATH):
        print(f"CSV не найден: {CSV_PATH}")
        return

    df = pd.read_csv(CSV_PATH)
    df = enrich_dataframe(df)

    # Подтягиваем type_id
    type_map = dict(conn.execute("SELECT code, id FROM object_types").fetchall())
    df["type_id"] = df["type_code"].map(type_map)

    # Вставляем районы
    for name in df["district_name"].dropna().unique():
        conn.execute("INSERT OR IGNORE INTO districts (name) VALUES (?)", (name,))
    conn.commit()
    district_map = dict(conn.execute("SELECT name, id FROM districts").fetchall())
    df["district_id"] = df["district_name"].map(district_map)

    cols = [
        "id", "external_no", "name", "type_id", "district_id", "rural_okrug",
        "lat", "lon", "year_built", "water_source", "capacity_m3s",
        "length_total_km", "length_earth_km", "length_lined_km",
        "suspended_area_ha", "efficiency_design", "efficiency_actual",
        "efficiency_drop", "wear_percent", "age", "tech_state_raw",
        "cadastral_no", "state_act",
        "risk_score", "category", "importance",
        "next_inspection_date", "forecast_critical_year",
    ]
    df = df[[c for c in cols if c in df.columns]]
    df.to_sql("objects", conn, if_exists="replace", index=False)

    # Добавляем демо-объекты других типов (шлюзы, плотины, насосные, гидропосты)
    _add_demo_objects(conn, start_id=len(df) + 1)

    print(f"Загружено {len(df)} объектов в БД")


def _add_demo_objects(conn: sqlite3.Connection, start_id: int):
    """
    Добавляет несколько демонстрационных объектов разных типов.
    В датасете Казводхоз только каналы, но система поддерживает все типы ГТС.
    Эти объекты показывают мультитиповость на карте и в фильтрах.
    """
    import numpy as np
    from backend.models import (compute_risk, risk_to_category, compute_importance,
                                 compute_next_inspection)

    type_map = dict(conn.execute("SELECT code, id FROM object_types").fetchall())

    # Демо-объекты: (тип, имя, год, состояние, capacity, площадь, износ)
    demo = [
        ("gate",         "Тасөткель шлюз",          1985, "удов.",    12.0, 0,    0.25),
        ("gate",         "Шлюз Каратальский",        1972, "не удов.", 8.5,  0,    0.55),
        ("dam",          "Тасоткельская плотина",    1968, "не удов.", 0,    0,    0.62),
        ("dam",          "Терс-Ащибулакская дамба",  1978, "удов.",    0,    0,    0.30),
        ("pump_station", "Насосная станция №1",      1990, "удов.",    25.0, 1500, 0.20),
        ("pump_station", "Насосная станция Мерке",   1965, "не удов.", 15.0, 800,  0.58),
        ("waterintake",  "Водозабор Талас",          1980, "удов.",    18.0, 0,    0.28),
        ("waterintake",  "Головной водозабор Аса",   1955, "не удов.", 22.0, 0,    0.60),
        ("hydropost",    "Гидропост Тараз-1",        2010, "удов.",    0,    0,    0.10),
        ("hydropost",    "Гидропост Шу-Восточный",   2015, "удов.",    0,    0,    0.08),
        ("hydropost",    "Гидропост Каратау",        2008, "удов.",    0,    0,    0.12),
    ]

    rows = []
    for i, (tcode, name, year, state, cap, area, wear) in enumerate(demo):
        uid = start_id + i
        rng = np.random.default_rng(uid + 777)
        lat = round(rng.uniform(42.5, 45.0), 6)
        lon = round(rng.uniform(69.5, 74.5), 6)
        age = 2026 - year

        rec = {
            "tech_state_raw": state, "age": age,
            "efficiency_drop": 0.0, "wear_percent": wear,
            "capacity_m3s": cap, "suspended_area_ha": area,
        }
        risk = compute_risk(rec)
        cat = risk_to_category(risk)
        imp = compute_importance(rec)
        next_insp = compute_next_inspection(risk, imp).isoformat()

        rows.append((
            uid, None, name, type_map.get(tcode), None, None,
            lat, lon, year, None, cap if cap else None,
            None, None, None, area if area else None, None, None,
            0.0, wear, age, state, None, None,
            risk, cat, imp, next_insp, None,
        ))

    conn.executemany("""
        INSERT INTO objects (
            id, external_no, name, type_id, district_id, rural_okrug,
            lat, lon, year_built, water_source, capacity_m3s,
            length_total_km, length_earth_km, length_lined_km,
            suspended_area_ha, efficiency_design, efficiency_actual,
            efficiency_drop, wear_percent, age, tech_state_raw,
            cadastral_no, state_act,
            risk_score, category, importance,
            next_inspection_date, forecast_critical_year
        ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    """, rows)
    conn.commit()
    print(f"Добавлено {len(rows)} демо-объектов других типов")
