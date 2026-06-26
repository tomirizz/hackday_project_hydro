import React, { useState, useEffect, useRef } from "react";
import { fetchPhotos, uploadPhoto, photoUrl } from "../api/client";
import { useApp } from "../AppContext";
import { Camera, Upload } from "lucide-react";

// Простая галерея фотографий объекта: загрузка и просмотр.
// Оценка состояния по фото вынесена в ГидроБот (можно отправить ему медиа).
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
          <Upload size={12} /> {uploading ? t("photoUploading") : t("photoUpload")}
        </button>
        <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} style={{ display: "none" }} />
      </div>

      {photos.length === 0 && !uploading ? (
        <div style={{ fontSize: 12, color: "var(--text-dim)", padding: "8px 0" }}>{t("photoNoPhotos")}</div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          {photos.map((p) => (
            <div key={p.id} style={{ background: "var(--panel-2)", borderRadius: 8, overflow: "hidden" }}>
              <img
                src={photoUrl(p.filename)}
                alt="object"
                style={{ width: "100%", height: 110, objectFit: "cover", display: "block" }}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
