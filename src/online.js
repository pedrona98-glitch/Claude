// Accesso alle funzioni online (arena, alleanze, chat).
// Con CONFIG.serverUrl impostato parla col server vero; altrimenti usa una demo locale
// con le stesse regole e giocatori simulati, dichiarata come tale nell'interfaccia.
import { CONFIG } from './config.js';
import { createWorld, emptyData, ApiError, weekOf, weekDay } from '../shared/social.js';
import { getLang } from './i18n.js';

const DEMO_KEY = 'sky_squadron_demo_world_v2';
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
    u.plane = ['biplane', 'mono', 'fighter', 'jet'][Math.min(3, Math.floor(u.k * 1.7))];
    u.dps = 10 * u.k; u.hp = 100 * u.k; u.stage = Math.round(8 * u.k);
    return r.token;
  });
  BOT_ALLIANCES.forEach(([name, tag], a) => {
    const idx = [0, 1, 2, 3, 4, 5].map((j) => (a + j * 5 + 3) % BOT_PILOTS.length).filter((v, i, arr) => arr.indexOf(v) === i);
    let cid = null;
    for (const i of idx) {
      const u = w.data.users[w.data.tokens[tokens[i]]];
      if (u.clan) continue;
      if (!cid) cid = w.handle(tokens[i], 'clan.create', { name, tag }, now).clan.id;
      else w.handle(tokens[i], 'clan.join', { id: cid }, now);
    }
    if (cid) w.data.clans[cid].tp = [22, 17, 12, 10, 10][a];
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
  const c = u.clan && w.data.clans[u.clan];
  list.push({ n: w.data.seq++, uid: u.id, name: u.name, tag: c ? c.tag : '', text, ts, reports: [] });
  if (list.length > 200) list.shift();
}

/** Fa "vivere" i giocatori simulati in proporzione al tempo trascorso: forza, punti di lega, guerra, chat. */
function demoTick(w, me, now) {
  const d = w.data, mins = Math.min(Math.max(0, now - (d.demoAt || now)), 6 * 3600e3) / 60e3;
  d.demoAt = now;
  const bots = Object.values(d.users).filter((u) => u.bot);
  if (me && me.dps > 0) for (const u of bots) { u.dps = me.dps * u.k; u.hp = me.hp * u.k; u.stage = Math.max(1, Math.round(me.stage * (0.6 + u.k * 0.4))); }
  d.demoChat = (d.demoChat || 0) + mins / 2.5;
  const lines = BOT_LINES[getLang()] || BOT_LINES.en;
  while (d.demoChat >= 1) { d.demoChat--; botSay(w, lines[Math.floor(Math.random() * lines.length)], now - Math.random() * 60e3); }
  if (!me || weekDay(now) === 6) return;
  const week = weekOf(now);
  for (const u of bots) {
    // i bot giocano in lega nello stesso girone del giocatore
    if (me.group && me.group.startsWith(week + ':')) {
      const g = d.groups[me.group];
      if (!g.ids.includes(u.id) && g.ids.length < 100) { u.lg = me.lg; u.group = me.group; g.ids.push(u.id); g.lp[u.id] = Math.round(Math.random() * 40); }
      if (g.ids.includes(u.id) && Math.random() < mins / 60) g.lp[u.id] = (g.lp[u.id] || 0) + Math.round(8 + u.k * 12);
    }
    // e contribuiscono alla guerra della propria alleanza
    const c = u.clan && d.clans[u.clan];
    const war = c && w.warOf(c, now);
    if (war && Math.random() < mins / 45) {
      const day = weekDay(now), pts = Math.round((day === 5 ? 60 : 900) * u.k * (0.5 + Math.random()));
      war.pair.days[day][war.side] += pts;
      war.pair.contrib[u.id] = (war.pair.contrib[u.id] || 0) + pts;
    }
  }
}
async function demoCall(token, action, payload) {
  const w = loadDemo(), now = Date.now();
  const me = w.data.users[w.data.tokens[token]];
  demoTick(w, me, now);
  let out = w.handle(token, action, payload, now);
  // il girone si forma alla prima richiesta: si rifà la lettura dopo che i piloti simulati sono entrati
  if (action === 'league.get') { demoTick(w, w.data.users[w.data.tokens[token]], now); out = w.handle(token, action, payload, now); }
  if (action === 'sync') demoTick(w, w.data.users[w.data.tokens[token]], now);
  saveDemo();
  return JSON.parse(JSON.stringify(out)); // come se arrivasse dalla rete
}
