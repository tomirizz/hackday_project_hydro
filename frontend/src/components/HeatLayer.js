import { useEffect } from "react";
import { useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet.heat";

export default function HeatLayer({ points, visible }) {
  const map = useMap();

  useEffect(() => {
    if (!visible || !points || points.length === 0) return;

    // points: [{lat, lon, risk_score}] -> [[lat, lon, intensity]]
    const heatData = points.map((p) => [p.lat, p.lon, p.risk_score]);

    const heat = L.heatLayer(heatData, {
      radius: 25,
      blur: 20,
      maxZoom: 12,
      max: 1.0,
      gradient: {
        0.4: "#eab308",
        0.6: "#f97316",
        0.8: "#ef4444",
        1.0: "#b91c1c",
      },
    });

    heat.addTo(map);
    return () => { map.removeLayer(heat); };
  }, [map, points, visible]);

  return null;
}
