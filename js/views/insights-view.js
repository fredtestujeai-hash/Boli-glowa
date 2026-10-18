import { analyze, buildAlerts, MIN_KNOWN, medicationUse, inRange } from '../insights.js';
import { INTENSITY_COLORS, LOCATIONS, QUALITIES, SYMPTOMS, MED_CLASSES, labelOf } from '../constants.js';
import { addDays, todayYmd, daysBetween, formatDayMonth, plural, fmtNum, pct, esc, WEEKDAYS_SHORT } from '../utils.js';
import { icon } from '../icons.js';

export const PERIODS = [
  { key: 30, label: '30 dni' },
  { key: 90, label: '3 miesiące' },
  { key: 0, label: 'Wszystko' },
];

export function periodRange(state, period) {
  const today = todayYmd();
  if (period) return { from: addDays(today, -(period - 1)), to: today };
  const first = [...state.entries.keys()].sort()[0];
  return { from: first || today, to: today };
}

export function periodSeg(value, act) {
  return `<div class="seg seg-period" role="group" aria-label="Zakres czasu">${PERIODS.map(
    (p) => `<button type="button" class="seg-btn${value === p.key ? ' is-on' : ''}" data-act="${act}" data-v="${p.key}" aria-pressed="${value === p.key}">${p.label}</button>`,
  ).join('')}</div>`;
}

export function alertCard(a) {
  const ic = a.level === 'info' ? 'info' : 'alert';
  return `<div class="alert alert-${a.level}">${icon(ic)}<div><b>${esc(a.title)}</b><p>${esc(a.text)}</p></div></div>`;
}

const days = (n) => plural(n, 'dzień', 'dni', 'dni');

function kpis(a) {
  const since = a.daysSinceLastPain;
  return `<section class="kpi-grid">
    <div class="kpi kpi-accent">
      <span class="kpi-lbl">Dni z bólem</span>
      <span class="kpi-val">${a.painDays}<small> / ${a.logged}</small></span>
      <span class="kpi-sub">${a.logged ? `${pct(a.painDays / a.logged)} zapisanych dni` : 'brak wpisów'}</span>
    </div>
    <div class="kpi">
      <span class="kpi-lbl">Średnie natężenie</span>
      <span class="kpi-val">${a.avgIntensity == null ? '—' : fmtNum(a.avgIntensity)}<small>/10</small></span>
      <span class="kpi-sub">${a.severeDays ? `${a.severeDays} ${plural(a.severeDays, 'silny', 'silne', 'silnych')} (7+)` : 'brak silnych bólów'}</span>
    </div>
    <div class="kpi">
      <span class="kpi-lbl">Dni z lekami</span>
      <span class="kpi-val">${a.medDays}</span>
      <span class="kpi-sub">${a.medUse.anyDays} z lekami doraźnymi</span>
    </div>
    <div class="kpi">
      <span class="kpi-lbl">Od ostatniego bólu</span>
      <span class="kpi-val">${since == null ? '—' : since}<small>${since == null ? '' : ` ${days(since)}`}</small></span>
      <span class="kpi-sub">${a.totalHours ? `łącznie ${fmtNum(a.totalHours)} h bólu` : 'czas bólu nieuzupełniony'}</span>
    </div>
  </section>`;
}

function intensityChart(state, from, to) {
  const span = Math.min(daysBetween(from, to) + 1, 90);
  const start = addDays(to, -(span - 1));
  const bars = [];
  for (let i = 0; i < span; i++) {
    const date = addDays(start, i);
    const e = state.entries.get(date);
    const tip = formatDayMonth(date);
    if (!e) bars.push(`<span class="bar is-empty" title="${tip}: brak wpisu"></span>`);
    else if (!e.had_headache) bars.push(`<span class="bar is-free" title="${tip}: bez bólu"></span>`);
    else {
      const v = e.intensity ?? 5;
      bars.push(`<span class="bar" style="--h:${v * 10};--c:${INTENSITY_COLORS[v]}" title="${tip}: ból ${v}/10"></span>`);
    }
  }
  const mid = addDays(start, Math.floor(span / 2));
  return `<section class="card">
    <div class="card-head"><h3>${icon('activity')} Natężenie dzień po dniu</h3>${span < daysBetween(from, to) + 1 ? '<span class="muted small">ostatnie 90 dni</span>' : ''}</div>
    <div class="chart">
      <div class="chart-grid" aria-hidden="true"><span>10</span><span>5</span><span>0</span></div>
      <div class="bars${span > 45 ? ' is-dense' : ''}" role="img" aria-label="Wykres natężenia bólu w kolejnych dniach">${bars.join('')}</div>
    </div>
    <div class="chart-x"><span>${formatDayMonth(start)}</span><span>${formatDayMonth(mid)}</span><span>${formatDayMonth(to)}</span></div>
    <div class="chart-legend"><span><i class="lg-pain"></i>ból</span><span><i class="lg-free"></i>bez bólu</span><span><i class="lg-empty"></i>brak wpisu</span></div>
  </section>`;
}

const VERDICT = {
  strong: { label: 'Wyraźny związek', cls: 'v-strong' },
  possible: { label: 'Możliwy związek', cls: 'v-possible' },
  none: { label: 'Brak związku', cls: 'v-none' },
};

function factorRow(f) {
  const v = VERDICT[f.verdict];
  return `<article class="factor ${v.cls}">
    <div class="factor-head">
      <span class="factor-ic">${icon(f.icon)}</span>
      <div class="factor-name"><b>${esc(f.label)}</b><span>gdy ${esc(f.cond)}</span></div>
      <span class="verdict">${v.label}</span>
    </div>
    <div class="cmp">
      <div class="cmp-row"><span class="cmp-lbl">Tak</span><span class="cmp-track"><i class="cmp-fill is-risk" style="width:${(f.rateRisk * 100).toFixed(1)}%"></i></span><span class="cmp-val">${pct(f.rateRisk)}</span></div>
      <div class="cmp-row"><span class="cmp-lbl">Nie</span><span class="cmp-track"><i class="cmp-fill" style="width:${(f.rateOther * 100).toFixed(1)}%"></i></span><span class="cmp-val">${pct(f.rateOther)}</span></div>
    </div>
    <p class="factor-note">Ból głowy w ${f.hRisk} z ${f.nRisk} takich dni, a w pozostałe dni w ${f.hOther} z ${f.nOther}.</p>
  </article>`;
}

function factorsCard(a) {
  const relevant = a.factors.filter((f) => f.verdict !== 'none');
  const rest = a.factors.filter((f) => f.verdict === 'none');
  let body;
  if (!a.factors.length) {
    const progress = Math.min(1, a.logged / MIN_KNOWN);
    body = `<div class="empty-mini">
      <p>Porównania pojawią się, gdy zapiszesz co najmniej ${MIN_KNOWN} dni z uzupełnioną sekcją „Twój dzień”, w tym dni z bólem i bez bólu.</p>
      <div class="progress"><span style="width:${(progress * 100).toFixed(0)}%"></span></div>
    </div>`;
  } else {
    body = `${relevant.length ? relevant.map(factorRow).join('') : '<p class="muted">Na razie żaden czynnik nie odróżnia wyraźnie dni z bólem od dni bez bólu. Zapisuj dalej, a obraz będzie coraz pełniejszy.</p>'}
      ${rest.length ? `<details class="more"><summary>Bez wyraźnego związku (${rest.length})</summary>${rest.map(factorRow).join('')}</details>` : ''}`;
  }
  return `<section class="card">
    <div class="card-head"><h3>${icon('spark')} Co może sprzyjać Twoim bólom</h3></div>
    <p class="muted small">Odsetek dni z bólem, gdy dany czynnik występował („Tak”) i gdy go nie było („Nie”).</p>
    ${body}
  </section>`;
}

function timingCard(a) {
  const painWithTime = a.onset.reduce((x, y) => x + y, 0);
  const labels = ['Noc (0–6)', 'Rano (6–12)', 'Popołudnie (12–18)', 'Wieczór (18–24)'];
  const maxOnset = Math.max(1, ...a.onset);
  const onset = painWithTime
    ? labels
        .map(
          (l, i) => `<div class="hbar"><span class="hbar-lbl">${l}</span><span class="hbar-track"><i style="width:${((a.onset[i] / maxOnset) * 100).toFixed(1)}%"></i></span><span class="hbar-val">${a.onset[i]}</span></div>`,
        )
        .join('')
    : '<p class="muted small">Wpisuj godzinę początku bólu, aby zobaczyć, o której pora dnia boli najczęściej.</p>';

  const rates = a.weekdays.map((w) => (w.logged ? w.pain / w.logged : 0));
  const maxRate = Math.max(0.01, ...rates);
  const week = a.weekdays
    .map((w, i) => {
      const r = rates[i];
      return `<div class="vbar${w.logged && r === maxRate && w.pain ? ' is-top' : ''}" title="${WEEKDAYS_SHORT[i]}: ból w ${w.pain} z ${w.logged} dni">
        <span class="vbar-val">${w.logged ? pct(r) : '–'}</span>
        <span class="vbar-track"><i style="height:${((r / maxRate) * 100).toFixed(1)}%"></i></span>
        <span class="vbar-lbl">${WEEKDAYS_SHORT[i]}</span>
      </div>`;
    })
    .join('');

  return `<section class="card">
    <div class="card-head"><h3>${icon('clock')} Kiedy boli</h3></div>
    <div class="two-col">
      <div><h4 class="mini-title">Pora początku bólu</h4>${onset}</div>
      <div><h4 class="mini-title">Dzień tygodnia</h4><div class="vbars">${week}</div><p class="muted small">Odsetek zapisanych dni z bólem.</p></div>
    </div>
  </section>`;
}

function medsCard(state, a) {
  const today = todayYmd();
  const last30 = medicationUse(inRange([...state.entries.values()], addDays(today, -29), today));
  const meter = Math.min(30, last30.anyDays);
  const list = a.meds.length
    ? a.meds
        .map((m) => {
          const seg = (n, cls) => (n ? `<i class="${cls}" style="flex:${n}"></i>` : '');
          return `<div class="med-stat">
            <div class="med-stat-top"><b>${esc(m.name)}</b><span class="badge badge-${m.category}">${MED_CLASSES[m.category]?.label ?? 'Inny'}</span><span class="muted small">${m.uses}×</span></div>
            <div class="stack">${seg(m.yes, 'stk-yes')}${seg(m.partial, 'stk-partial')}${seg(m.no, 'stk-no')}${seg(m.unknown, 'stk-unknown')}</div>
            <p class="muted small">${m.rated ? `Skuteczność ${pct(m.score)} (ocenione przyjęcia: ${m.rated}, „częściowo” liczy się za pół)` : 'Zaznaczaj „Pomógł / Częściowo / Nie pomógł”, aby ocenić skuteczność.'}</p>
          </div>`;
        })
        .join('')
    : '<p class="muted small">W tym okresie nie zapisano żadnych leków.</p>';
  return `<section class="card">
    <div class="card-head"><h3>${icon('pill')} Leki</h3></div>
    <div class="moh">
      <div class="moh-top"><span>Dni z lekami doraźnymi w ostatnich 30 dniach</span><b>${last30.anyDays}</b></div>
      <div class="moh-track">
        <i class="moh-fill moh-${last30.level}" style="width:${((meter / 30) * 100).toFixed(1)}%"></i>
        <span class="moh-mark" style="left:${(10 / 30) * 100}%"><em>10</em></span>
        <span class="moh-mark" style="left:${(15 / 30) * 100}%"><em>15</em></span>
      </div>
      <p class="muted small">Progi ICHD-3: mniej niż 10 dni w miesiącu dla tryptanów i leków złożonych, mniej niż 15 dni dla zwykłych leków przeciwbólowych.</p>
    </div>
    <div class="legend-eff"><span><i class="stk-yes"></i>pomógł</span><span><i class="stk-partial"></i>częściowo</span><span><i class="stk-no"></i>nie pomógł</span><span><i class="stk-unknown"></i>bez oceny</span></div>
    ${list}
  </section>`;
}

function countChips(items, list) {
  if (!items.length) return '<p class="muted small">Brak danych.</p>';
  return `<div class="chips">${items
    .slice(0, 8)
    .map((x) => `<span class="chip is-static">${esc(labelOf(list, x.key))}<em>${x.count}</em></span>`)
    .join('')}</div>`;
}

function profileCard(a) {
  if (!a.painDays) return '';
  const { migraine, tension } = a.types;
  let typeNote = '';
  if (a.painDays >= 3 && (migraine || tension)) {
    typeNote = `<div class="profile-types">
      <div class="ptype"><b>${migraine}</b><span>z ${a.painDays} epizodów ma cechy <strong>migreny</strong></span></div>
      <div class="ptype"><b>${tension}</b><span>z ${a.painDays} ma cechy <strong>bólu napięciowego</strong></span></div>
    </div>
    <p class="muted small">Zestawienie cech według kryteriów ICHD-3 (lokalizacja, charakter, natężenie, objawy towarzyszące). To nie jest diagnoza. Rozpoznanie stawia lekarz, a te dane ułatwią mu rozmowę.</p>`;
  }
  return `<section class="card">
    <div class="card-head"><h3>${icon('heart')} Profil Twoich bólów</h3></div>
    ${typeNote}
    <h4 class="mini-title">Gdzie boli</h4>${countChips(a.locations, LOCATIONS)}
    <h4 class="mini-title">Charakter</h4>${countChips(a.qualities, QUALITIES)}
    <h4 class="mini-title">Objawy towarzyszące</h4>${countChips(a.symptoms, SYMPTOMS)}
    ${a.avgDuration != null ? `<p class="muted small">Średni czas trwania: <b>${fmtNum(a.avgDuration)} h</b>${a.disabledDays ? ` · ${a.disabledDays} ${plural(a.disabledDays, 'dzień', 'dni', 'dni')}, gdy ból uniemożliwiał codzienne czynności` : ''}</p>` : ''}
  </section>`;
}

export function renderInsights(state) {
  const { from, to } = periodRange(state, state.period);
  const all = [...state.entries.values()];
  const a = analyze(all, { from, to });
  const alerts = buildAlerts(all, todayYmd());

  if (!state.entries.size) {
    return `<div class="page-head"><h1>Wnioski</h1></div>
      <section class="card empty">
        <div class="empty-art">${icon('bulb')}</div>
        <h3>Tu pojawią się Twoje wzorce</h3>
        <p class="muted">Zapisuj codziennie, jak się czujesz, ile spałeś/aś, ile czasu spędzasz przy telefonie i ile pijesz kawy. Po około tygodniu zobaczysz pierwsze porównania, a po 8 tygodniach pełny obraz.</p>
        <a class="btn btn-primary" href="#kalendarz">${icon('calendar')} Przejdź do kalendarza</a>
      </section>`;
  }

  return `<div class="page-head">
      <h1>Wnioski</h1>
      <p class="muted">${a.logged} ${plural(a.logged, 'zapisany dzień', 'zapisane dni', 'zapisanych dni')} w wybranym okresie</p>
    </div>
    ${periodSeg(state.period, 'period')}
    ${alerts.map(alertCard).join('')}
    ${kpis(a)}
    ${intensityChart(state, from, to)}
    ${factorsCard(a)}
    ${timingCard(a)}
    ${medsCard(state, a)}
    ${profileCard(a)}
    <p class="footnote">${icon('info')} Wnioski to wskazówki statystyczne z Twoich wpisów, a nie diagnoza. Związek czasowy nie zawsze oznacza przyczynę. Omów je z lekarzem.</p>`;
}
