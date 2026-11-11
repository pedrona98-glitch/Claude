import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, emptyData, ApiError, duel, cleanText, dayOf } from '../shared/social.js';

const DAY = 86400e3;
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

test('server: i nuovi iscritti finiscono su server nuovi col passare del tempo o a capienza piena', () => {
  const { w, join } = setup({ rules: { serverCap: 2 } });
  const t0 = 1e12;
  assert.equal(join('Anna', t0).user.server, 1);
  assert.equal(join('Bruno', t0 + DAY).user.server, 1);
  assert.equal(join('Carla', t0 + 2 * DAY).user.server, 2); // capienza
  assert.equal(join('Dario', t0 + 12 * DAY).user.server, 3); // tempo
  assert.equal(code(() => w.handle('nope', 'me', {}, t0)), 'unauthorized');
  assert.equal(code(() => join('x', t0)), 'bad_name');
});

test('arena: biglietti, avversari solo dello stesso server, punteggi', () => {
  const { w, join } = setup({ rnd: () => 0.5, rules: { serverCap: 3 } });
  const t0 = 1e12;
  const a = join('Asso', t0, { dps: 100, hp: 100, stage: 10 });
  join('Debole', t0, { dps: 10, hp: 10, stage: 3 });
  join('Forte', t0, { dps: 1000, hp: 1000, stage: 30 });
  join('Altrove', t0, { dps: 100, hp: 100, stage: 10 }); // server 2
  const list = w.handle(a.token, 'arena.list', {}, t0);
  assert.equal(list.opponents.length, 3);
  assert.ok(!list.opponents.some((o) => o.name === 'Altrove'));
  assert.equal(list.opponents.filter((o) => o.bot).length, 1);
  assert.ok(!('dps' in list.opponents[0]));
  const weak = list.opponents.find((o) => o.name === 'Debole'), strong = list.opponents.find((o) => o.name === 'Forte');
  const win = w.handle(a.token, 'arena.fight', { id: weak.id }, t0);
  assert.ok(win.win && win.delta >= 5 && win.user.rating === 1000 + win.delta && win.user.tickets === 4);
  assert.equal(code(() => w.handle(a.token, 'arena.fight', { id: strong.id }, t0)), 'not_found'); // l'offerta è stata consumata
  const l2 = w.handle(a.token, 'arena.list', {}, t0);
  const lose = w.handle(a.token, 'arena.fight', { id: l2.opponents.find((o) => o.name === 'Forte').id }, t0);
  assert.ok(!lose.win && lose.delta < 0);
  for (let i = 0; i < 3; i++) { const l = w.handle(a.token, 'arena.list', {}, t0); w.handle(a.token, 'arena.fight', { id: l.opponents[0].id }, t0); }
  const l3 = w.handle(a.token, 'arena.list', {}, t0);
  assert.equal(code(() => w.handle(a.token, 'arena.fight', { id: l3.opponents[0].id }, t0)), 'no_tickets');
  assert.equal(w.handle(a.token, 'me', {}, t0 + 61 * 60e3).user.tickets, 2);
  assert.equal(w.handle(a.token, 'arena.refill', {}, t0).user.tickets, 5);
  assert.ok(w.handle(a.token, 'arena.top', {}, t0).top.length === 3);
  assert.ok(duel({ dps: 10, hp: 10 }, { dps: 1, hp: 1 }, () => 0.5).win);
});

test('alleanze: creazione, ingresso, donazioni, boss, uscita', () => {
  const { w, join } = setup({ rnd: () => 0.5 });
  const t0 = 1e12;
  const a = join('Capo', t0, { dps: 100, hp: 100 }), b = join('Gregario', t0, { dps: 100, hp: 100 });
  assert.equal(code(() => w.handle(a.token, 'ally.get', {}, t0)), 'no_alliance');
  const al = w.handle(a.token, 'ally.create', { name: 'Stormo Reale', tag: 'sr' }, t0).alliance;
  assert.equal(al.tag, 'SR'); assert.equal(al.members.length, 1);
  assert.equal(code(() => w.handle(b.token, 'ally.create', { name: 'stormo reale', tag: 'XX' }, t0)), 'name_taken');
  w.handle(b.token, 'ally.join', { id: al.id }, t0);
  assert.equal(w.handle(b.token, 'ally.list', {}, t0).alliances[0].members, 2);
  for (let i = 0; i < 3; i++) assert.equal(w.handle(a.token, 'ally.donate', {}, t0).reward.gems, 2);
  assert.equal(code(() => w.handle(a.token, 'ally.donate', {}, t0)), 'limit');
  assert.equal(w.handle(a.token, 'ally.donate', {}, t0 + DAY).left.donations, 2); // nuovo giorno
  let killed = false, lvl = 1;
  for (const tk of [a.token, b.token]) for (let i = 0; i < 3 && !killed; i++) { const r = w.handle(tk, 'ally.boss', {}, t0); killed = r.killed; lvl = r.alliance.boss.level; }
  assert.ok(killed); assert.equal(lvl, 2);
  assert.equal(w.handle(a.token, 'claim', {}, t0).reward.gems, 6);
  assert.equal(w.handle(a.token, 'claim', {}, t0).reward.gems, 0);
  w.handle(a.token, 'ally.leave', {}, t0);
  assert.equal(w.handle(b.token, 'ally.get', {}, t0).alliance.leader, b.user.id);
  w.handle(b.token, 'ally.leave', {}, t0);
  assert.equal(w.handle(b.token, 'ally.list', {}, t0).alliances.length, 0);
});

test('guerra tra alleanze: abbinamento, punti, premi il giorno dopo', () => {
  const { w, join } = setup({ rnd: () => 0.5 });
  const t0 = dayOf(1e12) * DAY + 1000;
  const a = join('Alfa', t0, { dps: 500, hp: 500 }), b = join('Beta', t0, { dps: 50, hp: 50 });
  w.handle(a.token, 'ally.create', { name: 'Aquile', tag: 'AQ' }, t0);
  w.handle(b.token, 'ally.create', { name: 'Falchi', tag: 'FA' }, t0);
  const g = w.handle(a.token, 'ally.get', {}, t0);
  assert.equal(g.alliance.war.enemy.tag, 'FA');
  const r = w.handle(a.token, 'ally.war', { id: g.alliance.war.targets[0].id }, t0);
  assert.ok(r.win); assert.equal(r.alliance.war.mine, 3);
  assert.equal(w.handle(b.token, 'ally.war', { id: a.user.id }, t0).points, 1);
  assert.equal(code(() => w.handle(a.token, 'ally.war', { id: a.user.id }, t0)), 'not_found');
  const next = w.handle(a.token, 'ally.get', {}, t0 + DAY);
  assert.deepEqual(next.alliance.lastWar, { day: dayOf(t0), won: true, mine: 3, theirs: 1 });
  assert.equal(next.user.pending, 10);
  assert.equal(w.handle(b.token, 'me', {}, t0 + DAY).user.pending, 0);
});

test('chat: canali separati, filtro, limite di frequenza, segnalazioni', () => {
  const { w, join } = setup({ rules: { serverCap: 3 } });
  const t0 = 1e12;
  const [a, b, c, d] = ['Anna', 'Bruno', 'Carla', 'Dario'].map((n) => join(n, t0));
  w.handle(a.token, 'chat.send', { channel: 'global', text: '  ciao   a tutti, che merdaccia ' }, t0);
  assert.equal(code(() => w.handle(a.token, 'chat.send', { channel: 'global', text: 'spam' }, t0 + 500)), 'too_fast');
  const seen = w.handle(b.token, 'chat.get', { channel: 'global' }, t0).messages;
  assert.equal(seen[0].text, 'ciao a tutti, che ***'); assert.equal(seen[0].me, false);
  assert.equal(w.handle(d.token, 'chat.get', { channel: 'global' }, t0).messages.length, 0); // altro server
  assert.equal(code(() => w.handle(a.token, 'chat.send', { channel: 'alliance', text: 'x' }, t0 + 5000)), 'no_alliance');
  for (const u of [b, c]) w.handle(u.token, 'chat.report', { channel: 'global', n: seen[0].n }, t0);
  assert.equal(w.handle(c.token, 'chat.get', { channel: 'global' }, t0).messages.length, 1);
  w.handle(a.token, 'chat.report', { channel: 'global', n: seen[0].n }, t0); // l'autore non conta
  assert.equal(w.handle(c.token, 'chat.get', { channel: 'global' }, t0).messages.length, 1);
  const e = join('Elisa', t0); assert.equal(e.user.server, 2);
  assert.equal(cleanText('a\u0000b'), 'a b');
});
