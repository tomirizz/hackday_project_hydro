import React, { useState } from "react";
import { categoryColor } from "../constants";
import { X, Share2, AlertCircle } from "lucide-react";
import { useApp, catLabel, typeLabel } from "../AppContext";
import ForecastChart from "./ForecastChart";
import InspectionsJournal from "./InspectionsJournal";
import PhotoGallery from "./PhotoGallery";

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
  const [localObj, setLocalObj] = useState(null);
  const [shared, setShared] = useState(false);

  if (!object) return null;
  const o = localObj ? { ...object, ...localObj } : object;
  const color = categoryColor(o.category);

  // Тип объекта переводим по коду, если есть
  const typeName = o.type_code ? typeLabel(t, o.type_code) : o.type_name;

  const handleShare = () => {
    const url = `${window.location.origin}${window.location.pathname}?object=${o.id}`;
    navigator.clipboard?.writeText(url).then(() => {
      setShared(true);
      setTimeout(() => setShared(false), 2000);
    }).catch(() => {});
  };

  const handleRecalc = (recalc) => {
    setLocalObj((prev) => ({ ...(prev || {}), ...recalc }));
  };

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
          {o.is_verified === 0 && (
            <div title={t("unverifiedHint")} style={{
              marginTop: 8, display: "inline-flex", alignItems: "center", gap: 6,
              background: "rgba(234,179,8,0.15)", border: "1px solid #eab308",
              color: "#eab308", borderRadius: 6, padding: "3px 8px",
              fontSize: 11, fontWeight: 600,
            }}>
              <AlertCircle size={13} /> {t("unverifiedBadge")}
            </div>
          )}
        </div>
        <div style={{ display: "flex", gap: 4 }}>
          <button onClick={handleShare} title={t("shareObject")} style={{
            background: shared ? "var(--accent)" : "transparent", border: "none",
            color: shared ? "var(--accent-text)" : "var(--text-dim)", padding: 4,
            borderRadius: 4, cursor: "pointer",
          }}>
            <Share2 size={16} />
          </button>
          <button onClick={onClose} style={{
            background: "transparent", border: "none", color: "var(--text-dim)", padding: 4, cursor: "pointer",
          }}>
            <X size={18} />
          </button>
        </div>
      </div>

      {shared && (
        <div style={{
          padding: "8px 20px", background: "var(--accent)", color: "var(--accent-text)",
          fontSize: 12, textAlign: "center",
        }}>
          {t("shareCopied")}
        </div>
      )}

      <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)" }}>
        <PhotoGallery objectId={o.id} />
      </div>

      <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)" }}>
        <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em",
                      color: "var(--text-dim)", marginBottom: 8 }}>
          {t("riskIndex")}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ flex: 1, height: 8, background: "var(--panel-2)", borderRadius: 4, overflow: "hidden" }}>
            <div className="risk-bar-fill" style={{ width: `${o.risk_score * 100}%`, height: "100%", background: color }} />
          </div>
          <span className="mono" style={{ fontSize: 15, fontWeight: 600 }}>
            {(o.risk_score * 100).toFixed(0)}%
          </span>
        </div>

        {o.risk_factors && (() => {
          const FCOL = { state: "#ef4444", age: "#f59e0b", wear: "#8b5cf6", kpd: "#38bdf8" };
          const factors = [
            { key: "state", label: t("riskFactorState"), val: o.risk_factors.state || 0 },
            { key: "age",   label: t("riskFactorAge"),   val: o.risk_factors.age   || 0 },
            { key: "wear",  label: t("riskFactorWear"),  val: o.risk_factors.wear  || 0 },
            { key: "kpd",   label: t("riskFactorKpd"),   val: o.risk_factors.kpd   || 0 },
          ];
          const totalPts = Math.round((o.risk_score || 0) * 100);
          return (
            <div style={{ marginTop: 14 }}>
              <div style={{ fontSize: 11, color: "var(--text-dim)", marginBottom: 7 }}>
                {t("riskCompositionHint")}
              </div>
              {/* Стек-бар: длина сегментов в сумме равна индексу риска */}
              <div style={{ display: "flex", width: "100%", height: 14, borderRadius: 7,
                            overflow: "hidden", background: "var(--panel-2)" }}>
                {factors.map((f) => f.val > 0 ? (
                  <div key={f.key} title={`${f.label}: +${Math.round(f.val * 100)}`}
                       style={{ width: `${f.val * 100}%`, height: "100%", background: FCOL[f.key] }} />
                ) : null)}
              </div>
              {/* Легенда: вклад каждого фактора в баллах */}
              <div style={{ marginTop: 10, display: "grid", gridTemplateColumns: "1fr 1fr", gap: "7px 14px" }}>
                {factors.map((f) => (
                  <div key={f.key} style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12 }}>
                    <span style={{ width: 9, height: 9, borderRadius: 2, background: FCOL[f.key], flexShrink: 0 }} />
                    <span style={{ color: "var(--text-dim)", flex: 1, minWidth: 0,
                                   overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {f.label}
                    </span>
                    <span className="mono" style={{ fontWeight: 600,
                          color: f.val > 0 ? "var(--text)" : "var(--text-dim)" }}>
                      {f.val > 0 ? `+${Math.round(f.val * 100)}` : "0"}
                    </span>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 9, paddingTop: 8, borderTop: "1px solid var(--border)",
                            display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                <span style={{ color: "var(--text-dim)" }}>{t("riskCompositionTotal")}</span>
                <span className="mono" style={{ fontWeight: 700 }}>{totalPts}</span>
              </div>
            </div>
          );
        })()}
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

      <div style={{ padding: "16px 20px", borderTop: "1px solid var(--border)" }}>
        <InspectionsJournal objectId={o.id} onRecalc={handleRecalc} />
      </div>
    </div>
  );
}
