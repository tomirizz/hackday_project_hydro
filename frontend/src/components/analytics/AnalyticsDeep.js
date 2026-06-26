import React, { useMemo } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Cell, LabelList, ReferenceLine, ScatterChart, Scatter, ZAxis,
  ComposedChart, Line, AreaChart, Area,
} from "recharts";
import {
  Sparkles, GitBranch, ScatterChart as ScatterIcon, TrendingUp, Target,
  Wrench,
} from "lucide-react";
import { Card, CardHead, Empty, tooltipStyle, InsightCard } from "./ui";
import { CAT_COLOR } from "../../analytics/model";
import {
  generateInsights, riskDrivers, ageRiskScatter, degradationForecast,
  paretoAnalysis, repairPriorities,
} from "../../analytics/model";
import { L } from "../../analytics/i18n_analytics";

// Точки scatter рисуем сами — полный контроль над размером/цветом
const Dot = (props) => {
  const { cx, cy, payload } = props;
  if (cx == null || cy == null) return null;
  return <circle cx={cx} cy={cy} r={3.4} fill={payload.color} fillOpacity={0.72} />;
};
const Ring = (props) => {
  const { cx, cy } = props;
  if (cx == null || cy == null) return null;
  return (
    <g>
      <circle cx={cx} cy={cy} r={7} fill="none" stroke="var(--c-critical)" strokeWidth={1.8} />
      <circle cx={cx} cy={cy} r={2.4} fill="var(--c-critical)" />
    </g>
  );
};

function ScatterTip({ active, payload, lang }) {
  if (!active || !payload || !payload.length) return null;
  const p = payload[0].payload;
  return (
    <div style={tooltipStyle}>
      <div style={{ padding: "7px 10px" }}>
        <div style={{ fontWeight: 600, marginBottom: 3, maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</div>
        <div style={{ color: "var(--text-dim)" }}>{L(lang, "axisAge")}: <b style={{ color: "var(--text)" }}>{p.x}</b></div>
        <div style={{ color: "var(--text-dim)" }}>{L(lang, "axisRisk")}: <b style={{ color: "var(--text)" }}>{p.y}%</b></div>
        {p.anomaly && <div style={{ color: "var(--c-critical)", marginTop: 3, fontWeight: 600 }}>⚠ {L(lang, "anomaly")}</div>}
      </div>
    </div>
  );
}

export default function AnalyticsDeep({ filtered, lang }) {
  const tt = (k, v) => L(lang, k, v);

  const insights = useMemo(() => generateInsights(filtered, lang), [filtered, lang]);
  const drivers = useMemo(() => riskDrivers(filtered, lang), [filtered, lang]);
  const scatter = useMemo(() => ageRiskScatter(filtered), [filtered]);
  const forecast = useMemo(() => degradationForecast(filtered, 20), [filtered]);
  const pareto = useMemo(() => paretoAnalysis(filtered), [filtered]);
  const priorities = useMemo(() => repairPriorities(filtered, 12), [filtered]);

  const driverData = drivers.map((d) => ({
    name: d.label, r: d.r,
    color: d.r > 0 ? "var(--c-critical)" : "var(--c-normal)",
  }));

  const fcNow = forecast.length ? forecast[0].share : 0;
  const fcEnd = forecast.length ? forecast[forecast.length - 1] : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

      {/* ── Автоматические инсайты ── */}
      <div>
        <CardHead icon={Sparkles} title={tt("autoInsights")} hint={tt("autoInsightsHint")} />
        {insights.length === 0 ? (
          <Empty text={tt("noData")} />
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 14 }}>
            {insights.slice(0, 6).map((ins, i) => <InsightCard key={i} insight={ins} />)}
          </div>
        )}
      </div>

      {/* ── Драйверы риска + Scatter ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: 16 }}>
        <Card>
          <CardHead icon={GitBranch} title={tt("driversTitle")} hint={tt("driversHint")} />
          {driverData.length === 0 ? <Empty text={tt("driverWeak")} /> : (
            <ResponsiveContainer width="100%" height={Math.max(180, driverData.length * 40)}>
              <BarChart data={driverData} layout="vertical" margin={{ left: 8, right: 40, top: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                <XAxis type="number" domain={[-1, 1]} ticks={[-1, -0.5, 0, 0.5, 1]}
                       tick={{ fill: "var(--text-dim)", fontSize: 10 }} />
                <YAxis type="category" dataKey="name" width={120}
                       tick={{ fill: "var(--text-dim)", fontSize: 11 }} />
                <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "rgba(128,128,128,0.06)" }}
                         formatter={(v) => [v, "r"]} />
                <ReferenceLine x={0} stroke="var(--text-dim)" />
                <Bar dataKey="r" radius={[3, 3, 3, 3]} barSize={18} isAnimationActive={false}>
                  {driverData.map((e, i) => <Cell key={i} fill={e.color} />)}
                  <LabelList dataKey="r" position="right"
                             formatter={(v) => (v > 0 ? `+${v}` : v)}
                             style={{ fill: "var(--text-dim)", fontSize: 10 }} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
          <div style={{ display: "flex", gap: 16, marginTop: 8, fontSize: 11, color: "var(--text-dim)" }}>
            <span><span style={{ display: "inline-block", width: 9, height: 9, borderRadius: 2, background: "var(--c-critical)", marginRight: 5 }} />{tt("driverIncreases")}</span>
            <span><span style={{ display: "inline-block", width: 9, height: 9, borderRadius: 2, background: "var(--c-normal)", marginRight: 5 }} />{tt("driverDecreases")}</span>
          </div>
        </Card>

        <Card>
          <CardHead icon={ScatterIcon} title={tt("scatterTitle")} hint={tt("scatterHint")} />
          {scatter.points.length < 4 ? <Empty text={tt("noData")} /> : (
            <ResponsiveContainer width="100%" height={260}>
              <ScatterChart margin={{ top: 8, right: 16, bottom: 18, left: -6 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis type="number" dataKey="x" name="age"
                       tick={{ fill: "var(--text-dim)", fontSize: 11 }}
                       label={{ value: tt("axisAge"), position: "insideBottom", offset: -10, fill: "var(--text-dim)", fontSize: 11 }} />
                <YAxis type="number" dataKey="y" name="risk" unit="%"
                       tick={{ fill: "var(--text-dim)", fontSize: 11 }} />
                <ZAxis range={[40, 40]} />
                <Tooltip content={<ScatterTip lang={lang} />} cursor={{ strokeDasharray: "3 3" }} />
                <Scatter data={scatter.points} shape={Dot} isAnimationActive={false} />
                {scatter.anomalies.length > 0 && (
                  <Scatter data={scatter.anomalies} shape={Ring} isAnimationActive={false} />
                )}
                {scatter.trend && (
                  <Scatter data={scatter.trend} line={{ stroke: "var(--accent)", strokeWidth: 2, strokeDasharray: "6 4" }}
                           shape={() => null} legendType="none" isAnimationActive={false} />
                )}
              </ScatterChart>
            </ResponsiveContainer>
          )}
          <div style={{ display: "flex", gap: 16, marginTop: 6, fontSize: 11, color: "var(--text-dim)" }}>
            <span><span style={{ display: "inline-block", width: 14, height: 0, borderTop: "2px dashed var(--accent)", marginRight: 5, verticalAlign: "middle" }} />{tt("trendLine")}</span>
            <span><span style={{ display: "inline-block", width: 9, height: 9, borderRadius: "50%", border: "2px solid var(--c-critical)", marginRight: 5, verticalAlign: "middle" }} />{tt("anomaly")} ({scatter.anomalies.length})</span>
          </div>
        </Card>
      </div>

      {/* ── Прогноз деградации ── */}
      <Card>
        <CardHead icon={TrendingUp} title={tt("forecastTitle")} hint={tt("forecastHint")} />
        {forecast.length === 0 ? <Empty text={tt("noData")} /> : (
          <>
            <ResponsiveContainer width="100%" height={250}>
              <AreaChart data={forecast} margin={{ top: 8, right: 12, left: -8 }}>
                <defs>
                  <linearGradient id="fcGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--c-critical)" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="var(--c-critical)" stopOpacity={0.04} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="year" tick={{ fill: "var(--text-dim)", fontSize: 11 }}
                       interval={3} />
                <YAxis tick={{ fill: "var(--text-dim)", fontSize: 11 }} unit="%" domain={[0, "auto"]} />
                <Tooltip contentStyle={tooltipStyle}
                         formatter={(v, n, p) => [`${v}% (${p.payload.count})`, tt("forecastShare")]} />
                <ReferenceLine y={fcNow} stroke="var(--text-dim)" strokeDasharray="4 4"
                               label={{ value: tt("forecastNow"), position: "insideTopLeft", fill: "var(--text-dim)", fontSize: 10 }} />
                <Area type="monotone" dataKey="share" stroke="var(--c-critical)" strokeWidth={2.5}
                      fill="url(#fcGrad)" isAnimationActive={false} />
              </AreaChart>
            </ResponsiveContainer>
            {fcEnd && (
              <div style={{ fontSize: 12.5, color: "var(--text-dim)", marginTop: 8, lineHeight: 1.5 }}>
                {tt("forecastBy", { year: fcEnd.year })}: <b style={{ color: "var(--c-critical)" }}>{fcEnd.count}</b> {tt("forecastCritical")} ({fcEnd.share}%).
              </div>
            )}
          </>
        )}
      </Card>

      {/* ── Парето ── */}
      <Card>
        <CardHead icon={Target} title={tt("paretoTitle")} hint={tt("paretoHint")} />
        {pareto.chart.length < 3 ? <Empty text={tt("noData")} /> : (
          <>
            <ResponsiveContainer width="100%" height={250}>
              <ComposedChart data={pareto.chart} margin={{ top: 8, right: 8, left: -8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="idx" tick={{ fill: "var(--text-dim)", fontSize: 10 }} />
                <YAxis yAxisId="l" tick={{ fill: "var(--text-dim)", fontSize: 10 }} unit="%" />
                <YAxis yAxisId="r" orientation="right" domain={[0, 100]} unit="%"
                       tick={{ fill: "var(--text-dim)", fontSize: 10 }} />
                <Tooltip contentStyle={tooltipStyle}
                         labelFormatter={(v) => `#${v}`}
                         formatter={(v, n) => [`${v}%`, n === "cumPct" ? tt("paretoCum") : tt("paretoContribution")]} />
                <ReferenceLine yAxisId="r" y={80} stroke="var(--accent)" strokeDasharray="5 4"
                               label={{ value: "80%", position: "right", fill: "var(--accent)", fontSize: 10 }} />
                <Bar yAxisId="l" dataKey="contribPct" fill="var(--accent-2)" radius={[3, 3, 0, 0]}
                     barSize={10} isAnimationActive={false} />
                <Line yAxisId="r" dataKey="cumPct" stroke="var(--accent)" strokeWidth={2}
                      dot={false} isAnimationActive={false} />
              </ComposedChart>
            </ResponsiveContainer>
            <div style={{ fontSize: 12.5, color: "var(--text-dim)", marginTop: 8, lineHeight: 1.5 }}>
              {tt("paretoInsight", { n: pareto.n80, pct: pareto.pctObjects, areapct: pareto.areaPct })}
            </div>
          </>
        )}
      </Card>

      {/* ── Приоритеты ремонта ── */}
      <Card>
        <CardHead icon={Wrench} title={tt("priorityTitle")}
                  hint={tt("priorityHint")}
                  right={<span style={{ fontSize: 10.5, color: "var(--text-dim)", textTransform: "none", letterSpacing: 0 }}>{tt("prioritySub")}</span>} />
        {priorities.length === 0 ? <Empty text={tt("noData")} /> : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5, minWidth: 540 }}>
              <thead>
                <tr style={{ color: "var(--text-dim)", fontSize: 11, textAlign: "left" }}>
                  <th style={{ padding: "6px 8px", width: 28 }}>#</th>
                  <th style={{ padding: "6px 8px" }}>{tt("pName")}</th>
                  <th style={{ padding: "6px 8px", width: 60 }}>{tt("pRisk")}</th>
                  <th style={{ padding: "6px 8px", width: 90, textAlign: "right" }}>{tt("pArea")}</th>
                  <th style={{ padding: "6px 8px", width: 150 }}>{tt("pScore")}</th>
                </tr>
              </thead>
              <tbody>
                {priorities.map((o, i) => (
                  <tr key={o.id} style={{ borderTop: "1px solid var(--border)" }}>
                    <td className="mono" style={{ padding: "8px", color: "var(--text-dim)", fontWeight: 700 }}>{i + 1}</td>
                    <td style={{ padding: "8px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                        <span style={{ width: 8, height: 8, borderRadius: "50%", background: CAT_COLOR[o.category] || "#64748b", flexShrink: 0 }} />
                        <span style={{ maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{o.name}</span>
                      </div>
                    </td>
                    <td className="mono" style={{ padding: "8px", color: CAT_COLOR[o.category], fontWeight: 600 }}>{o.risk}%</td>
                    <td className="mono" style={{ padding: "8px", textAlign: "right", color: "var(--text-dim)" }}>
                      {o.area ? new Intl.NumberFormat("ru-RU").format(o.area) : "—"}
                    </td>
                    <td style={{ padding: "8px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{ flex: 1, height: 7, background: "var(--panel-2)", borderRadius: 4, overflow: "hidden" }}>
                          <div style={{ width: `${o.score}%`, height: "100%", background: "linear-gradient(90deg, var(--accent-2), var(--accent))", borderRadius: 4 }} />
                        </div>
                        <span className="mono" style={{ fontSize: 11, color: "var(--text-dim)", width: 26, textAlign: "right" }}>{o.score}</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
