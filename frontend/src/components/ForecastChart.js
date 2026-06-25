import React, { useState, useEffect } from "react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from "recharts";
import { fetchForecast } from "../api/client";

const tooltipStyle = {
  background: "var(--panel-2)",
  border: "1px solid var(--border)",
  borderRadius: 6,
  color: "var(--text)",
  fontSize: 12,
};

export default function ForecastChart({ objectId }) {
  const [data, setData] = useState(null);

  useEffect(() => {
    if (!objectId) return;
    setData(null);
    fetchForecast(objectId).then(setData).catch(() => {});
  }, [objectId]);

  if (!data) {
    return <div style={{ fontSize: 12, color: "var(--text-dim)", padding: "8px 0" }}>Загрузка прогноза…</div>;
  }

  const chartData = data.trajectory.map((t) => ({
    year: t.year,
    risk: Math.round(t.risk * 100),
  }));

  return (
    <div>
      <div style={{ fontSize: 13, marginBottom: 8 }}>
        {data.critical_year ? (
          <span>
            Прогноз перехода в аварийное состояние: <strong style={{ color: "#ef4444" }}>{data.critical_year} г.</strong>
            {" "}(через {data.years_to_critical} лет)
          </span>
        ) : (
          <span style={{ color: "var(--text-dim)" }}>
            При текущих темпах объект не достигнет аварийного состояния в ближайшие 25 лет.
          </span>
        )}
      </div>

      <ResponsiveContainer width="100%" height={160}>
        <AreaChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="riskGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#ef4444" stopOpacity={0.5} />
              <stop offset="100%" stopColor="#ef4444" stopOpacity={0.05} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis dataKey="year" tick={{ fill: "var(--text-dim)", fontSize: 10 }} interval={4} />
          <YAxis domain={[0, 100]} tick={{ fill: "var(--text-dim)", fontSize: 10 }} />
          <Tooltip contentStyle={tooltipStyle} formatter={(v) => [`${v}%`, "Риск"]} />
          <ReferenceLine y={70} stroke="#ef4444" strokeDasharray="4 4"
                         label={{ value: "Авария", fill: "#ef4444", fontSize: 10, position: "insideTopRight" }} />
          <Area dataKey="risk" stroke="#ef4444" strokeWidth={2} fill="url(#riskGrad)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
