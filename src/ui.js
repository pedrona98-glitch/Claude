// Interfaccia DOM: HUD, battaglia, finestre, Officina e Negozio. Le altre schede stanno in ui-*.js.
import * as G from './game.js';
import {
  SLOTS, AGES, SUBSTATS, WAVES, MISSIONS, PRODUCTS, GEM_OFFERS, DAILY_GEMS, AD_REWARDS, AD_SPEEDUP_SECONDS,
  PASS_TIERS, PASS_XP, MANEUVERS, RARITIES,
} from './data.js';
import { fmt, fmtTime } from './format.js';
import { t, setLang, getLang } from './i18n.js';
import { sfx, setSound } from './audio.js';
import { drawPlane } from './render.js';
import { Monet } from './monetization.js';
import { ic, withIcon, esc } from './icons.js';
import { createSquadUI } from './ui-squad.js';
import { createProgressUI } from './ui-progress.js';
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
  e.innerHTML = markup; // solo markup costruito dal gioco (icone e numeri), mai testo dei giocatori
  return e;
}
export const cost = (icon, n) => `${ic(icon)}<span>${typeof n === 'number' ? fmt(n) : esc(n)}</span>`;
const PACK_ICONS = { coins: 'coin', gems: 'gem', wrenches: 'wrench', plans: 'scroll', blueprints: 'blueprint', paint: 'brush', keys: 'key' };
/** Markup di un pacchetto di risorse, es. { coins: 10, crates: [1] }. */
export function packHtml(pack) {
  const out = [];
  for (const [k, icon] of Object.entries(PACK_ICONS)) if (pack[k]) out.push(`<span class="pk">${cost(icon, pack[k])}</span>`);
  if (pack.crates && pack.crates.length) {
    const by = {};
    for (const r of pack.crates) by[r] = (by[r] || 0) + 1;
    for (const [r, n] of Object.entries(by)) out.push(`<span class="pk" style="--r:${RARITIES[r].color}">${ic('crate')}<span>${n}</span></span>`);
  }
  return out.join('');
}
export const subText = (sub) => `+${sub.v}% ${t('sub_' + sub.id)}`;
export const ageName = (age) => t('age_' + AGES[age].id);
export const rarityName = (r) => t('r_' + RARITIES[r].id);

export function createUI(app) {
  const S = () => app.state;
  const now = () => Date.now();
  let tab = 'work', updaters = [], modalCount = 0;
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
      const btn = html('button', 'btn ' + (b.kind || 'primary'), b.html || withIcon(b.icon, b.label));
      btn.onclick = async () => {
        if (btn.disabled) return;
        btn.disabled = true;
        const keep = b.onClick ? await b.onClick() : undefined;
        btn.disabled = false;
        if (keep !== false) close();
      };
      bar.append(btn);
    }
    if (buttons.length) box.append(bar);
    wrap.append(box); root.append(wrap); modalCount++;
    wrap.addEventListener('pointerdown', (ev) => { if (ev.target === wrap && !wrap.classList.contains('locked')) close(); });
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
        buttons: [{ label: t('cancel'), kind: 'ghost', onClick: () => finish(false) }, { label: t('confirm'), onClick: () => finish(true) }],
      });
    }),
  });

  // ---------- pezzi riutilizzati dalle schede ----------
  function row({ icon, iconEl, title, noBtn, color }) {
    const r = el('div', 'row'), ico = el('div', 'ico'), info = el('div', 'info');
    if (iconEl) ico.append(iconEl); else ico.innerHTML = ic(icon);
    if (color) r.style.setProperty('--r', color);
    const name = el('div', 'name', title), sub = el('div', 'sub');
    const btn = el('button', 'btn buy'), b1 = el('span', 'b1'), b2 = el('span', 'b2');
    btn.append(b1, b2); info.append(name, sub); r.append(ico, info);
    if (!noBtn) r.append(btn);
    return { r, ico, name, sub, btn, b1, b2 };
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
  function planeIcon(shape, color) {
    const cv = el('canvas'); cv.width = 104; cv.height = 104;
    drawPlane(cv.getContext('2d'), shape, color, 50, 54, 86, 0.02, 1);
    return cv;
  }
  /** Scheda bloccata: spiega dove si sblocca. */
  function locked(key, text) {
    const card = el('div', 'card center locked-card');
    card.append(html('div', 'card-icon', ic('lock')), el('div', 'name', t('unlock_at', G.stageName(G.unlockStage(key)))), el('p', 'sub', text));
    panel.append(card);
  }
  /** Timer con video (-30 min) e gemme (subito). `target`: 'forge' | 'tech' | indice della cassa. */
  function timerButtons(target, getEnd, after) {
    const box = el('div', 'btn-row');
    const ad = html('button', 'btn ad', adHtml(t('speed_up')));
    ad.onclick = () => rewarded(() => { G.speedUp(S(), target, now(), { seconds: AD_SPEEDUP_SECONDS }); after?.(); });
    const gem = el('button', 'btn gem');
    gem.onclick = () => {
      if (G.speedUp(S(), target, now(), { gems: true })) { sfx.reward(); app.save(); after?.(); refresh(); } else toast(t('not_enough_gems'));
    };
    updaters.push(() => {
      const end = getEnd();
      const g = end > now() ? `<span>${t('finish_now')}</span>${cost('gem', G.skipGems(end, now()))}` : '';
      if (gem._l !== g) { gem._l = g; gem.innerHTML = g; }
    });
    box.append(ad, gem);
    return box;
  }
  /** Finestra di uno scontro simulato: le barre scendono, poi compare l'esito. */
  function fightModal({ me, foe, win, myLeft, foeLeft, lines = [], title }) {
    const body = el('div', 'duel');
    const bar = (label, left, cls) => {
      const w = el('div', 'duel-side'), track = el('div', 'meter ' + cls), fill = el('div', 'meter-fill');
      track.append(fill); w.append(el('div', 'duel-name', label), track);
      requestAnimationFrame(() => requestAnimationFrame(() => { fill.style.width = Math.round(left * 100) + '%'; }));
      return w;
    };
    const result = el('div', 'duel-result');
    body.append(bar(me, myLeft, 'good'), el('div', 'duel-vs', t('vs')), bar(foe, foeLeft, 'bad'), result);
    const m = openModal({ title: title || '···', icon: 'swords', body, buttons: [{ label: t('close'), kind: 'ghost' }] });
    sfx.rocket();
    setTimeout(() => {
      m.title.textContent = win ? t('victory') : t('defeat_pvp');
      m.box.classList.add(win ? 'won' : 'lost');
      for (const line of lines) result.append(html('div', 'duel-line', line));
      if (win) sfx.reward(); else sfx.fail();
    }, 1400);
  }

  // ---------- Officina ----------
  const slotOf = (id) => SLOTS.find((x) => x.id === id);
  const partValue = (p) => `+${fmt(G.partMain(p))} ${t(G.partStat(p) === 'atk' ? 'stat_atk' : 'stat_hp')}`;
  function partCard(p, title) {
    const age = AGES[p.age], c = el('div', 'part');
    c.style.setProperty('--r', age.color);
    const head = el('div', 'part-head');
    const info = el('div', 'info');
    info.append(el('div', 'part-title', title), el('div', 'name', `${t('slot_' + p.slot)} · ${t('lvl')} ${p.lvl}`), el('div', 'part-tier', ageName(p.age)));
    head.append(html('div', 'part-ico', ic(slotOf(p.slot).icon)), info);
    c.append(head, el('div', 'part-stat', partValue(p)));
    for (const sub of p.subs) c.append(el('div', 'part-sub', subText(sub)));
    return c;
  }

  function tabWork() {
    const grid = el('div', 'slots');
    for (const sl of SLOTS) {
      const b = el('button', 'slot'), lv = el('span', 'slot-lv');
      b.append(html('span', 'slot-ico', ic(sl.icon)), lv);
      b.setAttribute('aria-label', t('slot_' + sl.id));
      b.dataset.slot = sl.id;
      b.onclick = () => {
        const p = S().parts[sl.id];
        if (p) openModal({ title: t('slot_' + sl.id), body: partCard(p, t('mounted')), buttons: [{ label: t('close'), kind: 'ghost' }] });
      };
      updaters.push(() => {
        const p = S().parts[sl.id], key = p ? `${p.lvl}:${p.age}` : '';
        if (b._k === key) return;
        b._k = key;
        b.classList.toggle('empty', !p);
        b.style.setProperty('--r', p ? AGES[p.age].color : 'transparent');
        lv.textContent = p ? `${t('lvl')} ${p.lvl}` : '';
      });
      grid.append(b);
    }
    const emblem = el('button', 'slot wide');
    emblem.onclick = () => squad.open('emblems');
    updaters.push(() => {
      const s = S(), id = s.emblems.eq, key = `${id}:${s.emblems.own[id]}:${G.unlocked(s, 'emblems')}`;
      if (emblem._k === key) return;
      emblem._k = key;
      emblem.classList.toggle('empty', !id);
      emblem.style.setProperty('--r', id ? RARITIES[squad.emblemR(id)].color : 'transparent');
      emblem.innerHTML = id ? `${ic('badge')}<span class="slot-lv">${esc(t('em_' + id))} · +${Math.round(G.emblemBoost(s))}%</span>`
        : `${ic(G.unlocked(s, 'emblems') ? 'badge' : 'lock')}<span class="slot-lv">${esc(t('emblem'))}</span>`;
    });
    grid.append(emblem);
    panel.append(grid);

    // pezzo appena costruito: confronto con quello montato
    const choice = el('div', 'choice');
    const bench = el('div', 'bench');
    updaters.push(() => {
      const s = S(), p = s.pending[0], key = p ? JSON.stringify(p) + s.pending.length : '';
      if (choice._k === key) return;
      choice._k = key; choice.replaceChildren(); choice.hidden = !p; bench.hidden = !!p; grid.hidden = !!p;
      if (!p) return;
      const cur = s.parts[p.slot], delta = G.partMain(p) / G.partMain(cur) - 1;
      const cards = el('div', 'compare');
      cards.append(partCard(cur, t('mounted')), partCard(p, t('new_part')));
      const verdict = el('div', 'verdict ' + (delta > 0 ? 'pos' : 'neg'), `${delta > 0 ? '▲ +' : '▼ '}${fmt(Math.round(delta * 100))}%`);
      if (s.pending.length > 1) verdict.append(el('span', 'sub', ` · ${t('more_parts', s.pending.length - 1)}`));
      const btns = el('div', 'btn-row');
      const sell = html('button', 'btn ghost', `<span>${t('sell')}</span>${cost('coin', G.partSell(s, p))}`);
      const mount = html('button', 'btn ' + (delta > 0 ? 'ad' : 'ghost'), `<span>${t('mount')}</span>${cost('coin', G.partSell(s, cur))}`);
      sell.onclick = () => { G.resolvePending(S(), false); sfx.buy(); refresh(); };
      mount.onclick = () => { G.resolvePending(S(), true); sfx.reward(); flash(p.slot); refresh(); };
      btns.append(sell, mount);
      choice.append(cards, verdict, btns);
    });

    const buildBtn = html('button', 'btn build', '');
    buildBtn.onclick = () => {
      const r = G.build(S());
      if (!r.length) { if (S().wrenches < 1) toast(t('no_wrenches')); return; }
      sfx.buy(); for (const x of r) if (x.equipped) flash(x.part.slot);
      refresh();
    };
    const auto = el('button', 'btn ghost side');
    auto.onclick = showAuto;
    const forgeBtn = el('button', 'btn ghost side');
    forgeBtn.onclick = showForge;
    updaters.push(() => {
      const s = S(), busy = G.forgeBusy(s, now()), info = G.forgeUpgradeInfo(s);
      const b = `${ic('anvil')}<span>${t('build')}${G.forgeBatch(s) > 1 ? ' ×' + G.forgeBatch(s) : ''}</span><span class="b2">${cost('wrench', Math.floor(s.wrenches))}</span>`;
      if (buildBtn._l !== b) { buildBtn._l = b; buildBtn.innerHTML = b; }
      buildBtn.disabled = s.wrenches < 1;
      const lockedAuto = !G.unlocked(s, 'autoForge');
      const a = `<span>${t('auto')}</span><span class="b2">${lockedAuto ? G.stageName(G.unlockStage('autoForge')) : s.auto.on ? t('on') : t('off')}</span>`;
      if (auto._l !== a) { auto._l = a; auto.innerHTML = a; }
      auto.classList.toggle('active', s.auto.on); auto.disabled = lockedAuto;
      const w = `<span>${t('workshop')} ${s.forge.level}</span><span class="b2">${busy ? fmtTime((s.forge.end - now()) / 1000) : info ? `${s.forge.paid}/${info.parts}` : t('max')}</span>`;
      if (forgeBtn._l !== w) { forgeBtn._l = w; forgeBtn.innerHTML = w; }
      forgeBtn.classList.toggle('ready', !busy && !!info && s.coins >= info.cost);
    });
    bench.append(auto, buildBtn, forgeBtn);
    panel.append(choice, bench);
    const st = el('div', 'statline');
    updaters.push(() => {
      const x = G.stats(S()), k = `${Math.round(x.atk)}:${Math.round(x.hp)}`;
      if (st._k === k) return;
      st._k = k;
      st.innerHTML = `<span>${ic('gun')} ${fmt(x.atk)}</span><span>${ic('heart')} ${fmt(x.hp)}</span><span>${ic('bolt')} ${x.aps.toFixed(2)}/s</span><button class="link" type="button">${esc(t('all_stats'))}</button>`;
      st.querySelector('button').onclick = showStats;
    });
    panel.append(st);
  }
  function flash(slot) {
    const b = panel.querySelector(`.slot[data-slot="${slot}"]`);
    if (b) { b.classList.remove('flash'); void b.offsetWidth; b.classList.add('flash'); }
  }

  function showStats() {
    const s = S(), x = G.stats(s), sub = G.subTotals(s), list = el('div', 'kv');
    const line = (k, v) => { const r = el('div', 'kv-row'); r.append(el('span', '', k), el('b', '', v)); list.append(r); };
    line(t('power'), fmt(x.power)); line(t('stat_atk'), fmt(x.atk)); line(t('stat_hp'), fmt(x.hp)); line(t('dps'), fmt(x.dps));
    for (const st of SUBSTATS) if (sub[st.id]) line(t('sub_' + st.id), `+${Math.round(sub[st.id] * 10) / 10}%`);
    openModal({ title: t('all_stats'), body: list, buttons: [{ label: t('close'), kind: 'ghost' }] });
  }

  function showAuto() {
    const s = S(), body = el('div', 'form');
    body.append(el('p', '', t('auto_d')));
    const pickAge = el('div', 'age-pick');
    const draw = () => {
      pickAge.replaceChildren();
      AGES.forEach((a, i) => {
        const b = el('button', 'chip' + (s.auto.stopAge === i ? ' on' : ''), ageName(i));
        b.style.setProperty('--r', a.color);
        b.onclick = () => { s.auto.stopAge = i; draw(); };
        pickAge.append(b);
      });
    };
    draw();
    body.append(el('div', 'sub', t('auto_stop')), pickAge);
    openModal({
      title: t('auto_forge'), icon: 'anvil', body,
      buttons: [
        { label: t('close'), kind: 'ghost' },
        { label: s.auto.on ? t('auto_off') : t('auto_on'), kind: s.auto.on ? 'ghost' : 'ad', onClick: () => { s.auto.on = !s.auto.on; app.save(); refresh(); } },
      ],
    });
  }

  function showForge() {
    const body = el('div', 'ws');
    let timer = null;
    const m = openModal({ title: '', icon: 'anvil', body, buttons: [{ label: t('close'), kind: 'ghost' }], onClose: () => clearInterval(timer) });
    const draw = () => {
      const s = S(), L = s.forge.level, busy = G.forgeBusy(s, now()), info = G.forgeUpgradeInfo(s), key = `${L}:${busy}:${s.forge.paid}`;
      m.title.textContent = `${t('workshop')} ${L}`;
      if (body._k !== key) {
        body._k = key; body.replaceChildren(); body._left = body._pay = null;
        const odds = G.forgeOdds(L), next = info ? G.forgeOdds(L + 1) : null;
        body.append(el('p', '', t('workshop_d', G.maxPartLevel(s))));
        const table = el('div', 'odds');
        AGES.forEach((a, i) => {
          if (!odds[i] && !(next && next[i])) return;
          const r = el('div', 'odds-row'); r.style.setProperty('--r', a.color);
          r.append(el('span', 'odds-name', ageName(i)), el('span', 'num', odds[i] + '%'));
          if (next) r.append(el('span', 'num odds-next', '→ ' + next[i] + '%'));
          table.append(r);
        });
        body.append(table);
        const act = el('div', 'ws-act');
        if (!info) act.append(el('p', 'hint center', t('max')));
        else if (busy) {
          const left = el('div', 'big-coins ws-left'); body._left = left;
          act.append(left, timerButtons('forge', () => S().forge.end, draw));
        } else {
          const steps = el('div', 'steps');
          for (let i = 0; i < info.parts; i++) steps.append(el('i', i < s.forge.paid ? 'on' : ''));
          const pay = html('button', 'btn primary wide', `<span>${info.parts > 1 ? t('pay_step', s.forge.paid + 1, info.parts) : t('upgrade')} · ${fmtTime(info.secs)}</span>${cost('coin', info.cost)}`);
          body._pay = pay;
          pay.onclick = () => { if (G.payForge(S(), now())) { sfx.buy(); app.save(); refresh(); draw(); } };
          if (info.parts > 1) act.append(steps);
          act.append(pay);
        }
        body.append(act);
      }
      if (body._left && busy) body._left.innerHTML = `${ic('hourglass')} ${fmtTime((s.forge.end - now()) / 1000)}`;
      if (body._pay) body._pay.disabled = s.coins < info.cost;
      for (const u of updaters) u();
    };
    draw();
    timer = setInterval(draw, 400);
  }

  // ---------- Negozio ----------
  function tabShop() {
    const s0 = S();
    if (!G.unlocked(s0, 'shop')) return locked('shop', t('shop_lock'));
    if (G.unlocked(s0, 'pass')) passCard();
    panel.append(heading(t('shop_free')));
    const daily = row({ icon: 'calendar', title: t('daily') });
    daily.btn.onclick = () => { if (G.claimDaily(S(), now())) { sfx.reward(); app.save(); refresh(); } };
    updaters.push(() => {
      const s = S(), avail = G.dailyAvailable(s, now());
      daily.sub.textContent = t('daily_d', (s.daily.day % DAILY_GEMS.length) + 1, DAILY_GEMS[s.daily.day % DAILY_GEMS.length]);
      setBtn(daily, avail ? t('claim') : t('come_back'), '', avail, avail ? 'gem' : 'done');
    });
    panel.append(daily.r);
    for (const id of Object.keys(AD_REWARDS)) {
      const x = row({ icon: id === 'gems' ? 'gem' : 'wrench', title: '' });
      x.name.innerHTML = packHtml(AD_REWARDS[id].give);
      x.sub.textContent = t('ad_watch_d');
      x.btn.onclick = () => rewarded(() => G.grantAd(S(), id, now()));
      updaters.push(() => {
        const left = ((S().ads[id] || 0) - now()) / 1000;
        if (left > 0) setBtn(x, t('ready_in', fmtTime(left)), '', false, 'done');
        else setBtn(x, adHtml(t('watch')), '', true, 'ad');
      });
      panel.append(x.r);
    }
    panel.append(heading(t('shop_gems')));
    for (const o of GEM_OFFERS) {
      const x = row({ icon: { wrenches: 'wrench', keys: 'key', paint: 'brush', plans: 'scroll' }[o.id], title: '' });
      x.name.innerHTML = packHtml(o.give);
      x.sub.textContent = t('offer_' + o.id);
      x.btn.onclick = () => {
        const s = S();
        if (s.gems < o.gems) { toast(t('not_enough_gems')); return; }
        s.gems -= o.gems; G.give(s, o.give); sfx.reward(); app.save(); refresh();
      };
      updaters.push(() => setBtn(x, t('buy'), cost('gem', o.gems), S().gems >= o.gems, 'gem'));
      panel.append(x.r);
    }
    panel.append(heading(t('shop_iap')));
    for (const p of PRODUCTS) {
      const x = row({ icon: p.icon, title: t('pr_' + p.id) });
      x.sub.textContent = p.id.startsWith('gems_') ? t('pr_gems_d', p.gems) : t(`pr_${p.id}_d`);
      x.btn.onclick = () => purchase(p);
      updaters.push(() => {
        const s = S(), owned = (p.once && s.purchased[p.id]) || (p.season && s.pass.premium);
        if (owned) setBtn(x, t('owned'), '', false, 'done'); else setBtn(x, Monet.price(p.id), '', true, 'cash');
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
    panel.append(heading(t('missions')));
    for (const m of MISSIONS) {
      const x = row({ icon: 'target', title: t('m_' + m.stat, m.stat === 'maxStage' ? G.stageName(m.goal) : fmt(m.goal)) });
      x.btn.onclick = () => { if (G.claimMission(S(), m.id)) { sfx.reward(); app.save(); refresh(); } };
      updaters.push(() => {
        const s = S(), have = Math.min(s.stats[m.stat] || 0, m.goal);
        x.sub.textContent = m.stat === 'maxStage' ? `${G.stageName(have)} / ${G.stageName(m.goal)}` : `${fmt(have)} / ${fmt(m.goal)}`;
        if (s.missions[m.id]) setBtn(x, ic('check'), '', false, 'done'); else setBtn(x, t('claim'), cost('gem', m.gems), G.missionDone(s, m), 'gem');
      });
      panel.append(x.r);
    }
  }

  function passCard() {
    const card = el('div', 'card pass'), head = el('div', 'card-head'), info = el('div', 'info');
    const title = el('div', 'name'), sub = el('div', 'sub'), bar = el('div', 'meter gold'), fill = el('div', 'meter-fill');
    bar.append(fill); info.append(title, sub);
    head.append(html('div', 'league', ic('star')), info);
    const track = el('div', 'pass-track');
    card.append(head, bar, track);
    const buy = el('button', 'btn cash wide');
    buy.onclick = () => purchase(PRODUCTS.find((p) => p.id === 'premium_pass'));
    card.append(buy);
    updaters.push(() => {
      const s = S(), tier = G.passTier(s), end = (G.passSeason(now()) + 1) * 30 * 86400e3;
      title.textContent = `${t('pass')} · ${t('tier_n', tier, PASS_TIERS)}`;
      sub.textContent = `${t('pass_d')} · ${t('ends_in', fmtTime((end - now()) / 1000))}`;
      fill.style.width = tier >= PASS_TIERS ? '100%' : ((s.pass.xp % PASS_XP) / PASS_XP) * 100 + '%';
      buy.hidden = s.pass.premium; buy.textContent = `${t('pass_premium')} · ${Monet.price('premium_pass')}`;
      const key = `${tier}:${s.pass.free.length}:${s.pass.prem.length}:${s.pass.premium}`;
      if (track._k === key) return;
      track._k = key; track.replaceChildren();
      for (let i = 0; i < PASS_TIERS; i++) {
        const col = el('div', 'pass-col' + (i < tier ? ' reached' : ''));
        col.append(el('span', 'pass-n', String(i + 1)));
        for (const premium of [false, true]) {
          const list = premium ? s.pass.prem : s.pass.free, done = list.includes(i);
          const can = i < tier && !done && (!premium || s.pass.premium);
          const b = html('button', 'pass-cell' + (premium ? ' prem' : '') + (done ? ' done' : '') + (can ? ' can' : ''), done ? ic('check') : packHtml(G.passReward(i, premium)));
          b.disabled = !can;
          b.onclick = () => { const r = G.claimPass(S(), i, premium); if (r) { sfx.reward(); toast(t('got')); app.save(); refresh(); } };
          col.append(b);
        }
        track.append(col);
      }
      const first = track.querySelector('.can') || track.children[Math.max(0, tier - 1)];
      if (first) requestAnimationFrame(() => { track.scrollLeft = Math.max(0, first.parentElement.offsetLeft - 40); });
    });
    panel.append(card);
  }

  async function purchase(p) {
    if (!Monet.storeAvailable()) { toast(t('store_off')); return; }
    if (!(await Monet.purchase(p.id))) return;
    G.grantProduct(S(), p, now());
    sfx.reward(); app.save(); refresh(); toast(t('purchase_ok'));
  }

  // ---------- schede ----------
  const kit = {
    app, S, now, panel, toast, openModal, closeTopModal, rewarded, adHtml, adIcon, row, setBtn, heading, seg, planeIcon,
    locked, timerButtons, fightModal,
    addUpdater: (fn) => updaters.push(fn), refresh: () => refresh(), render: () => render(), currentTab: () => tab,
    setTab: (id) => { tab = id; online.enter(id); render(); },
  };
  const squad = createSquadUI(kit);
  const progress = createProgressUI(kit);
  const online = createOnlineUI(kit);

  const TABS = [
    ['dungeon', 'skull', () => progress.tabDungeon(), 'thief'],
    ['work', 'anvil', tabWork, null],
    ['squad', 'drone', () => squad.tab(), 'maneuvers'],
    ['tech', 'blueprint', () => progress.tabTech(), 'tech1'],
    ['ally', 'shield', () => online.tabAlliance(), 'alliance'],
    ['shop', 'shop', tabShop, 'shop'],
  ];
  const VIEWS = { arena: () => online.tabArena() };

  function render() {
    const keep = panel.scrollTop;
    updaters = []; panel.replaceChildren();
    (VIEWS[tab] || TABS.find((x) => x[0] === tab)[2])();
    panel.scrollTop = render._tab === tab ? keep : 0;
    render._tab = tab;
    const nav = $('#tabs'); nav.replaceChildren();
    const s = S();
    for (const [id, icon, , lock] of TABS) {
      const isLocked = lock && !G.unlocked(s, lock);
      const b = el('button', (id === tab ? 'on' : '') + (isLocked ? ' locked' : ''));
      b.append(html('span', 'tab-ico', ic(isLocked ? 'lock' : icon)), el('span', 'tab-lbl', t('tab_' + id)), el('i', 'badge'));
      b.onclick = () => kit.setTab(id);
      b.dataset.tab = id;
      nav.append(b);
    }
    $('#tap-hint').textContent = t('tap_hint');
    refresh();
  }

  // ---------- aggiornamento periodico ----------
  function refresh() {
    const s = S(), n = now(), st = G.stats(s);
    $('#coins').textContent = fmt(s.coins);
    $('#gems').textContent = fmt(s.gems);
    $('#p-name').textContent = s.online.name || t('pilot');
    $('#power').innerHTML = `${ic('swords')} ${fmt(st.power)}`;
    const e = s.enemy, boss = e?.boss;
    $('#stage-name').textContent = `${boss ? t('boss') + ' · ' : ''}${t('stage')} ${G.stageName(s.stage)}`;
    const waves = WAVES.map((_, i) => `<i class="${i < s.wave ? 'w-done' : i === s.wave ? 'w-now' : ''}"></i>`).join('');
    if ($('#waves')._k !== waves) { $('#waves')._k = waves; $('#waves').innerHTML = waves; }
    $('#stage-info').textContent = boss ? s.bossTimer.toFixed(1) + 's' : s.farming ? t('farming') : '';
    $('#stagebar').classList.toggle('boss', !!boss);
    $('#hp-fill').style.width = (e ? Math.max(0, e.hp / e.maxHp) * 100 : 0) + '%';
    $('#hp-text').textContent = e ? `${fmt(Math.max(0, e.hp))} / ${fmt(e.maxHp)}` : '';
    const hp = Math.max(0, Math.min(s.hp || st.hp, st.hp));
    $('#sq-fill').style.width = (hp / st.hp) * 100 + '%';
    $('#squad-hp').classList.toggle('low', hp / st.hp < 0.3);
    $('#sq-text').textContent = `${fmt(hp)} / ${fmt(st.hp)}`;
    const bb = $('#btn-boss');
    bb.hidden = !s.farming;
    const label = G.isBoss(s.stage + 1) ? withIcon('skull', t('challenge')) : withIcon('takeoff', t('advance'));
    if (bb._l !== label) { bb._l = label; bb.innerHTML = label; }
    $('#tap-hint').hidden = s.stats.taps >= 3 || s.farming;
    skillBar(s, st, n);
    sideButtons(s, n);
    const badge = {
      work: s.pending.length > 0,
      shop: G.unlocked(s, 'shop') && (G.dailyAvailable(s, n) || G.claimableMissions(s) > 0),
      squad: squad.badge(), tech: progress.techBadge(), dungeon: progress.dungeonBadge(),
    };
    for (const b of $('#tabs').children) b.classList.toggle('has-badge', !!badge[b.dataset.tab]);
    for (const u of updaters) u();
    online.heartbeat();
  }

  function skillBar(s, st, n) {
    const box = $('#skills'), key = s.maneuvers.eq.join(',') + ':' + s.maneuvers.auto;
    if (box._k !== key) {
      box._k = key; box.replaceChildren();
      if (s.maneuvers.eq.length) {
        const auto = el('button', 'skill-auto' + (s.maneuvers.auto ? ' on' : ''), t('auto'));
        auto.onclick = (ev) => { ev.stopPropagation(); s.maneuvers.auto = !s.maneuvers.auto; app.save(); refresh(); };
        box.append(auto);
      }
      for (const id of s.maneuvers.eq) {
        const m = MANEUVERS.find((x) => x.id === id), b = html('button', 'skill', `${ic(squad.maneuverIcon(id))}<i class="cd"></i>`);
        b.style.setProperty('--r', RARITIES[m.r].color); b.dataset.id = id; b.setAttribute('aria-label', t('mv_' + id));
        b.onclick = (ev) => { ev.stopPropagation(); const out = []; if (G.cast(S(), id, Date.now(), out)) app.handle(out); };
        box.append(b);
      }
    }
    for (const b of box.querySelectorAll('.skill')) {
      const id = b.dataset.id, left = Math.max(0, ((s.cds[id] || 0) - n) / 1000), total = G.maneuverCooldown(s, st, id);
      b.style.setProperty('--cd', Math.min(1, left / total));
      b.classList.toggle('ready', left <= 0);
    }
  }

  function sideButtons(s, n) {
    const pass = $('#btn-pass'), arena = $('#btn-arena'), war = $('#btn-war');
    pass.hidden = !G.unlocked(s, 'pass');
    if (!pass.hidden) {
      pass.querySelector('span').textContent = `${G.passTier(s)}/${PASS_TIERS}`;
      const tier = G.passTier(s), claimable = Array.from({ length: tier }, (_, i) => i).some((i) => !s.pass.free.includes(i) || (s.pass.premium && !s.pass.prem.includes(i)));
      pass.classList.toggle('has-dot', claimable);
    }
    arena.hidden = !G.unlocked(s, 'arena');
    war.hidden = !G.unlocked(s, 'alliance');
    online.sideInfo(arena, war, n);
  }

  // ---------- finestre di gioco ----------
  function showOffline(secs, coins, wrenches) {
    const s = S();
    G.give(s, { coins, wrenches }); app.save();
    const body = el('div');
    body.append(el('p', '', t('offline_d', fmtTime(secs))), html('div', 'big-coins', packHtml({ coins, wrenches })));
    openModal({
      title: t('offline'), icon: 'moon', body,
      buttons: [
        { label: t('collect'), kind: 'ghost' },
        { label: t('double_it'), icon: adIcon(), kind: 'ad', onClick: () => rewarded(() => G.give(S(), { coins, wrenches })).then(() => true) },
      ],
    });
  }

  function showUnlock(key) {
    const tabFor = { thief: 'dungeon', ghost: 'dungeon', invasion: 'dungeon', swarm: 'dungeon', maneuvers: 'squad', drones: 'squad', emblems: 'squad',
      tech1: 'tech', alliance: 'ally', shop: 'shop', pass: 'shop', arena: 'arena' }[key];
    const text = t('ul_' + key);
    if (text === 'ul_' + key) return;
    toast(`${t('unlocked')}: ${text}`);
    if (tabFor && !modalCount) {
      openModal({
        title: text, icon: 'lock', body: t('uld_' + key),
        buttons: [{ label: t('close'), kind: 'ghost' }, { label: t('go'), onClick: () => kit.setTab(tabFor) }],
      });
    }
    render();
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
  $('#profile').onclick = showStats;
  $('#btn-chat').onclick = () => online.openChat();
  $('#btn-boss').onclick = (ev) => { ev.stopPropagation(); if (G.challengeBoss(S())) { sfx.boss(); refresh(); } };
  $('#btn-pass').onclick = (ev) => { ev.stopPropagation(); kit.setTab('shop'); };
  $('#btn-arena').onclick = (ev) => { ev.stopPropagation(); kit.setTab('arena'); };
  $('#btn-war').onclick = (ev) => { ev.stopPropagation(); kit.setTab('ally'); };

  return { render, refresh, toast, banner, showOffline, showUnlock, closeTopModal, flash, hasModal: () => modalCount > 0, squad, progress, online };
}
