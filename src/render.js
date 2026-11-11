// Scena di battaglia su canvas. Tutta la grafica è disegnata a mano: nessuna immagine esterna.
import { PILOTS, AIRCRAFT } from './data.js';
import { fmt } from './format.js';
import { squadMaxHp } from './game.js';

const ZONES = [
  { sky: ['#274b7a', '#5f8fc4', '#dfe9f2'], hill: '#2c4a63', haze: '#c9d9e8', cloud: '#ffffff', sun: '#fff6d8' }, // mattino
  { sky: ['#2a2f5b', '#a25f76', '#f3c69a'], hill: '#3a2c48', haze: '#e9b79a', cloud: '#ffe3cf', sun: '#ffe2a8' }, // tramonto
  { sky: ['#070b1a', '#16224a', '#3d4f86'], hill: '#0c1228', haze: '#3d4f86', cloud: '#8794c4', sun: '#eef1ff' }, // notte
  { sky: ['#2c3440', '#5d6b7b', '#b4bfca'], hill: '#232b35', haze: '#9aa7b4', cloud: '#e4e9ee', sun: '#f4f6f8' }, // tempesta
  { sky: ['#5a2f1c', '#c9824a', '#f6dfae'], hill: '#5b3520', haze: '#e6bd86', cloud: '#fff3df', sun: '#fffaf0' }, // deserto
  { sky: ['#06231f', '#1c6a62', '#b8ead3'], hill: '#0b2f2b', haze: '#7fcbb5', cloud: '#e9fbf3', sun: '#f7fbdc' }, // aurora
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
  let enemyIn = 0, enemyHit = 0, shake = 0, wingTimer = 0, recoil = 0, foeTimer = 0, hurt = 0;

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
      bullet({ x: p.x + u * 0.5, y: p.y }, to, ev.t === 'tap' ? '#f2b866' : '#fff6d8', ev.t === 'tap');
      enemyHit = 0.12; recoil = 0.08;
      text(fmt(ev.dmg), to.x, to.y - u * 0.3, ev.crit ? '#f2c86b' : '#ffffff', ev.crit ? 18 : 12);
      burst(to.x, to.y, ev.crit ? 7 : 3, ev.crit ? '#f2c86b' : '#ffffff', 90);
    } else if (ev.t === 'kill') {
      burst(e.x, e.y, ev.boss ? 60 : 22, '#f2b866', ev.boss ? 260 : 170);
      burst(e.x, e.y, ev.boss ? 30 : 10, '#4a4a4a', 90);
      fx.wrecks.push({ x: e.x, y: e.y, vy: -30, rot: 0, boss: ev.boss, shape: enemyShape(state.stage), color: enemyColor(state.stage), life: 1.4 });
      text('+' + fmt(ev.coins), e.x, e.y - u * 0.6, '#e9c877', ev.boss ? 20 : 15);
      shake = ev.boss ? 0.5 : 0.12;
    } else if (ev.t === 'bossFail') { enemyIn = 0; }
    else if (ev.t === 'defeat') { enemyIn = 0; hurt = 1; shake = 0.5; burst(p.x, p.y, 40, '#e5687a', 220); burst(p.x, p.y, 20, '#3a3a3a', 100); }
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
    g.addColorStop(0, zone.sky[0]); g.addColorStop(0.55, zone.sky[1]); g.addColorStop(1, zone.sky[2]);
    ctx.fillStyle = g; ctx.fillRect(-10, -10, w + 20, h + 20);

    // sole con alone morbido
    const sx = w * 0.8, sy = h * 0.3;
    const glow = ctx.createRadialGradient(sx, sy, 0, sx, sy, u * 2.6);
    glow.addColorStop(0, hexA(zone.sun, 0.55)); glow.addColorStop(0.25, hexA(zone.sun, 0.22)); glow.addColorStop(1, hexA(zone.sun, 0));
    ctx.fillStyle = glow; ctx.fillRect(sx - u * 2.6, sy - u * 2.6, u * 5.2, u * 5.2);
    ctx.fillStyle = zone.sun; ctx.beginPath(); ctx.arc(sx, sy, u * 0.24, 0, Math.PI * 2); ctx.fill();

    // nuvole sfumate su tre piani
    for (const c of clouds) {
      c.x -= dt * (0.012 + c.layer * 0.022); if (c.x < -0.3) { c.x = 1.3; c.y = 0.12 + Math.random() * 0.6; }
      const cs = u * (0.8 + c.layer * 0.5) * c.s, cx = c.x * w, cy = c.y * h;
      ctx.globalAlpha = 0.16 + c.layer * 0.12;
      for (const [ox, oy, k] of [[0, 0, 1], [-0.7, 0.12, 0.7], [0.65, 0.1, 0.75], [0.1, -0.18, 0.6]]) {
        const r = cs * k, px = cx + ox * cs, py = cy + oy * cs * 0.6;
        const cg = ctx.createRadialGradient(px, py, 0, px, py, r);
        cg.addColorStop(0, zone.cloud); cg.addColorStop(1, hexA(zone.cloud, 0));
        ctx.fillStyle = cg; ctx.save(); ctx.translate(px, py); ctx.scale(1, 0.42); ctx.translate(-px, -py);
        ctx.beginPath(); ctx.arc(px, py, r, 0, Math.PI * 2); ctx.fill(); ctx.restore();
      }
    }
    ctx.globalAlpha = 1;

    // rilievi lontani nella foschia
    for (let layer = 0; layer < 3; layer++) {
      const off = time * (10 + layer * 22), base = h * (0.9 + layer * 0.035), amp = h * (0.1 - layer * 0.02);
      const hg = ctx.createLinearGradient(0, base - amp, 0, h);
      hg.addColorStop(0, mix(zone.hill, zone.haze, 0.62 - layer * 0.28)); hg.addColorStop(1, mix(zone.hill, zone.haze, 0.3 - layer * 0.14));
      ctx.fillStyle = hg;
      ctx.beginPath(); ctx.moveTo(-10, h + 10);
      for (let x = -10; x <= w + 12; x += 10) {
        const k = (x + off) * (0.006 + layer * 0.004);
        ctx.lineTo(x, base - amp * (Math.sin(k) * 0.55 + Math.sin(k * 2.7 + layer) * 0.3 + Math.sin(k * 0.4 + 2) * 0.15 + 1) * 0.5);
      }
      ctx.lineTo(w + 12, h + 10); ctx.fill();
    }

    // scie
    const trail = playerPos();
    const tg = ctx.createLinearGradient(trail.x - u * 2.4, 0, trail.x - u * 0.4, 0);
    tg.addColorStop(0, 'rgba(255,255,255,0)'); tg.addColorStop(1, 'rgba(255,255,255,.28)');
    ctx.strokeStyle = tg; ctx.lineWidth = 1.5; ctx.lineCap = 'round';
    for (const dy of [-0.05, 0.07]) { ctx.beginPath(); ctx.moveTo(trail.x - u * 2.4, trail.y + u * dy + Math.sin(time * 2) * 2); ctx.lineTo(trail.x - u * 0.4, trail.y + u * dy); ctx.stroke(); }

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

    // fuoco nemico
    foeTimer -= dt; hurt = Math.max(0, hurt - dt * 1.5);
    if (state.enemy && enemyIn >= 1 && foeTimer <= 0) {
      foeTimer = state.enemy.boss ? 0.22 : 0.6;
      const e = enemyPos();
      bullet({ x: e.x - u * 0.45, y: e.y }, { x: p.x + (Math.random() - 0.3) * u * 0.6, y: p.y + (Math.random() - 0.5) * u * 0.3 }, '#ff8f9c');
    }

    // giocatore
    const plane = AIRCRAFT.find((a) => a.id === state.aircraft.equipped);
    drawPlane(ctx, plane.shape, plane.color, p.x - (recoil > 0 ? 2 : 0), p.y, u, time, 1);

    // nemico
    if (state.enemy) {
      const e = enemyPos(), boss = state.enemy.boss;
      const ex = e.x + (enemyHit > 0 ? 3 : 0);
      if (boss) drawPlane(ctx, 'bomber', '#6e2530', ex, e.y, u * 1.9, time, -1, enemyHit > 0.06);
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
      const bg = ctx.createLinearGradient(tx, ty, x, y);
      bg.addColorStop(0, hexA(b.color, 0)); bg.addColorStop(1, b.color);
      ctx.strokeStyle = bg; ctx.lineWidth = b.rocket ? 3 : 1.6; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(x, y); ctx.stroke();
    }
    fx.bullets = fx.bullets.filter((b) => b.p < 1);

    for (const s of fx.sparks) {
      s.life -= dt; s.x += s.vx * dt; s.y += s.vy * dt; s.vy += 160 * dt;
      ctx.globalAlpha = Math.max(0, s.life * 2); ctx.fillStyle = s.color;
      ctx.beginPath(); ctx.arc(s.x, s.y, 1.2 + s.life * 2.5, 0, Math.PI * 2); ctx.fill();
    }
    fx.sparks = fx.sparks.filter((s) => s.life > 0);
    ctx.globalAlpha = 1;

    ctx.textAlign = 'center';
    for (const tx of fx.texts) {
      tx.life -= dt; tx.x += tx.vx * dt; tx.y += tx.vy * dt;
      ctx.globalAlpha = Math.max(0, Math.min(1, tx.life * 2.5));
      ctx.font = `700 ${tx.size}px "Barlow Condensed", system-ui, sans-serif`;
      ctx.lineWidth = 2.5; ctx.strokeStyle = 'rgba(8,14,26,.6)'; ctx.strokeText(tx.str, tx.x, tx.y);
      ctx.fillStyle = tx.color; ctx.fillText(tx.str, tx.x, tx.y);
    }
    fx.texts = fx.texts.filter((x) => x.life > 0);
    ctx.globalAlpha = 1;
    ctx.restore();

    // vignetta; rossa quando la squadriglia è in pericolo
    const max = squadMaxHp(state), danger = Math.max(hurt, state.hp > 0 && state.hp / max < 0.3 ? 0.5 + 0.2 * Math.sin(time * 6) : 0);
    const vg = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.45, w / 2, h / 2, Math.max(w, h) * 0.75);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, danger ? `rgba(200,50,70,${0.45 * danger})` : 'rgba(6,10,20,.38)');
    ctx.fillStyle = vg; ctx.fillRect(0, 0, w, h);
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
  ctx.shadowColor = 'rgba(6,10,20,.35)'; ctx.shadowBlur = 10 * s; ctx.shadowOffsetY = 5 * s;
  const lg = ctx.createLinearGradient(0, -12, 0, 12);
  lg.addColorStop(0, shade(color, 0.28)); lg.addColorStop(0.55, color); lg.addColorStop(1, shade(color, -0.3));
  const body = flash ? '#ffffff' : lg, dark = flash ? '#ffffff' : shade(color, -0.42), light = flash ? '#ffffff' : 'rgba(255,255,255,.22)';
  const prop = shape !== 'jet' && shape !== 'stealth';
  ctx.lineJoin = 'round';

  if (shape === 'stealth') {
    flame(ctx, -46, 2, t);
    poly(ctx, dark, [[-48, 2], [-20, -10], [20, -8], [52, 2], [10, 9], [-30, 9]]);
    poly(ctx, body, [[-40, 3], [-6, -6], [30, -3], [52, 2], [8, 6]]);
    poly(ctx, '#bfe3f5', [[8, -6], [24, -5], [30, -1], [12, -1]]);
    poly(ctx, dark, [[-44, 0], [-34, -16], [-24, -8]]);
  } else if (shape === 'jet') {
    flame(ctx, -50, 0, t);
    poly(ctx, dark, [[-10, 2], [-34, 20], [-22, 20], [14, 4]]);
    poly(ctx, body, [[-50, -5], [20, -8], [54, 0], [20, 7], [-50, 5]]);
    poly(ctx, light, [[-50, -5], [20, -8], [40, -4], [-50, -1]]);
    poly(ctx, '#bfe3f5', [[10, -8], [22, -13], [34, -6], [30, -4]]);
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
    ctx.fillStyle = '#bfe3f5'; ctx.beginPath(); ctx.ellipse(shape === 'fighter' ? 2 : 6, -fat + 0.5, shape === 'fighter' ? 11 : 7, 4.5, 0, Math.PI, 0); ctx.fill();
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

function hexA(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`;
}
function mix(a, b, k) {
  const x = parseInt(a.slice(1), 16), y = parseInt(b.slice(1), 16);
  const ch = (sh) => Math.round(((x >> sh) & 255) * (1 - k) + ((y >> sh) & 255) * k);
  return `rgb(${ch(16)},${ch(8)},${ch(0)})`;
}
