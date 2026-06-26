// ──────────────────────────────────────────────────────────────────────────
// Статистические функции для движка аналитики.
// Чистые функции без побочных эффектов — основа авто-анализа данных.
// ──────────────────────────────────────────────────────────────────────────

/** Числовые значения поля (без null/NaN). */
export function nums(arr, key) {
  const out = [];
  for (const o of arr) {
    const v = typeof key === "function" ? key(o) : o[key];
    if (v != null && Number.isFinite(+v)) out.push(+v);
  }
  return out;
}

export function mean(xs) {
  if (!xs.length) return 0;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

export function std(xs) {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  const v = xs.reduce((a, b) => a + (b - m) ** 2, 0) / (xs.length - 1);
  return Math.sqrt(v);
}

export function median(xs) {
  return quantile(xs, 0.5);
}

/** Перцентиль (0..1), линейная интерполяция. */
export function quantile(xs, q) {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const pos = (s.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  return s[base + 1] !== undefined ? s[base] + rest * (s[base + 1] - s[base]) : s[base];
}

export function sum(xs) {
  return xs.reduce((a, b) => a + b, 0);
}

/** Коэффициент корреляции Пирсона по двум полям набора объектов. */
export function pearson(arr, keyA, keyB) {
  const pairs = [];
  for (const o of arr) {
    const a = typeof keyA === "function" ? keyA(o) : o[keyA];
    const b = typeof keyB === "function" ? keyB(o) : o[keyB];
    if (a != null && b != null && Number.isFinite(+a) && Number.isFinite(+b)) {
      pairs.push([+a, +b]);
    }
  }
  const n = pairs.length;
  if (n < 5) return { r: 0, n };
  const xs = pairs.map((p) => p[0]);
  const ys = pairs.map((p) => p[1]);
  const mx = mean(xs);
  const my = mean(ys);
  let cov = 0, vx = 0, vy = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - mx;
    const dy = ys[i] - my;
    cov += dx * dy;
    vx += dx * dx;
    vy += dy * dy;
  }
  const denom = Math.sqrt(vx * vy);
  return { r: denom === 0 ? 0 : cov / denom, n };
}

/** Линейная регрессия y = a + b·x. Возвращает наклон, сдвиг, R². */
export function linregress(points) {
  const pts = points.filter(
    (p) => Number.isFinite(+p.x) && Number.isFinite(+p.y)
  );
  const n = pts.length;
  if (n < 3) return { slope: 0, intercept: mean(pts.map((p) => p.y)), r2: 0, n };
  const xs = pts.map((p) => +p.x);
  const ys = pts.map((p) => +p.y);
  const mx = mean(xs);
  const my = mean(ys);
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < n; i++) {
    sxy += (xs[i] - mx) * (ys[i] - my);
    sxx += (xs[i] - mx) ** 2;
    syy += (ys[i] - my) ** 2;
  }
  const slope = sxx === 0 ? 0 : sxy / sxx;
  const intercept = my - slope * mx;
  const r2 = sxx === 0 || syy === 0 ? 0 : (sxy * sxy) / (sxx * syy);
  return { slope, intercept, r2, n };
}

/** Z-оценка значения относительно набора (для поиска аномалий). */
export function zScore(value, xs) {
  const s = std(xs);
  if (s === 0) return 0;
  return (value - mean(xs)) / s;
}

/** Подсчёт по дискретному ключу → [{ key, count }]. */
export function countBy(arr, keyFn) {
  const map = new Map();
  for (const o of arr) {
    const k = keyFn(o);
    if (k == null) continue;
    map.set(k, (map.get(k) || 0) + 1);
  }
  return [...map.entries()].map(([key, count]) => ({ key, count }));
}

/** Округление до знака. */
export function round(x, d = 0) {
  const f = 10 ** d;
  return Math.round((+x || 0) * f) / f;
}

/** Компактный формат больших чисел: 12 540 → "12,5 тыс.". */
export function compact(x, unitK = "тыс.", unitM = "млн") {
  const v = +x || 0;
  if (Math.abs(v) >= 1e6) return `${round(v / 1e6, 1)} ${unitM}`;
  if (Math.abs(v) >= 1e4) return `${round(v / 1e3, 1)} ${unitK}`;
  return new Intl.NumberFormat("ru-RU").format(round(v));
}

/** Разделители тысяч. */
export function fmt(x, d = 0) {
  return new Intl.NumberFormat("ru-RU", {
    minimumFractionDigits: d,
    maximumFractionDigits: d,
  }).format(+x || 0);
}
