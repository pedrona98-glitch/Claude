// Simula un giocatore che gioca senza sosta e stampa i progressi: serve a controllare il ritmo del gioco.
//   npm run simulate
import * as G from '../src/game.js';
import { TECH, DUNGEONS } from '../src/data.js';
// Bot: costruisce in automatico, paga l'officina appena può, fa i dungeon, ricerca, apre casse, recluta.
const s = G.newState(1e12);
let now = 1e12;
const dt = 0.25, report = [];
const marks = [5, 15, 30, 60, 120, 240, 480, 720, 1440, 2880, 4320].map((m) => m * 60);
let t = 0, next = 0;
const order = ['forgeTime', 'atkMastery', 'hpMastery', 'forgeCost', 'partLevel', 'sellPrice', 'offlineTime', 'droneAtk', 'droneHp', 'maneuverDmg'];
while (next < marks.length) {
  t += dt; now += dt * 1000;
  G.tick(s, dt, now);
  if (Math.round(t / dt) % 2 === 0) { s.auto.stopAge = 99; G.autoBuild(s); }
  if (Math.round(t / dt) % 20 === 0) {
    while (G.payForge(s, now));
    if (s.farming && Math.round(t / dt) % 1200 === 0) G.challengeBoss(s);
    for (const d of DUNGEONS) for (let k = 0; k < 3; k++) { const r = G.runDungeon(s, d.id, s.dungeons[d.id] + 1); if (!r || !r.win) { G.runDungeon(s, d.id, 0, { sweep: true }); break; } }
    for (const id of order) if (G.startTech(s, id, now)) break;
    while (s.drones.crates.length && G.startCrate(s, 0, now));
    for (let i = s.drones.bay.length - 1; i >= 0; i--) G.openCrate(s, i, now);
    if (s.plans >= 10) G.summonManeuvers(s, 10);
    while (G.summonEmblem(s));
    G.claimDaily(s, now);
  }
  if (t >= marks[next]) {
    const st = G.stats(s);
    report.push(`${(marks[next] / 3600).toFixed(2)}h stage ${G.stageName(s.stats.maxStage)} forge ${s.forge.level}${s.forge.end ? '+' : ''}(${s.forge.paid}) coins ${Math.round(s.coins)} wr ${s.wrenches} pow ${st.power} dps ${Math.round(st.dps)} hp ${Math.round(st.hp)} dung ${DUNGEONS.map((d) => s.dungeons[d.id]).join('/')} drones ${s.drones.eq.length} man ${s.maneuvers.eq.length} tech ${Object.values(s.tech.lv).reduce((a, b) => a + b, 0)}`);
    next++;
  }
}
console.log(report.join('\n'));
