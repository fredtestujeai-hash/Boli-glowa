// Panel wpisu dla wybranego dnia.
import {
  LOCATIONS, QUALITIES, SYMPTOMS, ALARM_SYMPTOMS, DISABILITY, TRIGGERS, SLEEP_QUALITY, STRESS,
  MED_EFFECTS, MED_CLASSES, MED_CLASS_ORDER, COMMON_MEDS, detectMedClass, intensityLabel,
} from '../constants.js';
import { blankEntry, sanitizeEntry, LIFESTYLE_FIELDS } from '../entry-model.js';
import { formatLongDate, formatDayMonth, todayYmd, plural, fmtNum, esc, pad } from '../utils.js';
import { icon, faceSvg } from '../icons.js';
import { openSheet, closeSheet, toast, armConfirm } from '../ui.js';

const hours = (n) => plural(n, 'godzina', 'godziny', 'godzin');

const STEPPERS = [
  { key: 'sleep_h', label: 'Sen ostatniej nocy', icon: 'moon', step: 0.5, start: 7, max: 24, unit: hours },
  { key: 'screen_h', label: 'Telefon i ekrany', icon: 'phone', step: 0.5, start: 3, max: 24, unit: hours },
  { key: 'coffee', label: 'Kawa', icon: 'coffee', step: 1, start: 1, max: 30, unit: (n) => plural(n, 'filiżanka', 'filiżanki', 'filiżanek') },
  { key: 'energy_drinks', label: 'Energetyki', icon: 'bolt', step: 1, start: 1, max: 30, unit: (n) => plural(n, 'puszka', 'puszki', 'puszek') },
  { key: 'water_glasses', label: 'Woda', icon: 'droplet', step: 1, start: 6, max: 40, unit: (n) => plural(n, 'szklanka', 'szklanki', 'szklanek') },
  { key: 'alcohol', label: 'Alkohol', icon: 'wine', step: 1, start: 1, max: 40, unit: (n) => plural(n, 'porcja', 'porcje', 'porcji') },
  { key: 'exercise_min', label: 'Ruch i sport', icon: 'activity', step: 15, start: 30, max: 600, unit: () => 'min' },
];
const DURATION = { key: 'duration_h', icon: 'timer', step: 0.5, start: 1, max: 72, unit: hours };
const DURATION_CHIPS = [1, 2, 4, 8, 24];

const chip = (field, item, on) =>
  `<button type="button" class="chip${on ? ' is-on' : ''}${item.alarm ? ' is-alarm' : ''}" data-act="toggle" data-f="${field}" data-v="${item.key}" aria-pressed="${on}">${esc(item.label)}</button>`;

const chips = (field, list, selected) => `<div class="chips">${list.map((x) => chip(field, x, selected.includes(x.key))).join('')}</div>`;

const seg = (field, list, value, extra = '') =>
  `<div class="seg ${extra}" role="group">${list
    .map((x) => `<button type="button" class="seg-btn${value === x.key ? ' is-on' : ''}" data-act="pick" data-f="${field}" data-v="${x.key}" aria-pressed="${value === x.key}">${esc(x.label)}</button>`)
    .join('')}</div>`;

function stepperValue(cfg, v) {
  if (v == null) return '<b class="is-empty">—</b><small>dotknij +</small>';
  return `<b>${fmtNum(v)}</b><small>${cfg.unit(v)}</small>`;
}

function stepper(cfg, v, label = cfg.label) {
  return `<div class="stepper${v == null ? ' is-empty' : ''}" data-stepper="${cfg.key}">
    <div class="stepper-label">${cfg.icon ? icon(cfg.icon) : ''}<span>${label}</span></div>
    <div class="stepper-ctrl">
      <button type="button" class="step-btn" data-act="step" data-k="${cfg.key}" data-d="-1" aria-label="${label}: mniej">${icon('minus')}</button>
      <output class="step-val" aria-live="polite">${stepperValue(cfg, v)}</output>
      <button type="button" class="step-btn" data-act="step" data-k="${cfg.key}" data-d="1" aria-label="${label}: więcej">${icon('plus')}</button>
    </div>
  </div>`;
}

function intensityBlock(v) {
  return `<div class="intensity" data-intensity>
    <div class="int-face">${faceSvg(v, 76)}</div>
    <div class="int-read">
      <div class="int-num"><b>${v}</b><span>/10</span></div>
      <div class="int-lbl">${intensityLabel(v)}</div>
    </div>
  </div>
  <input type="range" class="int-range" min="1" max="10" step="1" value="${v}" data-f="intensity" aria-label="Natężenie bólu od 1 do 10" style="--val:${(v - 1) / 9}">
  <div class="int-scale" aria-hidden="true"><span>1 · łagodny</span><span>5 · umiarkowany</span><span>10 · najgorszy</span></div>`;
}

function medCard(m, i) {
  return `<div class="med-card" data-i="${i}">
    <div class="med-top">
      <span class="med-ic">${icon('pill')}</span>
      <div class="med-title">
        <b>${esc(m.name)}</b>
        <button type="button" class="badge badge-${m.category}" data-act="med-cls" data-i="${i}" title="Dotknij, aby zmienić rodzaj leku">${MED_CLASSES[m.category].label}</button>
      </div>
      <button type="button" class="icon-btn sm" data-act="med-del" data-i="${i}" aria-label="Usuń ${esc(m.name)}">${icon('x')}</button>
    </div>
    <div class="med-fields">
      <label class="mini-field"><span>Dawka</span><input data-mf="dose" data-i="${i}" value="${esc(m.dose)}" placeholder="np. 400 mg" maxlength="40"></label>
      <label class="mini-field"><span>Godzina</span><input type="time" data-mf="time" data-i="${i}" value="${m.time || ''}"></label>
    </div>
    <div class="seg seg-sm" role="group" aria-label="Czy lek pomógł?">${MED_EFFECTS.map(
      (x) => `<button type="button" class="seg-btn eff-${x.key}${m.effect === x.key ? ' is-on' : ''}" data-act="med-eff" data-i="${i}" data-v="${x.key}" aria-pressed="${m.effect === x.key}">${x.label}</button>`,
    ).join('')}</div>
  </div>`;
}

function medSuggestions(d, recent) {
  const taken = new Set(d.medications.map((m) => m.name.toLowerCase()));
  const names = [];
  for (const n of [...recent, ...COMMON_MEDS]) {
    if (!taken.has(n.toLowerCase()) && !names.some((x) => x.toLowerCase() === n.toLowerCase())) names.push(n);
  }
  return names
    .slice(0, 10)
    .map((n) => `<button type="button" class="chip chip-add" data-act="med-add" data-name="${esc(n)}">${icon('plus')}${esc(n)}</button>`)
    .join('');
}

function lifestyleHtml(d) {
  return `<div class="stepper-grid">${STEPPERS.map((c) => stepper(c, d[c.key])).join('')}</div>
    <div class="field"><span class="field-label">Jakość snu</span>${seg('sleep_quality', SLEEP_QUALITY, d.sleep_quality)}</div>
    <div class="field"><span class="field-label">Poziom stresu</span>
      <div class="stress" role="group">${STRESS.map(
        (s) => `<button type="button" class="stress-dot lvl-${s.key}${d.stress === s.key ? ' is-on' : ''}" data-act="pick" data-f="stress" data-v="${s.key}" aria-pressed="${d.stress === s.key}"><i></i><span>${s.label}</span></button>`,
      ).join('')}</div>
    </div>`;
}

function sheetHtml(d, { isNew, prev, recentMeds, isToday }) {
  const v = d.intensity ?? 5;
  return `
  <header class="sheet-head">
    <div>
      <p class="eyebrow">${isNew ? 'Nowy wpis' : 'Edycja wpisu'}</p>
      <h2>${formatLongDate(d.entry_date)}</h2>
    </div>
    <button type="button" class="icon-btn" data-close aria-label="Zamknij">${icon('x')}</button>
  </header>
  <div class="sheet-body">
    <div class="q-toggle" role="group" aria-label="Czy bolała Cię głowa?">
      <button type="button" class="q-opt q-pain${d.had_headache === true ? ' is-on' : ''}" data-act="hh" data-v="1" aria-pressed="${d.had_headache === true}">${faceSvg(7, 40)}<span>Bolała mnie głowa</span></button>
      <button type="button" class="q-opt q-free${d.had_headache === false ? ' is-on' : ''}" data-act="hh" data-v="0" aria-pressed="${d.had_headache === false}">${faceSvg(0, 40)}<span>Dzień bez bólu</span></button>
    </div>

    <section class="form-sec pain-only">
      <h3 class="sec-title">Jak mocno?</h3>
      <div data-intensity-wrap>${intensityBlock(v)}</div>

      <div class="field">
        <span class="field-label">${icon('clock')} Początek bólu</span>
        <div class="time-wrap">
          <input type="time" data-f="start_time" value="${d.start_time || ''}" aria-label="Godzina rozpoczęcia bólu">
          ${isToday ? '<button type="button" class="btn btn-soft" data-act="now">Teraz</button>' : ''}
        </div>
      </div>
      <div class="field duration">
        ${stepper(DURATION, d.duration_h, 'Czas trwania')}
        <div class="chips" aria-label="Szybki wybór czasu trwania">${DURATION_CHIPS.map(
          (h) => `<button type="button" class="chip sm${d.duration_h === h ? ' is-on' : ''}" data-act="dur" data-v="${h}">${h === 24 ? 'Cały dzień' : `${h} h`}</button>`,
        ).join('')}</div>
      </div>

      <div class="field"><span class="field-label">Gdzie boli?</span>${chips('locations', LOCATIONS, d.locations)}</div>
      <div class="field"><span class="field-label">Jaki to ból?</span>${chips('qualities', QUALITIES, d.qualities)}</div>
      <div class="field"><span class="field-label">Objawy towarzyszące</span>${chips('symptoms', SYMPTOMS, d.symptoms)}</div>
      <div class="alarm-box" data-alarm${d.symptoms.some((s) => ALARM_SYMPTOMS.includes(s)) ? '' : ' hidden'}>
        ${icon('phoneCall')}
        <div><b>To może być objaw alarmowy.</b> Jeśli pojawił się nagle, po raz pierwszy albo jest inny niż zwykle, zadzwoń pod <a href="tel:112">112</a> lub jedź na SOR.</div>
      </div>
      <div class="field"><span class="field-label">Wpływ na codzienne czynności</span>${seg('disability', DISABILITY, d.disability, 'seg-3')}</div>
    </section>

    <section class="form-sec after-choice">
      <h3 class="sec-title">${icon('pill')} Leki przyjęte tego dnia</h3>
      <p class="hint">Wpisuj wszystkie leki przeciwbólowe, także te na inne dolegliwości. Liczy się każdy dzień ich przyjmowania.</p>
      <div class="meds" data-meds>${d.medications.map(medCard).join('')}</div>
      <div class="chips" data-med-suggest>${medSuggestions(d, recentMeds)}</div>
      <form class="med-custom" data-med-form>
        <input name="med" placeholder="Inny lek, np. Nurofen" maxlength="80" autocomplete="off" aria-label="Nazwa innego leku">
        <button type="submit" class="btn btn-soft">${icon('plus')} Dodaj</button>
      </form>
    </section>

    <section class="form-sec after-choice">
      <div class="sec-title-row">
        <h3 class="sec-title">Twój dzień</h3>
        ${prev ? `<button type="button" class="link-btn" data-act="copy-prev">${icon('copy')} Jak ${formatDayMonth(prev.entry_date)}</button>` : ''}
      </div>
      <p class="hint">Uzupełniaj to także w dni bez bólu. Wtedy wnioski mają z czym porównać dni z bólem.</p>
      <div data-lifestyle>${lifestyleHtml(d)}</div>
      <div class="field"><span class="field-label">Inne możliwe wyzwalacze</span>${chips('triggers', TRIGGERS, d.triggers)}</div>
      <label class="field"><span class="field-label">Notatki</span>
        <textarea data-f="notes" rows="3" maxlength="4000" placeholder="Np. co jadłeś/aś, okoliczności, co pomogło…">${esc(d.notes)}</textarea>
      </label>
    </section>

    <p class="choose-hint">Wybierz powyżej, czy tego dnia bolała Cię głowa.</p>
  </div>
  <footer class="sheet-foot">
    ${isNew ? '' : `<button type="button" class="btn btn-ghost btn-danger" data-act="delete">${icon('trash')}<span>Usuń</span></button>`}
    <button type="button" class="btn btn-primary" data-act="save">${icon('check')}<span>Zapisz wpis</span></button>
  </footer>`;
}

/**
 * @param {object} o
 * @param {string} o.date
 * @param {object|null} o.entry istniejący wpis
 * @param {object|null} o.prev ostatni wcześniejszy wpis (do „Jak wczoraj”)
 * @param {string[]} o.recentMeds ostatnio używane leki
 * @param {'pain'|'free'|undefined} o.preset
 * @param {(entry) => Promise} o.onSave
 * @param {(date) => Promise} o.onDelete
 */
export function openEntry({ date, entry, prev, recentMeds = [], preset, onSave, onDelete }) {
  const isNew = !entry;
  const d = entry ? structuredClone(entry) : blankEntry(date);
  if (preset === 'pain') d.had_headache = true;
  if (preset === 'free') d.had_headache = false;
  if (d.had_headache && d.intensity == null) d.intensity = 5;
  const isToday = date === todayYmd();
  const prevWithLife = prev && LIFESTYLE_FIELDS.some((k) => prev[k] != null) ? prev : null;
  let dirty = Boolean(preset);
  let busy = false;

  const sheet = openSheet(sheetHtml(d, { isNew, prev: prevWithLife, recentMeds, isToday }), {
    className: 'entry-sheet',
    guard: () => !dirty,
  });
  const $ = (sel) => sheet.querySelector(sel);

  const syncMode = () => {
    sheet.classList.toggle('is-pain', d.had_headache === true);
    sheet.classList.toggle('is-free', d.had_headache === false);
    sheet.classList.toggle('is-unset', d.had_headache == null);
  };
  syncMode();

  const renderIntensity = () => {
    const v = d.intensity ?? 5;
    $('.int-face').innerHTML = faceSvg(v, 76);
    $('.int-num b').textContent = v;
    $('.int-lbl').textContent = intensityLabel(v);
    $('.int-range').style.setProperty('--val', (v - 1) / 9);
  };
  const renderMeds = () => {
    $('[data-meds]').innerHTML = d.medications.map(medCard).join('');
    $('[data-med-suggest]').innerHTML = medSuggestions(d, recentMeds);
  };
  const renderStepper = (key) => {
    const cfg = key === DURATION.key ? DURATION : STEPPERS.find((s) => s.key === key);
    const el = sheet.querySelector(`[data-stepper="${key}"]`);
    el.classList.toggle('is-empty', d[key] == null);
    el.querySelector('.step-val').innerHTML = stepperValue(cfg, d[key]);
    if (key === DURATION.key) {
      sheet.querySelectorAll('[data-act="dur"]').forEach((b) => b.classList.toggle('is-on', Number(b.dataset.v) === d.duration_h));
    }
  };
  const setPressed = (btn, on) => {
    btn.classList.toggle('is-on', on);
    btn.setAttribute('aria-pressed', String(on));
  };

  const addMed = (name) => {
    const clean = name.trim().slice(0, 80);
    if (!clean) return;
    if (d.medications.some((m) => m.name.toLowerCase() === clean.toLowerCase())) {
      toast('Ten lek jest już na liście');
      return;
    }
    const now = new Date();
    d.medications.push({
      name: clean,
      dose: '',
      time: isToday ? `${pad(now.getHours())}:${pad(now.getMinutes())}` : d.start_time,
      category: detectMedClass(clean),
      effect: null,
    });
    renderMeds();
  };

  sheet.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-act]');
    if (!btn || !sheet.contains(btn)) return;
    const { act } = btn.dataset;
    const i = Number(btn.dataset.i);

    if (act === 'hh') {
      d.had_headache = btn.dataset.v === '1';
      if (d.had_headache && d.intensity == null) {
        d.intensity = 5;
        renderIntensity();
      }
      sheet.querySelectorAll('[data-act="hh"]').forEach((b) => setPressed(b, b === btn));
      syncMode();
    } else if (act === 'toggle') {
      const list = d[btn.dataset.f];
      const v = btn.dataset.v;
      const idx = list.indexOf(v);
      if (idx >= 0) list.splice(idx, 1);
      else list.push(v);
      setPressed(btn, idx < 0);
      if (btn.dataset.f === 'symptoms') $('[data-alarm]').hidden = !d.symptoms.some((s) => ALARM_SYMPTOMS.includes(s));
    } else if (act === 'pick') {
      const f = btn.dataset.f;
      const v = Number(btn.dataset.v);
      d[f] = d[f] === v ? null : v;
      btn.parentElement.querySelectorAll('[data-act="pick"]').forEach((b) => setPressed(b, Number(b.dataset.v) === d[f]));
    } else if (act === 'step') {
      const key = btn.dataset.k;
      const cfg = key === DURATION.key ? DURATION : STEPPERS.find((s) => s.key === key);
      const dir = Number(btn.dataset.d);
      const cur = d[key];
      let next;
      if (cur == null) next = dir > 0 ? cfg.start : 0;
      else if (dir < 0 && cur <= 0) next = null;
      else next = Math.min(cfg.max, Math.max(0, Math.round((cur + dir * cfg.step) * 10) / 10));
      d[key] = next;
      renderStepper(key);
    } else if (act === 'dur') {
      d.duration_h = Number(btn.dataset.v);
      renderStepper('duration_h');
    } else if (act === 'now') {
      const now = new Date();
      d.start_time = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
      $('[data-f="start_time"]').value = d.start_time;
    } else if (act === 'med-add') {
      addMed(btn.dataset.name);
    } else if (act === 'med-del') {
      d.medications.splice(i, 1);
      renderMeds();
    } else if (act === 'med-cls') {
      const m = d.medications[i];
      m.category = MED_CLASS_ORDER[(MED_CLASS_ORDER.indexOf(m.category) + 1) % MED_CLASS_ORDER.length];
      btn.textContent = MED_CLASSES[m.category].label;
      btn.className = `badge badge-${m.category}`;
    } else if (act === 'med-eff') {
      const m = d.medications[i];
      m.effect = m.effect === btn.dataset.v ? null : btn.dataset.v;
      btn.parentElement.querySelectorAll('.seg-btn').forEach((b) => setPressed(b, b.dataset.v === m.effect));
    } else if (act === 'copy-prev') {
      for (const k of LIFESTYLE_FIELDS) d[k] = prevWithLife[k];
      $('[data-lifestyle]').innerHTML = lifestyleHtml(d);
      toast(`Skopiowano dane z ${formatDayMonth(prevWithLife.entry_date)}`);
    } else if (act === 'delete') {
      armConfirm(btn, `${icon('trash')}<span>Na pewno?</span>`, async () => {
        if (busy) return;
        busy = true;
        try {
          await onDelete(date);
          dirty = false;
          closeSheet();
          toast('Wpis usunięty');
        } catch (err) {
          busy = false;
          toast(`Nie udało się usunąć: ${err.message || err}`, 'error');
        }
      });
      return;
    } else if (act === 'save') {
      if (d.had_headache == null) {
        toast('Najpierw wybierz: bolała głowa czy dzień bez bólu', 'error');
        sheet.querySelector('.q-toggle').classList.add('nudge');
        setTimeout(() => sheet.querySelector('.q-toggle')?.classList.remove('nudge'), 500);
        return;
      }
      if (busy) return;
      busy = true;
      btn.classList.add('is-busy');
      try {
        await onSave(sanitizeEntry(d));
        dirty = false;
        closeSheet();
        toast(d.had_headache ? 'Zapisano. Zdrowiej szybko!' : 'Zapisano dzień bez bólu');
      } catch (err) {
        toast(`Nie udało się zapisać: ${err.message || err}`, 'error');
      } finally {
        busy = false;
        btn.classList.remove('is-busy');
      }
      return;
    } else {
      return;
    }
    dirty = true;
  });

  sheet.addEventListener('input', (e) => {
    const t = e.target;
    if (t.dataset.f === 'intensity') {
      d.intensity = Number(t.value);
      renderIntensity();
    } else if (t.dataset.f === 'start_time') {
      d.start_time = t.value || null;
    } else if (t.dataset.f === 'notes') {
      d.notes = t.value;
    } else if (t.dataset.mf) {
      d.medications[Number(t.dataset.i)][t.dataset.mf] = t.value || (t.dataset.mf === 'time' ? null : '');
    } else {
      return;
    }
    dirty = true;
  });

  $('[data-med-form]').addEventListener('submit', (e) => {
    e.preventDefault();
    const input = e.target.elements.med;
    addMed(input.value);
    input.value = '';
    dirty = true;
  });
}
