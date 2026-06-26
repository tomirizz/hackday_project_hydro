import React, { useState, useEffect, useMemo, useCallback } from "react";
import { fetchObjects, reportUrl, excelUrl } from "../api/client";
import { useApp } from "../AppContext";
import { LANGUAGES } from "../i18n";
import { deriveObjects, buildDimensions, applyFilters } from "../analytics/model";
import { L } from "../analytics/i18n_analytics";
import AnalyticsOverview from "./analytics/AnalyticsOverview";
import AnalyticsDeep from "./analytics/AnalyticsDeep";
import { Chip } from "./analytics/ui";
import ReportHistory from "./analytics/ReportHistory";
import {
  FileDown, FileSpreadsheet, LayoutDashboard, FlaskConical,
  RotateCcw, MousePointerClick,
} from "lucide-react";

// Короткие подписи измерений для чипов активных фильтров
const DIM_SHORT = {
  ru: { category: "Состояние", type: "Тип", significance: "Значимость", zone: "Зона", ageBucket: "Возраст", decade: "Десятилетие" },
  kz: { category: "Жай-күй", type: "Түрі", significance: "Маңыздылық", zone: "Аймақ", ageBucket: "Жасы", decade: "Онжылдық" },
  en: { category: "Condition", type: "Type", significance: "Significance", zone: "Zone", ageBucket: "Age", decade: "Decade" },
};

export default function Dashboard() {
  const { t, lang } = useApp();
  const [objects, setObjects] = useState(null);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState({});      // { [dimId]: Set<value> }
  const [subTab, setSubTab] = useState("overview"); // "overview" | "deep"

  useEffect(() => {
    let alive = true;
    fetchObjects({ limit: 1000 })
      .then((res) => { if (alive) setObjects(deriveObjects(res.items || res)); })
      .catch(() => { if (alive) setError(t("dashLoadError")); });
    return () => { alive = false; };
  }, [t]);

  const dims = useMemo(() => buildDimensions(lang), [lang]);
  const filtered = useMemo(
    () => (objects ? applyFilters(objects, filters, dims) : []),
    [objects, filters, dims]
  );

  // Переключить значение измерения в наборе фильтров (иммутабельно)
  const onToggle = useCallback((dimId, key) => {
    setFilters((prev) => {
      const next = { ...prev };
      const set = new Set(next[dimId] || []);
      if (set.has(key)) set.delete(key); else set.add(key);
      if (set.size === 0) delete next[dimId]; else next[dimId] = set;
      return next;
    });
  }, []);

  const clearOne = useCallback((dimId, key) => {
    setFilters((prev) => {
      if (!prev[dimId]) return prev;
      const next = { ...prev };
      const set = new Set(next[dimId]);
      set.delete(key);
      if (set.size === 0) delete next[dimId]; else next[dimId] = set;
      return next;
    });
  }, []);

  const resetAll = useCallback(() => setFilters({}), []);

  // Чипы активных фильтров
  const shortMap = DIM_SHORT[lang] || DIM_SHORT.ru;
  const activeChips = [];
  for (const dimId of Object.keys(filters)) {
    const dim = dims[dimId];
    if (!dim) continue;
    for (const key of filters[dimId]) {
      activeChips.push({
        dimId, key,
        color: dim.color(key),
        label: shortMap[dimId] || dim.title,
        value: dim.label(key),
      });
    }
  }
  const hasFilters = activeChips.length > 0;
  const total = objects ? objects.length : 0;

  if (error) return <div style={{ padding: 40, color: "var(--text-dim)" }}>{error}</div>;
  if (!objects) return <div style={{ padding: 40, color: "var(--text-dim)" }}>{t("dashLoading")}</div>;

  const TABS = [
    { id: "overview", icon: LayoutDashboard, label: L(lang, "subOverview") },
    { id: "deep", icon: FlaskConical, label: L(lang, "subDeep") },
  ];

  return (
    <div style={{ padding: 20, overflowY: "auto", height: "100%" }}>

      {/* Заголовок + переключатель разделов + экспорт */}
      <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap", marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 700, lineHeight: 1.2 }}>{t("dashTitle")}</div>
          <div style={{ fontSize: 12, color: "var(--text-dim)", marginTop: 3 }}>
            {subTab === "overview" ? L(lang, "subOverviewHint") : L(lang, "subDeepHint")}
          </div>
        </div>

        {/* Сегментированный контрол разделов */}
        <div style={{
          display: "flex", background: "var(--panel-2)", border: "1px solid var(--border)",
          borderRadius: 11, padding: 3, gap: 3,
        }}>
          {TABS.map(({ id, icon: Icon, label }) => {
            const on = subTab === id;
            return (
              <button key={id} onClick={() => setSubTab(id)} style={{
                display: "flex", alignItems: "center", gap: 7, cursor: "pointer",
                border: "none", borderRadius: 8, padding: "8px 14px",
                fontSize: 13, fontWeight: 600, whiteSpace: "nowrap",
                background: on ? "var(--accent)" : "transparent",
                color: on ? "var(--accent-text)" : "var(--text-dim)",
                boxShadow: on ? "0 1px 4px rgba(0,0,0,0.15)" : "none",
                transition: "all .15s",
              }}>
                <Icon size={15} /> {label}
              </button>
            );
          })}
        </div>

        {/* Экспорт PDF / Excel + история отчётов */}
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <ReportHistory />
          <a href={excelUrl()} target="_blank" rel="noopener noreferrer" style={{
            display: "flex", alignItems: "center", gap: 5,
            background: "#1d6f42", color: "#fff", textDecoration: "none",
            borderRadius: 6, padding: "7px 11px", fontSize: 12, fontWeight: 500,
          }}>
            <FileSpreadsheet size={13} /> {t("exportExcel")}
          </a>
          <span style={{ fontSize: 12, color: "var(--text-dim)" }}>PDF:</span>
          {LANGUAGES.map((l) => (
            <a key={l.code} href={reportUrl(l.code)} target="_blank" rel="noopener noreferrer" style={{
              display: "flex", alignItems: "center", gap: 5,
              background: l.code === lang ? "var(--accent)" : "var(--panel-2)",
              color: l.code === lang ? "var(--accent-text)" : "var(--text)",
              textDecoration: "none", borderRadius: 6, padding: "7px 11px",
              fontSize: 12, fontWeight: 500, border: "1px solid var(--border)",
            }}>
              <FileDown size={13} /> {l.label}
            </a>
          ))}
        </div>
      </div>

      {/* Панель активных фильтров (кросс-фильтрация) */}
      {hasFilters && (
        <div style={{
          display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 14,
          padding: "10px 12px", background: "var(--panel)",
          border: "1px solid var(--border)", borderRadius: 10,
        }}>
          <span style={{
            fontSize: 11, fontWeight: 700, color: "var(--text-dim)",
            textTransform: "uppercase", letterSpacing: ".05em",
          }}>
            {L(lang, "filtersActive")}
          </span>
          {activeChips.map((c) => (
            <Chip key={c.dimId + "|" + c.key} color={c.color} label={c.label}
              value={c.value} onRemove={() => clearOne(c.dimId, c.key)} />
          ))}
          <span className="mono" style={{ fontSize: 12.5, color: "var(--text)" }}>
            <b>{filtered.length}</b> {L(lang, "ofObjects", { total })}
          </span>
          <button onClick={resetAll} style={{
            marginLeft: "auto", display: "flex", alignItems: "center", gap: 5, cursor: "pointer",
            background: "transparent", border: "1px solid var(--border)", borderRadius: 7,
            padding: "5px 10px", fontSize: 12, color: "var(--text-dim)", fontWeight: 500,
          }}>
            <RotateCcw size={13} /> {L(lang, "resetAll")}
          </button>
        </div>
      )}

      {/* Подсказка о кликах (только в обзоре, когда фильтры не активны) */}
      {subTab === "overview" && !hasFilters && (
        <div style={{
          display: "flex", alignItems: "center", gap: 7, marginBottom: 14,
          fontSize: 12.5, color: "var(--text-dim)",
        }}>
          <MousePointerClick size={14} /> {L(lang, "clickHint")}
        </div>
      )}

      {/* Активный раздел */}
      {subTab === "overview" ? (
        <AnalyticsOverview
          objects={objects} filtered={filtered} filters={filters}
          dims={dims} onToggle={onToggle} lang={lang}
        />
      ) : (
        <AnalyticsDeep filtered={filtered} lang={lang} />
      )}
    </div>
  );
}
