// Scena di battaglia su canvas. Tutta la grafica è disegnata a mano: nessuna immagine esterna.
import { PILOTS, AIRCRAFT } from './data.js';
import { fmt } from './format.js';

const ZONES = [
  { top: '#3f8fd8', bottom: '#bfe4ff', hill: '#3c7a5a', cloud: '#ffffff', sun: '#fff3b0' }, // giorno
  { top: '#35477d', bottom: '#f7a072', hill: '#5b3a52', cloud: '#ffd9c2', sun: '#ffd166' }, // tramonto
  { top: '#0b1026', bottom: '#2b3a67', hill: '#141b33', cloud: '#5d6b99', sun: '#e8ecff' }, // notte
  { top: '#4a5568', bottom: '#a0aec0', hill: '#2d3748', cloud: '#e2e8f0', sun: '#f7fafc' }, // tempesta
  { top: '#c2410c', bottom: '#fde68a', hill: '#92400e', cloud: '#fff7ed', sun: '#ffffff' }, // deserto
  { top: '#0f766e', bottom: '#a7f3d0', hill: '#134e4a', cloud: '#ecfdf5', sun: '#fef9c3' }, // aurora
];
const ENEMY_SHAPES = ['mono', 'biplane', 'fighter', 'jet', 'stealth'];
const ENEMY_COLORS = ['#8d99ae', '#b56576', '#6d597a', '#588157', '#bc6c25'];

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  let w = 0, h = 0, time = 0;
  const clouds = Array.from({ length: 9 }, (_, i) => ({
    x: Math.random(), y: 0.08 + Math.random() * 0.7, s: 0.5 + Math.random(), layer: i % 3,
  }));
  const fx = { bullets: [], sparks: [], texts: [], wrecks: [] };
  let enemyIn = 0, enemyHit = 0, shake = 0, wingTimer = 0, recoil = 0;

  function resize() {
    const r = canvas.getBoundingClientRect(), dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    w = r.width; h = r.height;
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  const unit = () => Math.min(w / 5.5, h / 3.4); // lunghezza di riferimento di un aereo
  const playerPos = () => ({ x: w * 0.24, y: h * 0.5 + Math.sin(time * 1.7) * h * 0.035 });
  const enemyPos = () => ({
    x: w * 0.78 + (1 - enemyIn) * w * 0.4, y: h * 0.48 + Math.sin(time * 1.3 + 2) * h * 0.05,
  });

  function text(str, x, y, color, size = 14) {
    fx.texts.push({ str, x, y, color, size, life: 0.9, vy: -40 - Math.random() * 20, vx: (Math.random() - 0.5) * 30 });
    if (fx.texts.length > 40) fx.texts.shift();
  }
  function bullet(from, to, color, rocket = false) {
    fx.bullets.push({ x0: from.x, y0: from.y, x1: to.x, y1: to.y, p: 0, color, rocket });
    if (fx.bullets.length > 60) fx.bullets.shift();
  }
  function burst(x, y, n, color, speed = 120) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, v = speed * (0.3 + Math.random());
      fx.sparks.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0.3 + Math.random() * 0.4, color });
    }
    if (fx.sparks.length > 220) fx.sparks.splice(0, fx.sparks.length - 220);
  }

  /** Reagisce agli eventi prodotti dalla logica di gioco. */
  function onEvent(ev, state) {
    const p = playerPos(), e = enemyPos(), u = unit();
    const jitter = () => ({ x: e.x + (Math.random() - 0.5) * u * 0.6, y: e.y + (Math.random() - 0.5) * u * 0.3 });
    if (ev.t === 'spawn') { enemyIn = 0; }
    else if (ev.t === 'shot' || ev.t === 'tap') {
      const to = jitter();
      bullet({ x: p.x + u * 0.5, y: p.y }, to, ev.t === 'tap' ? '#ff9f1c' : '#fff3b0', ev.t === 'tap');
      enemyHit = 0.12; recoil = 0.08;
      text(fmt(ev.dmg), to.x, to.y - u * 0.3, ev.crit ? '#ffd166' : '#ffffff', ev.crit ? 19 : 13);
      burst(to.x, to.y, ev.crit ? 7 : 3, ev.crit ? '#ffd166' : '#ffffff', 90);
    } else if (ev.t === 'kill') {
      burst(e.x, e.y, ev.boss ? 60 : 22, '#ff9f1c', ev.boss ? 260 : 170);
      burst(e.x, e.y, ev.boss ? 30 : 10, '#4a4a4a', 90);
      fx.wrecks.push({ x: e.x, y: e.y, vy: -30, rot: 0, boss: ev.boss, shape: enemyShape(state.stage), color: enemyColor(state.stage), life: 1.4 });
      text('+' + fmt(ev.coins) + ' 🪙', e.x, e.y - u * 0.6, '#ffe066', ev.boss ? 20 : 15);
      shake = ev.boss ? 0.5 : 0.12;
    } else if (ev.t === 'bossFail') { enemyIn = 0; }
  }

  const enemyShape = (stage) => ENEMY_SHAPES[Math.floor((stage - 1) / 5) % ENEMY_SHAPES.length];
  const enemyColor = (stage) => ENEMY_COLORS[Math.floor((stage - 1) / 3) % ENEMY_COLORS.length];

  function draw(state, dt) {
    time += dt;
    if (!w || !h) return;
    enemyIn = Math.min(1, enemyIn + dt * 3.2);
    enemyHit = Math.max(0, enemyHit - dt); recoil = Math.max(0, recoil - dt); shake = Math.max(0, shake - dt);
    const zone = ZONES[Math.floor((state.stage - 1) / 10) % ZONES.length];
    const u = unit();

    ctx.save();
    if (shake > 0) ctx.translate((Math.random() - 0.5) * shake * 14, (Math.random() - 0.5) * shake * 14);

    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, zone.top); g.addColorStop(1, zone.bottom);
    ctx.fillStyle = g; ctx.fillRect(-10, -10, w + 20, h + 20);

    ctx.fillStyle = zone.sun; ctx.globalAlpha = 0.9;
    ctx.beginPath(); ctx.arc(w * 0.82, h * 0.2, u * 0.45, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 0.18; ctx.beginPath(); ctx.arc(w * 0.82, h * 0.2, u * 0.8, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;

    for (const c of clouds) {
      const speed = 0.02 + c.layer * 0.035;
      c.x -= dt * speed; if (c.x < -0.25) { c.x = 1.2; c.y = 0.08 + Math.random() * 0.7; }
      const cs = u * (0.5 + c.layer * 0.35) * c.s;
      ctx.globalAlpha = 0.35 + c.layer * 0.2; ctx.fillStyle = zone.cloud;
      ctx.beginPath();
      ctx.ellipse(c.x * w, c.y * h, cs, cs * 0.34, 0, 0, Math.PI * 2);
      ctx.ellipse(c.x * w - cs * 0.45, c.y * h + cs * 0.1, cs * 0.6, cs * 0.26, 0, 0, Math.PI * 2);
      ctx.ellipse(c.x * w + cs * 0.4, c.y * h + cs * 0.08, cs * 0.55, cs * 0.24, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // colline in parallasse
    for (let layer = 0; layer < 2; layer++) {
      ctx.fillStyle = zone.hill; ctx.globalAlpha = layer ? 1 : 0.55;
      const off = time * (layer ? 60 : 28), base = h * (layer ? 0.97 : 0.92), amp = h * (layer ? 0.05 : 0.08);
      ctx.beginPath(); ctx.moveTo(0, h + 10);
      for (let x = 0; x <= w + 12; x += 12) {
        const k = (x + off) * (layer ? 0.012 : 0.007);
        ctx.lineTo(x, base - amp * (Math.sin(k) * 0.6 + Math.sin(k * 2.3 + 1) * 0.4 + 1) * 0.5);
      }
      ctx.lineTo(w + 12, h + 10); ctx.fill();
    }
    ctx.globalAlpha = 1;

    // gregari
    const p = playerPos();
    const hired = PILOTS.filter((x) => state.pilots[x.id] > 0);
    hired.forEach((pl, i) => {
      const row = Math.floor(i / 2) + 1, side = i % 2 ? 1 : -1;
      const x = p.x - row * u * 0.55, y = p.y + side * row * u * 0.42 + Math.sin(time * 2 + i) * 3;
      pl._x = x; pl._y = y;
      drawPlane(ctx, 'mono', pl.color, x, y, u * 0.5, time + i, 1);
    });
    wingTimer -= dt;
    if (hired.length && state.enemy && wingTimer <= 0) {
      wingTimer = Math.max(0.06, 0.4 / hired.length);
      const pl = hired[Math.floor(Math.random() * hired.length)], e = enemyPos();
      bullet({ x: pl._x + u * 0.25, y: pl._y }, { x: e.x + (Math.random() - 0.5) * u * 0.5, y: e.y + (Math.random() - 0.5) * u * 0.3 }, pl.color);
    }

    // giocatore
    const plane = AIRCRAFT.find((a) => a.id === state.aircraft.equipped);
    drawPlane(ctx, plane.shape, plane.color, p.x - (recoil > 0 ? 2 : 0), p.y, u, time, 1);

    // nemico
    if (state.enemy) {
      const e = enemyPos(), boss = state.enemy.boss;
      const ex = e.x + (enemyHit > 0 ? 3 : 0);
      if (boss) drawPlane(ctx, 'bomber', '#7f1d1d', ex, e.y, u * 1.9, time, -1, enemyHit > 0.06);
      else drawPlane(ctx, enemyShape(state.stage), enemyColor(state.stage), ex, e.y, u * 0.95, time, -1, enemyHit > 0.06);
    }

    // relitti
    for (const wr of fx.wrecks) {
      wr.life -= dt; wr.vy += 380 * dt; wr.y += wr.vy * dt; wr.x -= 40 * dt; wr.rot += dt * 1.6;
      ctx.save(); ctx.translate(wr.x, wr.y); ctx.rotate(wr.rot); ctx.globalAlpha = Math.max(0, Math.min(1, wr.life));
      drawPlane(ctx, wr.boss ? 'bomber' : wr.shape, '#3a3a3a', 0, 0, u * (wr.boss ? 1.9 : 0.95), 0, -1);
      ctx.restore();
      if (Math.random() < 0.6) fx.sparks.push({ x: wr.x, y: wr.y, vx: -20, vy: -50, life: 0.5, color: '#555' });
    }
    fx.wrecks = fx.wrecks.filter((x) => x.life > 0 && x.y < h + 80);

    // proiettili
    for (const b of fx.bullets) {
      b.p += dt * (b.rocket ? 5 : 9);
      const x = b.x0 + (b.x1 - b.x0) * b.p, y = b.y0 + (b.y1 - b.y0) * b.p;
      const tx = b.x0 + (b.x1 - b.x0) * Math.max(0, b.p - 0.25), ty = b.y0 + (b.y1 - b.y0) * Math.max(0, b.p - 0.25);
      ctx.strokeStyle = b.color; ctx.lineWidth = b.rocket ? 4 : 2; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(x, y); ctx.stroke();
    }
    fx.bullets = fx.bullets.filter((b) => b.p < 1);

    for (const s of fx.sparks) {
      s.life -= dt; s.x += s.vx * dt; s.y += s.vy * dt; s.vy += 160 * dt;
      ctx.globalAlpha = Math.max(0, s.life * 2); ctx.fillStyle = s.color;
      ctx.fillRect(s.x - 2, s.y - 2, 4, 4);
    }
    fx.sparks = fx.sparks.filter((s) => s.life > 0);
    ctx.globalAlpha = 1;

    ctx.textAlign = 'center';
    for (const tx of fx.texts) {
      tx.life -= dt; tx.x += tx.vx * dt; tx.y += tx.vy * dt;
      ctx.globalAlpha = Math.max(0, Math.min(1, tx.life * 2.5));
      ctx.font = `800 ${tx.size}px system-ui, sans-serif`;
      ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,.55)'; ctx.strokeText(tx.str, tx.x, tx.y);
      ctx.fillStyle = tx.color; ctx.fillText(tx.str, tx.x, tx.y);
    }
    fx.texts = fx.texts.filter((x) => x.life > 0);
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  resize();
  return { draw, onEvent, resize };
}

/**
 * Disegna un aereo di profilo. `size` è la lunghezza in pixel, `dir` 1 = verso destra, -1 = verso sinistra.
 */
export function drawPlane(ctx, shape, color, x, y, size, t = 0, dir = 1, flash = false) {
  const s = size / 100;
  ctx.save(); ctx.translate(x, y); ctx.scale(s * dir, s);
  const body = flash ? '#ffffff' : color, dark = flash ? '#ffffff' : shade(color, -0.35), light = flash ? '#ffffff' : shade(color, 0.3);
  const prop = shape !== 'jet' && shape !== 'stealth';
  ctx.lineJoin = 'round';

  if (shape === 'stealth') {
    flame(ctx, -46, 2, t);
    poly(ctx, dark, [[-48, 2], [-20, -10], [20, -8], [52, 2], [10, 9], [-30, 9]]);
    poly(ctx, body, [[-40, 3], [-6, -6], [30, -3], [52, 2], [8, 6]]);
    poly(ctx, '#9bd4ff', [[8, -6], [24, -5], [30, -1], [12, -1]]);
    poly(ctx, dark, [[-44, 0], [-34, -16], [-24, -8]]);
  } else if (shape === 'jet') {
    flame(ctx, -50, 0, t);
    poly(ctx, dark, [[-10, 2], [-34, 20], [-22, 20], [14, 4]]);
    poly(ctx, body, [[-50, -5], [20, -8], [54, 0], [20, 7], [-50, 5]]);
    poly(ctx, light, [[-50, -5], [20, -8], [40, -4], [-50, -1]]);
    poly(ctx, '#9bd4ff', [[10, -8], [22, -13], [34, -6], [30, -4]]);
    poly(ctx, dark, [[-48, -4], [-40, -24], [-30, -24], [-24, -6]]);
  } else if (shape === 'bomber') {
    poly(ctx, dark, [[-8, 4], [-30, 18], [-12, 18], [16, 6]]);
    ctx.fillStyle = body; ctx.beginPath(); ctx.ellipse(0, 0, 50, 9, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = light; ctx.beginPath(); ctx.ellipse(2, -3, 44, 4.5, 0, 0, Math.PI * 2); ctx.fill();
    poly(ctx, dark, [[-50, -2], [-46, -22], [-36, -22], [-28, -5]]);
    poly(ctx, '#ffd9a0', [[34, -6], [44, -4], [46, 0], [34, 0]]);
    for (const ex of [-2, 14]) {
      ctx.fillStyle = '#2b2b2b'; ctx.beginPath(); ctx.ellipse(ex, 9, 9, 4, 0, 0, Math.PI * 2); ctx.fill();
      propeller(ctx, ex + 9, 9, 9, t);
    }
    ctx.fillStyle = '#111'; for (const gx of [-20, -6, 8]) ctx.fillRect(gx, -1.5, 5, 3);
  } else {
    // biplano, monoplano, caccia a elica
    const len = shape === 'fighter' ? 50 : 44, fat = shape === 'biplane' ? 9 : shape === 'fighter' ? 7 : 8;
    poly(ctx, dark, [[-len + 2, -3], [-len - 2, -20], [-len + 10, -20], [-len + 20, -5]]);
    ctx.fillStyle = body; ctx.beginPath();
    ctx.moveTo(-len, -3); ctx.quadraticCurveTo(-10, -fat - 2, len - 10, -fat + 1);
    ctx.quadraticCurveTo(len, 0, len - 10, fat - 1); ctx.quadraticCurveTo(-10, fat + 1, -len, 2); ctx.closePath(); ctx.fill();
    ctx.fillStyle = light; ctx.beginPath();
    ctx.moveTo(-len + 6, -3); ctx.quadraticCurveTo(-10, -fat - 1, len - 12, -fat + 2); ctx.lineTo(len - 14, -2); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#9bd4ff'; ctx.beginPath(); ctx.ellipse(shape === 'fighter' ? 2 : 6, -fat + 0.5, shape === 'fighter' ? 11 : 7, 4.5, 0, Math.PI, 0); ctx.fill();
    if (shape === 'biplane') {
      ctx.strokeStyle = '#3b2f2f'; ctx.lineWidth = 1.6;
      for (const sx of [-2, 22]) { ctx.beginPath(); ctx.moveTo(sx, -19); ctx.lineTo(sx + 2, 9); ctx.stroke(); }
      rounded(ctx, dark, -10, -23, 42, 5); rounded(ctx, dark, -8, 8, 40, 5);
      ctx.strokeStyle = '#3b2f2f'; ctx.beginPath(); ctx.moveTo(14, 10); ctx.lineTo(18, 21); ctx.stroke();
      ctx.fillStyle = '#222'; ctx.beginPath(); ctx.arc(18, 22, 5, 0, Math.PI * 2); ctx.fill();
    } else {
      poly(ctx, dark, [[-12, 2], [-24, 14], [-6, 14], [22, 3]]);
    }
    ctx.fillStyle = '#2b2b2b'; ctx.beginPath(); ctx.ellipse(len - 6, 0, 5, fat - 2, 0, 0, Math.PI * 2); ctx.fill();
  }
  if (prop && shape !== 'bomber') propeller(ctx, shape === 'fighter' ? 50 : 44, 0, 17, t);
  ctx.restore();
}

function propeller(ctx, x, y, r, t) {
  ctx.fillStyle = 'rgba(255,255,255,.28)'; ctx.beginPath(); ctx.ellipse(x, y, 2.5, r, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = 'rgba(30,30,30,.7)'; ctx.lineWidth = 2;
  const a = Math.sin(t * 40) * r;
  ctx.beginPath(); ctx.moveTo(x, y - a); ctx.lineTo(x, y + a); ctx.stroke();
}
function flame(ctx, x, y, t) {
  const l = 14 + Math.sin(t * 50) * 5;
  poly(ctx, '#ffb703', [[x, y - 4], [x - l, y], [x, y + 4]]);
  poly(ctx, '#fff3b0', [[x, y - 2], [x - l * 0.55, y], [x, y + 2]]);
}
function poly(ctx, fill, pts) {
  ctx.fillStyle = fill; ctx.beginPath();
  pts.forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py)));
  ctx.closePath(); ctx.fill();
}
function rounded(ctx, fill, x, y, w, h) {
  ctx.fillStyle = fill; ctx.beginPath(); ctx.roundRect(x, y, w, h, h / 2); ctx.fill();
}
function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const ch = (v) => Math.max(0, Math.min(255, Math.round(amt < 0 ? v * (1 + amt) : v + (255 - v) * amt)));
  return `rgb(${ch(n >> 16)},${ch((n >> 8) & 255)},${ch(n & 255)})`;
}
