// Icone vettoriali disegnate per il gioco (24×24). `ic('coin')` restituisce l'SVG come stringa.
const S = (d, extra = '') => `<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" ${extra}>${d}</svg>`;
const F = (d, cls) => `<svg class="ic ${cls}" viewBox="0 0 24 24" aria-hidden="true">${d}</svg>`;

const ICONS = {
  // valute (piene, colorate)
  coin: F('<circle cx="12" cy="12" r="9.2" fill="#e2b959"/><circle cx="12" cy="12" r="6.6" fill="none" stroke="#9a7424" stroke-width="1.2"/><path d="M12 7.6l1.3 2.9 3.1.3-2.3 2.1.7 3.1-2.8-1.6-2.8 1.6.7-3.1-2.3-2.1 3.1-.3z" fill="#9a7424"/>', 'c-coin'),
  gem: F('<path d="M6.5 4h11L22 9.5 12 21 2 9.5z" fill="#7fd6e8"/><path d="M2 9.5h20M6.5 4L9 9.5 12 21l3-11.5L17.5 4M9 9.5L12 4l3 5.5" fill="none" stroke="#2c8ba0" stroke-width="1.1" stroke-linejoin="round"/>', 'c-gem'),
  medal: F('<path d="M8 2h3l1 5-3 2zM16 2h-3l-1 5 3 2z" fill="#c85563"/><circle cx="12" cy="15" r="6.2" fill="#e2b959"/><path d="M12 11.3l1.1 2.3 2.5.3-1.8 1.7.5 2.5-2.3-1.3-2.3 1.3.5-2.5-1.8-1.7 2.5-.3z" fill="#9a7424"/>', 'c-medal'),
  trophy: F('<path d="M7 3h10v5a5 5 0 01-10 0z" fill="#e2b959"/><path d="M7 5H3.5v1.5A3.5 3.5 0 007 10M17 5h3.5v1.5A3.5 3.5 0 0117 10" fill="none" stroke="#e2b959" stroke-width="1.6"/><path d="M10.5 13h3v4h-3zM7.5 17h9v3h-9z" fill="#b8913a"/>', 'c-trophy'),
  // interfaccia
  gear: S('<circle cx="12" cy="12" r="3"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1"/>'),
  chat: S('<path d="M4 5h16v11H10l-5 4v-4H4z"/><path d="M8 9h8M8 12.5h5"/>'),
  send: S('<path d="M3 11.5L21 3l-7 18-3-7z"/><path d="M11 14l4-5"/>'),
  flag: S('<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>'),
  close: S('<path d="M6 6l12 12M18 6L6 18"/>'),
  play: S('<rect x="3" y="5" width="18" height="14" rx="3"/><path d="M10 9.2v5.6l5-2.8z" fill="currentColor"/>'),
  check: S('<path d="M5 12.5l4.5 4.5L19 7.5"/>'),
  lock: S('<rect x="5" y="10.5" width="14" height="10" rx="2"/><path d="M8 10.5V7.5a4 4 0 018 0v3"/>'),
  refresh: S('<path d="M20 12a8 8 0 11-2.6-5.9M20 4v5h-5"/>'),
  users: S('<circle cx="9" cy="8.5" r="3.2"/><path d="M3 20c0-3.5 2.7-6 6-6s6 2.5 6 6"/><path d="M16 5.6a3.2 3.2 0 010 5.8M17.5 14.4c2.1.7 3.5 2.8 3.5 5.6"/>'),
  robot: S('<rect x="5" y="8" width="14" height="11" rx="2.5"/><path d="M12 8V4.5M9.5 13v1.5M14.5 13v1.5M2.5 12.5v3M21.5 12.5v3"/><circle cx="12" cy="3.6" r="1"/>'),
  heart: S('<path d="M12 20S4 15 4 9.2A4.2 4.2 0 0112 7a4.2 4.2 0 018 2.2C20 15 12 20 12 20z"/>'),
  // schede
  plane: S('<path d="M21.5 12c0 .9-3 1.6-5.5 1.6h-3l-4 6.4H7l2-6.4H5.5L4 15.5H2.5l1-3.5-1-3.5H4L5.5 10.4H9L7 4h2l4 6.4h3c2.500 0 5.500.7 5.500 1.600z"/>'),
  squad: S('<path d="M12 4l3 6h-6zM5.5 11l3 6h-6zM18.500 11l3 6h-6z"/>'),
  swords: S('<path d="M4 4l10.500 10.500M4 4v3l9 9M4 4h3l9 9M20 4L9.5 14.5M20 4v3l-9 9M20 4h-3l-9 9M5 16l3 3M19 16l-3 3M4 20l2.500-2.500M20 20l-2.500-2.500"/>'),
  shield: S('<path d="M12 3l8 3v5.500c0 5-3.400 8.300-8 9.500-4.600-1.200-8-4.500-8-9.500V6z"/><path d="M12 8l1.200 2.500 2.700.3-2 1.900.6 2.700L12 14.100l-2.500 1.300.600-2.700-2-1.900 2.700-.3z"/>'),
  star: S('<path d="M12 3l2.700 5.700 6.300.800-4.600 4.300 1.200 6.200L12 17l-5.600 3 1.200-6.200L3 9.500l6.300-.8z"/>'),
  shop: S('<path d="M4 9h16l-1.200 11H5.200z"/><path d="M8.500 9V7.500a3.500 3.500 0 017 0V9"/>'),
  wrench: S('<path d="M20.5 6.5l-3 3-3-.5-.5-3 3-3a5 5 0 00-6.300 6.400L3.500 16.600a2.100 2.100 0 003 3l7.200-7.200a5 5 0 006.800-5.900z"/>'),
  engine: S('<circle cx="12" cy="12" r="3.200"/><path d="M12 2.500v6.300M12 15.200v6.300M2.500 12h6.300M15.200 12h6.300M5.300 5.300l4.400 4.400M14.300 14.300l4.400 4.400M5.300 18.700l4.400-4.400M14.300 9.700l4.400-4.400"/><circle cx="12" cy="12" r="9.500"/>'),
  prop: S('<circle cx="12" cy="12" r="1.800"/><path d="M12 10.200C10 7 10 3.500 12 2c2 1.500 2 5 0 8.200zM13.600 12.900c3.800.100 6.800 1.900 7.100 4.300-2.300 1-5.300-.700-7.100-4.300zM10.400 12.900c-1.800 3.600-4.800 5.300-7.100 4.300.300-2.400 3.300-4.200 7.100-4.300z"/>'),
  wing: S('<path d="M2.500 15.500c5-6.500 11-9 19-9-1.500 4-4.500 6.500-9 7.500l-3 4h-3l1.500-3.500c-2 .500-3.700.800-5.500 1z"/><path d="M12.500 14l4-4"/>'),
  wheel: S('<circle cx="12" cy="15" r="6"/><circle cx="12" cy="15" r="1.800"/><path d="M12 9V2.500M8.500 2.500h7"/>'),
  // potenziamenti e talenti
  gun: S('<path d="M3 9h13l5 2.500-5 2.500H9l-1 4H5l1-4H3z"/><path d="M12 9V6.500"/>'),
  armor: S('<path d="M12 3l8 3v5.500c0 5-3.400 8.300-8 9.500-4.600-1.200-8-4.500-8-9.500V6z"/><path d="M12 7.500v9M8 12h8"/>'),
  bolt: S('<path d="M13 2.500L5 13.500h6l-1 8 8-11h-6z"/>'),
  target: S('<circle cx="12" cy="12" r="8.500"/><circle cx="12" cy="12" r="4"/><path d="M12 1.500v4M12 18.500v4M1.500 12h4M18.500 12h4"/>'),
  burst: S('<path d="M12 2l2 6 5.500-3.500L16 10l6 2-6 2 3.500 5.500L14 16l-2 6-2-6-5.500 3.500L8 14l-6-2 6-2-3.500-5.500L10 8z"/>'),
  crate: S('<path d="M3 8l9-4.500L21 8v8.500L12 21l-9-4.500z"/><path d="M3 8l9 4.500L21 8M12 12.500V21"/>'),
  fuel: S('<rect x="4" y="4" width="10" height="16" rx="1.500"/><path d="M4 10h10M14 8h2.500l2.500 3v6.500a1.700 1.700 0 01-3.400 0V14H14"/>'),
  takeoff: S('<path d="M2.500 20h19M4 14.500l3 1.500 13.500-6.500c.900-.500.700-1.800-.300-2.200-1.200-.400-2.500-.300-3.600.300L13 9.500 7 6.500 5.500 7.300l3.700 4-3 1.500-2.200-1z"/>'),
  clock: S('<circle cx="12" cy="13" r="8"/><path d="M12 8.500V13l3 2M9.500 2.500h5"/>'),
  gift: S('<rect x="3.500" y="9" width="17" height="11" rx="1.500"/><path d="M2.500 9h19V6h-19zM12 6v14M12 6c-1.500-4-6-3.500-5 0M12 6c1.500-4 6-3.500 5 0"/>'),
  noads: S('<circle cx="12" cy="12" r="9"/><path d="M5.700 5.700l12.600 12.600"/>'),
  calendar: S('<rect x="3.500" y="5" width="17" height="15.500" rx="2"/><path d="M3.500 10h17M8 3v4M16 3v4"/>'),
  flame: S('<path d="M12 21.500c-4 0-6.500-2.800-6.500-6.200 0-3.300 2.700-5 3.500-8.300 2 1 3 3 3 4.500 1-1.500 1.500-4.500.5-7 4 2 6 6.500 6 10.300 0 3.900-2.500 6.700-6.500 6.700z"/>'),
  warp: S('<path d="M3 6l8 6-8 6zM12 6l8 6-8 6z"/>'),
  skull: S('<path d="M5 11a7 7 0 0114 0c0 2.500-1.200 4-2.500 5v3.500h-9V16C6.200 15 5 13.500 5 11z"/><circle cx="9.300" cy="11.500" r="1.400"/><circle cx="14.700" cy="11.500" r="1.400"/><path d="M10.500 19.500V17.500M13.500 19.500V17.500"/>'),
  moon: S('<path d="M20 14.500A8.500 8.500 0 119.500 4a7 7 0 0010.500 10.500z"/>'),
  alert: S('<path d="M12 3.500L22 20H2z"/><path d="M12 10v5M12 17.500v.500"/>'),
  flask: S('<path d="M9.500 3h5M10.500 3v6L5 19.500c-.500 1 .200 2 1.300 2h11.400c1.100 0 1.800-1 1.300-2L13.500 9V3M7.500 15h9"/>'),
};

export const ic = (name) => ICONS[name] || ICONS.star;
export const esc = (text) => String(text).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
/** Icona seguita da testo, per bottoni ed etichette. Il testo viene sempre trattato come testo. */
export function withIcon(name, text) {
  return `${name ? ic(name) : ''}<span>${esc(text)}</span>`;
}
