// Definizioni statiche del gioco. Le tabelle numeriche lunghe stanno in tables.js.

export const STAGES_PER_CHAPTER = 20;   // missioni 1-1 … 1-20; l'ultima è un boss
export const WAVES = [3, 3, 1];         // nemici per ondata; l'ultima ondata è il capo squadriglia
export const BOSS_TIME = 30;
export const OFFLINE_HOURS = 6;
export const DAILY_KEYS = 3;
export const SELL_BASE = 12;            // monete per un pezzo di livello 1 (+1,5% a livello)
export const START_WRENCHES = 40;

// Missione in cui si sblocca ogni funzione (numero progressivo: capitolo × 20 + missione).
const at = (chapter, n) => (chapter - 1) * STAGES_PER_CHAPTER + n;
export const UNLOCKS = {
  shop: at(1, 8), pass: at(1, 15), autoForge: at(2, 5), thief: at(2, 5),
  ghost: at(2, 12), maneuvers: at(2, 12), maneuver2: at(2, 12), tech1: at(2, 18),
  invasion: at(3, 3), drones: at(3, 3), drone1: at(3, 3), tech2: at(3, 8),
  arena: at(3, 12), chat: at(3, 12), swarm: at(3, 18), maneuver3: at(4, 5), tech3: at(4, 8),
  drone2: at(4, 12), alliance: at(4, 18), emblems: at(5, 3), maneuver4: at(5, 10), forge2: at(5, 18),
  tech4: at(6, 3), drone3: at(6, 8), forge3: at(7, 12), tech5: at(8, 3),
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
  { id: 'atkSpeed', max: 35 }, { id: 'crit', max: 10 }, { id: 'critDmg', max: 80 }, { id: 'damage', max: 12 },
  { id: 'double', max: 30 }, { id: 'health', max: 12 }, { id: 'regen', max: 5 }, { id: 'lifesteal', max: 15 },
  { id: 'block', max: 6 }, { id: 'skillCd', max: 8 }, { id: 'skillDmg', max: 25 },
];

// Rarità comuni a droni, manovre ed emblemi.
export const RARITIES = [
  { id: 'common', color: '#a7b1c2' }, { id: 'rare', color: '#7cc47f' }, { id: 'epic', color: '#9b8cf0' },
  { id: 'legendary', color: '#f2a25c' }, { id: 'ultimate', color: '#e5687a' }, { id: 'mythic', color: '#f2d27a' },
];

// Droni di scorta: escono dalle casse. Tre ruoli: attacco (più danno), equilibrio, scudo (più vita).
export const CRATE_SECONDS = [1200, 5400, 10800, 21600, 43200, 86400];
const ROLES = { atk: [1.6, 0.45], mid: [1, 1], tank: [0.5, 1.7] };
const drone = (id, r, role) => ({ id, r, role, dmg: 2.5 * Math.pow(4.6, r) * ROLES[role][0], hp: 40 * Math.pow(4.6, r) * ROLES[role][1] });
export const DRONES = [
  drone('grillo', 0, 'tank'), drone('ape', 0, 'tank'), drone('passero', 0, 'mid'), drone('rondone', 0, 'mid'), drone('merlo', 0, 'mid'), drone('vespa', 0, 'atk'),
  drone('gufo', 1, 'tank'), drone('corvo', 1, 'tank'), drone('gabbiano', 1, 'mid'), drone('airone', 1, 'atk'), drone('picchio', 1, 'atk'),
  drone('falco', 2, 'tank'), drone('nibbio', 2, 'tank'), drone('poiana', 2, 'mid'), drone('astore', 2, 'atk'), drone('sparviero', 2, 'atk'),
  drone('grifone', 3, 'tank'), drone('condor', 3, 'atk'), drone('albatro', 3, 'mid'),
  drone('fenice', 4, 'tank'), drone('pegaso', 4, 'mid'), drone('chimera', 4, 'atk'),
  drone('drago', 5, 'tank'), drone('idra', 5, 'mid'), drone('leviatano', 5, 'atk'),
];
export const DRONE_MAX_LEVEL = 100;

// Emblemi di squadriglia (dipinti sulla fusoliera): bonus % a danno e vita per rarità.
export const EMBLEM_BOOST = [8, 25, 55, 110, 200, 350];
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

// Lega settimanale dell'arena (le regole stanno in shared/social.js).
export const ARENA_TICKETS = 6;

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
export const ALLIANCE_CREATE_GEMS = 120;
