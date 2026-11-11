// Interfaccia DOM: HUD, schede, finestre modali, negozio.
import * as G from './game.js';
import {
  SLOTS, TIERS, PILOTS, PILOT_BONUS, AIRCRAFT, MISSIONS, PRODUCTS, DAILY_GEMS, KILLS_PER_STAGE, WORKSHOP_MAX,
  AD_GEMS, AD_GEMS_COOLDOWN, AD_WRENCHES, AD_WRENCH_COOLDOWN, AD_BOOST_SECONDS, AD_SPEEDUP_SECONDS, WRENCH_PACK,
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
  let tab = 'work', squadView = 'pilots', updaters = [], modalCount = 0;
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
  const slotOf = (id) => SLOTS.find((x) => x.id === id);
  const statLabel = (p) => `+${fmt(G.partMain(p) * G.globalMult(S()))} ${t(slotOf(p.slot).stat === 'atk' ? 'stat_atk' : 'stat_hp')}`;
  const subLabel = (p) => (p.sub ? `+${p.val}% ${t('sub_' + p.sub)}` : '');
  function partCard(p, title) {
    const tier = TIERS[p.tier], c = el('div', 'part');
    c.style.setProperty('--tier', tier.color);
    const head = el('div', 'part-head');
    head.append(html('div', 'part-ico', ic(slotOf(p.slot).icon)), (() => {
      const d = el('div', 'info');
      d.append(el('div', 'part-title', title), el('div', 'name', `${t('slot_' + p.slot)} · ${t('lvl')} ${p.lvl}`), el('div', 'part-tier', t('tier_' + tier.id)));
      return d;
    })());
    c.append(head, el('div', 'part-stat', statLabel(p)));
    if (p.sub) c.append(el('div', 'part-sub', subLabel(p)));
    return c;
  }

  function tabWorkshop() {
    const grid = el('div', 'slots');
    for (const sl of SLOTS) {
      const b = el('button', 'slot'), lv = el('span', 'slot-lv');
      b.append(html('span', 'slot-ico', ic(sl.icon)), lv);
      b.setAttribute('aria-label', t('slot_' + sl.id));
      b.onclick = () => {
        const p = S().parts[sl.id];
        if (p) openModal({ title: t('slot_' + sl.id), body: partCard(p, t('mounted')), buttons: [{ label: t('close'), kind: 'ghost' }] });
      };
      b.dataset.slot = sl.id;
      updaters.push(() => {
        const p = S().parts[sl.id], key = p ? `${p.lvl}:${p.tier}` : '';
        if (b._k === key) return;
        b._k = key;
        b.classList.toggle('empty', !p);
        b.style.setProperty('--tier', p ? TIERS[p.tier].color : 'transparent');
        lv.textContent = p ? `${t('lvl')} ${p.lvl}` : '';
      });
      grid.append(b);
    }
    panel.append(grid);

    // pezzo appena costruito: confronto con quello montato
    const choice = el('div', 'choice');
    updaters.push(() => {
      const s = S(), p = s.pending, key = p ? JSON.stringify(p) : '';
      if (choice._k === key) return;
      choice._k = key; choice.replaceChildren(); choice.hidden = !p; bench.hidden = !!p; grid.hidden = !!p;
      if (!p) return;
      const cur = s.parts[p.slot], delta = G.partMain(p) / G.partMain(cur) - 1;
      const cards = el('div', 'compare');
      cards.append(partCard(cur, t('mounted')), partCard(p, t('new_part')));
      const verdict = el('div', 'verdict ' + (delta > 0 ? 'pos' : 'neg'), `${delta > 0 ? '▲ +' : '▼ '}${Math.round(delta * 100)}%`);
      const btns = el('div', 'btn-row');
      const sell = html('button', 'btn ghost', `<span>${t('sell')}</span>${cost('coin', G.partSell(p))}`);
      const mount = html('button', 'btn ' + (delta > 0 ? 'ad' : 'ghost'), `<span>${t('mount')}</span>${cost('coin', G.partSell(cur))}`);
      sell.onclick = () => { G.resolvePending(S(), false); sfx.buy(); refresh(); };
      mount.onclick = () => { G.resolvePending(S(), true); sfx.reward(); flash(p.slot); refresh(); };
      btns.append(sell, mount);
      choice.append(cards, verdict, btns);
    });

    const bench = el('div', 'bench');
    const buildBtn = html('button', 'btn build', `<span>${t('build')}</span>${cost('wrench', 1)}`);
    buildBtn.onclick = () => {
      const r = G.build(S());
      if (!r) { if (S().wrenches < 1) toast(t('no_wrenches')); return; }
      sfx.buy(); if (r.equipped) flash(r.part.slot);
      refresh();
    };
    const auto = el('button', 'btn ghost side');
    auto.onclick = () => { S().auto = !S().auto; sfx.buy(); refresh(); };
    const shopBtn = el('button', 'btn ghost side');
    shopBtn.onclick = showWorkshop;
    updaters.push(() => {
      const s = S(), busy = G.workshopBusy(s, now());
      buildBtn.disabled = s.wrenches < 1;
      const a = `<span>${t('auto')}</span><span class="b2">${s.auto ? t('on') : t('off')}</span>`;
      if (auto._l !== a) { auto._l = a; auto.innerHTML = a; auto.classList.toggle('active', s.auto); }
      const w = `<span>${t('workshop')} ${s.workshop.level}</span><span class="b2">${busy ? fmtTime((s.workshop.upgradeEnd - now()) / 1000) : t('upgrade')}</span>`;
      if (shopBtn._l !== w) { shopBtn._l = w; shopBtn.innerHTML = w; }
      shopBtn.classList.toggle('ready', !busy && s.coins >= G.workshopCost(s.workshop.level) && s.workshop.level < WORKSHOP_MAX);
    });
    bench.append(auto, buildBtn, shopBtn);
    panel.append(choice, bench, el('p', 'hint center', t('workshop_hint')));
  }
  function flash(slot) {
    const b = panel.querySelector(`.slot[data-slot="${slot}"]`);
    if (b) { b.classList.remove('flash'); void b.offsetWidth; b.classList.add('flash'); }
  }

  function showWorkshop() {
    const body = el('div', 'ws');
    let timer = null;
    const m = openModal({ title: '', icon: 'wrench', body, buttons: [{ label: t('close'), kind: 'ghost' }], onClose: () => clearInterval(timer) });
    const draw = () => {
      const s = S(), L = s.workshop.level, busy = G.workshopBusy(s, now()), key = `${L}:${busy}`;
      m.title.textContent = `${t('workshop')} ${L}`;
      if (body._k !== key) {
        body._k = key; body.replaceChildren(); body._left = body._skip = body._up = null;
        const odds = G.tierOdds(L), next = L < WORKSHOP_MAX ? G.tierOdds(L + 1) : null;
        body.append(el('p', '', t('workshop_d', G.partMaxLevel(L))));
        const table = el('div', 'odds');
        TIERS.forEach((tier, i) => {
          if (!odds[i] && !(next && next[i])) return;
          const r = el('div', 'odds-row'); r.style.setProperty('--tier', tier.color);
          r.append(el('span', 'odds-name', t('tier_' + tier.id)), el('span', 'num', (odds[i] * 100).toFixed(1) + '%'));
          if (next) r.append(el('span', 'num odds-next', '→ ' + (next[i] * 100).toFixed(1) + '%'));
          table.append(r);
        });
        body.append(table);
        const act = el('div', 'ws-act');
        if (L >= WORKSHOP_MAX) act.append(el('p', 'hint center', t('max')));
        else if (busy) {
          const left = el('div', 'big-coins ws-left'); body._left = left;
          const speed = html('button', 'btn ad', `${adHtml(t('speed_up'))}`);
          speed.onclick = () => rewarded(() => { G.speedWorkshopUpgrade(S(), AD_SPEEDUP_SECONDS, now()); G.finishWorkshopUpgrade(S(), now()); draw(); });
          const skip = el('button', 'btn gem'); body._skip = skip;
          skip.onclick = () => { if (G.skipWorkshopUpgrade(S(), now())) { sfx.reward(); app.save(); refresh(); draw(); } else toast(t('not_enough_gems')); };
          const row2 = el('div', 'btn-row'); row2.append(speed, skip);
          act.append(left, row2);
        } else {
          const up = html('button', 'btn primary wide', `<span>${t('upgrade')} · ${fmtTime(G.workshopSeconds(L))}</span>${cost('coin', G.workshopCost(L))}`);
          up.disabled = s.coins < G.workshopCost(L); body._up = up;
          up.onclick = () => { if (G.startWorkshopUpgrade(S(), now())) { sfx.buy(); app.save(); refresh(); draw(); } };
          act.append(up);
        }
        body.append(act);
      }
      if (body._left && busy) {
        body._left.textContent = fmtTime((s.workshop.upgradeEnd - now()) / 1000);
        const g = `<span>${t('finish_now')}</span>${cost('gem', G.skipGems(s, now()))}`;
        if (body._skip._l !== g) { body._skip._l = g; body._skip.innerHTML = g; }
      }
      if (body._up && !busy) body._up.disabled = s.coins < G.workshopCost(L);
    };
    draw();
    timer = setInterval(draw, 400);
  }

  function tabSquad() {
    const top = el('div', 'bar');
    top.append(seg([['pilots', t('wingmen')], ['hangar', t('hangar')]], () => squadView, (v) => { squadView = v; render(); }));
    if (squadView === 'pilots') top.append(buyModeBar());
    panel.append(top);
    if (squadView === 'hangar') return hangar();
    const total = el('p', 'hint');
    updaters.push(() => { total.textContent = t('pilot_total', Math.round((G.pilotBonus(S()) - 1) * 100)); });
    panel.append(total);
    PILOTS.forEach((p, i) => {
      const x = row({ iconEl: planeIcon('mono', p.color), title: '' });
      x.btn.onclick = () => { if (G.buyPilot(S(), p.id)) { sfx.buy(); refresh(); } };
      updaters.push(() => {
        const s = S(), lvl = s.pilots[p.id] || 0, q = G.quote(s, p.id);
        const visible = i === 0 || lvl > 0 || (s.pilots[PILOTS[i - 1].id] || 0) > 0;
        x.r.classList.toggle('locked', !visible);
        x.name.textContent = visible ? `${t('p_' + p.id)}${lvl ? ` · ${t('lvl')} ${lvl}` : ''}` : '———';
        x.sub.textContent = !visible ? t('locked') : t('pilot_d', Math.round(PILOT_BONUS * 100), Math.round(lvl * PILOT_BONUS * 100));
        setBtn(x, lvl ? `+${q.n} ${t('lvl')}` : t('hire'), cost('coin', q.cost), visible && s.coins >= q.cost);
      });
      panel.append(x.r);
    });
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

  function tabGoals() {
    panel.append(heading(t('missions')));
    for (const m of MISSIONS) {
      const x = row({ icon: 'target', title: t('m_' + m.stat, m.stat === 'maxStage' ? G.stageName(m.goal) : fmt(m.goal)) });
      x.btn.onclick = () => { if (G.claimMission(S(), m.id)) { sfx.reward(); app.save(); refresh(); } };
      updaters.push(() => {
        const s = S(), have = Math.min(s.stats[m.stat] || 0, m.goal);
        x.sub.textContent = m.stat === 'maxStage' ? `${G.stageName(have)} / ${G.stageName(m.goal)}` : `${fmt(have)} / ${fmt(m.goal)}`;
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

    const timedAd = (icon, title, sub, key, cooldown, grant) => {
      const x = row({ icon, title });
      x.sub.textContent = sub;
      x.btn.onclick = () => rewarded(() => { grant(); S()[key] = now() + cooldown * 1000; });
      updaters.push(() => {
        const left = (S()[key] - now()) / 1000;
        if (left > 0) setBtn(x, t('ready_in', fmtTime(left)), '', false, 'done');
        else setBtn(x, adHtml(t('watch')), '', true, 'ad');
      });
      return x.r;
    };
    const adWrench = timedAd('wrench', t('ad_wrenches', AD_WRENCHES), t('ad_gems_d'), 'adWrenchAt', AD_WRENCH_COOLDOWN, () => { S().wrenches += AD_WRENCHES; });
    const adGems = timedAd('gem', t('ad_gems', AD_GEMS), t('ad_gems_d'), 'adGemsAt', AD_GEMS_COOLDOWN, () => { S().gems += AD_GEMS; });

    const boost = row({ icon: 'flame', title: t('ad_boost') });
    boost.btn.onclick = () => rewarded(() => G.addBoost(S(), AD_BOOST_SECONDS, now()));
    updaters.push(() => {
      const left = (S().boostUntil - now()) / 1000;
      boost.sub.textContent = left > 0 ? `${t('boost_on')} · ${fmtTime(left)}` : t('ad_boost_d');
      setBtn(boost, adHtml(t('watch')), '', true, 'ad');
    });

    const pack = row({ icon: 'wrench', title: t('wrench_pack', WRENCH_PACK.wrenches) });
    pack.sub.textContent = t('wrench_pack_d');
    pack.btn.onclick = () => {
      const s = S();
      if (s.gems < WRENCH_PACK.gems) { toast(t('not_enough_gems')); return; }
      s.gems -= WRENCH_PACK.gems; s.wrenches += WRENCH_PACK.wrenches;
      sfx.reward(); app.save(); refresh();
    };
    updaters.push(() => setBtn(pack, t('buy'), cost('gem', WRENCH_PACK.gems), S().gems >= WRENCH_PACK.gems, 'gem'));
    panel.append(daily.r, adWrench, adGems, boost.r, pack.r, heading(t('shop_iap')));

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
    ['work', 'wrench', tabWorkshop], ['squad', 'squad', tabSquad], ['arena', 'swords', () => online.tabArena()],
    ['ally', 'shield', () => online.tabAlliance()], ['goals', 'star', tabGoals], ['shop', 'shop', tabShop],
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
    $('#wrenches').textContent = fmt(Math.floor(s.wrenches));
    const e = s.enemy, boss = e?.boss;
    $('#stage-name').textContent = boss ? `${t('boss')} · ${G.stageName(s.stage)}` : `${t('stage')} ${G.stageName(s.stage)}`;
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
      goals: G.claimableMissions(s) > 0,
      work: !!s.pending || (s.wrenches >= 1 && !s.auto),
      shop: G.dailyAvailable(s, n),
    };
    for (const b of $('#tabs').children) b.classList.toggle('has-badge', !!badge[b.dataset.tab]);
    for (const u of updaters) u();
    online.heartbeat();
  }

  // ---------- finestre di gioco ----------
  function coinBody(desc, coins, wrenches = 0) {
    const body = el('div');
    body.append(el('p', '', desc), html('div', 'big-coins', cost('coin', coins) + (wrenches ? ' &nbsp; ' + cost('wrench', wrenches) : '')));
    return body;
  }

  function showOffline(secs, coins, wrenches) {
    const s = S();
    s.coins += coins; s.wrenches += wrenches; app.save();
    openModal({
      title: t('offline'), icon: 'moon', body: coinBody(t('offline_d', fmtTime(secs)), coins, wrenches),
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
  $('#cur-wrench').onclick = () => { tab = 'shop'; render(); };

  return { render, refresh, toast, banner, showOffline, showDrop, closeTopModal, flash, hasModal: () => modalCount > 0 };
}
