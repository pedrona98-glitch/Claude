// Definizioni statiche del gioco. Le tabelle numeriche lunghe stanno in tables.js.

export const STAGES_PER_CHAPTER = 20;   // missioni 1-1 … 1-20; l'ultima è un boss
export const WAVES = [3, 3, 1];         // nemici per ondata; l'ultima ondata è il capo squadriglia
export const BOSS_TIME = 30;
export const OFFLINE_HOURS = 4;
export const DAILY_KEYS = 2;
export const SELL_BASE = 20;            // monete per un pezzo di livello 1
export const START_WRENCHES = 40;

// Missione in cui si sblocca ogni funzione (numero progressivo: capitolo × 20 + missione).
const at = (chapter, n) => (chapter - 1) * STAGES_PER_CHAPTER + n;
export const UNLOCKS = {
  shop: at(2, 1), pass: at(2, 5), autoForge: at(2, 10), thief: at(2, 10),
  ghost: at(2, 15), maneuvers: at(2, 15), tech1: at(2, 15), maneuver2: at(2, 15),
  invasion: at(3, 1), drones: at(3, 1), tech2: at(3, 1), drone1: at(3, 1),
  arena: at(3, 10), chat: at(3, 10),
  swarm: at(4, 1), maneuver3: at(4, 1), tech3: at(4, 1), drone2: at(4, 10),
  alliance: at(4, 15), emblems: at(4, 15), maneuver4: at(5, 1), forge2: at(5, 15),
  drone3: at(6, 1), tech4: at(6, 1), forge3: at(7, 15), tech5: at(8, 1),
};

// Dieci epoche dell'aviazione: la qualità dei pezzi costruiti.
export const AGES = [
  { id: 'pioneer', color: '#a7b1c2', shape: 'biplane', war: 1 },
  { id: 'greatwar', color: '#7cc47f', shape: 'biplane', war: 1 },
  { id: 'golden', color: '#5aa9e6', shape: 'mono', war: 1 },
  { id: 'prop', color: '#9b8cf0', shape: 'fighter', war: 2 },
  { id: 'jet', color: '#f2a25c', shape: 'jet', war: 2 },
  { id: 'supersonic', color: '#e5687a', shape: 'jet', war: 2 },
  { id: 'stealth', color: '#4fd1c5', shape: 'stealth', war: 2 },
  { id: 'space', color: '#7f9cf5', shape: 'stealth', war: 3 },
  { id: 'orbital', color: '#f687b3', shape: 'stealth', war: 3 },
  { id: 'mythic', color: '#f2d27a', shape: 'stealth', war: 3 },
];
export const AGE_MULT = 2.6;

// Otto posti sull'aereo: quattro danno, quattro vita.
export const SLOTS = [
  { id: 'guns', icon: 'gun', stat: 'atk', base: 6 },
  { id: 'engine', icon: 'engine', stat: 'atk', base: 6 },
  { id: 'prop', icon: 'prop', stat: 'atk', base: 6 },
  { id: 'sight', icon: 'target', stat: 'atk', base: 6 },
  { id: 'hull', icon: 'plane', stat: 'hp', base: 60 },
  { id: 'wings', icon: 'wing', stat: 'hp', base: 60 },
  { id: 'armor', icon: 'armor', stat: 'hp', base: 60 },
  { id: 'gear', icon: 'wheel', stat: 'hp', base: 60 },
];

// Statistiche secondarie: valore massimo (%) su un singolo pezzo.
export const SUBSTATS = [
  { id: 'atkSpeed', max: 40 }, { id: 'crit', max: 12 }, { id: 'critDmg', max: 100 }, { id: 'damage', max: 15 },
  { id: 'double', max: 40 }, { id: 'health', max: 15 }, { id: 'regen', max: 6 }, { id: 'lifesteal', max: 20 },
  { id: 'block', max: 5 }, { id: 'skillCd', max: 7 }, { id: 'skillDmg', max: 30 },
];

// Rarità comuni a droni, manovre ed emblemi.
export const RARITIES = [
  { id: 'common', color: '#a7b1c2' }, { id: 'rare', color: '#7cc47f' }, { id: 'epic', color: '#9b8cf0' },
  { id: 'legendary', color: '#f2a25c' }, { id: 'ultimate', color: '#e5687a' }, { id: 'mythic', color: '#f2d27a' },
];

// Droni di scorta: escono dalle casse. Danno e vita di base al livello 1.
export const CRATE_SECONDS = [1800, 7200, 14400, 28800, 57600, 115200];
export const DRONES = [
  { id: 'grillo', r: 0, dmg: 50, hp: 1200 }, { id: 'ape', r: 0, dmg: 50, hp: 1200 }, { id: 'passero', r: 0, dmg: 100, hp: 800 },
  { id: 'rondone', r: 0, dmg: 100, hp: 800 }, { id: 'merlo', r: 0, dmg: 100, hp: 800 }, { id: 'vespa', r: 0, dmg: 150, hp: 400 },
  { id: 'gufo', r: 1, dmg: 250, hp: 6000 }, { id: 'corvo', r: 1, dmg: 250, hp: 6000 }, { id: 'gabbiano', r: 1, dmg: 500, hp: 4000 },
  { id: 'airone', r: 1, dmg: 750, hp: 2000 }, { id: 'picchio', r: 1, dmg: 750, hp: 2000 },
  { id: 'falco', r: 2, dmg: 1250, hp: 30000 }, { id: 'nibbio', r: 2, dmg: 1250, hp: 30000 }, { id: 'poiana', r: 2, dmg: 2500, hp: 20000 },
  { id: 'astore', r: 2, dmg: 3750, hp: 10000 }, { id: 'sparviero', r: 2, dmg: 3750, hp: 10000 },
  { id: 'grifone', r: 3, dmg: 12500, hp: 100000 }, { id: 'condor', r: 3, dmg: 18750, hp: 50000 }, { id: 'albatro', r: 3, dmg: 18750, hp: 50000 },
  { id: 'fenice', r: 4, dmg: 31200, hp: 750000 }, { id: 'pegaso', r: 4, dmg: 62500, hp: 500000 }, { id: 'chimera', r: 4, dmg: 93700, hp: 250000 },
  { id: 'drago', r: 5, dmg: 156250, hp: 3750000 }, { id: 'idra', r: 5, dmg: 312500, hp: 2500000 }, { id: 'leviatano', r: 5, dmg: 468750, hp: 1250000 },
];
export const DRONE_SCALE = 0.04;        // i valori di riferimento sono su una scala più grande della nostra
export const DRONE_MAX_LEVEL = 100;

// Emblemi di squadriglia (dipinti sulla fusoliera): bonus % a danno e vita per rarità.
export const EMBLEM_BOOST = [10, 40, 80, 150, 250, 400];
export const EMBLEM_COST = 50;          // vernice per un richiamo
export const EMBLEMS = [
  { id: 'star', r: 0 }, { id: 'arrow', r: 0 }, { id: 'roundel', r: 0 },
  { id: 'spade', r: 1 }, { id: 'wolf', r: 1 }, { id: 'cat', r: 1 }, { id: 'skull', r: 1 },
  { id: 'devil', r: 2 }, { id: 'shark', r: 2 },
  { id: 'stallion', r: 3 }, { id: 'eagle', r: 3 },
  { id: 'dragon', r: 4 }, { id: 'phoenix', r: 4 },
  { id: 'comet', r: 5 }, { id: 'blacksun', r: 5 },
];

// Manovre: abilità attive con ricarica. `k` è il moltiplicatore sul danno del giocatore.
export const MANEUVERS = [
  { id: 'burst', r: 0, cd: 8, kind: 'hit', k: 3 },
  { id: 'patch', r: 0, cd: 14, kind: 'heal', k: 0.15 },
  { id: 'rockets', r: 1, cd: 12, kind: 'hit', k: 7 },
  { id: 'roll', r: 1, cd: 16, kind: 'shield', k: 3 },
  { id: 'afterburner', r: 2, cd: 18, kind: 'haste', k: 0.6, dur: 8 },
  { id: 'bombs', r: 2, cd: 15, kind: 'hit', k: 14 },
  { id: 'torpedo', r: 3, cd: 16, kind: 'hit', k: 26 },
  { id: 'formation', r: 3, cd: 22, kind: 'fury', k: 1, dur: 10 },
  { id: 'missile', r: 4, cd: 18, kind: 'hit', k: 50 },
  { id: 'plating', r: 4, cd: 24, kind: 'heal', k: 0.45 },
  { id: 'storm', r: 5, cd: 20, kind: 'hit', k: 100 },
  { id: 'rebirth', r: 5, cd: 30, kind: 'fury', k: 2, dur: 12 },
];
export const MANEUVER_LEVEL_STEP = 10;  // richiami per salire di livello di reclutamento
export const MANEUVER_MAX_LEVEL = 255;

// Ricerca: tre rami, ogni nodo ha 25 livelli (5 gradi da 5). `v` è il bonus per livello.
export const TECH = [
  { id: 'forgeTime', branch: 'forge', v: 4 }, { id: 'forgeCost', branch: 'forge', v: 2 },
  { id: 'sellPrice', branch: 'forge', v: 2 }, { id: 'freeForge', branch: 'forge', v: 1 },
  { id: 'autoForge', branch: 'forge', v: 1, perTier: true }, { id: 'thiefWrench', branch: 'forge', v: 2 },
  { id: 'thiefCoin', branch: 'forge', v: 2 }, { id: 'offlineTime', branch: 'forge', v: 16 },
  { id: 'offlineCoin', branch: 'forge', v: 2 }, { id: 'offlineWrench', branch: 'forge', v: 2 },
  { id: 'atkMastery', branch: 'power', v: 2 }, { id: 'hpMastery', branch: 'power', v: 2 },
  { id: 'partLevel', branch: 'power', v: 2 }, { id: 'emblemAtk', branch: 'power', v: 2 },
  { id: 'emblemHp', branch: 'power', v: 2 }, { id: 'emblemCost', branch: 'power', v: 1 },
  { id: 'emblemExtra', branch: 'power', v: 2 },
  { id: 'maneuverDmg', branch: 'squad', v: 2 }, { id: 'maneuverCd', branch: 'squad', v: 1 },
  { id: 'droneAtk', branch: 'squad', v: 2 }, { id: 'droneHp', branch: 'squad', v: 2 },
  { id: 'crateSpeed', branch: 'squad', v: 4 }, { id: 'crateExtra', branch: 'squad', v: 2 },
  { id: 'planBonus', branch: 'squad', v: 2 },
];
export const TECH_TIER_UNLOCK = ['tech1', 'tech2', 'tech3', 'tech4', 'tech5'];

// Dungeon: chiavi giornaliere, livelli 1-1 … 10-10.
export const DUNGEONS = [
  { id: 'thief', icon: 'wrench' }, { id: 'ghost', icon: 'flag' },
  { id: 'invasion', icon: 'crate' }, { id: 'swarm', icon: 'flask' },
];

// Lega settimanale dell'arena: 100 piloti per girone.
export const LEAGUES = [
  { id: 'unranked', up: 90, down: 101 }, { id: 'bronze', up: 80, down: 101 }, { id: 'silver', up: 50, down: 90 },
  { id: 'gold', up: 20, down: 80 }, { id: 'platinum', up: 10, down: 70 }, { id: 'diamond', up: 0, down: 36 },
];
export const ARENA_TICKETS = 5;

// Obiettivi: stat = chiave in state.stats, ricompensa in gemme.
export const MISSIONS = [
  { id: 'st21', stat: 'maxStage', goal: 21, gems: 10 }, { id: 'st41', stat: 'maxStage', goal: 41, gems: 20 },
  { id: 'st61', stat: 'maxStage', goal: 61, gems: 30 }, { id: 'st81', stat: 'maxStage', goal: 81, gems: 40 },
  { id: 'st121', stat: 'maxStage', goal: 121, gems: 60 }, { id: 'st161', stat: 'maxStage', goal: 161, gems: 80 },
  { id: 'bd100', stat: 'builds', goal: 100, gems: 5 }, { id: 'bd1k', stat: 'builds', goal: 1000, gems: 15 },
  { id: 'bd10k', stat: 'builds', goal: 10000, gems: 40 }, { id: 'fl5', stat: 'forgeLevel', goal: 5, gems: 15 },
  { id: 'fl10', stat: 'forgeLevel', goal: 10, gems: 40 }, { id: 'dg10', stat: 'dungeons', goal: 10, gems: 10 },
  { id: 'dg100', stat: 'dungeons', goal: 100, gems: 40 }, { id: 'hc10', stat: 'hatched', goal: 10, gems: 15 },
  { id: 'k1k', stat: 'kills', goal: 1000, gems: 10 }, { id: 'k20k', stat: 'kills', goal: 20000, gems: 40 },
];
export const DAILY_GEMS = [10, 10, 20, 20, 30, 30, 60];

// Pass di volo: 30 gradi in 30 giorni, ricompensa gratuita e premium a ogni grado.
export const PASS_TIERS = 30;
export const PASS_XP = 120;
export const PASS_DAYS = 30;

// Prodotti in-app. Gli id devono coincidere con quelli creati su App Store Connect / Google Play.
export const PRODUCTS = [
  { id: 'starter_pack', icon: 'gift', price: '1,99 €', gems: 300, wrenches: 500, once: true },
  { id: 'premium_pass', icon: 'star', price: '9,99 €', perk: 'premiumPass', season: true },
  { id: 'gems_80', icon: 'gem', price: '0,99 €', gems: 80 },
  { id: 'gems_500', icon: 'gem', price: '4,99 €', gems: 500 },
  { id: 'gems_1200', icon: 'gem', price: '9,99 €', gems: 1200 },
  { id: 'gems_3000', icon: 'gem', price: '19,99 €', gems: 3000 },
  { id: 'remove_ads', icon: 'noads', price: '3,99 €', perk: 'noAds', once: true },
];

// Offerte in gemme nel Negozio.
export const GEM_OFFERS = [
  { id: 'wrenches', gems: 50, give: { wrenches: 250 } },
  { id: 'keys', gems: 60, give: { keys: 1 } },
  { id: 'paint', gems: 100, give: { paint: 50 } },
  { id: 'plans', gems: 100, give: { plans: 10 } },
];

export const AD_REWARDS = {
  wrenches: { give: { wrenches: 60 }, cooldown: 10 * 60 },
  gems: { give: { gems: 5 }, cooldown: 15 * 60 },
};
export const AD_SPEEDUP_SECONDS = 30 * 60;
export const ALLIANCE_CREATE_GEMS = 150;
