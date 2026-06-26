import React, { useState, useEffect, useCallback } from "react";
import { fetchReportHistory } from "../../api/client";
import { useApp } from "../../AppContext";
import { History, X, FileText, FileSpreadsheet, ClipboardList } from "lucide-react";

// Метаданные по типу отчёта: иконка, ключ перевода, цвет
const KIND_META = {
  pdf:             { icon: FileText,        key: "reportKindPdf",   color: "#ef4444" },
  excel:           { icon: FileSpreadsheet, key: "reportKindExcel", color: "#1d6f42" },
  inspection_plan: { icon: ClipboardList,   key: "reportKindPlan",  color: "#f59e0b" },
};

export default function ReportHistory() {
  const { t, lang } = useApp();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState(null);

  const load = useCallback(() => {
    fetchReportHistory()
      .then((d) => setItems(d.items || []))
      .catch(() => setItems([]));
  }, []);

  useEffect(() => { if (open) load(); }, [open, load]);

  const fmtDate = (s) => {
    if (!s) return "";
    // sqlite CURRENT_TIMESTAMP отдаёт UTC в формате "YYYY-MM-DD HH:MM:SS"
    const d = new Date(s.replace(" ", "T") + "Z");
    if (isNaN(d.getTime())) return s;
    return d.toLocaleString(lang === "en" ? "en-GB" : "ru-RU", {
      day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  };

  return (
    <div style={{ position: "relative" }}>
      <button onClick={() => setOpen((v) => !v)} style={{
        display: "flex", alignItems: "center", gap: 5,
        background: open ? "var(--accent)" : "var(--panel-2)",
        color: open ? "var(--accent-text)" : "var(--text)",
        border: "1px solid var(--border)", borderRadius: 6,
        padding: "7px 11px", fontSize: 12, fontWeight: 500, cursor: "pointer",
      }}>
        <History size={13} /> {t("reportHistoryOpen")}
      </button>

      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 6px)", right: 0, zIndex: 1500,
          width: 300, maxHeight: 360, overflowY: "auto",
          background: "var(--panel)", border: "1px solid var(--border)",
          borderRadius: 10, boxShadow: "var(--shadow)",
        }}>
          <div style={{
            display: "flex", alignItems: "center", gap: 6, padding: "10px 12px",
            borderBottom: "1px solid var(--border)", position: "sticky", top: 0,
            background: "var(--panel)",
          }}>
            <History size={14} />
            <strong style={{ fontSize: 13, flex: 1 }}>{t("reportHistoryTitle")}</strong>
            <button onClick={() => setOpen(false)} style={{
              background: "none", border: "none", color: "var(--text-dim)",
              cursor: "pointer", padding: 2,
            }}>
              <X size={14} />
            </button>
          </div>

          {items === null ? (
            <div style={{ padding: 16, fontSize: 12, color: "var(--text-dim)", textAlign: "center" }}>…</div>
          ) : items.length === 0 ? (
            <div style={{ padding: 16, fontSize: 12, color: "var(--text-dim)", textAlign: "center" }}>
              {t("reportHistoryEmpty")}
            </div>
          ) : (
            items.map((it) => {
              const meta = KIND_META[it.kind] || KIND_META.excel;
              const Icon = meta.icon;
              return (
                <div key={it.id} style={{
                  display: "flex", alignItems: "center", gap: 9,
                  padding: "9px 12px", borderBottom: "1px solid var(--border)",
                }}>
                  <span style={{ display: "flex", color: meta.color, flexShrink: 0 }}>
                    <Icon size={16} />
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12.5 }}>
                      {t(meta.key)}{it.lang ? ` · ${it.lang.toUpperCase()}` : ""}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--text-dim)" }}>{fmtDate(it.created_at)}</div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
