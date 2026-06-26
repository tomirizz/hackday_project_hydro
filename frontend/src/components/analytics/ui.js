import React from "react";
import {
  Droplets, Sprout, Zap, GitBranch, TrendingUp, MapPin, AlertTriangle,
  History, Target, Activity, Gauge, Boxes, Layers, X, ArrowUp, ArrowDown,
} from "lucide-react";

// Карта строковых имён иконок (инсайты возвращают имя строкой)
export const ICONS = {
  Droplets, Sprout, Zap, GitBranch, TrendingUp, MapPin, AlertTriangle,
  History, Target, Activity, Gauge, Boxes, Layers,
};

export const card = {
  background: "var(--panel)",
  border: "1px solid var(--border)",
  borderRadius: 12,
  padding: 16,
};

export const tooltipStyle = {
  background: "var(--panel-2)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  color: "var(--text)",
  fontSize: 12,
  boxShadow: "var(--shadow)",
};

export function Card({ children, style, className }) {
  return (
    <div className={className} style={{ ...card, ...style }}>
      {children}
    </div>
  );
}

export function CardHead({ icon: Icon, title, hint, right }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
        {Icon && <Icon size={15} color="var(--accent)" />}
        <span style={{
          fontSize: 12, textTransform: "uppercase", letterSpacing: "0.05em",
          color: "var(--text-dim)", fontWeight: 600,
        }}>
          {title}
        </span>
        {right && <span style={{ marginLeft: "auto" }}>{right}</span>}
      </div>
      {hint && (
        <div style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 5, lineHeight: 1.45, opacity: 0.85 }}>
          {hint}
        </div>
      )}
    </div>
  );
}

// Чип активного фильтра
export function Chip({ color, label, value, onRemove }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 7,
      background: "var(--panel-2)", border: `1px solid ${color || "var(--accent)"}`,
      borderRadius: 999, padding: "4px 6px 4px 11px", fontSize: 12,
    }}>
      <span style={{ width: 8, height: 8, borderRadius: "50%", background: color || "var(--accent)", flexShrink: 0 }} />
      <span style={{ color: "var(--text-dim)" }}>{label}:</span>
      <span style={{ fontWeight: 600 }}>{value}</span>
      <button onClick={onRemove} style={{
        display: "flex", background: "none", border: "none", color: "var(--text-dim)",
        cursor: "pointer", padding: 2, borderRadius: "50%", lineHeight: 0,
      }}>
        <X size={13} />
      </button>
    </span>
  );
}

const TONES = {
  info: { color: "var(--accent)", glow: "rgba(45,212,191,0.10)" },
  warn: { color: "var(--c-repair)", glow: "rgba(249,115,22,0.10)" },
  danger: { color: "var(--c-critical)", glow: "rgba(239,68,68,0.12)" },
};

// Карточка автоматического инсайта
export function InsightCard({ insight }) {
  const tone = TONES[insight.tone] || TONES.info;
  const Icon = ICONS[insight.icon] || Activity;
  return (
    <div className="lift-hover" style={{
      ...card,
      borderLeft: `3px solid ${tone.color}`,
      background: `linear-gradient(180deg, ${tone.glow}, transparent 60%), var(--panel)`,
      display: "flex", flexDirection: "column", gap: 8,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
        <span style={{
          display: "flex", alignItems: "center", justifyContent: "center",
          width: 30, height: 30, borderRadius: 8, flexShrink: 0,
          background: tone.glow, color: tone.color,
        }}>
          <Icon size={16} />
        </span>
        <div style={{ fontSize: 13.5, fontWeight: 600, lineHeight: 1.25 }}>{insight.title}</div>
      </div>
      <div style={{ fontSize: 12.5, color: "var(--text-dim)", lineHeight: 1.55 }}>
        {insight.body}
      </div>
    </div>
  );
}

// Маленький индикатор «выше/ниже среднего»
export function Delta({ value, baseline, suffix = "", invert = false, t }) {
  if (baseline == null || value == null) return null;
  const diff = value - baseline;
  if (Math.abs(diff) < 0.05) {
    return <span style={{ fontSize: 11, color: "var(--text-dim)" }}>≈ {t("same")} {t("vsAll")}</span>;
  }
  // invert=true → рост это «хуже» (красный). Для риска invert=true.
  const worse = invert ? diff > 0 : diff < 0;
  const color = worse ? "var(--c-critical)" : "var(--c-normal)";
  const Arrow = diff > 0 ? ArrowUp : ArrowDown;
  const word = diff > 0 ? t("higher") : t("lower");
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 11, color }}>
      <Arrow size={11} />
      {Math.abs(Math.round(diff * 10) / 10)}{suffix} {word}
    </span>
  );
}

export function Empty({ text }) {
  return (
    <div style={{
      padding: "40px 20px", textAlign: "center", color: "var(--text-dim)",
      fontSize: 13, border: "1px dashed var(--border)", borderRadius: 10,
    }}>
      {text}
    </div>
  );
}
