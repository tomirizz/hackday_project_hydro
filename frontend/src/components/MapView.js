import React, { useMemo } from "react";
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from "react-leaflet";
import { categoryColor, categoryLabel } from "../constants";
import HeatLayer from "./HeatLayer";

// Центр Жамбылской области (Тараз ~ 42.9, 71.4), охватываем весь регион
const ZHAMBYL_CENTER = [43.5, 72.0];
const DEFAULT_ZOOM = 7;

function FlyTo({ target }) {
  const map = useMap();
  if (target) {
    map.flyTo([target.lat, target.lon], 11, { duration: 0.8 });
  }
  return null;
}

export default function MapView({ objects, selectedId, onSelect, flyTarget, heatPoints, showHeat }) {
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
                <span
                  style={{
                    display: "inline-block",
                    width: 8, height: 8, borderRadius: "50%",
                    background: categoryColor(o.category),
                    marginRight: 6,
                  }}
                />
                {categoryLabel(o.category)}
              </div>
              <div style={{ marginTop: 4, fontSize: 12, opacity: 0.7 }}>
                Риск: {(o.risk_score * 100).toFixed(0)}% · {o.district_name}
              </div>
            </div>
          </Popup>
        </CircleMarker>
      )),
    [objects, selectedId, onSelect]
  );

  return (
    <MapContainer
      center={ZHAMBYL_CENTER}
      zoom={DEFAULT_ZOOM}
      style={{ height: "100%", width: "100%" }}
      preferCanvas={true}
    >
      <TileLayer
        attribution='&copy; OpenStreetMap'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {!showHeat && markers}
      <HeatLayer points={heatPoints} visible={showHeat} />
      <FlyTo target={flyTarget} />
    </MapContainer>
  );
}
