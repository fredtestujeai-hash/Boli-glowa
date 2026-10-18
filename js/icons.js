import { INTENSITY_COLORS } from './constants.js';

const PATHS = {
  calendar: '<rect x="3" y="4.5" width="18" height="16.5" rx="3.5"/><path d="M3 9.5h18M8 2.5v4M16 2.5v4"/>',
  bulb: '<path d="M9.5 18h5M10.5 21.2h3"/><path d="M12 2.8a6.2 6.2 0 0 0-3.7 11.2c.7.5 1.2 1.3 1.2 2.2v.3h5v-.3c0-.9.5-1.7 1.2-2.2A6.2 6.2 0 0 0 12 2.8z"/>',
  report: '<path d="M14 2.8H7.2A2.2 2.2 0 0 0 5 5v14a2.2 2.2 0 0 0 2.2 2.2h9.6A2.2 2.2 0 0 0 19 19V7.8z"/><path d="M14 2.8v5h5M9 13h6M9 16.8h4"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  left: '<path d="M15 18l-6-6 6-6"/>',
  right: '<path d="M9 18l6-6-6-6"/>',
  down: '<path d="M6 9l6 6 6-6"/>',
  x: '<path d="M18 6L6 18M6 6l12 12"/>',
  check: '<path d="M20 6.5L9.5 17 4 11.5"/>',
  pill: '<path d="M10.5 20.5a5 5 0 0 1-7-7l6-6a5 5 0 0 1 7 7z"/><path d="M8.5 8.5l7 7"/>',
  coffee: '<path d="M4 9.5h12v4.5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5z"/><path d="M16 10.5h1.5a2.5 2.5 0 0 1 0 5H16M8 3v3M12 3v3"/>',
  bolt: '<path d="M13 2.5L4.5 13.5h6.5l-1 8 8.5-11h-6.5z"/>',
  phone: '<rect x="6.5" y="2.5" width="11" height="19" rx="2.8"/><path d="M11 18.2h2"/>',
  moon: '<path d="M20.5 14.5A8.5 8.5 0 1 1 9.5 3.5a6.8 6.8 0 0 0 11 11z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2.2M12 19.8V22M4.9 4.9l1.5 1.5M17.6 17.6l1.5 1.5M2 12h2.2M19.8 12H22M4.9 19.1l1.5-1.5M17.6 6.4l1.5-1.5"/>',
  auto: '<circle cx="12" cy="12" r="8.5"/><path d="M12 3.5v17a8.5 8.5 0 0 0 0-17z" fill="currentColor"/>',
  droplet: '<path d="M12 2.8s6.5 7 6.5 11.4a6.5 6.5 0 0 1-13 0C5.5 9.8 12 2.8 12 2.8z"/>',
  wine: '<path d="M7 2.8h10v4.4a5 5 0 0 1-10 0z"/><path d="M12 12.2v8.6M8 21h8"/>',
  activity: '<path d="M2.5 12h4l2.5-6.5 5 13 2.5-6.5h5"/>',
  gauge: '<path d="M4.2 17.5a9 9 0 1 1 15.6 0"/><path d="M12 14l4.2-4.2"/><circle cx="12" cy="14" r="1.2"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.2 2"/>',
  timer: '<circle cx="12" cy="13.5" r="8"/><path d="M12 9.5v4l2.5 2M9.5 2.5h5"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  cloud: '<path d="M7 18.5a5 5 0 1 1 .8-9.9A6.2 6.2 0 0 1 19.6 10a4.2 4.2 0 0 1-1.1 8.5z"/>',
  device: '<rect x="6.5" y="2.5" width="11" height="19" rx="2.8"/><path d="M11 18.2h2"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13.2h10L18 7M9 7V3.8h6V7"/>',
  alert: '<path d="M10.3 3.9L2.4 17.6A2 2 0 0 0 4.1 20.6h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9.5v4M12 17h.01"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5.5M12 7.6h.01"/>',
  download: '<path d="M12 3.5v11.5M7 10.5l5 5 5-5M4.5 20.5h15"/>',
  upload: '<path d="M12 15.5V4M7 8.5l5-5 5 5M4.5 20.5h15"/>',
  printer: '<path d="M7 9V3h10v6"/><rect x="3" y="9" width="18" height="8" rx="2.2"/><path d="M7 14h10v7H7z"/>',
  copy: '<rect x="8.5" y="8.5" width="12.5" height="12.5" rx="2.5"/><path d="M15.5 8.5V5.5a2.5 2.5 0 0 0-2.5-2.5H5.5A2.5 2.5 0 0 0 3 5.5V13a2.5 2.5 0 0 0 2.5 2.5h3"/>',
  logout: '<path d="M9 20.5H6A2.5 2.5 0 0 1 3.5 18V6A2.5 2.5 0 0 1 6 3.5h3M15.5 16.5l4.5-4.5-4.5-4.5M20 12H9"/>',
  spark: '<path d="M12 3l1.9 5.4L19.5 10l-5.6 1.7L12 17l-1.9-5.3L4.5 10l5.6-1.6z"/><path d="M19 16.5l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z"/>',
  heart: '<path d="M20.4 5.6a5 5 0 0 0-7.1 0L12 6.9l-1.3-1.3a5 5 0 0 0-7.1 7.1L12 21l8.4-8.3a5 5 0 0 0 0-7.1z"/>',
  shield: '<path d="M12 21.5s8-3.8 8-10V5.2L12 2.5 4 5.2v6.3c0 6.2 8 10 8 10z"/><path d="M8.8 12l2.2 2.2 4.2-4.4"/>',
  phoneCall: '<path d="M21 16.5v3a2 2 0 0 1-2.2 2A19.8 19.8 0 0 1 2.5 5.2 2 2 0 0 1 4.5 3h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.5 10.8a16 16 0 0 0 4.7 4.7l1.2-1.2a2 2 0 0 1 2.1-.5c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z"/>',
  book: '<path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H20v17H6.5A2.5 2.5 0 0 0 4 21.5z"/><path d="M4 21.5A2.5 2.5 0 0 1 6.5 19H20v2.5H6.5"/>',
};

export function icon(name, cls = '') {
  return `<svg class="i ${cls}" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${PATHS[name] || ''}</svg>`;
}

/** Buźka, której wyraz zmienia się wraz z natężeniem bólu (0–10). */
export function faceSvg(level, size = 64) {
  const v = Math.max(0, Math.min(10, level ?? 0));
  const t = v / 10;
  const fill = INTENSITY_COLORS[v];
  const ink = v >= 7 ? '#3B0F24' : '#3A2A1E';
  const mouthY = 44 + t * 2;
  const curve = 9 - t * 18; // dodatnie = uśmiech, ujemne = grymas
  const eyes =
    v >= 8
      ? `<path d="M17.5 25.5l7 3.2-7 3.2M46.5 25.5l-7 3.2 7 3.2" stroke="${ink}" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`
      : `<ellipse cx="23" cy="28" rx="3.3" ry="${(3.6 - t * 1.6).toFixed(2)}" fill="${ink}"/><ellipse cx="41" cy="28" rx="3.3" ry="${(3.6 - t * 1.6).toFixed(2)}" fill="${ink}"/>`;
  const browTilt = t * 5;
  const brows =
    v >= 4
      ? `<path d="M16.5 ${19 - browTilt * 0.2}L28 ${17 + browTilt}M47.5 ${19 - browTilt * 0.2}L36 ${17 + browTilt}" stroke="${ink}" stroke-width="2.6" fill="none" stroke-linecap="round" opacity="${(0.4 + t * 0.6).toFixed(2)}"/>`
      : '';
  const sweat = v >= 9 ? `<path d="M51 14c2.5 3.4 3.4 5.2 3.4 6.6a3.4 3.4 0 0 1-6.8 0c0-1.4.9-3.2 3.4-6.6z" fill="#8FD3FF"/>` : '';
  return `<svg class="face" width="${size}" height="${size}" viewBox="0 0 64 64" aria-hidden="true">
    <circle cx="32" cy="32" r="30" fill="${fill}"/>
    <circle cx="32" cy="32" r="30" fill="url(#faceShine)" opacity=".55"/>
    <defs><radialGradient id="faceShine" cx=".32" cy=".25" r=".8"><stop offset="0" stop-color="#fff" stop-opacity=".9"/><stop offset=".55" stop-color="#fff" stop-opacity="0"/></radialGradient></defs>
    ${brows}${eyes}
    <path d="M21 ${mouthY}Q32 ${mouthY + curve} 43 ${mouthY}" stroke="${ink}" stroke-width="3.2" fill="none" stroke-linecap="round"/>
    ${sweat}
  </svg>`;
}
