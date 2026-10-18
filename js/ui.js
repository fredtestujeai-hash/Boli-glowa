// Panele wysuwane od dołu, powiadomienia i drobne elementy interfejsu.
import { icon } from './icons.js';

let current = null;

/**
 * `guard` chroni przed przypadkowym zamknięciem (tło, Escape) — np. gdy formularz ma niezapisane zmiany.
 * Przycisk z atrybutem data-close zamyka zawsze.
 */
export function openSheet(html, { onClose, guard, className = '' } = {}) {
  closeSheet(true);
  const root = document.getElementById('sheet-root');
  const wrap = document.createElement('div');
  wrap.className = 'sheet-layer';
  wrap.innerHTML = `<div class="sheet-backdrop" data-close="soft"></div>
    <div class="sheet ${className}" role="dialog" aria-modal="true">${html}</div>`;
  root.appendChild(wrap);
  document.body.classList.add('sheet-open');
  requestAnimationFrame(() => wrap.classList.add('is-open'));

  const sheet = wrap.querySelector('.sheet');
  const requestClose = (soft) => {
    if (soft && guard && !guard()) {
      sheet.classList.remove('nudge');
      void sheet.offsetWidth;
      sheet.classList.add('nudge');
      return;
    }
    closeSheet();
  };
  const onKey = (e) => {
    if (e.key === 'Escape') requestClose(true);
  };
  wrap.addEventListener('click', (e) => {
    const c = e.target.closest('[data-close]');
    if (c) requestClose(c.dataset.close === 'soft');
  });
  document.addEventListener('keydown', onKey);
  current = { wrap, onKey, onClose, opener: document.activeElement };
  const heading = sheet.querySelector('h2');
  if (heading) {
    heading.setAttribute('tabindex', '-1');
    heading.focus({ preventScroll: true });
  }
  return sheet;
}

export function closeSheet(immediate = false) {
  if (!current) return;
  const { wrap, onKey, onClose, opener } = current;
  current = null;
  document.removeEventListener('keydown', onKey);
  document.body.classList.remove('sheet-open');
  wrap.classList.remove('is-open');
  const remove = () => wrap.remove();
  if (immediate) remove();
  else setTimeout(remove, 260);
  onClose?.();
  if (opener && document.contains(opener)) opener.focus?.({ preventScroll: true });
}

let toastTimer;
export function toast(message, kind = 'ok') {
  const el = document.getElementById('toast');
  el.className = `toast toast-${kind} is-visible`;
  el.innerHTML = `${icon(kind === 'error' ? 'alert' : 'check')}<span>${message}</span>`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('is-visible'), kind === 'error' ? 5200 : 2600);
}

/** Przycisk, który przy pierwszym kliknięciu prosi o potwierdzenie. */
export function armConfirm(button, label, onConfirm) {
  if (button.dataset.armed) {
    onConfirm();
    return;
  }
  const original = button.innerHTML;
  button.dataset.armed = '1';
  button.classList.add('is-armed');
  button.innerHTML = label;
  setTimeout(() => {
    if (!button.isConnected) return;
    delete button.dataset.armed;
    button.classList.remove('is-armed');
    button.innerHTML = original;
  }, 3500);
}

export function download(filename, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
