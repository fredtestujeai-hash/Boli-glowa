// Pomocnicze funkcje bez zależności od DOM — używane też w testach (Node).

export const MONTHS = ['Styczeń', 'Luty', 'Marzec', 'Kwiecień', 'Maj', 'Czerwiec', 'Lipiec', 'Sierpień', 'Wrzesień', 'Październik', 'Listopad', 'Grudzień'];
export const MONTHS_GEN = ['stycznia', 'lutego', 'marca', 'kwietnia', 'maja', 'czerwca', 'lipca', 'sierpnia', 'września', 'października', 'listopada', 'grudnia'];
export const WEEKDAYS = ['niedziela', 'poniedziałek', 'wtorek', 'środa', 'czwartek', 'piątek', 'sobota'];
// Tydzień w Polsce zaczyna się w poniedziałek.
export const WEEKDAYS_SHORT = ['Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'So', 'Nd'];

export const pad = (n) => String(n).padStart(2, '0');

/** Data lokalna -> 'RRRR-MM-DD' (bez przesunięć strefy czasowej). */
export const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export const parseYmd = (s) => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
};

// Odrzuca też daty „przepełnione”, np. 2026-13-45 (Date by je po cichu przesunął).
export const isYmd = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && ymd(parseYmd(s)) === s;

export const addDays = (s, n) => {
  const d = parseYmd(s);
  d.setDate(d.getDate() + n);
  return ymd(d);
};

export const todayYmd = () => ymd(new Date());

/** Liczba dni od a do b (b - a). Zaokrąglenie neutralizuje zmianę czasu letniego. */
export const daysBetween = (a, b) => Math.round((parseYmd(b) - parseYmd(a)) / 86400000);

/** 0 = poniedziałek … 6 = niedziela */
export const mondayIndex = (s) => (parseYmd(s).getDay() + 6) % 7;

export const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

export function formatLongDate(s) {
  const d = parseYmd(s);
  return `${cap(WEEKDAYS[d.getDay()])}, ${d.getDate()} ${MONTHS_GEN[d.getMonth()]}`;
}

export function formatDayMonth(s) {
  const d = parseYmd(s);
  return `${d.getDate()} ${MONTHS_GEN[d.getMonth()]}`;
}

export function formatNumericDate(s) {
  const d = parseYmd(s);
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`;
}

/** Polska odmiana liczebników: 1 dzień, 2 dni, 5 dni; ułamki -> forma „few” (2,5 godziny). */
export function plural(n, one, few, many) {
  const a = Math.abs(n);
  if (!Number.isInteger(a)) return few;
  if (a === 1) return one;
  const n10 = a % 10;
  const n100 = a % 100;
  if (n10 >= 2 && n10 <= 4 && !(n100 >= 12 && n100 <= 14)) return few;
  return many;
}

export const isNum = (v) => typeof v === 'number' && Number.isFinite(v);

export function fmtNum(n, digits = 1) {
  if (!isNum(n)) return '—';
  return n.toLocaleString('pl-PL', { maximumFractionDigits: digits });
}

export const pct = (x) => `${Math.round(x * 100)}%`;

export const mean = (arr) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null);

export function median(arr) {
  if (!arr.length) return null;
  const s = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

const HTML_ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => HTML_ESCAPES[c]);
