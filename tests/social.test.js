import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, emptyData, ApiError, duel, cleanText, weekDay, weekOf, warPoints, leagueReward } from '../shared/social.js';

const DAY = 86400e3;
const TUESDAY = Date.UTC(2026, 10, 10, 10); // martedì 10 novembre 2026
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

test('calendario: la settimana parte il martedì, il lunedì è pausa', () => {
  assert.equal(weekDay(TUESDAY), 0); assert.equal(weekDay(TUESDAY + 5 * DAY), 5); assert.equal(weekDay(TUESDAY + 6 * DAY), 6);
  assert.equal(weekOf(TUESDAY + 7 * DAY), weekOf(TUESDAY) + 1);
});

test('server: i nuovi iscritti finiscono su server nuovi col passare del tempo o a capienza piena', () => {
  const { w, join } = setup({ rules: { serverCap: 2 } });
  assert.equal(join('Anna', TUESDAY).user.server, 1);
  assert.equal(join('Bruno', TUESDAY + DAY).user.server, 1);
  assert.equal(join('Carla', TUESDAY + 2 * DAY).user.server, 2);
  assert.equal(join('Dario', TUESDAY + 12 * DAY).user.server, 3);
  assert.equal(code(() => w.handle('nope', 'me', {}, TUESDAY)), 'unauthorized');
  assert.equal(code(() => join('x', TUESDAY)), 'bad_name');
});

test('lega: girone, biglietti giornalieri, punti, promozione e premi a fine stagione', () => {
  const { w, join } = setup({ rnd: () => 0.5 });
  const a = join('Asso', TUESDAY, { dps: 100, hp: 100, stage: 10 });
  const others = ['Uno', 'Due', 'Tre'].map((n, i) => join(n, TUESDAY, { dps: 10 + i, hp: 10, stage: 3 }));
  const g = w.handle(a.token, 'league.get', {}, TUESDAY);
  assert.equal(g.opponents.length, 3); assert.ok(!('dps' in g.opponents[0])); assert.equal(g.league, 0);
  for (let i = 0; i < 5; i++) {
    const l = w.handle(a.token, 'league.get', {}, TUESDAY);
    const r = w.handle(a.token, 'league.fight', { id: l.opponents.find((o) => !o.bot)?.id || l.opponents[0].id }, TUESDAY);
    assert.ok(r.win); assert.ok(r.points >= 10);
  }
  const l = w.handle(a.token, 'league.get', {}, TUESDAY);
  assert.equal(code(() => w.handle(a.token, 'league.fight', { id: l.opponents[0].id }, TUESDAY)), 'no_tickets');
  assert.equal(w.handle(a.token, 'me', {}, TUESDAY + DAY).user.tickets, 5); // nuovo giorno: biglietti pieni, non si accumulano
  assert.equal(w.handle(a.token, 'league.get', {}, TUESDAY).rank, 1);
  const mon = w.handle(a.token, 'league.get', {}, TUESDAY + 6 * DAY);
  assert.ok(mon.week.closed); assert.deepEqual(mon.opponents, []);
  assert.equal(code(() => w.handle(a.token, 'league.fight', { id: 'bot0' }, TUESDAY + 6 * DAY)), 'season_closed');
  // nuova stagione: primo classificato promosso in Bronzo, premio in attesa
  const next = w.handle(a.token, 'league.get', {}, TUESDAY + 7 * DAY);
  assert.equal(next.league, 1); assert.equal(next.points, 0); assert.deepEqual(next.lastSeason, { league: 0, rank: 1, points: next.lastSeason.points });
  const c = w.handle(a.token, 'claim', {}, TUESDAY + 7 * DAY);
  assert.equal(c.reward.wrenches, 175); assert.equal(c.reward.coins, 9000);
  assert.deepEqual(w.handle(a.token, 'claim', {}, TUESDAY + 7 * DAY).reward, {});
  assert.equal(w.handle(others[0].token, 'league.get', {}, TUESDAY + 7 * DAY).lastSeason, null); // senza punti niente premio né storico
  assert.equal(leagueReward(5, 1).wrenches, 2620); assert.equal(leagueReward(5, 101), null);
  assert.ok(duel({ dps: 10, hp: 10 }, { dps: 1, hp: 1 }, () => 0.5).win);
});

test('alleanze: fondazione, ingresso, attesa dopo l\'uscita, capienza', () => {
  const { w, join } = setup({ rules: { clanMax: 2 } });
  const [a, b, c] = ['Capo', 'Gregario', 'Terzo'].map((n) => join(n, TUESDAY, { dps: 50, hp: 50 }));
  assert.equal(code(() => w.handle(a.token, 'clan.get', {}, TUESDAY)), 'no_alliance');
  const cl = w.handle(a.token, 'clan.create', { name: 'Stormo Reale', tag: 'sr' }, TUESDAY).clan;
  assert.equal(cl.tag, 'SR'); assert.equal(cl.tier, 3); // si parte in fascia C
  assert.equal(code(() => w.handle(b.token, 'clan.create', { name: 'stormo reale', tag: 'XX' }, TUESDAY)), 'name_taken');
  w.handle(b.token, 'clan.join', { id: cl.id }, TUESDAY);
  assert.equal(code(() => w.handle(c.token, 'clan.join', { id: cl.id }, TUESDAY)), 'full');
  w.handle(b.token, 'clan.leave', {}, TUESDAY);
  assert.equal(code(() => w.handle(b.token, 'clan.join', { id: cl.id }, TUESDAY + 3600e3)), 'rejoin_wait');
  w.handle(b.token, 'clan.join', { id: cl.id }, TUESDAY + 25 * 3600e3);
  assert.equal(w.handle(a.token, 'clan.list', {}, TUESDAY).alliances[0].members, 2);
});

test('guerra: punti per giorno a tema, battaglia della domenica, esito e premi', () => {
  const { w, join } = setup({ rnd: () => 0.5 });
  const a = join('Alfa', TUESDAY, { dps: 500, hp: 500 }), b = join('Beta', TUESDAY, { dps: 50, hp: 50 });
  w.handle(a.token, 'clan.create', { name: 'Aquile', tag: 'AQ' }, TUESDAY);
  w.handle(b.token, 'clan.create', { name: 'Falchi', tag: 'FA' }, TUESDAY);
  const g = w.handle(a.token, 'clan.get', {}, TUESDAY);
  assert.equal(g.war.enemy.tag, 'FA'); assert.equal(g.war.day, 0);
  // martedì contano la forgia e la ricerca, non i dungeon
  assert.equal(w.handle(a.token, 'war.report', { log: { 'forge:0': 10, 'forge:9': 2, 'tech:1': 1, dungeonKey: 3 } }, TUESDAY).added, 10 + 6 + 7500);
  assert.equal(warPoints('dungeonKey', 1, 1), 1000); assert.equal(warPoints('hatch:5', 1, 3), 16000); assert.equal(warPoints('hack', 9, 0), 0);
  w.handle(b.token, 'war.report', { log: { 'hatch:0': 2 } }, TUESDAY + DAY); // mercoledì vinto da Beta
  // domenica: attacchi ai membri rivali
  const sun = TUESDAY + 5 * DAY;
  assert.equal(code(() => w.handle(a.token, 'war.fight', { id: b.user.id }, TUESDAY)), 'no_war');
  const f = w.handle(a.token, 'war.fight', { id: b.user.id }, sun);
  assert.ok(f.win); assert.equal(f.points, 50 + 1000); // unico rivale: punti pieni più la battaglia totale
  assert.deepEqual(f.war.days[5], [1050, 0]);
  // lunedì: la guerra si chiude. Alfa vince martedì (1) e domenica (2), Beta mercoledì (2): 3 a 2
  const mon = w.handle(a.token, 'clan.get', {}, TUESDAY + 6 * DAY);
  assert.equal(mon.war, null);
  assert.deepEqual(mon.clan.lastWar, { week: weekOf(TUESDAY), won: true, mine: 3, theirs: 2, tier: 3 });
  assert.equal(mon.clan.tp, 15);
  assert.equal(w.handle(a.token, 'claim', {}, TUESDAY + 6 * DAY).reward.coins, 96000);
  assert.deepEqual(w.handle(b.token, 'claim', {}, TUESDAY + 6 * DAY).reward, {}); // fascia C: chi perde non riceve nulla
  assert.equal(w.handle(b.token, 'clan.get', {}, TUESDAY + 6 * DAY).clan.tp, 10);
});

test('chat: canali separati, filtro, limite di frequenza, segnalazioni', () => {
  const { w, join } = setup({ rules: { serverCap: 3 } });
  const [a, b, c, d] = ['Anna', 'Bruno', 'Carla', 'Dario'].map((n) => join(n, TUESDAY));
  w.handle(a.token, 'chat.send', { channel: 'global', text: '  ciao   a tutti, che merdaccia ' }, TUESDAY);
  assert.equal(code(() => w.handle(a.token, 'chat.send', { channel: 'global', text: 'spam' }, TUESDAY + 500)), 'too_fast');
  const seen = w.handle(b.token, 'chat.get', { channel: 'global' }, TUESDAY).messages;
  assert.equal(seen[0].text, 'ciao a tutti, che ***'); assert.equal(seen[0].me, false);
  assert.equal(w.handle(d.token, 'chat.get', { channel: 'global' }, TUESDAY).messages.length, 0);
  assert.equal(code(() => w.handle(a.token, 'chat.send', { channel: 'alliance', text: 'x' }, TUESDAY + 5000)), 'no_alliance');
  for (const u of [b, c]) w.handle(u.token, 'chat.report', { channel: 'global', n: seen[0].n }, TUESDAY);
  assert.equal(w.handle(c.token, 'chat.get', { channel: 'global' }, TUESDAY).messages.length, 1);
  assert.equal(cleanText('a\u0000b'), 'a b');
});
