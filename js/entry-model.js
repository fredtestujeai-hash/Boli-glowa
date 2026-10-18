// Model jednego dnia w dzienniku + walidacja zgodna z ograniczeniami w bazie danych.
import { LOCATIONS, QUALITIES, SYMPTOMS, TRIGGERS, MED_CLASSES, detectMedClass } from './constants.js';
import { isYmd, pad } from './utils.js';

export const ENTRY_COLUMNS = [
  'entry_date', 'had_headache', 'intensity', 'start_time', 'duration_h',
  'locations', 'qualities', 'symptoms', 'disability', 'medications',
  'sleep_h', 'sleep_quality', 'screen_h', 'coffee', 'energy_drinks',
  'water_glasses', 'stress', 'alcohol', 'exercise_min', 'triggers', 'notes',
];

const NUMERIC_FIELDS = {
  intensity: [0, 10, 1],
  duration_h: [0, 168, 0.1],
  disability: [0, 2, 1],
  sleep_h: [0, 24, 0.1],
  sleep_quality: [1, 3, 1],
  screen_h: [0, 24, 0.1],
  coffee: [0, 30, 1],
  energy_drinks: [0, 30, 1],
  water_glasses: [0, 40, 1],
  stress: [1, 5, 1],
  alcohol: [0, 40, 1],
  exercise_min: [0, 1440, 1],
};

const LIST_FIELDS = { locations: LOCATIONS, qualities: QUALITIES, symptoms: SYMPTOMS, triggers: TRIGGERS };

// Pola opisujące sam epizod bólu — czyszczone, gdy dzień jest bez bólu.
const PAIN_FIELDS = ['intensity', 'start_time', 'duration_h', 'disability'];
const PAIN_LISTS = ['locations', 'qualities', 'symptoms'];

export function blankEntry(date) {
  return {
    entry_date: date,
    had_headache: null,
    intensity: null,
    start_time: null,
    duration_h: null,
    locations: [],
    qualities: [],
    symptoms: [],
    disability: null,
    medications: [],
    sleep_h: null,
    sleep_quality: null,
    screen_h: null,
    coffee: null,
    energy_drinks: null,
    water_glasses: null,
    stress: null,
    alcohol: null,
    exercise_min: null,
    triggers: [],
    notes: '',
  };
}

function cleanNum(v, [min, max, step]) {
  if (v === '' || v == null) return null;
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  const r = step >= 1 ? Math.round(n) : Math.round(n * 10) / 10;
  return Math.min(max, Math.max(min, r));
}

export function cleanTime(v) {
  if (typeof v !== 'string') return null;
  const m = v.match(/^(\d{1,2}):(\d{2})/);
  if (!m) return null;
  const h = Number(m[1]);
  const mi = Number(m[2]);
  if (h > 23 || mi > 59) return null;
  return `${pad(h)}:${pad(mi)}`;
}

function cleanMed(m) {
  if (!m || typeof m.name !== 'string' || !m.name.trim()) return null;
  const name = m.name.trim().slice(0, 80);
  return {
    name,
    dose: typeof m.dose === 'string' ? m.dose.trim().slice(0, 40) : '',
    time: cleanTime(m.time),
    category: MED_CLASSES[m.category] ? m.category : detectMedClass(name),
    effect: ['yes', 'partial', 'no'].includes(m.effect) ? m.effect : null,
  };
}

/** Zwraca bezpieczną kopię wpisu albo null, jeśli wpis jest nieprawidłowy. */
export function sanitizeEntry(raw) {
  if (!raw || !isYmd(raw.entry_date)) return null;
  const e = blankEntry(raw.entry_date);
  e.had_headache = raw.had_headache === true || raw.had_headache === 'true';
  for (const [k, spec] of Object.entries(NUMERIC_FIELDS)) e[k] = cleanNum(raw[k], spec);
  e.start_time = cleanTime(raw.start_time);
  for (const [k, list] of Object.entries(LIST_FIELDS)) {
    const allowed = new Set(list.map((x) => x.key));
    e[k] = Array.isArray(raw[k]) ? [...new Set(raw[k].filter((v) => allowed.has(v)))] : [];
  }
  e.medications = Array.isArray(raw.medications) ? raw.medications.map(cleanMed).filter(Boolean).slice(0, 20) : [];
  e.notes = typeof raw.notes === 'string' ? raw.notes.slice(0, 4000) : '';
  if (!e.had_headache) {
    for (const k of PAIN_FIELDS) e[k] = null;
    for (const k of PAIN_LISTS) e[k] = [];
  }
  if (raw.updated_at) e.updated_at = raw.updated_at;
  return e;
}

/** Czy wpis zawiera jakiekolwiek dane o stylu życia (do „Jak wczoraj”). */
export const LIFESTYLE_FIELDS = ['sleep_h', 'sleep_quality', 'screen_h', 'coffee', 'energy_drinks', 'water_glasses', 'stress', 'alcohol', 'exercise_min'];
