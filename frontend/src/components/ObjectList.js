import React from "react";
import { categoryColor } from "../constants";

export default function ObjectList({ objects, selectedId, onSelect }) {
  return (
    <div style={{ overflowY: "auto", flex: 1 }}>
      {objects.map((o) => {
        const active = selectedId === o.id;
        return (
          <button
            key={o.id}
            onClick={() => onSelect(o.id)}
            style={{
              display: "flex", alignItems: "center", gap: 10,
              width: "100%", textAlign: "left",
              background: active ? "var(--panel-2)" : "transparent",
              border: "none",
              borderLeft: `3px solid ${active ? categoryColor(o.category) : "transparent"}`,
              borderBottom: "1px solid var(--border)",
              padding: "10px 14px", color: "var(--text)", cursor: "pointer",
            }}
          >
            <span style={{
              width: 8, height: 8, borderRadius: "50%",
              background: categoryColor(o.category), flexShrink: 0,
            }} />
            <span style={{ flex: 1, fontSize: 13, overflow: "hidden",
                           textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {o.name}
            </span>
            <span className="mono" style={{ fontSize: 12, color: "var(--text-dim)" }}>
              {(o.risk_score * 100).toFixed(0)}%
            </span>
          </button>
        );
      })}
    </div>
  );
}
