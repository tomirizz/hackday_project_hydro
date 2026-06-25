import React, { useState } from "react";
import { createObject } from "../api/client";
import { OBJECT_TYPES } from "../constants";
import { useApp, typeLabel } from "../AppContext";
import { X, MapPin, Check } from "lucide-react";

const input = {
  width: "100%", background: "var(--panel-2)", border: "1px solid var(--border)",
  borderRadius: 6, color: "var(--text)", padding: "8px 10px", fontSize: 13,
};
const label = {
  fontSize: 11, color: "var(--text-dim)", marginBottom: 4, display: "block", marginTop: 10,
};

export default function AddObjectPanel({ pickedCoords, onClose, onCreated, onRequestPick }) {
  const { t } = useApp();
  const [form, setForm] = useState({
    name: "", type_code: "canal", year_built: "",
    tech_state_raw: "", capacity_m3s: "", wear_percent: "", district_name: "",
  });
  const [saving, setSaving] = useState(false);
  const [created, setCreated] = useState(false);

  const upd = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    if (!pickedCoords) return;
    setSaving(true);
    try {
      const payload = {
        ...form,
        lat: pickedCoords.lat,
        lon: pickedCoords.lon,
        year_built: form.year_built ? parseInt(form.year_built) : null,
        capacity_m3s: form.capacity_m3s ? parseFloat(form.capacity_m3s) : null,
        wear_percent: form.wear_percent ? parseFloat(form.wear_percent) : null,
      };
      const res = await createObject(payload);
      setCreated(true);
      setTimeout(() => {
        onCreated(res);
        setCreated(false);
      }, 1000);
    } catch (e) {
      // показываем ошибку проще
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{
      display: "flex", flexDirection: "column", height: "100%",
      background: "var(--panel)", borderLeft: "1px solid var(--border)",
    }}>
      <div style={{
        display: "flex", alignItems: "center", gap: 8, padding: "12px 16px",
        borderBottom: "1px solid var(--border)",
      }}>
        <MapPin size={18} color="var(--accent)" />
        <strong style={{ fontSize: 14, flex: 1 }}>{t("addObjectTitle")}</strong>
        <button onClick={onClose} style={{ background: "none", border: "none", color: "var(--text-dim)", cursor: "pointer" }}>
          <X size={18} />
        </button>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: 16 }}>
        {created ? (
          <div style={{ textAlign: "center", padding: "40px 0", color: "var(--c-normal)" }}>
            <Check size={48} style={{ marginBottom: 12 }} />
            <div style={{ fontSize: 15, fontWeight: 600 }}>{t("addObjectCreated")}</div>
          </div>
        ) : (
          <>
            {/* Координаты */}
            <div style={{
              background: pickedCoords ? "var(--panel-2)" : "transparent",
              border: `1px dashed ${pickedCoords ? "var(--accent)" : "var(--border)"}`,
              borderRadius: 8, padding: 12, marginBottom: 4, textAlign: "center",
            }}>
              {pickedCoords ? (
                <div>
                  <div style={{ fontSize: 11, color: "var(--text-dim)" }}>{t("addObjectCoords")}</div>
                  <div className="mono" style={{ fontSize: 14, color: "var(--accent)", marginTop: 4 }}>
                    {pickedCoords.lat.toFixed(5)}, {pickedCoords.lon.toFixed(5)}
                  </div>
                </div>
              ) : (
                <button onClick={onRequestPick} style={{
                  background: "var(--accent)", color: "var(--accent-text)", border: "none",
                  borderRadius: 6, padding: "8px 14px", fontSize: 13, cursor: "pointer",
                }}>
                  {t("addObjectClickMap")}
                </button>
              )}
            </div>

            <label style={label}>{t("addObjectName")}</label>
            <input style={input} value={form.name} onChange={(e) => upd("name", e.target.value)} />

            <label style={label}>{t("addObjectType")}</label>
            <select style={input} value={form.type_code} onChange={(e) => upd("type_code", e.target.value)}>
              {Object.keys(OBJECT_TYPES).map((code) => (
                <option key={code} value={code}>{typeLabel(t, code)}</option>
              ))}
            </select>

            <label style={label}>{t("addObjectState")}</label>
            <select style={input} value={form.tech_state_raw} onChange={(e) => upd("tech_state_raw", e.target.value)}>
              <option value="">—</option>
              <option value="удов.">{t("stateGood")}</option>
              <option value="не удов.">{t("stateBad")}</option>
            </select>

            <label style={label}>{t("addObjectYear")}</label>
            <input style={input} type="number" value={form.year_built} onChange={(e) => upd("year_built", e.target.value)} />

            <label style={label}>{t("addObjectCapacity")}</label>
            <input style={input} type="number" step="0.1" value={form.capacity_m3s} onChange={(e) => upd("capacity_m3s", e.target.value)} />

            <label style={label}>{t("addObjectWear")}</label>
            <input style={input} type="number" step="0.05" min="0" max="1" value={form.wear_percent} onChange={(e) => upd("wear_percent", e.target.value)} />

            <label style={label}>{t("addObjectDistrict")}</label>
            <input style={input} value={form.district_name} onChange={(e) => upd("district_name", e.target.value)} />
          </>
        )}
      </div>

      {!created && (
        <div style={{ padding: 12, borderTop: "1px solid var(--border)", display: "flex", gap: 8 }}>
          <button onClick={onClose} style={{
            flex: 1, background: "transparent", border: "1px solid var(--border)",
            borderRadius: 6, color: "var(--text-dim)", padding: "9px", fontSize: 13, cursor: "pointer",
          }}>
            {t("addObjectCancel")}
          </button>
          <button onClick={save} disabled={!pickedCoords || saving} style={{
            flex: 2, background: pickedCoords ? "var(--accent)" : "var(--panel-2)",
            border: "none", borderRadius: 6,
            color: pickedCoords ? "var(--accent-text)" : "var(--text-dim)",
            padding: "9px", fontSize: 13, cursor: pickedCoords ? "pointer" : "default",
          }}>
            {saving ? "..." : t("addObjectSave")}
          </button>
        </div>
      )}
    </div>
  );
}
