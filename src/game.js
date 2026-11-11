// Logica di gioco pura: nessun accesso a DOM o storage, così è testabile con Node.
import {
  STAGES_PER_CHAPTER, WAVES, BOSS_TIME, OFFLINE_HOURS, DAILY_KEYS, SELL_BASE, START_WRENCHES, UNLOCKS,
  AGES, AGE_MULT, SLOTS, SUBSTATS, RARITIES, DRONES, DRONE_SCALE, DRONE_MAX_LEVEL, CRATE_SECONDS,
  EMBLEMS, EMBLEM_BOOST, EMBLEM_COST, MANEUVERS, MANEUVER_LEVEL_STEP, MANEUVER_MAX_LEVEL, TECH, TECH_TIER_UNLOCK,
  DUNGEONS, MISSIONS, DAILY_GEMS, PASS_TIERS, PASS_XP, PASS_DAYS, AD_REWARDS,
} from './data.js';
import { FORGE_ODDS, FORGE_UPGRADES, TECH_COSTS, CRATE_RATES, MANEUVER_RATES, EMBLEM_RATES } from './tables.js';

export const SAVE_VERSION = 3;
const SPAWN_DELAY = 0.3;
const BASE_ATK = 10, BASE_HP = 100;
const ENEMY_GROWTH = 1.075;
const DAY = 86400e3;

const byId = (list) => Object.fromEntries(list.map((x) => [x.id, x]));
const SLOT = byId(SLOTS), SUB = byId(SUBSTATS), DRONE = byId(DRONES), EMBLEM = byId(EMBLEMS), MAN = byId(MANEUVERS), TECHN = byId(TECH);
export const FORGE_MAX = FORGE_UPGRADES.length + 1;

const keysFull = () => Object.fromEntries(DUNGEONS.map((d) => [d.id, DAILY_KEYS]));
const zeros = () => Object.fromEntries(DUNGEONS.map((d) => [d.id, 0]));

export function newState(now = Date.now()) {
  return {
    v: SAVE_VERSION,
    coins: 0, gems: 0, wrenches: START_WRENCHES, plans: 0, blueprints: 0, paint: 0,
    stage: 1, wave: 0, kills: 0, farming: false, bossTimer: 0,
    parts: {}, pending: [],
    auto: { on: false, stopAge: 3 },
    forge: { level: 1, paid: 0, end: 0 },
    tech: { lv: {}, active: null },
    drones: { own: {}, subs: {}, eq: [], crates: [], bay: [] },
    maneuvers: { own: {}, eq: [], auto: true, level: 1, count: 0 },
    emblems: { own: {}, subs: {}, eq: null, level: 1, count: 0 },
    keys: keysFull(), keysDay: dayKey(now), dungeons: zeros(),
    pass: { season: passSeason(now), xp: 0, free: [], prem: [], premium: false },
    perks: { noAds: false }, purchased: {}, ads: {},
    missions: {}, daily: { day: 0, last: '' }, unlocked: {},
    stats: { maxStage: 1, kills: 0, builds: 0, bosses: 0, dungeons: 0, hatched: 0, forgeLevel: 1, taps: 0 },
    settings: { sound: true, lang: null },
    warLog: {},
    lastSeen: now,
    online: { token: null, name: '' },
    // runtime (non salvato)
    enemy: null, shotTimer: 0, spawnTimer: 0, hp: 0, cds: {}, buffs: {},
  };
}

const RUNTIME = ['enemy', 'shotTimer', 'spawnTimer', 'hp', 'cds', 'buffs'];
// Dalla versione precedente si conserva solo ciò che è stato comprato o scelto; gli aerei comprati vengono rimborsati.
const KEEP_FROM_OLD = ['gems', 'perks', 'purchased', 'settings', 'online', 'daily'];
const OLD_AIRCRAFT_GEMS = { rondine: 60, gheppio: 200, saetta: 500, spettro: 1200 };

/** Unisce un salvataggio (anche vecchio o parziale) sopra uno stato nuovo. */
export function loadState(raw, now = Date.now()) {
  const s = newState(now);
  if (!raw || typeof raw !== 'object') return s;
  const current = raw.v === SAVE_VERSION;
  for (const k of current ? Object.keys(s) : KEEP_FROM_OLD) {
    if (RUNTIME.includes(k) || k === 'v' || raw[k] == null) continue;
    if (Array.isArray(s[k])) { if (Array.isArray(raw[k])) s[k] = raw[k]; continue; }
    if (typeof s[k] === 'object') { if (typeof raw[k] === 'object') Object.assign(s[k], raw[k]); continue; }
    if (typeof raw[k] === typeof s[k]) s[k] = raw[k];
  }
  if (!current && raw.aircraft && Array.isArray(raw.aircraft.owned)) {
    for (const id of raw.aircraft.owned) s.gems += OLD_AIRCRAFT_GEMS[id] || 0;
  }
  s.online = { token: s.online.token || null, name: s.online.name || '' };
  for (const k of ['coins', 'gems', 'wrenches', 'plans', 'blueprints', 'paint']) if (!isFinite(s[k]) || s[k] < 0) s[k] = 0;
  s.stage = Math.max(1, Math.floor(s.stage) || 1);
  for (const k of Object.keys(s.parts)) if (!SLOT[k] || !validPart(s.parts[k])) delete s.parts[k];
  s.pending = s.pending.filter(validPart);
  s.drones.eq = s.drones.eq.filter((id) => s.drones.own[id]);
  s.maneuvers.eq = s.maneuvers.eq.filter((id) => s.maneuvers.own[id]);
  if (s.emblems.eq && !s.emblems.own[s.emblems.eq]) s.emblems.eq = null;
  if (isBoss(s.stage)) { s.stage -= 1; s.farming = true; } // mai riprendere a metà boss
  s.wave = 0; s.kills = 0;
  refreshDaily(s, now);
  return s;
}
const validPart = (p) => p && SLOT[p.slot] && Number.isFinite(p.lvl) && AGES[p.age] && Array.isArray(p.subs);

export function serialize(s) {
  const out = { ...s };
  for (const k of RUNTIME) delete out[k];
  return out;
}

// ---------- missioni e sblocchi ----------
export const chapterOf = (stage) => Math.floor((stage - 1) / STAGES_PER_CHAPTER) + 1;
export const stageName = (stage) => `${chapterOf(stage)}-${((stage - 1) % STAGES_PER_CHAPTER) + 1}`;
export const isBoss = (stage) => stage % STAGES_PER_CHAPTER === 0;
export const unlocked = (s, key) => s.stats.maxStage >= UNLOCKS[key];
export const unlockStage = (key) => UNLOCKS[key];

const enemyBase = (stage) => Math.pow(ENEMY_GROWTH, stage - 1);
export function enemyStats(stage, wave) {
  const last = wave === WAVES.length - 1, boss = last && isBoss(stage);
  const k = enemyBase(stage);
  const hp = 40 * k * (boss ? 10 : last ? 3 : 1), atk = 4 * k * (boss ? 2.2 : last ? 1.5 : 1);
  return { hp, atk, boss, leader: last && !boss };
}

// ---------- officina e pezzi ----------
export const techLv = (s, id) => s.tech.lv[id] || 0;
export const techPct = (s, id) => techLv(s, id) * TECHN[id].v;
export const maxPartLevel = (s) => 5 + 3 * s.forge.level + 2 * techLv(s, 'partLevel');
export const forgeOdds = (level) => FORGE_ODDS[Math.min(FORGE_ODDS.length, level) - 1];
export const partMain = (p) => SLOT[p.slot].base * Math.pow(AGE_MULT, p.age) * Math.pow(1.06, p.lvl - 1);
export const partSell = (s, p) => Math.round(SELL_BASE * Math.pow(1.01, p.lvl - 1) * (1 + techPct(s, 'sellPrice') / 100));
export const partStat = (p) => SLOT[p.slot].stat;

function pick(weights, rnd) {
  const total = weights.reduce((a, b) => a + b, 0);
  let roll = rnd() * total;
  for (let i = 0; i < weights.length; i++) { if (roll < weights[i]) return i; roll -= weights[i]; }
  return weights.length - 1;
}
function rollSubs(age, count, rnd) {
  const pool = SUBSTATS.slice(), subs = [];
  for (let i = 0; i < count; i++) {
    const sub = pool.splice(Math.floor(rnd() * pool.length), 1)[0];
    subs.push({ id: sub.id, v: Math.round(sub.max * (0.3 + 0.7 * age / 9) * (0.5 + 0.5 * rnd()) * 10) / 10 });
  }
  return subs;
}
export function rollPart(s, rnd = Math.random) {
  const odds = forgeOdds(s.forge.level), max = maxPartLevel(s);
  const age = pick(odds, rnd);
  const present = odds.filter((x) => x > 0), rarest = Math.min(...present);
  const lvl = odds[age] === rarest && present.length > 1 ? 1 + Math.floor(rnd() * max) : Math.max(1, max - Math.floor(rnd() * 6));
  const slot = SLOTS[Math.floor(rnd() * SLOTS.length)].id;
  return { slot, age, lvl, subs: rollSubs(age, age === 0 ? 0 : age < 5 ? 1 : 2, rnd) };
}
export const forgeBatch = (s) => 1 + (unlocked(s, 'forge2') ? 1 : 0) + (unlocked(s, 'forge3') ? 1 : 0);
export const autoBatch = (s) => 1 + techLv(s, 'autoForge');

function forgeOne(s, rnd, out) {
  if (s.wrenches < 1) return false;
  if (rnd() >= techPct(s, 'freeForge') / 100) s.wrenches -= 1;
  const part = rollPart(s, rnd);
  s.stats.builds++; addPassXp(s, 1); war(s, 'forge:' + part.age);
  if (!s.parts[part.slot]) { s.parts[part.slot] = part; out.push({ part, equipped: true }); }
  else { s.pending.push(part); out.push({ part, equipped: false }); }
  return true;
}
/** Costruisce uno o più pezzi (secondo gli sblocchi). Lo slot vuoto si riempie da solo. */
export function build(s, rnd = Math.random) {
  if (s.pending.length) return [];
  const out = [];
  for (let i = 0; i < forgeBatch(s); i++) if (!forgeOne(s, rnd, out)) break;
  return out;
}
export const isUpgrade = (s, part) => !s.parts[part.slot] || partMain(part) > partMain(s.parts[part.slot]);
/** Monta il primo pezzo in attesa (vendendo quello vecchio) oppure lo vende. Restituisce le monete incassate. */
export function resolvePending(s, equip) {
  const part = s.pending.shift();
  if (!part) return 0;
  const sold = equip ? s.parts[part.slot] : part;
  if (equip) s.parts[part.slot] = part;
  const coins = sold ? partSell(s, sold) : 0;
  s.coins += coins;
  return coins;
}
/** Costruzione automatica: monta se migliora, vende se peggiora, si ferma se esce un'epoca da valutare a mano. */
export function autoBuild(s, rnd = Math.random) {
  if (s.pending.length || s.wrenches < 1) return null;
  const out = [];
  for (let i = 0; i < autoBatch(s); i++) {
    if (!forgeOne(s, rnd, out)) break;
    const r = out[out.length - 1];
    if (r.equipped) continue;
    if (r.part.age >= s.auto.stopAge && !isUpgrade(s, r.part)) { s.auto.on = false; r.stopped = true; break; }
    r.equipped = isUpgrade(s, r.part); r.coins = resolvePending(s, r.equipped);
  }
  return out;
}

// Potenziamento dell'officina: si paga a rate, poi parte il tempo.
export function forgeUpgradeInfo(s) {
  const row = FORGE_UPGRADES[s.forge.level - 1];
  if (!row) return null;
  const [cost, parts, secs] = row;
  return { cost: Math.round(cost * (1 - techPct(s, 'forgeCost') / 100)), parts, secs: secs / (1 + techPct(s, 'forgeTime') / 100) };
}
export const forgeBusy = (s, now) => s.forge.end > now;
export function payForge(s, now) {
  const info = forgeUpgradeInfo(s);
  if (!info || s.forge.end || s.forge.paid >= info.parts || s.coins < info.cost) return false;
  s.coins -= info.cost; s.forge.paid++;
  war(s, 'forgeCoins', Math.floor(info.cost / 1000));
  if (s.forge.paid >= info.parts) { s.forge.end = now + info.secs * 1000; war(s, 'forgeUp'); }
  return true;
}
function finishForge(s, now, events) {
  if (!s.forge.end || s.forge.end > now) return;
  s.forge.end = 0; s.forge.paid = 0; s.forge.level++;
  s.stats.forgeLevel = s.forge.level; war(s, 'forgeUp');
  events.push({ t: 'forge', level: s.forge.level });
}
export const skipGems = (end, now) => Math.max(1, Math.ceil((end - now) / 1000 / 120));
/** Accorcia (ad) o completa (gemme) un timer: officina, ricerca o cassa. */
export function speedUp(s, target, now, { seconds = 0, gems = false } = {}) {
  const box = target === 'forge' ? s.forge : target === 'tech' ? s.tech.active : s.drones.bay[target];
  if (!box || !box.end || box.end <= now) return false;
  if (gems) {
    const cost = skipGems(box.end, now);
    if (s.gems < cost) return false;
    s.gems -= cost; box.end = now;
  } else box.end = Math.max(now, box.end - seconds * 1000);
  const events = [];
  updateTimers(s, now, events);
  return true;
}

// ---------- statistiche ----------
function allSubs(s) {
  const list = [];
  for (const sl of SLOTS) if (s.parts[sl.id]) list.push(...s.parts[sl.id].subs);
  for (const id of s.drones.eq) if (s.drones.subs[id]) list.push(s.drones.subs[id]);
  if (s.emblems.eq && s.emblems.subs[s.emblems.eq]) list.push(s.emblems.subs[s.emblems.eq]);
  return list;
}
export function subTotals(s) {
  const t = Object.fromEntries(SUBSTATS.map((x) => [x.id, 0]));
  for (const sub of allSubs(s)) if (sub.id in t) t[sub.id] += sub.v;
  return t;
}
export function droneStats(s, id) {
  const d = DRONE[id], lvl = s.drones.own[id] || 1, k = DRONE_SCALE * (1 + 0.1 * (lvl - 1));
  return { dmg: d.dmg * k * (1 + techPct(s, 'droneAtk') / 100), hp: d.hp * k * (1 + techPct(s, 'droneHp') / 100) };
}
export function emblemBoost(s, id = s.emblems.eq) {
  if (!id) return 0;
  return EMBLEM_BOOST[EMBLEM[id].r] * (1 + 0.05 * ((s.emblems.own[id] || 1) - 1));
}

/** Tutte le statistiche di combattimento in un colpo solo. */
export function stats(s) {
  const sub = subTotals(s);
  let atk = BASE_ATK, hp = BASE_HP;
  for (const sl of SLOTS) {
    const p = s.parts[sl.id];
    if (!p) continue;
    if (sl.stat === 'atk') atk += partMain(p); else hp += partMain(p);
  }
  for (const id of s.drones.eq) { const d = droneStats(s, id); atk += d.dmg; hp += d.hp; }
  const emb = emblemBoost(s) / 100;
  atk *= (1 + sub.damage / 100) * (1 + techPct(s, 'atkMastery') / 100) * (1 + emb * (1 + techPct(s, 'emblemAtk') / 100));
  hp *= (1 + sub.health / 100) * (1 + techPct(s, 'hpMastery') / 100) * (1 + emb * (1 + techPct(s, 'emblemHp') / 100));
  const aps = 1 + sub.atkSpeed / 100;
  const crit = Math.min(1, sub.crit / 100), critMult = 1.2 + sub.critDmg / 100, double = Math.min(1, sub.double / 100);
  const dps = atk * aps * (1 + crit * (critMult - 1)) * (1 + double);
  return {
    atk, hp, aps, crit, critMult, double, dps,
    lifesteal: sub.lifesteal / 100, regen: sub.regen / 100, block: Math.min(0.75, sub.block / 100),
    skillDmg: (sub.skillDmg + techPct(s, 'maneuverDmg')) / 100, skillCd: Math.min(0.6, (sub.skillCd + techPct(s, 'maneuverCd')) / 100),
    power: Math.round(Math.sqrt(dps * hp) * 10),
  };
}
export const power = (s) => stats(s).power;

// ---------- combattimento ----------
function spawn(s, events) {
  const e = enemyStats(s.stage, s.wave);
  s.enemy = { hp: e.hp, maxHp: e.hp, atk: e.atk, boss: e.boss, leader: e.leader };
  if (e.boss) s.bossTimer = BOSS_TIME;
  events.push({ t: 'spawn', boss: e.boss, leader: e.leader });
}

function damage(s, st, dmg, now, events) {
  const e = s.enemy;
  if (!e) return;
  e.hp -= dmg;
  if (e.hp > 0) return;
  s.coins += 1; s.wrenches += 1;
  s.stats.kills++;
  events.push({ t: 'kill', boss: e.boss, leader: e.leader });
  s.enemy = null; s.spawnTimer = SPAWN_DELAY;
  if (++s.kills < WAVES[s.wave]) return;
  s.kills = 0;
  if (++s.wave < WAVES.length) { events.push({ t: 'wave', wave: s.wave }); return; }
  // missione completata
  s.wave = 0;
  const bonus = 2 + chapterOf(s.stage);
  s.wrenches += bonus; addPassXp(s, 5);
  events.push({ t: 'clear', wrenches: bonus });
  if (e.boss) { s.stats.bosses++; s.gems += 5; events.push({ t: 'gem', n: 5 }); }
  if (s.farming) { s.hp = st.hp; return; }
  s.stage++; s.hp = st.hp;
  if (s.stage > s.stats.maxStage) { s.stats.maxStage = s.stage; checkUnlocks(s, events); }
  events.push({ t: 'stage', stage: s.stage });
}

/** Sconfitta o boss fuggito: si arretra di una missione e si resta in pattuglia. */
function retreat(s, st) {
  s.enemy = null; s.kills = 0; s.wave = 0; s.farming = true; s.spawnTimer = SPAWN_DELAY * 4;
  s.stage = Math.max(1, s.stage - 1);
  if (isBoss(s.stage)) s.stage -= 1;
  s.hp = st.hp; s.buffs = {};
}

function hit(s, st, mult, now, events, kind) {
  const crit = Math.random() < st.crit;
  const fury = s.buffs.fury > now ? 1 + s.buffs.furyK : 1;
  let dmg = st.atk * mult * fury * (crit ? st.critMult : 1);
  events.push({ t: kind, dmg, crit });
  s.hp = Math.min(st.hp, s.hp + dmg * st.lifesteal);
  damage(s, st, dmg, now, events);
  if (kind === 'shot' && s.enemy && Math.random() < st.double) {
    dmg = st.atk * fury; events.push({ t: 'shot', dmg, crit: false });
    s.hp = Math.min(st.hp, s.hp + dmg * st.lifesteal);
    damage(s, st, dmg, now, events);
  }
}

export function maneuverCooldown(s, st, id) { return MAN[id].cd * (1 - st.skillCd); }
export function maneuverPower(s, st, id) { return MAN[id].k * (1 + 0.08 * ((s.maneuvers.own[id] || 1) - 1)) * (1 + st.skillDmg); }
/** Esegue una manovra se è pronta. */
export function cast(s, id, now, events = [], st = stats(s)) {
  if (!s.maneuvers.eq.includes(id) || (s.cds[id] || 0) > now || !s.enemy) return false;
  const m = MAN[id], k = maneuverPower(s, st, id);
  s.cds[id] = now + maneuverCooldown(s, st, id) * 1000;
  events.push({ t: 'cast', id });
  if (m.kind === 'hit') hit(s, st, k, now, events, 'skill');
  else if (m.kind === 'heal') s.hp = Math.min(st.hp, s.hp + st.hp * m.k * (k / m.k));
  else if (m.kind === 'shield') s.buffs.shield = now + k * 1000;
  else if (m.kind === 'haste') { s.buffs.haste = now + m.dur * 1000; s.buffs.hasteK = k; }
  else if (m.kind === 'fury') { s.buffs.fury = now + m.dur * 1000; s.buffs.furyK = k; }
  return true;
}

function updateTimers(s, now, events) {
  finishForge(s, now, events);
  const a = s.tech.active;
  if (a && a.end <= now) {
    s.tech.lv[a.id] = techLv(s, a.id) + 1; s.tech.active = null;
    war(s, 'tech:' + techTier(s, a.id, -1));
    events.push({ t: 'tech', id: a.id });
  }
  for (const b of s.drones.bay) if (b.end <= now && !b.ready) { b.ready = true; events.push({ t: 'crate', r: b.r }); }
  refreshDaily(s, now);
}

export function tick(s, dt, now, events = []) {
  updateTimers(s, now, events);
  const st = stats(s);
  if (!(s.hp > 0)) s.hp = st.hp;
  s.hp = Math.min(s.hp, st.hp);
  if (!s.enemy) {
    s.spawnTimer -= dt;
    if (s.spawnTimer > 0) return events;
    spawn(s, events);
  }
  if (s.enemy.boss) {
    s.bossTimer -= dt;
    if (s.bossTimer <= 0) { retreat(s, st); events.push({ t: 'bossFail' }); return events; }
  }
  const taken = s.buffs.shield > now ? 0 : s.enemy.atk * (1 - st.block) * dt;
  s.hp = Math.min(st.hp, s.hp - taken + st.hp * st.regen * dt);
  if (s.hp <= 0) { retreat(s, st); events.push({ t: 'defeat' }); return events; }
  const haste = s.buffs.haste > now ? 1 + s.buffs.hasteK : 1;
  s.shotTimer += dt * st.aps * haste;
  while (s.shotTimer >= 1) {
    s.shotTimer -= 1;
    if (s.enemy) hit(s, st, 1, now, events, 'shot');
  }
  if (s.maneuvers.auto && s.enemy) for (const id of s.maneuvers.eq) if ((s.cds[id] || 0) <= now) { cast(s, id, now, events, st); break; }
  return events;
}

export function tap(s, now, events = []) {
  s.stats.taps++;
  if (!s.enemy) return events;
  hit(s, stats(s), 0.5, now, events, 'tap');
  return events;
}

export function challengeBoss(s) {
  if (!s.farming) return false;
  s.farming = false; s.stage += 1; s.kills = 0; s.wave = 0; s.enemy = null; s.spawnTimer = 0; s.hp = stats(s).hp;
  return true;
}

function checkUnlocks(s, events) {
  const gifts = { maneuvers: { plans: 10 }, drones: { crates: [0] }, emblems: { paint: 150 } };
  for (const key of Object.keys(UNLOCKS)) {
    if (s.unlocked[key] || !unlocked(s, key)) continue;
    s.unlocked[key] = true;
    if (gifts[key]) give(s, gifts[key]);
    events.push({ t: 'unlock', key });
  }
}

// ---------- risorse ----------
/** Accredita un pacchetto di risorse: { coins, gems, wrenches, plans, blueprints, paint, keys, crates: [rarità] }. */
export function give(s, pack) {
  for (const k of ['coins', 'gems', 'wrenches', 'plans', 'blueprints', 'paint']) if (pack[k]) s[k] += pack[k];
  if (pack.keys) for (const d of DUNGEONS) s.keys[d.id] += pack.keys;
  if (pack.crates) s.drones.crates.push(...pack.crates);
}

// ---------- dungeon ----------
export const dungeonName = (level) => `${Math.floor((level - 1) / 10) + 1}-${((level - 1) % 10) + 1}`;
export function dungeonEnemy(id, level) {
  const eq = 24 + 2 * level + { thief: 0, ghost: 4, invasion: 12, swarm: 20 }[id];
  const k = enemyBase(eq);
  return { hp: 40 * k * 25, atk: 4 * k * 2.2 };
}
/** Simula lo scontro con il guardiano del dungeon: entro 60 secondi, senza manovre. */
export function dungeonFight(s, id, level) {
  const st = stats(s), e = dungeonEnemy(id, level);
  const tKill = e.hp / st.dps;
  const net = e.atk * (1 - st.block) - st.hp * st.regen - st.dps * st.lifesteal;
  const tDie = net <= 0 ? Infinity : st.hp / net;
  const win = tKill <= 60 && tKill <= tDie;
  return { win, myLeft: win ? Math.max(0, 1 - (net > 0 ? tKill * net / st.hp : 0)) : 0, foeLeft: win ? 0 : Math.max(0, 1 - Math.min(tDie, 60) / tKill) };
}
export function dungeonReward(s, id, level, rnd = Math.random) {
  if (id === 'thief') return { wrenches: Math.round((60 + 15 * (level - 1)) * (1 + techPct(s, 'thiefWrench') / 100)), coins: Math.round(500 * Math.pow(1.06, level - 1) * (1 + techPct(s, 'thiefCoin') / 100)) };
  if (id === 'ghost') return { plans: Math.round((5 + Math.floor((level - 1) / 3)) * (1 + techPct(s, 'planBonus') / 100)) };
  if (id === 'swarm') return { blueprints: 60 + 12 * (level - 1) };
  const n = 1 + (level >= 30 ? 1 : 0) + (level >= 70 ? 1 : 0) + (rnd() < techPct(s, 'crateExtra') / 100 ? 1 : 0);
  return { crates: Array.from({ length: n }, () => pick(CRATE_RATES[level - 1], rnd)) };
}
/** Tenta il livello `level` (al massimo il primo non superato). La chiave si consuma solo se si vince. */
export function runDungeon(s, id, level, { sweep = false, rnd = Math.random } = {}) {
  if (!unlocked(s, id) || s.keys[id] < 1) return null;
  const best = s.dungeons[id];
  if (sweep ? best < 1 : level > best + 1 || level < 1 || level > 100) return null;
  const fight = sweep ? { win: true, myLeft: 1, foeLeft: 0 } : dungeonFight(s, id, level);
  if (!fight.win) return { ...fight, reward: null };
  const lv = sweep ? best : level;
  s.keys[id]--; s.dungeons[id] = Math.max(best, lv); s.stats.dungeons++;
  const reward = dungeonReward(s, id, lv, rnd);
  give(s, reward); addPassXp(s, 20); war(s, 'dungeonKey');
  return { ...fight, level: lv, reward };
}

// ---------- droni ----------
export const droneSlots = (s) => ['drone1', 'drone2', 'drone3'].filter((k) => unlocked(s, k)).length;
export const crateSeconds = (s, r) => CRATE_SECONDS[r] / (1 + techPct(s, 'crateSpeed') / 100);
export const BAY_SIZE = 2;
export function startCrate(s, index, now) {
  if (s.drones.bay.length >= BAY_SIZE || index < 0 || index >= s.drones.crates.length) return false;
  const r = s.drones.crates.splice(index, 1)[0];
  s.drones.bay.push({ r, end: now + crateSeconds(s, r) * 1000 });
  return true;
}
/** Apre una cassa pronta: nuovo drone oppure +1 livello a uno già posseduto. */
export function openCrate(s, index, now, rnd = Math.random) {
  const b = s.drones.bay[index];
  if (!b || b.end > now) return null;
  s.drones.bay.splice(index, 1);
  const pool = DRONES.filter((d) => d.r === b.r), d = pool[Math.floor(rnd() * pool.length)];
  const had = s.drones.own[d.id] || 0;
  s.stats.hatched++; addPassXp(s, 20); war(s, 'hatch:' + b.r);
  if (had) { s.drones.own[d.id] = Math.min(DRONE_MAX_LEVEL, had + 1); war(s, 'merge:' + b.r); }
  else {
    s.drones.own[d.id] = 1; s.drones.subs[d.id] = rollSubs(3 + d.r, 1, rnd)[0];
    if (s.drones.eq.length < droneSlots(s)) s.drones.eq.push(d.id);
  }
  return { id: d.id, r: b.r, merged: !!had, lvl: s.drones.own[d.id] };
}
export function toggleDrone(s, id) {
  if (!s.drones.own[id]) return false;
  const i = s.drones.eq.indexOf(id);
  if (i >= 0) { s.drones.eq.splice(i, 1); return true; }
  if (s.drones.eq.length >= droneSlots(s)) s.drones.eq.shift();
  s.drones.eq.push(id); return true;
}

// ---------- manovre ----------
export const maneuverSlots = (s) => ['maneuver2', 'maneuver2', 'maneuver3', 'maneuver4'].filter((k, i) => i === 0 ? unlocked(s, 'maneuvers') : unlocked(s, k)).length;
export const maneuverRates = (s) => MANEUVER_RATES[Math.min(100, s.maneuvers.level) - 1];
export function summonManeuvers(s, n, rnd = Math.random) {
  if (!unlocked(s, 'maneuvers') || s.plans < n) return null;
  s.plans -= n;
  const got = [];
  for (let i = 0; i < n; i++) {
    const r = pick(maneuverRates(s), rnd), pool = MANEUVERS.filter((m) => m.r === r), m = pool[Math.floor(rnd() * pool.length)];
    const had = s.maneuvers.own[m.id] || 0;
    s.maneuvers.own[m.id] = Math.min(MANEUVER_MAX_LEVEL, had + 1);
    if (had) war(s, 'skillUp:' + r);
    else if (s.maneuvers.eq.length < maneuverSlots(s)) s.maneuvers.eq.push(m.id);
    got.push({ id: m.id, r, lvl: s.maneuvers.own[m.id], fresh: !had });
    if (++s.maneuvers.count >= MANEUVER_LEVEL_STEP && s.maneuvers.level < 100) { s.maneuvers.count = 0; s.maneuvers.level++; }
  }
  return got;
}
export function toggleManeuver(s, id) {
  if (!s.maneuvers.own[id]) return false;
  const i = s.maneuvers.eq.indexOf(id);
  if (i >= 0) { s.maneuvers.eq.splice(i, 1); return true; }
  if (s.maneuvers.eq.length >= maneuverSlots(s)) s.maneuvers.eq.shift();
  s.maneuvers.eq.push(id); return true;
}

// ---------- emblemi ----------
export const emblemCost = (s) => Math.ceil(EMBLEM_COST * (1 - techPct(s, 'emblemCost') / 100));
export const emblemRates = (s) => EMBLEM_RATES[Math.min(EMBLEM_RATES.length, s.emblems.level) - 1].slice(1);
export const emblemNext = (s) => EMBLEM_RATES[Math.min(EMBLEM_RATES.length, s.emblems.level) - 1][0];
export function summonEmblem(s, rnd = Math.random) {
  const cost = emblemCost(s);
  if (!unlocked(s, 'emblems') || s.paint < cost) return null;
  s.paint -= cost;
  const got = [], n = rnd() < techPct(s, 'emblemExtra') / 100 ? 2 : 1;
  for (let i = 0; i < n; i++) {
    const r = pick(emblemRates(s), rnd), pool = EMBLEMS.filter((e) => e.r === r), e = pool[Math.floor(rnd() * pool.length)];
    const had = s.emblems.own[e.id] || 0;
    s.emblems.own[e.id] = had + 1;
    if (!had) s.emblems.subs[e.id] = rollSubs(3 + e.r, 1, rnd)[0];
    war(s, 'emblem:' + r);
    if (!s.emblems.eq || emblemBoost(s, e.id) > emblemBoost(s)) s.emblems.eq = e.id;
    got.push({ id: e.id, r, lvl: s.emblems.own[e.id], fresh: !had });
    s.emblems.count++;
    const need = emblemNext(s);
    if (need && s.emblems.count >= need) s.emblems.level++;
  }
  return got;
}
export function equipEmblem(s, id) { if (!s.emblems.own[id]) return false; s.emblems.eq = id; return true; }

// ---------- ricerca ----------
const techMax = (id) => (TECHN[id].perTier ? 5 : 25);
export const techTier = (s, id, offset = 0) => {
  const lv = techLv(s, id) + offset;
  return TECHN[id].perTier ? lv : Math.floor(lv / 5);
};
export function techCost(s, id) {
  const lv = techLv(s, id);
  if (lv >= techMax(id)) return null;
  const row = TECH_COSTS[TECHN[id].perTier ? lv * 5 + 4 : lv];
  const tier = techTier(s, id);
  return { secs: row[0], blueprints: row[1], tier, open: unlocked(s, TECH_TIER_UNLOCK[tier]) };
}
export function startTech(s, id, now) {
  const c = techCost(s, id);
  if (!c || !c.open || s.tech.active || s.blueprints < c.blueprints) return false;
  s.blueprints -= c.blueprints; s.tech.active = { id, end: now + c.secs * 1000 };
  return true;
}

// ---------- tempo: offline, premi, pass ----------
export const offlineCap = (s) => OFFLINE_HOURS * 3600 * (1 + techPct(s, 'offlineTime') / 100);
export function killRate(s) {
  const st = stats(s), stage = isBoss(s.stage) ? s.stage - 1 : s.stage;
  const e = enemyStats(stage, 0);
  return 1 / (SPAWN_DELAY + e.hp / st.dps);
}
export function offlineEarnings(s, seconds) {
  const secs = Math.min(Math.max(0, seconds), offlineCap(s)), kills = killRate(s) * secs * 0.5;
  return {
    secs,
    coins: Math.floor(kills * (1 + techPct(s, 'offlineCoin') / 100)),
    wrenches: Math.floor(kills * (1 + techPct(s, 'offlineWrench') / 100)),
  };
}

export const dayKey = (now) => new Date(now).toISOString().slice(0, 10);
function refreshDaily(s, now) {
  const today = dayKey(now);
  if (s.keysDay === today) return;
  s.keysDay = today;
  for (const d of DUNGEONS) s.keys[d.id] = Math.max(s.keys[d.id] || 0, DAILY_KEYS);
}
export const dailyAvailable = (s, now) => s.daily.last !== dayKey(now);
export function claimDaily(s, now) {
  if (!dailyAvailable(s, now)) return 0;
  const gems = DAILY_GEMS[s.daily.day % DAILY_GEMS.length];
  s.daily.day++; s.daily.last = dayKey(now); give(s, { gems, wrenches: 100 });
  return gems;
}

export const missionDone = (s, m) => (s.stats[m.stat] || 0) >= m.goal;
export function claimMission(s, id) {
  const m = MISSIONS.find((x) => x.id === id);
  if (!m || s.missions[id] || !missionDone(s, m)) return 0;
  s.missions[id] = true; s.gems += m.gems; return m.gems;
}
export const claimableMissions = (s) => MISSIONS.filter((m) => !s.missions[m.id] && missionDone(s, m)).length;

export function adReady(s, id, now) { return (s.ads[id] || 0) <= now; }
export function grantAd(s, id, now) {
  const a = AD_REWARDS[id];
  give(s, a.give); s.ads[id] = now + a.cooldown * 1000;
}

export const passSeason = (now) => Math.floor(now / (PASS_DAYS * DAY));
export const passTier = (s) => Math.min(PASS_TIERS, Math.floor(s.pass.xp / PASS_XP));
function addPassXp(s, n) { s.pass.xp += n; }
export function checkPassSeason(s, now) {
  const season = passSeason(now);
  if (s.pass.season === season) return false;
  s.pass = { season, xp: 0, free: [], prem: [], premium: false };
  return true;
}
/** Ricompensa del grado `i` (0-based) sulla traccia gratuita o premium. */
export function passReward(i, premium) {
  const cycle = i % 5, m = 1 + Math.floor(i / 5) * 0.5;
  if (!premium) return [{ wrenches: Math.round(80 * m) }, { coins: Math.round(800 * m) }, { gems: 10 }, { plans: 3 }, { crates: [Math.min(3, Math.floor(i / 10) + 1)] }][cycle];
  return [{ gems: 30 }, { wrenches: Math.round(250 * m) }, { paint: 50 }, { blueprints: Math.round(150 * m) }, { crates: [Math.min(4, Math.floor(i / 8) + 2)], gems: 20 }][cycle];
}
export function claimPass(s, i, premium) {
  const list = premium ? s.pass.prem : s.pass.free;
  if (i >= passTier(s) || list.includes(i) || (premium && !s.pass.premium)) return null;
  list.push(i);
  const r = passReward(i, premium); give(s, r);
  return r;
}

/** Consegna il contenuto di un prodotto in-app già pagato. */
export function grantProduct(s, p, now) {
  if (p.once && s.purchased[p.id]) return false;
  if (p.season && s.pass.premium) return false;
  if (p.once) s.purchased[p.id] = true;
  if (p.perk === 'premiumPass') { checkPassSeason(s, now); s.pass.premium = true; }
  else if (p.perk) s.perks[p.perk] = true;
  give(s, p);
  return true;
}

// ---------- guerra d'alleanza ----------
/** Annota un'azione che vale punti nella guerra d'alleanza (inviata al server dall'interfaccia). */
function war(s, key, n = 1) {
  if (!unlocked(s, 'alliance') || n <= 0) return;
  s.warLog[key] = (s.warLog[key] || 0) + n;
}
export function takeWarLog(s) {
  const log = s.warLog; s.warLog = {};
  return log;
}
export { RARITIES };
