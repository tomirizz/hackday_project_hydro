import React, { useState, useEffect } from "react";
import { fetchInspections, addInspection } from "../api/client";
import { useApp } from "../AppContext";
import { Plus, ClipboardList } from "lucide-react";

const input = {
  width: "100%", background: "var(--panel-2)", border: "1px solid var(--border)",
  borderRadius: 6, color: "var(--text)", padding: "7px 9px", fontSize: 12, marginTop: 6,
};

export default function InspectionsJournal({ objectId, onRecalc }) {
  const { t } = useApp();
  const [items, setItems] = useState([]);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ inspector: "", state_found: "", notes: "" });
  const [saving, setSaving] = useState(false);

  const load = () => {
    fetchInspections(objectId).then((d) => setItems(d.items || [])).catch(() => {});
  };

  useEffect(() => {
    if (objectId) load();
  }, [objectId]);

  const save = async () => {
    setSaving(true);
    try {
      const res = await addInspection(objectId, form);
      setForm({ inspector: "", state_found: "", notes: "" });
      setAdding(false);
      load();
      if (res.recalculated && onRecalc) onRecalc(res.recalculated);
    } catch (e) {
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", marginBottom: 10 }}>
        <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em",
                      color: "var(--text-dim)", display: "flex", alignItems: "center", gap: 6 }}>
          <ClipboardList size={13} /> {t("inspTitle")}
        </div>
        {!adding && (
          <button onClick={() => setAdding(true)} style={{
            marginLeft: "auto", display: "flex", alignItems: "center", gap: 4,
            background: "var(--panel-2)", border: "1px solid var(--border)",
            borderRadius: 6, color: "var(--accent)", padding: "4px 8px", fontSize: 11, cursor: "pointer",
          }}>
            <Plus size={12} /> {t("inspAdd")}
          </button>
        )}
      </div>

      {adding && (
        <div style={{ background: "var(--panel-2)", borderRadius: 8, padding: 12, marginBottom: 12 }}>
          <input style={input} placeholder={t("inspInspector")}
                 value={form.inspector} onChange={(e) => setForm((f) => ({ ...f, inspector: e.target.value }))} />
          <select style={input} value={form.state_found}
                  onChange={(e) => setForm((f) => ({ ...f, state_found: e.target.value }))}>
            <option value="">{t("inspState")}…</option>
            <option value="удов.">{t("stateGood")}</option>
            <option value="не удов.">{t("stateBad")}</option>
          </select>
          <textarea style={{ ...input, minHeight: 50, resize: "vertical" }} placeholder={t("inspNotes")}
                    value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <button onClick={() => setAdding(false)} style={{
              flex: 1, background: "transparent", border: "1px solid var(--border)",
              borderRadius: 6, color: "var(--text-dim)", padding: "7px", fontSize: 12, cursor: "pointer",
            }}>
              {t("inspCancel")}
            </button>
            <button onClick={save} disabled={saving} style={{
              flex: 1, background: "var(--accent)", border: "none", borderRadius: 6,
              color: "var(--accent-text)", padding: "7px", fontSize: 12, cursor: "pointer",
            }}>
              {saving ? "..." : t("inspSave")}
            </button>
          </div>
        </div>
      )}

      {items.length === 0 ? (
        <div style={{ fontSize: 12, color: "var(--text-dim)", padding: "8px 0" }}>{t("inspEmpty")}</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {items.map((it) => (
            <div key={it.id} style={{
              background: "var(--panel-2)", borderRadius: 6, padding: "8px 10px",
              borderLeft: `3px solid ${it.state_found === "не удов." ? "var(--c-critical)" :
                                       it.state_found === "удов." ? "var(--c-normal)" : "var(--border)"}`,
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                <span style={{ fontWeight: 500 }}>{it.inspector}</span>
                <span className="mono" style={{ color: "var(--text-dim)" }}>{it.inspect_date}</span>
              </div>
              {it.state_found && (
                <div style={{ fontSize: 11, marginTop: 3,
                              color: it.state_found === "не удов." ? "var(--c-critical)" : "var(--c-normal)" }}>
                  {it.state_found === "удов." ? t("stateGood") : t("stateBad")}
                </div>
              )}
              {it.notes && <div style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 3 }}>{it.notes}</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
