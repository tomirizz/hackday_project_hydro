import React from "react";
import { categoryColor, categoryLabel } from "../constants";
import { X } from "lucide-react";
import ForecastChart from "./ForecastChart";

const row = (label, value, unit = "") => {
  if (value === null || value === undefined || value === "" || (typeof value === "number" && isNaN(value)))
    return null;
  return (
    <div style={{
      display: "flex", justifyContent: "space-between",
      padding: "8px 0", borderBottom: "1px solid var(--border)", fontSize: 13,
    }}>
      <span style={{ color: "var(--text-dim)" }}>{label}</span>
      <span className="mono" style={{ textAlign: "right" }}>
        {value}{unit && ` ${unit}`}
      </span>
    </div>
  );
};

export default function ObjectCard({ object, onClose }) {
  if (!object) return null;
  const o = object;
  const color = categoryColor(o.category);

  return (
    <div style={{
      height: "100%", overflowY: "auto",
      background: "var(--panel)", borderLeft: "1px solid var(--border)",
    }}>
      <div style={{
        padding: "16px 20px", borderBottom: "1px solid var(--border)",
        display: "flex", justifyContent: "space-between", alignItems: "flex-start",
        position: "sticky", top: 0, background: "var(--panel)", zIndex: 2,
      }}>
        <div>
          <h2 style={{ fontSize: 16, fontWeight: 600 }}>{o.name}</h2>
          <div style={{ marginTop: 6, display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 10, height: 10, borderRadius: "50%", background: color }} />
            <span style={{ fontSize: 13, color }}>{categoryLabel(o.category)}</span>
          </div>
        </div>
        <button onClick={onClose} style={{
          background: "transparent", border: "none", color: "var(--text-dim)", padding: 4,
        }}>
          <X size={18} />
        </button>
      </div>

      {/* Risk-индикатор */}
      <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)" }}>
        <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em",
                      color: "var(--text-dim)", marginBottom: 8 }}>
          Индекс риска
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ flex: 1, height: 8, background: "var(--panel-2)", borderRadius: 4, overflow: "hidden" }}>
            <div style={{ width: `${o.risk_score * 100}%`, height: "100%", background: color }} />
          </div>
          <span className="mono" style={{ fontSize: 15, fontWeight: 600 }}>
            {(o.risk_score * 100).toFixed(0)}%
          </span>
        </div>

        {/* Разбивка риска по факторам */}
        {o.risk_factors && (
          <div style={{ marginTop: 12 }}>
            {[
              ["Тех. состояние", o.risk_factors.state, 0.45],
              ["Возраст", o.risk_factors.age, 0.25],
              ["Износ", o.risk_factors.wear, 0.20],
              ["Деградация КПД", o.risk_factors.kpd, 0.10],
            ].map(([label, val, max]) => (
              <div key={label} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}>
                <span style={{ fontSize: 11, color: "var(--text-dim)", width: 110, flexShrink: 0 }}>{label}</span>
                <div style={{ flex: 1, height: 4, background: "var(--panel-2)", borderRadius: 2, overflow: "hidden" }}>
                  <div style={{ width: `${(val / max) * 100}%`, height: "100%", background: "var(--accent)" }} />
                </div>
                <span className="mono" style={{ fontSize: 10, color: "var(--text-dim)", width: 32, textAlign: "right" }}>
                  {(val * 100).toFixed(0)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Характеристики */}
      <div style={{ padding: "8px 20px" }}>
        {row("Тип", o.type_name)}
        {row("Район", o.district_name)}
        {row("Сельский округ", o.rural_okrug)}
        {row("Координаты", `${o.lat?.toFixed(4)}, ${o.lon?.toFixed(4)}`)}
        {row("Год постройки", o.year_built)}
        {row("Возраст", o.age, "лет")}
        {row("Водоисточник", o.water_source)}
        {row("Пропускная способность", o.capacity_m3s, "м³/с")}
        {row("Протяжённость", o.length_total_km, "км")}
        {row("— земляная", o.length_earth_km, "км")}
        {row("— облицованная", o.length_lined_km, "км")}
        {row("Подвешенная площадь", o.suspended_area_ha, "га")}
        {row("КПД проектный", o.efficiency_design)}
        {row("КПД фактический", o.efficiency_actual)}
        {row("Падение КПД", o.efficiency_drop?.toFixed(3))}
        {row("Износ", o.wear_percent ? `${(o.wear_percent * 100).toFixed(0)}%` : null)}
        {row("Тех. состояние", o.tech_state_raw)}
        {row("Кадастровый №", o.cadastral_no)}
        {row("Госакт", o.state_act)}
      </div>

      {/* Прогноз и осмотр */}
      <div style={{ padding: "16px 20px", borderTop: "1px solid var(--border)" }}>
        <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em",
                      color: "var(--text-dim)", marginBottom: 10 }}>
          Эксплуатация
        </div>
        {row("Следующий осмотр", o.next_inspection_date)}
      </div>

      {/* Прогноз деградации */}
      <div style={{ padding: "16px 20px", borderTop: "1px solid var(--border)" }}>
        <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em",
                      color: "var(--text-dim)", marginBottom: 10 }}>
          Прогноз деградации
        </div>
        <ForecastChart objectId={o.id} />
      </div>
    </div>
  );
}
