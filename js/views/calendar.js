import { MONTHS, WEEKDAYS_SHORT, ymd, todayYmd, parseYmd, mondayIndex, formatDayMonth, plural, fmtNum, isNum } from '../utils.js';
import { INTENSITY_COLORS, intensityLabel } from '../constants.js';
import { icon, faceSvg } from '../icons.js';
import { RECOMMENDED_DAYS, analyze } from '../insights.js';

function todayCard(entry, today) {
  if (!entry) {
    return `<section class="today-card">
      <div class="today-copy">
        <p class="eyebrow">Dziś, ${formatDayMonth(today)}</p>
        <h1>Jak dziś głowa?</h1>
        <p class="muted">Zapisz każdy dzień, także ten bez bólu. Z tych wpisów powstają wnioski.</p>
      </div>
      <div class="today-actions">
        <button class="big-choice is-pain" data-act="quick" data-v="pain">${faceSvg(7, 46)}<span>Boli mnie głowa</span></button>
        <button class="big-choice is-free" data-act="quick" data-v="free">${faceSvg(0, 46)}<span>Dzień bez bólu</span></button>
      </div>
    </section>`;
  }
  const lvl = entry.had_headache ? entry.intensity ?? 5 : 0;
  const title = entry.had_headache
    ? `Ból ${isNum(entry.intensity) ? `${entry.intensity}/10` : ''} · ${intensityLabel(lvl).toLowerCase()}`
    : 'Dzień bez bólu';
  const meds = entry.medications?.length
    ? `${entry.medications.length} ${plural(entry.medications.length, 'lek', 'leki', 'leków')}`
    : 'bez leków';
  return `<section class="today-card is-done">
    <div class="today-done">
      ${faceSvg(lvl, 52)}
      <div>
        <p class="eyebrow">Dziś zapisane</p>
        <h1 class="today-title">${title}</h1>
        <p class="muted">${entry.had_headache ? meds : 'Oby tak dalej!'}</p>
      </div>
      <button class="btn btn-soft" data-act="open-day" data-date="${today}">Edytuj</button>
    </div>
  </section>`;
}

function dayCell(date, entry, today) {
  const day = parseYmd(date).getDate();
  const future = date > today;
  const cls = ['day'];
  let mark = '';
  let style = '';
  let label = formatDayMonth(date);
  if (entry) {
    if (entry.had_headache) {
      const lvl = isNum(entry.intensity) ? entry.intensity : 5;
      cls.push('has-pain');
      if (lvl >= 7) cls.push('is-dark');
      style = ` style="--day-bg:${INTENSITY_COLORS[lvl]}"`;
      mark = `<span class="day-mark">${isNum(entry.intensity) ? entry.intensity : '•'}</span>`;
      label += `: ból${isNum(entry.intensity) ? ` ${entry.intensity} na 10` : ''}`;
    } else {
      cls.push('is-free');
      mark = `<span class="day-mark">${icon('check')}</span>`;
      label += ': bez bólu';
    }
    if (entry.medications?.length) {
      cls.push('has-med');
      label += ', przyjęte leki';
    }
  } else if (!future) {
    label += ': brak wpisu';
  }
  if (date === today) {
    cls.push('is-today');
    label += ' (dziś)';
  }
  if (future) cls.push('is-future');
  if (entry?.medications?.length) mark = mark.replace(/<\/span>$/, '<i class="day-pill"></i></span>');
  return `<button class="${cls.join(' ')}" data-act="open-day" data-date="${date}"${style}${future ? ' disabled' : ''} aria-label="${label}">
    <span class="day-num">${day}</span>${mark}</button>`;
}

function monthStats(state, y, m, today) {
  const first = ymd(new Date(y, m, 1));
  const last = ymd(new Date(y, m + 1, 0));
  const end = last < today ? last : today;
  const a = analyze([...state.entries.values()], { from: first, to: end });
  const elapsed = end >= first ? parseYmd(end).getDate() : 0;
  return `<section class="stats-row" aria-label="Podsumowanie miesiąca">
    <div class="stat"><span class="stat-val">${a.painDays}</span><span class="stat-lbl">${plural(a.painDays, 'dzień', 'dni', 'dni')} z bólem</span></div>
    <div class="stat"><span class="stat-val">${a.avgIntensity == null ? '—' : fmtNum(a.avgIntensity)}</span><span class="stat-lbl">średnie natężenie</span></div>
    <div class="stat"><span class="stat-val">${a.medDays}</span><span class="stat-lbl">${plural(a.medDays, 'dzień', 'dni', 'dni')} z lekami</span></div>
    <div class="stat"><span class="stat-val">${a.logged}<small>/${elapsed}</small></span><span class="stat-lbl">dni zapisanych</span></div>
  </section>`;
}

function trackingCard(state, today) {
  const dates = [...state.entries.keys()].sort();
  if (!dates.length) return '';
  const days = Math.max(1, Math.round((parseYmd(today) - parseYmd(dates[0])) / 86400000) + 1);
  const progress = Math.min(1, days / RECOMMENDED_DAYS);
  const weeks = Math.floor(days / 7);
  const text =
    progress >= 1
      ? 'Masz już ponad 8 tygodni obserwacji. Pokaż raport lekarzowi przy następnej wizycie.'
      : 'Lekarze zalecają prowadzić dziennik co najmniej 8 tygodni (NICE). Wtedy wzorce są najbardziej wiarygodne.';
  return `<section class="card track-card">
    <div class="track-top">
      <div><p class="eyebrow">Twoja obserwacja</p>
      <h3>${weeks >= 1 ? `${weeks} ${plural(weeks, 'tydzień', 'tygodnie', 'tygodni')}` : `${days} ${plural(days, 'dzień', 'dni', 'dni')}`} <span class="muted">z 8 zalecanych tygodni</span></h3></div>
      ${progress >= 1 ? `<a class="btn btn-soft" href="#raport">${icon('report')} Raport</a>` : ''}
    </div>
    <div class="progress"><span style="width:${(progress * 100).toFixed(1)}%"></span></div>
    <p class="muted small">${text}</p>
  </section>`;
}

export function renderCalendar(state) {
  const today = todayYmd();
  const { y, m } = state.month;
  const firstDate = new Date(y, m, 1);
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const offset = mondayIndex(ymd(firstDate));
  const now = parseYmd(today);
  const isCurrentMonth = y === now.getFullYear() && m === now.getMonth();
  const isFutureMonth = y > now.getFullYear() || (y === now.getFullYear() && m > now.getMonth());

  const cells = [];
  for (let i = 0; i < offset; i++) cells.push('<span class="day is-blank" aria-hidden="true"></span>');
  for (let d = 1; d <= daysInMonth; d++) {
    const date = ymd(new Date(y, m, d));
    cells.push(dayCell(date, state.entries.get(date), today));
  }
  while (cells.length % 7) cells.push('<span class="day is-blank" aria-hidden="true"></span>');

  return `<div class="cal-layout"><div class="cal-main">
    ${todayCard(state.entries.get(today), today)}
    <section class="card cal-card">
      <header class="cal-head">
        <button class="icon-btn" data-act="month-prev" aria-label="Poprzedni miesiąc">${icon('left')}</button>
        <div class="cal-title-wrap">
          <h2 class="cal-title">${MONTHS[m]} <span>${y}</span></h2>
          ${isCurrentMonth ? '' : '<button class="link-btn" data-act="month-today">Wróć do dziś</button>'}
        </div>
        <button class="icon-btn" data-act="month-next" aria-label="Następny miesiąc"${isCurrentMonth || isFutureMonth ? ' disabled' : ''}>${icon('right')}</button>
      </header>
      <div class="cal-weekdays" aria-hidden="true">${WEEKDAYS_SHORT.map((d, i) => `<span${i > 4 ? ' class="we"' : ''}>${d}</span>`).join('')}</div>
      <div class="cal-grid" data-swipe>${cells.join('')}</div>
      <div class="legend" aria-hidden="true">
        <span class="legend-item"><i class="sw sw-free">${icon('check')}</i>bez bólu</span>
        <span class="legend-scale"><i style="background:linear-gradient(90deg, ${INTENSITY_COLORS.slice(1).join(',')})"></i><span>1</span><span>10</span></span>
        <span class="legend-item"><i class="day-pill"></i>leki</span>
      </div>
    </section></div>
    <aside class="cal-side">
      ${monthStats(state, y, m, today)}
      ${trackingCard(state, today)}
    </aside></div>`;
}
