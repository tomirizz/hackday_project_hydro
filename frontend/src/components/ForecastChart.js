import React, { useState, useEffect } from "react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from "recharts";
import { fetchForecast } from "../api/client";
import { useApp } from "../AppContext";

export default function ForecastChart({ objectId }) {
  const { t } = useApp();
  const [data, setData] = useState(null);

  useEffect(() => {
    if (!objectId) return;
    setData(null);
    fetchForecast(objectId).then(setData).catch(() => {});
  }, [objectId]);

  const tooltipStyle = {
    background: "var(--panel-2)", border: "1px solid var(--border)",
    borderRadius: 6, color: "var(--text)", fontSize: 12,
  };

  if (!data) {
    return <div style={{ fontSize: 12, color: "var(--text-dim)", padding: "8px 0" }}>{t("forecastLoading")}</div>;
  }

  const chartData = data.trajectory.map((tr) => ({
    year: tr.year,
    risk: Math.round(tr.risk * 100),
  }));

  return (
    <div>
      <div style={{ fontSize: 13, marginBottom: 8 }}>
        {data.critical_year ? (
          <span>
            {t("forecastCritical")}: <strong style={{ color: "var(--c-critical)" }}>{data.critical_year}</strong>
            {" "}({t("forecastInYears")} {data.years_to_critical} {t("forecastYears")})
          </span>
        ) : (
          <span style={{ color: "var(--text-dim)" }}>{t("forecastSafe")}</span>
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
          <Tooltip contentStyle={tooltipStyle} formatter={(v) => [`${v}%`, t("drillRisk")]} />
          <ReferenceLine y={70} stroke="#ef4444" strokeDasharray="4 4"
                         label={{ value: t("forecastThreshold"), fill: "#ef4444", fontSize: 10, position: "insideTopRight" }} />
          <Area dataKey="risk" stroke="#ef4444" strokeWidth={2} fill="url(#riskGrad)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
