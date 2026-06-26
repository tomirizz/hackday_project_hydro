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

    # Разнообразие типов: часть объектов переназначаем в другие типы ГТС
    # (детерминированно по external_no, чтобы было стабильно между запусками).
    # В реальном датасете Казводхоз только каналы, но в систему интегрируются
    # все типы гидросооружений — показываем это разнообразие на карте.
    import numpy as _np
    _other_types = [
        ("dam", "Плотина/дамба", "Плотина"),
        ("gate", "Шлюз", "Шлюз"),
        ("pump_station", "Насосная станция", "Насосная станция"),
        ("waterintake", "Водозабор", "Водозабор"),
        ("hydropost", "Гидропост", "Гидропост"),
    ]
    for idx, row in df.iterrows():
        rng = _np.random.default_rng(int(row["external_no"]) + 999)
        roll = rng.random()
        if roll < 0.15:  # ~15% объектов — другой тип
            pick = _other_types[int(rng.integers(0, len(_other_types)))]
            code, type_name, name_prefix = pick
            df.at[idx, "type_id"] = type_map.get(code)
            df.at[idx, "type_code"] = code
            df.at[idx, "type_name"] = type_name
            df.at[idx, "name"] = f"{name_prefix} №{int(row['external_no'])}"

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

    # to_sql пересоздаёт таблицу по колонкам CSV, теряя служебные поля из schema.
    # Добавляем их обратно через ALTER TABLE.
    existing = [r[1] for r in conn.execute("PRAGMA table_info(objects)").fetchall()]
    if "source" not in existing:
        conn.execute("ALTER TABLE objects ADD COLUMN source TEXT DEFAULT 'kazvodkhoz_2026'")
    if "is_verified" not in existing:
        conn.execute("ALTER TABLE objects ADD COLUMN is_verified INTEGER DEFAULT 1")
    if "last_inspection_date" not in existing:
        conn.execute("ALTER TABLE objects ADD COLUMN last_inspection_date DATE")
    conn.commit()

    # Добавляем демо-объекты других типов (шлюзы, плотины, насосные, гидропосты)
    _add_demo_objects(conn, start_id=len(df) + 1)

    # Реалистичная имитация: часть аварийных объектов давно не осматривалась,
    # их плановая дата осмотра уже в прошлом (просрочена). Это показывает
    # практическую ценность системы — она выявляет забытые объекты.
    _simulate_overdue(conn)

    # Демо-фотографии с готовым Vision-анализом (для демонстрации)
    _add_demo_photos(conn)

    print(f"Загружено {len(df)} объектов в БД")


def _simulate_overdue(conn: sqlite3.Connection):
    """
    Сдвигает дату осмотра в прошлое для части критических/ремонтных объектов.
    В реальной эксплуатации именно у самых проблемных объектов чаще всего
    пропущены сроки осмотра — система это подсвечивает.
    """
    from datetime import date, timedelta
    import numpy as np

    today = date.today()
    # Берём аварийные и ремонтные объекты с худшим риском
    rows = conn.execute("""
        SELECT id, risk_score FROM objects
        WHERE category IN ('critical', 'repair')
        ORDER BY risk_score DESC
    """).fetchall()

    # Делаем просроченными ~60% худших объектов из этой выборки
    n_overdue = int(len(rows) * 0.6)
    for r in rows[:n_overdue]:
        rng = np.random.default_rng(int(r["id"]) + 555)
        days_ago = int(rng.integers(5, 180))  # просрочка от 5 дней до полугода
        overdue_date = (today - timedelta(days=days_ago)).isoformat()
        conn.execute("UPDATE objects SET next_inspection_date = ? WHERE id = ?",
                     (overdue_date, r["id"]))
    conn.commit()
    print(f"Имитировано просроченных осмотров: {n_overdue}")


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


def _add_demo_photos(conn: sqlite3.Connection):
    """
    Создаёт несколько демо-фотографий гидросооружений (схематичные SVG)
    с готовым результатом Claude Vision анализа. Это для демонстрации —
    чтобы на защите фото уже были в системе, без обращения к API.
    Реальные фото инспектор загружает через интерфейс.
    """
    import os, json

    photos_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "photos")
    os.makedirs(photos_dir, exist_ok=True)

    def svg_canal(bad):
        # Реалистичный канал в казахстанской степи: небо, степь, бетонная облицовка, вода
        water_top = "#7a8a6f" if bad else "#4a90b8"
        water_bot = "#5a6a55" if bad else "#2d6a8f"
        defects = ""
        if bad:
            defects = (
                '<path d="M 90 235 Q 110 255 105 285 M 230 232 Q 255 258 245 290 M 380 238 Q 405 262 400 292" '
                'stroke="#3a3228" stroke-width="2.5" fill="none" opacity="0.7"/>'
                '<ellipse cx="160" cy="300" rx="45" ry="10" fill="#5a4a38" opacity="0.4"/>'
                '<ellipse cx="340" cy="310" rx="55" ry="12" fill="#5a4a38" opacity="0.35"/>')
        return (
            '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="420" viewBox="0 0 640 420">'
            '<defs>'
            '<linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">'
            '<stop offset="0" stop-color="#aed4ec"/><stop offset="1" stop-color="#e8f0e0"/></linearGradient>'
            '<linearGradient id="steppe" x1="0" y1="0" x2="0" y2="1">'
            '<stop offset="0" stop-color="#cdb86f"/><stop offset="1" stop-color="#a89850"/></linearGradient>'
            f'<linearGradient id="wtr" x1="0" y1="0" x2="0" y2="1">'
            f'<stop offset="0" stop-color="{water_top}"/><stop offset="1" stop-color="{water_bot}"/></linearGradient>'
            '<linearGradient id="conc" x1="0" y1="0" x2="0" y2="1">'
            '<stop offset="0" stop-color="#cfc8bd"/><stop offset="1" stop-color="#a39a8c"/></linearGradient>'
            '</defs>'
            '<rect width="640" height="420" fill="url(#sky)"/>'
            # дальние горы
            '<polygon points="0,150 120,110 240,145 380,105 520,150 640,120 640,170 0,170" fill="#b8c4c0" opacity="0.5"/>'
            # степь
            '<rect y="160" width="640" height="120" fill="url(#steppe)"/>'
            # бетонные откосы канала
            '<polygon points="0,170 640,170 640,250 0,250" fill="url(#conc)"/>'
            '<polygon points="80,170 560,170 470,250 170,250" fill="url(#wtr)"/>'
            # блики на воде
            '<ellipse cx="320" cy="205" rx="170" ry="9" fill="#ffffff" opacity="0.18"/>'
            '<ellipse cx="260" cy="220" rx="90" ry="5" fill="#ffffff" opacity="0.12"/>'
            # нижний откос/дно
            '<polygon points="170,250 470,250 430,320 210,320" fill="url(#conc)"/>'
            '<rect y="320" width="640" height="100" fill="#8a7a60"/>'
            # стыки плит облицовки
            '<line x1="240" y1="170" x2="285" y2="250" stroke="#8a8275" stroke-width="1.5" opacity="0.5"/>'
            '<line x1="400" y1="170" x2="355" y2="250" stroke="#8a8275" stroke-width="1.5" opacity="0.5"/>'
            f'{defects}</svg>')

    def svg_dam(bad):
        defects = ""
        if bad:
            defects = (
                '<path d="M 210 150 Q 218 240 225 330 M 330 145 Q 322 240 318 335" '
                'stroke="#3a3a3a" stroke-width="2.5" fill="none" opacity="0.65"/>'
                '<path d="M 270 200 Q 285 230 275 270" stroke="#2a4a5a" stroke-width="4" '
                'fill="none" opacity="0.4"/>')  # фильтрация
        return (
            '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="420" viewBox="0 0 640 420">'
            '<defs>'
            '<linearGradient id="sky2" x1="0" y1="0" x2="0" y2="1">'
            '<stop offset="0" stop-color="#9cc7e4"/><stop offset="1" stop-color="#d4e6ea"/></linearGradient>'
            '<linearGradient id="res" x1="0" y1="0" x2="0" y2="1">'
            '<stop offset="0" stop-color="#3d7ea0"/><stop offset="1" stop-color="#2a5d7a"/></linearGradient>'
            '<linearGradient id="body" x1="0" y1="0" x2="0" y2="1">'
            '<stop offset="0" stop-color="#b0ada6"/><stop offset="1" stop-color="#807c73"/></linearGradient>'
            '</defs>'
            '<rect width="640" height="420" fill="url(#sky2)"/>'
            '<polygon points="0,130 160,95 320,130 480,90 640,125 640,160 0,160" fill="#aebcc4" opacity="0.5"/>'
            # водохранилище сверху
            '<rect y="150" width="640" height="80" fill="url(#res)"/>'
            '<ellipse cx="320" cy="175" rx="240" ry="10" fill="#ffffff" opacity="0.15"/>'
            # тело плотины
            '<polygon points="0,230 640,230 580,420 60,420" fill="url(#body)"/>'
            '<polygon points="0,230 640,230 615,260 25,260" fill="#c4c0b8"/>'
            # водосбросы
            '<rect x="150" y="230" width="36" height="190" fill="#6e6a62"/>'
            '<rect x="300" y="230" width="36" height="190" fill="#6e6a62"/>'
            '<rect x="450" y="230" width="36" height="190" fill="#6e6a62"/>'
            # гребень с ограждением
            '<rect x="20" y="248" width="600" height="8" fill="#5a564e"/>'
            f'{defects}</svg>')

    def svg_gate():
        return (
            '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="420" viewBox="0 0 640 420">'
            '<defs>'
            '<linearGradient id="sky3" x1="0" y1="0" x2="0" y2="1">'
            '<stop offset="0" stop-color="#a8cfe6"/><stop offset="1" stop-color="#dce8e2"/></linearGradient>'
            '<linearGradient id="wtr3" x1="0" y1="0" x2="0" y2="1">'
            '<stop offset="0" stop-color="#4a90b0"/><stop offset="1" stop-color="#2d6585"/></linearGradient>'
            '<linearGradient id="metal" x1="0" y1="0" x2="1" y2="0">'
            '<stop offset="0" stop-color="#9a9690"/><stop offset="0.5" stop-color="#bdb8b0"/>'
            '<stop offset="1" stop-color="#8a857d"/></linearGradient>'
            '</defs>'
            '<rect width="640" height="420" fill="url(#sky3)"/>'
            '<rect y="150" width="640" height="100" fill="url(#wtr3)"/>'
            '<rect y="250" width="640" height="170" fill="#7a8a7a"/>'
            # бетонные устои
            '<rect x="60" y="90" width="60" height="280" fill="#b0a89c"/>'
            '<rect x="520" y="90" width="60" height="280" fill="#b0a89c"/>'
            '<rect x="300" y="110" width="50" height="260" fill="#a89e90"/>'
            # металлические затворы
            '<rect x="120" y="120" width="180" height="200" fill="url(#metal)"/>'
            '<rect x="350" y="120" width="170" height="200" fill="url(#metal)"/>'
            # рёбра затворов + следы коррозии
            '<line x1="120" y1="160" x2="300" y2="160" stroke="#6a655c" stroke-width="3"/>'
            '<line x1="120" y1="210" x2="300" y2="210" stroke="#6a655c" stroke-width="3"/>'
            '<line x1="120" y1="260" x2="300" y2="260" stroke="#6a655c" stroke-width="3"/>'
            '<line x1="350" y1="160" x2="520" y2="160" stroke="#6a655c" stroke-width="3"/>'
            '<line x1="350" y1="210" x2="520" y2="210" stroke="#6a655c" stroke-width="3"/>'
            '<line x1="350" y1="260" x2="520" y2="260" stroke="#6a655c" stroke-width="3"/>'
            '<ellipse cx="200" cy="240" rx="22" ry="14" fill="#8a5a3a" opacity="0.45"/>'  # ржавчина
            '<ellipse cx="440" cy="190" rx="18" ry="11" fill="#8a5a3a" opacity="0.4"/>'
            # мостик-переход поверху
            '<rect x="40" y="95" width="560" height="16" fill="#5a564e"/></svg>')

    # Спецификации: (категория, OFFSET, генератор, vision-результат)
    specs = [
        ("critical", 0, lambda: svg_canal(True), {
            "object_type": "канал", "condition": "аварийное",
            "defects": ["трещины в облицовке", "эрозия откосов", "разрушение бетона"],
            "confidence": 0.91,
            "description": "Канал в аварийном состоянии: значительные трещины облицовки и размыв откосов."}),
        ("repair", 0, lambda: svg_canal(True), {
            "object_type": "канал", "condition": "требует ремонта",
            "defects": ["частичное разрушение облицовки", "заиление русла"],
            "confidence": 0.84,
            "description": "Канал требует ремонта: повреждение облицовки и заиление русла."}),
        ("normal", 0, lambda: svg_canal(False), {
            "object_type": "канал", "condition": "удовлетворительное",
            "defects": [],
            "confidence": 0.88,
            "description": "Канал в удовлетворительном состоянии: облицовка целая, русло чистое."}),
    ]

    # Отдельно: фото плотины и шлюза — привязываем к реальным объектам этих типов
    dam_obj = conn.execute("""
        SELECT o.id FROM objects o JOIN object_types ot ON o.type_id=ot.id
        WHERE ot.code='dam' ORDER BY o.risk_score DESC LIMIT 1
    """).fetchone()
    gate_obj = conn.execute("""
        SELECT o.id FROM objects o JOIN object_types ot ON o.type_id=ot.id
        WHERE ot.code='gate' ORDER BY o.risk_score DESC LIMIT 1
    """).fetchone()

    typed_specs = []
    if dam_obj:
        typed_specs.append((dam_obj["id"], lambda: svg_dam(True), {
            "object_type": "плотина", "condition": "аварийное",
            "defects": ["вертикальные трещины тела плотины", "фильтрация"],
            "confidence": 0.87,
            "description": "Плотина с опасными трещинами и признаками фильтрации, требует срочного вмешательства."}))
    if gate_obj:
        typed_specs.append((gate_obj["id"], lambda: svg_gate(), {
            "object_type": "шлюз", "condition": "требует наблюдения",
            "defects": ["коррозия затворов"],
            "confidence": 0.79,
            "description": "Шлюз работоспособен, но затворы имеют следы коррозии — рекомендуется наблюдение."}))

    added = 0
    used_ids = set()

    # Фото по категории (каналы) — только для объектов типа "канал"
    for cat, offset, gen, vision in specs:
        obj = conn.execute("""
            SELECT o.id FROM objects o JOIN object_types ot ON o.type_id=ot.id
            WHERE o.category = ? AND ot.code='canal'
            ORDER BY o.risk_score DESC LIMIT 1 OFFSET ?
        """, (cat, offset)).fetchone()
        if not obj or obj["id"] in used_ids:
            continue
        oid = obj["id"]
        used_ids.add(oid)
        fname = f"demo_obj{oid}.svg"
        with open(os.path.join(photos_dir, fname), "w", encoding="utf-8") as f:
            f.write(gen())
        conn.execute("""
            INSERT INTO photos (object_id, filename, vision_type, vision_state,
                                vision_defects, vision_confidence, vision_description)
            VALUES (?,?,?,?,?,?,?)
        """, (oid, fname, vision["object_type"], vision["condition"],
              json.dumps(vision["defects"], ensure_ascii=False),
              vision["confidence"], vision["description"]))
        added += 1

    # Фото по конкретному объекту (плотина, шлюз)
    for oid, gen, vision in typed_specs:
        if oid in used_ids:
            continue
        used_ids.add(oid)
        fname = f"demo_obj{oid}.svg"
        with open(os.path.join(photos_dir, fname), "w", encoding="utf-8") as f:
            f.write(gen())
        conn.execute("""
            INSERT INTO photos (object_id, filename, vision_type, vision_state,
                                vision_defects, vision_confidence, vision_description)
            VALUES (?,?,?,?,?,?,?)
        """, (oid, fname, vision["object_type"], vision["condition"],
              json.dumps(vision["defects"], ensure_ascii=False),
              vision["confidence"], vision["description"]))
        added += 1

    conn.commit()
    print(f"Добавлено демо-фотографий: {added}")
