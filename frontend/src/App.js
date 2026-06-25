import React, { useState, useEffect, useCallback } from "react";
import { fetchObjects, fetchObject, fetchDashboard, discoverObjects } from "./api/client";
import MapView from "./components/MapView";
import Filters from "./components/Filters";
import ObjectList from "./components/ObjectList";
import ObjectCard from "./components/ObjectCard";
import Dashboard from "./components/Dashboard";
import HydroBot from "./components/HydroBot";
import DiscoverPanel from "./components/DiscoverPanel";
import { useApp } from "./AppContext";
import { LANGUAGES } from "./i18n";
import { Droplets, Map as MapIcon, BarChart3, Flame, Bot, Menu, Sun, Moon, Radar } from "lucide-react";

export default function App() {
  const { t, lang, setLang, theme, toggleTheme } = useApp();

  const [tab, setTab] = useState("map");
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

  // Discover (поиск из OSM)
  const [showDiscover, setShowDiscover] = useState(false);
  const [discoverData, setDiscoverData] = useState(null);
  const [discoverLoading, setDiscoverLoading] = useState(false);
  const [discoverMarkers, setDiscoverMarkers] = useState([]);

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
        if (!cancelled) setError(t("errLoadData"));
      })
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [filters, t]);

  useEffect(() => {
    if (!selectedId) { setSelectedObject(null); return; }
    fetchObject(selectedId).then(setSelectedObject).catch(() => {});
  }, [selectedId]);

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

  const handleBotResults = useCallback((botObjects) => {
    const ids = new Set(botObjects.map((o) => o.id));
    setBotFilterIds(ids);
  }, []);

  // Запуск обнаружения объектов из OSM
  const handleDiscover = async () => {
    setShowDiscover(true);
    setDiscoverLoading(true);
    setDiscoverData(null);
    try {
      const data = await discoverObjects(50);
      setDiscoverData(data);
      // Показываем на карте новые и непроверенные объекты
      const markers = (data.items || []).filter(
        (it) => it.status === "new" || it.status === "unverified"
      );
      setDiscoverMarkers(markers);
    } catch (e) {
      setDiscoverData({ error: true });
    } finally {
      setDiscoverLoading(false);
    }
  };

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
      <Icon size={15} /> <span className="tab-labels">{label}</span>
    </button>
  );

  const ctrlBtn = (active, activeBg, onClick, Icon, label, key) => (
    <button
      key={key}
      onClick={onClick}
      style={{
        display: "flex", alignItems: "center", gap: 6,
        background: active ? activeBg : "var(--panel)",
        border: "1px solid var(--border)", borderRadius: 6,
        color: active && activeBg === "var(--accent)" ? "var(--accent-text)" : (active ? "#fff" : "var(--text)"),
        padding: "8px 12px", fontSize: 13, boxShadow: "var(--shadow)",
      }}
    >
      <Icon size={15} /> <span className="tab-labels">{label}</span>
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
          <button className="mobile-toggle" onClick={() => setMobileSidebar((v) => !v)} aria-label="Menu">
            <Menu size={18} />
          </button>
        )}
        <Droplets size={22} color="var(--accent)" />
        <div>
          <h1 style={{ fontSize: 16, fontWeight: 600 }}>{t("appTitle")}</h1>
          <div className="header-subtitle" style={{ fontSize: 11, color: "var(--text-dim)" }}>
            {t("appSubtitle")}
          </div>
        </div>
        <div className="tab-bar" style={{ marginLeft: 24 }}>
          {tabBtn("map", t("tabMap"), MapIcon)}
          {tabBtn("dashboard", t("tabDashboard"), BarChart3)}
        </div>

        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 12 }}>
          {/* Переключатель языка */}
          <div style={{ display: "flex", gap: 2, background: "var(--panel-2)", borderRadius: 6, padding: 2 }}>
            {LANGUAGES.map((l) => (
              <button
                key={l.code}
                onClick={() => setLang(l.code)}
                title={l.name}
                style={{
                  background: lang === l.code ? "var(--accent)" : "transparent",
                  color: lang === l.code ? "var(--accent-text)" : "var(--text-dim)",
                  border: "none", borderRadius: 4, padding: "4px 8px",
                  fontSize: 12, fontWeight: 500,
                }}
              >
                {l.label}
              </button>
            ))}
          </div>

          {/* Переключатель темы */}
          <button
            onClick={toggleTheme}
            title={theme === "dark" ? t("themeLight") : t("themeDark")}
            style={{
              display: "flex", alignItems: "center", justifyContent: "center",
              background: "var(--panel-2)", border: "1px solid var(--border)",
              borderRadius: 6, color: "var(--text)", width: 34, height: 34,
            }}
          >
            {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
          </button>

          <div className="header-subtitle" style={{ fontSize: 12, color: "var(--text-dim)" }}>
            {loading ? t("loading") : `${total} ${t("objectsCount")}`}
          </div>
        </div>
      </header>

      {error && (
        <div style={{
          padding: "10px 20px", background: "var(--c-critical)",
          color: "#fff", fontSize: 13, borderBottom: "1px solid var(--border)",
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
          <aside className="sidebar-left" data-open={mobileSidebar} style={{
            width: 300, flexShrink: 0, display: "flex", flexDirection: "column",
            background: "var(--panel)", borderRight: "1px solid var(--border)",
          }}>
            <div style={{ overflowY: "auto", flexShrink: 0 }}>
              <Filters filters={filters} setFilters={setFilters} total={total} />
            </div>
            <div style={{ borderTop: "1px solid var(--border)", flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
              <div style={{ padding: "10px 14px", fontSize: 11, textTransform: "uppercase",
                            letterSpacing: "0.05em", color: "var(--text-dim)" }}>
                {t("objectsList")}
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
              discoverMarkers={discoverMarkers}
            />
            {botFilterIds && (
              <div style={{
                position: "absolute", top: 12, left: 12, zIndex: 1000,
                display: "flex", alignItems: "center", gap: 8,
                background: "var(--panel)", border: "1px solid var(--accent)",
                borderRadius: 6, padding: "8px 12px", fontSize: 13, boxShadow: "var(--shadow)",
              }}>
                <Bot size={15} color="var(--accent)" />
                {t("mapBotFilter")} ({botFilterIds.size})
                <button onClick={() => setBotFilterIds(null)} style={{
                  background: "none", border: "none", color: "var(--text-dim)", marginLeft: 4, cursor: "pointer",
                }}>✕</button>
              </div>
            )}
            <div style={{ position: "absolute", top: 12, right: 12, zIndex: 1000, display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
              {ctrlBtn(showHeat, "var(--c-critical)", () => setShowHeat((v) => !v), Flame,
                       showHeat ? t("mapHeatHide") : t("mapHeatShow"), "heat")}
              {ctrlBtn(showDiscover, "var(--accent-2)", handleDiscover, Radar, t("mapDiscover"), "discover")}
              {ctrlBtn(showBot, "var(--accent)", () => setShowBot((v) => !v), Bot, t("botTitle"), "bot")}
            </div>
          </main>

          {showDiscover && (
            <aside className="panel-right" style={{ width: 360, flexShrink: 0 }}>
              <DiscoverPanel
                data={discoverData}
                loading={discoverLoading}
                onClose={() => { setShowDiscover(false); setDiscoverMarkers([]); }}
                onSelectMarker={(m) => setFlyTarget({ lat: m.lat, lon: m.lon })}
              />
            </aside>
          )}

          {showBot && !showDiscover && (
            <aside className="panel-right" style={{ width: 360, flexShrink: 0 }}>
              <HydroBot onResults={handleBotResults} onClose={() => setShowBot(false)} />
            </aside>
          )}

          {selectedObject && tab === "map" && !showBot && !showDiscover && (
            <aside className="panel-right" style={{ width: 340, flexShrink: 0 }}>
              <ObjectCard object={selectedObject} onClose={() => setSelectedId(null)} />
            </aside>
          )}
        </div>
      )}
    </div>
  );
}
