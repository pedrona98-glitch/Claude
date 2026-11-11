// Regole del gioco online: account, server, lega PvP settimanale, alleanze, guerra settimanale e chat.
// È JavaScript puro su un oggetto dati in memoria, così lo stesso codice gira
// sul server vero (server/index.js) e nella demo dentro il browser (src/online.js).

export const RULES = {
  serverOpenDays: 7,      // un server accetta nuove iscrizioni per questi giorni...
  serverCap: 3000,        // ...o fino a questo numero di giocatori
  leagueSize: 100,
  arenaTickets: 5,
  clanMax: 50,
  rejoinHours: 24,
  warTickets: 5,
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
/** Settimana di gioco: parte il martedì (UTC). Giorni 0-5 attivi (mar-dom), 6 = lunedì di pausa. */
export const weekOf = (now) => Math.floor((dayOf(now) - 5) / 7);
export const weekDay = (now) => (((dayOf(now) - 5) % 7) + 7) % 7;
export const weekEnd = (now) => ((weekOf(now) + 1) * 7 + 5) * DAY;
export const activeEnd = (now) => (weekOf(now) * 7 + 5 + 6) * DAY;

// ---------- lega ----------
export const LEAGUE_IDS = ['unranked', 'bronze', 'silver', 'gold', 'platinum', 'diamond'];
const LEAGUE_MOVE = [[90, 101], [80, 101], [50, 90], [20, 80], [10, 70], [0, 36]]; // [promossi fino a, retrocessi da]
const BRACKETS = [1, 2, 3, 5, 10, 20, 50, 100];
// Per lega e fascia di classifica: [chiavi inglesi, monete, piani, casse, progetti, vernice].
const LEAGUE_REWARDS = [
  [[175, 9e3, 210, 1, 180, 0], [140, 7e3, 170, 0, 140, 0], [110, 5600, 140, 0, 0, 0], [90, 4500, 100, 0, 0, 0], [70, 3500, 0, 0, 0, 0], [50, 2800, 0, 0, 0, 0], [40, 2290, 0, 0, 0, 0], [30, 1800, 0, 0, 0, 0]],
  [[350, 17500, 420, 2, 350, 70], [280, 14e3, 330, 1, 280, 20], [220, 11200, 270, 1, 220, 0], [180, 9e3, 210, 1, 180, 0], [140, 7100, 170, 1, 140, 0], [110, 5700, 130, 0, 110, 0], [90, 4500, 110, 0, 90, 0], [70, 3600, 90, 0, 70, 0]],
  [[700, 35e3, 840, 3, 700, 280], [550, 28e3, 672, 2, 560, 230], [450, 22400, 538, 2, 448, 180], [350, 17900, 430, 1, 358, 150], [290, 14300, 344, 1, 287, 0], [230, 11400, 275, 1, 229, 0], [190, 9170, 220, 1, 184, 0], [150, 7340, 176, 1, 147, 0]],
  [[1220, 61200, 1470, 5, 1220, 490], [980, 49e3, 1170, 4, 980, 392], [784, 39200, 941, 3, 784, 314], [627, 31300, 753, 2, 627, 251], [502, 25e3, 602, 2, 502, 201], [401, 20e3, 482, 2, 401, 161], [321, 16e3, 385, 1, 321, 128], [257, 12800, 308, 1, 257, 0]],
  [[1750, 87500, 2100, 7, 1750, 700], [1400, 70e3, 1680, 6, 1400, 560], [1120, 56e3, 1340, 4, 1120, 448], [896, 44800, 1070, 4, 896, 358], [717, 35800, 860, 3, 717, 287], [573, 28600, 688, 2, 573, 229], [459, 22900, 551, 2, 459, 184], [367, 18300, 440, 1, 367, 147]],
  [[2620, 131e3, 3150, 11, 2620, 1050], [2100, 105e3, 2520, 8, 2100, 840], [1680, 84e3, 2010, 7, 1680, 672], [1340, 67200, 1610, 5, 1340, 538], [1070, 53700, 1290, 4, 1070, 430], [860, 43e3, 1030, 3, 860, 344], [688, 34400, 826, 3, 688, 275], [551, 27500, 661, 2, 551, 220]],
];
const PLAN_SCALE = 1 / 40, CRATE_SCALE = 0.5;
function pack(row, crateRarity) {
  const [wrenches, coins, plans, crates, blueprints, paint] = row;
  const n = Math.round(crates * CRATE_SCALE);
  return { wrenches, coins, plans: Math.round(plans * PLAN_SCALE), blueprints, paint, crates: Array(n).fill(crateRarity) };
}
export function leagueReward(tier, rank) {
  const b = BRACKETS.findIndex((x) => rank <= x);
  return b < 0 ? null : pack(LEAGUE_REWARDS[tier][b], Math.min(3, 1 + Math.floor(tier / 2)));
}

// ---------- guerra ----------
export const WAR_DAY_VALUE = [1, 2, 3, 4, 5, 2];
export const WAR_DAYS = [
  ['forge', 'tech', 'skillUp'],
  ['forgeCoins', 'forgeUp', 'dungeonKey', 'hatch', 'merge'],
  ['forge', 'skillUp', 'emblem'],
  ['forgeCoins', 'forgeUp', 'tech', 'hatch', 'merge'],
  ['forge', 'dungeonKey', 'emblem'],
  ['fight'],
];
const AGE_POINTS = [1, 1, 1, 2, 2, 2, 2, 3, 3, 3];
const POINTS = {
  forge: (a) => AGE_POINTS[a] || 0,
  tech: (t) => [300, 7500, 20000, 35000, 62000][t] || 0,
  skillUp: (r) => [50, 75, 100, 125, 150, 175][r] || 0,
  forgeCoins: () => 10,
  forgeUp: () => 10000,
  dungeonKey: () => 1000,
  hatch: (r) => [250, 1000, 2500, 5000, 10000, 16000][r] || 0,
  merge: (r) => [50, 200, 500, 1000, 2000, 3200][r] || 0,
  emblem: (r) => [400, 600, 900, 1350, 2000, 3000][r] || 0,
};
/** Punti di una voce del registro azioni nel giorno di guerra `day`. */
export function warPoints(key, count, day) {
  const [kind, arg] = String(key).split(':');
  if (!WAR_DAYS[day] || !WAR_DAYS[day].includes(kind) || !POINTS[kind]) return 0;
  const n = Math.min(1e6, Math.max(0, Math.floor(Number(count) || 0)));
  return POINTS[kind](Number(arg) || 0) * n;
}
export const CLAN_TIERS = [['S', 25], ['A', 20], ['B', 15], ['C', 10]];
export const clanTier = (tp) => CLAN_TIERS.findIndex(([, min]) => tp >= min);
// Per fascia S/A/B/C: [vittoria, sconfitta] con le stesse colonne della lega.
const WAR_REWARDS = [
  [[8400, 280e3, 5600, 22, 4200, 2290], [4200, 140e3, 2800, 11, 2100, 1120]],
  [[5900, 196e3, 4000, 16, 3000, 1550], [3000, 98e3, 2000, 8, 1500, 780]],
  [[4000, 140e3, 2800, 11, 2000, 1000], [2000, 70e3, 1400, 5, 1000, 550]],
  [[2900, 96e3, 1900, 8, 1500, 750], null],
];

const BAD_WORDS = ['cazzo', 'merda', 'stronz', 'vaffanculo', 'puttana', 'troia', 'fuck', 'shit', 'bitch', 'asshole', 'cunt', 'nigger', 'faggot'];
const BOT_NAMES = ['Recluta Alfa', 'Recluta Bravo', 'Recluta Charlie', 'Recluta Delta', 'Recluta Echo', 'Recluta Foxtrot'];

export function emptyData() {
  return { seq: 1, servers: [], users: {}, tokens: {}, clans: {}, chat: {}, groups: {}, wars: {} };
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
export const powerOf = (u) => Math.round(Math.sqrt(num(u.dps) * num(u.hp)) * 10);

/** Duello: vince chi abbatte l'altro per primo. Conta dps × vita, con un po' di fortuna. */
export function duel(a, b, rnd = Math.random) {
  const ta = num(b.hp) / (num(a.dps) * (0.85 + 0.3 * rnd()) || 1e-9);
  const tb = num(a.hp) / (num(b.dps) * (0.85 + 0.3 * rnd()) || 1e-9);
  const win = ta <= tb;
  return { win, myLeft: win ? Math.max(0, 1 - ta / tb) : 0, oppLeft: win ? 0 : Math.max(0, 1 - tb / ta) };
}
function addPack(u, p) {
  if (!p) return;
  const t = u.pack || (u.pack = {});
  for (const [k, v] of Object.entries(p)) {
    if (k === 'crates') { if (v.length) t.crates = (t.crates || []).concat(v); } else if (v) t[k] = (t[k] || 0) + v;
  }
}

export function createWorld(data = emptyData(), { rnd = Math.random, rules = {} } = {}) {
  const R = { ...RULES, ...rules };
  const id = (prefix) => prefix + (data.seq++).toString(36);
  for (const k of ['clans', 'groups', 'wars', 'chat']) data[k] = data[k] || {};

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
      dps: 0, hp: 0, stage: 1, plane: 'biplane',
      lg: 0, lgWeek: weekOf(now), tix: R.arenaTickets, tixDay: dayOf(now), wins: 0, offer: [],
      clan: null, leftAt: 0, warTix: R.warTickets, warWeek: weekOf(now), lastChat: 0, pack: null,
    };
    srv.count++;
    data.users[user.id] = user;
    const token = id('t') + Math.floor(rnd() * 1e15).toString(36) + Math.floor(rnd() * 1e15).toString(36);
    data.tokens[token] = user.id;
    return { token, ...me(user, now) };
  }

  /** Aggiornamenti giornalieri e cambio di stagione, la prima volta che il giocatore si fa vivo. */
  function touch(u, now) {
    if (u.tixDay !== dayOf(now)) { u.tixDay = dayOf(now); u.tix = R.arenaTickets; }
    const week = weekOf(now);
    if (u.lgWeek !== week) settleLeague(u, week);
    if (u.warWeek !== week) { u.warWeek = week; u.warTix = R.warTickets; }
    if (u.clan) settleWar(u.server, now);
  }

  const clanOf = (u) => (u.clan && data.clans[u.clan]) || null;
  const tagOf = (u) => clanOf(u)?.tag || '';
  const pub = (u) => ({ id: u.id, name: u.name, tag: tagOf(u), stage: u.stage, plane: u.plane, power: powerOf(u), bot: !!u.bot });

  function me(u, now) {
    touch(u, now);
    const c = clanOf(u);
    return {
      user: { id: u.id, name: u.name, server: u.server, league: u.lg, tickets: u.tix, ticketsMax: R.arenaTickets, hasPack: !!u.pack },
      clan: c ? { id: c.id, name: c.name, tag: c.tag, tier: clanTier(c.tp) } : null,
    };
  }

  function sync(u, p, now) {
    u.dps = num(p.dps); u.hp = num(p.hp);
    u.stage = Math.max(1, Math.floor(num(p.stage)) || 1);
    if (typeof p.plane === 'string') u.plane = p.plane.slice(0, 20);
    u.seenAt = now;
    return me(u, now);
  }

  function claim(u, _p, now) {
    const p = u.pack || {}; u.pack = null;
    return { reward: p, ...me(u, now) };
  }

  // ---------- lega ----------
  const groupKey = (week, server, tier, n) => `${week}:${server}:${tier}:${n}`;
  function groupOf(u, week) {
    if (u.group && u.group.startsWith(week + ':')) return data.groups[u.group];
    for (let n = 0; ; n++) {
      const key = groupKey(week, u.server, u.lg, n);
      const g = data.groups[key] || (data.groups[key] = { ids: [], lp: {} });
      if (g.ids.length < R.leagueSize) { g.ids.push(u.id); g.lp[u.id] = 0; u.group = key; return g; }
    }
  }
  const standings = (g) => g.ids.slice().sort((a, b) => (g.lp[b] || 0) - (g.lp[a] || 0));
  function settleLeague(u, week) {
    const old = u.group && data.groups[u.group];
    if (old && Number(u.group.split(':')[0]) < week) {
      const rank = standings(old).indexOf(u.id) + 1, [up, down] = LEAGUE_MOVE[u.lg];
      if ((old.lp[u.id] || 0) > 0) addPack(u, leagueReward(u.lg, rank));
      u.lastSeason = { league: u.lg, rank, points: old.lp[u.id] || 0 };
      if (rank <= up && u.lg < LEAGUE_IDS.length - 1) u.lg++;
      else if (rank >= down && u.lg > 0) u.lg--;
    }
    u.lgWeek = week; u.group = null;
  }

  function leagueGet(u, _p, now) {
    touch(u, now);
    const g = groupOf(u, weekOf(now)), order = standings(g);
    const closed = weekDay(now) === 6;
    const near = order.filter((x) => x !== u.id && data.users[x] && data.users[x].dps > 0)
      .sort((a, b) => Math.abs((g.lp[a] || 0) - (g.lp[u.id] || 0)) - Math.abs((g.lp[b] || 0) - (g.lp[u.id] || 0))).slice(0, 8);
    const picks = [];
    while (picks.length < 3 && near.length) picks.push(data.users[near.splice(Math.floor(rnd() * near.length), 1)[0]]);
    u.offer = picks.map((x) => ({ ...pub(x), dps: x.dps, hp: x.hp, points: g.lp[x.id] || 0 }));
    // Pochi piloti nel girone: si completa con avversari d'addestramento, dichiarati come tali.
    for (let i = 0; u.offer.length < 3; i++) {
      const k = 0.75 + 0.2 * i + 0.1 * rnd();
      u.offer.push({ id: 'bot' + i, name: BOT_NAMES[Math.floor(rnd() * BOT_NAMES.length)], tag: '', bot: true, stage: u.stage, plane: 'mono',
        dps: num(u.dps) * k || 1, hp: num(u.hp) * k || 1, power: Math.round(powerOf(u) * k), points: g.lp[u.id] || 0 });
    }
    return {
      ...me(u, now),
      week: { day: weekDay(now), closed, endsAt: closed ? weekEnd(now) : activeEnd(now) },
      league: u.lg, points: g.lp[u.id] || 0, rank: order.indexOf(u.id) + 1, size: order.length,
      move: LEAGUE_MOVE[u.lg], lastSeason: u.lastSeason || null,
      table: order.slice(0, 100).map((x, i) => ({ rank: i + 1, ...pub(data.users[x]), points: g.lp[x] || 0, me: x === u.id })),
      opponents: closed ? [] : u.offer.map(({ dps, hp, ...rest }) => rest),
    };
  }

  function leagueFight(u, { id: oppId }, now) {
    touch(u, now);
    if (weekDay(now) === 6) fail('season_closed');
    if (!(u.dps > 0 && u.hp > 0)) fail('no_snapshot');
    const opp = u.offer.find((x) => x.id === oppId) || fail('not_found');
    if (u.tix <= 0) fail('no_tickets');
    u.tix--;
    const g = groupOf(u, weekOf(now)), res = duel(u, opp, rnd);
    const ratio = powerOf(opp) / Math.max(1, powerOf(u));
    const gain = res.win ? Math.round(15 + Math.max(-5, Math.min(10, (ratio - 1) * 20))) : 2;
    g.lp[u.id] = (g.lp[u.id] || 0) + gain;
    if (res.win) u.wins++;
    u.offer = [];
    return { ...res, points: gain, opponent: { name: opp.name, tag: opp.tag, plane: opp.plane }, ...me(u, now) };
  }

  // ---------- alleanze ----------
  const members = (c) => c.members.map((mid) => data.users[mid]).filter(Boolean);
  const clanPower = (c) => members(c).reduce((s, x) => s + powerOf(x), 0);
  const myClan = (u) => clanOf(u) || fail('no_alliance');

  function clanList(u, { q = '' } = {}) {
    const needle = String(q).toLowerCase().slice(0, 20);
    const list = Object.values(data.clans).filter((c) => c.server === u.server && (!needle || c.name.toLowerCase().includes(needle) || c.tag.toLowerCase().includes(needle)))
      .map((c) => ({ id: c.id, name: c.name, tag: c.tag, tier: clanTier(c.tp), members: c.members.length, max: R.clanMax, power: clanPower(c) }))
      .sort((a, b) => b.power - a.power).slice(0, 30);
    return { alliances: list };
  }
  function canJoin(u, now) {
    if (u.clan) fail('in_alliance');
    if (now - u.leftAt < R.rejoinHours * 3600e3) fail('rejoin_wait');
  }
  function clanCreate(u, { name, tag }, now) {
    canJoin(u, now);
    const c = {
      id: id('c'), server: u.server, name: cleanName(name, 3, 20), tag: cleanName(tag, 2, 4).toUpperCase().replace(/[^A-Z0-9]/g, '') || fail('bad_name'),
      leader: u.id, members: [u.id], tp: 10, createdAt: now, lastWar: null,
    };
    if (Object.values(data.clans).some((x) => x.server === u.server && (x.name.toLowerCase() === c.name.toLowerCase() || x.tag === c.tag))) fail('name_taken');
    data.clans[c.id] = c; u.clan = c.id;
    return clanGet(u, {}, now);
  }
  function clanJoin(u, { id: cid }, now) {
    canJoin(u, now);
    const c = data.clans[cid];
    if (!c || c.server !== u.server) fail('not_found');
    if (c.members.length >= R.clanMax) fail('full');
    c.members.push(u.id); u.clan = c.id;
    return clanGet(u, {}, now);
  }
  function clanLeave(u, _p, now) {
    const c = myClan(u);
    c.members = c.members.filter((x) => x !== u.id);
    u.clan = null; u.leftAt = now;
    const w = warOf(c, now); if (w) delete w.pair.contrib[u.id]; // lasciando a metà guerra si perdono i premi personali
    if (!c.members.length) { delete data.clans[c.id]; delete data.chat['a:' + c.id]; }
    else if (c.leader === u.id) c.leader = c.members[0];
    return me(u, now);
  }

  // Guerra: ogni martedì le alleanze di un server vengono accoppiate per fascia e forza.
  function ensureWar(server, now) {
    const week = weekOf(now), key = `${week}:${server}`;
    let w = data.wars[key];
    if (!w) {
      const list = Object.values(data.clans).filter((c) => c.server === server && c.members.length)
        .sort((a, b) => b.tp - a.tp || clanPower(b) - clanPower(a));
      w = data.wars[key] = { week, server, pairs: [], settled: false };
      for (let i = 0; i + 1 < list.length; i += 2) w.pairs.push(newPair(list[i].id, list[i + 1].id));
    }
    return w;
  }
  const newPair = (a, b) => ({ a, b, days: WAR_DAY_VALUE.map(() => [0, 0]), contrib: {}, beaten: {}, brawl: [false, false] });
  function warOf(c, now) {
    if (weekDay(now) === 6) return null;
    const w = ensureWar(c.server, now), inPair = (cid) => w.pairs.some((p) => p.a === cid || p.b === cid);
    let pair = w.pairs.find((p) => p.a === c.id || p.b === c.id);
    if (!pair) {
      // Alleanza nata a guerra iniziata o rimasta spaiata: si abbina alla prima alleanza libera.
      const free = Object.values(data.clans).find((x) => x.server === c.server && x.id !== c.id && x.members.length && !inPair(x.id));
      if (!free) return null;
      pair = newPair(c.id, free.id); w.pairs.push(pair);
    }
    const side = pair.a === c.id ? 0 : 1;
    return { w, pair, side, enemy: data.clans[side ? pair.a : pair.b] };
  }
  function settleWar(server, now) {
    for (const w of Object.values(data.wars)) {
      if (w.server !== server || w.settled || (w.week === weekOf(now) && weekDay(now) < 6)) continue;
      w.settled = true;
      for (const p of w.pairs) {
        const score = [0, 0];
        p.days.forEach(([x, y], d) => { if (x > y) score[0] += WAR_DAY_VALUE[d]; else if (y > x) score[1] += WAR_DAY_VALUE[d]; });
        [p.a, p.b].forEach((cid, side) => {
          const c = data.clans[cid];
          if (!c) return;
          const won = score[side] > score[1 - side], tier = clanTier(c.tp);
          const row = tier >= 0 ? WAR_REWARDS[tier][won ? 0 : 1] : null;
          for (const [uid, pts] of Object.entries(p.contrib)) {
            const m = data.users[uid];
            if (m && m.clan === cid && pts > 0 && row) addPack(m, pack(row, Math.max(1, 3 - tier)));
          }
          c.tp = Math.max(0, c.tp + (won ? 5 : tier >= 0 && tier <= 2 ? -5 : 0));
          c.lastWar = { week: w.week, won, mine: score[side], theirs: score[1 - side], tier };
        });
      }
    }
  }

  function clanGet(u, _p, now) {
    touch(u, now);
    const c = myClan(u), war = warOf(c, now), day = weekDay(now);
    const contrib = war ? war.pair.contrib : {};
    return {
      ...me(u, now),
      clan: {
        id: c.id, name: c.name, tag: c.tag, tp: c.tp, tier: clanTier(c.tp), leader: c.leader, max: R.clanMax, lastWar: c.lastWar,
        members: members(c).map((x) => ({ ...pub(x), leader: x.id === c.leader, me: x.id === u.id, points: contrib[x.id] || 0 }))
          .sort((x, y) => y.points - x.points || y.power - x.power),
      },
      war: war && war.enemy ? {
        day, days: war.pair.days.map((d) => (war.side ? [d[1], d[0]] : d)), values: WAR_DAY_VALUE, kinds: WAR_DAYS,
        enemy: { name: war.enemy.name, tag: war.enemy.tag, tier: clanTier(war.enemy.tp) },
        endsAt: activeEnd(now), dayEndsAt: (dayOf(now) + 1) * DAY, tickets: u.warTix, myPoints: contrib[u.id] || 0,
        targets: day === 5 ? members(war.enemy).filter((x) => x.dps > 0).map((x) => ({ ...pub(x), beaten: !!war.pair.beaten[x.id] })).sort((x, y) => y.power - x.power) : [],
      } : null,
      week: { day, endsAt: day === 6 ? weekEnd(now) : activeEnd(now) },
    };
  }

  function warReport(u, { log }, now) {
    touch(u, now);
    const c = myClan(u), war = warOf(c, now);
    if (!war || !log || typeof log !== 'object') return { added: 0, ...me(u, now) };
    const day = weekDay(now);
    let added = 0;
    for (const [key, count] of Object.entries(log).slice(0, 50)) added += warPoints(key, count, day);
    war.pair.days[day][war.side] += added;
    war.pair.contrib[u.id] = (war.pair.contrib[u.id] || 0) + added;
    return { added, ...me(u, now) };
  }

  function warFight(u, { id: oppId }, now) {
    touch(u, now);
    const c = myClan(u), war = warOf(c, now);
    if (!war || !war.enemy || weekDay(now) !== 5) fail('no_war');
    if (!(u.dps > 0 && u.hp > 0)) fail('no_snapshot');
    if (u.warTix <= 0) fail('no_tickets');
    const enemies = members(war.enemy).filter((x) => x.dps > 0).sort((x, y) => powerOf(y) - powerOf(x));
    const idx = enemies.findIndex((x) => x.id === oppId);
    if (idx < 0) fail('not_found');
    u.warTix--;
    const opp = enemies[idx], res = duel(u, opp, rnd);
    let pts = res.win ? Math.round(1 + 49 * (enemies.length > 1 ? 1 - idx / (enemies.length - 1) : 1)) : 0;
    if (res.win) {
      war.pair.beaten[opp.id] = true;
      if (!war.pair.brawl[war.side] && enemies.every((x) => war.pair.beaten[x.id])) { war.pair.brawl[war.side] = true; pts += 1000; }
    }
    war.pair.days[5][war.side] += pts;
    war.pair.contrib[u.id] = (war.pair.contrib[u.id] || 0) + pts;
    return { ...res, points: pts, opponent: { name: opp.name, tag: war.enemy.tag, plane: opp.plane }, ...clanGet(u, {}, now) };
  }

  // ---------- chat ----------
  function channelKey(u, channel) {
    if (channel === 'alliance') return 'a:' + myClan(u).id;
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
    'league.get': leagueGet, 'league.fight': leagueFight,
    'clan.list': clanList, 'clan.create': clanCreate, 'clan.join': clanJoin, 'clan.leave': clanLeave, 'clan.get': clanGet,
    'war.report': warReport, 'war.fight': warFight,
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

  return { data, handle, rules: R, groupOf, standings, warOf };
}
