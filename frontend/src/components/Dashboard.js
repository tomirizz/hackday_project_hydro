import React, { useState, useEffect } from "react";
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  ComposedChart, Line, RadarChart, Radar, PolarGrid,
  PolarAngleAxis, PolarRadiusAxis,
} from "recharts";
import { fetchDashboard, reportUrl, excelUrl } from "../api/client";
import { CATEGORIES } from "../constants";
import { useApp, catLabel } from "../AppContext";
import { LANGUAGES } from "../i18n";
import DrillModal from "./DrillModal";
import AnimatedNumber from "./AnimatedNumber";
import { FileDown, FileSpreadsheet, AlertTriangle, TrendingUp, MapPin, Droplets } from "lucide-react";

const card = { background: "var(--panel)", border: "1px solid var(--border)", borderRadius: 10, padding: 16 };
const cardTitle = {
  fontSize: 12, textTransform: "uppercase", letterSpacing: "0.05em",
  color: "var(--text-dim)", marginBottom: 14,
};
const CATEGORY_ORDER = ["normal", "watch", "repair", "critical"];

function Metric({ label, value, suffix, accent, sub, onClick, decimals = 0 }) {
  return (
    <div className="lift-hover" style={{ ...card, cursor: onClick ? "pointer" : "default" }} onClick={onClick}>
      <div style={{ fontSize: 12, color: "var(--text-dim)", marginBottom: 6 }}>{label}</div>
      <div className="mono" style={{ fontSize: 26, fontWeight: 600, color: accent || "var(--text)" }}>
        <AnimatedNumber value={value} decimals={decimals} />
        <span style={{ fontSize: 14, color: "var(--text-dim)" }}>{suffix}</span>
      </div>
      {sub && <div style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 4 }}>{sub}</div>}
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
    .map((b) => data.age_histogram?.find((h) => h.bucket === b))
    .filter(Boolean)
    .map((h) => ({ bucket: h.bucket, count: h.count }));

  const decadeData = (data.by_decade || []).map((d) => ({
    decade: `${d.decade}s`,
    decadeNum: d.decade,
    count: d.count,
    risk: Math.round(d.avg_risk * 100),
  }));

  // Топ-5 опасных объектов из heat_points / или из by_category
  const top5 = (data.heat_points || [])
    .sort((a, b) => b[2] - a[2])
    .slice(0, 5);

  // Данные для радар-диаграммы качества системы
  const radarData = [
    { subject: "КПД системы", value: Math.round(m.avg_kpd * 100) },
    { subject: "Исправных", value: Math.round((m.normal_count / m.total) * 100) },
    { subject: "Под наблюд.", value: Math.round((m.watch_count / m.total) * 100) },
    { subject: "Ремонт", value: 100 - Math.round((m.repair_count / m.total) * 100) },
    { subject: "Аварийных", value: 100 - Math.round((m.critical_count / m.total) * 100) },
  ];

  const onPieClick = (entry) => {
    if (!entry) return;
    setDrill({ type: "category", value: entry.cat, label: `${t("filterState")}: ${entry.name}` });
  };
  const onAgeClick = (entry) => {
    if (!entry?.bucket) return;
    setDrill({ type: "age", range: ageRanges[entry.bucket], label: `${t("dashByAge")}: ${entry.bucket} ${t("cardAgeYears")}` });
  };
  const onDecadeClick = (entry) => {
    if (entry?.decadeNum == null) return;
    setDrill({ type: "decade", value: entry.decadeNum, label: `${t("cardYearBuilt")}: ${entry.decade}` });
  };

  return (
    <div style={{ padding: 20, overflowY: "auto", height: "100%", position: "relative" }}>

      {/* Заголовок + экспорт */}
      <div style={{ display: "flex", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
        <div style={{ fontSize: 15, fontWeight: 600 }}>{t("dashTitle")}</div>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
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

      {/* Основные метрики */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12, marginBottom: 20 }}>
        <Metric label={t("dashTotal")} value={m.total} />
        <Metric label={t("dashAvgRisk")} value={m.avg_risk * 100} suffix="%" accent="var(--accent)" />
        <Metric label={t("dashCritical")} value={m.critical_count} accent="var(--c-critical)"
                sub={`${((m.critical_count/m.total)*100).toFixed(1)}% от всех`}
                onClick={() => setDrill({ type: "category", value: "critical", label: t("cat_critical") })} />
        <Metric label={t("dashRepair")} value={m.repair_count} accent="var(--c-repair)"
                onClick={() => setDrill({ type: "category", value: "repair", label: t("cat_repair") })} />
        <Metric label={t("dashAvgKpd")} value={m.avg_kpd * 100} suffix="%" />
        <Metric label={t("dashAvgAge")} value={m.avg_age} suffix={` ${t("dashAgeYears")}`} />
      </div>

      {/* Первый ряд: пирог + возраст */}
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

      {/* Второй ряд: десятилетия (широкий) */}
      <div style={{ ...card, marginBottom: 16 }}>
        <div style={cardTitle}>{t("dashByDecade")}</div>
        <ResponsiveContainer width="100%" height={260}>
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

      {/* Третий ряд: Топ-5 + Радар состояния системы */}
      <div className="dashboard-grid-2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>

        {/* Топ-5 самых опасных */}
        <div style={card}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 14 }}>
            <AlertTriangle size={14} color="var(--c-critical)" />
            <span style={{ ...cardTitle, marginBottom: 0 }}>{t("top5Title")}</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {(data.top_critical || []).map((o, i) => (
              <div key={o.id} style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "8px 10px", background: "var(--panel-2)", borderRadius: 6,
                borderLeft: `3px solid var(--c-critical)`,
              }}>
                <span className="mono" style={{ fontSize: 16, fontWeight: 700, color: "var(--c-critical)", width: 18 }}>
                  {i + 1}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {o.name}
                  </div>
                  <div style={{ fontSize: 10, color: "var(--text-dim)", marginTop: 2 }}>
                    <MapPin size={9} style={{ marginRight: 3 }} />{o.district_name}
                  </div>
                </div>
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <div className="mono" style={{ fontSize: 14, fontWeight: 600, color: "var(--c-critical)" }}>
                    {(o.risk_score * 100).toFixed(0)}%
                  </div>
                  <div style={{ fontSize: 10, color: "var(--text-dim)" }}>
                    {o.year_built ? `${2026 - o.year_built} лет` : "—"}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Радар-диаграмма состояния системы */}
        <div style={card}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 14 }}>
            <Droplets size={14} color="var(--accent)" />
            <span style={{ ...cardTitle, marginBottom: 0 }}>Состояние системы ГТС</span>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <RadarChart data={radarData}>
              <PolarGrid stroke="var(--border)" />
              <PolarAngleAxis dataKey="subject" tick={{ fill: "var(--text-dim)", fontSize: 10 }} />
              <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fill: "var(--text-dim)", fontSize: 9 }} />
              <Radar name="Показатель" dataKey="value" stroke="var(--accent)" fill="var(--accent)" fillOpacity={0.2} />
              <Tooltip contentStyle={tooltipStyle} />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Четвёртый ряд: прогноз угрозы */}
      {data.region_forecast && (
        <div style={{ ...card, marginBottom: 16, borderLeft: "4px solid var(--c-critical)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <TrendingUp size={16} color="var(--c-critical)" />
            <span style={{ fontWeight: 600, fontSize: 14 }}>Прогноз деградации региона (10 лет)</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
            <div style={{ background: "var(--panel-2)", borderRadius: 8, padding: "12px 16px", textAlign: "center" }}>
              <div className="mono" style={{ fontSize: 28, fontWeight: 700, color: "var(--c-critical)" }}>
                {data.region_forecast.will_become_critical}
              </div>
              <div style={{ fontSize: 12, color: "var(--text-dim)", marginTop: 4 }}>
                объектов станут аварийными
              </div>
            </div>
            <div style={{ background: "var(--panel-2)", borderRadius: 8, padding: "12px 16px", textAlign: "center" }}>
              <div className="mono" style={{ fontSize: 28, fontWeight: 700, color: "var(--c-repair)" }}>
                {Math.round(((data.region_forecast.will_become_critical + m.critical_count) / m.total) * 100)}%
              </div>
              <div style={{ fontSize: 12, color: "var(--text-dim)", marginTop: 4 }}>
                объектов будут аварийными к 2036 г.
              </div>
            </div>
            <div style={{ background: "var(--panel-2)", borderRadius: 8, padding: "12px 16px", textAlign: "center" }}>
              <div className="mono" style={{ fontSize: 28, fontWeight: 700, color: "var(--accent)" }}>
                {Math.round(m.avg_kpd * 100)}%
              </div>
              <div style={{ fontSize: 12, color: "var(--text-dim)", marginTop: 4 }}>
                средний КПД сейчас
              </div>
            </div>
          </div>
          <div style={{ marginTop: 10, fontSize: 12, color: "var(--text-dim)", lineHeight: 1.5 }}>
            При текущих темпах деградации (средняя потеря КПД: {((m.avg_kpd_design - m.avg_kpd) * 100 || 13).toFixed(0)}%
            за {Math.round(m.avg_age)} лет) система требует первоочередного вмешательства
            на {m.critical_count + m.repair_count} объектах.
          </div>
        </div>
      )}

      <DrillModal drill={drill} onClose={() => setDrill(null)} />
    </div>
  );
}
