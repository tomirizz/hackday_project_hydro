import React, { useState, useEffect, useRef } from "react";
import { fetchPhotos, uploadPhoto, photoUrl } from "../api/client";
import { useApp } from "../AppContext";
import { Camera, Upload, Sparkles, AlertCircle } from "lucide-react";

const STATE_COLORS = {
  "удовлетворительное": "var(--c-normal)",
  "требует наблюдения": "var(--c-watch)",
  "требует ремонта": "var(--c-repair)",
  "аварийное": "var(--c-critical)",
};

export default function PhotoGallery({ objectId }) {
  const { t } = useApp();
  const [photos, setPhotos] = useState([]);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef(null);

  const load = () => {
    fetchPhotos(objectId).then((d) => setPhotos(d.items || [])).catch(() => {});
  };

  useEffect(() => {
    if (objectId) load();
  }, [objectId]);

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      // Читаем файл в base64
      const base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result.split(",")[1]);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      await uploadPhoto(objectId, base64, file.type);
      load();
    } catch (err) {
      // тихо
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", marginBottom: 10 }}>
        <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em",
                      color: "var(--text-dim)", display: "flex", alignItems: "center", gap: 6 }}>
          <Camera size={13} /> {t("photoTitle")}
        </div>
        <button onClick={() => fileRef.current?.click()} disabled={uploading} style={{
          marginLeft: "auto", display: "flex", alignItems: "center", gap: 4,
          background: "var(--accent)", border: "none", borderRadius: 6,
          color: "var(--accent-text)", padding: "5px 10px", fontSize: 11, cursor: "pointer",
        }}>
          <Upload size={12} /> {uploading ? t("photoAnalyzing") : t("photoUpload")}
        </button>
        <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} style={{ display: "none" }} />
      </div>

      {uploading && (
        <div style={{
          display: "flex", alignItems: "center", gap: 8, padding: "10px 12px",
          background: "var(--panel-2)", borderRadius: 8, marginBottom: 10, fontSize: 12, color: "var(--accent)",
        }}>
          <span className="spinner" /> {t("photoAnalyzing")}
        </div>
      )}

      {photos.length === 0 && !uploading ? (
        <div style={{ fontSize: 12, color: "var(--text-dim)", padding: "8px 0" }}>{t("photoNoPhotos")}</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {photos.map((p) => (
            <div key={p.id} style={{ background: "var(--panel-2)", borderRadius: 8, overflow: "hidden" }}>
              <img
                src={photoUrl(p.filename)}
                alt="object"
                style={{ width: "100%", height: 160, objectFit: "cover", display: "block" }}
              />
              {(p.vision_type || p.vision_state) && (
                <div style={{ padding: "10px 12px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8,
                                fontSize: 11, color: "var(--accent)" }}>
                    <Sparkles size={12} /> {t("photoVisionResult")}
                  </div>

                  {p.vision_type && (
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
                      <span style={{ color: "var(--text-dim)" }}>{t("photoDetectedType")}</span>
                      <span style={{ fontWeight: 500 }}>{p.vision_type}</span>
                    </div>
                  )}

                  {p.vision_state && (
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
                      <span style={{ color: "var(--text-dim)" }}>{t("photoDetectedState")}</span>
                      <span style={{ fontWeight: 500, color: STATE_COLORS[p.vision_state] || "var(--text)" }}>
                        {p.vision_state}
                      </span>
                    </div>
                  )}

                  {p.vision_confidence != null && (
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
                      <span style={{ color: "var(--text-dim)" }}>{t("photoConfidence")}</span>
                      <span className="mono">{(p.vision_confidence * 100).toFixed(0)}%</span>
                    </div>
                  )}

                  {p.vision_defects && p.vision_defects.length > 0 && (
                    <div style={{ marginTop: 6 }}>
                      <div style={{ fontSize: 11, color: "var(--text-dim)", marginBottom: 4,
                                    display: "flex", alignItems: "center", gap: 4 }}>
                        <AlertCircle size={11} /> {t("photoDetectedDefects")}
                      </div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                        {p.vision_defects.map((d, i) => (
                          <span key={i} style={{
                            fontSize: 10, background: "var(--c-repair)", color: "#fff",
                            borderRadius: 10, padding: "2px 8px",
                          }}>
                            {d}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {p.vision_description && (
                    <div style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 8, lineHeight: 1.4 }}>
                      {p.vision_description}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
