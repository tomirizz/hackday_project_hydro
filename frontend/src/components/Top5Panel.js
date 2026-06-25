import React from "react";
import { categoryColor } from "../constants";
import { useApp } from "../AppContext";
import { AlertTriangle, X } from "lucide-react";

// Топ-5 самых опасных объектов — клик летит к объекту на карте
export default function Top5Panel({ objects, onSelect, onClose }) {
  const { t } = useApp();
  const top5 = [...objects]
    .sort((a, b) => b.risk_score - a.risk_score)
    .slice(0, 5);

  return (
    <div style={{
      position: "absolute", top: 60, left: 12, zIndex: 1000, width: 260,
      background: "var(--panel)", border: "1px solid var(--c-critical)",
      borderRadius: 8, boxShadow: "var(--shadow)", overflow: "hidden",
    }}>
      <div style={{
        display: "flex", alignItems: "center", gap: 6, padding: "10px 12px",
        borderBottom: "1px solid var(--border)", background: "var(--panel-2)",
      }}>
        <AlertTriangle size={15} color="var(--c-critical)" />
        <strong style={{ fontSize: 13, flex: 1 }}>{t("top5Title")}</strong>
        <button onClick={onClose} style={{ background: "none", border: "none", color: "var(--text-dim)", cursor: "pointer" }}>
          <X size={15} />
        </button>
      </div>
      <div>
        {top5.map((o, i) => (
          <button
            key={o.id}
            onClick={() => onSelect(o.id)}
            style={{
              display: "flex", alignItems: "center", gap: 10, width: "100%",
              background: "transparent", border: "none",
              borderBottom: "1px solid var(--border)",
              padding: "10px 12px", textAlign: "left", color: "var(--text)", cursor: "pointer",
            }}
          >
            <span className="mono" style={{
              fontSize: 14, fontWeight: 700, color: "var(--c-critical)",
              width: 18, flexShrink: 0,
            }}>
              {i + 1}
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {o.name}
              </div>
              <div style={{ fontSize: 10, color: "var(--text-dim)" }}>{o.district_name}</div>
            </div>
            <span className="mono" style={{
              fontSize: 13, fontWeight: 600, color: categoryColor(o.category), flexShrink: 0,
            }}>
              {(o.risk_score * 100).toFixed(0)}%
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
