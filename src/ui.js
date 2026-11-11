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

const $ = (sel) => document.querySelector(sel);
function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}

export function createUI(app) {
  const S = () => app.state;
  const now = () => Date.now();
  let tab = 'plane', updaters = [], modalCount = 0;
  const panel = $('#panel');

  // ---------- elementi base ----------
  function toast(msg) {
    const box = $('#toasts'), e = el('div', 'toast', msg);
    box.append(e);
    while (box.children.length > 3) box.firstChild.remove();
    setTimeout(() => e.remove(), 2400);
  }

  function openModal({ title, body, buttons = [], icon }) {
    const root = $('#modal-root'), wrap = el('div', 'modal-wrap'), box = el('div', 'modal');
    box.setAttribute('role', 'dialog'); box.setAttribute('aria-modal', 'true');
    if (icon) box.append(el('div', 'modal-icon', icon));
    box.append(el('h2', '', title));
    if (typeof body === 'string') box.append(el('p', '', body)); else if (body) box.append(body);
    const close = () => { if (wrap.isConnected) { wrap.remove(); modalCount--; } };
    const bar = el('div', 'modal-btns');
    for (const b of buttons) {
      const btn = el('button', 'btn ' + (b.kind || 'primary'), b.label);
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
    return close;
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
    grant(); sfx.reward(); app.save(); refresh();
    return true;
  }
  const adLabel = (key, ...a) => (S().perks.noAds ? t(key, ...a).replace('🎬 ', '') : t(key, ...a));

  // Finestre usate quando non c'è uno store vero (anteprima web).
  Monet.setMockUI({
    ad: () => new Promise((resolve) => {
      const wrap = el('div', 'modal-wrap locked ad-mock'), box = el('div', 'ad-box');
      const count = el('div', 'ad-count', '3');
      box.append(el('div', 'ad-tag', t('demo_ad')), el('div', 'ad-plane', '✈️'), count);
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
        title: t('demo_buy'), icon: '🧪', body: t('demo_buy_d', t('pr_' + id)),
        buttons: [
          { label: t('cancel'), kind: 'ghost', onClick: () => finish(false) },
          { label: t('confirm'), onClick: () => finish(true) },
        ],
      });
    }),
  });

  // ---------- righe delle liste ----------
  function row({ icon, iconEl, title }) {
    const r = el('div', 'row'), ico = el('div', 'ico'), info = el('div', 'info');
    if (iconEl) ico.append(iconEl); else ico.textContent = icon;
    const name = el('div', 'name', title), sub = el('div', 'sub');
    const btn = el('button', 'btn buy'), b1 = el('span', 'b1'), b2 = el('span', 'b2');
    btn.append(b1, b2); info.append(name, sub); r.append(ico, info, btn);
    return { r, name, sub, btn, b1, b2 };
  }
  function setBtn(x, l1, l2, enabled, cls = '') {
    if (x.b1.textContent !== l1) x.b1.textContent = l1;
    if (x.b2.textContent !== (l2 || '')) x.b2.textContent = l2 || '';
    x.b2.hidden = !l2;
    x.btn.disabled = !enabled;
    x.btn.className = 'btn buy ' + cls;
  }
  function heading(text) { return el('h3', 'heading', text); }

  function buyModeBar() {
    const bar = el('div', 'seg');
    for (const m of [1, 10, 'max']) {
      const b = el('button', '', m === 'max' ? t('max') : '×' + m);
      b.onclick = () => { S().buyMode = m; refresh(); sfx.buy(); };
      updaters.push(() => b.classList.toggle('on', S().buyMode === m));
      bar.append(b);
    }
    return bar;
  }

  // ---------- schede ----------
  const upgradeValue = {
    cannon: (s) => fmt(G.shotDamage(s)),
    rate: (s) => G.fireRate(s).toFixed(2),
    crit: (s) => Math.round(G.critChance(s) * 100),
    critDmg: (s) => G.critMult(s).toFixed(1),
    cargo: (s) => Math.round(s.up.cargo * 5),
  };

  function tabPlane() {
    panel.append(buyModeBar());
    for (const u of UPGRADES) {
      const x = row({ icon: u.icon, title: '' });
      x.btn.onclick = () => { if (G.buy(S(), 'up', u.id)) { sfx.buy(); refresh(); } };
      updaters.push(() => {
        const s = S(), q = G.quote(s, 'up', u.id);
        x.name.textContent = `${t('up_' + u.id)} · ${t('lvl')} ${s.up[u.id]}`;
        x.sub.textContent = t(`up_${u.id}_d`, upgradeValue[u.id](s));
        if (q.maxed) setBtn(x, t('max'), '', false, 'done');
        else setBtn(x, `+${q.n} ${t('lvl')}`, '🪙 ' + fmt(q.cost), s.coins >= q.cost);
      });
      panel.append(x.r);
    }
  }

  function tabSquad() {
    panel.append(buyModeBar());
    PILOTS.forEach((p, i) => {
      const cv = planeIcon('mono', p.color);
      const x = row({ iconEl: cv, title: '' });
      x.btn.onclick = () => { if (G.buy(S(), 'pilot', p.id)) { sfx.buy(); refresh(); } };
      updaters.push(() => {
        const s = S(), lvl = s.pilots[p.id] || 0, q = G.quote(s, 'pilot', p.id);
        const visible = i === 0 || lvl > 0 || (s.pilots[PILOTS[i - 1].id] || 0) > 0;
        x.r.classList.toggle('locked', !visible);
        x.name.textContent = visible ? `${t('p_' + p.id)}${lvl ? ` · ${t('lvl')} ${lvl}` : ''}` : '???';
        x.sub.textContent = !visible ? t('locked')
          : lvl ? t('pilot_d', fmt(G.pilotDps(s, p.id))) : t('pilot_new', fmt(p.baseDps * G.globalMult(s)));
        setBtn(x, lvl ? `+${q.n} ${t('lvl')}` : t('hire'), '🪙 ' + fmt(q.cost), visible && s.coins >= q.cost);
      });
      panel.append(x.r);
    });
  }

  function planeIcon(shape, color) {
    const cv = el('canvas'); cv.width = 96; cv.height = 96;
    drawPlane(cv.getContext('2d'), shape, color, 46, 50, 80, 0.02, 1);
    return cv;
  }

  function tabHangar() {
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
        else if (owned) setBtn(x, t('equip'), '', true);
        else setBtn(x, t('buy'), '💎 ' + a.gems, s.gems >= a.gems, 'gem');
      });
      panel.append(x.r);
    }
  }

  function tabCommand() {
    const card = el('div', 'card'), bonus = el('div', 'sub');
    const btn = el('button', 'btn primary wide');
    card.append(el('div', 'name', '🎖️ ' + t('prestige')), el('p', 'sub', t('prestige_d')), bonus, btn);
    btn.onclick = () => {
      const gain = G.medalsOnPrestige(S());
      if (!gain) return;
      openModal({
        title: t('prestige'), icon: '🎖️', body: t('prestige_confirm'),
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
        else setBtn(x, `+1 ${t('lvl')}`, '🎖️ ' + G.talentCost(s, tl.id), s.medals >= G.talentCost(s, tl.id), 'medal');
      });
      panel.append(x.r);
    }

    panel.append(heading(t('missions')));
    for (const m of MISSIONS) {
      const x = row({ icon: '🎯', title: t('m_' + m.stat, fmt(m.goal)) });
      x.btn.onclick = () => { if (G.claimMission(S(), m.id)) { sfx.reward(); app.save(); refresh(); } };
      updaters.push(() => {
        const s = S(), have = Math.min(s.stats[m.stat] || 0, m.goal);
        x.sub.textContent = `${fmt(have)} / ${fmt(m.goal)}`;
        if (s.missions[m.id]) setBtn(x, t('claimed'), '', false, 'done');
        else setBtn(x, t('claim'), '💎 ' + m.gems, G.missionDone(s, m), 'gem');
      });
      panel.append(x.r);
    }
  }

  function tabShop() {
    panel.append(heading(t('shop_free')));

    const daily = row({ icon: '📅', title: t('daily') });
    daily.btn.onclick = () => { if (G.claimDaily(S(), now())) { sfx.reward(); app.save(); refresh(); } };
    updaters.push(() => {
      const s = S(), avail = G.dailyAvailable(s, now());
      daily.sub.textContent = t('daily_d', (s.daily.day % DAILY_GEMS.length) + 1, DAILY_GEMS[s.daily.day % DAILY_GEMS.length]);
      setBtn(daily, avail ? t('claim') : t('come_back'), '', avail, avail ? 'gem' : 'done');
    });

    const adGems = row({ icon: '💎', title: t('ad_gems', AD_GEMS) });
    adGems.sub.textContent = t('ad_gems_d');
    adGems.btn.onclick = () => rewarded(() => { S().gems += AD_GEMS; S().adGemsAt = now() + AD_GEMS_COOLDOWN * 1000; });
    updaters.push(() => {
      const left = (S().adGemsAt - now()) / 1000;
      if (left > 0) setBtn(adGems, t('ready_in', fmtTime(left)), '', false, 'done');
      else setBtn(adGems, adLabel('watch'), '', true, 'ad');
    });

    const boost = row({ icon: '🔥', title: t('ad_boost') });
    boost.btn.onclick = () => rewarded(() => G.addBoost(S(), AD_BOOST_SECONDS, now()));
    updaters.push(() => {
      const left = (S().boostUntil - now()) / 1000;
      boost.sub.textContent = left > 0 ? `${t('boost_on')} · ${fmtTime(left)}` : t('ad_boost_d');
      setBtn(boost, adLabel('watch'), '', true, 'ad');
    });

    const warp = row({ icon: '⏩', title: t('warp') });
    warp.btn.onclick = () => {
      const s = S();
      if (s.gems < WARP_GEMS) { toast(t('not_enough_gems')); return; }
      s.gems -= WARP_GEMS; s.coins += Math.floor(G.incomePerSec(s, now()) * WARP_SECONDS);
      sfx.reward(); app.save(); refresh();
    };
    updaters.push(() => {
      const s = S();
      warp.sub.textContent = `${t('warp_d')} (+${fmt(G.incomePerSec(s, now()) * WARP_SECONDS)} 🪙)`;
      setBtn(warp, t('buy'), '💎 ' + WARP_GEMS, s.gems >= WARP_GEMS, 'gem');
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

  const TABS = [
    ['plane', '✈️', tabPlane], ['squad', '👨‍✈️', tabSquad], ['hangar', '🛩️', tabHangar],
    ['cmd', '🎖️', tabCommand], ['shop', '💎', tabShop],
  ];

  function render() {
    updaters = []; panel.replaceChildren();
    TABS.find((x) => x[0] === tab)[2]();
    panel.scrollTop = 0;
    const nav = $('#tabs'); nav.replaceChildren();
    for (const [id, icon] of TABS) {
      const b = el('button', id === tab ? 'on' : '');
      b.append(el('span', 'tab-ico', icon), el('span', 'tab-lbl', t('tab_' + id)), el('i', 'badge'));
      b.onclick = () => { tab = id; render(); };
      b.dataset.tab = id;
      nav.append(b);
    }
    $('#btn-boss').textContent = t('challenge');
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
    $('#dps').textContent = `${t('dps')} ${fmt(G.totalDps(s))}`;
    $('#btn-boss').hidden = !s.farming;
    const boostLeft = (s.boostUntil - n) / 1000;
    $('#boost-chip').hidden = boostLeft <= 0;
    if (boostLeft > 0) $('#boost-chip').textContent = `🔥 ${t('boost_on')} · ${fmtTime(boostLeft)}`;
    $('#tap-hint').hidden = s.stats.taps >= 3;
    const badge = {
      cmd: G.claimableMissions(s) > 0 || G.medalsOnPrestige(s) > 0 && s.stats.prestiges === 0,
      shop: G.dailyAvailable(s, n) || s.adGemsAt <= n,
    };
    for (const b of $('#tabs').children) b.classList.toggle('has-badge', !!badge[b.dataset.tab]);
    for (const u of updaters) u();
  }

  // ---------- finestre di gioco ----------
  function coinBody(desc, coins) {
    const body = el('div');
    body.append(el('p', '', desc), el('div', 'big-coins', '🪙 ' + fmt(coins)));
    return body;
  }

  function showOffline(secs, coins) {
    const s = S();
    s.coins += coins; app.save();
    openModal({
      title: t('offline'), icon: '🌙', body: coinBody(t('offline_d', fmtTime(secs)), coins),
      buttons: [
        { label: t('collect'), kind: 'ghost' },
        { label: adLabel('double_it'), kind: 'ad', onClick: () => rewarded(() => { S().coins += coins; }).then(() => true) },
      ],
    });
  }

  function showDrop() {
    if (modalCount || $('#drop')) return;
    const d = el('button', '', '🪂'); d.id = 'drop'; d.setAttribute('aria-label', t('drop'));
    d.style.top = 18 + Math.random() * 30 + '%';
    d.onanimationend = () => d.remove();
    d.onclick = (ev) => {
      ev.stopPropagation(); d.remove();
      const s = S(), small = G.dropReward(s, now(), false), big = G.dropReward(s, now(), true);
      sfx.reward();
      openModal({
        title: t('drop'), icon: '📦', body: coinBody(t('drop_d'), big),
        buttons: [
          { label: t('drop_take', fmt(small)), kind: 'ghost', onClick: () => { S().coins += small; refresh(); } },
          {
            label: adLabel('drop_ad', fmt(big)), kind: 'ad',
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
    line(t('reset'), '🗑️', () => openModal({
      title: t('reset'), icon: '⚠️', body: t('reset_confirm'),
      buttons: [{ label: t('cancel'), kind: 'ghost' }, { label: t('confirm'), kind: 'danger', onClick: () => app.reset() }],
    }));
    openModal({ title: t('settings'), body, buttons: [{ label: t('close'), kind: 'ghost' }] });
  }

  function banner(msg, cls = '') {
    const b = $('#banner');
    b.textContent = msg; b.className = 'show ' + cls;
    clearTimeout(banner._t); banner._t = setTimeout(() => { b.className = ''; }, 1600);
  }

  $('#btn-settings').onclick = showSettings;
  $('#btn-boss').onclick = (ev) => { ev.stopPropagation(); if (G.challengeBoss(S())) { sfx.boss(); refresh(); } };
  $('#boost-chip').onclick = (ev) => { ev.stopPropagation(); tab = 'shop'; render(); };

  return { render, refresh, toast, banner, showOffline, showDrop, closeTopModal, hasModal: () => modalCount > 0 };
}
