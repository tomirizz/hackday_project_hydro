import numpy as np
import pandas as pd
from datetime import date, timedelta

CURRENT_YEAR = 2026

# Веса факторов риска. tech_state — самый надёжный сигнал в датасете,
# поэтому он доминирует. КПД в данных зашумлён (у части аварийных объектов
# фактический КПД выше проектного), поэтому его вклад умеренный.
W_STATE = 0.45   # техническое состояние из паспорта
W_AGE   = 0.25   # возраст сооружения
W_WEAR  = 0.20   # процент износа (где есть)
W_KPD   = 0.10   # деградация КПД

AGE_FULL = 80    # возраст, при котором фактор возраста = максимум


def compute_risk(row: dict) -> float:
    """
    Risk-score 0..1. Взвешенная сумма факторов.
    Возвращает также объяснимость через compute_risk_factors().
    """
    factors = compute_risk_factors(row)
    return round(sum(factors.values()), 4)


def compute_risk_factors(row: dict) -> dict:
    """Раскладка риска по факторам — для объяснимости в карточке объекта."""
    out = {"state": 0.0, "age": 0.0, "wear": 0.0, "kpd": 0.0}

    state = str(row.get("tech_state_raw", "") or "").strip().lower()
    if state == "не удов.":
        out["state"] = W_STATE
    elif state == "удов.":
        out["state"] = W_STATE * 0.15  # удовл. — небольшой базовый риск

    age = row.get("age")
    if age is not None and not (isinstance(age, float) and np.isnan(age)):
        out["age"] = W_AGE * min(1.0, float(age) / AGE_FULL)

    wear = row.get("wear_percent")
    has_wear = wear is not None and not (isinstance(wear, float) and np.isnan(wear))
    if has_wear:
        out["wear"] = W_WEAR * min(1.0, float(wear))
    else:
        # нет данных об износе — переносим вес на возраст (косвенный прокси)
        if age is not None and not (isinstance(age, float) and np.isnan(age)):
            out["wear"] = W_WEAR * min(1.0, float(age) / AGE_FULL)

    drop = row.get("efficiency_drop")
    if drop is not None and not (isinstance(drop, float) and np.isnan(drop)):
        out["kpd"] = W_KPD * max(0.0, min(1.0, float(drop)))

    return {k: round(v, 4) for k, v in out.items()}


def risk_to_category(risk: float) -> str:
    if risk < 0.30:
        return "normal"
    elif risk < 0.50:
        return "watch"
    elif risk < 0.70:
        return "repair"
    else:
        return "critical"


def compute_importance(row: dict) -> float:
    """
    Значимость объекта: комбинация пропускной способности и обслуживаемой
    площади (лог-шкала, т.к. разброс на порядки). Нормировано к [0,1].
    """
    cap = row.get("capacity_m3s") or 0.0
    area = row.get("suspended_area_ha") or 0.0
    if (isinstance(cap, float) and np.isnan(cap)): cap = 0.0
    if (isinstance(area, float) and np.isnan(area)): area = 0.0

    raw = np.log1p(float(cap)) * 0.4 + np.log1p(float(area)) * 0.6
    max_val = np.log1p(45) * 0.4 + np.log1p(8212) * 0.6
    return round(min(1.0, raw / max_val), 4) if max_val > 0 else 0.0


def inspection_interval_days(risk: float, importance: float) -> int:
    """
    Интервал осмотра в днях. Базовые интервалы по категории риска,
    скорректированные на важность и сезон (паводок).

    Логика: аварийные объекты осматриваются часто (раз в 1-3 месяца),
    исправные — раз в 1-2 года.
    """
    # Базовый интервал по уровню риска
    if risk >= 0.70:
        base = 30      # аварийное — раз в месяц
    elif risk >= 0.50:
        base = 90      # ремонт — раз в квартал
    elif risk >= 0.30:
        base = 180     # наблюдение — раз в полгода
    else:
        base = 365     # исправное — раз в год

    # Важные объекты осматриваем чаще (до -40%)
    base = base * (1 - 0.4 * importance)

    # Сезонный коэффициент: паводок март-май требует более частых осмотров
    month = date.today().month
    if 3 <= month <= 5:
        base = base * 0.7

    return max(14, int(round(base)))


def compute_next_inspection(risk, importance, last_date=None):
    days = inspection_interval_days(risk, importance)
    start = last_date if last_date else date.today()
    return start + timedelta(days=days)


def compute_forecast_year(row: dict, risk: float):
    """
    Прогноз года перехода в аварийное состояние (risk >= 0.70).
    Модель: риск растёт за счёт старения. Оцениваем годовой прирост
    риска через текущий возраст и экстраполируем до порога.
    """
    if risk >= 0.70:
        return CURRENT_YEAR  # уже аварийное

    age = row.get("age")
    if age is None or (isinstance(age, float) and np.isnan(age)) or age <= 0:
        return None

    # Годовой прирост риска от старения (вклад возраста + износа делим на возраст)
    age_contribution = (W_AGE + W_WEAR) * min(1.0, float(age) / AGE_FULL)
    annual_growth = age_contribution / float(age)
    if annual_growth <= 0:
        return None

    years_left = (0.70 - risk) / annual_growth
    forecast = CURRENT_YEAR + int(round(years_left))
    return forecast if CURRENT_YEAR < forecast <= CURRENT_YEAR + 100 else None


def enrich_dataframe(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    recs = df.to_dict("records")

    df["risk_score"] = [compute_risk(r) for r in recs]
    df["category"]   = df["risk_score"].apply(risk_to_category)
    df["importance"] = [compute_importance(r) for r in recs]

    recs2 = df.to_dict("records")
    df["next_inspection_date"] = [
        compute_next_inspection(r["risk_score"], r["importance"]).isoformat()
        for r in recs2
    ]
    df["forecast_critical_year"] = [
        compute_forecast_year(r, r["risk_score"]) for r in recs2
    ]
    return df
