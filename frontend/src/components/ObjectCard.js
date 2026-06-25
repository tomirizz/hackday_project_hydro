import React from "react";
import { categoryColor } from "../constants";
import { X } from "lucide-react";
import { useApp, catLabel, typeLabel } from "../AppContext";
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
  const { t } = useApp();
  if (!object) return null;
  const o = object;
  const color = categoryColor(o.category);

  // Тип объекта переводим по коду, если есть
  const typeName = o.type_code ? typeLabel(t, o.type_code) : o.type_name;

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
            <span style={{ fontSize: 13, color }}>{catLabel(t, o.category)}</span>
          </div>
        </div>
        <button onClick={onClose} style={{
          background: "transparent", border: "none", color: "var(--text-dim)", padding: 4, cursor: "pointer",
        }}>
          <X size={18} />
        </button>
      </div>

      <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)" }}>
        <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em",
                      color: "var(--text-dim)", marginBottom: 8 }}>
          {t("riskIndex")}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ flex: 1, height: 8, background: "var(--panel-2)", borderRadius: 4, overflow: "hidden" }}>
            <div style={{ width: `${o.risk_score * 100}%`, height: "100%", background: color }} />
          </div>
          <span className="mono" style={{ fontSize: 15, fontWeight: 600 }}>
            {(o.risk_score * 100).toFixed(0)}%
          </span>
        </div>

        {o.risk_factors && (
          <div style={{ marginTop: 12 }}>
            {[
              [t("riskFactorState"), o.risk_factors.state, 0.45],
              [t("riskFactorAge"), o.risk_factors.age, 0.25],
              [t("riskFactorWear"), o.risk_factors.wear, 0.20],
              [t("riskFactorKpd"), o.risk_factors.kpd, 0.10],
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

      <div style={{ padding: "8px 20px" }}>
        {row(t("cardType"), typeName)}
        {row(t("cardDistrict"), o.district_name)}
        {row(t("cardRuralOkrug"), o.rural_okrug)}
        {row(t("cardCoords"), `${o.lat?.toFixed(4)}, ${o.lon?.toFixed(4)}`)}
        {row(t("cardYearBuilt"), o.year_built)}
        {row(t("cardAge"), o.age, t("cardAgeYears"))}
        {row(t("cardWaterSource"), o.water_source)}
        {row(t("cardCapacity"), o.capacity_m3s, "м³/с")}
        {row(t("cardLength"), o.length_total_km, "км")}
        {row(t("cardLengthEarth"), o.length_earth_km, "км")}
        {row(t("cardLengthLined"), o.length_lined_km, "км")}
        {row(t("cardArea"), o.suspended_area_ha, "га")}
        {row(t("cardKpdDesign"), o.efficiency_design)}
        {row(t("cardKpdActual"), o.efficiency_actual)}
        {row(t("cardKpdDrop"), o.efficiency_drop?.toFixed(3))}
        {row(t("cardWear"), o.wear_percent ? `${(o.wear_percent * 100).toFixed(0)}%` : null)}
        {row(t("cardTechState"), o.tech_state_raw)}
        {row(t("cardCadastral"), o.cadastral_no)}
        {row(t("cardStateAct"), o.state_act)}
      </div>

      <div style={{ padding: "16px 20px", borderTop: "1px solid var(--border)" }}>
        <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em",
                      color: "var(--text-dim)", marginBottom: 10 }}>
          {t("cardOperation")}
        </div>
        {row(t("cardNextInspection"), o.next_inspection_date)}
      </div>

      <div style={{ padding: "16px 20px", borderTop: "1px solid var(--border)" }}>
        <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em",
                      color: "var(--text-dim)", marginBottom: 10 }}>
          {t("cardForecast")}
        </div>
        <ForecastChart objectId={o.id} />
      </div>
    </div>
  );
}
