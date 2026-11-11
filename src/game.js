// Logica di gioco pura: nessun accesso a DOM o storage, così è testabile con Node.
import {
  KILLS_PER_STAGE, BOSS_EVERY, BOSS_TIME, PRESTIGE_MIN_STAGE, OFFLINE_BASE_HOURS,
  BOOST_MAX_SECONDS, UPGRADES, PILOTS, AIRCRAFT, TALENTS, MISSIONS, DAILY_GEMS,
} from './data.js';

export const SAVE_VERSION = 1;
const SPAWN_DELAY = 0.35;
const PILOT_GROWTH = 1.07;

const byId = (list) => Object.fromEntries(list.map((x) => [x.id, x]));
const UP = byId(UPGRADES), PILOT = byId(PILOTS), PLANE = byId(AIRCRAFT), TALENT = byId(TALENTS);

export function newState(now = Date.now()) {
  return {
    v: SAVE_VERSION,
    coins: 0, gems: 0, medals: 0,
    stage: 1, kills: 0, farming: false, bossTimer: 0,
    up: { cannon: 1, rate: 0, crit: 0, critDmg: 0, cargo: 0 },
    pilots: {},
    aircraft: { owned: ['libellula'], equipped: 'libellula' },
    talents: {},
    perks: { noAds: false, doubleCoins: false },
    purchased: {},
    boostUntil: 0, adGemsAt: 0,
    missions: {},
    daily: { day: 0, last: '' },
    stats: { maxStage: 1, runMaxStage: 1, kills: 0, bosses: 0, prestiges: 0, taps: 0, bossBest: 0 },
    settings: { sound: true, lang: null },
    buyMode: 1,
    lastSeen: now,
    // runtime (non salvato)
    enemy: null, shotTimer: 0, spawnTimer: 0,
  };
}

/** Unisce un salvataggio (anche vecchio o parziale) sopra uno stato nuovo. */
export function loadState(raw, now = Date.now()) {
  const s = newState(now);
  if (!raw || typeof raw !== 'object') return s;
  for (const k of Object.keys(s)) {
    if (['enemy', 'shotTimer', 'spawnTimer', 'v'].includes(k) || raw[k] == null) continue;
    if (typeof s[k] === 'object' && !Array.isArray(s[k])) Object.assign(s[k], raw[k]);
    else if (typeof raw[k] === typeof s[k]) s[k] = raw[k];
  }
  for (const k of ['coins', 'gems', 'medals']) if (!isFinite(s[k]) || s[k] < 0) s[k] = 0;
  s.stage = Math.max(1, Math.floor(s.stage) || 1);
  if (!s.aircraft.owned.includes(s.aircraft.equipped)) s.aircraft.equipped = 'libellula';
  if (isBoss(s.stage)) { s.stage -= 1; s.farming = true; s.kills = 0; } // mai riprendere a metà boss
  return s;
}

export function serialize(s) {
  const { enemy, shotTimer, spawnTimer, ...rest } = s;
  return rest;
}

// ---------- formule ----------
export const isBoss = (stage) => stage % BOSS_EVERY === 0;
export const enemyHp = (stage) => Math.ceil(18 * Math.pow(1.24, stage - 1) * (isBoss(stage) ? 6 : 1));
export const coinReward = (stage) => Math.ceil(2 * Math.pow(1.15, stage - 1) * (isBoss(stage) ? 12 : 1));
export const bossTime = (s) => BOSS_TIME + 5 * (s.talents.clock || 0);

const milestone = (lvl) => Math.pow(4, Math.floor(lvl / 25));

export function upgradeCost(id, lvl) { return Math.ceil(UP[id].baseCost * Math.pow(UP[id].growth, lvl - (id === 'cannon' ? 1 : 0))); }
export function pilotCost(id, lvl) { return Math.ceil(PILOT[id].baseCost * Math.pow(PILOT_GROWTH, lvl)); }

/** Costo di n livelli consecutivi e massimo acquistabile (serie geometrica). */
function bulk(costFn, growth, lvl, n) {
  return Math.ceil(costFn(lvl) * (Math.pow(growth, n) - 1) / (growth - 1));
}
function maxAfford(costFn, growth, lvl, coins) {
  const c = costFn(lvl);
  if (coins < c) return 0;
  let n = Math.floor(Math.log(coins * (growth - 1) / c + 1) / Math.log(growth));
  while (n > 0 && bulk(costFn, growth, lvl, n) > coins) n--;
  return n;
}

/** Quanti livelli comprerebbe la modalità corrente (1, 10 o 'max') e a che prezzo. */
export function quote(s, kind, id) {
  const isUp = kind === 'up';
  const lvl = isUp ? s.up[id] : (s.pilots[id] || 0);
  const growth = isUp ? UP[id].growth : PILOT_GROWTH;
  const costFn = isUp ? (l) => upgradeCost(id, l) : (l) => pilotCost(id, l);
  const cap = isUp ? UP[id].max - lvl : Infinity;
  if (cap <= 0) return { n: 0, cost: 0, maxed: true };
  let n = s.buyMode === 'max' ? Math.max(1, maxAfford(costFn, growth, lvl, s.coins)) : s.buyMode;
  n = Math.min(n, cap);
  return { n, cost: bulk(costFn, growth, lvl, n), maxed: false };
}

export const medalBonus = (s) => 1 + 0.1 * s.medals;
export const globalMult = (s) => PLANE[s.aircraft.equipped].mult * medalBonus(s);
export const shotDamage = (s) => 2 * s.up.cannon * milestone(s.up.cannon) * globalMult(s);
export const fireRate = (s) => 1.5 + 0.075 * s.up.rate;
export const critChance = (s) => 0.05 + 0.01 * s.up.crit;
export const critMult = (s) => 2 + 0.1 * s.up.critDmg;
export const tapDamage = (s) => shotDamage(s) * 2;
export function pilotDps(s, id) {
  const lvl = s.pilots[id] || 0;
  return PILOT[id].baseDps * lvl * milestone(lvl) * globalMult(s);
}
export const squadDps = (s) => PILOTS.reduce((sum, p) => sum + pilotDps(s, p.id), 0);
export const playerDps = (s) => shotDamage(s) * fireRate(s) * (1 + critChance(s) * (critMult(s) - 1));
export const totalDps = (s) => squadDps(s) + playerDps(s);

export const boostActive = (s, now) => s.boostUntil > now;
export function coinMult(s, now) {
  return (1 + 0.05 * s.up.cargo) * (1 + 0.25 * (s.talents.loot || 0))
    * (s.perks.doubleCoins ? 2 : 1) * (boostActive(s, now) ? 2 : 1);
}

/** Stima monete/secondo sullo stage attuale (usata per offline, rifornimenti, salto temporale). */
export function incomePerSec(s, now) {
  const stage = isBoss(s.stage) ? s.stage - 1 : s.stage;
  return coinReward(stage) * coinMult(s, now) / (SPAWN_DELAY + enemyHp(stage) / totalDps(s));
}

// ---------- combattimento ----------
function spawn(s, events) {
  const boss = isBoss(s.stage);
  const hp = enemyHp(s.stage);
  s.enemy = { hp, maxHp: hp, boss };
  if (boss) s.bossTimer = bossTime(s);
  events.push({ t: 'spawn', boss });
}

function damage(s, dmg, now, events) {
  const e = s.enemy;
  if (!e) return;
  e.hp -= dmg;
  if (e.hp > 0) return;
  const coins = coinReward(s.stage) * coinMult(s, now);
  s.coins += coins;
  s.stats.kills++;
  events.push({ t: 'kill', boss: e.boss, coins });
  s.enemy = null;
  s.spawnTimer = SPAWN_DELAY;
  if (e.boss) {
    s.stats.bosses++;
    if (s.stage > s.stats.bossBest) { s.stats.bossBest = s.stage; s.gems += 1; events.push({ t: 'gem', n: 1 }); }
    advance(s, events);
  } else if (!s.farming && ++s.kills >= KILLS_PER_STAGE) {
    advance(s, events);
  }
}

function advance(s, events) {
  s.stage++; s.kills = 0;
  s.stats.runMaxStage = Math.max(s.stats.runMaxStage, s.stage);
  s.stats.maxStage = Math.max(s.stats.maxStage, s.stage);
  events.push({ t: 'stage', stage: s.stage });
}

export function tick(s, dt, now, events = []) {
  if (!s.enemy) {
    s.spawnTimer -= dt;
    if (s.spawnTimer > 0) return events;
    spawn(s, events);
  }
  if (s.enemy.boss) {
    s.bossTimer -= dt;
    if (s.bossTimer <= 0) {
      s.enemy = null; s.stage -= 1; s.kills = 0; s.farming = true; s.spawnTimer = SPAWN_DELAY;
      events.push({ t: 'bossFail' });
      return events;
    }
  }
  damage(s, squadDps(s) * dt, now, events);
  s.shotTimer += dt * fireRate(s);
  while (s.shotTimer >= 1) {
    s.shotTimer -= 1;
    if (!s.enemy) continue;
    const crit = Math.random() < critChance(s);
    const dmg = shotDamage(s) * (crit ? critMult(s) : 1);
    events.push({ t: 'shot', dmg, crit });
    damage(s, dmg, now, events);
  }
  return events;
}

export function tap(s, now, events = []) {
  s.stats.taps++;
  if (!s.enemy) return events;
  const crit = Math.random() < critChance(s);
  const dmg = tapDamage(s) * (crit ? critMult(s) : 1);
  events.push({ t: 'tap', dmg, crit });
  damage(s, dmg, now, events);
  return events;
}

export function challengeBoss(s) {
  if (!s.farming) return false;
  s.farming = false; s.stage += 1; s.kills = 0; s.enemy = null; s.spawnTimer = 0;
  return true;
}

// ---------- acquisti con valute di gioco ----------
export function buy(s, kind, id) {
  const q = quote(s, kind, id);
  if (!q.n || s.coins < q.cost) return false;
  s.coins -= q.cost;
  if (kind === 'up') s.up[id] += q.n; else s.pilots[id] = (s.pilots[id] || 0) + q.n;
  return true;
}

export function buyAircraft(s, id) {
  const a = PLANE[id];
  if (!a || s.aircraft.owned.includes(id) || s.gems < a.gems) return false;
  s.gems -= a.gems; s.aircraft.owned.push(id); s.aircraft.equipped = id;
  return true;
}
export function equipAircraft(s, id) {
  if (!s.aircraft.owned.includes(id)) return false;
  s.aircraft.equipped = id; return true;
}

export function talentCost(s, id) { return TALENT[id].cost(s.talents[id] || 0); }
export function buyTalent(s, id) {
  const lvl = s.talents[id] || 0, cost = talentCost(s, id);
  if (lvl >= TALENT[id].max || s.medals < cost) return false;
  s.medals -= cost; s.talents[id] = lvl + 1; return true;
}

// ---------- nuova campagna (prestigio) ----------
export function medalsOnPrestige(s) {
  const st = s.stats.runMaxStage;
  return st < PRESTIGE_MIN_STAGE ? 0 : Math.floor(Math.pow((st - 20) / 5, 1.6));
}
export function prestige(s) {
  const gain = medalsOnPrestige(s);
  if (gain <= 0) return 0;
  s.medals += gain; s.stats.prestiges++;
  s.coins = 0; s.kills = 0; s.farming = false; s.enemy = null; s.spawnTimer = 0; s.shotTimer = 0;
  s.up = { cannon: 1, rate: 0, crit: 0, critDmg: 0, cargo: 0 };
  s.pilots = {};
  s.stage = 1 + 5 * (s.talents.start || 0);
  if (isBoss(s.stage)) s.stage += 1;
  s.stats.runMaxStage = s.stage;
  return gain;
}

// ---------- tempo: offline, boost, premi ----------
export const offlineCap = (s) => (OFFLINE_BASE_HOURS + (s.talents.fuel || 0)) * 3600;
export function offlineEarnings(s, seconds, now) {
  const secs = Math.min(Math.max(0, seconds), offlineCap(s));
  return { secs, coins: Math.floor(incomePerSec(s, now) * secs * 0.5) };
}
export function addBoost(s, seconds, now) {
  s.boostUntil = Math.min(Math.max(s.boostUntil, now) + seconds * 1000, now + BOOST_MAX_SECONDS * 1000);
}
export function dropReward(s, now, withAd) {
  return Math.ceil(Math.max(incomePerSec(s, now) * (withAd ? 600 : 45), coinReward(s.stage) * (withAd ? 40 : 5)));
}

export const dayKey = (now) => new Date(now).toISOString().slice(0, 10);
export const dailyAvailable = (s, now) => s.daily.last !== dayKey(now);
export function claimDaily(s, now) {
  if (!dailyAvailable(s, now)) return 0;
  const gems = DAILY_GEMS[s.daily.day % DAILY_GEMS.length];
  s.daily.day++; s.daily.last = dayKey(now); s.gems += gems;
  return gems;
}

export const missionDone = (s, m) => (s.stats[m.stat] || 0) >= m.goal;
export function claimMission(s, id) {
  const m = MISSIONS.find((x) => x.id === id);
  if (!m || s.missions[id] || !missionDone(s, m)) return 0;
  s.missions[id] = true; s.gems += m.gems; return m.gems;
}
export const claimableMissions = (s) => MISSIONS.filter((m) => !s.missions[m.id] && missionDone(s, m)).length;

/** Consegna il contenuto di un prodotto in-app già pagato. */
export function grantProduct(s, p, now) {
  if (p.once && s.purchased[p.id]) return false;
  if (p.once) s.purchased[p.id] = true;
  if (p.gems) s.gems += p.gems;
  if (p.boost) addBoost(s, p.boost, now);
  if (p.perk) s.perks[p.perk] = true;
  return true;
}
