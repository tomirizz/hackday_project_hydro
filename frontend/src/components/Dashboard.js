import React, { useState, useEffect } from "react";
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  ComposedChart, Line,
} from "recharts";
import { fetchDashboard, reportUrl, excelUrl } from "../api/client";
import { CATEGORIES } from "../constants";
import { useApp, catLabel } from "../AppContext";
import { LANGUAGES } from "../i18n";
import DrillModal from "./DrillModal";
import AnimatedNumber from "./AnimatedNumber";
import { FileDown, FileSpreadsheet } from "lucide-react";

const card = { background: "var(--panel)", border: "1px solid var(--border)", borderRadius: 10, padding: 16 };
const cardTitle = {
  fontSize: 12, textTransform: "uppercase", letterSpacing: "0.05em",
  color: "var(--text-dim)", marginBottom: 14,
};

const CATEGORY_ORDER = ["normal", "watch", "repair", "critical"];

function Metric({ label, value, suffix, accent, onClick, decimals = 0 }) {
  return (
    <div className="lift-hover" style={{ ...card, cursor: onClick ? "pointer" : "default" }} onClick={onClick}>
      <div style={{ fontSize: 12, color: "var(--text-dim)", marginBottom: 6 }}>{label}</div>
      <div className="mono" style={{ fontSize: 26, fontWeight: 600, color: accent || "var(--text)" }}>
        <AnimatedNumber value={value} decimals={decimals} /><span style={{ fontSize: 14, color: "var(--text-dim)" }}>{suffix}</span>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { t, lang } = useApp();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [drill, setDrill] = useState(null);

  useEffect(() => {
    fetchDashboard().then(setData).catch(() => setError(t("dashLoadError")));
  }, [t]);

  if (error) return <div style={{ padding: 40, color: "var(--c-critical)" }}>{error}</div>;
  if (!data) return <div style={{ padding: 40, color: "var(--text-dim)" }}>{t("dashLoading")}</div>;

  const m = data.metrics;
  const tooltipStyle = {
    background: "var(--panel-2)", border: "1px solid var(--border)",
    borderRadius: 6, color: "var(--text)", fontSize: 12,
  };

  const pieData = CATEGORY_ORDER
    .map((cat) => {
      const found = data.by_category.find((c) => c.category === cat);
      return { cat, name: catLabel(t, cat), value: found?.count || 0, color: CATEGORIES[cat]?.color };
    })
    .filter((d) => d.value > 0);

  const ageOrder = ["0–20", "20–40", "40–60", "60–80", "80–100", "100+"];
  const ageRanges = {
    "0–20": [0, 20], "20–40": [20, 40], "40–60": [40, 60],
    "60–80": [60, 80], "80–100": [80, 100], "100+": [100, 999],
  };
  const ageData = ageOrder
    .map((b) => data.age_histogram.find((h) => h.bucket === b))
    .filter(Boolean)
    .map((h) => ({ bucket: h.bucket, count: h.count }));

  const decadeData = data.by_decade.map((d) => ({
    decade: `${d.decade}s`,
    decadeNum: d.decade,
    count: d.count,
    risk: Math.round(d.avg_risk * 100),
  }));

  // Обработчики кликов на графики
  const onPieClick = (entry) => {
    if (!entry) return;
    setDrill({ type: "category", value: entry.cat, label: `${t("filterState")}: ${entry.name}` });
  };
  const onAgeClick = (entry) => {
    if (!entry || !entry.bucket) return;
    setDrill({ type: "age", range: ageRanges[entry.bucket], label: `${t("dashByAge")}: ${entry.bucket} ${t("cardAgeYears")}` });
  };
  const onDecadeClick = (entry) => {
    if (!entry || entry.decadeNum == null) return;
    setDrill({ type: "decade", value: entry.decadeNum, label: `${t("cardYearBuilt")}: ${entry.decade}` });
  };

  return (
    <div style={{ padding: 20, overflowY: "auto", height: "100%", position: "relative" }}>
      <div style={{ display: "flex", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
        <div style={{ fontSize: 15, fontWeight: 600 }}>{t("dashTitle")}</div>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          {/* Excel экспорт */}
          <a
            href={excelUrl()}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "flex", alignItems: "center", gap: 5,
              background: "#1d6f42", color: "#fff",
              textDecoration: "none", borderRadius: 6, padding: "7px 11px",
              fontSize: 12, fontWeight: 500,
            }}
          >
            <FileSpreadsheet size={13} /> {t("exportExcel")}
          </a>

          {/* Выбор языка отчёта */}
          <span style={{ fontSize: 12, color: "var(--text-dim)" }}>PDF:</span>
          {LANGUAGES.map((l) => (
            <a
              key={l.code}
              href={reportUrl(l.code)}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: "flex", alignItems: "center", gap: 5,
                background: l.code === lang ? "var(--accent)" : "var(--panel-2)",
                color: l.code === lang ? "var(--accent-text)" : "var(--text)",
                textDecoration: "none", borderRadius: 6, padding: "7px 11px",
                fontSize: 12, fontWeight: 500, border: "1px solid var(--border)",
              }}
            >
              <FileDown size={13} /> {l.label}
            </a>
          ))}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12, marginBottom: 20 }}>
        <Metric label={t("dashTotal")} value={m.total} />
        <Metric label={t("dashAvgRisk")} value={m.avg_risk * 100} suffix="%" accent="var(--accent)" />
        <Metric label={t("dashCritical")} value={m.critical_count} accent="var(--c-critical)"
                onClick={() => setDrill({ type: "category", value: "critical", label: `${t("filterState")}: ${t("cat_critical")}` })} />
        <Metric label={t("dashRepair")} value={m.repair_count} accent="var(--c-repair)"
                onClick={() => setDrill({ type: "category", value: "repair", label: `${t("filterState")}: ${t("cat_repair")}` })} />
        <Metric label={t("dashAvgKpd")} value={m.avg_kpd * 100} suffix="%" />
        <Metric label={t("dashAvgAge")} value={m.avg_age} suffix={` ${t("dashAgeYears")}`} decimals={0} />
      </div>

      <div className="dashboard-grid-2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
        <div style={card}>
          <div style={cardTitle}>{t("dashByState")}</div>
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%"
                   innerRadius={50} outerRadius={85} paddingAngle={2}
                   onClick={onPieClick} style={{ cursor: "pointer" }}>
                {pieData.map((e, i) => <Cell key={i} fill={e.color} stroke="var(--panel)" strokeWidth={2} />)}
              </Pie>
              <Tooltip contentStyle={tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: 12, color: "var(--text-dim)" }} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div style={card}>
          <div style={cardTitle}>{t("dashByAge")}</div>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={ageData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="bucket" tick={{ fill: "var(--text-dim)", fontSize: 11 }} />
              <YAxis tick={{ fill: "var(--text-dim)", fontSize: 11 }} />
              <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "rgba(128,128,128,0.08)" }} />
              <Bar dataKey="count" fill="var(--accent-2)" radius={[4, 4, 0, 0]}
                   onClick={onAgeClick} style={{ cursor: "pointer" }} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div style={card}>
        <div style={cardTitle}>{t("dashByDecade")}</div>
        <ResponsiveContainer width="100%" height={280}>
          <ComposedChart data={decadeData}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey="decade" tick={{ fill: "var(--text-dim)", fontSize: 11 }} />
            <YAxis yAxisId="left" tick={{ fill: "var(--text-dim)", fontSize: 11 }} />
            <YAxis yAxisId="right" orientation="right" tick={{ fill: "var(--text-dim)", fontSize: 11 }} domain={[0, 100]} unit="%" />
            <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "rgba(128,128,128,0.08)" }} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar yAxisId="left" dataKey="count" name={t("dashCount")} fill="#38bdf8" radius={[4, 4, 0, 0]}
                 onClick={onDecadeClick} style={{ cursor: "pointer" }} />
            <Line yAxisId="right" dataKey="risk" name={t("dashRiskPct")} stroke="#ef4444" strokeWidth={2} dot={{ r: 3 }} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <DrillModal drill={drill} onClose={() => setDrill(null)} />
    </div>
  );
}
