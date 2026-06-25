import React from "react";
import { CATEGORIES } from "../constants";
import { useApp, catLabel } from "../AppContext";

// Мини-легенда поверх карты — цветные кружки с подписями состояний
export default function MapLegend() {
  const { t } = useApp();
  return (
    <div style={{
      position: "absolute", bottom: 16, left: 12, zIndex: 1000,
      background: "var(--panel)", border: "1px solid var(--border)",
      borderRadius: 8, padding: "10px 12px", boxShadow: "var(--shadow)",
    }}>
      <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.05em",
                    color: "var(--text-dim)", marginBottom: 8 }}>
        {t("legendTitle")}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
        {Object.keys(CATEGORIES).map((key) => (
          <div key={key} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
            <span style={{ width: 10, height: 10, borderRadius: "50%", background: CATEGORIES[key].color }} />
            {catLabel(t, key)}
          </div>
        ))}
      </div>
    </div>
  );
}
