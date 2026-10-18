import { LocalStore, CloudStore, getClient, signOut } from './store.js';
import { renderCalendar } from './views/calendar.js';
import { openEntry } from './views/entry.js';
import { renderInsights } from './views/insights-view.js';
import { renderReport, toCsv, toBackup, parseBackup } from './views/report.js';
import { renderWelcome, bindWelcome, openAccountSheet, openMigrateSheet, openNewPasswordSheet } from './views/account.js';
import { toast, download, closeSheet } from './ui.js';
import { icon } from './icons.js';
import { todayYmd, plural } from './utils.js';
import { byDate } from './insights.js';

const MODE_KEY = 'boli-glowa:mode';
const THEME_KEY = 'boli-glowa:theme';
const ROUTES = { kalendarz: 'calendar', wnioski: 'insights', raport: 'report' };

const now = new Date();
const state = {
  mode: null, // 'local' | 'cloud' | null (ekran powitalny)
  store: null,
  user: null,
  entries: new Map(),
  view: 'calendar',
  month: { y: now.getFullYear(), m: now.getMonth() },
  period: 30,
  reportPeriod: 30,
  loading: false,
};

const $view = document.getElementById('view');
const local = new LocalStore();
const client = getClient();

const safeGet = (k) => {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
};
const safeSet = (k, v) => {
  try {
    if (v == null) localStorage.removeItem(k);
    else localStorage.setItem(k, v);
  } catch {
    /* tryb prywatny — ignorujemy */
  }
};

// ---------------------------------------------------------------------------
// Motyw
// ---------------------------------------------------------------------------

function applyTheme(theme) {
  const root = document.documentElement;
  if (theme === 'light' || theme === 'dark') root.dataset.theme = theme;
  else delete root.dataset.theme;
}

// ---------------------------------------------------------------------------
// Renderowanie
// ---------------------------------------------------------------------------

const viewFromHash = () => ROUTES[location.hash.replace('#', '')] || 'calendar';

function skeleton() {
  return `<div class="skeleton"><div class="sk sk-hero"></div><div class="sk sk-cal"></div><div class="sk sk-row"></div></div>`;
}

function updateChrome() {
  document.body.dataset.view = state.mode ? state.view : 'welcome';
  document.querySelectorAll('[data-nav]').forEach((a) => {
    const on = a.dataset.nav === state.view;
    a.classList.toggle('is-active', on);
    if (on) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });
  const acct = document.querySelector('[data-act="account"]');
  acct.classList.toggle('is-cloud', state.mode === 'cloud');
  acct.title = state.mode === 'cloud' ? `Zalogowano: ${state.user?.email ?? ''}` : 'Konto i ustawienia';
}

function render() {
  updateChrome();
  if (!state.mode) {
    $view.innerHTML = renderWelcome({ cloudAvailable: Boolean(client) });
    bindWelcome($view, { onSession: startCloud });
    return;
  }
  if (state.loading) {
    $view.innerHTML = skeleton();
    return;
  }
  if (state.view === 'insights') $view.innerHTML = renderInsights(state);
  else if (state.view === 'report') $view.innerHTML = renderReport(state);
  else $view.innerHTML = renderCalendar(state);
}

// ---------------------------------------------------------------------------
// Dane i tryby
// ---------------------------------------------------------------------------

async function loadEntries() {
  state.loading = true;
  render();
  try {
    const list = await state.store.list();
    state.entries = new Map(list.map((e) => [e.entry_date, e]));
  } catch (err) {
    toast(`Nie udało się wczytać wpisów: ${err.message || err}`, 'error');
  } finally {
    state.loading = false;
    render();
  }
}

async function startLocal() {
  state.mode = 'local';
  state.store = local;
  state.user = null;
  safeSet(MODE_KEY, 'local');
  await loadEntries();
}

function offerMigration() {
  const n = local.count();
  if (!n) return;
  openMigrateSheet(n, async () => {
    const moved = await state.store.saveMany(await local.list(), { overwrite: false });
    local.clear();
    await loadEntries();
    toast(`Przeniesiono ${moved} ${plural(moved, 'wpis', 'wpisy', 'wpisów')} do konta`);
  });
}

/** `afterLogin`: pytamy o przeniesienie wpisów tylko zaraz po zalogowaniu, nie przy każdym otwarciu. */
async function startCloud(session, { afterLogin = true } = {}) {
  state.mode = 'cloud';
  state.user = session.user;
  state.store = new CloudStore(client, session.user);
  safeSet(MODE_KEY, 'cloud');
  await loadEntries();
  if (afterLogin) offerMigration();
}

async function doSignOut() {
  await signOut();
  state.mode = null;
  state.store = null;
  state.user = null;
  state.entries = new Map();
  safeSet(MODE_KEY, null);
  render();
  toast('Wylogowano');
}

function recentMeds() {
  const names = [];
  const sorted = [...state.entries.values()].sort(byDate).reverse();
  for (const e of sorted) {
    for (const m of e.medications) {
      if (!names.some((n) => n.toLowerCase() === m.name.toLowerCase())) names.push(m.name);
    }
    if (names.length >= 6) break;
  }
  return names.slice(0, 6);
}

function openDay(date, preset) {
  if (date > todayYmd()) return;
  const before = [...state.entries.values()].filter((e) => e.entry_date < date).sort(byDate);
  openEntry({
    date,
    entry: state.entries.get(date) || null,
    prev: before[before.length - 1] || null,
    recentMeds: recentMeds(),
    preset,
    onSave: async (entry) => {
      const saved = await state.store.save(entry);
      state.entries.set(saved.entry_date, saved);
      render();
    },
    onDelete: async (d) => {
      await state.store.remove(d);
      state.entries.delete(d);
      render();
    },
  });
}

function shiftMonth(delta) {
  const d = new Date(state.month.y, state.month.m + delta, 1);
  const n = new Date();
  if (d > new Date(n.getFullYear(), n.getMonth(), 1)) return;
  state.month = { y: d.getFullYear(), m: d.getMonth() };
  render();
}

async function importBackup(file) {
  try {
    const list = parseBackup(await file.text());
    if (!window.confirm(`Wczytać ${list.length} ${plural(list.length, 'wpis', 'wpisy', 'wpisów')}? Wpisy z tych samych dni zostaną zastąpione.`)) return;
    const n = await state.store.saveMany(list, { overwrite: true });
    await loadEntries();
    toast(`Wczytano ${n} ${plural(n, 'wpis', 'wpisy', 'wpisów')}`);
  } catch (err) {
    toast(`Nie udało się wczytać pliku: ${err.message || err}`, 'error');
  }
}

// ---------------------------------------------------------------------------
// Zdarzenia
// ---------------------------------------------------------------------------

document.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-act]');
  if (!btn || btn.closest('.sheet')) return;
  const { act } = btn.dataset;
  const stamp = todayYmd();
  switch (act) {
    case 'open-day':
      openDay(btn.dataset.date);
      break;
    case 'quick':
      openDay(stamp, btn.dataset.v);
      break;
    case 'fab':
      openDay(stamp);
      break;
    case 'month-prev':
      shiftMonth(-1);
      break;
    case 'month-next':
      shiftMonth(1);
      break;
    case 'month-today':
      state.month = { y: new Date().getFullYear(), m: new Date().getMonth() };
      render();
      break;
    case 'period':
      state.period = Number(btn.dataset.v);
      render();
      break;
    case 'rperiod':
      state.reportPeriod = Number(btn.dataset.v);
      render();
      break;
    case 'print':
      window.print();
      break;
    case 'csv':
      download(`dziennik-bolu-glowy-${stamp}.csv`, toCsv(state.entries.values()), 'text/csv;charset=utf-8');
      break;
    case 'backup':
      download(`dziennik-bolu-glowy-kopia-${stamp}.json`, toBackup(state.entries.values()), 'application/json');
      break;
    case 'go-local':
      startLocal();
      break;
    case 'account':
      openAccountSheet({
        mode: state.mode,
        user: state.user,
        theme: safeGet(THEME_KEY) || 'auto',
        cloudAvailable: Boolean(client),
        localCount: state.mode === 'cloud' ? local.count() : 0,
        onMigrate: offerMigration,
        onSession: startCloud,
        onSignOut: doSignOut,
        onTheme: (t) => {
          safeSet(THEME_KEY, t);
          applyTheme(t);
        },
      });
      break;
    default:
  }
});

$view.addEventListener('change', (e) => {
  if (e.target.matches('[data-import]') && e.target.files[0]) {
    importBackup(e.target.files[0]);
    e.target.value = '';
  }
});

// Przesunięcie palcem po kalendarzu zmienia miesiąc.
let touch = null;
$view.addEventListener(
  'touchstart',
  (e) => {
    touch = e.target.closest('[data-swipe]') ? { x: e.touches[0].clientX, y: e.touches[0].clientY } : null;
  },
  { passive: true },
);
$view.addEventListener('touchend', (e) => {
  if (!touch) return;
  const dx = e.changedTouches[0].clientX - touch.x;
  const dy = e.changedTouches[0].clientY - touch.y;
  touch = null;
  if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) shiftMonth(dx < 0 ? 1 : -1);
});

window.addEventListener('hashchange', () => {
  closeSheet(true); // np. przycisk „wstecz” przy otwartym panelu
  state.view = viewFromHash();
  render();
  window.scrollTo({ top: 0 });
});

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

async function boot() {
  applyTheme(safeGet(THEME_KEY) || 'auto');
  document.querySelectorAll('[data-icon]').forEach((el) => {
    el.insertAdjacentHTML('afterbegin', icon(el.dataset.icon));
  });
  state.view = viewFromHash();

  if (client) {
    client.auth.onAuthStateChange((event) => {
      // Wywołania Supabase wewnątrz tego callbacku muszą być odroczone.
      if (event === 'PASSWORD_RECOVERY') setTimeout(openNewPasswordSheet, 0);
      if (event === 'SIGNED_OUT' && state.mode === 'cloud') {
        setTimeout(() => {
          state.mode = null;
          state.entries = new Map();
          render();
        }, 0);
      }
    });
    try {
      const { data } = await client.auth.getSession();
      if (data.session) {
        await startCloud(data.session, { afterLogin: false });
        return;
      }
    } catch {
      /* brak sieci — przejdź dalej */
    }
  }
  if (safeGet(MODE_KEY) === 'local') {
    await startLocal();
    return;
  }
  render();
}

boot();
