import React, { useState, useEffect } from "react";
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  ComposedChart, Line,
} from "recharts";
import { fetchDashboard } from "../api/client";
import { CATEGORIES } from "../constants";

const API_BASE = process.env.REACT_APP_API_URL || "http://localhost:8000";

const card = {
  background: "var(--panel)",
  border: "1px solid var(--border)",
  borderRadius: 10,
  padding: 16,
};
const cardTitle = {
  fontSize: 12,
  textTransform: "uppercase",
  letterSpacing: "0.05em",
  color: "var(--text-dim)",
  marginBottom: 14,
};

const CATEGORY_ORDER = ["normal", "watch", "repair", "critical"];

function Metric({ label, value, suffix, accent }) {
  return (
    <div style={card}>
      <div style={{ fontSize: 12, color: "var(--text-dim)", marginBottom: 6 }}>{label}</div>
      <div className="mono" style={{ fontSize: 26, fontWeight: 600, color: accent || "var(--text)" }}>
        {value}<span style={{ fontSize: 14, color: "var(--text-dim)" }}>{suffix}</span>
      </div>
    </div>
  );
}

const tooltipStyle = {
  background: "var(--panel-2)",
  border: "1px solid var(--border)",
  borderRadius: 6,
  color: "var(--text)",
  fontSize: 12,
};

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchDashboard().then(setData).catch(() =>
      setError("Не удалось загрузить аналитику. Запущен ли бэкенд?"));
  }, []);

  if (error) return <div style={{ padding: 40, color: "#fca5a5" }}>{error}</div>;
  if (!data) return <div style={{ padding: 40, color: "var(--text-dim)" }}>Загрузка аналитики…</div>;

  const m = data.metrics;

  const pieData = CATEGORY_ORDER
    .map((cat) => {
      const found = data.by_category.find((c) => c.category === cat);
      return { name: CATEGORIES[cat]?.label || cat, value: found?.count || 0, color: CATEGORIES[cat]?.color };
    })
    .filter((d) => d.value > 0);

  const ageOrder = ["0–20", "20–40", "40–60", "60–80", "80–100", "100+"];
  const ageData = ageOrder
    .map((b) => data.age_histogram.find((h) => h.bucket === b))
    .filter(Boolean)
    .map((h) => ({ bucket: h.bucket, count: h.count }));

  const decadeData = data.by_decade.map((d) => ({
    decade: `${d.decade}s`,
    count: d.count,
    risk: Math.round(d.avg_risk * 100),
  }));

  return (
    <div style={{ padding: 20, overflowY: "auto", height: "100%" }}>
      {/* Заголовок + кнопка отчёта */}
      <div style={{ display: "flex", alignItems: "center", marginBottom: 16 }}>
        <div style={{ fontSize: 15, fontWeight: 600 }}>Аналитика по региону</div>
        <a
          href={`${API_BASE}/report`}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            marginLeft: "auto", display: "flex", alignItems: "center", gap: 6,
            background: "var(--accent)", color: "#04342c", textDecoration: "none",
            borderRadius: 6, padding: "8px 14px", fontSize: 13, fontWeight: 500,
          }}
        >
          Скачать отчёт для министерства (PDF)
        </a>
      </div>

      {/* Метрики */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12, marginBottom: 20 }}>
        <Metric label="Всего объектов" value={m.total} />
        <Metric label="Средний риск" value={(m.avg_risk * 100).toFixed(0)} suffix="%" accent="var(--accent)" />
        <Metric label="Аварийных" value={m.critical_count} accent="#ef4444" />
        <Metric label="Требуют ремонта" value={m.repair_count} accent="#f97316" />
        <Metric label="Средний КПД" value={(m.avg_kpd * 100).toFixed(0)} suffix="%" />
        <Metric label="Средний возраст" value={m.avg_age} suffix=" лет" />
      </div>

      <div className="dashboard-grid-2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
        {/* Pie: состояние */}
        <div style={card}>
          <div style={cardTitle}>Распределение по состоянию</div>
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%"
                   innerRadius={50} outerRadius={85} paddingAngle={2}>
                {pieData.map((e, i) => <Cell key={i} fill={e.color} stroke="var(--panel)" strokeWidth={2} />)}
              </Pie>
              <Tooltip contentStyle={tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: 12, color: "var(--text-dim)" }} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Histogram: возраст */}
        <div style={card}>
          <div style={cardTitle}>Распределение по возрасту</div>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={ageData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="bucket" tick={{ fill: "var(--text-dim)", fontSize: 11 }} />
              <YAxis tick={{ fill: "var(--text-dim)", fontSize: 11 }} />
              <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
              <Bar dataKey="count" fill="var(--accent-2)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Bar+Line: риск по десятилетиям */}
      <div style={card}>
        <div style={cardTitle}>Средний риск и количество объектов по десятилетиям постройки</div>
        <ResponsiveContainer width="100%" height={280}>
          <ComposedChart data={decadeData}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey="decade" tick={{ fill: "var(--text-dim)", fontSize: 11 }} />
            <YAxis yAxisId="left" tick={{ fill: "var(--text-dim)", fontSize: 11 }} />
            <YAxis yAxisId="right" orientation="right" tick={{ fill: "var(--text-dim)", fontSize: 11 }}
                   domain={[0, 100]} unit="%" />
            <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar yAxisId="left" dataKey="count" name="Кол-во" fill="#38bdf8" radius={[4, 4, 0, 0]} />
            <Line yAxisId="right" dataKey="risk" name="Риск, %" stroke="#ef4444" strokeWidth={2} dot={{ r: 3 }} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
