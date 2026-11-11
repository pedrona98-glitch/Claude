// Schede Dungeon e Ricerca.
import * as G from './game.js';
import { DUNGEONS, TECH, DAILY_KEYS } from './data.js';
import { fmt, fmtTime } from './format.js';
import { t } from './i18n.js';
import { sfx } from './audio.js';
import { ic } from './icons.js';
import { el, html, cost, packHtml } from './ui.js';

const BRANCHES = ['forge', 'power', 'squad'];
const TECH_ICONS = {
  forgeTime: 'hourglass', forgeCost: 'coin', sellPrice: 'coin', freeForge: 'anvil', autoForge: 'refresh', thiefWrench: 'wrench', thiefCoin: 'coin',
  offlineTime: 'moon', offlineCoin: 'coin', offlineWrench: 'wrench', atkMastery: 'gun', hpMastery: 'heart', partLevel: 'armor', emblemAtk: 'badge',
  emblemHp: 'badge', emblemCost: 'brush', emblemExtra: 'badge', maneuverDmg: 'burst', maneuverCd: 'clock', droneAtk: 'drone', droneHp: 'drone',
  crateSpeed: 'crate', crateExtra: 'crate', planBonus: 'scroll',
};

export function createProgressUI(kit) {
  const { S, now, panel, toast, row, setBtn, heading, seg } = kit;
  let branch = 'forge';

  // ---------- dungeon ----------
  function tabDungeon() {
    const s0 = S();
    if (!G.unlocked(s0, 'thief')) return kit.locked('thief', t('dungeon_lock'));
    panel.append(el('p', 'hint', t('dungeon_d', DAILY_KEYS)));
    for (const d of DUNGEONS) {
      if (!G.unlocked(s0, d.id)) {
        const x = row({ icon: 'lock', title: t('dg_' + d.id), noBtn: true });
        x.r.classList.add('locked');
        x.sub.textContent = `${t('unlock_at', G.stageName(G.unlockStage(d.id)))} · ${t('dgr_' + d.id)}`;
        panel.append(x.r);
        continue;
      }
      const card = el('div', 'card dungeon');
      const head = el('div', 'card-head'), info = el('div', 'info'), name = el('div', 'name'), sub = el('div', 'sub');
      info.append(name, sub);
      head.append(html('div', 'league', ic(d.icon)), info);
      const reward = html('div', 'reward', '');
      const btns = el('div', 'btn-row');
      const fight = el('button', 'btn danger'), sweep = el('button', 'btn ghost');
      fight.onclick = () => run(d.id, false);
      sweep.onclick = () => run(d.id, true);
      btns.append(sweep, fight);
      card.append(head, reward, btns);
      kit.addUpdater(() => {
        const s = S(), best = s.dungeons[d.id], next = Math.min(100, best + 1), keys = s.keys[d.id];
        name.textContent = t('dg_' + d.id);
        sub.innerHTML = `${t('dgr_' + d.id)} · ${cost('key', keys)}`;
        const preview = G.dungeonReward(s, d.id, next, () => 0.5);
        const r = `<span class="sub">${t('reward')} ${G.dungeonName(next)}:</span> ${packHtml(preview)}`;
        if (reward._l !== r) { reward._l = r; reward.innerHTML = r; }
        const f = `<span>${t('fight')} ${G.dungeonName(next)}</span>`;
        if (fight._l !== f) { fight._l = f; fight.innerHTML = f; }
        fight.disabled = keys < 1 || best >= 100;
        const sw = `<span>${t('sweep')}${best ? ' ' + G.dungeonName(best) : ''}</span>`;
        if (sweep._l !== sw) { sweep._l = sw; sweep.innerHTML = sw; }
        sweep.disabled = keys < 1 || best < 1;
      });
      panel.append(card);
    }
    const buy = html('button', 'btn gem wide', `<span>${t('buy_keys')}</span>${cost('gem', 60)}`);
    buy.onclick = () => kit.setTab('shop');
    panel.append(buy);
  }

  function run(id, sweep) {
    const s = S(), next = s.dungeons[id] + 1, r = G.runDungeon(s, id, next, { sweep });
    if (!r) { toast(t('no_keys')); return; }
    kit.app.save(); kit.refresh();
    if (sweep) { sfx.reward(); toast(`${t('sweep')} ${G.dungeonName(r.level)} ✓`); kit.app.flushWar?.(); return; }
    kit.fightModal({
      me: s.online.name || t('pilot'), foe: `${t('dg_' + id)} ${G.dungeonName(next)}`, win: r.win, myLeft: r.myLeft, foeLeft: r.foeLeft,
      lines: r.win ? [packHtml(r.reward)] : [`<span class="sub">${t('dungeon_lost')}</span>`],
    });
  }

  function dungeonBadge() {
    const s = S();
    return DUNGEONS.some((d) => G.unlocked(s, d.id) && s.keys[d.id] > 0 && s.dungeons[d.id] > 0);
  }

  // ---------- ricerca ----------
  function tabTech() {
    const s0 = S();
    if (!G.unlocked(s0, 'tech1')) return kit.locked('tech1', t('tech_lock'));
    const top = el('div', 'bar');
    top.append(seg(BRANCHES.map((b) => [b, t('br_' + b)]), () => branch, (v) => { branch = v; kit.render(); }));
    panel.append(top);
    const card = el('div', 'card');
    const name = el('div', 'name'), sub = el('div', 'sub'), bar = el('div', 'meter gold'), fill = el('div', 'meter-fill'); bar.append(fill);
    card.append(name, sub, bar, kit.timerButtons('tech', () => (S().tech.active ? S().tech.active.end : 0), () => kit.render()));
    kit.addUpdater(() => {
      const s = S(), a = s.tech.active;
      card.classList.toggle('idle', !a);
      if (!a) { name.innerHTML = `${t('research_idle')} · ${cost('blueprint', s.blueprints)}`; sub.textContent = t('research_idle_d'); fill.style.width = '0%'; return; }
      const c = G.techCost(s, a.id) || { secs: 1 }, left = (a.end - now()) / 1000;
      name.textContent = `${t('tn_' + a.id)} → ${t('lvl')} ${G.techLv(s, a.id) + 1}`;
      sub.innerHTML = `${ic('hourglass')} ${fmtTime(left)} · ${cost('blueprint', s.blueprints)}`;
      fill.style.width = Math.max(0, Math.min(100, (1 - left / c.secs) * 100)) + '%';
    });
    panel.append(card);
    for (const n of TECH.filter((x) => x.branch === branch)) {
      const x = row({ icon: TECH_ICONS[n.id] || 'blueprint', title: '' });
      x.btn.onclick = () => {
        if (G.startTech(S(), n.id, now())) { sfx.buy(); kit.app.save(); kit.render(); }
        else if (S().tech.active) toast(t('research_busy'));
        else toast(t('no_blueprints'));
      };
      kit.addUpdater(() => {
        const s = S(), lv = G.techLv(s, n.id), c = G.techCost(s, n.id), max = n.perTier ? 5 : 25;
        x.name.textContent = `${t('tn_' + n.id)} · ${lv}/${max}`;
        x.sub.textContent = t('td_' + n.id, n.v, lv * n.v);
        if (!c) setBtn(x, t('max'), '', false, 'done');
        else if (!c.open) setBtn(x, ic('lock'), G.stageName(G.unlockStage(['tech1', 'tech2', 'tech3', 'tech4', 'tech5'][c.tier])), false, 'done');
        else setBtn(x, `${fmtTime(c.secs)}`, cost('blueprint', c.blueprints), !s.tech.active && s.blueprints >= c.blueprints);
      });
      panel.append(x.r);
    }
    if (!G.unlocked(s0, 'swarm')) panel.append(el('p', 'hint', t('blueprints_where', G.stageName(G.unlockStage('swarm')))));
  }

  function techBadge() {
    const s = S();
    return G.unlocked(s, 'tech1') && (!s.tech.active && s.blueprints >= 40);
  }

  return { tabDungeon, tabTech, dungeonBadge, techBadge };
}
