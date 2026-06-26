// ──────────────────────────────────────────────────────────────────────────
// Ядро аналитики. Здесь:
//   • определения «измерений» для кросс-фильтрации (как слайсеры Power BI)
//   • производные поля объектов
//   • вычисление KPI, корреляций, прогноза, Парето, приоритизации
//   • генератор автоматических инсайтов
// Все функции чистые и работают на стороне клиента → мгновенная фильтрация.
// ──────────────────────────────────────────────────────────────────────────

import {
  nums, mean, median, pearson, linregress, sum, round,
} from "./stats";
import { L } from "./i18n_analytics";

export const CAT_COLOR = {
  normal: "#22c55e",
  watch: "#eab308",
  repair: "#f97316",
  critical: "#ef4444",
};
const SIG_COLOR = { republican: "#ef4444", regional: "#f59e0b", local: "#3b82f6" };
const ZONE_COLOR = { zone_w: "#2dd4bf", zone_c: "#38bdf8", zone_e: "#818cf8", zone_se: "#c084fc" };
const TYPE_COLOR = {
  canal: "#3b82f6", hydropost: "#06b6d4", gate: "#8b5cf6",
  pump_station: "#f59e0b", dam: "#ef4444", waterintake: "#10b981",
};

const CURRENT_YEAR = 2026;

// ── Производные поля (вычисляются один раз при загрузке) ─────────────────────
export function deriveObjects(rawList) {
  return rawList.map((o) => {
    const lengthTotal = +o.length_total_km || 0;
    const lengthLined = +o.length_lined_km || 0;
    const linedRatio = lengthTotal > 0 ? Math.min(lengthLined / lengthTotal, 1) : null;
    const effDrop = o.efficiency_drop != null ? +o.efficiency_drop : null;
    const cap = +o.capacity_m3s || 0;
    // Потеря пропускной способности из-за падения КПД (только положительная часть)
    const waterLoss = effDrop != null && effDrop > 0 ? cap * effDrop : 0;
    const age = o.age != null ? +o.age : (o.year_built ? CURRENT_YEAR - +o.year_built : null);
    return {
      ...o,
      _linedRatio: linedRatio,
      _waterLoss: waterLoss,
      _age: age,
      _area: o.suspended_area_ha != null ? +o.suspended_area_ha : 0,
      _risk: +o.risk_score || 0,
      _importance: o.importance != null ? +o.importance : 0,
    };
  });
}

// ── Измерения для кросс-фильтрации ──────────────────────────────────────────
// Каждое измерение: как достать значение объекта, порядок категорий, цвета, подписи.
export function buildDimensions(lang) {
  return {
    category: {
      id: "category",
      title: L(lang, "byState"),
      valueOf: (o) => o.category,
      order: ["normal", "watch", "repair", "critical"],
      color: (k) => CAT_COLOR[k] || "#64748b",
      label: (k) => L(lang, `cat_${k}`),
    },
    type: {
      id: "type",
      title: L(lang, "byType"),
      valueOf: (o) => o.type_code,
      order: ["canal", "waterintake", "hydropost", "dam", "pump_station", "gate"],
      color: (k) => TYPE_COLOR[k] || "#64748b",
      label: (k) => L(lang, `type_${k}`),
    },
    significance: {
      id: "significance",
      title: L(lang, "bySig"),
      valueOf: (o) => {
        const imp = o._importance;
        if (imp >= 0.5) return "republican";
        if (imp >= 0.25) return "regional";
        return "local";
      },
      order: ["republican", "regional", "local"],
      color: (k) => SIG_COLOR[k] || "#64748b",
      label: (k) => L(lang, `sig_${k}`),
    },
    zone: {
      id: "zone",
      title: L(lang, "byZone"),
      valueOf: (o) => {
        const lon = +o.lon;
        if (lon < 70.75) return "zone_w";
        if (lon < 72.0) return "zone_c";
        if (lon < 73.25) return "zone_e";
        return "zone_se";
      },
      order: ["zone_w", "zone_c", "zone_e", "zone_se"],
      color: (k) => ZONE_COLOR[k] || "#64748b",
      label: (k) => L(lang, `zone_${k}`),
    },
    ageBucket: {
      id: "ageBucket",
      title: L(lang, "byAge"),
      valueOf: (o) => {
        const a = o._age;
        if (a == null) return null;
        if (a < 20) return "0–20";
        if (a < 40) return "20–40";
        if (a < 60) return "40–60";
        if (a < 80) return "60–80";
        if (a < 100) return "80–100";
        return "100+";
      },
      order: ["0–20", "20–40", "40–60", "60–80", "80–100", "100+"],
      color: () => "#38bdf8",
      label: (k) => k,
    },
    decade: {
      id: "decade",
      title: L(lang, "byDecade"),
      valueOf: (o) => (o.year_built ? Math.floor(+o.year_built / 10) * 10 : null),
      order: null, // динамический
      color: () => "#38bdf8",
      label: (k) => `${k}s`,
    },
  };
}

// ── Фильтрация ──────────────────────────────────────────────────────────────
// filters: { [dimId]: Set<value> }. Пустой Set = измерение не фильтрует.
export function applyFilters(objects, filters, dims, exceptDim = null) {
  const active = Object.keys(filters).filter(
    (d) => d !== exceptDim && filters[d] && filters[d].size > 0
  );
  if (!active.length) return objects;
  return objects.filter((o) =>
    active.every((d) => filters[d].has(dims[d].valueOf(o)))
  );
}

// Данные для диаграммы-измерения (с учётом всех фильтров КРОМЕ собственного).
export function dimChartData(objects, filters, dims, dimId) {
  const dim = dims[dimId];
  const base = applyFilters(objects, filters, dims, dimId);
  const counts = new Map();
  for (const o of base) {
    const k = dim.valueOf(o);
    if (k == null) continue;
    counts.set(k, (counts.get(k) || 0) + 1);
  }
  let keys;
  if (dim.order) keys = dim.order.filter((k) => counts.has(k));
  else keys = [...counts.keys()].sort((a, b) => a - b);
  const sel = filters[dimId];
  return keys.map((k) => ({
    key: k,
    name: dim.label(k),
    value: counts.get(k) || 0,
    color: dim.color(k),
    selected: !sel || sel.size === 0 || sel.has(k),
  }));
}

// Данные «риск + кол-во по десятилетиям» (для composed-графика).
export function decadeRiskData(objects, filters, dims) {
  const base = applyFilters(objects, filters, dims, "decade");
  const map = new Map();
  for (const o of base) {
    if (!o.year_built) continue;
    const d = Math.floor(+o.year_built / 10) * 10;
    if (!map.has(d)) map.set(d, { decadeNum: d, count: 0, riskSum: 0 });
    const e = map.get(d);
    e.count += 1;
    e.riskSum += o._risk;
  }
  const sel = filters.decade;
  return [...map.values()]
    .filter((e) => e.count >= 2)
    .sort((a, b) => a.decadeNum - b.decadeNum)
    .map((e) => ({
      decade: `${e.decadeNum}s`,
      decadeNum: e.decadeNum,
      count: e.count,
      risk: round((e.riskSum / e.count) * 100),
      selected: !sel || sel.size === 0 || sel.has(e.decadeNum),
    }));
}

// ── KPI выборки ──────────────────────────────────────────────────────────────
export function computeKPIs(filtered, all) {
  const k = (set) => ({
    total: set.length,
    risk: round(mean(nums(set, "_risk")) * 100, 1),
    critical: set.filter((o) => o.category === "critical").length,
    kpd: round(mean(nums(set, "efficiency_actual")) * 100, 1),
    age: round(mean(nums(set, "_age")), 0),
    area: round(sum(nums(set, "_area"))),
  });
  return { sel: k(filtered), base: k(all) };
}

// ── Корреляции: что влияет на риск ───────────────────────────────────────────
const RISK_FACTORS = [
  { key: "_age", labelKey: "factor_age" },
  { key: "wear_percent", labelKey: "factor_wear" },
  { key: "efficiency_actual", labelKey: "factor_eff_actual" },
  { key: "efficiency_drop", labelKey: "factor_eff_drop" },
  { key: "capacity_m3s", labelKey: "factor_capacity" },
  { key: "_linedRatio", labelKey: "factor_lined" },
  { key: "_importance", labelKey: "factor_importance" },
  { key: "_area", labelKey: "factor_area" },
];

export function riskDrivers(filtered, lang) {
  const out = [];
  for (const f of RISK_FACTORS) {
    const { r, n } = pearson(filtered, "_risk", f.key);
    if (n >= 8 && Math.abs(r) >= 0.08) {
      out.push({ key: f.key, label: L(lang, f.labelKey), r: round(r, 2), n });
    }
  }
  out.sort((a, b) => Math.abs(b.r) - Math.abs(a.r));
  return out;
}

// ── Точечная диаграмма возраст↔риск + тренд + аномалии ───────────────────────
export function ageRiskScatter(filtered) {
  const medAge = median(nums(filtered, "_age"));
  const pts = filtered
    .filter((o) => o._age != null)
    .map((o) => ({
      x: o._age,
      y: round(o._risk * 100, 1),
      name: o.name,
      category: o.category,
      color: CAT_COLOR[o.category] || "#64748b",
      // Аномалия: молодой, но аварийный (преждевременный износ)
      anomaly: o.category === "critical" && o._age < medAge,
    }));
  // Тренд по всем точкам
  const reg = linregress(pts.map((p) => ({ x: p.x, y: p.y })));
  let trend = null;
  if (pts.length >= 5) {
    const xsArr = pts.map((p) => p.x);
    const xMin = Math.min(...xsArr);
    const xMax = Math.max(...xsArr);
    trend = [
      { x: xMin, y: round(reg.intercept + reg.slope * xMin, 1) },
      { x: xMax, y: round(reg.intercept + reg.slope * xMax, 1) },
    ];
  }
  return { points: pts, trend, anomalies: pts.filter((p) => p.anomaly) };
}

// ── Прогноз деградации парка ─────────────────────────────────────────────────
export function degradationForecast(filtered, yearsAhead = 20) {
  const total = filtered.length || 1;
  const baseCritical = filtered.filter((o) => o.category === "critical").length;
  const fc = filtered
    .filter((o) => o.category !== "critical" && o.forecast_critical_year != null)
    .map((o) => +o.forecast_critical_year);
  const series = [];
  for (let i = 0; i <= yearsAhead; i++) {
    const y = CURRENT_YEAR + i;
    const added = fc.filter((yr) => yr <= y).length;
    const crit = baseCritical + added;
    series.push({ year: y, count: crit, share: round((crit / total) * 100, 1) });
  }
  return series;
}

// ── Парето: концентрация площади под риском ──────────────────────────────────
export function paretoAnalysis(filtered) {
  const items = filtered
    .map((o) => ({ name: o.name, contrib: o._area * o._risk, area: o._area, risk: o._risk }))
    .filter((x) => x.contrib > 0)
    .sort((a, b) => b.contrib - a.contrib);
  const totalContrib = sum(items.map((x) => x.contrib)) || 1;
  let cum = 0;
  const withCum = items.map((x, i) => {
    cum += x.contrib;
    return {
      idx: i + 1,
      name: x.name,
      contribPct: round((x.contrib / totalContrib) * 100, 2),
      cumPct: round((cum / totalContrib) * 100, 1),
    };
  });
  // Сколько объектов держат 80% площади под риском
  let n80 = withCum.findIndex((x) => x.cumPct >= 80) + 1;
  if (n80 <= 0) n80 = withCum.length;
  const cumAt80 = withCum[Math.max(0, n80 - 1)]?.cumPct || 0;
  return {
    chart: withCum.slice(0, 30),
    n80,
    pctObjects: round((n80 / (filtered.length || 1)) * 100, 0),
    areaPct: round(cumAt80, 0),
    totalItems: withCum.length,
  };
}

// ── Приоритизация ремонта (predictive maintenance) ───────────────────────────
export function repairPriorities(filtered, limit = 12) {
  const areas = nums(filtered, "_area");
  const maxArea = Math.max(1, ...areas);
  const scored = filtered.map((o) => {
    const areaW = 0.3 + 0.7 * (o._area / maxArea); // вес площади 0.3..1
    const impW = 0.4 + o._importance; // значимость
    const score = o._risk * impW * areaW;
    return { ...o, _priority: score };
  });
  const maxScore = Math.max(0.0001, ...scored.map((s) => s._priority));
  return scored
    .sort((a, b) => b._priority - a._priority)
    .slice(0, limit)
    .map((o) => ({
      id: o.id,
      name: o.name,
      category: o.category,
      type_code: o.type_code,
      risk: round(o._risk * 100, 0),
      area: round(o._area),
      score: round((o._priority / maxScore) * 100, 0),
    }));
}

// ── Генератор автоматических инсайтов ────────────────────────────────────────
// Возвращает массив { icon, tone, title, body, salience }. Сортируется по
// важности (salience), сверху — самые яркие находки для текущей выборки.
export function generateInsights(filtered, lang) {
  const ins = [];
  const total = filtered.length;
  if (total < 4) return ins;

  // 1) Потери воды из-за падения КПД
  const lossSum = sum(filtered.map((o) => o._waterLoss));
  const designCap = sum(filtered.map((o) => (+o.capacity_m3s || 0) * (+o.efficiency_design || 0)));
  if (lossSum > 0.5 && designCap > 0) {
    const pct = round((lossSum / designCap) * 100, 0);
    ins.push({
      icon: "Droplets", tone: "info",
      title: L(lang, "insWaterLossT"),
      body: L(lang, "insWaterLossB", { val: round(lossSum, 1), pct }),
      salience: 60 + Math.min(pct, 40),
    });
  }

  // 2) Орошаемые земли под угрозой
  const areaTotal = sum(filtered.map((o) => o._area));
  const areaRisk = sum(filtered.filter((o) => o.category === "critical" || o.category === "repair").map((o) => o._area));
  if (areaTotal > 0 && areaRisk > 0) {
    const pct = round((areaRisk / areaTotal) * 100, 0);
    ins.push({
      icon: "Sprout", tone: pct >= 30 ? "danger" : "warn",
      title: L(lang, "insAreaRiskT"),
      body: L(lang, "insAreaRiskB", { area: new Intl.NumberFormat("ru-RU").format(round(areaRisk)), pct }),
      salience: 55 + pct,
    });
  }

  // 3) Преждевременный износ (молодые, но аварийные)
  const ages = nums(filtered, "_age");
  const medAge = median(ages);
  const premature = filtered.filter((o) => o.category === "critical" && o._age != null && o._age < medAge).length;
  if (premature >= 3) {
    ins.push({
      icon: "Zap", tone: "warn",
      title: L(lang, "insPrematureT"),
      body: L(lang, "insPrematureB", { n: premature, age: round(medAge) }),
      salience: 50 + premature * 1.5,
    });
  }

  // 4) Главный фактор риска
  const drivers = riskDrivers(filtered, lang);
  if (drivers.length) {
    const d = drivers[0];
    const dir = d.r > 0 ? L(lang, "dirPos") : L(lang, "dirNeg");
    ins.push({
      icon: "GitBranch", tone: "info",
      title: L(lang, "insDriverT"),
      body: L(lang, "insDriverB", { factor: d.label, r: d.r.toFixed(2), dir }),
      salience: 45 + Math.abs(d.r) * 60,
    });
  }

  // 5) Прогноз
  const fc = degradationForecast(filtered, 9);
  if (fc.length) {
    const now = fc[0].share;
    const target = fc[fc.length - 1];
    if (target.share - now >= 3) {
      ins.push({
        icon: "TrendingUp", tone: "danger",
        title: L(lang, "insForecastT", { year: target.year }),
        body: L(lang, "insForecastB", { now: round(now), then: round(target.share), year: target.year }),
        salience: 58 + (target.share - now),
      });
    }
  }

  // 6) Очаг проблем по зонам
  const zoneRisk = new Map();
  for (const o of filtered) {
    const lon = +o.lon;
    let z = "zone_se";
    if (lon < 70.75) z = "zone_w";
    else if (lon < 72.0) z = "zone_c";
    else if (lon < 73.25) z = "zone_e";
    if (!zoneRisk.has(z)) zoneRisk.set(z, []);
    zoneRisk.get(z).push(o._risk);
  }
  let hotZone = null, hotVal = -1, allZoneAvg = mean(nums(filtered, "_risk"));
  for (const [z, arr] of zoneRisk.entries()) {
    if (arr.length < 5) continue;
    const m = mean(arr);
    if (m > hotVal) { hotVal = m; hotZone = z; }
  }
  if (hotZone && hotVal > allZoneAvg * 1.1) {
    ins.push({
      icon: "MapPin", tone: "warn",
      title: L(lang, "insHotZoneT"),
      body: L(lang, "insHotZoneB", { zone: L(lang, `zone_${hotZone}`), risk: round(hotVal * 100) }),
      salience: 40 + (hotVal - allZoneAvg) * 100,
    });
  }

  // 7) Аномалия данных: КПД факт > проект
  const negDrop = filtered.filter((o) => o.efficiency_drop != null && +o.efficiency_drop < -0.001).length;
  if (negDrop >= 4) {
    ins.push({
      icon: "AlertTriangle", tone: "info",
      title: L(lang, "insAnomEffT"),
      body: L(lang, "insAnomEffB", { n: negDrop }),
      salience: 35 + Math.min(negDrop, 30),
    });
  }

  // 8) Возрастной порог
  if (ages.length >= 10) {
    const thr = round(median(filtered.map((o) => o.year_built).filter(Boolean)));
    const older = filtered.filter((o) => o.year_built && +o.year_built < thr);
    const newer = filtered.filter((o) => o.year_built && +o.year_built >= thr);
    if (older.length >= 5 && newer.length >= 5) {
      const ro = mean(nums(older, "_risk")) * 100;
      const rn = mean(nums(newer, "_risk")) * 100;
      if (ro > rn * 1.2 && rn > 0) {
        ins.push({
          icon: "History", tone: "warn",
          title: L(lang, "insAgingCliffT"),
          body: L(lang, "insAgingCliffB", { year: thr, oldRisk: round(ro), newRisk: round(rn), x: round(ro / rn, 1) }),
          salience: 42 + (ro - rn),
        });
      }
    }
  }

  // 9) Концентрация риска (Парето)
  const par = paretoAnalysis(filtered);
  if (par.totalItems >= 10 && par.pctObjects <= 45 && par.areaPct >= 60) {
    ins.push({
      icon: "Target", tone: "info",
      title: L(lang, "insConcentrationT"),
      body: L(lang, "insConcentrationB", { n: par.n80, pct: par.pctObjects, areapct: par.areaPct }),
      salience: 38 + (par.areaPct - par.pctObjects),
    });
  }

  ins.sort((a, b) => b.salience - a.salience);
  return ins;
}
