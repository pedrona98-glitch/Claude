// Tabelle di bilanciamento di Sky Squadron, generate da formule proprie.

/**
 * Distribuzione a campana sulle qualità: centrata su `center`, con al massimo una qualità oltre il centro.
 * Restituisce percentuali con due decimali che sommano esattamente a 100.
 */
export function bell(center, count, sigma = 0.75, tail = 0.3) {
  const top = Math.min(count - 1, Math.floor(center) + 1), low = Math.max(0, Math.floor(center) - 2);
  const w = Array.from({ length: count }, (_, i) => (i < low || i > top ? 0 : Math.exp(-(((i - center) / sigma) ** 2)) * (i > center ? tail : 1)));
  const sum = w.reduce((a, b) => a + b, 0);
  const pct = w.map((x) => Math.round((x / sum) * 10000) / 100);
  const fix = Math.round((100 - pct.reduce((a, b) => a + b, 0)) * 100) / 100;
  pct[pct.indexOf(Math.max(...pct))] = Math.round((Math.max(...pct) + fix) * 100) / 100;
  return pct;
}

export const WORKSHOP_LEVELS = 40;
export const AGE_COUNT = 10;

// Probabilità (%) delle 10 epoche per livello d'officina 1..40.
export const FORGE_ODDS = Array.from({ length: WORKSHOP_LEVELS }, (_, i) => bell(9.3 * Math.pow(i / (WORKSHOP_LEVELS - 1), 1.12), AGE_COUNT, 0.62, 0.12));

const round2 = (n) => { const p = Math.pow(10, Math.max(0, Math.floor(Math.log10(n)) - 1)); return Math.round(n / p) * p; };
// Potenziamento officina dal livello i+1: [costo di ogni rata, numero di rate, secondi].
export const FORGE_UPGRADES = Array.from({ length: WORKSHOP_LEVELS - 1 }, (_, i) => {
  const lvl = i + 1, total = round2(lvl <= 12 ? 250 * Math.pow(1.62, lvl - 1) : 250 * Math.pow(1.62, 11) * Math.pow(1.28, lvl - 12));
  const parts = lvl < 8 ? 1 : Math.min(8, Math.ceil((lvl - 6) / 3));
  const secs = lvl <= 14 ? Math.round(240 * Math.pow(1.45, lvl - 1)) : Math.round(240 * Math.pow(1.45, 13) + (lvl - 14) * 18 * 3600);
  return [round2(total / parts), parts, secs];
});

// Ricerca: costo del livello i+1 di un nodo (5 livelli per grado, 5 gradi): [secondi, progetti].
export const TECH_COSTS = Array.from({ length: 25 }, (_, n) => [
  n < 12 ? Math.round(300 * Math.pow(1.55, n)) : Math.round(300 * Math.pow(1.55, 11) + (n - 11) * 6 * 3600),
  round2(35 * Math.pow(1.17, n)),
]);

// Rarità delle casse (%) per livello del dungeon Invasione 1..100.
export const CRATE_RATES = Array.from({ length: 100 }, (_, i) => bell(i / 24, 6, 0.7, 0.2));
// Rarità delle manovre (%) per livello di reclutamento 1..100.
export const MANEUVER_RATES = Array.from({ length: 100 }, (_, i) => bell(i / 22, 6, 0.7, 0.2));
// Rarità degli emblemi (%) per livello di reclutamento 1..50.
export const EMBLEM_RATES = Array.from({ length: 50 }, (_, i) => bell(i / 11, 6, 0.7, 0.2));
/** Richiami necessari per passare dal livello di reclutamento `lvl` al successivo. */
export const recruitStep = (lvl) => 4 + 2 * lvl;
