// Regole del gioco online: account, server, arena PvP, alleanze, guerre e chat.
// È JavaScript puro su un oggetto dati in memoria, così lo stesso codice gira
// sul server vero (server/index.js) e nella demo dentro il browser (src/online.js).

export const RULES = {
  serverOpenDays: 7,      // un server accetta nuove iscrizioni per questi giorni...
  serverCap: 3000,        // ...o fino a questo numero di giocatori
  ticketsMax: 5,
  ticketMinutes: 30,
  refillsPerDay: 3,
  allianceMax: 20,
  allianceLevelMax: 50,
  donationsPerDay: 3,
  donationXp: 20,
  bossAttacksPerDay: 3,
  bossBurstSeconds: 30,
  warAttacksPerDay: 3,
  warWinGems: 10,
  chatKeep: 200,
  chatMinGapMs: 2000,
  chatMaxLen: 200,
  reportsToHide: 3,
};

export class ApiError extends Error {
  constructor(code) { super(code); this.code = code; }
}
const fail = (code) => { throw new ApiError(code); };

const DAY = 86400e3;
export const dayOf = (now) => Math.floor(now / DAY);
const BAD_WORDS = ['cazzo', 'merda', 'stronz', 'vaffanculo', 'puttana', 'troia', 'fuck', 'shit', 'bitch', 'asshole', 'cunt', 'nigger', 'faggot'];
const BOT_NAMES = ['Recluta Alfa', 'Recluta Bravo', 'Recluta Charlie', 'Recluta Delta', 'Recluta Echo', 'Recluta Foxtrot'];

export function emptyData() {
  return { seq: 1, servers: [], users: {}, tokens: {}, alliances: {}, chat: {}, wars: {} };
}

export function cleanName(raw, min = 3, max = 16) {
  const name = String(raw ?? '').replace(/[^\p{L}\p{N} _\-.]/gu, '').replace(/\s+/g, ' ').trim().slice(0, max);
  if (name.length < min) fail('bad_name');
  if (BAD_WORDS.some((w) => name.toLowerCase().includes(w))) fail('bad_name');
  return name;
}
export function cleanText(raw) {
  let text = String(raw ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, RULES.chatMaxLen);
  if (!text) fail('empty');
  for (const w of BAD_WORDS) text = text.replace(new RegExp(w + '\\p{L}*', 'giu'), '***');
  return text;
}
const num = (v) => (Number.isFinite(v) && v > 0 ? v : 0);
export const powerOf = (u) => Math.sqrt(num(u.dps) * num(u.hp));
export const xpNext = (level) => Math.round(100 * Math.pow(level, 1.5));

/** Duello: vince chi abbatte l'altro per primo. Conta dps × vita, con un po' di fortuna. */
export function duel(a, b, rnd = Math.random) {
  const ta = num(b.hp) / (num(a.dps) * (0.85 + 0.3 * rnd()) || 1e-9);
  const tb = num(a.hp) / (num(b.dps) * (0.85 + 0.3 * rnd()) || 1e-9);
  const win = ta <= tb;
  return { win, myLeft: win ? Math.max(0, 1 - ta / tb) : 0, oppLeft: win ? 0 : Math.max(0, 1 - tb / ta) };
}
function elo(mine, theirs, win) {
  const expected = 1 / (1 + Math.pow(10, (theirs - mine) / 400));
  const d = Math.round(32 * ((win ? 1 : 0) - expected));
  return win ? Math.max(5, d) : Math.min(-3, d);
}

export function createWorld(data = emptyData(), { rnd = Math.random, rules = {} } = {}) {
  const R = { ...RULES, ...rules };
  const id = (prefix) => prefix + (data.seq++).toString(36);

  // ---------- account e server ----------
  function pickServer(now) {
    const last = data.servers[data.servers.length - 1];
    if (last && now - last.openedAt < R.serverOpenDays * DAY && last.count < R.serverCap) return last;
    const srv = { id: data.servers.length + 1, openedAt: now, count: 0 };
    data.servers.push(srv);
    return srv;
  }

  function register({ name }, now) {
    const srv = pickServer(now);
    const user = {
      id: id('u'), name: cleanName(name), server: srv.id, createdAt: now,
      dps: 0, hp: 0, stage: 1, plane: 'libellula',
      rating: 1000, tickets: R.ticketsMax, ticketAt: now, wins: 0,
      alliance: null, pending: 0, day: dayOf(now), donations: 0, bossAttacks: 0, warAttacks: 0, refills: 0,
      offer: [], lastChat: 0,
    };
    srv.count++;
    data.users[user.id] = user;
    const token = id('t') + Math.floor(rnd() * 1e15).toString(36) + Math.floor(rnd() * 1e15).toString(36);
    data.tokens[token] = user.id;
    return { token, ...me(user, now) };
  }

  function touch(u, now) {
    if (u.day !== dayOf(now)) { u.day = dayOf(now); u.donations = 0; u.bossAttacks = 0; u.warAttacks = 0; u.refills = 0; }
    const step = R.ticketMinutes * 60e3;
    if (u.tickets >= R.ticketsMax) u.ticketAt = now;
    else {
      const gained = Math.floor((now - u.ticketAt) / step);
      if (gained > 0) { u.tickets = Math.min(R.ticketsMax, u.tickets + gained); u.ticketAt = u.tickets >= R.ticketsMax ? now : u.ticketAt + gained * step; }
    }
  }

  const tagOf = (u) => (u.alliance && data.alliances[u.alliance] ? data.alliances[u.alliance].tag : '');
  const pub = (u) => ({ id: u.id, name: u.name, tag: tagOf(u), rating: u.rating, stage: u.stage, plane: u.plane, power: powerOf(u), bot: !!u.bot });

  function me(u, now) {
    touch(u, now);
    const a = u.alliance ? data.alliances[u.alliance] : null;
    return {
      user: {
        id: u.id, name: u.name, server: u.server, rating: u.rating, wins: u.wins,
        tickets: u.tickets, ticketsMax: R.ticketsMax, nextTicketAt: u.tickets < R.ticketsMax ? u.ticketAt + R.ticketMinutes * 60e3 : 0,
        refillsLeft: R.refillsPerDay - u.refills, pending: u.pending,
      },
      alliance: a ? { id: a.id, name: a.name, tag: a.tag, level: a.level } : null,
    };
  }

  function sync(u, p, now) {
    u.dps = num(p.dps); u.hp = num(p.hp);
    u.stage = Math.max(1, Math.floor(num(p.stage)) || 1);
    if (typeof p.plane === 'string') u.plane = p.plane.slice(0, 20);
    u.seenAt = now;
    return me(u, now);
  }

  // ---------- arena ----------
  const serverUsers = (srv) => Object.values(data.users).filter((x) => x.server === srv);

  function arenaList(u, now) {
    touch(u, now);
    const pool = serverUsers(u.server).filter((x) => x.id !== u.id && x.dps > 0 && x.hp > 0)
      .sort((a, b) => Math.abs(a.rating - u.rating) - Math.abs(b.rating - u.rating)).slice(0, 8);
    const picks = [];
    while (picks.length < 3 && pool.length) picks.push(pool.splice(Math.floor(rnd() * pool.length), 1)[0]);
    u.offer = picks.map((x) => ({ ...pub(x), dps: x.dps, hp: x.hp }));
    // Pochi giocatori sul server: si completa con avversari d'addestramento, dichiarati come tali.
    for (let i = 0; u.offer.length < 3; i++) {
      const k = 0.75 + 0.2 * i + 0.1 * rnd();
      u.offer.push({
        id: 'bot' + i, name: BOT_NAMES[Math.floor(rnd() * BOT_NAMES.length)], tag: '', bot: true,
        rating: Math.max(0, Math.round(u.rating - 40 + 40 * i)), stage: u.stage, plane: 'rondine',
        dps: num(u.dps) * k || 1, hp: num(u.hp) * k || 1, power: powerOf(u) * k,
      });
    }
    const rank = 1 + serverUsers(u.server).filter((x) => x.rating > u.rating).length;
    return { opponents: u.offer.map(({ dps, hp, ...rest }) => rest), rank, ...me(u, now) };
  }

  function arenaFight(u, { id: oppId }, now) {
    touch(u, now);
    if (!(u.dps > 0 && u.hp > 0)) fail('no_snapshot');
    const opp = u.offer.find((x) => x.id === oppId) || fail('not_found');
    if (u.tickets <= 0) fail('no_tickets');
    if (u.tickets === R.ticketsMax) u.ticketAt = now;
    u.tickets--;
    const res = duel(u, opp, rnd);
    const delta = elo(u.rating, opp.rating, res.win);
    u.rating = Math.max(0, u.rating + delta);
    if (res.win) u.wins++;
    const real = data.users[opp.id];
    if (real) real.rating = Math.max(0, real.rating - Math.round(delta / 2));
    u.offer = [];
    return { ...res, delta, opponent: { name: opp.name, tag: opp.tag, plane: opp.plane }, reward: { gems: res.win ? 1 : 0, coinSeconds: res.win ? 300 : 60 }, ...me(u, now) };
  }

  function arenaRefill(u, _p, now) {
    touch(u, now);
    if (u.refills >= R.refillsPerDay) fail('limit');
    u.refills++; u.tickets = R.ticketsMax; u.ticketAt = now;
    return me(u, now);
  }

  function arenaTop(u) {
    const all = serverUsers(u.server).sort((a, b) => b.rating - a.rating);
    return { top: all.slice(0, 50).map((x, i) => ({ rank: i + 1, ...pub(x), me: x.id === u.id })), rank: 1 + all.indexOf(u), server: u.server };
  }

  // ---------- alleanze ----------
  const members = (a) => a.members.map((mid) => data.users[mid]).filter(Boolean);
  const alliancePower = (a) => members(a).reduce((s, x) => s + powerOf(x), 0);
  const myAlliance = (u) => (u.alliance && data.alliances[u.alliance]) || fail('no_alliance');

  function spawnBoss(a, level) {
    const total = members(a).reduce((s, x) => s + x.dps, 0);
    const maxHp = Math.max(1000, total * R.bossBurstSeconds * R.bossAttacksPerDay * 0.6);
    a.boss = { level, hp: maxHp, maxHp, hitters: [] };
  }
  function addXp(a, xp) {
    a.xp += xp;
    while (a.level < R.allianceLevelMax && a.xp >= xpNext(a.level)) { a.xp -= xpNext(a.level); a.level++; }
  }

  function allyList(u, { q = '' } = {}) {
    const needle = String(q).toLowerCase().slice(0, 20);
    const list = Object.values(data.alliances).filter((a) => a.server === u.server && (!needle || a.name.toLowerCase().includes(needle) || a.tag.toLowerCase().includes(needle)))
      .map((a) => ({ id: a.id, name: a.name, tag: a.tag, level: a.level, members: a.members.length, max: R.allianceMax, power: alliancePower(a) }))
      .sort((a, b) => b.power - a.power).slice(0, 30);
    return { alliances: list };
  }

  function allyCreate(u, { name, tag }, now) {
    if (u.alliance) fail('in_alliance');
    const a = {
      id: id('a'), server: u.server, name: cleanName(name, 3, 20), tag: cleanName(tag, 2, 4).toUpperCase().replace(/[^A-Z0-9]/g, '') || fail('bad_name'),
      leader: u.id, members: [u.id], level: 1, xp: 0, createdAt: now, boss: null, donated: {},
    };
    if (Object.values(data.alliances).some((x) => x.server === u.server && (x.name.toLowerCase() === a.name.toLowerCase() || x.tag === a.tag))) fail('name_taken');
    data.alliances[a.id] = a; u.alliance = a.id;
    spawnBoss(a, 1);
    return allyGet(u, {}, now);
  }

  function allyJoin(u, { id: aid }, now) {
    if (u.alliance) fail('in_alliance');
    const a = data.alliances[aid];
    if (!a || a.server !== u.server) fail('not_found');
    if (a.members.length >= R.allianceMax) fail('full');
    a.members.push(u.id); u.alliance = a.id;
    return allyGet(u, {}, now);
  }

  function allyLeave(u, _p, now) {
    const a = myAlliance(u);
    a.members = a.members.filter((x) => x !== u.id);
    u.alliance = null;
    if (!a.members.length) { delete data.alliances[a.id]; delete data.chat['a:' + a.id]; }
    else if (a.leader === u.id) a.leader = a.members[0];
    return me(u, now);
  }

  // Guerre: ogni giorno le alleanze di un server vengono accoppiate per forza simile.
  function ensureWar(server, now) {
    const today = dayOf(now);
    let w = data.wars[server];
    if (w && w.day === today) return w;
    if (w) {
      for (const p of w.pairs) {
        const winner = p.pa === p.pb ? null : p.pa > p.pb ? p.a : p.b;
        for (const side of [p.a, p.b]) {
          const a = data.alliances[side];
          if (!a) continue;
          const won = side === winner;
          if (won) addXp(a, 100);
          a.lastWar = { day: w.day, won, mine: side === p.a ? p.pa : p.pb, theirs: side === p.a ? p.pb : p.pa };
          if (won) for (const mid of p.hitters) { const m = data.users[mid]; if (m && m.alliance === side) m.pending += R.warWinGems; }
        }
      }
    }
    const list = Object.values(data.alliances).filter((a) => a.server === server && a.members.length).sort((a, b) => alliancePower(b) - alliancePower(a));
    w = data.wars[server] = { day: today, pairs: [] };
    for (let i = 0; i + 1 < list.length; i += 2) w.pairs.push({ a: list[i].id, b: list[i + 1].id, pa: 0, pb: 0, hitters: [] });
    return w;
  }
  function warOf(u, now) {
    const w = ensureWar(u.server, now);
    const inPair = (aid) => w.pairs.some((p) => p.a === aid || p.b === aid);
    let pair = w.pairs.find((p) => p.a === u.alliance || p.b === u.alliance);
    if (!pair) {
      // Alleanza nata oggi o rimasta spaiata: si abbina alla prima altra alleanza libera.
      const free = Object.values(data.alliances).find((a) => a.server === u.server && a.id !== u.alliance && a.members.length && !inPair(a.id));
      if (!free) return null;
      pair = { a: u.alliance, b: free.id, pa: 0, pb: 0, hitters: [] };
      w.pairs.push(pair);
    }
    const mineIsA = pair.a === u.alliance;
    return { pair, mineIsA, enemy: data.alliances[mineIsA ? pair.b : pair.a] };
  }

  function allyGet(u, _p, now) {
    touch(u, now);
    const a = myAlliance(u);
    if (!a.boss) spawnBoss(a, 1);
    const war = warOf(u, now);
    return {
      ...me(u, now),
      alliance: {
        id: a.id, name: a.name, tag: a.tag, level: a.level, xp: a.xp, xpNext: xpNext(a.level), leader: a.leader,
        members: members(a).map((x) => ({ ...pub(x), donated: a.donated[x.id] || 0, leader: x.id === a.leader, me: x.id === u.id }))
          .sort((x, y) => y.power - x.power),
        max: R.allianceMax,
        boss: { level: a.boss.level, hp: a.boss.hp, maxHp: a.boss.maxHp },
        lastWar: a.lastWar || null,
        war: war && war.enemy ? {
          enemy: { name: war.enemy.name, tag: war.enemy.tag, level: war.enemy.level },
          mine: war.mineIsA ? war.pair.pa : war.pair.pb, theirs: war.mineIsA ? war.pair.pb : war.pair.pa,
          endsAt: (dayOf(now) + 1) * DAY,
          targets: members(war.enemy).filter((x) => x.dps > 0).map(pub).sort((x, y) => y.power - x.power),
        } : null,
      },
      left: { donations: R.donationsPerDay - u.donations, boss: R.bossAttacksPerDay - u.bossAttacks, war: R.warAttacksPerDay - u.warAttacks },
    };
  }

  function allyDonate(u, _p, now) {
    touch(u, now);
    const a = myAlliance(u);
    if (u.donations >= R.donationsPerDay) fail('limit');
    u.donations++; a.donated[u.id] = (a.donated[u.id] || 0) + 1;
    addXp(a, R.donationXp);
    return { reward: { gems: 2 }, ...allyGet(u, {}, now) };
  }

  function allyBoss(u, _p, now) {
    touch(u, now);
    const a = myAlliance(u);
    if (!(u.dps > 0)) fail('no_snapshot');
    if (u.bossAttacks >= R.bossAttacksPerDay) fail('limit');
    if (!a.boss) spawnBoss(a, 1);
    u.bossAttacks++;
    const dmg = Math.min(a.boss.hp, u.dps * R.bossBurstSeconds * (0.9 + 0.2 * rnd()));
    a.boss.hp -= dmg;
    if (!a.boss.hitters.includes(u.id)) a.boss.hitters.push(u.id);
    let killed = false;
    if (a.boss.hp <= 0) {
      killed = true;
      const gems = Math.min(25, 5 + a.boss.level);
      for (const mid of a.boss.hitters) { const m = data.users[mid]; if (m && m.alliance === a.id) m.pending += gems; }
      addXp(a, 50 * a.boss.level);
      spawnBoss(a, a.boss.level + 1);
    }
    return { dmg, killed, ...allyGet(u, {}, now) };
  }

  function allyWarFight(u, { id: oppId }, now) {
    touch(u, now);
    myAlliance(u);
    const war = warOf(u, now);
    if (!war || !war.enemy) fail('no_war');
    if (!(u.dps > 0 && u.hp > 0)) fail('no_snapshot');
    if (u.warAttacks >= R.warAttacksPerDay) fail('limit');
    const opp = data.users[oppId];
    if (!opp || opp.alliance !== war.enemy.id) fail('not_found');
    u.warAttacks++;
    const res = duel(u, opp, rnd);
    const pts = res.win ? 3 : 1;
    if (war.mineIsA) war.pair.pa += pts; else war.pair.pb += pts;
    if (!war.pair.hitters.includes(u.id)) war.pair.hitters.push(u.id);
    return { ...res, points: pts, opponent: { name: opp.name, tag: tagOf(opp), plane: opp.plane }, ...allyGet(u, {}, now) };
  }

  function claim(u, _p, now) {
    const gems = u.pending; u.pending = 0;
    return { reward: { gems }, ...me(u, now) };
  }

  // ---------- chat ----------
  function channelKey(u, channel) {
    if (channel === 'alliance') return 'a:' + myAlliance(u).id;
    return 'g:' + u.server;
  }
  function chatGet(u, { channel, after = 0 }) {
    const list = data.chat[channelKey(u, channel)] || [];
    return {
      messages: list.filter((m) => m.n > after && m.reports.length < R.reportsToHide)
        .map((m) => ({ n: m.n, name: m.name, tag: m.tag, text: m.text, ts: m.ts, me: m.uid === u.id })),
    };
  }
  function chatSend(u, { channel, text }, now) {
    if (now - u.lastChat < R.chatMinGapMs) fail('too_fast');
    const key = channelKey(u, channel);
    const list = data.chat[key] || (data.chat[key] = []);
    u.lastChat = now;
    list.push({ n: data.seq++, uid: u.id, name: u.name, tag: tagOf(u), text: cleanText(text), ts: now, reports: [] });
    if (list.length > R.chatKeep) list.splice(0, list.length - R.chatKeep);
    return chatGet(u, { channel, after: 0 });
  }
  function chatReport(u, { channel, n }) {
    const msg = (data.chat[channelKey(u, channel)] || []).find((m) => m.n === n) || fail('not_found');
    if (msg.uid !== u.id && !msg.reports.includes(u.id)) msg.reports.push(u.id);
    return { ok: true };
  }

  const ACTIONS = {
    me: (u, p, now) => me(u, now), sync, claim,
    'arena.list': (u, p, now) => arenaList(u, now), 'arena.fight': arenaFight, 'arena.refill': arenaRefill, 'arena.top': arenaTop,
    'ally.list': allyList, 'ally.create': allyCreate, 'ally.join': allyJoin, 'ally.leave': allyLeave, 'ally.get': allyGet,
    'ally.donate': allyDonate, 'ally.boss': allyBoss, 'ally.war': allyWarFight,
    'chat.get': chatGet, 'chat.send': chatSend, 'chat.report': chatReport,
  };

  /** Punto d'ingresso unico: valida il token ed esegue l'azione. */
  function handle(token, action, payload = {}, now = Date.now()) {
    if (payload === null || typeof payload !== 'object') fail('bad_request');
    if (action === 'register') return register(payload, now);
    const u = data.users[data.tokens[token]] || fail('unauthorized');
    const fn = Object.hasOwn(ACTIONS, action) ? ACTIONS[action] : fail('unknown_action');
    return fn(u, payload, now);
  }

  return { data, handle, rules: R };
}
