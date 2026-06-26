import React, { useState, useEffect } from "react";
import { fetchObjects } from "../api/client";
import { categoryColor } from "../constants";
import { useApp, catLabel } from "../AppContext";
import { X } from "lucide-react";

// Модальное окно с детализацией при клике на график
export default function DrillModal({ drill, onClose }) {
  const { t } = useApp();
  const [objects, setObjects] = useState(null);

  useEffect(() => {
    if (!drill) return;
    setObjects(null);
    // Загружаем все объекты и фильтруем на клиенте по условию drill
    fetchObjects({ limit: 1000 })
      .then((data) => {
        let items = data.items;
        if (drill.type === "category") {
          items = items.filter((o) => o.category === drill.value);
        } else if (drill.type === "age") {
          const [min, max] = drill.range;
          items = items.filter((o) => o.age != null && o.age >= min && o.age < max);
        } else if (drill.type === "decade") {
          const d = drill.value;
          items = items.filter((o) => o.year_built != null && o.year_built >= d && o.year_built < d + 10);
        } else if (drill.type === "type") {
          items = items.filter((o) => o.type_code === drill.value);
        } else if (drill.type === "importance") {
          items = items.filter((o) => {
            const imp = o.importance ?? 0;
            if (drill.value === "republican") return imp >= 0.5;
            if (drill.value === "regional") return imp >= 0.25 && imp < 0.5;
            return imp < 0.25;
          });
        } else if (drill.type === "zone") {
          const [min, max] = drill.range;
          items = items.filter((o) => o.lon != null && o.lon >= min && o.lon < max);
        }
        // drill.type === "all" -> без фильтра (показываем все объекты)
        items.sort((a, b) => b.risk_score - a.risk_score);
        setObjects(items);
      })
      .catch(() => setObjects([]));
  }, [drill]);

  if (!drill) return null;

  return (
    <div
      onClick={onClose}
      style={{
        position: "absolute", inset: 0, zIndex: 2000,
        background: "rgba(0,0,0,0.5)", display: "flex",
        alignItems: "center", justifyContent: "center", padding: 20,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "var(--panel)", border: "1px solid var(--border)",
          borderRadius: 12, width: "100%", maxWidth: 600, maxHeight: "80%",
          display: "flex", flexDirection: "column", boxShadow: "var(--shadow)",
        }}
      >
        <div style={{
          display: "flex", alignItems: "center", padding: "16px 20px",
          borderBottom: "1px solid var(--border)",
        }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 600 }}>{t("drillTitle")}</div>
            <div style={{ fontSize: 12, color: "var(--text-dim)", marginTop: 2 }}>{drill.label}</div>
          </div>
          <button onClick={onClose} style={{
            marginLeft: "auto", background: "none", border: "none",
            color: "var(--text-dim)", cursor: "pointer",
          }}>
            <X size={18} />
          </button>
        </div>

        <div style={{ overflowY: "auto", flex: 1 }}>
          {objects === null ? (
            <div style={{ padding: 30, textAlign: "center", color: "var(--text-dim)" }}>
              {t("loading")}
            </div>
          ) : objects.length === 0 ? (
            <div style={{ padding: 30, textAlign: "center", color: "var(--text-dim)" }}>
              {t("drillEmpty")}
            </div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ position: "sticky", top: 0, background: "var(--panel-2)" }}>
                  <th style={{ textAlign: "left", padding: "8px 16px", color: "var(--text-dim)", fontSize: 11, fontWeight: 500 }}>{t("drillName")}</th>
                  <th style={{ textAlign: "left", padding: "8px 12px", color: "var(--text-dim)", fontSize: 11, fontWeight: 500 }}>{t("drillState")}</th>
                  <th style={{ textAlign: "right", padding: "8px 12px", color: "var(--text-dim)", fontSize: 11, fontWeight: 500 }}>{t("drillYear")}</th>
                  <th style={{ textAlign: "right", padding: "8px 16px", color: "var(--text-dim)", fontSize: 11, fontWeight: 500 }}>{t("drillRisk")}</th>
                </tr>
              </thead>
              <tbody>
                {objects.map((o) => (
                  <tr key={o.id} style={{ borderBottom: "1px solid var(--border)" }}>
                    <td style={{ padding: "8px 16px" }}>{o.name}</td>
                    <td style={{ padding: "8px 12px" }}>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                        <span style={{ width: 8, height: 8, borderRadius: "50%", background: categoryColor(o.category) }} />
                        <span style={{ fontSize: 12, color: "var(--text-dim)" }}>{catLabel(t, o.category)}</span>
                      </span>
                    </td>
                    <td className="mono" style={{ padding: "8px 12px", textAlign: "right", color: "var(--text-dim)" }}>{o.year_built || "—"}</td>
                    <td className="mono" style={{ padding: "8px 16px", textAlign: "right", color: categoryColor(o.category), fontWeight: 600 }}>
                      {(o.risk_score * 100).toFixed(0)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div style={{ padding: "10px 20px", borderTop: "1px solid var(--border)", fontSize: 12, color: "var(--text-dim)" }}>
          {t("filterFound")}: <strong style={{ color: "var(--accent)" }}>{objects?.length || 0}</strong>
        </div>
      </div>
    </div>
  );
}
