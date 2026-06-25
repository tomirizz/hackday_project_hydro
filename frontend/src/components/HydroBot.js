import React, { useState, useRef, useEffect } from "react";
import { askAssistant } from "../api/client";
import { Send, Bot, X } from "lucide-react";
import { categoryColor } from "../constants";

const EXAMPLES = [
  "Покажи все аварийные каналы",
  "Объекты старше 60 лет с высоким риском",
  "Что построено до 1950 года?",
];

export default function HydroBot({ onResults, onClose }) {
  const [messages, setMessages] = useState([
    { role: "bot", text: "Здравствуйте! Я ГидроБот. Спросите меня о состоянии объектов — например, «покажи аварийные каналы старше 50 лет»." },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => {
    scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight);
  }, [messages, loading]);

  const send = async (text) => {
    const q = (text ?? input).trim();
    if (!q || loading) return;
    setInput("");
    setMessages((m) => [...m, { role: "user", text: q }]);
    setLoading(true);

    try {
      const res = await askAssistant(q);
      setMessages((m) => [...m, {
        role: "bot",
        text: res.answer || "Готово.",
        objects: res.objects,
      }]);
      if (res.objects && onResults) onResults(res.objects);
    } catch (e) {
      setMessages((m) => [...m, {
        role: "bot",
        text: "Не удалось связаться с ГидроБотом. Проверьте, запущен ли бэкенд и задан ли ANTHROPIC_API_KEY.",
      }]);
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
        <strong style={{ fontSize: 14, flex: 1 }}>ГидроБот</strong>
        <button onClick={onClose} style={{ background: "none", border: "none", color: "var(--text-dim)" }}>
          <X size={18} />
        </button>
      </div>

      <div ref={scrollRef} style={{ flex: 1, overflowY: "auto", padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
        {messages.map((m, i) => (
          <div key={i} style={{
            alignSelf: m.role === "user" ? "flex-end" : "flex-start",
            maxWidth: "85%",
          }}>
            <div style={{
              background: m.role === "user" ? "var(--accent)" : "var(--panel-2)",
              color: m.role === "user" ? "#04342c" : "var(--text)",
              padding: "8px 12px", borderRadius: 10, fontSize: 13, lineHeight: 1.5,
            }}>
              {m.text}
            </div>
            {m.objects && m.objects.length > 0 && (
              <div style={{ marginTop: 6, display: "flex", flexDirection: "column", gap: 4 }}>
                {m.objects.slice(0, 5).map((o) => (
                  <div key={o.id} style={{
                    display: "flex", alignItems: "center", gap: 6,
                    fontSize: 12, color: "var(--text-dim)",
                  }}>
                    <span style={{ width: 7, height: 7, borderRadius: "50%", background: categoryColor(o.category) }} />
                    {o.name} · {(o.risk_score * 100).toFixed(0)}%
                  </div>
                ))}
                {m.objects.length > 5 && (
                  <div style={{ fontSize: 11, color: "var(--text-dim)" }}>
                    …и ещё {m.objects.length - 5} (подсвечены на карте)
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
        {loading && (
          <div style={{ alignSelf: "flex-start", color: "var(--text-dim)", fontSize: 13 }}>
            ГидроБот думает…
          </div>
        )}
      </div>

      {messages.length <= 1 && (
        <div style={{ padding: "0 16px 12px", display: "flex", flexWrap: "wrap", gap: 6 }}>
          {EXAMPLES.map((ex) => (
            <button key={ex} onClick={() => send(ex)} style={{
              background: "var(--panel-2)", border: "1px solid var(--border)",
              borderRadius: 14, color: "var(--text-dim)", padding: "4px 10px", fontSize: 11,
            }}>
              {ex}
            </button>
          ))}
        </div>
      )}

      <div style={{ padding: 12, borderTop: "1px solid var(--border)", display: "flex", gap: 8 }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          placeholder="Спросите о состоянии объектов…"
          style={{
            flex: 1, background: "var(--panel-2)", border: "1px solid var(--border)",
            borderRadius: 6, color: "var(--text)", padding: "9px 12px", fontSize: 13,
          }}
        />
        <button onClick={() => send()} disabled={loading} style={{
          background: "var(--accent)", border: "none", borderRadius: 6,
          color: "#04342c", padding: "0 12px", display: "flex", alignItems: "center",
        }}>
          <Send size={16} />
        </button>
      </div>
    </div>
  );
}
