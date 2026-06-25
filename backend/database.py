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
    print(f"Загружено {len(df)} объектов в БД")
