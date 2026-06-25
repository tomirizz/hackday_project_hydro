import React, { createContext, useContext, useState, useEffect } from "react";
import { TRANSLATIONS } from "./i18n";

const AppContext = createContext(null);

export function AppProvider({ children }) {
  // Язык: читаем из памяти браузера или по умолчанию русский
  const [lang, setLang] = useState(() => {
    try {
      return localStorage.getItem("hydro_lang") || "ru";
    } catch {
      return "ru";
    }
  });

  // Тема: тёмная по умолчанию
  const [theme, setTheme] = useState(() => {
    try {
      return localStorage.getItem("hydro_theme") || "dark";
    } catch {
      return "dark";
    }
  });

  // Сохраняем выбор языка
  useEffect(() => {
    try { localStorage.setItem("hydro_lang", lang); } catch {}
  }, [lang]);

  // Применяем тему к <html> и сохраняем
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    try { localStorage.setItem("hydro_theme", theme); } catch {}
  }, [theme]);

  // Функция перевода: t("key") -> строка на текущем языке
  const t = (key) => {
    return TRANSLATIONS[lang]?.[key] || TRANSLATIONS.ru[key] || key;
  };

  const toggleTheme = () => setTheme((p) => (p === "dark" ? "light" : "dark"));

  return (
    <AppContext.Provider value={{ lang, setLang, theme, toggleTheme, t }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}

// Хелперы для категорий и типов с учётом языка
export function catLabel(t, category) {
  return t(`cat_${category}`) || category;
}

export function typeLabel(t, typeCode) {
  return t(`type_${typeCode}`) || typeCode;
}
