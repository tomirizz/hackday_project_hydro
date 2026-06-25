import React from "react";
import { CATEGORIES, OBJECT_TYPES } from "../constants";
import { useApp, catLabel, typeLabel } from "../AppContext";

const wrap = { padding: "16px", borderBottom: "1px solid var(--border)" };
const label = {
  fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em",
  color: "var(--text-dim)", marginBottom: 8, display: "block",
};
const input = {
  width: "100%", background: "var(--panel-2)", border: "1px solid var(--border)",
  borderRadius: 6, color: "var(--text)", padding: "8px 10px", fontSize: 13,
};

export default function Filters({ filters, setFilters, total }) {
  const { t } = useApp();
  const update = (key, val) => setFilters((f) => ({ ...f, [key]: val }));
  const toggleCategory = (cat) => update("category", filters.category === cat ? null : cat);

  return (
    <div>
      <div style={wrap}>
        <span style={label}>{t("filterState")}</span>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {Object.keys(CATEGORIES).map((key) => {
            const active = filters.category === key;
            const color = CATEGORIES[key].color;
            return (
              <button
                key={key}
                onClick={() => toggleCategory(key)}
                style={{
                  display: "flex", alignItems: "center", gap: 8,
                  background: active ? "var(--panel-2)" : "transparent",
                  border: `1px solid ${active ? color : "var(--border)"}`,
                  borderRadius: 6, padding: "7px 10px",
                  color: "var(--text)", fontSize: 13, textAlign: "left",
                }}
              >
                <span style={{ width: 10, height: 10, borderRadius: "50%", background: color, flexShrink: 0 }} />
                {catLabel(t, key)}
              </button>
            );
          })}
        </div>
      </div>

      <div style={wrap}>
        <span style={label}>{t("filterType")}</span>
        <select style={input} value={filters.typeCode || ""}
                onChange={(e) => update("typeCode", e.target.value || null)}>
          <option value="">{t("filterAllTypes")}</option>
          {Object.keys(OBJECT_TYPES).map((code) => (
            <option key={code} value={code}>{typeLabel(t, code)}</option>
          ))}
        </select>
      </div>

      <div style={wrap}>
        <span style={label}>{t("filterDistrict")}</span>
        <input style={input} placeholder={t("filterDistrictPlaceholder")}
               value={filters.district || ""}
               onChange={(e) => update("district", e.target.value || null)} />
      </div>

      <div style={wrap}>
        <span style={label}>{t("filterYear")}</span>
        <div style={{ display: "flex", gap: 8 }}>
          <input style={input} type="number" placeholder={t("filterYearFrom")}
                 value={filters.yearFrom || ""}
                 onChange={(e) => update("yearFrom", e.target.value || null)} />
          <input style={input} type="number" placeholder={t("filterYearTo")}
                 value={filters.yearTo || ""}
                 onChange={(e) => update("yearTo", e.target.value || null)} />
        </div>
      </div>

      <div style={wrap}>
        <span style={label}>{t("filterMinRisk")}: {((filters.minRisk || 0) * 100).toFixed(0)}%</span>
        <input type="range" min="0" max="1" step="0.05"
               value={filters.minRisk || 0}
               onChange={(e) => update("minRisk", parseFloat(e.target.value) || null)}
               style={{ width: "100%", accentColor: "var(--accent)" }} />
      </div>

      <div style={{ ...wrap, borderBottom: "none" }}>
        <button onClick={() => setFilters({})} style={{
          width: "100%", background: "transparent", border: "1px solid var(--border)",
          borderRadius: 6, color: "var(--text-dim)", padding: "8px", fontSize: 13,
        }}>
          {t("filterReset")}
        </button>
        <div style={{ marginTop: 12, fontSize: 12, color: "var(--text-dim)", textAlign: "center" }}>
          {t("filterFound")}: <strong style={{ color: "var(--accent)" }}>{total}</strong>
        </div>
      </div>
    </div>
  );
}
