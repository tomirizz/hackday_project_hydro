import React from "react";
import { CATEGORIES, OBJECT_TYPES } from "../constants";

const wrap = {
  padding: "16px",
  borderBottom: "1px solid var(--border)",
};
const label = {
  fontSize: 11,
  textTransform: "uppercase",
  letterSpacing: "0.05em",
  color: "var(--text-dim)",
  marginBottom: 8,
  display: "block",
};
const input = {
  width: "100%",
  background: "var(--panel-2)",
  border: "1px solid var(--border)",
  borderRadius: 6,
  color: "var(--text)",
  padding: "8px 10px",
  fontSize: 13,
};

export default function Filters({ filters, setFilters, total }) {
  const update = (key, val) => setFilters((f) => ({ ...f, [key]: val }));

  const toggleCategory = (cat) => {
    update("category", filters.category === cat ? null : cat);
  };

  return (
    <div>
      <div style={wrap}>
        <span style={label}>Состояние</span>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {Object.entries(CATEGORIES).map(([key, c]) => {
            const active = filters.category === key;
            return (
              <button
                key={key}
                onClick={() => toggleCategory(key)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  background: active ? "var(--panel-2)" : "transparent",
                  border: `1px solid ${active ? c.color : "var(--border)"}`,
                  borderRadius: 6,
                  padding: "7px 10px",
                  color: "var(--text)",
                  fontSize: 13,
                  textAlign: "left",
                  transition: "all 0.15s",
                }}
              >
                <span style={{
                  width: 10, height: 10, borderRadius: "50%",
                  background: c.color, flexShrink: 0,
                }} />
                {c.label}
              </button>
            );
          })}
        </div>
      </div>

      <div style={wrap}>
        <span style={label}>Тип объекта</span>
        <select
          style={input}
          value={filters.typeCode || ""}
          onChange={(e) => update("typeCode", e.target.value || null)}
        >
          <option value="">Все типы</option>
          {Object.entries(OBJECT_TYPES).map(([code, name]) => (
            <option key={code} value={code}>{name}</option>
          ))}
        </select>
      </div>

      <div style={wrap}>
        <span style={label}>Район</span>
        <input
          style={input}
          placeholder="Поиск по району"
          value={filters.district || ""}
          onChange={(e) => update("district", e.target.value || null)}
        />
      </div>

      <div style={wrap}>
        <span style={label}>Год постройки</span>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            style={input}
            type="number"
            placeholder="с"
            value={filters.yearFrom || ""}
            onChange={(e) => update("yearFrom", e.target.value || null)}
          />
          <input
            style={input}
            type="number"
            placeholder="по"
            value={filters.yearTo || ""}
            onChange={(e) => update("yearTo", e.target.value || null)}
          />
        </div>
      </div>

      <div style={wrap}>
        <span style={label}>Минимальный риск: {((filters.minRisk || 0) * 100).toFixed(0)}%</span>
        <input
          type="range"
          min="0" max="1" step="0.05"
          value={filters.minRisk || 0}
          onChange={(e) => update("minRisk", parseFloat(e.target.value) || null)}
          style={{ width: "100%", accentColor: "var(--accent)" }}
        />
      </div>

      <div style={{ ...wrap, borderBottom: "none" }}>
        <button
          onClick={() => setFilters({})}
          style={{
            width: "100%",
            background: "transparent",
            border: "1px solid var(--border)",
            borderRadius: 6,
            color: "var(--text-dim)",
            padding: "8px",
            fontSize: 13,
          }}
        >
          Сбросить фильтры
        </button>
        <div style={{ marginTop: 12, fontSize: 12, color: "var(--text-dim)", textAlign: "center" }}>
          Найдено объектов: <strong style={{ color: "var(--accent)" }}>{total}</strong>
        </div>
      </div>
    </div>
  );
}
