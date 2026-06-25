import React, { useMemo } from "react";
import { MapContainer, TileLayer, CircleMarker, Popup, useMap, useMapEvents, LayersControl } from "react-leaflet";
import { categoryColor } from "../constants";
import { useApp, catLabel } from "../AppContext";
import HeatLayer from "./HeatLayer";

const { BaseLayer } = LayersControl;

const ZHAMBYL_CENTER = [43.5, 72.0];
const DEFAULT_ZOOM = 7;

const DISCOVER_COLORS = { new: "#38bdf8", unverified: "#eab308" };

function FlyTo({ target }) {
  const map = useMap();
  if (target) {
    map.flyTo([target.lat, target.lon], 11, { duration: 0.8 });
  }
  return null;
}

function ClickCatcher({ active, onPick }) {
  useMapEvents({
    click(e) {
      if (active) onPick({ lat: e.latlng.lat, lon: e.latlng.lng });
    },
  });
  return null;
}

export default function MapView({
  objects, selectedId, onSelect, flyTarget, heatPoints, showHeat,
  discoverMarkers, pickMode, onPickCoords, pickedCoords,
}) {
  const { t } = useApp();

  // Маркеры объектов — вне LayersControl, иначе react-leaflet v4 их скрывает
  const markers = useMemo(
    () =>
      objects.map((o) => (
        <CircleMarker
          key={o.id}
          center={[o.lat, o.lon]}
          radius={selectedId === o.id ? 9 : 6}
          pathOptions={{
            color: selectedId === o.id ? "#ffffff" : categoryColor(o.category),
            weight: selectedId === o.id ? 2 : 1,
            fillColor: categoryColor(o.category),
            fillOpacity: 0.85,
          }}
          eventHandlers={{ click: () => onSelect(o.id) }}
        >
          <Popup>
            <div style={{ minWidth: 180 }}>
              <strong>{o.name}</strong>
              <div style={{ marginTop: 6, fontSize: 13 }}>
                <span style={{
                  display: "inline-block", width: 8, height: 8, borderRadius: "50%",
                  background: categoryColor(o.category), marginRight: 6,
                }} />
                {catLabel(t, o.category)}
              </div>
              <div style={{ marginTop: 4, fontSize: 12, opacity: 0.7 }}>
                {t("drillRisk")}: {(o.risk_score * 100).toFixed(0)}% · {o.district_name}
              </div>
            </div>
          </Popup>
        </CircleMarker>
      )),
    [objects, selectedId, onSelect, t]
  );

  const discMarkers = useMemo(
    () =>
      (discoverMarkers || []).map((m, i) => (
        <CircleMarker
          key={`disc-${i}`}
          center={[m.lat, m.lon]}
          radius={7}
          pathOptions={{
            color: "#ffffff", weight: 2,
            fillColor: DISCOVER_COLORS[m.status] || "#38bdf8",
            fillOpacity: 0.9, dashArray: "3",
          }}
        >
          <Popup>
            <div style={{ minWidth: 160 }}>
              <strong>{m.name}</strong>
              <div style={{ marginTop: 6, fontSize: 12 }}>OpenStreetMap · {m.waterway}</div>
              <div style={{ marginTop: 4, fontSize: 12, color: DISCOVER_COLORS[m.status] }}>
                {m.status === "new" ? t("discoverNew") : t("discoverUnverified")}
              </div>
            </div>
          </Popup>
        </CircleMarker>
      )),
    [discoverMarkers, t]
  );

  return (
    <MapContainer
      center={ZHAMBYL_CENTER}
      zoom={DEFAULT_ZOOM}
      style={{ height: "100%", width: "100%", cursor: pickMode ? "crosshair" : "" }}
    >
      {/* Слои тайлов — схема и спутник */}
      <LayersControl position="topleft">
        <BaseLayer checked name="Схема (OSM)">
          <TileLayer
            attribution='&copy; OpenStreetMap'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
        </BaseLayer>
        <BaseLayer name="Спутник">
          <TileLayer
            attribution='&copy; Esri'
            url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
          />
        </BaseLayer>
        <BaseLayer name="Спутник + подписи">
          <TileLayer
            attribution='&copy; Esri'
            url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
          />
          <TileLayer
            url="https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}"
          />
        </BaseLayer>
      </LayersControl>

      {/* Маркеры объектов — всегда поверх тайлов */}
      {!showHeat && markers}
      {discMarkers}

      {/* Точка выбора при добавлении объекта */}
      {pickedCoords && (
        <CircleMarker
          center={[pickedCoords.lat, pickedCoords.lon]}
          radius={10}
          pathOptions={{ color: "#2dd4bf", weight: 3, fillColor: "#2dd4bf", fillOpacity: 0.4 }}
        />
      )}

      <HeatLayer points={heatPoints} visible={showHeat} />
      <ClickCatcher active={pickMode} onPick={onPickCoords} />
      <FlyTo target={flyTarget} />
    </MapContainer>
  );
}
