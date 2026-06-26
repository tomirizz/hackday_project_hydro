import { useEffect } from "react";
import { useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet.heat";

export default function HeatLayer({ points, visible }) {
  const map = useMap();

  useEffect(() => {
    if (!visible || !points || points.length === 0) return;

    // Бэкенд отдаёт точки массивами [lat, lon, risk]; поддерживаем и {lat,lon,risk_score}.
    const heatData = points
      .map((p) => (Array.isArray(p)
        ? [p[0], p[1], p[2]]
        : [p.lat, p.lon, p.risk_score]))
      .filter((p) => Number.isFinite(p[0]) && Number.isFinite(p[1]));

    if (heatData.length === 0) return;

    const heat = L.heatLayer(heatData, {
      radius: 30,
      blur: 22,
      maxZoom: 12,
      max: 1.0,
      minOpacity: 0.45,
      gradient: {
        0.2: "#8b5cf6",
        0.4: "#ec4899",
        0.6: "#fb923c",
        0.8: "#ef4444",
        1.0: "#b91c1c",
      },
    });

    heat.addTo(map);
    return () => { map.removeLayer(heat); };
  }, [map, points, visible]);

  return null;
}
