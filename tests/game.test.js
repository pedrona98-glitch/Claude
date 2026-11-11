import test from 'node:test';
import assert from 'node:assert/strict';
import * as G from '../src/game.js';
import { PILOTS, PRODUCTS, SLOTS, TIERS } from '../src/data.js';
import { fmt, fmtTime } from '../src/format.js';

const seq = (...vals) => { let i = 0; return () => vals[i++ % vals.length]; };

// Bot: costruisce in automatico, potenzia l'officina appena può, spende il resto in gregari.
function simulate(s, seconds, ref) {
  const dt = 0.1;
  for (let t = 0; t < seconds; t += dt) {
    ref.now += dt * 1000;
    G.tick(s, dt, ref.now);
    if (Math.random() < dt) G.tap(s, ref.now);
    const i = Math.round(t * 10);
    if (i % 3 === 0) G.autoBuild(s);
    if (s.farming && i % 600 === 0) G.challengeBoss(s);
    if (i % 20 === 0) {
      G.startWorkshopUpgrade(s, ref.now);
      const spare = s.coins - G.workshopCost(s.workshop.level + (s.workshop.upgradeEnd ? 1 : 0));
      const o = PILOTS.map((p) => ({ id: p.id, q: G.quote(s, p.id) })).filter((x) => x.q.cost <= spare).sort((a, b) => a.q.cost - b.q.cost);
      if (o.length) G.buyPilot(s, o[0].id);
    }
  }
}

test('progressione: avvio rapido, poi il ritmo lo dà l\'officina', () => {
  const s = G.newState(1e12), ref = { now: 1e12 };
  simulate(s, 120, ref); const at2 = s.stats.maxStage;
  simulate(s, 480, ref); const at10 = s.stats.maxStage;
  simulate(s, 3000, ref); const at60 = s.stats.maxStage;
  console.log({ at2: G.stageName(at2), at10: G.stageName(at10), at60: G.stageName(at60), workshop: s.workshop.level });
  assert.ok(at2 >= 8, `a 2 min: ${at2}`);
  assert.ok(at10 >= 25 && at10 <= 80, `a 10 min: ${at10}`);
  assert.ok(at60 > at10 && at60 <= 130, `a 60 min: ${at60}`);
  assert.ok(s.workshop.level >= 6);
  assert.equal(Object.keys(s.parts).length, SLOTS.length);
});

test('officina: costruire, montare o vendere', () => {
  const s = G.newState();
  const first = G.build(s, seq(0, 0, 0)); // slot 0, livello massimo, qualità comune
  assert.ok(first.equipped); assert.equal(s.parts.guns.lvl, G.partMaxLevel(1)); assert.equal(s.wrenches, 29);
  const base = G.shotDamage(s);
  const worse = G.build(s, seq(0, 0.99, 0.99, 0)); // stesso slot, livello più basso
  assert.equal(worse.equipped, false); assert.ok(s.pending); assert.equal(G.isUpgrade(s, s.pending), false);
  assert.equal(G.build(s), null); // prima va deciso il pezzo in attesa
  const sold = G.resolvePending(s, false);
  assert.ok(sold > 0); assert.equal(s.coins, sold); assert.equal(G.shotDamage(s), base);
  s.workshop.level = 12;
  const better = G.build(s, seq(0, 0, 0, 0.999, 0, 0.5));
  assert.ok(better.part.tier > 0 && better.part.sub); assert.ok(G.isUpgrade(s, s.pending));
  const old = G.partSell(s.parts.guns);
  assert.equal(G.resolvePending(s, true), old);
  assert.ok(G.shotDamage(s) > base * 5);
  s.wrenches = 0; assert.equal(G.build(s), null);
  s.wrenches = 50; for (let i = 0; i < 50; i++) G.autoBuild(s);
  assert.equal(s.wrenches, 0); assert.equal(s.pending, null); assert.equal(s.stats.builds, 53);
});

test('officina: probabilità per livello e potenziamento a tempo', () => {
  const low = G.tierOdds(1), high = G.tierOdds(24);
  assert.ok(Math.abs(low.reduce((a, b) => a + b) - 1) < 1e-9);
  assert.equal(low[2], 0); assert.ok(high[TIERS.length - 1] > 0); assert.ok(high[0] < low[0]);
  const s = G.newState(), now = 1e12;
  assert.equal(G.startWorkshopUpgrade(s, now), false); // niente monete
  s.coins = 100; s.gems = 10;
  assert.ok(G.startWorkshopUpgrade(s, now)); assert.equal(s.coins, 40);
  assert.equal(G.startWorkshopUpgrade(s, now), false); // già in corso
  assert.equal(G.finishWorkshopUpgrade(s, now + 19e3), false);
  G.tick(s, 0.1, now + 21e3); assert.equal(s.workshop.level, 2);
  s.coins = 1e6; s.workshop.level = 12; G.startWorkshopUpgrade(s, now);
  const before = s.workshop.upgradeEnd; G.speedWorkshopUpgrade(s, 600, now);
  assert.equal(s.workshop.upgradeEnd, before - 600e3);
  const gems = G.skipGems(s, now); assert.ok(gems > 10); assert.equal(G.skipWorkshopUpgrade(s, now), false);
  s.gems = gems; assert.ok(G.skipWorkshopUpgrade(s, now)); assert.equal(s.workshop.level, 13); assert.equal(s.gems, 0);
});

test('missioni: capitoli, boss, vita che si ricarica, ritirata', () => {
  assert.equal(G.stageName(1), '1-1'); assert.equal(G.stageName(10), '1-10'); assert.equal(G.stageName(94), '10-4');
  assert.ok(G.isBoss(10) && !G.isBoss(9));
  const s = G.newState(); s.stage = 25; // troppo avanti per un aereo senza pezzi
  const ev = [];
  for (let i = 0; i < 600 && !ev.some((e) => e.t === 'defeat'); i++) G.tick(s, 0.1, 1e12, ev);
  assert.ok(ev.some((e) => e.t === 'defeat'));
  assert.equal(s.stage, 24); assert.ok(s.farming); assert.equal(s.hp, G.squadMaxHp(s));
  const strong = G.newState(); strong.workshop.level = 10; strong.wrenches = 200;
  for (let i = 0; i < 200; i++) G.autoBuild(strong);
  const w = strong.wrenches;
  G.tick(strong, 0.1, 1e12); G.tick(strong, 0.1, 1e12);
  assert.ok(strong.hp < G.squadMaxHp(strong));
  for (let i = 0; i < 300 && strong.stage === 1; i++) G.tick(strong, 0.1, 1e12);
  assert.equal(strong.stage, 2); assert.equal(strong.hp, G.squadMaxHp(strong)); assert.equal(strong.wrenches, w + 3);
  strong.stage = 10; strong.enemy = null; strong.kills = 0;
  for (let i = 0; i < 300 && strong.stage === 10; i++) G.tick(strong, 0.1, 1e12);
  assert.equal(strong.stage, 11); assert.equal(strong.gems, 2); assert.equal(strong.stats.bosses, 1);
  // boss fuggito: si torna alla missione precedente in pattuglia
  const weak = G.newState(); weak.stage = 10; weak.parts.hull = { slot: 'hull', lvl: 60, tier: 0 };
  const ev2 = []; for (let i = 0; i < 400; i++) G.tick(weak, 0.1, 1e12, ev2);
  assert.ok(ev2.some((e) => e.t === 'bossFail')); assert.equal(weak.stage, 9); assert.ok(weak.farming);
  assert.ok(G.challengeBoss(weak)); assert.equal(weak.stage, 10);
});

test('gregari: bonus percentuale e acquisti in blocco', () => {
  const s = G.newState(); s.coins = 1e6; s.buyMode = 10;
  const dps = G.totalDps(s), hp = G.squadMaxHp(s);
  let sum = 0; for (let l = 0; l < 10; l++) sum += G.pilotCost('falco', l);
  const q = G.quote(s, 'falco'); assert.equal(q.n, 10); assert.ok(Math.abs(q.cost - sum) <= 10);
  assert.ok(G.buyPilot(s, 'falco'));
  assert.ok(Math.abs(G.totalDps(s) / dps - 1.3) < 1e-9); assert.ok(Math.abs(G.squadMaxHp(s) / hp - 1.3) < 1e-9);
  s.buyMode = 'max'; s.coins = 5000; const m = G.quote(s, 'vespa');
  assert.ok(m.cost <= 5000 && m.n > 1); assert.ok(G.buyPilot(s, 'vespa')); assert.ok(s.coins >= 0);
});

test('offline, boost, premio giornaliero, prodotti, salvataggio', () => {
  const now = 1e12, s = G.newState(now);
  s.parts.guns = { slot: 'guns', lvl: 20, tier: 2, sub: 'coins', val: 9 };
  const a = G.offlineEarnings(s, 3600, now), b = G.offlineEarnings(s, 99 * 3600, now);
  assert.equal(b.secs, 4 * 3600); assert.ok(b.coins > a.coins && a.coins > 0); assert.equal(a.wrenches, 15);
  const base = G.coinMult(s, now); assert.ok(Math.abs(base - 1.09) < 1e-9); G.addBoost(s, 900, now);
  assert.equal(G.coinMult(s, now), base * 2); assert.equal(G.coinMult(s, now + 901e3), base);
  for (let i = 0; i < 20; i++) G.addBoost(s, 900, now);
  assert.equal(s.boostUntil, now + 7200e3);
  assert.equal(G.claimDaily(s, now), 5); assert.equal(G.claimDaily(s, now), 0); assert.equal(s.wrenches, 50);
  const starter = PRODUCTS.find((p) => p.id === 'starter_pack');
  assert.ok(G.grantProduct(s, starter, now)); assert.equal(s.gems, 305); assert.equal(s.wrenches, 250);
  assert.equal(G.grantProduct(s, starter, now), false);
  s.stage = 10; s.enemy = { hp: 1, maxHp: 1, boss: true }; s.pending = { slot: 'hull', lvl: 3, tier: 0 };
  const back = G.loadState(JSON.parse(JSON.stringify(G.serialize(s))), now);
  assert.equal(back.stage, 9); assert.ok(back.farming); assert.equal(back.gems, 305);
  assert.deepEqual(back.parts.guns, s.parts.guns); assert.deepEqual(back.pending, s.pending); assert.equal(back.enemy, null);
  // salvataggio della versione precedente: restano gemme, aerei e acquisti, il resto riparte
  const old = G.loadState({ v: 1, coins: 9e9, gems: 77, stage: 40, medals: 3, aircraft: { owned: ['libellula', 'rondine'], equipped: 'rondine' }, perks: { noAds: true } });
  assert.equal(old.gems, 77); assert.equal(old.coins, 0); assert.equal(old.stage, 1); assert.equal(old.aircraft.equipped, 'rondine'); assert.ok(old.perks.noAds);
  const bad = G.loadState({ v: 2, coins: 'x', stage: -3, aircraft: { equipped: 'boh' }, parts: { guns: { slot: 'guns' }, nope: {} } });
  assert.equal(bad.aircraft.equipped, 'libellula'); assert.deepEqual(bad.parts, {});
});

test('formattazione numeri', () => {
  assert.equal(fmt(999), '999'); assert.equal(fmt(1500), '1.50K'); assert.equal(fmt(999999), '1.00M');
  assert.equal(fmt(1e15), '1.00aa'); assert.equal(fmtTime(3725), '1h 02m'); assert.equal(fmtTime(75), '1m 15s');
});
