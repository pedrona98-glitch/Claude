// Scheda Squadra: droni di scorta (casse), manovre (abilità) ed emblemi.
import * as G from './game.js';
import { DRONES, EMBLEMS, MANEUVERS, RARITIES, DRONE_MAX_LEVEL } from './data.js';
import { fmt, fmtTime } from './format.js';
import { t } from './i18n.js';
import { sfx } from './audio.js';
import { ic } from './icons.js';
import { el, html, cost, subText, rarityName } from './ui.js';

const MAN_ICONS = { hit: 'burst', heal: 'heart', shield: 'shield', haste: 'bolt', fury: 'flame' };
const byId = (list) => Object.fromEntries(list.map((x) => [x.id, x]));
const DRONE = byId(DRONES), EMBLEM = byId(EMBLEMS), MAN = byId(MANEUVERS);

export function createSquadUI(kit) {
  const { S, now, panel, toast, openModal, row, setBtn, heading, seg } = kit;
  let view = 'maneuvers';

  function rates(list) {
    const box = el('div', 'rates');
    list.forEach((p, i) => {
      if (!p) return;
      const r = el('span', 'rate'); r.style.setProperty('--r', RARITIES[i].color);
      r.textContent = `${rarityName(i)} ${p}%`;
      box.append(r);
    });
    return box;
  }

  function tab() {
    const s = S();
    if (!G.unlocked(s, 'maneuvers')) return kit.locked('maneuvers', t('squad_lock'));
    const opts = [['maneuvers', t('maneuvers')], ['drones', t('drones')], ['emblems', t('emblems')]];
    const top = el('div', 'bar');
    top.append(seg(opts, () => view, (v) => { view = v; kit.render(); }));
    panel.append(top);
    if (view === 'drones') return G.unlocked(s, 'drones') ? drones() : kit.locked('drones', t('drones_lock'));
    if (view === 'emblems') return G.unlocked(s, 'emblems') ? emblems() : kit.locked('emblems', t('emblems_lock'));
    return maneuvers();
  }

  // ---------- droni ----------
  function drones() {
    const s0 = S();
    panel.append(el('p', 'hint', t('drones_d', G.droneSlots(s0))));
    // casse in arrivo
    panel.append(heading(t('bay')));
    for (let i = 0; i < G.BAY_SIZE; i++) {
      const x = row({ icon: 'crate', title: '' });
      x.btn.onclick = () => {
        const s = S(), b = s.drones.bay[i];
        if (!b) return;
        if (b.end <= now()) {
          const r = G.openCrate(s, i, now());
          if (r) { sfx.reward(); kit.app.save(); toast(r.merged ? t('drone_merge', t('dr_' + r.id), r.lvl) : t('drone_new', t('dr_' + r.id))); kit.render(); }
        } else timerModal(i);
      };
      kit.addUpdater(() => {
        const s = S(), b = s.drones.bay[i];
        x.r.style.setProperty('--r', b ? RARITIES[b.r].color : 'transparent');
        if (!b) { x.name.textContent = t('bay_empty'); x.sub.textContent = t('bay_empty_d'); setBtn(x, '—', '', false, 'done'); return; }
        x.name.textContent = t('crate_of', rarityName(b.r));
        const left = (b.end - now()) / 1000;
        x.sub.textContent = left > 0 ? t('arrives_in', fmtTime(left)) : t('crate_ready');
        setBtn(x, left > 0 ? t('speed') : t('open'), '', true, left > 0 ? 'ghost' : 'ad');
      });
      panel.append(x.r);
    }
    // casse in magazzino
    const crates = s0.drones.crates;
    panel.append(heading(`${t('crates')} · ${crates.length}`));
    if (!crates.length) panel.append(el('p', 'hint', t('crates_none')));
    const counts = {};
    crates.forEach((r) => { counts[r] = (counts[r] || 0) + 1; });
    for (const r of Object.keys(counts).map(Number).sort((a, b) => b - a)) {
      const x = row({ icon: 'crate', title: `${t('crate_of', rarityName(r))} ×${counts[r]}`, color: RARITIES[r].color });
      x.sub.textContent = t('crate_time', fmtTime(G.crateSeconds(S(), r)));
      x.btn.onclick = () => { if (G.startCrate(S(), S().drones.crates.indexOf(r), now())) { sfx.buy(); kit.app.save(); kit.render(); } else toast(t('bay_full')); };
      kit.addUpdater(() => setBtn(x, t('send'), '', S().drones.bay.length < G.BAY_SIZE));
      panel.append(x.r);
    }
    // collezione
    const own = Object.keys(s0.drones.own).sort((a, b) => DRONE[b].r - DRONE[a].r || s0.drones.own[b] - s0.drones.own[a]);
    panel.append(heading(`${t('collection')} · ${own.length}/${DRONES.length}`));
    for (const id of own) {
      const d = DRONE[id], x = row({ iconEl: kit.planeIcon('drone', RARITIES[d.r].color), title: '', color: RARITIES[d.r].color });
      x.btn.onclick = () => { G.toggleDrone(S(), id); sfx.buy(); kit.app.save(); kit.render(); };
      kit.addUpdater(() => {
        const s = S(), st = G.droneStats(s, id), eq = s.drones.eq.includes(id), sub = s.drones.subs[id];
        x.name.textContent = `${t('dr_' + id)} · ${t('lvl')} ${s.drones.own[id]}${s.drones.own[id] >= DRONE_MAX_LEVEL ? ' ' + t('max') : ''}`;
        x.sub.textContent = `${rarityName(d.r)} · +${fmt(st.dmg)} ${t('stat_atk')} · +${fmt(st.hp)} ${t('stat_hp')}${sub ? ' · ' + subText(sub) : ''}`;
        setBtn(x, eq ? t('equipped') : t('equip'), '', true, eq ? 'done' : 'ghost');
      });
      panel.append(x.r);
    }
  }

  function timerModal(i) {
    const body = el('div');
    const left = el('div', 'big-coins');
    body.append(left, kit.timerButtons(i, () => (S().drones.bay[i] ? S().drones.bay[i].end : 0), () => { m.close(); kit.render(); }));
    const m = openModal({ title: t('crate_of', rarityName(S().drones.bay[i].r)), icon: 'crate', body, buttons: [{ label: t('close'), kind: 'ghost' }], onClose: () => clearInterval(iv) });
    const tickIt = () => { const b = S().drones.bay[i]; left.innerHTML = b ? `${ic('hourglass')} ${fmtTime((b.end - now()) / 1000)}` : ''; };
    tickIt();
    const iv = setInterval(tickIt, 400);
  }

  // ---------- manovre ----------
  function maneuvers() {
    const s0 = S();
    const card = el('div', 'card');
    const lvl = el('div', 'name'), bar = el('div', 'meter gold'), fill = el('div', 'meter-fill'); bar.append(fill);
    const btns = el('div', 'btn-row');
    for (const n of [1, 10]) {
      const b = html('button', 'btn primary', `<span>${t('recruit')} ×${n}</span>${cost('scroll', n)}`);
      b.onclick = () => {
        const got = G.summonManeuvers(S(), n);
        if (!got) { toast(t('no_plans')); return; }
        sfx.reward(); kit.app.save(); showSummon(got.map((g) => ({ name: t('mv_' + g.id), r: g.r, lvl: g.lvl, fresh: g.fresh, icon: maneuverIcon(g.id) })));
        kit.render();
      };
      kit.addUpdater(() => { b.disabled = S().plans < n; });
      btns.append(b);
    }
    card.append(lvl, bar, rates(G.maneuverRates(s0)), btns);
    kit.addUpdater(() => {
      const s = S();
      lvl.innerHTML = `${t('recruit_level', s.maneuvers.level)} · ${cost('scroll', s.plans)}`;
      fill.style.width = (s.maneuvers.count / 10) * 100 + '%';
    });
    panel.append(card, el('p', 'hint', t('maneuvers_d', G.maneuverSlots(s0))));
    const own = Object.keys(s0.maneuvers.own).sort((a, b) => MAN[b].r - MAN[a].r);
    panel.append(heading(`${t('collection')} · ${own.length}/${MANEUVERS.length}`));
    if (!own.length) panel.append(el('p', 'hint', t('maneuvers_none')));
    const st = G.stats(s0);
    for (const id of own) {
      const m = MAN[id], x = row({ icon: maneuverIcon(id), title: '', color: RARITIES[m.r].color });
      x.btn.onclick = () => { G.toggleManeuver(S(), id); sfx.buy(); kit.app.save(); kit.render(); };
      kit.addUpdater(() => {
        const s = S(), eq = s.maneuvers.eq.includes(id), k = G.maneuverPower(s, st, id);
        x.name.textContent = `${t('mv_' + id)} · ${t('lvl')} ${s.maneuvers.own[id]}`;
        x.sub.textContent = `${rarityName(m.r)} · ${effect(m, k)} · ${t('cooldown', Math.round(G.maneuverCooldown(s, st, id)))}`;
        setBtn(x, eq ? t('equipped') : t('equip'), '', true, eq ? 'done' : 'ghost');
      });
      panel.append(x.r);
    }
  }
  function effect(m, k) {
    if (m.kind === 'hit') return t('fx_hit', fmt(k * 100));
    if (m.kind === 'heal') return t('fx_heal', Math.round(m.k * (k / m.k) * 100));
    if (m.kind === 'shield') return t('fx_shield', k.toFixed(1));
    if (m.kind === 'haste') return t('fx_haste', Math.round(k * 100), m.dur);
    return t('fx_fury', Math.round(k * 100), m.dur);
  }
  const maneuverIcon = (id) => MAN_ICONS[MAN[id].kind];

  // ---------- emblemi ----------
  function emblems() {
    const s0 = S();
    const card = el('div', 'card');
    const lvl = el('div', 'name'), bar = el('div', 'meter gold'), fill = el('div', 'meter-fill'); bar.append(fill);
    const b = el('button', 'btn primary wide');
    b.onclick = () => {
      const got = G.summonEmblem(S());
      if (!got) { toast(t('no_paint')); return; }
      sfx.reward(); kit.app.save(); showSummon(got.map((g) => ({ name: t('em_' + g.id), r: g.r, lvl: g.lvl, fresh: g.fresh, icon: 'badge' })));
      kit.render();
    };
    card.append(lvl, bar, rates(G.emblemRates(s0)), b);
    kit.addUpdater(() => {
      const s = S(), need = G.emblemNext(s), c = G.emblemCost(s);
      lvl.innerHTML = `${t('recruit_level', s.emblems.level)} · ${cost('brush', s.paint)}`;
      fill.style.width = need ? Math.min(100, (s.emblems.count / need) * 100) + '%' : '100%';
      const m = `<span>${t('paint_emblem')}</span>${cost('brush', c)}`;
      if (b._l !== m) { b._l = m; b.innerHTML = m; }
      b.disabled = s.paint < c;
    });
    panel.append(card, el('p', 'hint', t('emblems_d')));
    const own = Object.keys(s0.emblems.own).sort((a, b2) => EMBLEM[b2].r - EMBLEM[a].r);
    panel.append(heading(`${t('collection')} · ${own.length}/${EMBLEMS.length}`));
    for (const id of own) {
      const e = EMBLEM[id], x = row({ icon: 'badge', title: '', color: RARITIES[e.r].color });
      x.btn.onclick = () => { G.equipEmblem(S(), id); sfx.buy(); kit.app.save(); kit.render(); };
      kit.addUpdater(() => {
        const s = S(), eq = s.emblems.eq === id, sub = s.emblems.subs[id];
        x.name.textContent = `${t('em_' + id)} · ${t('lvl')} ${s.emblems.own[id]}`;
        x.sub.textContent = `${rarityName(e.r)} · ${t('emblem_boost', Math.round(G.emblemBoost(s, id)))}${sub ? ' · ' + subText(sub) : ''}`;
        setBtn(x, eq ? t('equipped') : t('equip'), '', !eq, eq ? 'done' : 'ghost');
      });
      panel.append(x.r);
    }
  }

  function showSummon(list) {
    const box = el('div', 'summon');
    list.forEach((g, i) => {
      const c = html('div', 'summon-card' + (g.fresh ? ' fresh' : ''), `${ic(g.icon)}<b></b><span></span>`);
      c.style.setProperty('--r', RARITIES[g.r].color); c.style.animationDelay = i * 60 + 'ms';
      c.querySelector('b').textContent = g.name;
      c.querySelector('span').textContent = g.fresh ? t('new') : `${t('lvl')} ${g.lvl}`;
      box.append(c);
    });
    openModal({ title: t('recruited'), body: box, buttons: [{ label: t('close'), kind: 'ghost' }] });
  }

  function badge() {
    const s = S();
    if (!G.unlocked(s, 'maneuvers')) return false;
    return s.drones.bay.some((b) => b.end <= now()) || (s.drones.crates.length > 0 && s.drones.bay.length < G.BAY_SIZE) || s.plans >= 10 || (G.unlocked(s, 'emblems') && s.paint >= G.emblemCost(s));
  }

  return { tab, badge, open: (v) => { view = v; kit.setTab('squad'); }, emblemR: (id) => EMBLEM[id].r, maneuverIcon };
}
