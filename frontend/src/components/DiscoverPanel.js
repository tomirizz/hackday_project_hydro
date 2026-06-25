import React from "react";
import { useApp } from "../AppContext";
import { X, MapPin, Radar } from "lucide-react";

const STATUS_COLORS = {
  new:        "#38bdf8",
  unverified: "#eab308",
  exists:     "#8b9bab",
};

export default function DiscoverPanel({ data, loading, onClose, onSelectMarker }) {
  const { t } = useApp();

  return (
    <div style={{
      display: "flex", flexDirection: "column", height: "100%",
      background: "var(--panel)", borderLeft: "1px solid var(--border)",
    }}>
      <div style={{
        display: "flex", alignItems: "center", gap: 8, padding: "12px 16px",
        borderBottom: "1px solid var(--border)",
      }}>
        <Radar size={18} color="var(--accent-2)" />
        <strong style={{ fontSize: 14, flex: 1 }}>{t("discoverTitle")}</strong>
        <button onClick={onClose} style={{ background: "none", border: "none", color: "var(--text-dim)", cursor: "pointer" }}>
          <X size={18} />
        </button>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: 16 }}>
        {loading && (
          <div style={{ color: "var(--text-dim)", fontSize: 13, textAlign: "center", padding: "20px 0" }}>
            {t("mapDiscovering")}
          </div>
        )}

        {!loading && data?.error && (
          <div style={{ color: "var(--c-critical)", fontSize: 13, padding: "12px", textAlign: "center" }}>
            {t("discoverError")}
          </div>
        )}

        {!loading && data && !data.error && (
          <>
            {/* Сводка */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 16 }}>
              <div style={{ background: "var(--panel-2)", borderRadius: 6, padding: "10px", textAlign: "center" }}>
                <div className="mono" style={{ fontSize: 20, fontWeight: 600, color: "#38bdf8" }}>
                  {data.summary?.new || 0}
                </div>
                <div style={{ fontSize: 10, color: "var(--text-dim)" }}>{t("discoverNew")}</div>
              </div>
              <div style={{ background: "var(--panel-2)", borderRadius: 6, padding: "10px", textAlign: "center" }}>
                <div className="mono" style={{ fontSize: 20, fontWeight: 600, color: "#eab308" }}>
                  {data.summary?.unverified || 0}
                </div>
                <div style={{ fontSize: 10, color: "var(--text-dim)" }}>{t("discoverUnverified")}</div>
              </div>
              <div style={{ background: "var(--panel-2)", borderRadius: 6, padding: "10px", textAlign: "center" }}>
                <div className="mono" style={{ fontSize: 20, fontWeight: 600, color: "var(--text-dim)" }}>
                  {data.summary?.exists || 0}
                </div>
                <div style={{ fontSize: 10, color: "var(--text-dim)" }}>{t("discoverExists")}</div>
              </div>
            </div>

            <div style={{ fontSize: 12, color: "var(--text-dim)", marginBottom: 10 }}>
              {t("discoverFound")}: {data.total || 0}
            </div>

            {/* Список найденных */}
            {(data.items || []).length === 0 ? (
              <div style={{ color: "var(--text-dim)", fontSize: 13, textAlign: "center", padding: "20px 0" }}>
                {t("discoverEmpty")}
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {data.items.map((it, i) => (
                  <button
                    key={i}
                    onClick={() => onSelectMarker(it)}
                    style={{
                      display: "flex", alignItems: "center", gap: 8,
                      background: "var(--panel-2)", border: "1px solid var(--border)",
                      borderLeft: `3px solid ${STATUS_COLORS[it.status] || "var(--border)"}`,
                      borderRadius: 6, padding: "8px 10px", textAlign: "left",
                      color: "var(--text)", cursor: "pointer",
                    }}
                  >
                    <MapPin size={13} color={STATUS_COLORS[it.status]} style={{ flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {it.name}
                      </div>
                      <div style={{ fontSize: 10, color: "var(--text-dim)" }}>
                        {it.waterway} · {it.status === "new" ? t("discoverNew") :
                                         it.status === "unverified" ? t("discoverUnverified") : t("discoverExists")}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
