// Schermate online: lega PvP settimanale, alleanza con guerra settimanale, chat.
import * as G from './game.js';
import { ALLIANCE_CREATE_GEMS, AGES } from './data.js';
import { fmt, fmtTime } from './format.js';
import { t } from './i18n.js';
import { sfx } from './audio.js';
import { ic, withIcon } from './icons.js';
import { Online } from './online.js';
import { LEAGUE_IDS, CLAN_TIERS } from '../shared/social.js';
import { el, html, cost, packHtml } from './ui.js';

const SYNC_EVERY_MS = 60e3;
const WAR_FLUSH_MS = 20e3;
const CHAT_POLL_MS = 4000;
const SHAPE_COLORS = { biplane: '#d95d39', mono: '#5aa9e6', fighter: '#9b8cf0', jet: '#f2a25c', stealth: '#4fd1c5' };

export function createOnlineUI(kit) {
  const { S, now, toast, openModal, row, setBtn, heading } = kit;
  const o = () => S().online;
  let me = null, lg = null, clan = null, clanList = null, lastWeek = null;
  let busy = false, claiming = false, lastSync = 0, lastFlush = 0;

  // ---------- comunicazione ----------
  function absorb(r) {
    if (!r) return r;
    if (r.user) me = r.user;
    if (r.week) lastWeek = r.week;
    if (r.user && r.user.hasPack && !claiming) {
      claiming = true;
      call('claim').then((c) => {
        claiming = false;
        if (c && Object.keys(c.reward).length) {
          G.give(S(), c.reward); sfx.reward(); kit.app.save();
          openModal({ title: t('season_rewards'), icon: 'trophy', body: html('div', 'big-coins wrap', packHtml(c.reward)), buttons: [{ label: t('collect') }] });
        }
      });
    }
    return r;
  }
  function errorText(code) {
    const key = 'err_' + code, text = t(key);
    return text === key ? t('err_generic') : text;
  }
  async function call(action, payload, { quiet = false, retry = true } = {}) {
    try {
      return absorb(await Online.call(o().token, action, payload));
    } catch (err) {
      const code = err && err.code;
      // Account sconosciuto al server (dati demo cancellati, server ripristinato): ci si iscrive di nuovo.
      if (code === 'unauthorized' && retry && o().name && (await register(o().name, true))) return call(action, payload, { quiet, retry: false });
      if (!quiet) toast(errorText(code));
      return null;
    }
  }
  async function register(name, quiet = false) {
    try {
      const r = await Online.call(null, 'register', { name });
      o().token = r.token; o().name = r.user.name; absorb(r); kit.app.save();
      await sync(true);
      return true;
    } catch (err) {
      if (!quiet) toast(errorText(err && err.code));
      return false;
    }
  }
  function sync(force = false) {
    if (!o().token) return Promise.resolve(null);
    if (!force && now() - lastSync < 5000) return Promise.resolve(null);
    lastSync = now();
    const s = S(), st = G.stats(s), hull = s.parts.hull;
    return call('sync', { dps: st.dps, hp: st.hp, stage: s.stage, plane: AGES[hull ? hull.age : 0].shape }, { quiet: true });
  }
  /** Invia al server le azioni che valgono punti nella guerra d'alleanza. */
  async function flushWar() {
    const s = S();
    lastFlush = now();
    if (!o().token || !Object.keys(s.warLog).length) return;
    const log = G.takeWarLog(s);
    const r = await call('war.report', { log }, { quiet: true });
    if (!r) for (const [k, v] of Object.entries(log)) s.warLog[k] = (s.warLog[k] || 0) + v; // si riprova più tardi
    else if (r.added) { toast(t('war_points', fmt(r.added))); if (clan && clan.war) clan.war.myPoints += r.added; }
    kit.app.save();
  }
  kit.app.flushWar = flushWar;
  /** Chiamato a ogni aggiornamento dell'interfaccia. */
  function heartbeat() {
    if (!o().token) return;
    if (now() - lastSync > SYNC_EVERY_MS) sync();
    if (now() - lastFlush > WAR_FLUSH_MS) flushWar();
  }

  function rerender(tab) { if (kit.currentTab() === tab) kit.render(); }
  async function load(tab) {
    if (busy || !o().token) return;
    busy = true;
    await sync(true);
    if (tab === 'arena') lg = await call('league.get');
    else {
      await flushWar();
      clan = await call('clan.get', {}, { quiet: true });
      clanList = clan ? null : (await call('clan.list'))?.alliances || [];
    }
    busy = false;
    rerender(tab);
  }
  function enter(tab) {
    if (tab === 'arena') lg = null; else if (tab === 'ally') { clan = null; clanList = null; }
  }

  // ---------- pezzi comuni ----------
  const demoTag = () => (Online.demo ? html('div', 'demo-tag', withIcon('flask', t('demo_tag'))) : null);
  function intro(text, icon) {
    const card = el('div', 'card center');
    const btn = el('button', 'btn primary wide', t('enter'));
    btn.onclick = askName;
    card.append(html('div', 'card-icon', ic(icon)), el('p', 'sub', text), btn);
    kit.panel.append(card);
    const tag = demoTag(); if (tag) kit.panel.append(tag);
  }
  function field(id, placeholder, max, value = '') {
    const input = el('input', 'field');
    input.id = id; input.type = 'text'; input.maxLength = max; input.placeholder = placeholder; input.value = value;
    input.autocomplete = 'off'; input.setAttribute('aria-label', placeholder);
    return input;
  }
  function askName() {
    const input = field('f-callsign', t('callsign_ph'), 16, o().name || '');
    const body = el('div', 'form'); body.append(el('p', '', t('online_intro')), input);
    openModal({
      title: t('callsign'), icon: 'users', body,
      buttons: [{ label: t('cancel'), kind: 'ghost' }, { label: t('enter'), onClick: async () => { if (!(await register(input.value))) return false; kit.render(); } }],
    });
    setTimeout(() => input.focus(), 50);
  }
  const nameTag = (p) => (p.tag ? `[${p.tag}] ${p.name}` : p.name);
  const planeOf = (p) => kit.planeIcon(p.plane in SHAPE_COLORS ? p.plane : 'biplane', SHAPE_COLORS[p.plane] || SHAPE_COLORS.biplane);
  const loading = () => kit.panel.append(el('p', 'hint center', '···'));
  const leagueName = (i) => t('lg_' + LEAGUE_IDS[i]);
  const tierId = (i) => (i >= 0 ? CLAN_TIERS[i][0] : 'none');
  const tierName = (i) => t('ct_' + tierId(i));

  /** Testo sul pulsante laterale: tempo rimasto alla stagione / alla guerra. */
  function sideInfo(arenaBtn, warBtn, n) {
    const week = lastWeek;
    const label = week ? fmtTime(Math.max(0, (week.endsAt - n) / 1000)).split(' ')[0] : '';
    if (!arenaBtn.hidden) {
      arenaBtn.querySelector('span').textContent = label || t('tab_arena');
      arenaBtn.classList.toggle('has-dot', !!me && me.tickets > 0 && !(week && week.day === 6));
    }
    if (!warBtn.hidden) {
      warBtn.querySelector('span').textContent = label || t('war');
      warBtn.classList.toggle('has-dot', !!week && week.day === 5 && !!clan && !!clan.war && clan.war.tickets > 0);
    }
  }

  // ---------- lega ----------
  function tabArena() {
    if (!G.unlocked(S(), 'arena')) return kit.locked('arena', t('arena_lock'));
    if (!o().token) return intro(t('arena_hint'), 'swords');
    if (!lg) { loading(); load('arena'); return; }
    const card = el('div', 'card'), head = el('div', 'card-head'), info = el('div', 'info');
    info.append(el('div', 'name', `${leagueName(lg.league)} · ${t('points_n', lg.points)}`),
      el('div', 'sub', `${o().name} · ${t('rank_of', lg.rank, lg.size)} · ${t('server_n', me.server)}`));
    head.append(html('div', 'league lg-' + LEAGUE_IDS[lg.league], ic('trophy')), info);
    const zone = el('div', 'sub');
    const [up, down] = lg.move;
    zone.textContent = [up ? t('zone_up', up) : '', down <= 50 ? t('zone_down', down) : ''].filter(Boolean).join(' · ') || t('zone_none');
    const timer = el('div', 'sub');
    kit.addUpdater(() => {
      const left = Math.max(0, (lg.week.endsAt - now()) / 1000);
      timer.textContent = `${t('tickets', me.tickets, me.ticketsMax)} · ${lg.week.closed ? t('season_next', fmtTime(left)) : t('season_ends', fmtTime(left))}`;
    });
    const actions = el('div', 'btn-row');
    const top = html('button', 'btn ghost', withIcon('trophy', t('leaderboard'))); top.onclick = showTable;
    const again = html('button', 'btn ghost', withIcon('refresh', t('new_opponents'))); again.onclick = () => { lg = null; kit.render(); };
    actions.append(top, again);
    card.append(head, zone, timer, actions);
    kit.panel.append(card);
    const tag = demoTag(); if (tag) kit.panel.append(tag);
    if (lg.lastSeason) kit.panel.append(el('p', 'hint', t('last_season', leagueName(lg.lastSeason.league), lg.lastSeason.rank)));
    if (lg.week.closed) kit.panel.append(el('p', 'hint center', t('season_closed')));
    const myPower = G.power(S());
    for (const p of lg.opponents) {
      const x = row({ iconEl: planeOf(p), title: nameTag(p) });
      const stronger = p.power > myPower * 1.05, weaker = p.power < myPower * 0.95;
      x.sub.innerHTML = `${t('points_n', p.points)} · ${t('power')} <b class="${stronger ? 'neg' : weaker ? 'pos' : ''}">${fmt(p.power)}</b>${p.bot && !Online.demo ? ` · ${t('training_bot')}` : ''}`;
      setBtn(x, t('attack'), '', me.tickets > 0, 'danger');
      x.btn.onclick = async () => {
        x.btn.disabled = true;
        const r = await call('league.fight', { id: p.id });
        lg = null;
        if (r) kit.fightModal({ me: o().name, foe: nameTag(r.opponent), win: r.win, myLeft: r.myLeft, foeLeft: r.oppLeft, lines: [`<b class="${r.win ? 'pos' : ''}">+${r.points}</b> ${t('points')}`] });
        kit.render();
      };
      kit.panel.append(x.r);
    }
    kit.panel.append(el('p', 'hint', t('arena_rules')));
  }

  function showTable() {
    const list = el('div', 'board'), [up, down] = lg.move;
    for (const p of lg.table) {
      const line = el('div', 'board-row' + (p.me ? ' me' : '') + (p.rank <= up ? ' up' : p.rank >= down ? ' down' : ''));
      line.append(el('span', 'board-rank', String(p.rank)), el('span', 'board-name', nameTag(p)), el('span', 'board-score', fmt(p.points)));
      list.append(line);
    }
    openModal({ title: `${leagueName(lg.league)} · ${t('server_n', me.server)}`, body: list, cls: 'tall', buttons: [{ label: t('close'), kind: 'ghost' }] });
  }

  // ---------- alleanza ----------
  function tabAlliance() {
    if (!G.unlocked(S(), 'alliance')) return kit.locked('alliance', t('ally_lock'));
    if (!o().token) return intro(t('ally_none'), 'shield');
    if (!clan && !clanList) { loading(); load('ally'); return; }
    if (!clan) return browser();
    const c = clan.clan, w = clan.war;
    const card = el('div', 'card'), head = el('div', 'card-head'), info = el('div', 'info');
    info.append(el('div', 'name', `[${c.tag}] ${c.name}`), el('div', 'sub', `${t('tier_n_clan', tierName(c.tier), c.tp)} · ${t('members_n', c.members.length, c.max)}`));
    head.append(html('div', 'league tier-' + tierId(c.tier), ic('shield')), info);
    const actions = el('div', 'btn-row');
    const chat = html('button', 'btn ghost', withIcon('chat', t('chat'))); chat.onclick = () => openChat('alliance');
    actions.append(chat);
    card.append(head, actions);
    kit.panel.append(card);
    const tag = demoTag(); if (tag) kit.panel.append(tag);

    kit.panel.append(heading(t('war')));
    if (c.lastWar) kit.panel.append(el('p', 'hint', t(c.lastWar.won ? 'war_last_won' : 'war_last_lost', c.lastWar.mine, c.lastWar.theirs)));
    if (!w) kit.panel.append(el('p', 'hint', clan.week.day === 6 ? t('war_pause', fmtTime((clan.week.endsAt - now()) / 1000)) : t('war_none')));
    else warCard(w);

    kit.panel.append(heading(t('members')));
    for (const p of c.members) {
      const x = row({ iconEl: planeOf(p), title: p.name + (p.me ? ` (${t('you')})` : ''), noBtn: true });
      x.sub.textContent = `${p.leader ? t('leader') + ' · ' : ''}${t('power')} ${fmt(p.power)}${w ? ' · ' + t('war_pts', fmt(p.points)) : ''}`;
      kit.panel.append(x.r);
    }
    const leave = el('button', 'btn ghost wide', t('leave'));
    leave.onclick = () => openModal({
      title: t('leave'), icon: 'alert', body: t('leave_confirm'),
      buttons: [{ label: t('cancel'), kind: 'ghost' }, { label: t('confirm'), kind: 'danger', onClick: async () => { await call('clan.leave'); clan = null; clanList = null; kit.render(); } }],
    });
    kit.panel.append(leave);
  }

  function warCard(w) {
    const wc = el('div', 'card war');
    const score = w.days.reduce((acc, [a, b], d) => { if (a > b) acc[0] += w.values[d]; else if (b > a) acc[1] += w.values[d]; return acc; }, [0, 0]);
    const top = el('div', 'war-score');
    top.append(el('span', 'war-name', `[${clan.clan.tag}]`), el('b', score[0] >= score[1] ? 'pos' : 'neg', `${score[0]} : ${score[1]}`), el('span', 'war-name', `[${w.enemy.tag}]`));
    const ends = el('div', 'sub center');
    kit.addUpdater(() => { ends.textContent = `${t('war_vs', w.enemy.name, tierName(w.enemy.tier))} · ${t('war_ends', fmtTime((w.endsAt - now()) / 1000))}`; });
    const days = el('div', 'war-days');
    w.days.forEach(([a, b], d) => {
      const col = el('div', 'war-day' + (d === w.day ? ' today' : d < w.day ? (a > b ? ' won' : b > a ? ' lost' : '') : ''));
      col.append(el('b', '', t('wd_' + d)), el('span', 'war-val', `${w.values[d]} ${t('pt')}`), el('span', '', fmt(a)), el('span', 'sub', fmt(b)));
      days.append(col);
    });
    wc.append(top, ends, days);
    const today = el('div', 'war-today');
    today.append(el('div', 'name', t('war_today', t('wd_' + w.day))));
    for (const k of w.kinds[w.day]) today.append(html('div', 'sub', `${ic('check')} ${t('wk_' + k)}`));
    const mine = el('div', 'sub');
    kit.addUpdater(() => { mine.textContent = t('war_mine', fmt(w.myPoints)); });
    today.append(mine);
    wc.append(today);
    kit.panel.append(wc);
    if (w.day === 5) {
      kit.panel.append(el('p', 'hint', t('war_sunday', w.tickets)));
      const myPower = G.power(S());
      for (const p of w.targets) {
        const x = row({ iconEl: planeOf(p), title: p.name + (p.beaten ? ' ✓' : '') });
        x.sub.innerHTML = `${t('power')} <b class="${p.power > myPower * 1.05 ? 'neg' : p.power < myPower * 0.95 ? 'pos' : ''}">${fmt(p.power)}</b>`;
        setBtn(x, t('attack'), '', w.tickets > 0, 'danger');
        x.btn.onclick = async () => {
          x.btn.disabled = true;
          const r = await call('war.fight', { id: p.id });
          if (r) { clan = r; kit.fightModal({ me: o().name, foe: nameTag(r.opponent), win: r.win, myLeft: r.myLeft, foeLeft: r.oppLeft, lines: [`<b class="pos">+${fmt(r.points)}</b> ${t('points')}`] }); }
          kit.render();
        };
        kit.panel.append(x.r);
      }
    }
  }

  function browser() {
    const card = el('div', 'card');
    const create = html('button', 'btn gem wide', `<span>${t('ally_create')}</span>${cost('gem', ALLIANCE_CREATE_GEMS)}`);
    create.onclick = createClan;
    card.append(el('p', 'sub', t('ally_none')), create);
    kit.panel.append(card);
    const tag = demoTag(); if (tag) kit.panel.append(tag);
    for (const a of clanList) {
      const x = row({ icon: 'shield', title: `[${a.tag}] ${a.name}` });
      x.sub.textContent = `${tierName(a.tier)} · ${t('members_n', a.members, a.max)} · ${t('power')} ${fmt(a.power)}`;
      setBtn(x, t('join'), '', a.members < a.max);
      x.btn.onclick = async () => {
        const r = await call('clan.join', { id: a.id });
        if (r) { clan = r; sfx.reward(); kit.app.save(); }
        kit.render();
      };
      kit.panel.append(x.r);
    }
  }
  function createClan() {
    if (S().gems < ALLIANCE_CREATE_GEMS) { toast(t('not_enough_gems')); return; }
    const name = field('f-ally-name', t('ally_name'), 20), tag = field('f-ally-tag', t('ally_tag'), 4);
    const body = el('div', 'form'); body.append(name, tag);
    openModal({
      title: t('ally_create'), icon: 'shield', body,
      buttons: [
        { label: t('cancel'), kind: 'ghost' },
        { label: t('confirm'), onClick: async () => {
          const r = await call('clan.create', { name: name.value, tag: tag.value });
          if (!r) return false;
          S().gems -= ALLIANCE_CREATE_GEMS; clan = r; sfx.reward(); kit.app.save(); kit.render();
        } },
      ],
    });
  }

  // ---------- chat ----------
  function openChat(channel = 'global') {
    if (!G.unlocked(S(), 'chat')) { toast(t('unlock_at', G.stageName(G.unlockStage('chat')))); return; }
    if (!o().token) { askName(); return; }
    let last = 0, timer = null, alive = true;
    const body = el('div', 'chat');
    const list = el('div', 'chat-list'), form = el('form', 'chat-form');
    const input = field('f-chat', t('chat_ph'), 200);
    const send = html('button', 'btn primary', ic('send')); send.type = 'submit'; send.setAttribute('aria-label', t('chat'));
    form.append(input, send);
    const tabs = el('div', 'seg');
    const mk = (id, label) => {
      const b = el('button', id === channel ? 'on' : '', label); b.type = 'button';
      b.onclick = () => { if (channel === id) return; channel = id; last = 0; list.replaceChildren(); for (const c of tabs.children) c.classList.toggle('on', c === b); poll(); };
      tabs.append(b);
    };
    mk('global', `${t('chat_global')}${me ? ' · ' + t('server_n', me.server) : ''}`); mk('alliance', t('chat_ally'));
    body.append(tabs, list, form);

    function add(m) {
      const line = el('div', 'msg' + (m.me ? ' mine' : ''));
      const head = el('div', 'msg-head', m.tag ? `[${m.tag}] ${m.name}` : m.name);
      const time = new Date(m.ts);
      head.append(el('span', 'msg-time', `${String(time.getHours()).padStart(2, '0')}:${String(time.getMinutes()).padStart(2, '0')}`));
      line.append(head, el('div', 'msg-text', m.text));
      if (!m.me) {
        const rep = html('button', 'msg-report', ic('flag')); rep.setAttribute('aria-label', t('report'));
        rep.onclick = async () => { if (await call('chat.report', { channel, n: m.n })) { line.remove(); toast(t('reported')); } };
        line.append(rep);
      }
      list.append(line);
    }
    async function poll() {
      const ch = channel;
      const r = await call('chat.get', { channel: ch, after: last }, { quiet: true });
      if (!alive || ch !== channel) return;
      if (!r) { if (!list.children.length) list.append(el('p', 'hint center', ch === 'alliance' ? t('err_no_alliance') : t('err_offline'))); return; }
      if (!last) list.replaceChildren();
      const stick = list.scrollHeight - list.scrollTop - list.clientHeight < 60;
      for (const m of r.messages) { add(m); last = Math.max(last, m.n); }
      if (!list.children.length) list.append(el('p', 'hint center', t('chat_empty')));
      else if (r.messages.length) list.querySelector('p.hint')?.remove();
      if (stick) list.scrollTop = list.scrollHeight;
    }
    form.onsubmit = async (ev) => {
      ev.preventDefault();
      const text = input.value.trim();
      if (!text) return;
      const r = await call('chat.send', { channel, text });
      if (r) { input.value = ''; await poll(); list.scrollTop = list.scrollHeight; }
    };
    openModal({ title: t('chat'), body, cls: 'tall', buttons: [{ label: t('close'), kind: 'ghost' }], onClose: () => { alive = false; clearInterval(timer); } });
    poll().then(() => { list.scrollTop = list.scrollHeight; });
    timer = setInterval(poll, CHAT_POLL_MS);
  }

  if (o().token) { sync(true); call('league.get', {}, { quiet: true }).then((r) => { if (r) lg = r; }); }
  return { tabArena, tabAlliance, openChat, enter, heartbeat, sideInfo };
}
