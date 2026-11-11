// Accesso alle funzioni online (arena, alleanze, chat).
// Con CONFIG.serverUrl impostato parla col server vero; altrimenti usa una demo locale
// con le stesse regole e giocatori simulati, dichiarata come tale nell'interfaccia.
import { CONFIG } from './config.js';
import { createWorld, emptyData, ApiError, dayOf } from '../shared/social.js';
import { getLang } from './i18n.js';

const DEMO_KEY = 'sky_squadron_demo_world_v1';
const demoMode = !CONFIG.serverUrl;
let world = null;

export const Online = {
  demo: demoMode,
  /** Chiama un'azione del server. Lancia ApiError con un codice (vedi err_* nei testi). */
  async call(token, action, payload = {}) {
    if (demoMode) return demoCall(token, action, payload);
    let res;
    try {
      const ctrl = new AbortController(), timer = setTimeout(() => ctrl.abort(), 8000);
      res = await fetch(`${CONFIG.serverUrl.replace(/\/$/, '')}/api/${action}`, {
        method: 'POST', signal: ctrl.signal,
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
        body: JSON.stringify(payload),
      });
      clearTimeout(timer);
    } catch { throw new ApiError('offline'); }
    let body = null;
    try { body = await res.json(); } catch { /* risposta non JSON */ }
    if (!res.ok) throw new ApiError(body?.error || 'offline');
    return body;
  },
};

// ---------- demo locale ----------
const BOT_PILOTS = ['Lupo', 'Maverik', 'Stella', 'Ghibli', 'Bora', 'Tempesta', 'Nibbio', 'Astro', 'Corsaro', 'Freccia', 'Sirio', 'Vega',
  'Orione', 'Grifone', 'Mistral', 'Rapace', 'Zeffiro', 'Lampo', 'Condor', 'Aliseo', 'Polaris', 'Scirocco', 'Albatro', 'Fulmine',
  'Pegaso', 'Drago', 'Cobra', 'Levante', 'Nembo', 'Artiglio', 'Brezza', 'Meteora'];
const BOT_ALLIANCES = [['Stormo Reale', 'SR'], ['Ali di Ferro', 'ADF'], ['Lupi del Cielo', 'LUP'], ['Quota Zero', 'Q0'], ['Vento Nero', 'VN']];
const BOT_LINES = {
  it: ['Qualcuno per il boss dell\'alleanza?', 'Finalmente missione 40!', 'Che aereo usate in arena?', 'Buona caccia a tutti', 'Consiglio: non trascurate la corazza',
    'Chi viene in guerra oggi?', 'Appena preso il Gheppio, altra storia', 'gg', 'Cerco alleanza attiva', 'Il boss della 45 mi ha asfaltato'],
  en: ['Anyone up for the alliance boss?', 'Mission 40 at last!', 'Which plane do you use in the arena?', 'Good hunting everyone', 'Tip: do not neglect armor',
    'Who is joining the war today?', 'Just got the Kestrel, big difference', 'gg', 'Looking for an active alliance', 'The boss at 45 flattened me'],
};

function loadDemo() {
  if (world) return world;
  let data = null;
  try { data = JSON.parse(localStorage.getItem(DEMO_KEY)); } catch { /* storage non disponibile */ }
  world = createWorld(data && data.users ? data : seedDemo());
  return world;
}
function saveDemo() {
  try { localStorage.setItem(DEMO_KEY, JSON.stringify(world.data)); } catch { /* ignora */ }
}

function seedDemo() {
  const now = Date.now(), w = createWorld(emptyData());
  const tokens = BOT_PILOTS.map((name, i) => {
    const r = w.handle(null, 'register', { name }, now - 3 * 86400e3);
    const u = w.data.users[r.user.id];
    u.bot = true; u.k = 0.45 + (i / BOT_PILOTS.length) * 1.6; // forza relativa al giocatore
    u.rating = Math.round(880 + u.k * 260 + Math.random() * 60);
    u.plane = ['libellula', 'rondine', 'gheppio', 'saetta'][Math.min(3, Math.floor(u.k * 1.7))];
    u.dps = 10 * u.k; u.hp = 50 * u.k; u.stage = Math.round(8 * u.k);
    return r.token;
  });
  BOT_ALLIANCES.forEach(([name, tag], a) => {
    const idx = [0, 1, 2, 3, 4].map((j) => (a + j * 5 + 3) % BOT_PILOTS.length).filter((v, i, arr) => arr.indexOf(v) === i);
    let aid = null;
    for (const i of idx) {
      const u = w.data.users[w.data.tokens[tokens[i]]];
      if (u.alliance) continue;
      if (!aid) aid = w.handle(tokens[i], 'ally.create', { name, tag }, now).alliance.id;
      else w.handle(tokens[i], 'ally.join', { id: aid }, now);
    }
    if (aid) { w.data.alliances[aid].level = 2 + a; }
  });
  w.data.demoAt = now; w.data.demoChat = 0;
  const lines = BOT_LINES[getLang()] || BOT_LINES.en;
  for (let i = 0; i < 4; i++) botSay(w, lines[i], now - (5 - i) * 240e3);
  return w.data;
}

function botSay(w, text, ts) {
  const bots = Object.values(w.data.users).filter((u) => u.bot);
  const u = bots[Math.floor(Math.random() * bots.length)];
  const key = 'g:' + u.server, list = w.data.chat[key] || (w.data.chat[key] = []);
  const a = u.alliance && w.data.alliances[u.alliance];
  list.push({ n: w.data.seq++, uid: u.id, name: u.name, tag: a ? a.tag : '', text, ts, reports: [] });
  if (list.length > 200) list.shift();
}

/** Fa "vivere" i giocatori simulati in proporzione al tempo trascorso. */
function demoTick(w, me, now) {
  const d = w.data, mins = Math.min(Math.max(0, now - (d.demoAt || now)), 6 * 3600e3) / 60e3;
  d.demoAt = now;
  if (me && me.dps > 0) {
    for (const u of Object.values(d.users)) if (u.bot) { u.dps = me.dps * u.k; u.hp = me.hp * u.k; u.stage = Math.max(1, Math.round(me.stage * (0.6 + u.k * 0.4))); }
  }
  d.demoChat = (d.demoChat || 0) + mins / 2.5;
  const lines = BOT_LINES[getLang()] || BOT_LINES.en;
  while (d.demoChat >= 1) { d.demoChat--; botSay(w, lines[Math.floor(Math.random() * lines.length)], now - Math.random() * 60e3); }
  if (!me || !me.alliance) return;
  const a = d.alliances[me.alliance], mates = Math.max(0, a.members.length - 1);
  if (a.boss && mates) a.boss.hp = Math.max(a.boss.maxHp * 0.08, a.boss.hp - a.boss.maxHp * 0.006 * mins * mates);
  const war = d.wars[me.server];
  const pair = war && war.day === dayOf(now) && war.pairs.find((p) => p.a === a.id || p.b === a.id);
  if (pair) {
    const pts = (n) => { let s = 0; for (let i = 0; i < n; i++) if (Math.random() < mins / 90) s += Math.random() < 0.5 ? 3 : 1; return s; };
    const mineIsA = pair.a === a.id, enemy = d.alliances[mineIsA ? pair.b : pair.a];
    const mine = pts(mates), theirs = pts(enemy ? enemy.members.length : 0);
    pair.pa += mineIsA ? mine : theirs; pair.pb += mineIsA ? theirs : mine;
  }
}

async function demoCall(token, action, payload) {
  const w = loadDemo(), now = Date.now();
  const me = w.data.users[w.data.tokens[token]];
  demoTick(w, me, now);
  const out = w.handle(token, action, payload, now);
  if (action === 'sync') demoTick(w, w.data.users[w.data.tokens[token]], now);
  saveDemo();
  return JSON.parse(JSON.stringify(out)); // come se arrivasse dalla rete
}
