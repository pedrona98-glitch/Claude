// Definizioni statiche del gioco (bilanciamento incluso).

export const KILLS_PER_STAGE = 6;
export const STAGES_PER_CHAPTER = 10; // l'ultima missione di ogni capitolo è un boss
export const BOSS_TIME = 30;
export const OFFLINE_HOURS = 4;
export const BOOST_MAX_SECONDS = 2 * 3600;
export const WRENCHES_PER_STAGE = 3;
export const WORKSHOP_MAX = 40;

// Posti sull'aereo: quattro pezzi danno danno, quattro danno vita.
export const SLOTS = [
  { id: 'guns', icon: 'gun', stat: 'atk', base: 2 },
  { id: 'engine', icon: 'engine', stat: 'atk', base: 2 },
  { id: 'prop', icon: 'prop', stat: 'atk', base: 2 },
  { id: 'sight', icon: 'target', stat: 'atk', base: 2 },
  { id: 'hull', icon: 'plane', stat: 'hp', base: 22 },
  { id: 'wings', icon: 'wing', stat: 'hp', base: 22 },
  { id: 'armor', icon: 'armor', stat: 'hp', base: 22 },
  { id: 'gear', icon: 'wheel', stat: 'hp', base: 22 },
];

// Qualità dei pezzi, dalla più comune alla più rara.
export const TIERS = [
  { id: 'canvas', mult: 1, color: '#8d9db8' },
  { id: 'steel', mult: 1.5, color: '#6fcf97' },
  { id: 'aluminium', mult: 2.2, color: '#5aa9e6' },
  { id: 'titanium', mult: 3.3, color: '#b08cf0' },
  { id: 'carbon', mult: 5, color: '#f2a25c' },
  { id: 'prototype', mult: 7.5, color: '#e5687a' },
  { id: 'legend', mult: 11, color: '#f2d27a' },
];

// Bonus secondari dei pezzi non comuni. `unit` è il valore percentuale per grado di qualità.
export const SUBSTATS = [
  { id: 'crit', unit: 0.8 },
  { id: 'critDmg', unit: 5 },
  { id: 'rate', unit: 1.2 },
  { id: 'coins', unit: 3 },
];

// Gregari: ogni livello aumenta danno e vita di tutta la squadriglia.
export const PILOT_BONUS = 0.03;
export const PILOTS = [
  { id: 'falco', color: '#e9b44c', baseCost: 40 },
  { id: 'vespa', color: '#f25f5c', baseCost: 400 },
  { id: 'tuono', color: '#70c1b3', baseCost: 4e3 },
  { id: 'cometa', color: '#9b8cff', baseCost: 5e4 },
  { id: 'ombra', color: '#7d8597', baseCost: 7e5 },
  { id: 'aquila', color: '#ff9f1c', baseCost: 1e7 },
  { id: 'zenit', color: '#2ec4b6', baseCost: 1.5e8 },
  { id: 'nova', color: '#ff5d8f', baseCost: 2.5e9 },
];

// Aerei del giocatore (si comprano con le gemme).
export const AIRCRAFT = [
  { id: 'libellula', mult: 1, gems: 0, shape: 'biplane', color: '#d95d39' },
  { id: 'rondine', mult: 1.5, gems: 60, shape: 'mono', color: '#3a86ff' },
  { id: 'gheppio', mult: 2.2, gems: 200, shape: 'fighter', color: '#2a9d8f' },
  { id: 'saetta', mult: 3.2, gems: 500, shape: 'jet', color: '#c0c7d1' },
  { id: 'spettro', mult: 4.5, gems: 1200, shape: 'stealth', color: '#3d405b' },
];

// Obiettivi: stat = chiave in state.stats, ricompensa in gemme.
export const MISSIONS = [
  { id: 'st10', stat: 'maxStage', goal: 11, gems: 5 },
  { id: 'st30', stat: 'maxStage', goal: 31, gems: 10 },
  { id: 'st60', stat: 'maxStage', goal: 61, gems: 20 },
  { id: 'st100', stat: 'maxStage', goal: 101, gems: 40 },
  { id: 'st200', stat: 'maxStage', goal: 201, gems: 80 },
  { id: 'bd50', stat: 'builds', goal: 50, gems: 5 },
  { id: 'bd500', stat: 'builds', goal: 500, gems: 15 },
  { id: 'bd5k', stat: 'builds', goal: 5000, gems: 40 },
  { id: 'k100', stat: 'kills', goal: 100, gems: 5 },
  { id: 'k2k', stat: 'kills', goal: 2000, gems: 15 },
  { id: 'k20k', stat: 'kills', goal: 20000, gems: 40 },
  { id: 'b5', stat: 'bosses', goal: 5, gems: 10 },
  { id: 'b30', stat: 'bosses', goal: 30, gems: 40 },
  { id: 'tap500', stat: 'taps', goal: 500, gems: 10 },
];

export const DAILY_GEMS = [5, 5, 10, 10, 15, 15, 30];

// Prodotti in-app. Gli id devono coincidere con quelli creati su App Store Connect / Google Play.
export const PRODUCTS = [
  { id: 'starter_pack', icon: 'gift', price: '1,99 €', gems: 300, wrenches: 200, once: true },
  { id: 'gems_80', icon: 'gem', price: '0,99 €', gems: 80 },
  { id: 'gems_500', icon: 'gem', price: '4,99 €', gems: 500 },
  { id: 'gems_1200', icon: 'gem', price: '9,99 €', gems: 1200 },
  { id: 'gems_3000', icon: 'gem', price: '19,99 €', gems: 3000 },
  { id: 'double_coins', icon: 'coin', price: '4,99 €', perk: 'doubleCoins', once: true },
  { id: 'remove_ads', icon: 'noads', price: '3,99 €', perk: 'noAds', once: true },
];

export const AD_GEMS = 5;
export const AD_GEMS_COOLDOWN = 15 * 60; // secondi
export const AD_WRENCHES = 25;
export const AD_WRENCH_COOLDOWN = 10 * 60;
export const AD_BOOST_SECONDS = 15 * 60;
export const AD_SPEEDUP_SECONDS = 30 * 60;
export const WRENCH_PACK = { wrenches: 60, gems: 30 };
export const DROP_INTERVAL = [70, 130]; // secondi tra un rifornimento aereo e l'altro

// Arena: leghe in base ai trofei.
export const LEAGUES = [
  { id: 'bronze', min: 0 }, { id: 'silver', min: 1100 }, { id: 'gold', min: 1250 },
  { id: 'platinum', min: 1400 }, { id: 'diamond', min: 1600 }, { id: 'legend', min: 1850 },
];
export const ALLIANCE_CREATE_GEMS = 50;
export const ALLIANCE_BONUS_PER_LEVEL = 0.02;
