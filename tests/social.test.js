import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, emptyData, ApiError, duel, cleanText, weekDay, weekOf, warPoints, leagueReward } from '../shared/social.js';

const DAY = 86400e3;
const MONDAY = Date.UTC(2026, 10, 9, 10); // lunedì 9 novembre 2026
function setup(opts) {
  const w = createWorld(emptyData(), opts);
  const join = (name, now, stats) => {
    const r = w.handle(null, 'register', { name }, now);
    if (stats) w.handle(r.token, 'sync', stats, now);
    return r;
  };
  return { w, join };
}
const code = (fn) => { try { fn(); } catch (e) { assert.ok(e instanceof ApiError, String(e)); return e.code; } return null; };

test('calendario: la settimana parte il lunedì, la domenica è pausa', () => {
  assert.equal(weekDay(MONDAY), 0); assert.equal(weekDay(MONDAY + 5 * DAY), 5); assert.equal(weekDay(MONDAY + 6 * DAY), 6);
  assert.equal(weekOf(MONDAY + 7 * DAY), weekOf(MONDAY) + 1);
});

test('server: i nuovi iscritti finiscono su server nuovi col passare del tempo o a capienza piena', () => {
  const { w, join } = setup({ rules: { serverCap: 2 } });
  assert.equal(join('Anna', MONDAY).user.server, 1);
  assert.equal(join('Bruno', MONDAY + DAY).user.server, 1);
  assert.equal(join('Carla', MONDAY + 2 * DAY).user.server, 2);
  assert.equal(join('Dario', MONDAY + 12 * DAY).user.server, 3);
  assert.equal(code(() => w.handle('nope', 'me', {}, MONDAY)), 'unauthorized');
  assert.equal(code(() => join('x', MONDAY)), 'bad_name');
});

test('lega: girone, biglietti giornalieri, punti, promozione e premi a fine stagione', () => {
  const { w, join } = setup({ rnd: () => 0.5 });
  const a = join('Asso', MONDAY, { dps: 100, hp: 100, stage: 10 });
  const others = ['Uno', 'Due', 'Tre'].map((n, i) => join(n, MONDAY, { dps: 10 + i, hp: 10, stage: 3 }));
  const g = w.handle(a.token, 'league.get', {}, MONDAY);
  assert.equal(g.opponents.length, 3); assert.ok(!('dps' in g.opponents[0])); assert.equal(g.league, 0);
  for (let i = 0; i < 6; i++) {
    const l = w.handle(a.token, 'league.get', {}, MONDAY);
    const r = w.handle(a.token, 'league.fight', { id: l.opponents.find((o) => !o.bot)?.id || l.opponents[0].id }, MONDAY);
    assert.ok(r.win); assert.ok(r.points >= 12);
  }
  const l = w.handle(a.token, 'league.get', {}, MONDAY);
  assert.equal(code(() => w.handle(a.token, 'league.fight', { id: l.opponents[0].id }, MONDAY)), 'no_tickets');
  assert.equal(w.handle(a.token, 'me', {}, MONDAY + DAY).user.tickets, 6); // nuovo giorno: biglietti pieni, non si accumulano
  assert.equal(w.handle(a.token, 'league.get', {}, MONDAY).rank, 1);
  const mon = w.handle(a.token, 'league.get', {}, MONDAY + 6 * DAY);
  assert.ok(mon.week.closed); assert.deepEqual(mon.opponents, []);
  assert.equal(code(() => w.handle(a.token, 'league.fight', { id: 'bot0' }, MONDAY + 6 * DAY)), 'season_closed');
  // nuova stagione: primo classificato promosso in Bronzo, premio in attesa
  const next = w.handle(a.token, 'league.get', {}, MONDAY + 7 * DAY);
  assert.equal(next.league, 1); assert.equal(next.points, 0); assert.deepEqual(next.lastSeason, { league: 0, rank: 1, points: next.lastSeason.points });
  const c = w.handle(a.token, 'claim', {}, MONDAY + 7 * DAY);
  assert.equal(c.reward.wrenches, 150); assert.equal(c.reward.coins, 8000);
  assert.deepEqual(w.handle(a.token, 'claim', {}, MONDAY + 7 * DAY).reward, {});
  assert.equal(w.handle(others[0].token, 'league.get', {}, MONDAY + 7 * DAY).lastSeason, null); // senza punti niente premio né storico
  assert.equal(leagueReward(5, 1).wrenches, Math.round(150 * 1.7 ** 5)); assert.equal(leagueReward(5, 51), null);
  assert.ok(leagueReward(3, 1).coins > leagueReward(3, 30).coins);
  assert.ok(duel({ dps: 10, hp: 10 }, { dps: 1, hp: 1 }, () => 0.5).win);
});

test('alleanze: fondazione, ingresso, attesa dopo l\'uscita, capienza', () => {
  const { w, join } = setup({ rules: { clanMax: 2 } });
  const [a, b, c] = ['Capo', 'Gregario', 'Terzo'].map((n) => join(n, MONDAY, { dps: 50, hp: 50 }));
  assert.equal(code(() => w.handle(a.token, 'clan.get', {}, MONDAY)), 'no_alliance');
  const cl = w.handle(a.token, 'clan.create', { name: 'Stormo Reale', tag: 'sr' }, MONDAY).clan;
  assert.equal(cl.tag, 'SR'); assert.equal(cl.tier, 2); // si parte in fascia Bronzo
  assert.equal(code(() => w.handle(b.token, 'clan.create', { name: 'stormo reale', tag: 'XX' }, MONDAY)), 'name_taken');
  w.handle(b.token, 'clan.join', { id: cl.id }, MONDAY);
  assert.equal(code(() => w.handle(c.token, 'clan.join', { id: cl.id }, MONDAY)), 'full');
  w.handle(b.token, 'clan.leave', {}, MONDAY);
  assert.equal(code(() => w.handle(b.token, 'clan.join', { id: cl.id }, MONDAY + 3600e3)), 'rejoin_wait');
  w.handle(b.token, 'clan.join', { id: cl.id }, MONDAY + 13 * 3600e3);
  assert.equal(w.handle(a.token, 'clan.list', {}, MONDAY).alliances[0].members, 2);
});

test('guerra: punti per giorno a tema, battaglia della domenica, esito e premi', () => {
  const { w, join } = setup({ rnd: () => 0.5 });
  const a = join('Alfa', MONDAY, { dps: 500, hp: 500 }), b = join('Beta', MONDAY, { dps: 50, hp: 50 });
  w.handle(a.token, 'clan.create', { name: 'Aquile', tag: 'AQ' }, MONDAY);
  w.handle(b.token, 'clan.create', { name: 'Falchi', tag: 'FA' }, MONDAY);
  const g = w.handle(a.token, 'clan.get', {}, MONDAY);
  assert.equal(g.war.enemy.tag, 'FA'); assert.equal(g.war.day, 0);
  // lunedì contano costruzioni e manovre, non i dungeon
  assert.equal(w.handle(a.token, 'war.report', { log: { 'forge:0': 10, 'forge:9': 2, 'skillUp:1': 1, dungeonKey: 3 } }, MONDAY).added, 10 + 20 + 70);
  assert.equal(warPoints('dungeonKey', 1, 1), 800); assert.equal(warPoints('hatch:5', 1, 4), 20000); assert.equal(warPoints('hack', 9, 0), 0);
  w.handle(b.token, 'war.report', { log: { 'hatch:0': 2 } }, MONDAY + DAY); // martedì vinto da Beta
  // sabato: attacchi ai membri rivali
  const sat = MONDAY + 5 * DAY;
  assert.equal(code(() => w.handle(a.token, 'war.fight', { id: b.user.id }, MONDAY)), 'no_war');
  const f = w.handle(a.token, 'war.fight', { id: b.user.id }, sat);
  assert.ok(f.win); assert.equal(f.points, 60 + 800); // unico rivale: punti pieni più l'assalto completo
  assert.deepEqual(f.war.days[5], [860, 0]);
  // domenica: la guerra si chiude. Alfa vince lunedì (1) e sabato (3), Beta martedì (1): 4 a 1
  const mon = w.handle(a.token, 'clan.get', {}, MONDAY + 6 * DAY);
  assert.equal(mon.war, null);
  assert.deepEqual(mon.clan.lastWar, { week: weekOf(MONDAY), won: true, mine: 4, theirs: 1, tier: 2 });
  assert.equal(mon.clan.tp, 14);
  assert.equal(w.handle(a.token, 'claim', {}, MONDAY + 6 * DAY).reward.coins, 65000);
  assert.equal(w.handle(b.token, 'claim', {}, MONDAY + 6 * DAY).reward.coins, 15000); // fascia Bronzo: premio di consolazione
  assert.equal(w.handle(b.token, 'clan.get', {}, MONDAY + 6 * DAY).clan.tp, 10);
});

test('chat: canali separati, filtro, limite di frequenza, segnalazioni', () => {
  const { w, join } = setup({ rules: { serverCap: 3 } });
  const [a, b, c, d] = ['Anna', 'Bruno', 'Carla', 'Dario'].map((n) => join(n, MONDAY));
  w.handle(a.token, 'chat.send', { channel: 'global', text: '  ciao   a tutti, che merdaccia ' }, MONDAY);
  assert.equal(code(() => w.handle(a.token, 'chat.send', { channel: 'global', text: 'spam' }, MONDAY + 500)), 'too_fast');
  const seen = w.handle(b.token, 'chat.get', { channel: 'global' }, MONDAY).messages;
  assert.equal(seen[0].text, 'ciao a tutti, che ***'); assert.equal(seen[0].me, false);
  assert.equal(w.handle(d.token, 'chat.get', { channel: 'global' }, MONDAY).messages.length, 0);
  assert.equal(code(() => w.handle(a.token, 'chat.send', { channel: 'alliance', text: 'x' }, MONDAY + 5000)), 'no_alliance');
  for (const u of [b, c]) w.handle(u.token, 'chat.report', { channel: 'global', n: seen[0].n }, MONDAY);
  assert.equal(w.handle(c.token, 'chat.get', { channel: 'global' }, MONDAY).messages.length, 1);
  assert.equal(cleanText('a\u0000b'), 'a b');
});
