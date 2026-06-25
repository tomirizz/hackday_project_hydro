import React, { useState, useEffect, useCallback } from "react";
import { fetchObjects, fetchObject, fetchDashboard } from "./api/client";
import MapView from "./components/MapView";
import Filters from "./components/Filters";
import ObjectList from "./components/ObjectList";
import ObjectCard from "./components/ObjectCard";
import Dashboard from "./components/Dashboard";
import HydroBot from "./components/HydroBot";
import { Droplets, Map as MapIcon, BarChart3, Flame, Bot, Menu } from "lucide-react";

export default function App() {
  const [tab, setTab] = useState("map");          // map | dashboard
  const [objects, setObjects] = useState([]);
  const [total, setTotal] = useState(0);
  const [filters, setFilters] = useState({});
  const [selectedId, setSelectedId] = useState(null);
  const [selectedObject, setSelectedObject] = useState(null);
  const [flyTarget, setFlyTarget] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [showHeat, setShowHeat] = useState(false);
  const [heatPoints, setHeatPoints] = useState([]);
  const [showBot, setShowBot] = useState(false);
  const [botFilterIds, setBotFilterIds] = useState(null);
  const [mobileSidebar, setMobileSidebar] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchObjects(filters)
      .then((data) => {
        if (cancelled) return;
        setObjects(data.items);
        setTotal(data.total);
      })
      .catch(() => {
        if (!cancelled) setError("Не удалось загрузить данные. Запущен ли бэкенд на localhost:8000?");
      })
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [filters]);

  useEffect(() => {
    if (!selectedId) { setSelectedObject(null); return; }
    fetchObject(selectedId).then(setSelectedObject).catch(() => {});
  }, [selectedId]);

  // Загружаем heat-точки один раз при первом включении теплокарты
  useEffect(() => {
    if (showHeat && heatPoints.length === 0) {
      fetchDashboard().then((d) => setHeatPoints(d.heat_points || [])).catch(() => {});
    }
  }, [showHeat, heatPoints.length]);

  const handleSelect = useCallback((id) => {
    setSelectedId(id);
    const obj = objects.find((o) => o.id === id);
    if (obj) setFlyTarget({ lat: obj.lat, lon: obj.lon });
  }, [objects]);

  // ГидроБот вернул объекты — показываем на карте только их
  const handleBotResults = useCallback((botObjects) => {
    const ids = new Set(botObjects.map((o) => o.id));
    setBotFilterIds(ids);
  }, []);

  // Объекты для отображения: если ГидроБот отфильтровал — только они
  const displayedObjects = botFilterIds
    ? objects.filter((o) => botFilterIds.has(o.id))
    : objects;

  const tabBtn = (key, label, Icon) => (
    <button
      onClick={() => setTab(key)}
      style={{
        display: "flex", alignItems: "center", gap: 6,
        background: tab === key ? "var(--panel-2)" : "transparent",
        border: `1px solid ${tab === key ? "var(--accent)" : "var(--border)"}`,
        color: tab === key ? "var(--text)" : "var(--text-dim)",
        borderRadius: 6, padding: "6px 12px", fontSize: 13,
      }}
    >
      <Icon size={15} /> {label}
    </button>
  );

  return (
    <div className="app-shell">
      <header style={{
        display: "flex", alignItems: "center", gap: 12,
        padding: "12px 20px", background: "var(--panel)",
        borderBottom: "1px solid var(--border)", flexShrink: 0,
      }}>
        {tab === "map" && (
          <button className="mobile-toggle" onClick={() => setMobileSidebar((v) => !v)} aria-label="Меню">
            <Menu size={18} />
          </button>
        )}
        <Droplets size={22} color="var(--accent)" />
        <div>
          <h1 style={{ fontSize: 16, fontWeight: 600 }}>HydroCadastre</h1>
          <div className="header-subtitle" style={{ fontSize: 11, color: "var(--text-dim)" }}>
            Каталог гидротехнических сооружений · Жамбылская область
          </div>
        </div>
        <div className="tab-bar" style={{ marginLeft: 24 }}>
          {tabBtn("map", "Карта", MapIcon)}
          {tabBtn("dashboard", "Аналитика", BarChart3)}
        </div>
        <div style={{ marginLeft: "auto", fontSize: 12, color: "var(--text-dim)" }}>
          {loading ? "Загрузка…" : `${total} объектов`}
        </div>
      </header>

      {error && (
        <div style={{
          padding: "10px 20px", background: "#3a1a1a",
          color: "#fca5a5", fontSize: 13, borderBottom: "1px solid var(--border)",
        }}>
          {error}
        </div>
      )}

      {tab === "dashboard" ? (
        <div style={{ flex: 1, overflow: "hidden" }}>
          <Dashboard />
        </div>
      ) : (
        <div style={{ display: "flex", flex: 1, overflow: "hidden", position: "relative" }}>
          <aside
            className="sidebar-left"
            style={{
              width: 300, flexShrink: 0, display: "flex", flexDirection: "column",
              background: "var(--panel)", borderRight: "1px solid var(--border)",
              ...(mobileSidebar ? {} : {}),
            }}
            data-open={mobileSidebar}
          >
            <div style={{ overflowY: "auto", flexShrink: 0 }}>
              <Filters filters={filters} setFilters={setFilters} total={total} />
            </div>
            <div style={{ borderTop: "1px solid var(--border)", flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
              <div style={{ padding: "10px 14px", fontSize: 11, textTransform: "uppercase",
                            letterSpacing: "0.05em", color: "var(--text-dim)" }}>
                Список объектов
              </div>
              <ObjectList objects={displayedObjects} selectedId={selectedId} onSelect={(id) => { handleSelect(id); setMobileSidebar(false); }} />
            </div>
          </aside>

          <main style={{ flex: 1, position: "relative" }}>
            <MapView
              objects={displayedObjects}
              selectedId={selectedId}
              onSelect={handleSelect}
              flyTarget={flyTarget}
              heatPoints={heatPoints}
              showHeat={showHeat}
            />
            {/* Баннер фильтра ГидроБота */}
            {botFilterIds && (
              <div style={{
                position: "absolute", top: 12, left: 12, zIndex: 1000,
                display: "flex", alignItems: "center", gap: 8,
                background: "var(--panel)", border: "1px solid var(--accent)",
                borderRadius: 6, padding: "8px 12px", fontSize: 13, boxShadow: "var(--shadow)",
              }}>
                <Bot size={15} color="var(--accent)" />
                Показаны объекты из запроса ГидроБота ({botFilterIds.size})
                <button onClick={() => setBotFilterIds(null)} style={{
                  background: "none", border: "none", color: "var(--text-dim)", marginLeft: 4,
                }}>✕</button>
              </div>
            )}
            {/* Кнопки управления картой */}
            <div style={{ position: "absolute", top: 12, right: 12, zIndex: 1000, display: "flex", gap: 8 }}>
              <button
                onClick={() => setShowHeat((v) => !v)}
                style={{
                  display: "flex", alignItems: "center", gap: 6,
                  background: showHeat ? "#ef4444" : "var(--panel)",
                  border: "1px solid var(--border)", borderRadius: 6,
                  color: "var(--text)", padding: "8px 12px", fontSize: 13,
                  boxShadow: "var(--shadow)",
                }}
              >
                <Flame size={15} /> {showHeat ? "Скрыть аварийность" : "Карта аварийности"}
              </button>
              <button
                onClick={() => setShowBot((v) => !v)}
                style={{
                  display: "flex", alignItems: "center", gap: 6,
                  background: showBot ? "var(--accent)" : "var(--panel)",
                  border: "1px solid var(--border)", borderRadius: 6,
                  color: showBot ? "#04342c" : "var(--text)", padding: "8px 12px", fontSize: 13,
                  boxShadow: "var(--shadow)",
                }}
              >
                <Bot size={15} /> ГидроБот
              </button>
            </div>
          </main>

          {showBot && (
            <aside className="panel-right" style={{ width: 360, flexShrink: 0 }}>
              <HydroBot onResults={handleBotResults} onClose={() => setShowBot(false)} />
            </aside>
          )}

          {selectedObject && tab === "map" && !showBot && (
            <aside className="panel-right" style={{ width: 340, flexShrink: 0 }}>
              <ObjectCard object={selectedObject} onClose={() => setSelectedId(null)} />
            </aside>
          )}
        </div>
      )}
    </div>
  );
}
