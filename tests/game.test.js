import test from 'node:test';
import assert from 'node:assert/strict';
import * as G from '../src/game.js';
import { PRODUCTS, SLOTS, UNLOCKS, DUNGEONS } from '../src/data.js';
import { FORGE_ODDS, FORGE_UPGRADES } from '../src/tables.js';
import { fmt, fmtTime } from '../src/format.js';

const seq = (...vals) => { let i = 0; return () => vals[i++ % vals.length]; };
const NOW = Date.UTC(2026, 10, 10, 12);
const unlockAll = (s) => { s.stats.maxStage = 400; };

test('tabelle: le probabilità dell\'officina sommano a 100 a ogni livello', () => {
  assert.equal(FORGE_ODDS.length, 35);
  for (const row of FORGE_ODDS) assert.ok(Math.abs(row.reduce((a, b) => a + b, 0) - 100) < 0.05, row.join(','));
  assert.equal(FORGE_UPGRADES[0][0], 400); assert.equal(FORGE_UPGRADES[5][2], 7 * 3600 + 33 * 60);
});

test('officina: costruire, montare o vendere; livello del pezzo legato all\'officina', () => {
  const s = G.newState(NOW);
  const [first] = G.build(s, seq(0, 0, 0, 0)); // epoca 0, livello massimo, slot 0
  assert.ok(first.equipped); assert.equal(s.parts.guns.lvl, G.maxPartLevel(s)); assert.equal(s.wrenches, 39);
  const base = G.stats(s).atk;
  G.build(s, seq(0.5, 0, 0.99, 0)); // stesso slot, livello più basso
  assert.equal(s.pending.length, 1); assert.equal(G.isUpgrade(s, s.pending[0]), false);
  assert.deepEqual(G.build(s), []); // prima va deciso il pezzo in attesa
  const sold = G.resolvePending(s, false);
  assert.equal(sold, G.partSell(s, { lvl: s.parts.guns.lvl - 5 })); assert.equal(G.stats(s).atk, base);
  s.forge.level = 12; // a questo livello esistono le epoche 1..4
  G.build(s, seq(0, 0.999, 0, 0, 0.5, 0.5));
  const p = s.pending[0];
  assert.equal(p.age, 4); assert.equal(p.subs.length, 1); assert.ok(p.lvl >= 1 && p.lvl <= G.maxPartLevel(s));
  G.resolvePending(s, true);
  assert.ok(G.stats(s).atk > base * 10);
  s.wrenches = 0; assert.deepEqual(G.build(s), []);
});

test('officina: a rate, poi a tempo; costruzione multipla e automatica', () => {
  const s = G.newState(NOW);
  assert.equal(G.payForge(s, NOW), false); // niente monete
  s.coins = 1000;
  assert.ok(G.payForge(s, NOW)); assert.equal(s.coins, 600); assert.equal(s.forge.end, NOW + 300e3);
  assert.equal(G.payForge(s, NOW), false);
  G.tick(s, 0.1, NOW + 299e3); assert.equal(s.forge.level, 1);
  G.tick(s, 0.1, NOW + 301e3); assert.equal(s.forge.level, 2); assert.equal(s.stats.forgeLevel, 2);
  s.forge.level = 9; s.coins = 1e6; // 50k × 3 rate
  assert.ok(G.payForge(s, NOW)); assert.equal(s.forge.end, 0); assert.ok(G.payForge(s, NOW)); assert.ok(G.payForge(s, NOW));
  assert.ok(s.forge.end > NOW); assert.equal(s.coins, 1e6 - 150000);
  s.gems = 1000; const g = G.skipGems(s.forge.end, NOW);
  assert.ok(G.speedUp(s, 'forge', NOW, { gems: true })); assert.equal(s.forge.level, 10); assert.equal(s.gems, 1000 - g);
  // costruzione multipla dopo 5-15, automatica che si ferma su un'epoca alta
  s.stats.maxStage = UNLOCKS.forge2; s.wrenches = 10;
  assert.equal(G.forgeBatch(s), 2);
  s.parts = {}; assert.equal(G.build(s).length, 2);
  s.pending = []; for (const sl of SLOTS) s.parts[sl.id] = { slot: sl.id, age: 9, lvl: 200, subs: [] };
  s.auto = { on: true, stopAge: 3 }; s.wrenches = 50;
  for (let i = 0; i < 50 && s.auto.on; i++) G.autoBuild(s);
  assert.equal(s.auto.on, false); assert.ok(s.pending[0].age >= 3);
});

test('missioni: capitoli da 20, tre ondate, vita, ritirata, sblocchi con regalo', () => {
  assert.equal(G.stageName(1), '1-1'); assert.equal(G.stageName(20), '1-20'); assert.equal(G.stageName(169), '9-9');
  assert.ok(G.enemyStats(20, 2).boss && G.enemyStats(19, 2).leader && !G.enemyStats(20, 0).boss);
  const s = G.newState(NOW); s.stage = 40;
  const ev = [];
  for (let i = 0; i < 2000 && !ev.some((e) => e.t === 'defeat'); i++) G.tick(s, 0.1, NOW, ev);
  assert.ok(ev.some((e) => e.t === 'defeat')); assert.equal(s.stage, 39); assert.ok(s.farming);
  const strong = G.newState(NOW);
  for (const sl of SLOTS) strong.parts[sl.id] = { slot: sl.id, age: 3, lvl: 30, subs: [] };
  strong.stage = UNLOCKS.maneuvers - 1; strong.stats.maxStage = strong.stage;
  const ev2 = [];
  for (let i = 0; i < 3000 && strong.stage < UNLOCKS.maneuvers; i++) G.tick(strong, 0.1, NOW, ev2);
  assert.equal(strong.stage, UNLOCKS.maneuvers);
  assert.ok(ev2.some((e) => e.t === 'wave') && ev2.some((e) => e.t === 'clear'));
  assert.ok(ev2.some((e) => e.t === 'unlock' && e.key === 'maneuvers')); assert.equal(strong.plans, 10);
});

test('dungeon: chiave consumata solo vincendo, sweep, ricompense, ricarica giornaliera', () => {
  const s = G.newState(NOW);
  assert.equal(G.runDungeon(s, 'thief', 1), null); // bloccato
  unlockAll(s);
  const lose = G.runDungeon(s, 'thief', 1);
  assert.equal(lose.win, false); assert.equal(s.keys.thief, 2);
  for (const sl of SLOTS) s.parts[sl.id] = { slot: sl.id, age: 6, lvl: 60, subs: [] };
  assert.equal(G.runDungeon(s, 'thief', 3), null); // si sale un livello alla volta
  const win = G.runDungeon(s, 'thief', 1);
  assert.ok(win.win); assert.equal(s.keys.thief, 1); assert.equal(s.dungeons.thief, 1);
  assert.ok(win.reward.wrenches > 0 && win.reward.coins > 0);
  const sweep = G.runDungeon(s, 'thief', 0, { sweep: true }); assert.equal(sweep.level, 1); assert.equal(s.keys.thief, 0);
  assert.equal(G.runDungeon(s, 'thief', 2), null);
  G.tick(s, 0.1, NOW + 86400e3); assert.equal(s.keys.thief, 2);
  const inv = G.runDungeon(s, 'invasion', 1, { rnd: () => 0 });
  assert.deepEqual(inv.reward.crates, [0]); assert.deepEqual(s.drones.crates, [0]);
  assert.ok(G.runDungeon(s, 'ghost', 1).reward.plans >= 5); assert.ok(G.runDungeon(s, 'swarm', 1).reward.blueprints >= 60);
  assert.equal(DUNGEONS.length, 4);
});

test('droni: casse a tempo, nuovo drone o fusione, posti limitati', () => {
  const s = G.newState(NOW); unlockAll(s);
  s.drones.crates = [0, 0, 1];
  assert.ok(G.startCrate(s, 0, NOW)); assert.ok(G.startCrate(s, 0, NOW)); assert.equal(G.startCrate(s, 0, NOW), false);
  assert.equal(G.openCrate(s, 0, NOW + 1000), null);
  const a = G.openCrate(s, 0, NOW + 1800e3, () => 0);
  assert.equal(a.id, 'grillo'); assert.equal(a.merged, false); assert.deepEqual(s.drones.eq, ['grillo']);
  const b = G.openCrate(s, 0, NOW + 1800e3, () => 0);
  assert.ok(b.merged); assert.equal(s.drones.own.grillo, 2);
  const hp0 = G.stats(G.newState(NOW)).hp; assert.ok(G.stats(s).hp > hp0);
  s.gems = 999; assert.ok(G.startCrate(s, 0, NOW)); assert.ok(G.speedUp(s, 0, NOW, { gems: true }));
  assert.ok(G.openCrate(s, 0, NOW));
  assert.equal(G.droneSlots(s), 3);
});

test('manovre ed emblemi: reclutamento con livelli, effetti in battaglia', () => {
  const s = G.newState(NOW); unlockAll(s);
  s.plans = 25;
  const got = G.summonManeuvers(s, 10, () => 0);
  assert.equal(got.length, 10); assert.equal(s.maneuvers.level, 2); assert.equal(s.maneuvers.own.burst, 10);
  assert.equal(G.summonManeuvers(s, 20), null);
  s.enemy = { hp: 1e9, maxHp: 1e9, atk: 0 }; s.hp = 100;
  const ev = []; assert.ok(G.cast(s, 'burst', NOW, ev)); assert.equal(G.cast(s, 'burst', NOW, ev), false);
  assert.ok(ev.some((e) => e.t === 'skill' && e.dmg > G.stats(s).atk * 3));
  s.paint = 100;
  const e1 = G.summonEmblem(s, () => 0);
  assert.equal(e1[0].r, 0); assert.equal(s.emblems.eq, e1[0].id); assert.equal(s.paint, 50);
  const before = G.stats(G.newState(NOW)).atk;
  assert.ok(Math.abs(G.stats(s).atk / before - 1.1) < 1e-9);
  G.summonEmblem(s, () => 0); assert.equal(s.emblems.level, 2);
});

test('ricerca: gradi sbloccati dalla missione, un nodo alla volta, effetti', () => {
  const s = G.newState(NOW);
  s.blueprints = 1000;
  assert.equal(G.startTech(s, 'atkMastery', NOW), false); // grado I non ancora sbloccato
  s.stats.maxStage = UNLOCKS.tech1;
  assert.ok(G.startTech(s, 'atkMastery', NOW)); assert.equal(s.blueprints, 960);
  assert.equal(G.startTech(s, 'hpMastery', NOW), false);
  G.tick(s, 0.1, NOW + 301e3); assert.equal(G.techLv(s, 'atkMastery'), 1);
  s.tech.lv.atkMastery = 5;
  assert.equal(G.techCost(s, 'atkMastery').open, false); // grado II richiede 3-1
  s.tech.lv.forgeTime = 25; s.coins = 400;
  G.payForge(s, NOW); assert.equal(s.forge.end, NOW + 300e3 / 2);
});

test('offline, premio giornaliero, pass, prodotti, salvataggio e migrazione', () => {
  const s = G.newState(NOW);
  for (const sl of SLOTS) s.parts[sl.id] = { slot: sl.id, age: 1, lvl: 10, subs: [{ id: 'crit', v: 3 }] };
  const a = G.offlineEarnings(s, 3600), b = G.offlineEarnings(s, 99 * 3600);
  assert.equal(b.secs, 4 * 3600); assert.ok(b.coins > a.coins && a.wrenches > 0);
  assert.equal(G.claimDaily(s, NOW), 10); assert.equal(G.claimDaily(s, NOW), 0);
  s.pass.xp = 360; assert.equal(G.passTier(s), 3);
  assert.ok(G.claimPass(s, 0, false)); assert.equal(G.claimPass(s, 0, false), null); assert.equal(G.claimPass(s, 0, true), null);
  const pass = PRODUCTS.find((p) => p.id === 'premium_pass');
  assert.ok(G.grantProduct(s, pass, NOW)); assert.ok(s.pass.premium); assert.ok(G.claimPass(s, 2, true));
  assert.equal(G.grantProduct(s, pass, NOW), false);
  const starter = PRODUCTS.find((p) => p.id === 'starter_pack');
  const gems = s.gems; assert.ok(G.grantProduct(s, starter, NOW)); assert.equal(s.gems, gems + 300);
  s.stage = 20; s.enemy = { hp: 1 }; s.pending = [{ slot: 'hull', age: 0, lvl: 3, subs: [] }];
  const back = G.loadState(JSON.parse(JSON.stringify(G.serialize(s))), NOW);
  assert.equal(back.stage, 19); assert.ok(back.farming); assert.equal(back.gems, s.gems);
  assert.deepEqual(back.parts.guns, s.parts.guns); assert.equal(back.pending.length, 1); assert.equal(back.enemy, null);
  const old = G.loadState({ v: 2, coins: 9e9, gems: 77, stage: 40, aircraft: { owned: ['libellula', 'rondine'] }, perks: { noAds: true } }, NOW);
  assert.equal(old.gems, 137); assert.equal(old.coins, 0); assert.equal(old.stage, 1); assert.ok(old.perks.noAds);
  const bad = G.loadState({ v: 3, coins: 'x', stage: -3, parts: { guns: { slot: 'guns' }, nope: {} }, drones: { eq: ['x'] } }, NOW);
  assert.deepEqual(bad.parts, {}); assert.deepEqual(bad.drones.eq, []); assert.equal(bad.stage, 1);
});

test('guerra d\'alleanza: le azioni vengono annotate solo dopo lo sblocco', () => {
  const s = G.newState(NOW); s.wrenches = 5;
  G.build(s); assert.deepEqual(G.takeWarLog(s), {});
  s.stats.maxStage = UNLOCKS.alliance; s.pending = []; s.parts = {};
  G.build(s, () => 0);
  assert.deepEqual(G.takeWarLog(s), { 'forge:0': 1 }); assert.deepEqual(s.warLog, {});
});

test('formattazione numeri', () => {
  assert.equal(fmt(999), '999'); assert.equal(fmt(1500), '1.50K'); assert.equal(fmt(999999), '1.00M');
  assert.equal(fmt(1e15), '1.00aa'); assert.equal(fmtTime(3725), '1h 02m'); assert.equal(fmtTime(75), '1m 15s');
});
