// Effetti sonori sintetizzati con WebAudio: nessun file audio da distribuire.
let ctx = null, enabled = true;

export function setSound(on) { enabled = on; }
export function unlockAudio() {
  if (ctx || !enabled) return;
  try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch { ctx = null; }
}

function tone(freq, dur, type = 'square', vol = 0.05, slide = 0) {
  if (!ctx || !enabled || ctx.state !== 'running') return;
  const o = ctx.createOscillator(), g = ctx.createGain(), t0 = ctx.currentTime;
  o.type = type; o.frequency.setValueAtTime(freq, t0);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t0 + dur);
  g.gain.setValueAtTime(vol, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g).connect(ctx.destination); o.start(t0); o.stop(t0 + dur);
}

let lastShot = 0;
export const sfx = {
  shot() { const n = performance.now(); if (n - lastShot < 90) return; lastShot = n; tone(520, 0.05, 'square', 0.012, -300); },
  rocket() { tone(240, 0.16, 'sawtooth', 0.04, 500); },
  kill() { tone(160, 0.22, 'sawtooth', 0.05, -120); },
  boss() { tone(110, 0.5, 'sawtooth', 0.07, -70); setTimeout(() => tone(660, 0.25, 'triangle', 0.06, 300), 120); },
  buy() { tone(700, 0.08, 'triangle', 0.05, 350); },
  reward() { tone(660, 0.1, 'triangle', 0.06); setTimeout(() => tone(990, 0.18, 'triangle', 0.06), 90); },
  fail() { tone(220, 0.35, 'square', 0.04, -140); },
};
