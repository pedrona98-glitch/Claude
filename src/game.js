// Logica di gioco pura: nessun accesso a DOM o storage, così è testabile con Node.
import {
  KILLS_PER_STAGE, STAGES_PER_CHAPTER, BOSS_TIME, OFFLINE_HOURS, BOOST_MAX_SECONDS, ALLIANCE_BONUS_PER_LEVEL,
  SLOTS, TIERS, SUBSTATS, WORKSHOP_MAX, PILOTS, PILOT_BONUS, AIRCRAFT, MISSIONS, DAILY_GEMS, WRENCHES_PER_STAGE,
} from './data.js';

export const SAVE_VERSION = 2;
const SPAWN_DELAY = 0.35;
const PILOT_GROWTH = 1.1;

const byId = (list) => Object.fromEntries(list.map((x) => [x.id, x]));
const SLOT = byId(SLOTS), PILOT = byId(PILOTS), PLANE = byId(AIRCRAFT);

export function newState(now = Date.now()) {
  return {
    v: SAVE_VERSION,
    coins: 0, gems: 0, wrenches: 30,
    stage: 1, kills: 0, farming: false, bossTimer: 0,
    parts: {},                       // slot -> pezzo montato
    pending: null,                   // pezzo appena costruito, in attesa di scelta
    auto: false,
    workshop: { level: 1, upgradeEnd: 0 },
    pilots: {},
    aircraft: { owned: ['libellula'], equipped: 'libellula' },
    perks: { noAds: false, doubleCoins: false },
    purchased: {},
    boostUntil: 0, adGemsAt: 0, adWrenchAt: 0,
    missions: {},
    daily: { day: 0, last: '' },
    stats: { maxStage: 1, kills: 0, bosses: 0, taps: 0, builds: 0, bossBest: 0 },
    settings: { sound: true, lang: null },
    buyMode: 1,
    lastSeen: now,
    online: { token: null, name: '', allyLevel: 0 },
    // runtime (non salvato)
    enemy: null, shotTimer: 0, spawnTimer: 0, hp: 0,
  };
}

const RUNTIME = ['enemy', 'shotTimer', 'spawnTimer', 'hp'];
// Dai salvataggi della versione precedente si conserva solo ciò che è stato comprato o scelto.
const KEEP_FROM_OLD = ['gems', 'aircraft', 'perks', 'purchased', 'settings', 'online', 'daily', 'adGemsAt'];

/** Unisce un salvataggio (anche vecchio o parziale) sopra uno stato nuovo. */
export function loadState(raw, now = Date.now()) {
  const s = newState(now);
  if (!raw || typeof raw !== 'object') return s;
  const keys = raw.v === SAVE_VERSION ? Object.keys(s) : KEEP_FROM_OLD;
  for (const k of keys) {
    if (RUNTIME.includes(k) || k === 'v' || raw[k] == null) continue;
    if (k === 'parts' || k === 'pending') { if (typeof raw[k] === 'object') s[k] = raw[k]; continue; }
    if (typeof s[k] === 'object' && !Array.isArray(s[k])) Object.assign(s[k], raw[k]);
    else if (typeof raw[k] === typeof s[k]) s[k] = raw[k];
  }
  for (const k of ['coins', 'gems', 'wrenches']) if (!isFinite(s[k]) || s[k] < 0) s[k] = 0;
  s.stage = Math.max(1, Math.floor(s.stage) || 1);
  if (!s.aircraft.owned.includes(s.aircraft.equipped)) s.aircraft.equipped = 'libellula';
  for (const k of Object.keys(s.parts)) if (!SLOT[k] || !validPart(s.parts[k])) delete s.parts[k];
  if (s.pending && !validPart(s.pending)) s.pending = null;
  if (isBoss(s.stage)) { s.stage -= 1; s.farming = true; s.kills = 0; } // mai riprendere a metà boss
  return s;
}
const validPart = (p) => p && SLOT[p.slot] && Number.isFinite(p.lvl) && TIERS[p.tier];

export function serialize(s) {
  const { enemy, shotTimer, spawnTimer, hp, ...rest } = s;
  return rest;
}

// ---------- missioni e nemici ----------
export const chapterOf = (stage) => Math.floor((stage - 1) / STAGES_PER_CHAPTER) + 1;
export const stageName = (stage) => `${chapterOf(stage)}-${((stage - 1) % STAGES_PER_CHAPTER) + 1}`;
export const isBoss = (stage) => stage % STAGES_PER_CHAPTER === 0;
export const enemyHp = (stage) => Math.ceil(20 * Math.pow(1.11, stage - 1) * (isBoss(stage) ? 6 : 1));
export const enemyAtk = (stage) => 1.1 * Math.pow(1.11, stage - 1) * (isBoss(stage) ? 2.5 : 1);
export const coinReward = (stage) => Math.ceil(3 * Math.pow(1.085, stage - 1) * (isBoss(stage) ? 10 : 1));

// ---------- officina e pezzi ----------
export const partMaxLevel = (workshopLevel) => 4 + 3 * workshopLevel;
export const maxTier = (workshopLevel) => Math.min(TIERS.length - 1, 1 + Math.floor(workshopLevel / 4));
/** Probabilità di ogni qualità al livello officina dato (somma 1). */
export function tierOdds(workshopLevel) {
  const r = Math.min(0.72, 0.16 + 0.022 * workshopLevel), top = maxTier(workshopLevel);
  const w = TIERS.map((_, t) => (t <= top ? Math.pow(r, t) : 0));
  const sum = w.reduce((a, b) => a + b, 0);
  return w.map((x) => x / sum);
}
export const partMain = (p) => SLOT[p.slot].base * Math.pow(1.12, p.lvl) * TIERS[p.tier].mult;
export const partSell = (p) => Math.ceil(3 * Math.pow(1.12, p.lvl) * TIERS[p.tier].mult);

export function rollPart(workshopLevel, rnd = Math.random) {
  const slot = SLOTS[Math.floor(rnd() * SLOTS.length)].id;
  const lvl = Math.max(1, partMaxLevel(workshopLevel) - Math.floor(rnd() * rnd() * 7));
  const odds = tierOdds(workshopLevel);
  let roll = rnd(), tier = 0;
  while (tier < odds.length - 1 && roll >= odds[tier]) { roll -= odds[tier]; tier++; }
  const part = { slot, lvl, tier };
  if (tier > 0) {
    const sub = SUBSTATS[Math.floor(rnd() * SUBSTATS.length)];
    part.sub = sub.id; part.val = Math.round(sub.unit * (1 + tier) * (0.6 + 0.4 * rnd()) * 10) / 10;
  }
  return part;
}

/** Costruisce un pezzo. Lo slot vuoto si riempie da solo; altrimenti resta in attesa di monta/vendi. */
export function build(s, rnd = Math.random) {
  if (s.pending || s.wrenches < 1) return null;
  s.wrenches -= 1; s.stats.builds++;
  const part = rollPart(s.workshop.level, rnd);
  if (!s.parts[part.slot]) { s.parts[part.slot] = part; return { part, equipped: true }; }
  s.pending = part;
  return { part, equipped: false };
}
export const isUpgrade = (s, part) => !s.parts[part.slot] || partMain(part) > partMain(s.parts[part.slot]);
/** Monta il pezzo in attesa (vendendo quello vecchio) oppure lo vende. Restituisce le monete incassate. */
export function resolvePending(s, equip) {
  const part = s.pending;
  if (!part) return 0;
  s.pending = null;
  const sold = equip ? s.parts[part.slot] : part;
  if (equip) s.parts[part.slot] = part;
  const coins = sold ? partSell(sold) : 0;
  s.coins += coins;
  return coins;
}
/** Costruzione automatica: monta se migliora, altrimenti vende. */
export function autoBuild(s, rnd = Math.random) {
  const r = build(s, rnd);
  if (!r) return null;
  if (!r.equipped) { r.equipped = isUpgrade(s, r.part); r.coins = resolvePending(s, r.equipped); }
  return r;
}

export const workshopCost = (level) => Math.ceil(60 * Math.pow(1.75, level - 1));
export const workshopSeconds = (level) => Math.round(20 * Math.pow(1.62, level - 1));
export const workshopBusy = (s, now) => s.workshop.upgradeEnd > now;
export function startWorkshopUpgrade(s, now) {
  const w = s.workshop, cost = workshopCost(w.level);
  if (w.upgradeEnd || w.level >= WORKSHOP_MAX || s.coins < cost) return false;
  s.coins -= cost; w.upgradeEnd = now + workshopSeconds(w.level) * 1000;
  return true;
}
/** Da chiamare periodicamente: completa il potenziamento quando il tempo è scaduto. */
export function finishWorkshopUpgrade(s, now) {
  const w = s.workshop;
  if (!w.upgradeEnd || w.upgradeEnd > now) return false;
  w.upgradeEnd = 0; w.level++;
  return true;
}
export const skipGems = (s, now) => Math.max(1, Math.ceil((s.workshop.upgradeEnd - now) / 1000 / 180));
export function skipWorkshopUpgrade(s, now) {
  if (!workshopBusy(s, now)) return false;
  const gems = skipGems(s, now);
  if (s.gems < gems) return false;
  s.gems -= gems; s.workshop.upgradeEnd = now;
  return finishWorkshopUpgrade(s, now);
}
export function speedWorkshopUpgrade(s, seconds, now) {
  if (workshopBusy(s, now)) s.workshop.upgradeEnd = Math.max(now, s.workshop.upgradeEnd - seconds * 1000);
}

// ---------- statistiche ----------
const sumMain = (s, stat) => SLOTS.reduce((t, sl) => t + (sl.stat === stat && s.parts[sl.id] ? partMain(s.parts[sl.id]) : 0), 0);
export const subTotal = (s, id) => SLOTS.reduce((t, sl) => t + (s.parts[sl.id] && s.parts[sl.id].sub === id ? s.parts[sl.id].val : 0), 0);
export const pilotLevels = (s) => PILOTS.reduce((t, p) => t + (s.pilots[p.id] || 0), 0);
export const pilotBonus = (s) => 1 + PILOT_BONUS * pilotLevels(s);
export const allianceBonus = (s) => 1 + ALLIANCE_BONUS_PER_LEVEL * (s.online.allyLevel || 0);
export const globalMult = (s) => PLANE[s.aircraft.equipped].mult * allianceBonus(s) * pilotBonus(s);
export const shotDamage = (s) => (4 + sumMain(s, 'atk')) * globalMult(s);
export const squadMaxHp = (s) => (60 + sumMain(s, 'hp')) * globalMult(s);
export const fireRate = (s) => 1.5 * (1 + subTotal(s, 'rate') / 100);
export const critChance = (s) => Math.min(0.75, 0.05 + subTotal(s, 'crit') / 100);
export const critMult = (s) => 2 + subTotal(s, 'critDmg') / 100;
export const tapDamage = (s) => shotDamage(s) * 2;
export const totalDps = (s) => shotDamage(s) * fireRate(s) * (1 + critChance(s) * (critMult(s) - 1));
/** Potenza complessiva, usata in arena: conta quanto il danno quanto la resistenza. */
export const power = (s) => Math.sqrt(totalDps(s) * squadMaxHp(s));

export const boostActive = (s, now) => s.boostUntil > now;
export function coinMult(s, now) {
  return (1 + subTotal(s, 'coins') / 100) * (s.perks.doubleCoins ? 2 : 1) * (boostActive(s, now) ? 2 : 1);
}
/** Stima monete/secondo sulla missione attuale (usata per offline, rifornimenti, salto temporale). */
export function incomePerSec(s, now) {
  const stage = isBoss(s.stage) ? s.stage - 1 : s.stage;
  return coinReward(stage) * coinMult(s, now) / (SPAWN_DELAY + enemyHp(stage) / totalDps(s));
}

// ---------- gregari ----------
export function pilotCost(id, lvl) { return Math.ceil(PILOT[id].baseCost * Math.pow(PILOT_GROWTH, lvl)); }
function bulk(costFn, lvl, n) { return Math.ceil(costFn(lvl) * (Math.pow(PILOT_GROWTH, n) - 1) / (PILOT_GROWTH - 1)); }
function maxAfford(costFn, lvl, coins) {
  const c = costFn(lvl);
  if (coins < c) return 0;
  let n = Math.floor(Math.log(coins * (PILOT_GROWTH - 1) / c + 1) / Math.log(PILOT_GROWTH));
  while (n > 0 && bulk(costFn, lvl, n) > coins) n--;
  return n;
}
/** Quanti livelli comprerebbe la modalità corrente (1, 10 o 'max') e a che prezzo. */
export function quote(s, id) {
  const lvl = s.pilots[id] || 0, costFn = (l) => pilotCost(id, l);
  const n = s.buyMode === 'max' ? Math.max(1, maxAfford(costFn, lvl, s.coins)) : s.buyMode;
  return { n, cost: bulk(costFn, lvl, n) };
}
export function buyPilot(s, id) {
  const q = quote(s, id);
  if (!q.n || s.coins < q.cost) return false;
  s.coins -= q.cost; s.pilots[id] = (s.pilots[id] || 0) + q.n;
  return true;
}

// ---------- combattimento ----------
function spawn(s, events) {
  const boss = isBoss(s.stage);
  const hp = enemyHp(s.stage);
  s.enemy = { hp, maxHp: hp, boss };
  if (boss) s.bossTimer = BOSS_TIME;
  if (!(s.hp > 0)) s.hp = squadMaxHp(s);
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
    if (s.stage > s.stats.bossBest) { s.stats.bossBest = s.stage; s.gems += 2; events.push({ t: 'gem', n: 2 }); }
    clearStage(s, events, WRENCHES_PER_STAGE * 4);
    advance(s, events);
  } else if (++s.kills >= KILLS_PER_STAGE) {
    clearStage(s, events, WRENCHES_PER_STAGE);
    if (s.farming) { s.kills = 0; s.hp = squadMaxHp(s); } else advance(s, events);
  }
}
function clearStage(s, events, wrenches) {
  s.wrenches += wrenches;
  events.push({ t: 'wrench', n: wrenches });
}
function advance(s, events) {
  s.stage++; s.kills = 0; s.hp = squadMaxHp(s);
  s.stats.maxStage = Math.max(s.stats.maxStage, s.stage);
  events.push({ t: 'stage', stage: s.stage });
}

/** Sconfitta o boss fuggito: si arretra di una missione e si resta in pattuglia. */
function retreat(s) {
  s.enemy = null; s.kills = 0; s.farming = true; s.spawnTimer = SPAWN_DELAY * 3;
  s.stage = Math.max(1, s.stage - 1);
  if (isBoss(s.stage)) s.stage -= 1;
  s.hp = squadMaxHp(s);
}

export function tick(s, dt, now, events = []) {
  if (finishWorkshopUpgrade(s, now)) events.push({ t: 'workshop', level: s.workshop.level });
  if (!s.enemy) {
    s.spawnTimer -= dt;
    if (s.spawnTimer > 0) return events;
    spawn(s, events);
  }
  if (s.enemy.boss) {
    s.bossTimer -= dt;
    if (s.bossTimer <= 0) {
      retreat(s);
      events.push({ t: 'bossFail' });
      return events;
    }
  }
  s.hp = Math.min(s.hp, squadMaxHp(s)) - enemyAtk(s.stage) * dt;
  if (s.hp <= 0) {
    retreat(s);
    events.push({ t: 'defeat' });
    return events;
  }
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
  s.farming = false; s.stage += 1; s.kills = 0; s.enemy = null; s.spawnTimer = 0; s.hp = squadMaxHp(s);
  return true;
}

// ---------- aerei ----------
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

// ---------- tempo: offline, boost, premi ----------
export const offlineCap = () => OFFLINE_HOURS * 3600;
export function offlineEarnings(s, seconds, now) {
  const secs = Math.min(Math.max(0, seconds), offlineCap());
  return { secs, coins: Math.floor(incomePerSec(s, now) * secs * 0.5), wrenches: Math.floor(secs / 240) };
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
  s.daily.day++; s.daily.last = dayKey(now); s.gems += gems; s.wrenches += 20;
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
  if (p.wrenches) s.wrenches += p.wrenches;
  if (p.boost) addBoost(s, p.boost, now);
  if (p.perk) s.perks[p.perk] = true;
  return true;
}
