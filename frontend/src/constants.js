export const CATEGORIES = {
  normal:   { label: "Исправное",        color: "#22c55e", short: "Норма" },
  watch:    { label: "Требует наблюдения", color: "#eab308", short: "Наблюдение" },
  repair:   { label: "Требует ремонта",   color: "#f97316", short: "Ремонт" },
  critical: { label: "Аварийное",         color: "#ef4444", short: "Авария" },
};

export const OBJECT_TYPES = {
  canal:        "Канал",
  hydropost:    "Гидропост",
  gate:         "Шлюз",
  pump_station: "Насосная станция",
  dam:          "Плотина/дамба",
  waterintake:  "Водозабор",
};

export function categoryColor(cat) {
  return CATEGORIES[cat]?.color || "#8b9bab";
}

export function categoryLabel(cat) {
  return CATEGORIES[cat]?.label || "Не определено";
}
