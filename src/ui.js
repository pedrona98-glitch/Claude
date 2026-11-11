// Interfaccia DOM: HUD, schede, finestre modali, negozio.
import * as G from './game.js';
import {
  UPGRADES, PILOTS, AIRCRAFT, TALENTS, MISSIONS, PRODUCTS, DAILY_GEMS, KILLS_PER_STAGE,
  PRESTIGE_MIN_STAGE, AD_GEMS, AD_GEMS_COOLDOWN, AD_BOOST_SECONDS, WARP_GEMS, WARP_SECONDS,
} from './data.js';
import { fmt, fmtTime } from './format.js';
import { t, setLang, getLang } from './i18n.js';
import { sfx, setSound } from './audio.js';
import { drawPlane } from './render.js';
import { Monet } from './monetization.js';
import { ic, withIcon } from './icons.js';
import { createOnlineUI } from './ui-online.js';

const $ = (sel) => document.querySelector(sel);
export function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}
export function html(tag, cls, markup) {
  const e = el(tag, cls);
  e.innerHTML = markup; // solo markup costruito dal gioco (icone), mai testo dei giocatori
  return e;
}
export const cost = (icon, n) => `${ic(icon)}<span>${typeof n === 'number' ? fmt(n) : n}</span>`;

export function createUI(app) {
  const S = () => app.state;
  const now = () => Date.now();
  let tab = 'plane', planeView = 'up', updaters = [], modalCount = 0;
  const panel = $('#panel');

  // ---------- elementi base ----------
  function toast(msg) {
    const box = $('#toasts'), e = el('div', 'toast', msg);
    box.append(e);
    while (box.children.length > 3) box.firstChild.remove();
    setTimeout(() => e.remove(), 2400);
  }

  function openModal({ title, body, buttons = [], icon, cls = '', onClose }) {
    const root = $('#modal-root'), wrap = el('div', 'modal-wrap'), box = el('div', 'modal ' + cls);
    box.setAttribute('role', 'dialog'); box.setAttribute('aria-modal', 'true');
    if (icon) box.append(html('div', 'modal-icon', ic(icon)));
    const h = el('h2', '', title); box.append(h);
    if (typeof body === 'string') box.append(el('p', '', body)); else if (body) box.append(body);
    const close = () => { if (wrap.isConnected) { wrap.remove(); modalCount--; onClose?.(); } };
    const bar = el('div', 'modal-btns');
    for (const b of buttons) {
      const btn = html('button', 'btn ' + (b.kind || 'primary'), withIcon(b.icon, b.label));
      btn.onclick = async () => {
        if (btn.disabled) return;
        btn.disabled = true;
        const keep = b.onClick ? await b.onClick() : undefined;
        btn.disabled = false;
        if (keep !== false) close();
      };
      bar.append(btn);
    }
    box.append(bar); wrap.append(box); root.append(wrap); modalCount++;
    wrap._close = close;
    return { close, title: h, box };
  }
  function closeTopModal() {
    const last = $('#modal-root').lastElementChild;
    if (last && last._close && !last.classList.contains('locked')) { last._close(); return true; }
    return false;
  }

  /** Esegue un'azione premiata da video. Con "Niente pubblicità" il premio è immediato. */
  async function rewarded(grant) {
    if (!S().perks.noAds) {
      const ok = await Monet.showRewarded();
      if (!ok) { toast(t('ad_fail')); return false; }
    }
    await grant(); sfx.reward(); app.save(); refresh();
    return true;
  }
  const adIcon = () => (S().perks.noAds ? '' : 'play');
  const adHtml = (text) => withIcon(adIcon(), text);

  // Finestre usate quando non c'è uno store vero (anteprima web).
  Monet.setMockUI({
    ad: () => new Promise((resolve) => {
      const wrap = el('div', 'modal-wrap locked ad-mock'), box = el('div', 'ad-box');
      const count = el('div', 'ad-count', '3');
      box.append(el('div', 'ad-tag', t('demo_ad')), html('div', 'ad-plane', ic('plane')), count);
      wrap.append(box); $('#modal-root').append(wrap); modalCount++;
      let n = 3;
      const iv = setInterval(() => {
        n--; count.textContent = String(n);
        if (n <= 0) { clearInterval(iv); wrap.remove(); modalCount--; resolve(true); }
      }, 700);
    }),
    confirm: (id) => new Promise((resolve) => {
      let done = false;
      const finish = (v) => { if (!done) { done = true; resolve(v); } };
      openModal({
        title: t('demo_buy'), icon: 'flask', body: t('demo_buy_d', t('pr_' + id)), onClose: () => finish(false),
        buttons: [
          { label: t('cancel'), kind: 'ghost', onClick: () => finish(false) },
          { label: t('confirm'), onClick: () => finish(true) },
        ],
      });
    }),
  });

  // ---------- righe delle liste ----------
  function row({ icon, iconEl, title, noBtn }) {
    const r = el('div', 'row'), ico = el('div', 'ico'), info = el('div', 'info');
    if (iconEl) ico.append(iconEl); else ico.innerHTML = ic(icon);
    const name = el('div', 'name', title), sub = el('div', 'sub');
    const btn = el('button', 'btn buy'), b1 = el('span', 'b1'), b2 = el('span', 'b2');
    btn.append(b1, b2); info.append(name, sub); r.append(ico, info);
    if (!noBtn) r.append(btn);
    return { r, name, sub, btn, b1, b2 };
  }
  /** l1/l2 sono markup del gioco (testo semplice o icona + numero). */
  function setBtn(x, l1, l2, enabled, cls = '') {
    if (x._l1 !== l1) { x._l1 = l1; x.b1.innerHTML = l1; }
    if (x._l2 !== (l2 || '')) { x._l2 = l2 || ''; x.b2.innerHTML = l2 || ''; }
    x.b2.hidden = !l2;
    x.btn.disabled = !enabled;
    x.btn.className = 'btn buy ' + cls;
  }
  const heading = (text) => el('h3', 'heading', text);
  function seg(options, get, set) {
    const bar = el('div', 'seg');
    for (const [value, label] of options) {
      const b = el('button', '', label);
      b.onclick = () => { set(value); sfx.buy(); };
      updaters.push(() => b.classList.toggle('on', get() === value));
      bar.append(b);
    }
    return bar;
  }
  const buyModeBar = () => seg([[1, '×1'], [10, '×10'], ['max', t('max')]], () => S().buyMode, (m) => { S().buyMode = m; refresh(); });
  function planeIcon(shape, color) {
    const cv = el('canvas'); cv.width = 104; cv.height = 104;
    drawPlane(cv.getContext('2d'), shape, color, 50, 54, 86, 0.02, 1);
    return cv;
  }

  // ---------- schede ----------
  const upgradeValue = {
    cannon: (s) => fmt(G.shotDamage(s)),
    armor: (s) => fmt(G.squadMaxHp(s)),
    rate: (s) => G.fireRate(s).toFixed(2),
    crit: (s) => Math.round(G.critChance(s) * 100),
    critDmg: (s) => G.critMult(s).toFixed(1),
    cargo: (s) => Math.round(s.up.cargo * 5),
  };

  function tabPlane() {
    const top = el('div', 'bar');
    top.append(seg([['up', t('upgrades')], ['hangar', t('hangar')]], () => planeView, (v) => { planeView = v; render(); }));
    if (planeView === 'up') top.append(buyModeBar());
    panel.append(top);
    if (planeView === 'hangar') return hangar();
    for (const u of UPGRADES) {
      const x = row({ icon: u.icon, title: '' });
      x.btn.onclick = () => { if (G.buy(S(), 'up', u.id)) { sfx.buy(); refresh(); } };
      updaters.push(() => {
        const s = S(), q = G.quote(s, 'up', u.id);
        x.name.textContent = `${t('up_' + u.id)} · ${t('lvl')} ${s.up[u.id]}`;
        x.sub.textContent = t(`up_${u.id}_d`, upgradeValue[u.id](s));
        if (q.maxed) setBtn(x, t('max'), '', false, 'done');
        else setBtn(x, `+${q.n} ${t('lvl')}`, cost('coin', q.cost), s.coins >= q.cost);
      });
      panel.append(x.r);
    }
  }

  function hangar() {
    panel.append(el('p', 'hint', t('hangar_hint')));
    for (const a of AIRCRAFT) {
      const x = row({ iconEl: planeIcon(a.shape, a.color), title: t('a_' + a.id) });
      x.sub.textContent = t('aircraft_d', a.mult);
      x.btn.onclick = () => {
        const s = S();
        if (s.aircraft.owned.includes(a.id)) G.equipAircraft(s, a.id);
        else if (!G.buyAircraft(s, a.id)) { toast(t('not_enough_gems')); return; }
        sfx.reward(); app.save(); refresh();
      };
      updaters.push(() => {
        const s = S(), owned = s.aircraft.owned.includes(a.id);
        if (s.aircraft.equipped === a.id) setBtn(x, t('equipped'), '', false, 'done');
        else if (owned) setBtn(x, t('equip'), '', true, 'ghost');
        else setBtn(x, t('buy'), cost('gem', a.gems), s.gems >= a.gems, 'gem');
      });
      panel.append(x.r);
    }
  }

  function tabSquad() {
    const top = el('div', 'bar'); top.append(el('span', 'hint', ''), buyModeBar()); panel.append(top);
    PILOTS.forEach((p, i) => {
      const x = row({ iconEl: planeIcon('mono', p.color), title: '' });
      x.btn.onclick = () => { if (G.buy(S(), 'pilot', p.id)) { sfx.buy(); refresh(); } };
      updaters.push(() => {
        const s = S(), lvl = s.pilots[p.id] || 0, q = G.quote(s, 'pilot', p.id);
        const visible = i === 0 || lvl > 0 || (s.pilots[PILOTS[i - 1].id] || 0) > 0;
        x.r.classList.toggle('locked', !visible);
        x.name.textContent = visible ? `${t('p_' + p.id)}${lvl ? ` · ${t('lvl')} ${lvl}` : ''}` : '———';
        x.sub.textContent = !visible ? t('locked')
          : lvl ? t('pilot_d', fmt(G.pilotDps(s, p.id))) : t('pilot_new', fmt(p.baseDps * G.globalMult(s)));
        setBtn(x, lvl ? `+${q.n} ${t('lvl')}` : t('hire'), cost('coin', q.cost), visible && s.coins >= q.cost);
      });
      panel.append(x.r);
    });
  }

  function tabCommand() {
    const card = el('div', 'card'), bonus = el('div', 'sub');
    const btn = el('button', 'btn primary wide');
    card.append(html('div', 'name', withIcon('medal', t('prestige'))), el('p', 'sub', t('prestige_d')), bonus, btn);
    btn.onclick = () => {
      const gain = G.medalsOnPrestige(S());
      if (!gain) return;
      openModal({
        title: t('prestige'), icon: 'medal', body: t('prestige_confirm'),
        buttons: [
          { label: t('cancel'), kind: 'ghost' },
          { label: t('prestige_btn', gain), onClick: () => { G.prestige(S()); sfx.boss(); app.save(); render(); } },
        ],
      });
    };
    updaters.push(() => {
      const s = S(), gain = G.medalsOnPrestige(s);
      bonus.textContent = t('prestige_bonus', Math.round((G.medalBonus(s) - 1) * 100));
      btn.textContent = gain ? t('prestige_btn', gain) : t('prestige_req', PRESTIGE_MIN_STAGE);
      btn.disabled = !gain;
    });
    panel.append(card, heading(t('talents')));

    for (const tl of TALENTS) {
      const x = row({ icon: tl.icon, title: '' });
      x.sub.textContent = t(`t_${tl.id}_d`);
      x.btn.onclick = () => { if (G.buyTalent(S(), tl.id)) { sfx.reward(); app.save(); refresh(); } };
      updaters.push(() => {
        const s = S(), lvl = s.talents[tl.id] || 0;
        x.name.textContent = `${t('t_' + tl.id)} · ${lvl}/${tl.max}`;
        if (lvl >= tl.max) setBtn(x, t('max'), '', false, 'done');
        else setBtn(x, `+1 ${t('lvl')}`, cost('medal', G.talentCost(s, tl.id)), s.medals >= G.talentCost(s, tl.id), 'medal');
      });
      panel.append(x.r);
    }

    panel.append(heading(t('missions')));
    for (const m of MISSIONS) {
      const x = row({ icon: 'target', title: t('m_' + m.stat, fmt(m.goal)) });
      x.btn.onclick = () => { if (G.claimMission(S(), m.id)) { sfx.reward(); app.save(); refresh(); } };
      updaters.push(() => {
        const s = S(), have = Math.min(s.stats[m.stat] || 0, m.goal);
        x.sub.textContent = `${fmt(have)} / ${fmt(m.goal)}`;
        if (s.missions[m.id]) setBtn(x, ic('check'), '', false, 'done');
        else setBtn(x, t('claim'), cost('gem', m.gems), G.missionDone(s, m), 'gem');
      });
      panel.append(x.r);
    }
  }

  function tabShop() {
    panel.append(heading(t('shop_free')));

    const daily = row({ icon: 'calendar', title: t('daily') });
    daily.btn.onclick = () => { if (G.claimDaily(S(), now())) { sfx.reward(); app.save(); refresh(); } };
    updaters.push(() => {
      const s = S(), avail = G.dailyAvailable(s, now());
      daily.sub.textContent = t('daily_d', (s.daily.day % DAILY_GEMS.length) + 1, DAILY_GEMS[s.daily.day % DAILY_GEMS.length]);
      setBtn(daily, avail ? t('claim') : t('come_back'), '', avail, avail ? 'gem' : 'done');
    });

    const adGems = row({ icon: 'gem', title: t('ad_gems', AD_GEMS) });
    adGems.sub.textContent = t('ad_gems_d');
    adGems.btn.onclick = () => rewarded(() => { S().gems += AD_GEMS; S().adGemsAt = now() + AD_GEMS_COOLDOWN * 1000; });
    updaters.push(() => {
      const left = (S().adGemsAt - now()) / 1000;
      if (left > 0) setBtn(adGems, t('ready_in', fmtTime(left)), '', false, 'done');
      else setBtn(adGems, adHtml(t('watch')), '', true, 'ad');
    });

    const boost = row({ icon: 'flame', title: t('ad_boost') });
    boost.btn.onclick = () => rewarded(() => G.addBoost(S(), AD_BOOST_SECONDS, now()));
    updaters.push(() => {
      const left = (S().boostUntil - now()) / 1000;
      boost.sub.textContent = left > 0 ? `${t('boost_on')} · ${fmtTime(left)}` : t('ad_boost_d');
      setBtn(boost, adHtml(t('watch')), '', true, 'ad');
    });

    const warp = row({ icon: 'warp', title: t('warp') });
    warp.btn.onclick = () => {
      const s = S();
      if (s.gems < WARP_GEMS) { toast(t('not_enough_gems')); return; }
      s.gems -= WARP_GEMS; s.coins += Math.floor(G.incomePerSec(s, now()) * WARP_SECONDS);
      sfx.reward(); app.save(); refresh();
    };
    updaters.push(() => {
      const s = S();
      warp.sub.textContent = `${t('warp_d')} (+${fmt(G.incomePerSec(s, now()) * WARP_SECONDS)})`;
      setBtn(warp, t('buy'), cost('gem', WARP_GEMS), s.gems >= WARP_GEMS, 'gem');
    });
    panel.append(daily.r, adGems.r, boost.r, warp.r, heading(t('shop_iap')));

    for (const p of PRODUCTS) {
      const x = row({ icon: p.icon, title: t('pr_' + p.id) });
      x.sub.textContent = p.id.startsWith('gems_') ? t('pr_gems_d', p.gems) : t(`pr_${p.id}_d`);
      x.btn.onclick = () => purchase(p);
      updaters.push(() => {
        if (p.once && S().purchased[p.id]) setBtn(x, t('owned'), '', false, 'done');
        else setBtn(x, Monet.price(p.id), '', true, 'cash');
      });
      panel.append(x.r);
    }
    if (Monet.native) {
      const r = el('button', 'btn ghost wide', t('restore'));
      r.onclick = async () => {
        const ids = await Monet.restore();
        for (const id of ids) G.grantProduct(S(), PRODUCTS.find((p) => p.id === id), now());
        app.save(); refresh(); toast(t('restored', ids.length));
      };
      panel.append(r);
    }
  }

  async function purchase(p) {
    if (!Monet.storeAvailable()) { toast(t('store_off')); return; }
    if (!(await Monet.purchase(p.id))) return;
    G.grantProduct(S(), p, now());
    sfx.reward(); app.save(); refresh(); toast(t('purchase_ok'));
  }

  const kit = {
    app, S, now, panel, toast, openModal, closeTopModal, rewarded, adHtml, adIcon, row, setBtn, heading, seg, planeIcon,
    addUpdater: (fn) => updaters.push(fn), refresh: () => refresh(), render: () => render(), currentTab: () => tab,
  };
  const online = createOnlineUI(kit);

  const TABS = [
    ['plane', 'plane', tabPlane], ['squad', 'squad', tabSquad], ['arena', 'swords', () => online.tabArena()],
    ['ally', 'shield', () => online.tabAlliance()], ['cmd', 'star', tabCommand], ['shop', 'shop', tabShop],
  ];

  function render() {
    const keep = panel.scrollTop;
    updaters = []; panel.replaceChildren();
    TABS.find((x) => x[0] === tab)[2]();
    panel.scrollTop = render._tab === tab ? keep : 0;
    render._tab = tab;
    const nav = $('#tabs'); nav.replaceChildren();
    for (const [id, icon] of TABS) {
      const b = el('button', id === tab ? 'on' : '');
      b.append(html('span', 'tab-ico', ic(icon)), el('span', 'tab-lbl', t('tab_' + id)), el('i', 'badge'));
      b.onclick = () => { tab = id; online.enter(id); render(); };
      b.dataset.tab = id;
      nav.append(b);
    }
    $('#tap-hint').textContent = t('tap_hint');
    refresh();
  }

  // ---------- aggiornamento periodico ----------
  function refresh() {
    const s = S(), n = now();
    $('#coins').textContent = fmt(s.coins);
    $('#gems').textContent = fmt(s.gems);
    $('#medals').textContent = fmt(s.medals);
    const e = s.enemy, boss = e?.boss;
    $('#stage-name').textContent = boss ? `${t('boss')} · ${t('stage')} ${s.stage}` : `${t('stage')} ${s.stage}`;
    $('#stage-info').textContent = boss ? s.bossTimer.toFixed(1) + 's'
      : s.farming ? t('farming') : `${s.kills}/${KILLS_PER_STAGE}`;
    $('#stagebar').classList.toggle('boss', !!boss);
    $('#hp-fill').style.width = (e ? Math.max(0, e.hp / e.maxHp) * 100 : 0) + '%';
    $('#hp-text').textContent = e ? `${fmt(Math.max(0, e.hp))} / ${fmt(e.maxHp)}` : '';
    const maxHp = G.squadMaxHp(s), hp = Math.max(0, Math.min(s.hp || maxHp, maxHp));
    $('#sq-fill').style.width = (hp / maxHp) * 100 + '%';
    $('#squad-hp').classList.toggle('low', hp / maxHp < 0.3);
    $('#sq-text').textContent = `${fmt(hp)} / ${fmt(maxHp)}`;
    $('#dps').textContent = `${t('dps')} ${fmt(G.totalDps(s))}`;
    const bb = $('#btn-boss');
    bb.hidden = !s.farming;
    const label = G.isBoss(s.stage + 1) ? withIcon('skull', t('challenge')) : withIcon('takeoff', t('advance'));
    if (bb._l !== label) { bb._l = label; bb.innerHTML = label; }
    const boostLeft = (s.boostUntil - n) / 1000;
    $('#boost-chip').hidden = boostLeft <= 0;
    if (boostLeft > 0) $('#boost-text').textContent = `${t('boost_on')} · ${fmtTime(boostLeft)}`;
    $('#tap-hint').hidden = s.stats.taps >= 3;
    const badge = {
      cmd: G.claimableMissions(s) > 0 || (G.medalsOnPrestige(s) > 0 && s.stats.prestiges === 0),
      shop: G.dailyAvailable(s, n) || s.adGemsAt <= n,
    };
    for (const b of $('#tabs').children) b.classList.toggle('has-badge', !!badge[b.dataset.tab]);
    for (const u of updaters) u();
    online.heartbeat();
  }

  // ---------- finestre di gioco ----------
  function coinBody(desc, coins) {
    const body = el('div');
    body.append(el('p', '', desc), html('div', 'big-coins', cost('coin', coins)));
    return body;
  }

  function showOffline(secs, coins) {
    const s = S();
    s.coins += coins; app.save();
    openModal({
      title: t('offline'), icon: 'moon', body: coinBody(t('offline_d', fmtTime(secs)), coins),
      buttons: [
        { label: t('collect'), kind: 'ghost' },
        { label: t('double_it'), icon: adIcon(), kind: 'ad', onClick: () => rewarded(() => { S().coins += coins; }).then(() => true) },
      ],
    });
  }

  function showDrop() {
    if (modalCount || $('#drop')) return;
    const d = html('button', '', ic('crate')); d.id = 'drop'; d.setAttribute('aria-label', t('drop'));
    d.style.top = 26 + Math.random() * 26 + '%';
    d.onanimationend = (ev) => { if (ev.animationName === 'fly') d.remove(); };
    d.onclick = (ev) => {
      ev.stopPropagation(); d.remove();
      const s = S(), small = G.dropReward(s, now(), false), big = G.dropReward(s, now(), true);
      sfx.reward();
      openModal({
        title: t('drop'), icon: 'crate', body: coinBody(t('drop_d'), big),
        buttons: [
          { label: t('drop_take', fmt(small)), kind: 'ghost', onClick: () => { S().coins += small; refresh(); } },
          {
            label: t('drop_ad', fmt(big)), icon: adIcon(), kind: 'ad',
            onClick: async () => { if (!(await rewarded(() => { S().coins += big; }))) S().coins += small; },
          },
        ],
      });
    };
    $('#battle').append(d);
  }

  function showSettings() {
    const s = S(), body = el('div', 'settings');
    const line = (label, value, onClick) => {
      const r = el('div', 'set-row'), b = el('button', 'btn ghost', value);
      b.onclick = () => onClick(b);
      r.append(el('span', '', label), b); body.append(r);
    };
    line(t('sound'), s.settings.sound ? t('on') : t('off'), (b) => {
      s.settings.sound = !s.settings.sound; setSound(s.settings.sound);
      b.textContent = s.settings.sound ? t('on') : t('off'); app.save();
    });
    line(t('language'), getLang() === 'it' ? 'Italiano' : 'English', () => {
      s.settings.lang = getLang() === 'it' ? 'en' : 'it'; setLang(s.settings.lang);
      app.save(); closeTopModal(); render(); showSettings();
    });
    if (Monet.native) line(t('privacy'), '›', () => Monet.showPrivacyOptions());
    line(t('reset'), '×', () => openModal({
      title: t('reset'), icon: 'alert', body: t('reset_confirm'),
      buttons: [{ label: t('cancel'), kind: 'ghost' }, { label: t('confirm'), kind: 'danger', onClick: () => app.reset() }],
    }));
    openModal({ title: t('settings'), body, buttons: [{ label: t('close'), kind: 'ghost' }] });
  }

  function banner(msg, cls = '') {
    const b = $('#banner');
    b.textContent = msg; b.className = 'show ' + cls;
    clearTimeout(banner._t); banner._t = setTimeout(() => { b.className = ''; }, 1600);
  }

  // icone statiche della pagina
  for (const n of document.querySelectorAll('[data-ic]')) n.innerHTML = ic(n.dataset.ic);
  $('#btn-settings').onclick = showSettings;
  $('#btn-chat').onclick = () => online.openChat();
  $('#btn-boss').onclick = (ev) => { ev.stopPropagation(); if (G.challengeBoss(S())) { sfx.boss(); refresh(); } };
  $('#boost-chip').onclick = (ev) => { ev.stopPropagation(); tab = 'shop'; render(); };

  return { render, refresh, toast, banner, showOffline, showDrop, closeTopModal, hasModal: () => modalCount > 0 };
}
