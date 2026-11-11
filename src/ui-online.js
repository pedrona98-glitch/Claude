// Schermate online: arena PvP, alleanza, guerra e chat.
import * as G from './game.js';
import { LEAGUES, ALLIANCE_CREATE_GEMS, AIRCRAFT } from './data.js';
import { fmt, fmtTime } from './format.js';
import { t } from './i18n.js';
import { sfx } from './audio.js';
import { ic, withIcon } from './icons.js';
import { Online } from './online.js';
import { el, html, cost } from './ui.js';

const SYNC_EVERY_MS = 60e3;
const CHAT_POLL_MS = 4000;

export function createOnlineUI(kit) {
  const { S, now, toast, openModal, row, setBtn, heading } = kit;
  const o = () => S().online;
  let me = null, arena = null, ally = null, allyList = null;
  let busy = false, claiming = false, lastSync = 0;

  // ---------- comunicazione ----------
  function absorb(r) {
    if (!r) return r;
    if (r.user) me = r.user;
    if ('alliance' in r) o().allyLevel = r.alliance ? r.alliance.level : 0;
    if (r.user && r.user.pending > 0 && !claiming) {
      claiming = true;
      call('claim').then((c) => {
        claiming = false;
        if (c && c.reward.gems > 0) { S().gems += c.reward.gems; sfx.reward(); toast(t('pending_gems', c.reward.gems)); kit.app.save(); }
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
    const s = S();
    return call('sync', { dps: G.totalDps(s), hp: G.squadMaxHp(s), stage: s.stage, plane: s.aircraft.equipped }, { quiet: true });
  }
  /** Chiamato a ogni aggiornamento dell'interfaccia: tiene il profilo allineato sul server. */
  function heartbeat() {
    if (o().token && now() - lastSync > SYNC_EVERY_MS) sync();
  }

  function rerender(tab) { if (kit.currentTab() === tab) kit.render(); }
  async function load(tab) {
    if (busy || !o().token) return;
    busy = true;
    await sync(true);
    if (tab === 'arena') arena = await call('arena.list');
    else {
      const mine = await call('ally.get', {}, { quiet: true });
      ally = mine ? mine : null;
      allyList = ally ? null : (await call('ally.list'))?.alliances || [];
    }
    busy = false;
    rerender(tab);
  }
  function enter(tab) {
    if (tab === 'arena') { arena = null; } else if (tab === 'ally') { ally = null; allyList = null; }
  }

  // ---------- pezzi comuni ----------
  function demoTag() {
    return Online.demo ? html('div', 'demo-tag', withIcon('flask', t('demo_tag'))) : null;
  }
  function intro(text) {
    const card = el('div', 'card center');
    const btn = el('button', 'btn primary wide', t('enter'));
    btn.onclick = askName;
    card.append(html('div', 'card-icon', ic('swords')), el('p', 'sub', text), btn);
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
      buttons: [
        { label: t('cancel'), kind: 'ghost' },
        { label: t('enter'), onClick: async () => { if (!(await register(input.value))) return false; kit.render(); } },
      ],
    });
    setTimeout(() => input.focus(), 50);
  }
  const league = (rating) => [...LEAGUES].reverse().find((l) => rating >= l.min) || LEAGUES[0];
  const nameTag = (p) => (p.tag ? `[${p.tag}] ${p.name}` : p.name);
  function planeOf(p) {
    const a = AIRCRAFT.find((x) => x.id === p.plane) || AIRCRAFT[0];
    return kit.planeIcon(a.shape, a.color);
  }
  const loading = () => kit.panel.append(el('p', 'hint center', '···'));

  /** Finestra del duello: le barre scendono, poi compare l'esito. */
  function showFight(r, extraLine) {
    const body = el('div', 'duel');
    const bar = (label, left, cls) => {
      const w = el('div', 'duel-side'), track = el('div', 'meter ' + cls), fill = el('div', 'meter-fill');
      track.append(fill); w.append(el('div', 'duel-name', label), track);
      requestAnimationFrame(() => requestAnimationFrame(() => { fill.style.width = Math.round(left * 100) + '%'; }));
      return w;
    };
    const result = el('div', 'duel-result');
    body.append(bar(o().name, r.myLeft, 'good'), el('div', 'duel-vs', t('vs')), bar(nameTag(r.opponent), r.oppLeft, 'bad'), result);
    const m = openModal({ title: '···', icon: 'swords', body, buttons: [{ label: t('close'), kind: 'ghost' }] });
    sfx.rocket();
    setTimeout(() => {
      m.title.textContent = r.win ? t('victory') : t('defeat_pvp');
      m.box.classList.add(r.win ? 'won' : 'lost');
      for (const line of extraLine) result.append(html('div', 'duel-line', line));
      if (r.win) sfx.reward(); else sfx.fail();
    }, 1500);
  }

  // ---------- arena ----------
  function tabArena() {
    if (!o().token) return intro(t('arena_hint'));
    if (!arena || !me) { loading(); load('arena'); return; }
    const lg = league(me.rating);
    const card = el('div', 'card');
    const head = el('div', 'card-head');
    head.append(html('div', 'league lg-' + lg.id, ic('trophy')), (() => {
      const d = el('div', 'info');
      d.append(el('div', 'name', `${t('lg_' + lg.id)} · ${t('trophies', me.rating)}`), el('div', 'sub', `${o().name} · ${t('rank_n', arena.rank)} · ${t('server_n', me.server)}`));
      return d;
    })());
    const tick = el('div', 'sub');
    kit.addUpdater(() => {
      const left = me.nextTicketAt ? (me.nextTicketAt - now()) / 1000 : 0;
      tick.textContent = t('tickets', me.tickets, me.ticketsMax) + (me.tickets < me.ticketsMax && left > 0 ? ` · ${t('next_ticket', fmtTime(left))}` : '');
      if (me.nextTicketAt && left <= 0 && !busy) { me.nextTicketAt = 0; load('arena'); }
    });
    const actions = el('div', 'btn-row');
    const top = html('button', 'btn ghost', withIcon('trophy', t('leaderboard'))); top.onclick = showTop;
    const again = html('button', 'btn ghost', withIcon('refresh', t('new_opponents'))); again.onclick = () => { arena = null; kit.render(); };
    actions.append(top, again);
    card.append(head, tick, actions);
    if (me.tickets === 0 && me.refillsLeft > 0) {
      const refill = html('button', 'btn ad wide', kit.adHtml(t('refill')));
      refill.onclick = () => kit.rewarded(async () => { await call('arena.refill'); arena = null; kit.render(); });
      card.append(refill);
    }
    kit.panel.append(card);
    const tag = demoTag(); if (tag) kit.panel.append(tag);

    const myPower = G.power(S());
    for (const p of arena.opponents) {
      const x = row({ iconEl: planeOf(p), title: nameTag(p) });
      const stronger = p.power > myPower * 1.05, weaker = p.power < myPower * 0.95;
      x.sub.innerHTML = `${cost('trophy', p.rating)} · ${t('power')} <b class="${stronger ? 'neg' : weaker ? 'pos' : ''}">${fmt(p.power)}</b>${p.bot && !Online.demo ? ` · ${t('training_bot')}` : ''}`;
      setBtn(x, t('attack'), '', me.tickets > 0, 'danger');
      x.btn.onclick = async () => {
        x.btn.disabled = true;
        const r = await call('arena.fight', { id: p.id });
        if (!r) { arena = null; kit.render(); return; }
        const s = S(), coins = Math.ceil(G.incomePerSec(s, now()) * r.reward.coinSeconds);
        s.coins += coins; s.gems += r.reward.gems; kit.app.save();
        showFight(r, [
          `<b class="${r.delta >= 0 ? 'pos' : 'neg'}">${r.delta >= 0 ? '+' : ''}${r.delta}</b> ${ic('trophy')}`,
          `+${cost('coin', coins)}${r.reward.gems ? ` &nbsp; +${cost('gem', r.reward.gems)}` : ''}`,
        ]);
        arena = null; kit.render();
      };
      kit.panel.append(x.r);
    }
    kit.panel.append(el('p', 'hint', `${t('arena_hint')} ${t('power')}: ${fmt(myPower)}.`));
  }

  async function showTop() {
    const r = await call('arena.top');
    if (!r) return;
    const list = el('div', 'board');
    for (const p of r.top) {
      const line = el('div', 'board-row' + (p.me ? ' me' : ''));
      line.append(el('span', 'board-rank', String(p.rank)), el('span', 'board-name', nameTag(p)), html('span', 'board-score', cost('trophy', p.rating)));
      list.append(line);
    }
    openModal({ title: `${t('leaderboard')} · ${t('server_n', r.server)}`, body: list, cls: 'tall', buttons: [{ label: t('close'), kind: 'ghost' }] });
  }

  // ---------- alleanza ----------
  function tabAlliance() {
    if (!o().token) return intro(t('ally_none'));
    if (!ally && !allyList) { loading(); load('ally'); return; }
    if (!ally) return allianceBrowser();
    const a = ally.alliance, left = ally.left;

    const card = el('div', 'card');
    const head = el('div', 'card-head');
    const info = el('div', 'info');
    info.append(el('div', 'name', `[${a.tag}] ${a.name}`), el('div', 'sub', `${t('level_n', a.level)} · ${t('members_n', a.members.length, a.max)} · ${t('ally_bonus', Math.round(a.level * 2))}`));
    head.append(html('div', 'league', ic('shield')), info);
    const xp = el('div', 'meter gold'), xpFill = el('div', 'meter-fill'); xpFill.style.width = Math.min(100, (a.xp / a.xpNext) * 100) + '%'; xp.append(xpFill);
    card.append(head, xp);
    const actions = el('div', 'btn-row');
    const chat = html('button', 'btn ghost', withIcon('chat', t('chat'))); chat.onclick = () => openChat('alliance');
    actions.append(chat);
    card.append(actions);
    kit.panel.append(card);
    const tag = demoTag(); if (tag) kit.panel.append(tag);

    const act = async (action, payload, after) => {
      const r = await call(action, payload);
      if (r) { ally = r; after?.(r); kit.app.save(); }
      kit.render();
    };

    const donate = row({ icon: 'coin', title: t('donate') });
    donate.sub.textContent = `${t('donate_d')} · ${t('left_n', left.donations)}`;
    const price = () => Math.max(100, Math.ceil(G.incomePerSec(S(), now()) * 600));
    kit.addUpdater(() => setBtn(donate, `+${cost('gem', 2)}`, cost('coin', price()), left.donations > 0 && S().coins >= price()));
    donate.btn.onclick = () => {
      const c = price();
      if (S().coins < c) { toast(t('not_enough_coins')); return; }
      act('ally.donate', {}, (r) => { S().coins -= c; S().gems += r.reward.gems; sfx.reward(); });
    };

    const boss = row({ icon: 'skull', title: `${t('ally_boss')} · ${t('lvl')} ${a.boss.level}` });
    const bm = el('div', 'meter bad'), bf = el('div', 'meter-fill'); bf.style.width = (a.boss.hp / a.boss.maxHp) * 100 + '%'; bm.append(bf);
    boss.sub.textContent = `${fmt(a.boss.hp)} / ${fmt(a.boss.maxHp)} · ${t('left_n', left.boss)}`;
    boss.sub.after(bm);
    setBtn(boss, t('attack'), '', left.boss > 0, 'danger');
    boss.btn.onclick = () => act('ally.boss', {}, (r) => { sfx.boss(); toast(r.killed ? t('boss_down') : t('boss_hit', fmt(r.dmg))); });
    kit.panel.append(donate.r, boss.r, heading(t('war')));

    if (a.lastWar) kit.panel.append(el('p', 'hint', t(a.lastWar.won ? 'war_last_won' : 'war_last_lost', a.lastWar.mine, a.lastWar.theirs)));
    if (!a.war) kit.panel.append(el('p', 'hint', t('war_none')));
    else {
      const w = a.war, wc = el('div', 'card');
      const score = el('div', 'war-score');
      score.append(el('span', 'war-name', `[${a.tag}]`), el('b', w.mine >= w.theirs ? 'pos' : 'neg', t('war_score', w.mine, w.theirs)), el('span', 'war-name', `[${w.enemy.tag}]`));
      const ends = el('div', 'sub center');
      kit.addUpdater(() => { ends.textContent = `${t('war_vs', w.enemy.name)} · ${t('war_ends', fmtTime((w.endsAt - now()) / 1000))} · ${t('left_n', left.war)}`; });
      wc.append(score, ends, el('p', 'sub center', t('war_d')));
      kit.panel.append(wc);
      const myPower = G.power(S());
      for (const p of w.targets.slice(0, 6)) {
        const x = row({ iconEl: planeOf(p), title: p.name });
        x.sub.innerHTML = `${t('power')} <b class="${p.power > myPower * 1.05 ? 'neg' : p.power < myPower * 0.95 ? 'pos' : ''}">${fmt(p.power)}</b>`;
        setBtn(x, t('attack'), '', left.war > 0, 'danger');
        x.btn.onclick = async () => {
          x.btn.disabled = true;
          const r = await call('ally.war', { id: p.id });
          if (r) { ally = r; showFight(r, [`<b class="pos">${t('points_n', r.points)}</b>`]); }
          kit.render();
        };
        kit.panel.append(x.r);
      }
    }

    kit.panel.append(heading(t('members')));
    for (const p of a.members) {
      const x = row({ iconEl: planeOf(p), title: p.name + (p.me ? ` (${t('you')})` : ''), noBtn: true });
      x.sub.innerHTML = `${p.leader ? t('leader') + ' · ' : ''}${cost('trophy', p.rating)} · ${t('power')} ${fmt(p.power)}`;
      kit.panel.append(x.r);
    }
    const leave = el('button', 'btn ghost wide', t('leave'));
    leave.onclick = () => openModal({
      title: t('leave'), icon: 'alert', body: t('leave_confirm'),
      buttons: [{ label: t('cancel'), kind: 'ghost' }, { label: t('confirm'), kind: 'danger', onClick: async () => { await call('ally.leave'); ally = null; allyList = null; kit.render(); } }],
    });
    kit.panel.append(leave);
  }

  function allianceBrowser() {
    const card = el('div', 'card');
    const create = html('button', 'btn gem wide', `<span>${t('ally_create')}</span>${cost('gem', ALLIANCE_CREATE_GEMS)}`);
    create.onclick = createAlliance;
    card.append(el('p', 'sub', t('ally_none')), create);
    kit.panel.append(card);
    const tag = demoTag(); if (tag) kit.panel.append(tag);
    for (const a of allyList) {
      const x = row({ icon: 'shield', title: `[${a.tag}] ${a.name}` });
      x.sub.textContent = `${t('level_n', a.level)} · ${t('members_n', a.members, a.max)} · ${t('power')} ${fmt(a.power)}`;
      setBtn(x, t('join'), '', a.members < a.max);
      x.btn.onclick = async () => {
        const r = await call('ally.join', { id: a.id });
        if (r) { ally = r; sfx.reward(); kit.app.save(); }
        kit.render();
      };
      kit.panel.append(x.r);
    }
  }

  function createAlliance() {
    if (S().gems < ALLIANCE_CREATE_GEMS) { toast(t('not_enough_gems')); return; }
    const name = field('f-ally-name', t('ally_name'), 20), tag = field('f-ally-tag', t('ally_tag'), 4);
    const body = el('div', 'form'); body.append(name, tag);
    openModal({
      title: t('ally_create'), icon: 'shield', body,
      buttons: [
        { label: t('cancel'), kind: 'ghost' },
        {
          label: t('confirm'), onClick: async () => {
            const r = await call('ally.create', { name: name.value, tag: tag.value });
            if (!r) return false;
            S().gems -= ALLIANCE_CREATE_GEMS; ally = r; sfx.reward(); kit.app.save(); kit.render();
          },
        },
      ],
    });
  }

  // ---------- chat ----------
  function openChat(channel = 'global') {
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
      const head = el('div', 'msg-head', nameTag(m));
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
      const r = await call('chat.get', { channel: ch, after: last }, { quiet: ch === 'global' });
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
    openModal({
      title: t('chat'), body, cls: 'tall', buttons: [{ label: t('close'), kind: 'ghost' }],
      onClose: () => { alive = false; clearInterval(timer); },
    });
    poll().then(() => { list.scrollTop = list.scrollHeight; });
    timer = setInterval(poll, CHAT_POLL_MS);
  }

  if (o().token) sync(true);
  return { tabArena, tabAlliance, openChat, enter, heartbeat };
}
