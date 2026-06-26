import React, { useState, useRef, useEffect } from "react";
import { askAssistant } from "../api/client";
import { Send, Bot, X, ImagePlus } from "lucide-react";
import { categoryColor } from "../constants";
import { useApp } from "../AppContext";

export default function HydroBot({ onResults, onClose }) {
  const { t } = useApp();
  const [messages, setMessages] = useState([{ role: "bot", text: t("botGreeting") }]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [image, setImage] = useState(null); // { base64, mediaType, preview }
  const scrollRef = useRef(null);
  const fileRef = useRef(null);

  const examples = [t("botExample1"), t("botExample2"), t("botExample3")];

  useEffect(() => {
    scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight);
  }, [messages, loading]);

  const pickImage = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const base64 = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result.split(",")[1]);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
    setImage({ base64, mediaType: file.type, preview: URL.createObjectURL(file) });
    if (fileRef.current) fileRef.current.value = "";
  };

  const send = async (text) => {
    const q = (text ?? input).trim();
    if ((!q && !image) || loading) return;
    const sentImage = image;
    setInput("");
    setImage(null);
    setMessages((m) => [...m, {
      role: "user",
      text: q || (sentImage ? t("botPhotoSent") : ""),
      image: sentImage?.preview,
    }]);
    setLoading(true);
    try {
      const res = await askAssistant(q, sentImage);
      setMessages((m) => [...m, { role: "bot", text: res.answer || "—", objects: res.objects }]);
      if (res.objects && res.objects.length && onResults) onResults(res.objects);
    } catch (e) {
      setMessages((m) => [...m, { role: "bot", text: t("botError") }]);
    } finally {
      setLoading(false);
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
        <Bot size={18} color="var(--accent)" />
        <strong style={{ fontSize: 14, flex: 1 }}>{t("botTitle")}</strong>
        <button onClick={onClose} style={{ background: "none", border: "none", color: "var(--text-dim)", cursor: "pointer" }}>
          <X size={18} />
        </button>
      </div>

      <div ref={scrollRef} style={{ flex: 1, overflowY: "auto", padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
        {messages.map((m, i) => (
          <div key={i} style={{ alignSelf: m.role === "user" ? "flex-end" : "flex-start", maxWidth: "85%" }}>
            {m.image && (
              <img src={m.image} alt="" style={{
                width: "100%", maxWidth: 200, borderRadius: 10, marginBottom: 4, display: "block",
                marginLeft: "auto",
              }} />
            )}
            {m.text && (
              <div style={{
                background: m.role === "user" ? "var(--accent)" : "var(--panel-2)",
                color: m.role === "user" ? "var(--accent-text)" : "var(--text)",
                padding: "8px 12px", borderRadius: 10, fontSize: 13, lineHeight: 1.5,
                whiteSpace: "pre-wrap",
              }}>
                {m.text}
              </div>
            )}
            {m.objects && m.objects.length > 0 && (
              <div style={{ marginTop: 6, display: "flex", flexDirection: "column", gap: 4 }}>
                {m.objects.slice(0, 5).map((o) => (
                  <div key={o.id} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--text-dim)" }}>
                    <span style={{ width: 7, height: 7, borderRadius: "50%", background: categoryColor(o.category) }} />
                    {o.name} · {(o.risk_score * 100).toFixed(0)}%
                  </div>
                ))}
                {m.objects.length > 5 && (
                  <div style={{ fontSize: 11, color: "var(--text-dim)" }}>
                    …{t("botMoreObjects")} {m.objects.length - 5} {t("botOnMap")}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
        {loading && (
          <div style={{ alignSelf: "flex-start", color: "var(--text-dim)", fontSize: 13 }}>
            {image ? t("botAnalyzingPhoto") : t("botThinking")}
          </div>
        )}
      </div>

      {messages.length <= 1 && (
        <div style={{ padding: "0 16px 12px", display: "flex", flexWrap: "wrap", gap: 6 }}>
          {examples.map((ex) => (
            <button key={ex} onClick={() => send(ex)} style={{
              background: "var(--panel-2)", border: "1px solid var(--border)",
              borderRadius: 14, color: "var(--text-dim)", padding: "4px 10px", fontSize: 11, cursor: "pointer",
            }}>
              {ex}
            </button>
          ))}
        </div>
      )}

      {/* Превью прикреплённого фото */}
      {image && (
        <div style={{ padding: "0 12px 8px", display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ position: "relative" }}>
            <img src={image.preview} alt="" style={{ width: 48, height: 48, objectFit: "cover", borderRadius: 8 }} />
            <button onClick={() => setImage(null)} style={{
              position: "absolute", top: -6, right: -6, background: "var(--c-critical)", border: "none",
              borderRadius: "50%", width: 18, height: 18, color: "#fff", cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", padding: 0,
            }}>
              <X size={11} />
            </button>
          </div>
          <span style={{ fontSize: 12, color: "var(--text-dim)" }}>{t("botPhotoAttached")}</span>
        </div>
      )}

      <div style={{ padding: 12, borderTop: "1px solid var(--border)", display: "flex", gap: 8 }}>
        <button onClick={() => fileRef.current?.click()} title={t("botAttachPhoto")} style={{
          background: "var(--panel-2)", border: "1px solid var(--border)", borderRadius: 6,
          color: "var(--text-dim)", padding: "0 10px", display: "flex", alignItems: "center", cursor: "pointer",
        }}>
          <ImagePlus size={16} />
        </button>
        <input ref={fileRef} type="file" accept="image/*" onChange={pickImage} style={{ display: "none" }} />
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          placeholder={t("botPlaceholder")}
          style={{
            flex: 1, background: "var(--panel-2)", border: "1px solid var(--border)",
            borderRadius: 6, color: "var(--text)", padding: "9px 12px", fontSize: 13,
          }}
        />
        <button onClick={() => send()} disabled={loading} style={{
          background: "var(--accent)", border: "none", borderRadius: 6,
          color: "var(--accent-text)", padding: "0 12px", display: "flex", alignItems: "center", cursor: "pointer",
        }}>
          <Send size={16} />
        </button>
      </div>
    </div>
  );
}
