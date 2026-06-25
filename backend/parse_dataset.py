import os
import pandas as pd
import numpy as np

# Ищем файл рядом со скриптом или в стандартных местах
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, "..", "data")

SRC_XLSX = os.path.join(DATA_DIR, "датасет.xlsx")
if not os.path.exists(SRC_XLSX):
    SRC_XLSX = "/tmp/data.xlsx"  # fallback для локальной разработки

OUT_CSV = os.path.join(DATA_DIR, "objects.csv")

ZHAMBYL_LAT_MIN, ZHAMBYL_LAT_MAX = 42.5, 45.0
ZHAMBYL_LON_MIN, ZHAMBYL_LON_MAX = 69.5, 74.5
CURRENT_YEAR = 2026

df = pd.read_excel(SRC_XLSX, sheet_name="каналы", header=None)
data = df.iloc[7:].reset_index(drop=True)

# Маппим позиции колонок согласно заголовкам таблицы
colmap = {
    0:  "external_no", 1: "year_built", 2: "water_source", 3: "capacity_m3s",
    4:  "length_total_km", 5: "length_earth_km", 6: "length_lined_km",
    11: "suspended_area_ha", 14: "efficiency_design", 15: "efficiency_actual",
    16: "district_name", 17: "rural_okrug", 18: "wear_percent",
    19: "tech_state_raw", 20: "cadastral_no", 21: "state_act",
}
data = data[list(colmap.keys())].rename(columns=colmap)

data = data[data["external_no"].notna()].copy()
data["external_no"] = pd.to_numeric(data["external_no"], errors="coerce")
data = data[data["external_no"].notna()].copy()

# Битые строки — нет ни района, ни состояния
junk_mask = data["district_name"].isna() & data["tech_state_raw"].isna()
data = data[~junk_mask].copy()

# № не уникален: нумерация идёт по филиалам, дедуп по совпадению ключевых полей
dedup_keys = ["external_no", "district_name", "year_built", "length_total_km"]
data = data.drop_duplicates(subset=dedup_keys, keep="first").copy()
data = data.reset_index(drop=True)
data.insert(0, "id", range(1, len(data) + 1))

numeric_cols = ["year_built", "capacity_m3s", "length_total_km", "length_earth_km",
                "length_lined_km", "suspended_area_ha", "efficiency_design",
                "efficiency_actual", "wear_percent"]
for c in numeric_cols:
    data[c] = pd.to_numeric(data[c], errors="coerce")

text_cols = ["water_source", "district_name", "rural_okrug",
             "tech_state_raw", "cadastral_no", "state_act"]
for c in text_cols:
    data[c] = data[c].astype(str).str.strip().replace({"nan": np.nan, "None": np.nan})

data["tech_state_raw"] = data["tech_state_raw"].str.lower().str.strip()

data["age"] = CURRENT_YEAR - data["year_built"]
data["efficiency_drop"] = data["efficiency_design"] - data["efficiency_actual"]

# Все объекты из этого датасета — каналы.
# Гидропосты загружаются отдельным скриптом (parse_hydroposts.py)
data["type_code"] = "canal"
data["type_name"] = "Канал"

# Координаты из датасета отсутствуют, генерируем детерминированно по id
def geo_for(uid):
    rng = np.random.default_rng(int(uid) + 777)
    lat = rng.uniform(ZHAMBYL_LAT_MIN, ZHAMBYL_LAT_MAX)
    lon = rng.uniform(ZHAMBYL_LON_MIN, ZHAMBYL_LON_MAX)
    return round(lat, 6), round(lon, 6)

geos = data["id"].apply(geo_for)
data["lat"] = geos.apply(lambda t: t[0])
data["lon"] = geos.apply(lambda t: t[1])

data["name"] = (
    "Канал №" + data["external_no"].astype("Int64").astype(str)
    + " (" + data["district_name"].fillna("б/р") + ")"
)

final_cols = [
    "id", "external_no", "name", "type_code", "type_name",
    "district_name", "rural_okrug", "lat", "lon",
    "year_built", "water_source", "capacity_m3s",
    "length_total_km", "length_earth_km", "length_lined_km",
    "suspended_area_ha", "efficiency_design", "efficiency_actual",
    "efficiency_drop", "wear_percent", "age",
    "tech_state_raw", "cadastral_no", "state_act",
]
data = data[final_cols].sort_values("id").reset_index(drop=True)
data.to_csv(OUT_CSV, index=False, encoding="utf-8-sig")

print(f"Каналов: {len(data)}")
print(f"Районов: {data['district_name'].nunique()}")
print(f"удов.: {(data['tech_state_raw'] == 'удов.').sum()}, "
      f"не удов.: {(data['tech_state_raw'] == 'не удов.').sum()}")
print(f"Среднее падение КПД: {data['efficiency_drop'].mean():.3f}")
