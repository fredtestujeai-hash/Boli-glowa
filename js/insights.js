// Analiza dziennika — czyste funkcje bez DOM (testowane w tests/insights.test.mjs).
import { ACUTE_CLASSES, SPECIFIC_CLASSES, ALARM_SYMPTOMS, TRIGGERS } from './constants.js';
import { addDays, daysBetween, isNum, mean, median, mondayIndex, plural, fmtNum } from './utils.js';

export const MIN_GROUP = 3; // min. liczba dni w każdej grupie porównania
export const MIN_KNOWN = 7; // min. liczba dni z uzupełnionym czynnikiem
export const RECOMMENDED_DAYS = 56; // NICE: dziennik przez co najmniej 8 tygodni

export const byDate = (a, b) => (a.entry_date < b.entry_date ? -1 : a.entry_date > b.entry_date ? 1 : 0);

export function inRange(entries, from, to) {
  return entries.filter((e) => (!from || e.entry_date >= from) && (!to || e.entry_date <= to));
}

// ---------------------------------------------------------------------------
// Leki: ból głowy z nadużywania leków (ICHD-3, 8.2)
// ---------------------------------------------------------------------------

/**
 * Liczy dni z lekami doraźnymi w podanym oknie (zwykle 30 dni).
 * Progi: zwykłe leki przeciwbólowe ≥15 dni, tryptany / złożone / opioidy / ergotamina ≥10 dni,
 * a także ≥10 dni łącznie, gdy łączone są różne grupy leków (8.2.6).
 */
export function medicationUse(entries) {
  let simpleDays = 0;
  let specificDays = 0;
  let anyDays = 0;
  const groups = new Set();
  for (const e of entries) {
    const cls = new Set((e.medications || []).map((m) => m.category).filter((c) => ACUTE_CLASSES.includes(c)));
    if (!cls.size) continue;
    anyDays++;
    if (cls.has('simple')) simpleDays++;
    if ([...cls].some((c) => SPECIFIC_CLASSES.includes(c))) specificDays++;
    cls.forEach((c) => groups.add(c));
  }
  const multiGroup = groups.size >= 2;
  let level = 'ok';
  if (simpleDays >= 15 || specificDays >= 10 || (anyDays >= 10 && multiGroup)) level = 'over';
  else if (simpleDays >= 10 || specificDays >= 7 || anyDays >= 10) level = 'near';
  return { simpleDays, specificDays, anyDays, groups: [...groups], level };
}

// ---------------------------------------------------------------------------
// Alerty zdrowotne (zawsze z ostatnich 30 dni)
// ---------------------------------------------------------------------------

const daysWord = (n) => plural(n, 'dzień', 'dni', 'dni');
const inDaysWord = (n) => plural(n, 'dniu', 'dniach', 'dniach');

export function buildAlerts(all, today) {
  const from = addDays(today, -29);
  const win = inRange(all, from, today);
  const alerts = [];
  const headacheDays = win.filter((e) => e.had_headache).length;
  const med = medicationUse(win);

  const alarm = win.filter((e) => (e.symptoms || []).some((s) => ALARM_SYMPTOMS.includes(s)));
  if (alarm.length) {
    alerts.push({
      level: 'danger',
      key: 'alarm',
      title: 'Zanotowano objawy alarmowe',
      text: `W ${alarm.length} ${inDaysWord(alarm.length)} bólowi głowy towarzyszyły objawy, które wymagają pilnej oceny lekarza. Jeśli występują teraz lub pojawiły się nagle, dzwoń pod 112.`,
    });
  }

  if (med.level === 'over') {
    alerts.push({
      level: 'danger',
      key: 'moh',
      title: 'Możliwe nadużywanie leków przeciwbólowych',
      text: `W ostatnich 30 dniach leki doraźne przyjęto w ${med.anyDays} ${inDaysWord(med.anyDays)}. Przyjmowanie ich tak często przez ponad 3 miesiące może samo wywoływać ból głowy (polekowy ból głowy, ICHD-3). Porozmawiaj z lekarzem, zanim zmienisz leczenie.`,
    });
  } else if (med.level === 'near') {
    alerts.push({
      level: 'warn',
      key: 'moh-near',
      title: 'Zbliżasz się do progu częstego stosowania leków',
      text: `Leki doraźne w ${med.anyDays} ${inDaysWord(med.anyDays)} z ostatnich 30. Bezpieczna granica to mniej niż 15 dni w miesiącu dla zwykłych leków przeciwbólowych i mniej niż 10 dni dla tryptanów i leków złożonych.`,
    });
  }

  if (headacheDays >= 15) {
    alerts.push({
      level: 'danger',
      key: 'chronic',
      title: `Ból głowy w ${headacheDays} ${inDaysWord(headacheDays)} z ostatnich 30`,
      text: 'Ból głowy przez 15 lub więcej dni w miesiącu może oznaczać postać przewlekłą. Pokaż ten dziennik lekarzowi: istnieje skuteczne leczenie zapobiegawcze.',
    });
  } else if (headacheDays >= 4) {
    alerts.push({
      level: 'info',
      key: 'frequent',
      title: `${headacheDays} ${daysWord(headacheDays)} z bólem w ostatnich 30 dniach`,
      text: 'Przy 4 lub więcej dniach bólu w miesiącu warto omówić z lekarzem leczenie zapobiegawcze (zalecenia EHF i AHS).',
    });
  }

  return alerts;
}

// ---------------------------------------------------------------------------
// Czynniki: porównanie odsetka dni z bólem „gdy czynnik występuje” vs „gdy nie”
// ---------------------------------------------------------------------------

const unit = (one, few, many, suffix = '') => (n) => `${plural(n, one, few, many)}${suffix}`;
const OP_WORDS = { '>': 'więcej niż', '>=': 'co najmniej', '<': 'mniej niż', '<=': 'najwyżej' };

export const NUMERIC_FACTORS = [
  { key: 'sleep_h', label: 'Sen', icon: 'moon', dir: 'low', fixed: 7, grid: 0.5, unit: unit('godzina', 'godziny', 'godzin', ' snu') },
  { key: 'screen_h', label: 'Telefon i ekrany', icon: 'phone', dir: 'high', grid: 0.5, unit: unit('godzina', 'godziny', 'godzin', ' przed ekranem') },
  { key: 'coffee', label: 'Kawa', icon: 'coffee', dir: 'high', unit: unit('kawa', 'kawy', 'kaw') },
  { key: 'energy_drinks', label: 'Energetyki', icon: 'bolt', dir: 'high', fixed: 1, unit: unit('energetyk', 'energetyki', 'energetyków') },
  { key: 'water_glasses', label: 'Woda', icon: 'droplet', dir: 'low', unit: unit('szklanka', 'szklanki', 'szklanek', ' wody') },
  { key: 'alcohol', label: 'Alkohol dzień wcześniej', icon: 'wine', dir: 'high', fixed: 1, lag: 1, unit: unit('porcja', 'porcje', 'porcji', ' alkoholu poprzedniego dnia') },
  { key: 'exercise_min', label: 'Ruch', icon: 'activity', dir: 'low', grid: 15, unit: unit('minuta', 'minuty', 'minut', ' ruchu') },
  { key: 'stress', label: 'Stres', icon: 'gauge', dir: 'high', fixed: 4, describe: () => 'wysoki stres (4–5 w skali 1–5)' },
  { key: 'sleep_quality', label: 'Jakość snu', icon: 'moon', dir: 'low', fixed: 2, op: '<', describe: () => 'zła jakość snu' },
];

function compare(entries, isRisk) {
  const g = { risk: [0, 0], other: [0, 0] }; // [dni, dni z bólem]
  for (const e of entries) {
    const r = isRisk(e);
    if (r == null) continue;
    const bucket = r ? g.risk : g.other;
    bucket[0]++;
    if (e.had_headache) bucket[1]++;
  }
  return g;
}

function result(spec, cond, g) {
  const [nRisk, hRisk] = g.risk;
  const [nOther, hOther] = g.other;
  if (nRisk < MIN_GROUP || nOther < MIN_GROUP) return null;
  const rateRisk = hRisk / nRisk;
  const rateOther = hOther / nOther;
  const diff = rateRisk - rateOther;
  let verdict = 'none';
  if (diff >= 0.25 && rateRisk >= 0.3) verdict = 'strong';
  else if (diff >= 0.12) verdict = 'possible';
  return { key: spec.key, label: spec.label, icon: spec.icon, cond, nRisk, hRisk, rateRisk, nOther, hOther, rateOther, diff, verdict };
}

function numericFactor(spec, entries, lookup) {
  const get = spec.lag
    ? (e) => {
        const prev = lookup.get(addDays(e.entry_date, -spec.lag));
        return prev && isNum(prev[spec.key]) ? prev[spec.key] : null;
      }
    : (e) => (isNum(e[spec.key]) ? e[spec.key] : null);

  const known = entries.filter((e) => get(e) != null);
  if (known.length < MIN_KNOWN) return null;
  const values = known.map(get);

  const attempt = (op, t) => {
    const test = { '>': (v) => v > t, '>=': (v) => v >= t, '<': (v) => v < t, '<=': (v) => v <= t }[op];
    const g = compare(known, (e) => test(get(e)));
    const cond = spec.describe ? spec.describe(t) : `${OP_WORDS[op]} ${fmtNum(t)} ${spec.unit(t)}`;
    return result(spec, cond, g);
  };

  if (spec.fixed != null) {
    const r = attempt(spec.op || (spec.dir === 'high' ? '>=' : '<'), spec.fixed);
    if (r || spec.describe) return r;
  }
  // Próg dopasowany do Twojej normy: mediana z dni z danymi, zaokrąglona do kroku pola
  // (np. 6,75 h -> „więcej niż 6,5 h”). Wartości leżą na tej siatce, więc podział się nie zmienia.
  const m = median(values);
  const grid = spec.grid || 1;
  return spec.dir === 'high'
    ? attempt('>', Math.floor(m / grid) * grid) || attempt('>=', m)
    : attempt('<', Math.ceil(m / grid) * grid) || attempt('<=', m);
}

export function computeFactors(entries, all = entries) {
  const lookup = new Map(all.map((e) => [e.entry_date, e]));
  const out = [];
  for (const spec of NUMERIC_FACTORS) {
    const r = numericFactor(spec, entries, lookup);
    if (r) out.push(r);
  }
  for (const t of TRIGGERS) {
    const g = compare(entries, (e) => (e.triggers || []).includes(t.key));
    const r = result({ key: `trigger:${t.key}`, label: t.label, icon: 'spark' }, t.label.toLowerCase(), g);
    if (r) out.push(r);
  }
  const rank = { strong: 0, possible: 1, none: 2 };
  return out.sort((a, b) => rank[a.verdict] - rank[b.verdict] || b.diff - a.diff);
}

// ---------------------------------------------------------------------------
// Profil bólu: cechy migrenowe / napięciowe (ICHD-3) — wskazówka, nie diagnoza
// ---------------------------------------------------------------------------

export function classifyAttack(e) {
  if (!e.had_headache) return null;
  const loc = e.locations || [];
  const q = e.qualities || [];
  const s = e.symptoms || [];
  const unilateral = loc.some((l) => ['left', 'right', 'eye'].includes(l)) && !loc.includes('both') && !loc.includes('whole');
  const pulsating = q.includes('pulsating');
  const modSevere = isNum(e.intensity) && e.intensity >= 4;
  const movement = s.includes('movement');
  const nausea = s.includes('nausea') || s.includes('vomiting');
  const photoPhono = s.includes('photophobia') && s.includes('phonophobia');
  const longEnough = !isNum(e.duration_h) || e.duration_h >= 4;
  const migraineFeatures = [unilateral, pulsating, modSevere, movement].filter(Boolean).length;
  if (longEnough && migraineFeatures >= 2 && (nausea || photoPhono)) return 'migraine';

  const bilateral = !unilateral && loc.some((l) => ['both', 'whole', 'forehead', 'occiput', 'temples'].includes(l));
  const pressing = !pulsating && (q.includes('pressing') || q.includes('dull'));
  const mildModerate = isNum(e.intensity) && e.intensity <= 6;
  const tensionFeatures = [bilateral, pressing, mildModerate, !movement].filter(Boolean).length;
  if ((bilateral || pressing) && tensionFeatures >= 2 && !nausea && !photoPhono) return 'tension';
  return null;
}

// ---------------------------------------------------------------------------
// Pełna analiza okresu
// ---------------------------------------------------------------------------

function countKeys(entries, field) {
  const map = new Map();
  for (const e of entries) for (const k of e[field] || []) map.set(k, (map.get(k) || 0) + 1);
  return [...map.entries()].map(([key, count]) => ({ key, count })).sort((a, b) => b.count - a.count);
}

export function medEffectiveness(entries) {
  const map = new Map();
  for (const e of entries) {
    for (const m of e.medications || []) {
      const id = m.name.trim().toLowerCase();
      if (!map.has(id)) map.set(id, { name: m.name.trim(), category: m.category, uses: 0, yes: 0, partial: 0, no: 0, unknown: 0 });
      const r = map.get(id);
      r.uses++;
      r[m.effect || 'unknown']++;
    }
  }
  return [...map.values()]
    .map((r) => {
      const rated = r.yes + r.partial + r.no;
      return { ...r, rated, score: rated ? (r.yes + r.partial * 0.5) / rated : null };
    })
    .sort((a, b) => b.uses - a.uses);
}

export function analyze(all, { from, to }) {
  const sorted = [...all].sort(byDate);
  const entries = inRange(sorted, from, to);
  const pain = entries.filter((e) => e.had_headache);
  const intensities = pain.map((e) => e.intensity).filter(isNum);
  const durations = pain.map((e) => e.duration_h).filter(isNum);

  const onset = [0, 0, 0, 0]; // noc, rano, popołudnie, wieczór
  for (const e of pain) {
    if (!e.start_time) continue;
    const h = Number(e.start_time.slice(0, 2));
    onset[Math.floor(h / 6)]++;
  }

  const weekdays = Array.from({ length: 7 }, () => ({ logged: 0, pain: 0 }));
  for (const e of entries) {
    const w = weekdays[mondayIndex(e.entry_date)];
    w.logged++;
    if (e.had_headache) w.pain++;
  }

  const lastPain = [...sorted].reverse().find((e) => e.had_headache && e.entry_date <= to);
  const first = sorted[0]?.entry_date ?? null;

  const types = { migraine: 0, tension: 0 };
  for (const e of pain) {
    const t = classifyAttack(e);
    if (t) types[t]++;
  }

  return {
    from,
    to,
    logged: entries.length,
    painDays: pain.length,
    freeDays: entries.length - pain.length,
    avgIntensity: mean(intensities),
    maxIntensity: intensities.length ? Math.max(...intensities) : null,
    severeDays: intensities.filter((v) => v >= 7).length,
    totalHours: durations.reduce((a, b) => a + b, 0),
    avgDuration: mean(durations),
    disabledDays: pain.filter((e) => e.disability === 2).length,
    medDays: entries.filter((e) => (e.medications || []).length).length,
    medUse: medicationUse(entries),
    daysSinceLastPain: lastPain ? daysBetween(lastPain.entry_date, to) : null,
    trackingDays: first ? daysBetween(first, to) + 1 : 0,
    onset,
    weekdays,
    factors: computeFactors(entries, sorted),
    meds: medEffectiveness(entries),
    locations: countKeys(pain, 'locations'),
    qualities: countKeys(pain, 'qualities'),
    symptoms: countKeys(pain, 'symptoms'),
    triggers: countKeys(entries, 'triggers'),
    types,
    lifestyle: {
      sleep_h: mean(entries.map((e) => e.sleep_h).filter(isNum)),
      screen_h: mean(entries.map((e) => e.screen_h).filter(isNum)),
      coffee: mean(entries.map((e) => e.coffee).filter(isNum)),
      energy_drinks: mean(entries.map((e) => e.energy_drinks).filter(isNum)),
      water_glasses: mean(entries.map((e) => e.water_glasses).filter(isNum)),
      alcohol: mean(entries.map((e) => e.alcohol).filter(isNum)),
      exercise_min: mean(entries.map((e) => e.exercise_min).filter(isNum)),
      stress: mean(entries.map((e) => e.stress).filter(isNum)),
    },
  };
}
