import { icon, faceSvg } from '../icons.js';
import { esc } from '../utils.js';
import { openSheet, closeSheet, toast } from '../ui.js';
import { signIn, signUp, sendPasswordReset, updatePassword, authErrorMessage } from '../store.js';

function authForm(tab = 'login') {
  return `<div class="auth" data-auth data-tab="${tab}">
    <div class="seg auth-tabs" role="tablist">
      <button type="button" class="seg-btn${tab === 'login' ? ' is-on' : ''}" data-auth-tab="login" role="tab" aria-selected="${tab === 'login'}">Logowanie</button>
      <button type="button" class="seg-btn${tab === 'signup' ? ' is-on' : ''}" data-auth-tab="signup" role="tab" aria-selected="${tab === 'signup'}">Nowe konto</button>
    </div>
    <form class="auth-form" novalidate>
      <label class="field"><span class="field-label">E-mail</span>
        <input type="email" name="email" autocomplete="email" inputmode="email" required placeholder="ty@przyklad.pl"></label>
      <label class="field"><span class="field-label">Hasło</span>
        <input type="password" name="password" autocomplete="current-password" minlength="6" required placeholder="min. 6 znaków"></label>
      <p class="auth-msg" data-auth-msg hidden></p>
      <button type="submit" class="btn btn-primary btn-block" data-auth-submit>${tab === 'login' ? 'Zaloguj się' : 'Załóż konto'}</button>
      <button type="button" class="link-btn auth-forgot" data-auth-forgot>Nie pamiętasz hasła?</button>
    </form>
  </div>`;
}

/** Podpina logikę formularza logowania/rejestracji. `onSession` dostaje sesję Supabase. */
function bindAuth(root, onSession) {
  const box = root.querySelector('[data-auth]');
  const form = box.querySelector('form');
  const msg = box.querySelector('[data-auth-msg]');
  const submit = box.querySelector('[data-auth-submit]');
  const show = (text, kind = 'error') => {
    msg.hidden = !text;
    msg.className = `auth-msg auth-${kind}`;
    msg.textContent = text || '';
  };
  const setTab = (tab) => {
    box.dataset.tab = tab;
    box.querySelectorAll('[data-auth-tab]').forEach((b) => {
      b.classList.toggle('is-on', b.dataset.authTab === tab);
      b.setAttribute('aria-selected', String(b.dataset.authTab === tab));
    });
    submit.textContent = tab === 'login' ? 'Zaloguj się' : 'Załóż konto';
    form.password.autocomplete = tab === 'login' ? 'current-password' : 'new-password';
    show('');
  };
  box.addEventListener('click', async (e) => {
    const tab = e.target.closest('[data-auth-tab]');
    if (tab) setTab(tab.dataset.authTab);
    if (e.target.closest('[data-auth-forgot]')) {
      const email = form.email.value.trim();
      if (!email) {
        show('Wpisz adres e-mail, a wyślemy link do zmiany hasła.');
        form.email.focus();
        return;
      }
      try {
        await sendPasswordReset(email);
        show(`Jeśli konto istnieje, na ${email} wysłaliśmy link do ustawienia nowego hasła.`, 'ok');
      } catch (err) {
        show(authErrorMessage(err));
      }
    }
  });
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = form.email.value.trim();
    const password = form.password.value;
    if (!/^\S+@\S+\.\S+$/.test(email)) return show('Sprawdź, czy adres e-mail jest poprawny.');
    if (password.length < 6) return show('Hasło musi mieć co najmniej 6 znaków.');
    submit.classList.add('is-busy');
    submit.disabled = true;
    show('');
    try {
      if (box.dataset.tab === 'login') {
        await onSession(await signIn(email, password));
      } else {
        const r = await signUp(email, password);
        if (r.session) await onSession(r.session);
        else {
          setTab('login');
          show(`Gotowe! Na ${email} wysłaliśmy link aktywacyjny. Kliknij go, a potem wróć tu i zaloguj się.`, 'ok');
        }
      }
    } catch (err) {
      show(authErrorMessage(err));
    } finally {
      submit.classList.remove('is-busy');
      submit.disabled = false;
    }
  });
}

export function renderWelcome({ cloudAvailable }) {
  return `<section class="welcome">
    <div class="welcome-art" aria-hidden="true">
      <div class="orb orb-a"></div><div class="orb orb-b"></div>
      <div class="welcome-faces">${faceSvg(8, 56)}${faceSvg(4, 68)}${faceSvg(0, 56)}</div>
    </div>
    <h1>Twój dziennik<br>bólu głowy</h1>
    <p class="muted lead">Zapisuj ból, leki i codzienne nawyki w prostym kalendarzu. Aplikacja pokaże, co może wywoływać Twoje bóle, i przygotuje raport dla lekarza.</p>
    <ul class="welcome-points">
      <li>${icon('calendar')}<span><b>Kalendarz:</b> jeden dzień to kilka dotknięć</span></li>
      <li>${icon('spark')}<span><b>Wnioski:</b> sen, kawa, telefon, stres na tle bólu</span></li>
      <li>${icon('report')}<span><b>Raport dla lekarza</b> zgodny z zaleceniami NICE i ICHD-3</span></li>
    </ul>
    ${cloudAvailable
      ? `<div class="card welcome-card">
          <p class="welcome-card-title">${icon('cloud')} Konto: dane bezpieczne w chmurze i na każdym urządzeniu</p>
          ${authForm('signup')}
        </div>
        <div class="or"><span>albo</span></div>`
      : ''}
    <button type="button" class="btn btn-ghost btn-block" data-act="go-local">${icon('device')}<span>Zacznij bez konta</span></button>
    <p class="muted small center">Bez konta wpisy zostają tylko w tej przeglądarce. Konto możesz założyć później i przenieść dane.</p>
  </section>`;
}

export function bindWelcome(root, { onSession }) {
  if (root.querySelector('[data-auth]')) bindAuth(root, onSession);
}

export function openAccountSheet({ mode, user, theme, cloudAvailable, localCount = 0, onMigrate, onSession, onSignOut, onTheme }) {
  const themes = [
    { key: 'auto', label: 'Auto', ic: 'auto' },
    { key: 'light', label: 'Jasny', ic: 'sun' },
    { key: 'dark', label: 'Ciemny', ic: 'moon' },
  ];
  const accountBlock =
    mode === 'cloud'
      ? `<div class="acct-card is-cloud">
          <span class="acct-ic">${icon('cloud')}</span>
          <div><b>${esc(user?.email || 'Zalogowano')}</b><p class="muted small">Wpisy zapisują się w chmurze i są dostępne na każdym urządzeniu. Widzisz je tylko Ty.</p></div>
        </div>
        ${localCount ? `<button type="button" class="btn btn-soft btn-block" data-act="migrate">${icon('upload')}<span>Przenieś wpisy z tego urządzenia (${localCount})</span></button>` : ''}
        <button type="button" class="btn btn-ghost btn-block" data-act="sign-out">${icon('logout')}<span>Wyloguj się</span></button>`
      : `<div class="acct-card">
          <span class="acct-ic">${icon('device')}</span>
          <div><b>Tryb bez konta</b><p class="muted small">Wpisy są tylko w tej przeglądarce. Wyczyszczenie danych przeglądarki je usunie. Zrób kopię w zakładce Raport.</p></div>
        </div>
        ${cloudAvailable ? `<p class="sec-title">Załóż konto lub zaloguj się</p><p class="muted small">Twoje dotychczasowe wpisy przeniesiemy do konta.</p>${authForm('signup')}` : ''}`;

  const sheet = openSheet(
    `<header class="sheet-head">
      <div><p class="eyebrow">Ustawienia</p><h2>Konto i wygląd</h2></div>
      <button type="button" class="icon-btn" data-close aria-label="Zamknij">${icon('x')}</button>
    </header>
    <div class="sheet-body">
      ${accountBlock}
      <div class="field"><span class="field-label">Motyw</span>
        <div class="seg seg-3" role="group">${themes
          .map((t) => `<button type="button" class="seg-btn${theme === t.key ? ' is-on' : ''}" data-theme-pick="${t.key}" aria-pressed="${theme === t.key}">${icon(t.ic)}${t.label}</button>`)
          .join('')}</div>
        <p class="muted small">Ciemny motyw jest łagodniejszy dla oczu przy nadwrażliwości na światło.</p>
      </div>
      <p class="muted small">Boli głowa · dziennik bólu głowy. Aplikacja nie stawia diagnozy i nie zastępuje porady lekarza.</p>
    </div>`,
    { className: 'account-sheet' },
  );

  sheet.addEventListener('click', async (e) => {
    const t = e.target.closest('[data-theme-pick]');
    if (t) {
      onTheme(t.dataset.themePick);
      sheet.querySelectorAll('[data-theme-pick]').forEach((b) => {
        b.classList.toggle('is-on', b === t);
        b.setAttribute('aria-pressed', String(b === t));
      });
    }
    if (e.target.closest('[data-act="migrate"]')) {
      closeSheet(true);
      onMigrate();
    }
    if (e.target.closest('[data-act="sign-out"]')) {
      closeSheet();
      await onSignOut();
    }
  });
  if (sheet.querySelector('[data-auth]')) {
    bindAuth(sheet, async (session) => {
      closeSheet();
      await onSession(session);
    });
  }
}

export function openMigrateSheet(count, onMove) {
  const sheet = openSheet(
    `<header class="sheet-head">
      <div><p class="eyebrow">Witaj w koncie</p><h2>Przenieść wpisy?</h2></div>
      <button type="button" class="icon-btn" data-close aria-label="Zamknij">${icon('x')}</button>
    </header>
    <div class="sheet-body">
      <p>Wpisy zapisane na tym urządzeniu bez konta: <b>${count}</b>. Przenieść je do konta, żeby były bezpieczne i dostępne wszędzie?</p>
      <p class="muted small">Jeśli w koncie jest już wpis z tego samego dnia, zostanie zachowany wpis z konta.</p>
    </div>
    <footer class="sheet-foot">
      <button type="button" class="btn btn-ghost" data-close>Nie teraz</button>
      <button type="button" class="btn btn-primary" data-act="move">${icon('upload')}<span>Przenieś</span></button>
    </footer>`,
  );
  sheet.querySelector('[data-act="move"]').addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    btn.classList.add('is-busy');
    btn.disabled = true;
    try {
      await onMove();
      closeSheet();
    } catch (err) {
      toast(`Nie udało się przenieść: ${err.message || err}`, 'error');
      btn.classList.remove('is-busy');
      btn.disabled = false;
    }
  });
}

export function openNewPasswordSheet() {
  const sheet = openSheet(
    `<header class="sheet-head">
      <div><p class="eyebrow">Odzyskiwanie dostępu</p><h2>Ustaw nowe hasło</h2></div>
      <button type="button" class="icon-btn" data-close aria-label="Zamknij">${icon('x')}</button>
    </header>
    <form class="sheet-body" data-newpass>
      <label class="field"><span class="field-label">Nowe hasło</span>
        <input type="password" name="password" autocomplete="new-password" minlength="6" required placeholder="min. 6 znaków"></label>
      <p class="auth-msg auth-error" hidden></p>
      <button type="submit" class="btn btn-primary btn-block">Zapisz hasło</button>
    </form>`,
  );
  const form = sheet.querySelector('[data-newpass]');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const msg = form.querySelector('.auth-msg');
    try {
      if (form.password.value.length < 6) throw new Error('Password should be at least 6 characters');
      await updatePassword(form.password.value);
      closeSheet();
      toast('Hasło zmienione');
    } catch (err) {
      msg.hidden = false;
      msg.textContent = authErrorMessage(err);
    }
  });
}
