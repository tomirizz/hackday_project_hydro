import React, { useState, useEffect } from "react";
import { fetchOverdue, excelUrl } from "../api/client";
import { categoryColor } from "../constants";
import { useApp } from "../AppContext";
import { Clock, X, FileSpreadsheet } from "lucide-react";

// Панель просроченных осмотров — клик летит к объекту
export default function OverduePanel({ onSelect, onClose }) {
  const { t } = useApp();
  const [data, setData] = useState(null);

  useEffect(() => {
    fetchOverdue().then(setData).catch(() => setData({ total: 0, items: [] }));
  }, []);

  return (
    <div style={{
      position: "absolute", top: 60, left: 12, zIndex: 1000, width: 300,
      background: "var(--panel)", border: "1px solid var(--c-repair)",
      borderRadius: 8, boxShadow: "var(--shadow)", overflow: "hidden",
      maxHeight: "70%", display: "flex", flexDirection: "column",
    }}>
      <div style={{
        display: "flex", alignItems: "center", gap: 6, padding: "10px 12px",
        borderBottom: "1px solid var(--border)", background: "var(--panel-2)",
      }}>
        <Clock size={15} color="var(--c-repair)" />
        <strong style={{ fontSize: 13, flex: 1 }}>{t("overdueTitle")}</strong>
        <button onClick={onClose} style={{ background: "none", border: "none", color: "var(--text-dim)", cursor: "pointer" }}>
          <X size={15} />
        </button>
      </div>

      {data && data.total > 0 && (
        <a
          href={excelUrl()}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: "flex", alignItems: "center", gap: 6, margin: "8px 12px",
            background: "#1d6f42", color: "#fff", textDecoration: "none",
            borderRadius: 6, padding: "7px 10px", fontSize: 12, justifyContent: "center",
          }}
        >
          <FileSpreadsheet size={13} /> {t("overdueExport")}
        </a>
      )}

      <div style={{ overflowY: "auto", flex: 1 }}>
        {data === null ? (
          <div style={{ padding: 20, textAlign: "center", color: "var(--text-dim)", fontSize: 13 }}>
            {t("loading")}
          </div>
        ) : data.total === 0 ? (
          <div style={{ padding: 20, textAlign: "center", color: "var(--text-dim)", fontSize: 13 }}>
            {t("overdueEmpty")}
          </div>
        ) : (
          data.items.map((o) => (
            <button
              key={o.id}
              onClick={() => onSelect(o.id)}
              style={{
                display: "flex", alignItems: "center", gap: 8, width: "100%",
                background: "transparent", border: "none",
                borderBottom: "1px solid var(--border)",
                padding: "9px 12px", textAlign: "left", color: "var(--text)", cursor: "pointer",
              }}
            >
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: categoryColor(o.category), flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {o.name}
                </div>
                <div style={{ fontSize: 10, color: "var(--c-repair)" }}>
                  {o.days_overdue} {t("overdueDays")}
                </div>
              </div>
              <span className="mono" style={{ fontSize: 12, fontWeight: 600, color: categoryColor(o.category), flexShrink: 0 }}>
                {(o.risk_score * 100).toFixed(0)}%
              </span>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
