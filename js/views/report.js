import { analyze, buildAlerts, byDate, inRange, medicationUse } from '../insights.js';
import { LOCATIONS, QUALITIES, SYMPTOMS, TRIGGERS, DISABILITY, SLEEP_QUALITY, MED_CLASSES, MED_EFFECTS, INTENSITY_COLORS, labelOf } from '../constants.js';
import { addDays, todayYmd, formatNumericDate, fmtNum, pct, esc, plural } from '../utils.js';
import { icon } from '../icons.js';
import { periodRange, periodSeg } from './insights-view.js';

const medText = (m) =>
  [m.name, m.dose, m.time ? `godz. ${m.time}` : '', m.effect ? labelOf(MED_EFFECTS, m.effect).toLowerCase() : ''].filter(Boolean).join(', ');

function painTable(rows) {
  if (!rows.length) return '<p class="muted">Brak epizodów bólu w tym okresie.</p>';
  return `<div class="table-wrap"><table class="rtable rtable-episodes">
    <thead><tr><th>Data</th><th>Początek</th><th>Czas</th><th>Natęż.</th><th>Lokalizacja, charakter</th><th>Objawy</th><th>Leki</th></tr></thead>
    <tbody>${rows
      .map(
        (e) => `<tr>
        <td>${formatNumericDate(e.entry_date)}</td>
        <td>${e.start_time || '–'}</td>
        <td>${e.duration_h != null ? `${fmtNum(e.duration_h)} h` : '–'}</td>
        <td><span class="rt-int"${e.intensity != null ? ` style="background:${INTENSITY_COLORS[e.intensity]};color:${e.intensity >= 7 ? '#fff' : '#3a2a1e'}"` : ''}>${e.intensity ?? '–'}</span></td>
        <td data-label="Ból">${esc([...e.locations.map((k) => labelOf(LOCATIONS, k)), ...e.qualities.map((k) => labelOf(QUALITIES, k))].join(', ') || '–')}</td>
        <td data-label="Objawy">${esc(e.symptoms.map((k) => labelOf(SYMPTOMS, k)).join(', ') || '–')}</td>
        <td data-label="Leki">${esc(e.medications.map(medText).join('; ') || '–')}</td>
      </tr>`,
      )
      .join('')}</tbody></table></div>`;
}

export function renderReport(state) {
  const today = todayYmd();
  const { from, to } = periodRange(state, state.reportPeriod);
  const all = [...state.entries.values()].sort(byDate);
  const a = analyze(all, { from, to });
  const alerts = buildAlerts(all, today);
  const inPeriod = inRange(all, from, to);
  const painRows = inPeriod.filter((e) => e.had_headache);
  const notes = inPeriod.filter((e) => e.notes?.trim());
  const life = a.lifestyle;
  const factors = a.factors.filter((f) => f.verdict !== 'none');
  const last30 = medicationUse(inRange(all, addDays(today, -29), today));

  const lifeItem = (label, v, unit) => `<div><span>${label}</span><b>${v == null ? '–' : `${fmtNum(v)} ${unit}`}</b></div>`;

  return `
  <div class="page-head no-print">
    <h1>Raport dla lekarza</h1>
    <p class="muted">Wydrukuj albo zapisz jako PDF i zabierz na wizytę.</p>
  </div>
  <div class="no-print">${periodSeg(state.reportPeriod, 'rperiod')}</div>
  <div class="report-actions no-print">
    <button type="button" class="btn btn-primary" data-act="print">${icon('printer')}<span>Drukuj lub zapisz PDF</span></button>
    <button type="button" class="btn btn-soft" data-act="csv">${icon('download')}<span>Arkusz CSV</span></button>
  </div>

  <article class="card report" id="report">
    <header class="report-head">
      <div>
        <p class="eyebrow">Dziennik bólu głowy</p>
        <h2>Podsumowanie ${formatNumericDate(from)} – ${formatNumericDate(to)}</h2>
        <p class="muted small">Wygenerowano ${formatNumericDate(today)} · ${a.logged} ${plural(a.logged, 'zapisany dzień', 'zapisane dni', 'zapisanych dni')} · obserwacja od ${a.trackingDays} ${plural(a.trackingDays, 'dnia', 'dni', 'dni')}</p>
      </div>
      <img class="report-logo" src="icons/icon.svg" alt="" width="44" height="44">
    </header>

    <div class="report-kpis">
      <div><span>Dni z bólem</span><b>${a.painDays}</b><em>${a.logged ? pct(a.painDays / a.logged) : '–'} dni</em></div>
      <div><span>Średnie natężenie</span><b>${a.avgIntensity == null ? '–' : fmtNum(a.avgIntensity)}</b><em>maks. ${a.maxIntensity ?? '–'}/10</em></div>
      <div><span>Średni czas bólu</span><b>${a.avgDuration == null ? '–' : `${fmtNum(a.avgDuration)} h`}</b><em>łącznie ${fmtNum(a.totalHours)} h</em></div>
      <div><span>Dni z lekami doraźnymi</span><b>${a.medUse.anyDays}</b><em>ost. 30 dni: ${last30.anyDays}</em></div>
      <div><span>Ból uniemożliwiał działanie</span><b>${a.disabledDays}</b><em>${plural(a.disabledDays, 'dzień', 'dni', 'dni')}</em></div>
      <div><span>Cechy migreny / napięciowe</span><b>${a.types.migraine} / ${a.types.tension}</b><em>epizodów (ICHD-3)</em></div>
    </div>

    ${alerts.length ? `<div class="report-alerts">${alerts.map((x) => `<p class="ra ra-${x.level}"><b>${esc(x.title)}.</b> ${esc(x.text)}</p>`).join('')}</div>` : ''}

    <h3>Leki</h3>
    ${a.meds.length
      ? `<div class="table-wrap"><table class="rtable rtable-meds">
        <thead><tr><th>Lek</th><th>Rodzaj</th><th>Liczba przyjęć</th><th>Skuteczność</th></tr></thead>
        <tbody>${a.meds
          .map(
            (m) => `<tr><td>${esc(m.name)}</td><td>${MED_CLASSES[m.category]?.label ?? 'Inny'}</td><td>${m.uses}</td>
            <td>${m.rated ? `${m.yes} pomógł, ${m.partial} częściowo, ${m.no} nie` : 'brak oceny'}</td></tr>`,
          )
          .join('')}</tbody></table></div>
        <p class="muted small">Dni ze zwykłymi lekami przeciwbólowymi: ${a.medUse.simpleDays}; z tryptanami, lekami złożonymi lub opioidami: ${a.medUse.specificDays}.</p>`
      : '<p class="muted">Nie zapisano leków.</p>'}

    <h3>Epizody bólu</h3>
    ${painTable(painRows)}

    <h3>Styl życia (średnio na zapisany dzień)</h3>
    <div class="report-life">
      ${lifeItem('Sen', life.sleep_h, 'h')}
      ${lifeItem('Ekrany', life.screen_h, 'h')}
      ${lifeItem('Kawa', life.coffee, 'filiż.')}
      ${lifeItem('Energetyki', life.energy_drinks, 'puszki')}
      ${lifeItem('Woda', life.water_glasses, 'szkl.')}
      ${lifeItem('Alkohol', life.alcohol, 'porcji')}
      ${lifeItem('Ruch', life.exercise_min, 'min')}
      ${lifeItem('Stres (1–5)', life.stress, '')}
    </div>

    ${factors.length
      ? `<h3>Możliwe czynniki wyzwalające</h3><ul class="report-factors">${factors
          .map((f) => `<li><b>${esc(f.label)}</b> (gdy ${esc(f.cond)}): ból w ${pct(f.rateRisk)} dni wobec ${pct(f.rateOther)} w pozostałe dni (n = ${f.nRisk} / ${f.nOther}).</li>`)
          .join('')}</ul>`
      : ''}

    ${notes.length
      ? `<h3>Notatki</h3><ul class="report-notes">${notes.map((e) => `<li><b>${formatNumericDate(e.entry_date)}:</b> ${esc(e.notes)}</li>`).join('')}</ul>`
      : ''}

    <p class="report-foot">Dane z dziennika prowadzonego przez pacjenta. Zakres pól zgodny z zaleceniami NICE CG150; klasyfikacja cech i progi leków według ICHD-3.</p>
  </article>

  <section class="card no-print">
    <div class="card-head"><h3>${icon('shield')} Kopia zapasowa</h3></div>
    <p class="muted small">Pobierz wszystkie wpisy jako plik. Możesz go później wczytać na innym urządzeniu lub do konta.</p>
    <div class="btn-row">
      <button type="button" class="btn btn-soft" data-act="backup">${icon('download')}<span>Pobierz kopię</span></button>
      <label class="btn btn-soft">${icon('upload')}<span>Wczytaj kopię</span><input type="file" accept="application/json,.json" data-import hidden></label>
    </div>
  </section>

  <section class="card info no-print">
    <div class="card-head"><h3>${icon('book')} Jak prowadzić dziennik</h3></div>
    <ol class="steps">
      <li><b>Zapisuj codziennie</b>, także dni bez bólu. Tylko wtedy widać, jak często boli i co odróżnia złe dni od dobrych.</li>
      <li><b>Prowadź go co najmniej 8 tygodni</b> przed wizytą. Tyle zaleca brytyjski NICE.</li>
      <li><b>Zapisuj każdy lek przeciwbólowy</b>: dawkę, godzinę i czy pomógł, także leki wzięte z innego powodu.</li>
      <li><b>Oceniaj natężenie w skali 1–10</b> i zaznaczaj objawy towarzyszące, np. nudności, światłowstręt, aurę.</li>
      <li><b>Notuj możliwe wyzwalacze</b>: sen, kawę i energetyki, czas przed ekranem, stres, posiłki, alkohol, miesiączkę.</li>
      <li><b>Zabierz raport na wizytę.</b> Ułatwi lekarzowi rozpoznanie i dobór leczenia.</li>
    </ol>
  </section>

  <section class="card info info-danger no-print">
    <div class="card-head"><h3>${icon('phoneCall')} Kiedy pilnie szukać pomocy</h3></div>
    <p><b>Zadzwoń pod <a href="tel:112">112</a> lub jedź na SOR, jeśli:</b></p>
    <ul>
      <li>ból jest nagły i bardzo silny („najgorszy w życiu”) i osiąga szczyt w ciągu minuty,</li>
      <li>towarzyszą mu gorączka, sztywność karku, wysypka lub splątanie,</li>
      <li>pojawiają się niedowład, drętwienie, zaburzenia mowy lub widzenia, drgawki albo utrata przytomności,</li>
      <li>ból pojawił się po urazie głowy.</li>
    </ul>
    <p><b>Skonsultuj się z lekarzem bez zwłoki, jeśli:</b></p>
    <ul>
      <li>to nowy rodzaj bólu po 50. roku życia albo ból wyraźnie zmienił charakter,</li>
      <li>ból budzi Cię ze snu albo nasila się przy kaszlu, wysiłku lub zmianie pozycji,</li>
      <li>jesteś w ciąży lub połogu, chorujesz na nowotwór lub masz obniżoną odporność,</li>
      <li>ból narasta z dnia na dzień.</li>
    </ul>
  </section>

  <section class="card info no-print">
    <div class="card-head"><h3>${icon('info')} Na czym opiera się dziennik</h3></div>
    <ul class="sources">
      <li>NICE CG150: <i>Headaches in over 12s: diagnosis and management</i> (zakres dziennika, 8 tygodni obserwacji, nadużywanie leków).</li>
      <li>International Headache Society: <i>ICHD-3</i>, Międzynarodowa Klasyfikacja Bólów Głowy (cechy migreny i bólu napięciowego, progi leków).</li>
      <li>European Headache Federation i Lifting The Burden: wzór dziennika bólu głowy.</li>
      <li>Do TP i wsp.: <i>SNNOOP10</i>, Neurology 2019 (objawy alarmowe).</li>
      <li>American Headache Society, konsensus 2021 (kiedy rozważyć leczenie zapobiegawcze).</li>
    </ul>
    <p class="muted small">Aplikacja nie stawia diagnozy i nie zastępuje porady lekarza.</p>
  </section>`;
}

// ---------------------------------------------------------------------------
// Eksport
// ---------------------------------------------------------------------------

const csvCell = (v) => {
  const s = v == null ? '' : String(v);
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const num = (v) => (v == null ? '' : String(v).replace('.', ','));

export function toCsv(entries) {
  const head = [
    'Data', 'Ból głowy', 'Natężenie (1-10)', 'Początek', 'Czas trwania (h)', 'Lokalizacja', 'Charakter', 'Objawy',
    'Wpływ na funkcjonowanie', 'Leki', 'Sen (h)', 'Jakość snu', 'Ekrany (h)', 'Kawa', 'Energetyki', 'Woda (szkl.)',
    'Stres (1-5)', 'Alkohol (porcje)', 'Ruch (min)', 'Wyzwalacze', 'Notatki',
  ];
  const rows = [...entries].sort(byDate).map((e) => [
    e.entry_date,
    e.had_headache ? 'tak' : 'nie',
    e.intensity,
    e.start_time,
    num(e.duration_h),
    e.locations.map((k) => labelOf(LOCATIONS, k)).join(', '),
    e.qualities.map((k) => labelOf(QUALITIES, k)).join(', '),
    e.symptoms.map((k) => labelOf(SYMPTOMS, k)).join(', '),
    e.disability == null ? '' : labelOf(DISABILITY, e.disability),
    e.medications.map(medText).join('; '),
    num(e.sleep_h),
    e.sleep_quality == null ? '' : labelOf(SLEEP_QUALITY, e.sleep_quality),
    num(e.screen_h),
    e.coffee,
    e.energy_drinks,
    e.water_glasses,
    e.stress,
    e.alcohol,
    e.exercise_min,
    e.triggers.map((k) => labelOf(TRIGGERS, k)).join(', '),
    e.notes,
  ]);
  // BOM + średniki: polski Excel otwiera taki plik poprawnie.
  return `﻿${[head, ...rows].map((r) => r.map(csvCell).join(';')).join('\r\n')}`;
}

export function toBackup(entries) {
  return JSON.stringify({ app: 'boli-glowa', version: 1, exported_at: new Date().toISOString(), entries: [...entries].sort(byDate) }, null, 2);
}

/** Zwraca listę wpisów z pliku kopii (akceptuje też samą tablicę). */
export function parseBackup(text) {
  const data = JSON.parse(text);
  const list = Array.isArray(data) ? data : data?.entries;
  if (!Array.isArray(list)) throw new Error('To nie jest plik kopii dziennika.');
  return list;
}
