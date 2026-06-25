import React, { useState, useEffect, useCallback } from "react";
import {
  fetchObjects, fetchObject, fetchDashboard, discoverObjects,
} from "./api/client";
import MapView from "./components/MapView";
import Filters from "./components/Filters";
import ObjectList from "./components/ObjectList";
import ObjectCard from "./components/ObjectCard";
import Dashboard from "./components/Dashboard";
import HydroBot from "./components/HydroBot";
import DiscoverPanel from "./components/DiscoverPanel";
import AddObjectPanel from "./components/AddObjectPanel";
import MapLegend from "./components/MapLegend";
import OverduePanel from "./components/OverduePanel";
import { useApp } from "./AppContext";
import { LANGUAGES } from "./i18n";
import {
  Droplets, Map as MapIcon, BarChart3, Flame, Bot, Menu, Sun, Moon,
  Radar, Search, AlertTriangle, Maximize2, Minimize2, Plus, X, Clock,
} from "lucide-react";

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

  const [showDiscover, setShowDiscover] = useState(false);
  const [discoverData, setDiscoverData] = useState(null);
  const [discoverLoading, setDiscoverLoading] = useState(false);
  const [discoverMarkers, setDiscoverMarkers] = useState([]);

  // Новые состояния
  const [searchQuery, setSearchQuery] = useState("");
  const [showOverdue, setShowOverdue] = useState(false);
  const [overdueCount, setOverdueCount] = useState(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [stats, setStats] = useState(null);
  const [threatCount, setThreatCount] = useState(null);
  const [showThreatBanner, setShowThreatBanner] = useState(true);

  // Добавление объекта
  const [showAddObject, setShowAddObject] = useState(false);
  const [pickMode, setPickMode] = useState(false);
  const [pickedCoords, setPickedCoords] = useState(null);

  // Загрузка объектов
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
      .catch(() => { if (!cancelled) setError(t("errLoadData")); })
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [filters, t]);

  // Статистика и прогноз для шапки/баннера (один раз)
  useEffect(() => {
    fetchDashboard().then((d) => {
      setStats(d.metrics);
      setHeatPoints(d.heat_points || []);
    }).catch(() => {});
    // прогноз угрозы
    import("./api/client").then(({ default: client }) => {
      client.get("/forecast", { params: { years: 10 } })
        .then((r) => setThreatCount(r.data.will_become_critical))
        .catch(() => {});
      // количество просроченных осмотров
      client.get("/inspections/overdue")
        .then((r) => setOverdueCount(r.data.total))
        .catch(() => {});
    });
  }, []);

  // Детали объекта
  useEffect(() => {
    if (!selectedId) { setSelectedObject(null); return; }
    fetchObject(selectedId).then(setSelectedObject).catch(() => {});
  }, [selectedId]);

  // Открытие объекта по URL ?object=ID
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const objId = params.get("object");
    if (objId) {
      const id = parseInt(objId);
      setSelectedId(id);
      fetchObject(id).then((obj) => {
        if (obj && obj.lat) setFlyTarget({ lat: obj.lat, lon: obj.lon });
      }).catch(() => {});
    }
  }, []);

  const handleSelect = useCallback((id) => {
    setSelectedId(id);
    const obj = objects.find((o) => o.id === id);
    if (obj) setFlyTarget({ lat: obj.lat, lon: obj.lon });
  }, [objects]);

  const handleBotResults = useCallback((botObjects) => {
    setBotFilterIds(new Set(botObjects.map((o) => o.id)));
  }, []);

  const handleDiscover = async () => {
    setShowDiscover(true);
    setShowBot(false); setShowAddObject(false);
    setDiscoverLoading(true);
    setDiscoverData(null);
    try {
      const data = await discoverObjects(50);
      setDiscoverData(data);
      const markers = (data.items || []).filter((it) => it.status === "new" || it.status === "unverified");
      setDiscoverMarkers(markers);
    } catch (e) {
      setDiscoverData({ error: true });
    } finally {
      setDiscoverLoading(false);
    }
  };

  // Поиск: фильтруем объекты по названию
  const searchedObjects = searchQuery.trim()
    ? objects.filter((o) => o.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : null;

  const displayedObjects = searchedObjects
    ? searchedObjects
    : botFilterIds
    ? objects.filter((o) => botFilterIds.has(o.id))
    : objects;

  // Обработка выбора координат на карте
  const handlePickCoords = (coords) => {
    setPickedCoords(coords);
    setPickMode(false);
  };

  const handleObjectCreated = (newObj) => {
    setShowAddObject(false);
    setPickedCoords(null);
    setPickMode(false);
    // обновляем список
    fetchObjects(filters).then((data) => {
      setObjects(data.items);
      setTotal(data.total);
    });
    if (newObj.lat) setFlyTarget({ lat: newObj.lat, lon: newObj.lon });
  };

  const closeAllPanels = () => {
    setShowBot(false); setShowDiscover(false); setShowAddObject(false);
    setDiscoverMarkers([]); setPickMode(false); setPickedCoords(null);
  };

  const tabBtn = (key, label, Icon) => (
    <button onClick={() => setTab(key)} style={{
      display: "flex", alignItems: "center", gap: 6,
      background: tab === key ? "var(--panel-2)" : "transparent",
      border: `1px solid ${tab === key ? "var(--accent)" : "var(--border)"}`,
      color: tab === key ? "var(--text)" : "var(--text-dim)",
      borderRadius: 6, padding: "6px 12px", fontSize: 13, cursor: "pointer",
    }}>
      <Icon size={15} /> <span className="tab-labels">{label}</span>
    </button>
  );

  const mapCtrl = (active, activeBg, onClick, Icon, label, key) => (
    <button key={key} onClick={onClick} style={{
      display: "flex", alignItems: "center", gap: 6,
      background: active ? activeBg : "var(--panel)",
      border: "1px solid var(--border)", borderRadius: 6,
      color: active && (activeBg === "var(--accent)" || activeBg === "var(--accent-2)") ? "var(--accent-text)" : (active ? "#fff" : "var(--text)"),
      padding: "8px 12px", fontSize: 13, boxShadow: "var(--shadow)", cursor: "pointer",
    }}>
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
        <div className="tab-bar" style={{ marginLeft: 16 }}>
          {tabBtn("map", t("tabMap"), MapIcon)}
          {tabBtn("dashboard", t("tabDashboard"), BarChart3)}
        </div>

        {/* Живой поиск (только на карте) */}
        {tab === "map" && (
          <div style={{ position: "relative", marginLeft: 12 }} className="header-search">
            <Search size={14} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--text-dim)" }} />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t("searchPlaceholder")}
              style={{
                background: "var(--panel-2)", border: "1px solid var(--border)",
                borderRadius: 6, color: "var(--text)", padding: "7px 10px 7px 30px",
                fontSize: 13, width: 180,
              }}
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery("")} style={{
                position: "absolute", right: 6, top: "50%", transform: "translateY(-50%)",
                background: "none", border: "none", color: "var(--text-dim)", cursor: "pointer", padding: 2,
              }}>
                <X size={13} />
              </button>
            )}
          </div>
        )}

        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 12 }}>
          {/* Статистика в реальном времени */}
          {stats && (
            <div className="header-stats" style={{ display: "flex", gap: 12, fontSize: 12 }}>
              <span style={{ color: "var(--c-critical)", display: "flex", alignItems: "center", gap: 4 }}>
                <span style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--c-critical)" }} />
                {stats.critical_count} {t("statCritical")}
              </span>
              <span style={{ color: "var(--c-repair)", display: "flex", alignItems: "center", gap: 4 }}>
                <span style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--c-repair)" }} />
                {stats.repair_count} {t("statRepair")}
              </span>
              {threatCount != null && (
                <span style={{ color: "var(--text-dim)", display: "flex", alignItems: "center", gap: 4 }}>
                  <AlertTriangle size={12} /> {threatCount} {t("statThreat")}
                </span>
              )}
              {overdueCount != null && overdueCount > 0 && (
                <span style={{ color: "var(--c-repair)", display: "flex", alignItems: "center", gap: 4, cursor: "pointer" }}
                      onClick={() => { setTab("map"); setShowOverdue(true); }}>
                  <Clock size={12} /> {overdueCount} {t("overdueBanner")}
                </span>
              )}
            </div>
          )}

          {/* Язык */}
          <div style={{ display: "flex", gap: 2, background: "var(--panel-2)", borderRadius: 6, padding: 2 }}>
            {LANGUAGES.map((l) => (
              <button key={l.code} onClick={() => setLang(l.code)} title={l.name} style={{
                background: lang === l.code ? "var(--accent)" : "transparent",
                color: lang === l.code ? "var(--accent-text)" : "var(--text-dim)",
                border: "none", borderRadius: 4, padding: "4px 8px", fontSize: 12, fontWeight: 500, cursor: "pointer",
              }}>
                {l.label}
              </button>
            ))}
          </div>

          {/* Тема */}
          <button onClick={toggleTheme} title={theme === "dark" ? t("themeLight") : t("themeDark")} style={{
            display: "flex", alignItems: "center", justifyContent: "center",
            background: "var(--panel-2)", border: "1px solid var(--border)",
            borderRadius: 6, color: "var(--text)", width: 34, height: 34, cursor: "pointer",
          }}>
            {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
          </button>
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
          {!fullscreen && (
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
                <ObjectList objects={displayedObjects} selectedId={selectedId}
                            onSelect={(id) => { handleSelect(id); setMobileSidebar(false); }} />
              </div>
            </aside>
          )}

          <main className={fullscreen ? "map-fullscreen" : ""} style={{ flex: 1, position: "relative" }}>
            <MapView
              objects={displayedObjects}
              selectedId={selectedId}
              onSelect={handleSelect}
              flyTarget={flyTarget}
              heatPoints={heatPoints}
              showHeat={showHeat}
              discoverMarkers={discoverMarkers}
              pickMode={pickMode}
              onPickCoords={handlePickCoords}
              pickedCoords={pickedCoords}
            />

            <MapLegend />

            {/* Баннер угрозы */}
            {showThreatBanner && threatCount != null && threatCount > 0 && (
              <div className="threat-glow" style={{
                position: "absolute", bottom: 16, right: 16, zIndex: 1000, maxWidth: 320,
                display: "flex", alignItems: "center", gap: 10,
                background: "var(--panel)", border: "1px solid var(--c-critical)",
                borderRadius: 8, padding: "10px 14px",
              }}>
                <AlertTriangle size={18} color="var(--c-critical)" style={{ flexShrink: 0 }} />
                <span style={{ fontSize: 12, lineHeight: 1.4 }}>
                  {t("threatBanner").replace("{n}", threatCount)}
                </span>
                <button onClick={() => setShowThreatBanner(false)} style={{
                  background: "none", border: "none", color: "var(--text-dim)", cursor: "pointer", padding: 2, flexShrink: 0,
                }}>
                  <X size={14} />
                </button>
              </div>
            )}

            {/* Баннер фильтра ГидроБота / поиска */}
            {(botFilterIds || searchedObjects) && (
              <div style={{
                position: "absolute", top: 12, left: 12, zIndex: 1000,
                display: "flex", alignItems: "center", gap: 8,
                background: "var(--panel)", border: "1px solid var(--accent)",
                borderRadius: 6, padding: "8px 12px", fontSize: 13, boxShadow: "var(--shadow)",
              }}>
                {searchedObjects ? <Search size={15} color="var(--accent)" /> : <Bot size={15} color="var(--accent)" />}
                {(searchedObjects || displayedObjects).length} {t("objectsCount")}
                <button onClick={() => { setBotFilterIds(null); setSearchQuery(""); }} style={{
                  background: "none", border: "none", color: "var(--text-dim)", marginLeft: 4, cursor: "pointer",
                }}>✕</button>
              </div>
            )}

            {/* Просроченные осмотры */}
            {showOverdue && (
              <OverduePanel onSelect={(id) => { handleSelect(id); }} onClose={() => setShowOverdue(false)} />
            )}

            {/* Кнопки управления картой */}
            <div style={{ position: "absolute", top: 12, right: 12, zIndex: 1000, display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
              {mapCtrl(showOverdue, "var(--c-repair)", () => { setShowOverdue((v) => !v); }, Clock,
                       overdueCount != null ? `${t("overdueShow")} (${overdueCount})` : t("overdueShow"), "overdue")}
              {mapCtrl(showHeat, "var(--c-critical)", () => setShowHeat((v) => !v), Flame, showHeat ? t("mapHeatHide") : t("mapHeatShow"), "heat")}
              {mapCtrl(showDiscover, "var(--accent-2)", handleDiscover, Radar, t("mapDiscover"), "discover")}
              {mapCtrl(showAddObject, "var(--accent)", () => { closeAllPanels(); setShowAddObject(true); }, Plus, t("addObject"), "add")}
              {mapCtrl(showBot, "var(--accent)", () => { closeAllPanels(); setShowBot(true); }, Bot, t("botTitle"), "bot")}
              {mapCtrl(fullscreen, "var(--accent)", () => setFullscreen((v) => !v), fullscreen ? Minimize2 : Maximize2, fullscreen ? t("fullscreenOff") : t("fullscreenOn"), "fs")}
            </div>
          </main>

          {/* Правые панели */}
          {showAddObject && !fullscreen && (
            <aside className="panel-right" style={{ width: 340, flexShrink: 0 }}>
              <AddObjectPanel
                pickedCoords={pickedCoords}
                onClose={() => { setShowAddObject(false); setPickedCoords(null); setPickMode(false); }}
                onCreated={handleObjectCreated}
                onRequestPick={() => setPickMode(true)}
              />
            </aside>
          )}

          {showDiscover && !fullscreen && (
            <aside className="panel-right" style={{ width: 360, flexShrink: 0 }}>
              <DiscoverPanel
                data={discoverData}
                loading={discoverLoading}
                onClose={() => { setShowDiscover(false); setDiscoverMarkers([]); }}
                onSelectMarker={(m) => setFlyTarget({ lat: m.lat, lon: m.lon })}
              />
            </aside>
          )}

          {showBot && !showDiscover && !showAddObject && !fullscreen && (
            <aside className="panel-right" style={{ width: 360, flexShrink: 0 }}>
              <HydroBot onResults={handleBotResults} onClose={() => setShowBot(false)} />
            </aside>
          )}

          {selectedObject && tab === "map" && !showBot && !showDiscover && !showAddObject && !fullscreen && (
            <aside className="panel-right" style={{ width: 340, flexShrink: 0 }}>
              <ObjectCard object={selectedObject} onClose={() => setSelectedId(null)} />
            </aside>
          )}
        </div>
      )}
    </div>
  );
}
