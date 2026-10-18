import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyze, buildAlerts, classifyAttack, computeFactors, medicationUse } from '../js/insights.js';
import { blankEntry, sanitizeEntry } from '../js/entry-model.js';
import { detectMedClass } from '../js/constants.js';
import { addDays, plural, daysBetween, mondayIndex } from '../js/utils.js';
import { toCsv, parseBackup } from '../js/views/report.js';

const day = (date, fields = {}) => sanitizeEntry({ ...blankEntry(date), had_headache: false, ...fields });
const pain = (date, fields = {}) => day(date, { had_headache: true, intensity: 6, ...fields });
const med = (name, category, effect = null) => ({ name, category, effect, dose: '', time: null });

test('utils: Polish plurals and dates', () => {
  assert.equal(plural(1, 'dzień', 'dni', 'dni'), 'dzień');
  assert.equal(plural(3, 'kawa', 'kawy', 'kaw'), 'kawy');
  assert.equal(plural(5, 'kawa', 'kawy', 'kaw'), 'kaw');
  assert.equal(plural(12, 'kawa', 'kawy', 'kaw'), 'kaw');
  assert.equal(plural(22, 'kawa', 'kawy', 'kaw'), 'kawy');
  assert.equal(plural(2.5, 'godzina', 'godziny', 'godzin'), 'godziny');
  assert.equal(addDays('2026-03-28', 2), '2026-03-30'); // zmiana czasu
  assert.equal(addDays('2026-12-31', 1), '2027-01-01');
  assert.equal(daysBetween('2026-03-01', '2026-04-01'), 31);
  assert.equal(mondayIndex('2026-10-19'), 0); // poniedziałek
  assert.equal(mondayIndex('2026-10-18'), 6); // niedziela
});

test('detectMedClass recognises Polish brand and generic names', () => {
  assert.equal(detectMedClass('Ibuprom'), 'simple');
  assert.equal(detectMedClass('Paracetamol'), 'simple');
  assert.equal(detectMedClass('Apap Extra'), 'combination');
  assert.equal(detectMedClass('Sumatriptan'), 'triptan');
  assert.equal(detectMedClass('Ryzatryptan'), 'triptan');
  assert.equal(detectMedClass('Zaldiar'), 'opioid');
  assert.equal(detectMedClass('Propranolol'), 'other');
});

test('sanitizeEntry clamps values and clears pain fields on headache-free days', () => {
  const e = sanitizeEntry({
    entry_date: '2026-10-01',
    had_headache: false,
    intensity: 7,
    locations: ['left', 'nonsense'],
    coffee: 99,
    sleep_h: '7.25',
    start_time: '25:00',
    medications: [{ name: '  Ibuprofen ', effect: 'maybe' }, { name: '' }],
    notes: 'x'.repeat(5000),
  });
  assert.equal(e.intensity, null);
  assert.deepEqual(e.locations, []);
  assert.equal(e.coffee, 30);
  assert.equal(e.sleep_h, 7.3);
  assert.equal(e.start_time, null);
  assert.equal(e.medications.length, 1);
  assert.equal(e.medications[0].name, 'Ibuprofen');
  assert.equal(e.medications[0].category, 'simple');
  assert.equal(e.medications[0].effect, null);
  assert.equal(e.notes.length, 4000);
  assert.equal(sanitizeEntry({ entry_date: '2026-13-45' }), null);
  assert.equal(sanitizeEntry({ entry_date: 'wczoraj' }), null);
  // Postgres zwraca czas z sekundami
  assert.equal(sanitizeEntry({ entry_date: '2026-10-01', had_headache: true, start_time: '07:05:00' }).start_time, '07:05');
});

test('medicationUse applies ICHD-3 medication-overuse thresholds', () => {
  const simple = (n) => Array.from({ length: n }, (_, i) => day(addDays('2026-09-01', i), { medications: [med('Ibuprofen', 'simple')] }));
  assert.equal(medicationUse(simple(9)).level, 'ok');
  assert.equal(medicationUse(simple(10)).level, 'near');
  assert.equal(medicationUse(simple(14)).level, 'near');
  assert.equal(medicationUse(simple(15)).level, 'over');

  const trip = (n) => Array.from({ length: n }, (_, i) => day(addDays('2026-09-01', i), { medications: [med('Sumatryptan', 'triptan')] }));
  assert.equal(medicationUse(trip(6)).level, 'ok');
  assert.equal(medicationUse(trip(7)).level, 'near');
  assert.equal(medicationUse(trip(10)).level, 'over');

  // 6 dni ibuprofenu + 4 dni tryptanu = 10 dni, różne grupy -> przekroczenie (ICHD-3 8.2.6)
  const mixed = [...simple(6), ...trip(10).slice(6)];
  const mu = medicationUse(mixed);
  assert.equal(mu.anyDays, 10);
  assert.equal(mu.level, 'over');

  // Leki „inne” (np. profilaktyczne) się nie liczą
  const other = Array.from({ length: 20 }, (_, i) => day(addDays('2026-09-01', i), { medications: [med('Propranolol', 'other')] }));
  assert.equal(medicationUse(other).anyDays, 0);
});

test('buildAlerts flags chronic headache, overuse and alarm symptoms in the last 30 days', () => {
  const today = '2026-10-18';
  const entries = Array.from({ length: 16 }, (_, i) => pain(addDays(today, -i), { medications: [med('Ibuprofen', 'simple')] }));
  const keys = buildAlerts(entries, today).map((a) => a.key);
  assert.ok(keys.includes('chronic'));
  assert.ok(keys.includes('moh'));
  assert.ok(!keys.includes('alarm'));

  const withAlarm = [pain(today, { symptoms: ['neuro'] })];
  assert.deepEqual(buildAlerts(withAlarm, today).map((a) => a.key), ['alarm']);

  // Wpisy sprzed 30 dni nie liczą się do alertów
  const old = Array.from({ length: 20 }, (_, i) => pain(addDays(today, -40 - i)));
  assert.deepEqual(buildAlerts(old, today), []);
});

test('computeFactors finds that short sleep goes with headaches', () => {
  const entries = [];
  for (let i = 0; i < 20; i++) {
    const short = i % 2 === 0;
    const date = addDays('2026-09-01', i);
    // krótki sen: ból w 9 z 10 dni; długi sen: ból w 1 z 10 dni
    const hurts = short ? i !== 0 : i === 1;
    entries.push(hurts ? pain(date, { sleep_h: short ? 5 : 8 }) : day(date, { sleep_h: short ? 5 : 8 }));
  }
  const sleep = computeFactors(entries).find((f) => f.key === 'sleep_h');
  assert.ok(sleep, 'sleep factor present');
  assert.equal(sleep.verdict, 'strong');
  assert.equal(sleep.nRisk, 10);
  assert.equal(sleep.hRisk, 9);
  assert.equal(sleep.hOther, 1);
  assert.match(sleep.cond, /mniej niż 7 godzin snu/);
});

test('computeFactors uses median split, previous-day alcohol and needs enough data', () => {
  const entries = [];
  for (let i = 0; i < 12; i++) {
    const date = addDays('2026-09-01', i);
    const coffee = i < 6 ? 1 : 4;
    const alcohol = i % 3 === 0 ? 2 : 0;
    const prevAlcohol = i > 0 && (i - 1) % 3 === 0;
    const hurts = coffee === 4 || prevAlcohol;
    entries.push(hurts ? pain(date, { coffee, alcohol }) : day(date, { coffee, alcohol }));
  }
  const factors = computeFactors(entries);
  const coffee = factors.find((f) => f.key === 'coffee');
  assert.ok(coffee);
  assert.equal(coffee.rateRisk, 1);
  assert.equal(coffee.cond, 'więcej niż 2 kawy');
  const alcohol = factors.find((f) => f.key === 'alcohol');
  assert.ok(alcohol, 'lagged alcohol factor present');
  assert.equal(alcohol.hRisk, alcohol.nRisk);

  // za mało dni -> brak porównań
  assert.deepEqual(computeFactors(entries.slice(0, 5)), []);
});

test('classifyAttack separates migraine-like and tension-like features', () => {
  const migraine = pain('2026-10-01', {
    intensity: 7, duration_h: 8, locations: ['left'], qualities: ['pulsating'], symptoms: ['nausea', 'photophobia'],
  });
  assert.equal(classifyAttack(migraine), 'migraine');
  const tension = pain('2026-10-02', { intensity: 4, duration_h: 3, locations: ['both'], qualities: ['pressing'] });
  assert.equal(classifyAttack(tension), 'tension');
  const unknown = pain('2026-10-03', { intensity: 5 });
  assert.equal(classifyAttack(unknown), null);
  assert.equal(classifyAttack(day('2026-10-04')), null);
});

test('analyze summarises a period', () => {
  const entries = [
    pain('2026-10-10', { intensity: 8, duration_h: 4, start_time: '07:30', medications: [med('Ibuprofen', 'simple', 'yes')] }),
    pain('2026-10-12', { intensity: 4, duration_h: 2, start_time: '19:00', medications: [med('ibuprofen', 'simple', 'no')] }),
    day('2026-10-11'),
    day('2026-10-13'),
    pain('2026-08-01', { intensity: 10 }), // poza okresem
  ];
  const a = analyze(entries, { from: '2026-10-01', to: '2026-10-18' });
  assert.equal(a.logged, 4);
  assert.equal(a.painDays, 2);
  assert.equal(a.avgIntensity, 6);
  assert.equal(a.maxIntensity, 8);
  assert.equal(a.totalHours, 6);
  assert.equal(a.medDays, 2);
  assert.equal(a.daysSinceLastPain, 6);
  assert.deepEqual(a.onset, [0, 1, 0, 1]);
  assert.equal(a.meds.length, 1, 'same drug with different capitalisation is merged');
  assert.equal(a.meds[0].uses, 2);
  assert.equal(a.meds[0].score, 0.5);
});

test('CSV export and backup parsing', () => {
  const csv = toCsv([pain('2026-10-10', { notes: 'kawa; "dużo"', duration_h: 1.5 })]);
  assert.ok(csv.startsWith('﻿Data;'));
  assert.ok(csv.includes('"kawa; ""dużo"""'));
  assert.ok(csv.includes(';1,5;'));
  assert.equal(parseBackup(JSON.stringify({ entries: [{ entry_date: '2026-10-10' }] })).length, 1);
  assert.equal(parseBackup('[{"entry_date":"2026-10-10"}]').length, 1);
  assert.throws(() => parseBackup('{"foo":1}'));
});
