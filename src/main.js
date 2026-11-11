import '@fontsource/barlow/latin-400.css';
import '@fontsource/barlow/latin-600.css';
import '@fontsource/barlow-condensed/latin-600.css';
import '@fontsource/barlow-condensed/latin-700.css';
import './style.css';
import * as G from './game.js';
import { DROP_INTERVAL } from './data.js';
import { setLang, t } from './i18n.js';
import { sfx, setSound, unlockAudio } from './audio.js';
import { createRenderer } from './render.js';
import { createUI } from './ui.js';
import { Monet } from './monetization.js';

const SAVE_KEY = 'sky_squadron_idle_save_v1';
const OFFLINE_MIN_SECONDS = 60;

function readSave() {
  try { return JSON.parse(localStorage.getItem(SAVE_KEY)); } catch { return null; }
}

const app = {
  state: G.loadState(readSave()),
  save() {
    app.state.lastSeen = Date.now();
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(G.serialize(app.state))); } catch { /* storage non disponibile */ }
  },
  reset() {
    const keep = { perks: app.state.perks, purchased: app.state.purchased, settings: app.state.settings, online: { ...app.state.online, allyLevel: 0 } };
    app.state = Object.assign(G.newState(), keep);
    app.save(); ui.render();
  },
};

setLang(app.state.settings.lang);
setSound(app.state.settings.sound);
document.title = t('title');

const battle = document.querySelector('#battle');
const renderer = createRenderer(document.querySelector('#sky'));
const ui = createUI(app);
ui.render();

function checkOffline() {
  const away = (Date.now() - app.state.lastSeen) / 1000;
  if (away < OFFLINE_MIN_SECONDS) return;
  const { secs, coins, wrenches } = G.offlineEarnings(app.state, away, Date.now());
  app.state.lastSeen = Date.now();
  if (coins > 0 && !ui.hasModal()) ui.showOffline(secs, coins, wrenches);
}
checkOffline();

// ---------- ciclo di gioco ----------
const events = [];
let last = performance.now(), uiTimer = 0, saveTimer = 0, autoTimer = 0;
let dropAt = performance.now() + 45000;

function frame(ts) {
  const dt = Math.min(0.25, Math.max(0, (ts - last) / 1000));
  last = ts;
  const s = app.state;
  events.length = 0;
  G.tick(s, dt, Date.now(), events);
  handle(events);
  renderer.draw(s, dt);
  // costruzione automatica: un pezzo ogni terzo di secondo finché ci sono chiavi
  if (s.auto && (autoTimer += dt) >= 0.33) {
    autoTimer = 0;
    const r = G.autoBuild(s);
    if (r && r.equipped) { ui.flash(r.part.slot); sfx.buy(); }
  }
  if ((uiTimer += dt) >= 0.2) { uiTimer = 0; ui.refresh(); }
  if ((saveTimer += dt) >= 10) { saveTimer = 0; app.save(); }
  if (ts >= dropAt) {
    dropAt = ts + 1000 * (DROP_INTERVAL[0] + Math.random() * (DROP_INTERVAL[1] - DROP_INTERVAL[0]));
    ui.showDrop();
  }
  requestAnimationFrame(frame);
}

function handle(list) {
  for (const ev of list) {
    renderer.onEvent(ev, app.state);
    if (ev.t === 'shot') sfx.shot();
    else if (ev.t === 'tap') sfx.rocket();
    else if (ev.t === 'kill') {
      if (ev.boss) { sfx.boss(); ui.banner(t('boss_win'), 'good'); } else sfx.kill();
    } else if (ev.t === 'bossFail') { sfx.fail(); ui.banner(t('boss_fail'), 'bad'); }
    else if (ev.t === 'defeat') { sfx.fail(); ui.banner(t('defeat'), 'bad'); }
    else if (ev.t === 'stage' && !G.isBoss(ev.stage - 1)) ui.banner(t('new_stage', G.stageName(ev.stage)));
    else if (ev.t === 'workshop') { sfx.reward(); ui.banner(`${t('workshop')} ${ev.level}`, 'good'); }
  }
}

battle.addEventListener('pointerdown', (ev) => {
  if (ev.target.closest('button')) return;
  unlockAudio();
  const out = [];
  G.tap(app.state, Date.now(), out);
  handle(out);
});
document.addEventListener('pointerdown', unlockAudio, { once: true });

window.addEventListener('resize', () => renderer.resize());
new ResizeObserver(() => renderer.resize()).observe(battle);

document.addEventListener('visibilitychange', () => {
  if (document.hidden) app.save();
  else { last = performance.now(); checkOffline(); }
});
window.addEventListener('pagehide', () => app.save());

requestAnimationFrame((ts) => { last = ts; requestAnimationFrame(frame); });

// ---------- piattaforma nativa ----------
Monet.init({ noAds: app.state.perks.noAds }).then(() => ui.refresh());
if (Monet.native) {
  import('@capacitor/app').then(({ App }) => {
    App.addListener('backButton', () => { if (!ui.closeTopModal()) App.minimizeApp(); });
  });
}
