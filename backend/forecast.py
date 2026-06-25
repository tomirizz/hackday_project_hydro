import sqlite3
from backend.database import get_db
from backend.models import compute_risk, risk_to_category

CURRENT_YEAR = 2026
HORIZON = 25  # лет вперёд прогнозируем


def degradation_trajectory(object_id: int) -> dict:
    """
    Строит траекторию деградации объекта на HORIZON лет вперёд.

    Модель: КПД падает линейно по историческому темпу (efficiency_drop / age),
    износ растёт, риск пересчитывается на каждый год. Находим год, когда
    объект перейдёт в каждую следующую категорию состояния.
    """
    conn = get_db()
    row = conn.execute("""
        SELECT o.*, d.name AS district_name
        FROM objects o LEFT JOIN districts d ON o.district_id = d.id
        WHERE o.id = ?
    """, (object_id,)).fetchone()
    conn.close()

    if not row:
        return {"error": "Объект не найден"}

    o = dict(row)
    age = o.get("age") or 0
    eff_design = o.get("efficiency_design")
    eff_actual = o.get("efficiency_actual")
    wear = o.get("wear_percent")

    # Историч. темп падения КПД в год
    if eff_design and eff_actual and age and age > 0:
        kpd_rate = max(0.0, (eff_design - eff_actual) / age)
    else:
        kpd_rate = 0.003  # консервативная оценка по умолчанию

    # Темп роста износа в год (если износ известен)
    if wear and age and age > 0:
        wear_rate = wear / age
    else:
        wear_rate = 0.005

    trajectory = []
    transitions = {}
    prev_cat = o.get("category")
    cur_eff = eff_actual if eff_actual is not None else (eff_design or 0.6)
    cur_wear = wear if wear is not None else min(0.5, age * wear_rate)

    for i in range(0, HORIZON + 1):
        year = CURRENT_YEAR + i
        proj_age = age + i
        proj_eff = max(0.0, cur_eff - kpd_rate * i)
        proj_wear = min(1.5, cur_wear + wear_rate * i)
        if eff_design:
            proj_drop = eff_design - proj_eff
        else:
            proj_drop = proj_drop_fallback(proj_eff)

        sim = {
            "tech_state_raw": o.get("tech_state_raw"),
            "age": proj_age,
            "efficiency_drop": proj_drop,
            "wear_percent": proj_wear,
        }
        risk = compute_risk(sim)
        cat = risk_to_category(risk)

        trajectory.append({
            "year": year,
            "risk": round(risk, 3),
            "efficiency": round(proj_eff, 3),
            "wear": round(proj_wear, 3),
            "category": cat,
        })

        if cat != prev_cat and cat not in transitions.values():
            transitions[year] = cat
            prev_cat = cat

    # Год перехода в аварийное
    critical_year = next((t["year"] for t in trajectory if t["category"] == "critical"), None)

    return {
        "object_id": object_id,
        "name": o.get("name"),
        "current_category": o.get("category"),
        "current_risk": o.get("risk_score"),
        "kpd_rate_per_year": round(kpd_rate, 4),
        "critical_year": critical_year,
        "years_to_critical": (critical_year - CURRENT_YEAR) if critical_year else None,
        "trajectory": trajectory,
        "transitions": transitions,
    }


def proj_drop_fallback(eff):
    """Если нет проектного КПД, оцениваем падение от условной нормы 0.75."""
    return max(0.0, 0.75 - eff)


def region_forecast(years_ahead: int = 10) -> dict:
    """
    Прогноз по всему региону: сколько объектов перейдёт в аварийное
    состояние через N лет при текущих темпах деградации.
    """
    conn = get_db()
    rows = conn.execute("SELECT id FROM objects").fetchall()
    conn.close()

    will_become_critical = 0
    sample_ids = []
    for r in rows:
        traj = degradation_trajectory(r["id"])
        cy = traj.get("critical_year")
        if cy and CURRENT_YEAR < cy <= CURRENT_YEAR + years_ahead:
            will_become_critical += 1
            if len(sample_ids) < 10:
                sample_ids.append({"id": r["id"], "name": traj["name"], "year": cy})

    return {
        "horizon_years": years_ahead,
        "will_become_critical": will_become_critical,
        "examples": sample_ids,
    }
