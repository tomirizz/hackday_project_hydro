import React, { useMemo } from "react";
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ComposedChart, Line, LabelList,
} from "recharts";
import { Boxes, Activity, AlertTriangle, Gauge, Droplets, Sprout, Clock } from "lucide-react";
import AnimatedNumber from "../AnimatedNumber";
import { Card, CardHead, Delta, Empty, tooltipStyle } from "./ui";
import {
  dimChartData, decadeRiskData, computeKPIs,
} from "../../analytics/model";
import { L } from "../../analytics/i18n_analytics";

// ── Диаграмма-слайсер (кольцевая) ───────────────────────────────────────────
function SlicerDonut({ dimId, data, onToggle, height = 210 }) {
  if (!data.length) return <Empty text="—" />;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Pie
          data={data} dataKey="value" nameKey="name" cx="50%" cy="50%"
          innerRadius={48} outerRadius={80} paddingAngle={2}
          onClick={(e) => e && onToggle(dimId, e.key)}
          style={{ cursor: "pointer" }} isAnimationActive={false}
        >
          {data.map((e, i) => (
            <Cell key={i} fill={e.color} stroke="var(--panel)" strokeWidth={2}
                  fillOpacity={e.selected ? 1 : 0.22} />
          ))}
        </Pie>
        <Tooltip contentStyle={tooltipStyle} formatter={(v, n) => [v, n]} />
      </PieChart>
    </ResponsiveContainer>
  );
}

// Компактная легенда с кликом (общая для кольцевых)
function ChipLegend({ dimId, data, onToggle }) {
  const totalSel = data.filter((d) => d.selected).reduce((s, d) => s + d.value, 0);
  const total = data.reduce((s, d) => s + d.value, 0) || 1;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 5, marginTop: 8 }}>
      {data.map((d) => (
        <button key={d.key} onClick={() => onToggle(dimId, d.key)} style={{
          display: "flex", alignItems: "center", gap: 7, fontSize: 11.5,
          background: "none", border: "none", padding: "2px 0", textAlign: "left",
          color: "var(--text)", opacity: d.selected ? 1 : 0.45, cursor: "pointer",
        }}>
          <span style={{ width: 9, height: 9, borderRadius: 3, background: d.color, flexShrink: 0 }} />
          <span style={{ flex: 1, color: "var(--text-dim)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.name}</span>
          <span className="mono" style={{ fontWeight: 600 }}>{d.value}</span>
          <span style={{ width: 42, textAlign: "right", color: "var(--text-dim)" }}>
            {Math.round((d.value / total) * 100)}%
          </span>
        </button>
      ))}
      {totalSel !== total && (
        <div style={{ fontSize: 10.5, color: "var(--accent)", marginTop: 2 }}>
          {totalSel} {L("ru", "selected")}
        </div>
      )}
    </div>
  );
}

// ── Диаграмма-слайсер (бары) ────────────────────────────────────────────────
function SlicerBars({ dimId, data, onToggle, layout = "horizontal", height = 220, lang }) {
  if (!data.length) return <Empty text={L(lang, "noData")} />;
  const vertical = layout === "vertical";
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout={layout}
                margin={vertical ? { left: 6, right: 18, top: 4 } : { top: 8, right: 8, left: -10 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)"
                       horizontal={!vertical} vertical={vertical} />
        {vertical ? (
          <>
            <XAxis type="number" tick={{ fill: "var(--text-dim)", fontSize: 11 }} />
            <YAxis type="category" dataKey="name" width={96}
                   tick={{ fill: "var(--text-dim)", fontSize: 11 }} />
          </>
        ) : (
          <>
            <XAxis dataKey="name" tick={{ fill: "var(--text-dim)", fontSize: 11 }} interval={0} />
            <YAxis tick={{ fill: "var(--text-dim)", fontSize: 11 }} allowDecimals={false} />
          </>
        )}
        <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "rgba(128,128,128,0.08)" }} />
        <Bar dataKey="value" radius={vertical ? [0, 5, 5, 0] : [5, 5, 0, 0]}
             barSize={vertical ? 18 : 40}
             onClick={(e) => e && onToggle(dimId, e.key)} style={{ cursor: "pointer" }}
             isAnimationActive={false}>
          {data.map((e, i) => (
            <Cell key={i} fill={e.color} fillOpacity={e.selected ? 1 : 0.25} />
          ))}
          <LabelList dataKey="value" position={vertical ? "right" : "top"}
                     style={{ fill: "var(--text-dim)", fontSize: 10 }} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

// ── KPI карточка ────────────────────────────────────────────────────────────
function KPI({ label, value, suffix, decimals = 0, accent, delta }) {
  return (
    <Card className="lift-hover" style={{ padding: 14 }}>
      <div style={{ fontSize: 11.5, color: "var(--text-dim)", marginBottom: 6 }}>{label}</div>
      <div className="mono" style={{ fontSize: 25, fontWeight: 700, color: accent || "var(--text)", lineHeight: 1.1 }}>
        <AnimatedNumber value={value} decimals={decimals} />
        <span style={{ fontSize: 13, color: "var(--text-dim)" }}>{suffix}</span>
      </div>
      {delta && <div style={{ marginTop: 5 }}>{delta}</div>}
    </Card>
  );
}

export default function AnalyticsOverview({ objects, filtered, filters, dims, onToggle, lang }) {
  const tt = (k, v) => L(lang, k, v);

  const catData = useMemo(() => dimChartData(objects, filters, dims, "category"), [objects, filters, dims]);
  const typeData = useMemo(() => dimChartData(objects, filters, dims, "type"), [objects, filters, dims]);
  const sigData = useMemo(() => dimChartData(objects, filters, dims, "significance"), [objects, filters, dims]);
  const zoneData = useMemo(() => dimChartData(objects, filters, dims, "zone"), [objects, filters, dims]);
  const ageData = useMemo(() => dimChartData(objects, filters, dims, "ageBucket"), [objects, filters, dims]);
  const decadeData = useMemo(() => decadeRiskData(objects, filters, dims), [objects, filters, dims]);
  const { sel, base } = useMemo(() => computeKPIs(filtered, objects), [filtered, objects]);

  const isFiltered = filtered.length !== objects.length;

  // Индекс состояния (полукруг)
  const condIndex = Math.max(0, Math.round(100 - sel.risk));
  const idxColor =
    condIndex >= 80 ? "var(--c-normal)" :
    condIndex >= 60 ? "var(--c-watch)" :
    condIndex >= 45 ? "var(--c-repair)" : "var(--c-critical)";
  const idxRating =
    condIndex >= 80 ? L(lang, "cat_normal") :
    condIndex >= 60 ? L(lang, "cat_watch") :
    condIndex >= 45 ? L(lang, "cat_repair") : L(lang, "cat_critical");
  const gauge = [
    { v: condIndex, color: idxColor },
    { v: 100 - condIndex, color: "var(--border)" },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* KPI */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12 }}>
        <KPI label={tt("kpiTotal")} value={sel.total} />
        <KPI label={tt("kpiRisk")} value={sel.risk} suffix="%" decimals={1} accent="var(--accent)"
             delta={isFiltered && <Delta value={sel.risk} baseline={base.risk} suffix="%" invert t={tt} />} />
        <KPI label={tt("kpiCritical")} value={sel.critical} accent="var(--c-critical)" />
        <KPI label={tt("kpiKpd")} value={sel.kpd} suffix="%" decimals={1}
             delta={isFiltered && <Delta value={sel.kpd} baseline={base.kpd} suffix="%" t={tt} />} />
        <KPI label={tt("kpiAge")} value={sel.age} suffix={` ${tt("years")}`}
             delta={isFiltered && <Delta value={sel.age} baseline={base.age} suffix="" invert t={tt} />} />
        <KPI label={tt("kpiArea")} value={sel.area} suffix={` ${tt("kpiAreaUnit")}`} />
      </div>

      {/* Ряд 1: типы · состояние · индекс */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(290px, 1fr))", gap: 16 }}>
        <Card>
          <CardHead icon={Boxes} title={tt("byType")} />
          <SlicerDonut dimId="type" data={typeData} onToggle={onToggle} />
          <ChipLegend dimId="type" data={typeData} onToggle={onToggle} />
        </Card>
        <Card>
          <CardHead icon={Activity} title={tt("byState")} />
          <SlicerDonut dimId="category" data={catData} onToggle={onToggle} />
          <ChipLegend dimId="category" data={catData} onToggle={onToggle} />
        </Card>
        <Card>
          <CardHead icon={Gauge} title={tt("condIndex")} />
          <div style={{ position: "relative", height: 150 }}>
            <ResponsiveContainer width="100%" height={150}>
              <PieChart>
                <Pie data={gauge} dataKey="v" startAngle={180} endAngle={0}
                     cx="50%" cy="92%" innerRadius={62} outerRadius={92} stroke="none"
                     isAnimationActive={false}>
                  {gauge.map((e, i) => <Cell key={i} fill={e.color} />)}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div style={{ position: "absolute", left: 0, right: 0, bottom: 8, textAlign: "center" }}>
              <div className="mono" style={{ fontSize: 38, fontWeight: 800, color: idxColor, lineHeight: 1 }}>
                {condIndex}<span style={{ fontSize: 14, color: "var(--text-dim)" }}>/100</span>
              </div>
              <div style={{ fontSize: 12.5, color: idxColor, fontWeight: 600, marginTop: 4 }}>{idxRating}</div>
            </div>
          </div>
        </Card>
      </div>

      {/* Ряд 2: значимость · зоны · возраст */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(290px, 1fr))", gap: 16 }}>
        <Card>
          <CardHead icon={AlertTriangle} title={tt("bySig")} />
          <SlicerBars dimId="significance" data={sigData} onToggle={onToggle} lang={lang} />
        </Card>
        <Card>
          <CardHead icon={Droplets} title={tt("byZone")} />
          <SlicerBars dimId="zone" data={zoneData} onToggle={onToggle} layout="vertical" lang={lang} />
        </Card>
        <Card>
          <CardHead icon={Clock} title={tt("byAge")} />
          <SlicerBars dimId="ageBucket" data={ageData} onToggle={onToggle} lang={lang} />
        </Card>
      </div>

      {/* Ряд 3: десятилетия */}
      <Card>
        <CardHead icon={Sprout} title={tt("byDecade")} />
        {decadeData.length === 0 ? <Empty text={tt("noData")} /> : (
          <ResponsiveContainer width="100%" height={260}>
            <ComposedChart data={decadeData} margin={{ top: 8, right: 8, left: -8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="decade" tick={{ fill: "var(--text-dim)", fontSize: 11 }} />
              <YAxis yAxisId="l" tick={{ fill: "var(--text-dim)", fontSize: 11 }} allowDecimals={false} />
              <YAxis yAxisId="r" orientation="right" domain={[0, 100]} unit="%"
                     tick={{ fill: "var(--text-dim)", fontSize: 11 }} />
              <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "rgba(128,128,128,0.08)" }} />
              <Bar yAxisId="l" dataKey="count" name={tt("count")} radius={[5, 5, 0, 0]}
                   onClick={(e) => e && onToggle("decade", e.decadeNum)} style={{ cursor: "pointer" }}
                   isAnimationActive={false}>
                {decadeData.map((e, i) => (
                  <Cell key={i} fill="#38bdf8" fillOpacity={e.selected ? 1 : 0.25} />
                ))}
              </Bar>
              <Line yAxisId="r" dataKey="risk" name={tt("riskPct")} stroke="var(--c-critical)"
                    strokeWidth={2} dot={{ r: 3 }} isAnimationActive={false} />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </Card>
    </div>
  );
}
