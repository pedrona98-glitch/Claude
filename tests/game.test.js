import test from 'node:test';
import assert from 'node:assert/strict';
import * as G from '../src/game.js';
import { PILOTS, UPGRADES, PRODUCTS } from '../src/data.js';
import { fmt, fmtTime } from '../src/format.js';

// Bot avido: compra sempre l'acquisto più conveniente, tocca 3 volte al secondo.
function simulate(s, seconds, { taps = 3 } = {}) {
  let now = 1e12;
  const dt = 0.1;
  for (let t = 0; t < seconds; t += dt) {
    now += dt * 1000;
    G.tick(s, dt, now);
    if (Math.random() < taps * dt) G.tap(s, now);
    if (s.farming && Math.round(t * 10) % 1200 === 0) G.challengeBoss(s);
    if (Math.round(t * 10) % 10 === 0) {
      for (let i = 0; i < 20; i++) {
        const opts = [...UPGRADES.map((u) => ['up', u.id]), ...PILOTS.map((p) => ['pilot', p.id])]
          .map(([k, id]) => ({ k, id, q: G.quote(s, k, id) })).filter((o) => o.q.n && o.q.cost <= s.coins)
          .sort((a, b) => a.q.cost - b.q.cost);
        if (!opts.length || !G.buy(s, opts[opts.length - 1].k, opts[opts.length - 1].id)) break;
      }
    }
  }
  return now;
}

test('progressione: i primi minuti scorrono, poi arriva il muro', () => {
  const s = G.newState();
  simulate(s, 120);
  const at2 = s.stats.maxStage;
  simulate(s, 480);
  const at10 = s.stats.maxStage;
  simulate(s, 3000);
  const at60 = s.stats.maxStage;
  console.log({ at2, at10, at60, medals: G.medalsOnPrestige(s) });
  assert.ok(at2 >= 4, `stage a 2 min: ${at2}`);
  assert.ok(at10 >= 15 && at10 <= 60, `stage a 10 min: ${at10}`);
  assert.ok(at60 >= 30 && at60 <= 150, `stage a 60 min: ${at60}`);
  assert.ok(G.medalsOnPrestige(s) > 0);
});

test('prestigio azzera la corsa ma conserva i progressi permanenti', () => {
  const s = G.newState();
  s.stats.runMaxStage = 50; s.stage = 50; s.coins = 1e9; s.gems = 7; s.up.cannon = 80; s.pilots.falco = 30;
  const gain = G.prestige(s);
  assert.equal(gain, 17);
  assert.equal(s.medals, 17);
  assert.equal(s.stage, 1); assert.equal(s.coins, 0); assert.equal(s.up.cannon, 1);
  assert.deepEqual(s.pilots, {}); assert.equal(s.gems, 7);
  assert.ok(Math.abs(G.medalBonus(s) - 2.7) < 1e-9);
  assert.equal(G.prestige(s), 0);
});

test('acquisti in blocco: il costo coincide con la somma dei singoli', () => {
  const s = G.newState(); s.coins = 1e6; s.buyMode = 10;
  let sum = 0; for (let l = 1; l < 11; l++) sum += G.upgradeCost('cannon', l);
  const q = G.quote(s, 'up', 'cannon');
  assert.equal(q.n, 10); assert.ok(Math.abs(q.cost - sum) <= 10);
  s.buyMode = 'max'; s.coins = 5000;
  const m = G.quote(s, 'pilot', 'falco');
  assert.ok(m.cost <= 5000 && m.n > 1);
  assert.ok(G.buy(s, 'pilot', 'falco')); assert.ok(s.coins >= 0);
  s.up.rate = 40; assert.ok(G.quote(s, 'up', 'rate').maxed);
});

test('boss fallito: si torna allo stage precedente in farming', () => {
  const s = G.newState(); s.stage = 5;
  const ev = [];
  for (let i = 0; i < 400; i++) G.tick(s, 0.1, 1e12, ev);
  assert.ok(ev.some((e) => e.t === 'bossFail'));
  assert.equal(s.stage, 4); assert.ok(s.farming);
  const k = s.stats.kills; for (let i = 0; i < 2000; i++) G.tick(s, 0.1, 1e12);
  assert.ok(s.stats.kills > k); assert.equal(s.stage, 4);
  assert.ok(G.challengeBoss(s)); assert.equal(s.stage, 5);
});

test('offline, boost, premio giornaliero, prodotti, salvataggio', () => {
  const now = 1e12, s = G.newState(now);
  s.pilots.falco = 10;
  const a = G.offlineEarnings(s, 3600, now), b = G.offlineEarnings(s, 99 * 3600, now);
  assert.equal(b.secs, 7200); assert.ok(b.coins > a.coins && a.coins > 0);
  const base = G.coinMult(s, now); G.addBoost(s, 900, now);
  assert.equal(G.coinMult(s, now), base * 2); assert.equal(G.coinMult(s, now + 901e3), base);
  for (let i = 0; i < 20; i++) G.addBoost(s, 900, now);
  assert.equal(s.boostUntil, now + 7200e3);
  assert.equal(G.claimDaily(s, now), 5); assert.equal(G.claimDaily(s, now), 0);
  assert.equal(G.claimDaily(s, now + 86400e3), 5);
  const starter = PRODUCTS.find((p) => p.id === 'starter_pack');
  const g = s.gems; assert.ok(G.grantProduct(s, starter, now)); assert.equal(s.gems, g + 300);
  assert.equal(G.grantProduct(s, starter, now), false);
  s.stage = 10; s.enemy = { hp: 1, maxHp: 1, boss: true };
  const back = G.loadState(JSON.parse(JSON.stringify(G.serialize(s))), now);
  assert.equal(back.stage, 9); assert.ok(back.farming); assert.equal(back.gems, s.gems);
  assert.equal(back.pilots.falco, 10); assert.equal(back.enemy, null);
  assert.equal(G.loadState({ coins: 'x', stage: -3, aircraft: { equipped: 'boh' } }).aircraft.equipped, 'libellula');
});

test('formattazione numeri', () => {
  assert.equal(fmt(999), '999'); assert.equal(fmt(1500), '1.50K'); assert.equal(fmt(999999), '1.00M');
  assert.equal(fmt(1e15), '1.00aa'); assert.equal(fmtTime(3725), '1h 02m'); assert.equal(fmtTime(75), '1m 15s');
});
