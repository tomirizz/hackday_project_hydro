-- Цифровой каталог гидротехнических сооружений Жамбылской области

CREATE TABLE districts (
    id          INTEGER PRIMARY KEY,
    name        TEXT NOT NULL UNIQUE,
    center_lat  REAL,
    center_lon  REAL
);

-- Типы объектов: canal, hydropost, gate, pump_station, dam, waterintake, ...
CREATE TABLE object_types (
    id   INTEGER PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL
);

CREATE TABLE objects (
    id                   INTEGER PRIMARY KEY,
    external_no          INTEGER,
    name                 TEXT,
    type_id              INTEGER REFERENCES object_types(id),
    district_id          INTEGER REFERENCES districts(id),
    rural_okrug          TEXT,

    lat                  REAL NOT NULL,
    lon                  REAL NOT NULL,

    -- Общие технические поля (каналы и ГТС)
    year_built           INTEGER,
    water_source         TEXT,
    capacity_m3s         REAL,
    length_total_km      REAL,
    length_earth_km      REAL,
    length_lined_km      REAL,
    suspended_area_ha    REAL,
    efficiency_design    REAL,
    efficiency_actual    REAL,
    wear_percent         REAL,
    cadastral_no         TEXT,
    state_act            TEXT,
    tech_state_raw       TEXT,

    -- Поля гидропостов (NULL для других типов)
    water_depth_m        REAL,
    water_speed_ms       REAL,
    water_flow_m3s       REAL,
    water_temp_c         REAL,
    sensor_model         TEXT,
    last_reading_at      TIMESTAMP,

    -- Вычисляемые поля (заполняются моделями)
    age                  INTEGER,
    efficiency_drop      REAL,
    risk_score           REAL,
    category             TEXT,    -- normal / watch / repair / critical
    importance           REAL,
    last_inspection_date DATE,
    next_inspection_date DATE,
    forecast_critical_year INTEGER,

    source               TEXT DEFAULT 'kazvodkhoz_2026',
    is_verified          INTEGER DEFAULT 1,
    created_at           TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at           TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_objects_district ON objects(district_id);
CREATE INDEX idx_objects_type     ON objects(type_id);
CREATE INDEX idx_objects_category ON objects(category);
CREATE INDEX idx_objects_geo      ON objects(lat, lon);
CREATE INDEX idx_objects_year     ON objects(year_built);

CREATE TABLE inspections (
    id           INTEGER PRIMARY KEY,
    object_id    INTEGER REFERENCES objects(id),
    inspect_date DATE NOT NULL,
    inspector    TEXT,
    state_found  TEXT,
    notes        TEXT
);
