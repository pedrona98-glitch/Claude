// Definizioni statiche del gioco (bilanciamento incluso).

export const KILLS_PER_STAGE = 10;
export const BOSS_EVERY = 5;
export const BOSS_TIME = 30;
export const PRESTIGE_MIN_STAGE = 25;
export const OFFLINE_BASE_HOURS = 2;
export const BOOST_MAX_SECONDS = 2 * 3600;

// Potenziamenti dell'aereo del giocatore (si comprano con le monete).
export const UPGRADES = [
  { id: 'cannon', icon: '🔫', baseCost: 10, growth: 1.08, max: Infinity },
  { id: 'rate', icon: '⚡', baseCost: 60, growth: 1.32, max: 40 },
  { id: 'crit', icon: '🎯', baseCost: 120, growth: 1.36, max: 45 },
  { id: 'critDmg', icon: '💥', baseCost: 250, growth: 1.3, max: 80 },
  { id: 'cargo', icon: '📦', baseCost: 180, growth: 1.27, max: 200 },
];

// Gregari: la squadriglia che fa danno automatico.
export const PILOTS = [
  { id: 'falco', color: '#e9b44c', baseCost: 50, baseDps: 4 },
  { id: 'vespa', color: '#f25f5c', baseCost: 600, baseDps: 28 },
  { id: 'tuono', color: '#70c1b3', baseCost: 8e3, baseDps: 220 },
  { id: 'cometa', color: '#9b8cff', baseCost: 1.2e5, baseDps: 2e3 },
  { id: 'ombra', color: '#7d8597', baseCost: 2e6, baseDps: 1.9e4 },
  { id: 'aquila', color: '#ff9f1c', baseCost: 4e7, baseDps: 2e5 },
  { id: 'zenit', color: '#2ec4b6', baseCost: 9e8, baseDps: 2.2e6 },
  { id: 'nova', color: '#ff5d8f', baseCost: 2.5e10, baseDps: 2.6e7 },
];

// Aerei del giocatore (si comprano con le gemme, restano dopo la Nuova Campagna).
export const AIRCRAFT = [
  { id: 'libellula', mult: 1, gems: 0, shape: 'biplane', color: '#d95d39' },
  { id: 'rondine', mult: 2, gems: 60, shape: 'mono', color: '#3a86ff' },
  { id: 'gheppio', mult: 4, gems: 200, shape: 'fighter', color: '#2a9d8f' },
  { id: 'saetta', mult: 8, gems: 500, shape: 'jet', color: '#c0c7d1' },
  { id: 'spettro', mult: 16, gems: 1200, shape: 'stealth', color: '#3d405b' },
];

// Talenti permanenti (si comprano con le medaglie).
export const TALENTS = [
  { id: 'loot', icon: '💰', max: 20, cost: (l) => 2 * (l + 1) },
  { id: 'fuel', icon: '⛽', max: 6, cost: (l) => 3 * (l + 1) },
  { id: 'start', icon: '🛫', max: 10, cost: (l) => 5 * (l + 1) },
  { id: 'clock', icon: '⏱️', max: 6, cost: (l) => 4 * (l + 1) },
];

// Missioni: stat = chiave in state.stats, ricompensa in gemme.
export const MISSIONS = [
  { id: 'st10', stat: 'maxStage', goal: 10, gems: 5 },
  { id: 'st25', stat: 'maxStage', goal: 25, gems: 10 },
  { id: 'st50', stat: 'maxStage', goal: 50, gems: 20 },
  { id: 'st100', stat: 'maxStage', goal: 100, gems: 40 },
  { id: 'st200', stat: 'maxStage', goal: 200, gems: 80 },
  { id: 'k100', stat: 'kills', goal: 100, gems: 5 },
  { id: 'k2k', stat: 'kills', goal: 2000, gems: 15 },
  { id: 'k20k', stat: 'kills', goal: 20000, gems: 40 },
  { id: 'b10', stat: 'bosses', goal: 10, gems: 10 },
  { id: 'b100', stat: 'bosses', goal: 100, gems: 40 },
  { id: 'p1', stat: 'prestiges', goal: 1, gems: 15 },
  { id: 'p5', stat: 'prestiges', goal: 5, gems: 40 },
  { id: 'tap500', stat: 'taps', goal: 500, gems: 10 },
];

export const DAILY_GEMS = [5, 5, 10, 10, 15, 15, 30];

// Prodotti in-app. Gli id devono coincidere con quelli creati su App Store Connect / Google Play.
export const PRODUCTS = [
  { id: 'starter_pack', icon: '🎁', price: '1,99 €', gems: 300, boost: 1800, once: true },
  { id: 'gems_80', icon: '💎', price: '0,99 €', gems: 80 },
  { id: 'gems_500', icon: '💎', price: '4,99 €', gems: 500 },
  { id: 'gems_1200', icon: '💎', price: '9,99 €', gems: 1200 },
  { id: 'gems_3000', icon: '💎', price: '19,99 €', gems: 3000 },
  { id: 'double_coins', icon: '🪙', price: '4,99 €', perk: 'doubleCoins', once: true },
  { id: 'remove_ads', icon: '🚫', price: '3,99 €', perk: 'noAds', once: true },
];

export const AD_GEMS = 5;
export const AD_GEMS_COOLDOWN = 15 * 60; // secondi
export const AD_BOOST_SECONDS = 15 * 60;
export const WARP_GEMS = 25;
export const WARP_SECONDS = 2 * 3600;
export const DROP_INTERVAL = [70, 130]; // secondi tra un rifornimento aereo e l'altro
