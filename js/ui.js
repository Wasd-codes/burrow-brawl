// Burrow Brawl — OSRS-styled UI layer.
import * as Data from './data.js';
import { Settings } from './settings.js';
import { Accounts } from './accounts.js';
import { CharPreview } from './preview.js';

const RARITY_ORDER = ['common', 'uncommon', 'rare', 'epic', 'legendary'];
const STARTERS = ['ninja_mole', 'wizard_hamster', 'antknight'];

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
function el(tag, cls, html) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html != null) e.innerHTML = html;
  return e;
}
function fmtTime(t) {
  t = Math.max(0, Math.floor(t || 0));
  const m = Math.floor(t / 60), s = t % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}
function fmtNum(n) {
  n = Math.round(n || 0);
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (n >= 1e4) return Math.round(n / 1e3) + 'K';
  return String(n);
}
function keyLabel(code) {
  if (!code) return '—';
  return String(code).replace(/^Key/, '').replace(/^Digit/, '').replace(/^Arrow/, '↑').replace('ShiftLeft', 'L-Shift').replace('Escape', 'Esc');
}
const STAT_LABELS = {
  maxHp: 'Max HP', hpRegen: 'HP Regen', armor: 'Armor', moveSpeed: 'Move Speed', damage: 'Damage',
  attackSpeed: 'Attack Speed', critChance: 'Crit Chance', critDamage: 'Crit Damage', area: 'Area',
  projectiles: 'Projectiles', pickupRange: 'Pickup Range', xpGain: 'XP Gain', luck: 'Luck', dodge: 'Dodge',
  lifesteal: 'Lifesteal', cooldown: 'Cooldown',
};
const PCT_STATS = new Set(['critChance', 'dodge', 'lifesteal']);
const MULT_STATS = new Set(['damage', 'attackSpeed', 'area', 'xpGain', 'cooldown', 'critDamage']);
function fmtStat(k, v) {
  if (typeof v !== 'number') return esc(v);
  if (PCT_STATS.has(k)) return (v <= 1 ? Math.round(v * 100) : Math.round(v)) + '%';
  if (MULT_STATS.has(k)) return 'x' + (Math.round(v * 100) / 100);
  return String(Math.round(v * 100) / 100);
}
function fmtDelta(k, v) {
  if (typeof v !== 'number') return `${STAT_LABELS[k] || k}: ${esc(v)}`;
  const sign = v >= 0 ? '+' : '';
  if (PCT_STATS.has(k) || MULT_STATS.has(k)) {
    const pct = Math.abs(v) <= 2 ? Math.round(v * 100) : Math.round(v);
    return `${sign}${pct}% ${STAT_LABELS[k] || k}`;
  }
  return `${sign}${Math.round(v * 100) / 100} ${STAT_LABELS[k] || k}`;
}
const statsLines = (stats) => Object.entries(stats || {}).map(([k, v]) => fmtDelta(k, v));

export class UI {
  constructor(root, game) {
    this.root = root || document.getElementById('ui') || document.body;
    this.game = game;
    this.modals = [];      // stack of {el, close, closable}
    this.hudVisible = false;
    this.sideTab = 'inv';
    this._lastState = null;
    this._chatLines = [];
    this._screen = null;

    this.dmgLayer = el('div', 'dmg-layer');
    this.dmgLayer.id = 'dmg-layer';
    this.tooltip = el('div', 'tooltip hidden');
    this.root.appendChild(this.dmgLayer);
    document.body.appendChild(this.tooltip);

    this._buildHUD();
    this.applySettings();
    Settings.onChange(() => this.applySettings());

    window.addEventListener('keydown', (e) => this._onKey(e), true);
    window.addEventListener('mousemove', (e) => this._moveTooltip(e));
  }

  // ---------------------------------------------------------------- settings
  applySettings() {
    const s = Settings.all();
    const rs = document.documentElement.style;
    rs.setProperty('--ui-scale', s.uiScale ?? 1);
    rs.setProperty('--chat-opacity', s.chatboxOpacity ?? 0.85);
    const ts = { small: .85, medium: 1, large: 1.2, xlarge: 1.4 }[s.textSize] ?? 1;
    rs.setProperty('--text-scale', ts);
    const b = document.body.classList;
    ['cb-protanopia', 'cb-deuteranopia', 'cb-tritanopia'].forEach((c) => b.remove(c));
    if (s.colorblindMode && s.colorblindMode !== 'off') b.add('cb-' + s.colorblindMode);
    b.toggle('reduced-motion', !!s.reducedMotion);
    b.toggle('high-contrast', !!s.highContrast);
    if (this.hud) {
      this.timerEl.classList.toggle('hidden', !s.showTimer);
      this.minimapFrame.classList.toggle('hidden', !s.minimap);
      this.chatbox.classList.toggle('hidden', s.showChatbox === false);
    }
    if (this._lastState) this.updateHUD(this._lastState);
  }

  rarityColor(r) {
    const v = getComputedStyle(document.body).getPropertyValue('--r-' + r).trim();
    return v || Data.RARITY?.[r]?.color || '#9d9d9d';
  }

  // ---------------------------------------------------------------- meta
  _meta() {
    let m = null;
    try { m = Accounts.loadMeta(); } catch (e) { /* */ }
    return m || this.game?.meta || {};
  }
  _unlockedChars() {
    const m = this._meta().unlockedCharacters;
    const base = (Data.CHARACTERS || []).filter((c) => c.unlocked).map((c) => c.id);
    return new Set([...(Array.isArray(m) ? m : []), ...(base.length ? base : STARTERS)]);
  }
  _secretProgress() {
    const ids = Object.keys(Data.ENEMIES || {}), db = this._meta().deathsBy || {};
    return [ids.filter((id) => db[id] > 0).length, ids.length];
  }
  // Secret characters show as '???' while locked.
  _disp(c, locked) {
    if (!c?.secret || !locked) return c;
    const [n, t] = this._secretProgress();
    return { ...c, name: '???', icon: '❔', desc: '???', unlockHint: `Secret: perish to every foe. (${n}/${t})`,
      passive: { name: '???', desc: '???' }, startWeapon: null, moves: [], baseStats: {} };
  }
  _unlockedStages() {
    const m = this._meta().unlockedStages;
    return new Set([0, ...(Array.isArray(m) ? m.map(Number) : [])]);
  }

  // ---------------------------------------------------------------- screens
  _setScreen(node) {
    this.hideTooltip?.();
    if (this._preview) { try { this._preview.dispose(); } catch (e) { /* */ } this._preview = null; }
    if (this._screenKey) { window.removeEventListener('keydown', this._screenKey, true); this._screenKey = null; }
    if (this._screen) this._screen.remove();
    this._screen = node;
    if (node) this.root.appendChild(node);
  }
  clearScreen() { this._setScreen(null); }

  showMainMenu() {
    this.closeAllModals();
    this.hideHUD();
    const scr = el('div', 'screen menu-bg');
    const p = el('div', 'osrs-panel main-menu pop-in');
    p.innerHTML = `
      <div id="game-logo" class="logo-slot"><div class="logo title-text">Burrow<br>Brawl</div></div>
      <div class="subtitle">Survive the horde. Slay the bosses.</div>`;
    p.appendChild(this._accountBar());
    const mk = (label, fn, cls = '') => { const b = el('button', 'osrs-btn ' + cls, esc(label)); b.onclick = fn; p.appendChild(b); return b; };
    mk('Play', () => this._charSelect());
    mk('Profile', () => this._showProfile());
    mk('Leaderboard', () => this._showLeaderboard());
    mk('Settings', () => this.showSettings(() => this.showMainMenu()));
    mk('Collection', () => this._showCollection());
    mk('Quit', () => {
      if (this.game?.quit) this.game.quit();
      else { try { window.close(); } catch (e) { /* */ } this.log('You can close this tab to quit.', '#ff981f'); }
    }, 'danger');
    const bt = Accounts.getStats().bestTimes || {};
    const best = this._meta().bestTime || Math.max(0, ...Object.values(bt).map(Number).filter(isFinite));
    p.appendChild(el('div', 'foot', best ? `Best survival: ${fmtTime(best)}` : 'Inspired by old-school adventures'));
    const lastId = this._lastCharId || (() => { try { return localStorage.getItem('bb_lastChar'); } catch (e) { return null; } })();
    const lastChar = (Data.CHARACTERS || []).find((c) => c.id === lastId) || (Data.CHARACTERS || []).find((c) => this._unlockedChars().has(c.id));
    scr.classList.add('main-with-ped');
    scr.appendChild(p);
    if (lastChar) {
      const ped = el('div', 'menu-pedestal');
      const cv = el('canvas', 'preview-canvas');
      ped.append(el('div', 'torch left'), el('div', 'torch right'), cv, el('div', 'ped-label', esc(lastChar.name)));
      scr.appendChild(ped);
      this._setScreen(scr);
      try { this._preview = new CharPreview(cv, { drag: true, autoRotate: 0.5 }); this._preview.setModel(lastChar.model || lastChar.id); } catch (e) { console.warn(e); }
      return;
    }
    this._setScreen(scr);
  }

  _charSelect() {
    const chars = Data.CHARACTERS || [];
    const unlocked = this._unlockedChars();
    const lastId = this._lastCharId || (() => { try { return localStorage.getItem('bb_lastChar'); } catch (e) { return null; } })();
    let sel = chars.find((c) => c.id === lastId && unlocked.has(c.id)) || chars.find((c) => unlocked.has(c.id)) || chars[0];
    const scr = el('div', 'screen menu-bg cs-screen');
    scr.innerHTML = '<div class="screen-title cs-title">Choose your Hero</div><div class="screen-sub cs-sub">Drag to rotate · A/D or ◀ ▶ to browse</div>';
    const left = el('div', 'osrs-panel cs-left pop-in');
    left.innerHTML = '<div class="panel-head">Brawlers</div>';
    const grid = el('div', 'osrs-inset cs-grid');
    left.appendChild(grid);
    const stage = el('div', 'cs-center');
    const cv = el('canvas', 'preview-canvas');
    const nameplate = el('div', 'cs-nameplate osrs-panel');
    const arrowL = el('button', 'osrs-btn cs-arrow left', '◀'), arrowR = el('button', 'osrs-btn cs-arrow right', '▶');
    stage.append(el('div', 'torch left'), el('div', 'torch right'), cv, arrowL, arrowR, nameplate);
    const right = el('div', 'osrs-panel cs-right pop-in');
    const detail = el('div', 'osrs-inset cs-detail');
    right.append(el('div', 'panel-head', 'Attributes'), detail);
    const bottom = el('div', 'cs-bottom');
    const back = el('button', 'osrs-btn', '◀ Back'); back.onclick = () => this.showMainMenu();
    const go = el('button', 'osrs-btn big cs-go', 'Select'); 
    bottom.append(back, go);
    scr.append(left, stage, right, bottom);

    let lastModel = null;
    const render = () => {
      this.hideTooltip();
      grid.innerHTML = '';
      chars.forEach((c) => {
        const locked = !unlocked.has(c.id);
        const real = c; c = this._disp(c, locked);
        const card = el('div', 'portrait' + (locked ? ' locked' : '') + (real === sel ? ' selected' : ''));
        card.innerHTML = `<div class="p-icon">${esc(c.icon || '🐾')}</div><div class="p-name">${esc(c.name)}</div>${locked ? '<div class="p-lock">🔒</div>' : ''}`;
        if (locked) this._bindTooltip(card, () => `<div class="tt-name orange">${esc(c.name)}</div><div class="red">Locked</div><div>${esc(c.unlockHint || 'Keep playing to unlock')}</div>`);
        card.onclick = () => { sel = real; render(); };
        card.ondblclick = () => { if (!locked) next(); };
        grid.appendChild(card);
      });
      if (!sel) { detail.innerHTML = '<span class="muted">No characters loaded.</span>'; return; }
      const locked = !unlocked.has(sel.id);
      const realSel = sel; sel = this._disp(sel, locked);
      stage.classList.toggle('locked', locked);
      go.disabled = locked;
      go.textContent = locked ? '🔒 Locked' : 'Select';
      nameplate.innerHTML = `<div class="np-name">${esc(sel.name)}</div><div class="np-sub">${locked ? `<span class="red">${esc(sel.unlockHint || 'Locked')}</span>` : esc(sel.passive?.name || '')}</div>`;
      const mk = sel.model || sel.id;
      const sil = !!(sel.secret && locked), mkKey = mk + (sil ? ':sil' : '');
      if (this._preview && mkKey !== lastModel) { this._preview.setModel(mk, { silhouette: sil }); lastModel = mkKey; }
      const wpn = Data.WEAPONS?.[sel.startWeapon];
      const abil = (sel.moves || []).map((id, i) => {
        const a = Data.ABILITIES?.[id];
        return `<div class="move"><span class="keycap">${i ? 'E' : 'Q'}</span><div><span class="orange">${esc(a?.icon || '')} ${esc(a?.name || id)}</span> <span class="muted">(${a?.cooldown ?? '?'}s)</span><div class="white">${esc(a?.desc || '')}</div></div></div>`;
      }).join('');
      const stats = Object.entries(sel.baseStats || {}).map(([k, v]) => `<div><span class="k">${STAT_LABELS[k] || k}</span><span class="v">${fmtStat(k, v)}</span></div>`).join('');
      detail.innerHTML = `
        <div class="cs-dname">${esc(sel.name)}</div>
        <div class="white cs-desc">${esc(sel.desc || '')}</div>
        <div class="sec-title">Passive</div>
        <div><span class="yellow">${esc(sel.passive?.name || '')}</span> — <span class="white">${esc(sel.passive?.desc || '')}</span>
          <div class="green">${statsLines(sel.passive?.stats).join(', ')}</div></div>
        <div class="sec-title">Starting weapon</div>
        <div>${esc(wpn?.icon || '')} <span class="yellow">${esc(wpn?.name || sel.startWeapon || '')}</span> <span class="muted">${esc(wpn?.desc || '')}</span></div>
        <div class="sec-title">Moves</div>${abil}
        <div class="sec-title">Base stats</div>
        <div class="stat-table cs-stats">${stats}</div>`;
      sel = realSel;
    };
    const cycle = (d) => { if (!chars.length) return; const i = chars.indexOf(sel); sel = chars[(i + d + chars.length) % chars.length]; render(); };
    arrowL.onclick = () => cycle(-1); arrowR.onclick = () => cycle(1);
    const next = () => {
      if (!sel || !unlocked.has(sel.id)) return;
      this._lastCharId = sel.id; try { localStorage.setItem('bb_lastChar', sel.id); } catch (e) { /* */ }
      this._stageSelect(sel.id);
    };
    go.onclick = next;
    this._setScreen(scr);
    this._screenKey = (e) => {
      if (this.modals.length || e.target?.tagName === 'INPUT') return;
      if (e.code === 'ArrowLeft' || e.code === 'KeyA') { cycle(-1); e.preventDefault(); }
      else if (e.code === 'ArrowRight' || e.code === 'KeyD') { cycle(1); e.preventDefault(); }
      else if (e.code === 'Enter' || e.code === 'Space') { next(); e.preventDefault(); }
      else if (e.code === 'Escape') { this.showMainMenu(); e.preventDefault(); }
    };
    window.addEventListener('keydown', this._screenKey, true);
    try { this._preview = new CharPreview(cv, { drag: true, autoRotate: 0.6 }); } catch (e) { console.warn('preview unavailable', e); }
    render();
  }

  _stageSelect(characterId) {
    const stages = Data.STAGES || [];
    const unlocked = this._unlockedStages();
    let sel = 0;
    const scr = el('div', 'screen menu-bg');
    const w = el('div', 'osrs-panel select-wrap pop-in');
    scr.innerHTML = '<div class="screen-title top">Choose a Stage</div>';
    const grid = el('div', 'card-grid');
    const detail = el('div', 'osrs-inset detail-pane');
    const render = () => {
      grid.innerHTML = '';
      stages.forEach((s, i) => {
        const locked = !unlocked.has(i);
        const card = el('div', 'card' + (locked ? ' locked' : '') + (i === sel ? ' selected' : ''));
        card.innerHTML = `<div class="big-icon">${esc(s.icon || ['🌲', '🏜️', '🍄', '🌋', '🏰'][i] || '🗺️')}</div>
          <div class="name">${i + 1}. ${esc(locked ? '???' : s.name)}</div>
          ${locked ? `<div class="lock-hint">Defeat stage ${i}'s boss to unlock</div>` : `<div class="desc">${i === 4 ? 'Final Stage' : ''}</div>`}`;
        card.onclick = () => { if (!locked) { sel = i; render(); } };
        card.ondblclick = () => { if (!locked) this._difficultySelect(characterId, i); };
        grid.appendChild(card);
      });
      const s = stages[sel];
      const boss = s && Data.BOSSES?.[s.boss];
      detail.innerHTML = s ? `<div class="orange" style="font-size:24px">${esc(s.name)}</div>
        <div class="white">${esc(s.desc || '')}</div>
        <div><span class="orange">Boss:</span> <span class="red">${esc(boss?.name || s.boss || '?')}</span> ${boss?.title ? `<span class="muted">${esc(boss.title)}</span>` : ''} — arrives at ${fmtTime(s.bossTime || 300)}</div>
        <div><span class="orange">Foes:</span> <span class="white">${(s.enemies || []).map((id) => esc(Data.ENEMIES?.[id]?.name || id)).join(', ')}</span></div>` : '<span class="muted">No stages loaded.</span>';
    };
    const nav = el('div', 'nav-row');
    const back = el('button', 'osrs-btn', '◀ Back'); back.onclick = () => this._charSelect();
    const go = el('button', 'osrs-btn', 'Next ▶'); go.onclick = () => this._difficultySelect(characterId, sel);
    nav.append(back, go);
    w.append(grid, detail, nav);
    scr.appendChild(w);
    this._setScreen(scr);
    render();
  }

  _difficultySelect(characterId, stageIndex) {
    const diffs = Data.DIFFICULTIES || [{ id: 'normal', name: 'Normal', desc: '' }];
    let sel = diffs.find((d) => d.id === 'normal') || diffs[0];
    const scr = el('div', 'screen menu-bg');
    const w = el('div', 'osrs-panel select-wrap pop-in');
    scr.innerHTML = '<div class="screen-title top">Choose Difficulty</div>';
    const grid = el('div', 'card-grid');
    const colors = { easy: 'green', normal: 'yellow', hard: 'orange', nightmare: 'red', endless_hell: 'red' };
    const render = () => {
      grid.innerHTML = '';
      diffs.forEach((d) => {
        const card = el('div', 'card' + (d === sel ? ' selected' : ''));
        card.innerHTML = `<div class="name ${colors[d.id] || ''}">${esc(d.name)}</div><div class="desc">${esc(d.desc || '')}</div>
          <div class="desc muted">HP x${d.enemyHp ?? 1} · Dmg x${d.enemyDmg ?? 1} · Spawns x${d.spawnRate ?? 1}<br>XP x${d.xpMult ?? 1} · Gold x${d.goldMult ?? 1}</div>`;
        card.onclick = () => { sel = d; render(); };
        card.ondblclick = start;
        grid.appendChild(card);
      });
    };
    const start = () => {
      this.clearScreen();
      this.game?.startRun?.({ characterId, stageIndex, difficultyId: sel.id });
    };
    const nav = el('div', 'nav-row');
    const back = el('button', 'osrs-btn', '◀ Back'); back.onclick = () => this._stageSelect(characterId);
    const go = el('button', 'osrs-btn', '⚔ Brawl!'); go.onclick = start;
    nav.append(back, go);
    w.append(grid, nav);
    scr.appendChild(w);
    this._setScreen(scr);
    render();
  }

  // ---------------------------------------------------------------- accounts
  _accountBar() {
    const bar = el('div', 'account-bar osrs-inset');
    const cur = Accounts.current();
    const guest = !cur || cur.guest;
    bar.innerHTML = `<span class="muted">Logged in as</span> <span class="${guest ? 'white' : 'yellow'} acct-name">${esc(cur?.username || 'Guest')}</span>`;
    const b = (t, fn, cls = '') => { const x = el('button', 'osrs-btn small ' + cls, t); x.onclick = fn; bar.appendChild(x); };
    if (guest) { b('Login', () => this._showAuth('login')); b('Register', () => this._showAuth('register')); }
    else b('Logout', () => { Accounts.logout(); this.log('You have logged out.', '#ff981f'); this.showMainMenu(); }, 'danger');
    return bar;
  }

  _showAuth(mode = 'login') {
    const box = el('div', 'auth-box');
    const render = () => {
      box.innerHTML = `<h2>${mode === 'login' ? 'Login' : 'Create Account'}</h2>
        <div class="muted" style="font-size:15px;margin-bottom:8px">Accounts are stored only in this browser.</div>
        <label class="auth-row"><span class="orange">Username:</span><input class="osrs-input" name="u" maxlength="16" autocomplete="username"></label>
        <label class="auth-row"><span class="orange">Password:</span><input class="osrs-input" name="p" type="password" autocomplete="${mode === 'login' ? 'current-password' : 'new-password'}"></label>
        ${mode === 'register' ? '<label class="auth-row"><span class="orange">Confirm:</span><input class="osrs-input" name="c" type="password" autocomplete="new-password"></label>' : ''}
        <div class="flash-msg auth-err"></div>`;
      const nav = el('div', 'nav-row');
      const sw = el('button', 'osrs-btn small', mode === 'login' ? 'New user? Register' : 'Have an account? Login');
      sw.onclick = () => { mode = mode === 'login' ? 'register' : 'login'; render(); };
      const go = el('button', 'osrs-btn', mode === 'login' ? 'Login' : 'Register');
      nav.append(sw, go); box.appendChild(nav);
      const q = (n) => box.querySelector(`[name="${n}"]`);
      const err = box.querySelector('.auth-err');
      const submit = async () => {
        const u = q('u').value, pw = q('p').value;
        if (mode === 'register' && pw !== q('c').value) { err.textContent = 'Passwords do not match.'; return; }
        go.disabled = true;
        const r = mode === 'login' ? await Accounts.login(u, pw) : await Accounts.register(u, pw);
        go.disabled = false;
        if (!r.ok) { err.textContent = r.error || 'Failed.'; return; }
        this.log(`Welcome${mode === 'register' ? '' : ' back'}, ${Accounts.current().username}.`, '#ffff00');
        m.close(); this.showMainMenu();
      };
      go.onclick = submit;
      box.querySelectorAll('input').forEach((i) => i.addEventListener('keydown', (e) => { if (e.key === 'Enter') submit(); e.stopPropagation(); }));
      setTimeout(() => q('u')?.focus(), 0);
    };
    const m = this._openModal(box, { closable: true, pause: false });
    render();
    return m;
  }

  _stageName(i) { const s = Data.STAGES?.[i]; return s ? `${Number(i) + 1}. ${s.name}` : (i == null ? '—' : `Stage ${Number(i) + 1}`); }
  _charName(id) { return (Data.CHARACTERS || []).find((c) => c.id === id)?.name || id || '—'; }
  _diffName(id) { return Data.DIFFICULTIES?.find((d) => d.id === id)?.name || id || '—'; }

  _showProfile() {
    const cur = Accounts.current();
    const st = Accounts.getStats();
    const scr = el('div', 'screen menu-bg');
    const w = el('div', 'osrs-panel select-wrap pop-in');
    w.innerHTML = `<h2>${esc(cur?.username || 'Guest')}'s Adventure Log</h2>
      <div class="muted center-text">${cur?.guest ? 'Playing as Guest — register to keep a named record.' : 'Member since ' + esc(new Date(cur?.createdAt || Date.now()).toLocaleDateString())}</div>`;
    const body = el('div', 'osrs-inset settings-body profile-body');
    const rows = [['Runs', st.runs], ['Victories', st.victories], ['Deaths', st.deaths], ['Quits', st.quits || 0],
      ['Stages Cleared', st.stagesCleared], ['Bosses Slain', st.bossesKilled], ['Total Kills', fmtNum(st.kills)],
      ['Time Played', fmtTime(st.timePlayed)], ['Gold Earned', fmtNum(st.gold)], ['Damage Dealt', fmtNum(st.damageDealt)],
      ['Highest Level', st.highestLevel], ['Best Score', fmtNum(st.bestScore || 0)], ['Fallen to', (([n, t]) => `${n}/${t} foe types`)(this._secretProgress())]];
    let html = `<div class="sec-title">Lifetime Stats</div><div class="summary-grid">${rows.map(([k, v]) => `<span class="k">${k}</span><span class="v">${esc(v ?? 0)}</span>`).join('')}</div>`;
    const chars = Data.CHARACTERS || [];
    html += `<div class="sec-title">Characters</div><table class="lb-table"><tr><th>Character</th><th>Runs</th><th>Best Time</th></tr>${
      chars.filter((c) => !c.secret || this._unlockedChars().has(c.id)).map((c) => `<tr><td>${esc(c.icon || '')} ${esc(c.name)}</td><td>${st.characterRuns?.[c.id] || 0}</td><td>${st.characterBest?.[c.id] ? fmtTime(st.characterBest[c.id]) : '—'}</td></tr>`).join('')}</table>`;
    html += `<div class="sec-title">Best Times by Stage</div><table class="lb-table"><tr><th>Stage</th><th>Best Time</th></tr>${
      (Data.STAGES || []).map((s, i) => `<tr><td>${esc(this._stageName(i))}</td><td>${st.bestTimes?.[i] ? fmtTime(st.bestTimes[i]) : '—'}</td></tr>`).join('')}</table>`;
    body.innerHTML = html;
    const nav = el('div', 'nav-row');
    const back = el('button', 'osrs-btn', '◀ Back'); back.onclick = () => this.showMainMenu();
    const lb = el('button', 'osrs-btn', 'Leaderboard ▶'); lb.onclick = () => this._showLeaderboard();
    nav.append(back, lb);
    w.append(body, nav); scr.appendChild(w); this._setScreen(scr);
  }

  _showLeaderboard() {
    const me = Accounts.current()?.username;
    let cat = 'score';
    const filter = { stage: '', difficulty: '', character: '' };
    const scr = el('div', 'screen menu-bg');
    const w = el('div', 'osrs-panel select-wrap pop-in');
    w.innerHTML = '<h2>Hiscores</h2>';
    const tabs = el('div', 'settings-tabs');
    const filters = el('div', 'lb-filters');
    const mkSel = (key, label, opts) => {
      const s = el('select'); s.innerHTML = `<option value="">All ${label}</option>` + opts.map(([v, t]) => `<option value="${esc(v)}">${esc(t)}</option>`).join('');
      s.onchange = () => { filter[key] = s.value; render(); };
      filters.appendChild(s);
    };
    mkSel('stage', 'Stages', (Data.STAGES || []).map((s, i) => [i, this._stageName(i)]));
    mkSel('difficulty', 'Difficulties', (Data.DIFFICULTIES || []).map((d) => [d.id, d.name]));
    mkSel('character', 'Characters', (Data.CHARACTERS || []).map((c) => [c.id, c.name]));
    const body = el('div', 'osrs-inset settings-body');
    const endTxt = { death: '☠ Died', quit: 'Quit', victory: '★ Victory', nextStage: '⇩ Descended' };
    const render = () => {
      tabs.innerHTML = '';
      [['score', 'Score'], ['time', 'Time'], ['kills', 'Kills'], ['level', 'Level']].forEach(([k, t]) => {
        const b = el('button', 'osrs-btn small' + (k === cat ? ' on' : ''), t); b.onclick = () => { cat = k; render(); }; tabs.appendChild(b);
      });
      const f = { stage: filter.stage === '' ? undefined : Number(filter.stage), difficulty: filter.difficulty || undefined, character: filter.character || undefined };
      const list = Accounts.leaderboard(cat, f);
      if (!list.length) { body.innerHTML = '<div class="muted center-text">No runs recorded yet.</div>'; return; }
      body.innerHTML = `<table class="lb-table"><tr><th>#</th><th>Player</th><th>Character</th><th>Stage</th><th>Difficulty</th><th>Score</th><th>Time</th><th>Kills</th><th>Lvl</th><th>Result</th><th>Date</th></tr>${
        list.map((r, i) => `<tr class="${r.username === me ? 'me' : ''}"><td>${i + 1}</td><td>${esc(r.username)}</td><td>${esc(this._charName(r.character))}</td><td>${esc(this._stageName(r.stage))}</td><td>${esc(this._diffName(r.difficulty))}</td>
          <td class="${cat === 'score' ? 'yellow' : ''}">${fmtNum(r.score)}</td><td class="${cat === 'time' ? 'yellow' : ''}">${fmtTime(r.time)}</td><td class="${cat === 'kills' ? 'yellow' : ''}">${fmtNum(r.kills)}</td><td class="${cat === 'level' ? 'yellow' : ''}">${r.level}</td>
          <td>${esc(endTxt[r.endedBy] || r.endedBy || '')}</td><td class="muted">${esc(new Date(r.date).toLocaleDateString())}</td></tr>`).join('')}</table>`;
    };
    const nav = el('div', 'nav-row');
    const back = el('button', 'osrs-btn', '◀ Back'); back.onclick = () => this.showMainMenu();
    nav.append(back, el('span', 'muted', `Your rows are highlighted (${esc(me || 'Guest')})`));
    w.append(tabs, filters, body, nav); scr.appendChild(w); this._setScreen(scr);
    render();
  }

  _showCollection() {
    const scr = el('div', 'screen menu-bg');
    const w = el('div', 'osrs-panel select-wrap pop-in');
    w.innerHTML = '<h2>Collection Log</h2>';
    const tabs = el('div', 'settings-tabs');
    const body = el('div', 'osrs-inset settings-body');
    const unlocked = this._unlockedChars();
    const seen = this._meta();
    const sections = {
      Characters: () => (Data.CHARACTERS || []).filter((c) => !c.secret || unlocked.has(c.id)).map((c) => {
        const l = !unlocked.has(c.id);
        return `<div class="codex-entry" ${l ? 'style="filter:grayscale(1) brightness(.6)"' : ''}><div class="h"><span class="ic">${esc(c.icon || '🐾')}</span><span class="orange">${esc(c.name)}</span></div>
          <div class="d">${l ? '🔒 ' + esc(c.unlockHint || '') : esc(c.desc || '') + '<br><span class="green">' + esc(c.passive?.name || '') + ': ' + esc(c.passive?.desc || '') + '</span>'}</div></div>`;
      }),
      Items: () => [...(Data.ITEMS || [])].sort((a, b) => RARITY_ORDER.indexOf(a.rarity) - RARITY_ORDER.indexOf(b.rarity)).map((it) =>
        `<div class="codex-entry rar-${esc(it.rarity)}"><div class="h"><span class="ic">${esc(it.icon)}</span><span class="rt-${esc(it.rarity)}">${esc(it.name)}</span></div>
         <div class="d">${esc(it.desc || '')}<br><span class="green">${statsLines(it.stats).join(', ')}</span></div></div>`),
      Weapons: () => Object.entries(Data.WEAPONS || {}).map(([id, wp]) =>
        `<div class="codex-entry"><div class="h"><span class="ic">${esc(wp.icon)}</span><span class="orange">${esc(wp.name)}</span></div><div class="d">${esc(wp.desc || '')} <span class="muted">(${esc(wp.type)})</span></div></div>`),
      Runes: () => (Data.RUNES || []).map((r) =>
        `<div class="codex-entry"><div class="h"><span class="ic">${esc(r.icon)}</span><span style="color:${esc(r.color || '#fff')}">${esc(r.name)}</span></div><div class="d">${esc(r.desc || '')} <span class="muted">${r.kind === 'temporary' ? `(${r.duration}s)` : '(permanent)'}</span></div></div>`),
      Enemies: () => Object.entries(Data.ENEMIES || {}).map(([id, e]) =>
        `<div class="codex-entry"><div class="h"><span class="ic" style="color:${esc(e.color)}">●</span><span class="orange">${esc(e.name)}</span></div><div class="d">${esc(e.desc || '')}<br><span class="muted">HP ${e.hp} · Dmg ${e.damage} · ${esc(e.behavior)}</span></div></div>`),
      Bosses: () => Object.entries(Data.BOSSES || {}).map(([id, e]) =>
        `<div class="codex-entry rar-legendary"><div class="h"><span class="ic">💀</span><span class="red">${esc(e.name)}</span></div><div class="d"><span class="orange">${esc(e.title || '')}</span><br>${esc(e.desc || '')}<br><span class="muted">HP ${e.hp} · ${(e.attacks || []).join(', ')}</span></div></div>`),
    };
    let cur = 'Characters';
    const render = () => {
      tabs.innerHTML = '';
      Object.keys(sections).forEach((k) => {
        const b = el('button', 'osrs-btn small' + (k === cur ? ' on' : ''), k);
        b.onclick = () => { cur = k; render(); };
        tabs.appendChild(b);
      });
      body.innerHTML = `<div class="codex-list">${sections[cur]().join('') || '<span class="muted">Nothing here yet.</span>'}</div>`;
    };
    const nav = el('div', 'nav-row');
    const back = el('button', 'osrs-btn', '◀ Back'); back.onclick = () => this.showMainMenu();
    nav.append(back, el('span', 'muted', seen.bestTime ? `Best time ${fmtTime(seen.bestTime)}` : ''));
    w.append(tabs, body, nav);
    scr.appendChild(w);
    this._setScreen(scr);
    render();
  }

  // ---------------------------------------------------------------- settings screen
  showSettings(onClose) {
    let cur = Settings.SCHEMA[0]?.group;
    let listening = null;
    const wrap = el('div', 'osrs-panel settings-wrap pop-in');
    const tabs = el('div', 'settings-tabs');
    const body = el('div', 'osrs-inset settings-body');
    const render = () => {
      tabs.innerHTML = '';
      Settings.SCHEMA.forEach((g) => {
        const b = el('button', 'osrs-btn small' + (g.group === cur ? ' on' : ''), esc(g.group));
        b.onclick = () => { cur = g.group; listening = null; render(); };
        tabs.appendChild(b);
      });
      body.innerHTML = '';
      const g = Settings.SCHEMA.find((x) => x.group === cur);
      (g?.items || []).forEach((it) => body.appendChild(this._settingRow(it, (btn) => { listening = btn; })));
    };
    const footer = el('div', 'nav-row');
    const reset = el('button', 'osrs-btn danger', 'Reset Defaults');
    reset.onclick = () => { Settings.reset(); render(); this.log('Settings reset to defaults.', '#ff981f'); };
    const done = el('button', 'osrs-btn', 'Done');
    footer.append(reset, done);
    wrap.innerHTML = '<h2>Settings</h2>';
    wrap.append(tabs, body, footer);
    const m = this._openModal(wrap, { closable: true, onClose, pause: !!this.hudVisible, isListening: () => body.querySelector('.listening') });
    done.onclick = () => m.close();
    render();
    return m;
  }

  _settingRow(it, setListening) {
    const row = el('div', 'set-row');
    row.appendChild(el('label', '', esc(it.label)));
    const ctl = el('div', 'ctl');
    const val = Settings.get(it.key);
    if (it.type === 'slider') {
      const inp = el('input'); inp.type = 'range';
      inp.min = it.min; inp.max = it.max; inp.step = it.step ?? 1; inp.value = val;
      const out = el('span', 'val');
      const show = (v) => { out.textContent = (it.max <= 2 && it.min >= 0 && it.max - it.min <= 2 && it.step < 1) ? Math.round(v * 100) + '%' : v; };
      show(val);
      inp.oninput = () => { const v = parseFloat(inp.value); show(v); Settings.set(it.key, v); };
      ctl.append(inp, out);
    } else if (it.type === 'toggle') {
      const t = el('div', 'toggle' + (val ? ' on' : '') + (it.locked ? ' disabled' : ''));
      t.title = it.locked ? 'Always on' : '';
      t.onclick = () => { if (it.locked) return; const nv = !Settings.get(it.key); Settings.set(it.key, nv); t.classList.toggle('on', nv); };
      ctl.append(t);
    } else if (it.type === 'select') {
      const s = el('select');
      (it.options || []).forEach((o, i) => {
        const op = el('option', '', esc(it.labels?.[i] ?? o));
        op.value = String(o); if (String(o) === String(val)) op.selected = true;
        s.appendChild(op);
      });
      s.onchange = () => {
        const raw = it.options.find((o) => String(o) === s.value);
        Settings.set(it.key, raw);
      };
      ctl.append(s);
    } else if (it.type === 'keybind') {
      const b = el('button', 'osrs-btn small keybind-btn', esc(keyLabel(val)));
      b.onclick = () => {
        b.classList.add('listening'); b.textContent = 'Press a key…';
        setListening(b);
        const handler = (e) => {
          e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
          window.removeEventListener('keydown', handler, true);
          b.classList.remove('listening');
          if (e.code !== 'Backspace' || it.key === 'keybinds.pause') {
            Settings.set(it.key, e.code);
          }
          b.textContent = keyLabel(Settings.get(it.key));
        };
        setTimeout(() => window.addEventListener('keydown', handler, true), 0);
      };
      ctl.append(b);
    }
    row.appendChild(ctl);
    return row;
  }

  // ---------------------------------------------------------------- modal framework
  _openModal(content, { closable = true, onClose = null, pause = true, isListening = null } = {}) {
    const bd = el('div', 'modal-backdrop');
    if (!content.classList.contains('settings-wrap')) content.classList.add('osrs-panel', 'modal', 'pop-in');
    bd.appendChild(content);
    if (closable) {
      const x = el('div', 'close-x', '×');
      x.onclick = () => m.close();
      content.appendChild(x);
    }
    this.root.appendChild(bd);
    let paused = false;
    if (pause && this.game?.pause) { this.game.pause(); paused = true; }
    let closed = false;
    const m = {
      el: content, backdrop: bd, closable, isListening,
      close: (...args) => {
        if (closed) return; closed = true;
        bd.remove();
        this.hideTooltip();
        const i = this.modals.indexOf(m); if (i >= 0) this.modals.splice(i, 1);
        if (paused) this.game?.resume?.();
        if (onClose) onClose(...args);
      },
      keyHandler: null,
    };
    this.modals.push(m);
    return m;
  }
  isModalOpen() { return this.modals.length > 0; }
  closeAllModals() { [...this.modals].reverse().forEach((m) => m.close()); }

  _onKey(e) {
    const top = this.modals[this.modals.length - 1];
    if (!top) return;
    if (top.isListening && top.isListening()) return;
    if (top.keyHandler && top.keyHandler(e) === true) { e.preventDefault(); e.stopImmediatePropagation(); return; }
    if (e.code === 'Escape' && top.closable) {
      e.preventDefault(); e.stopImmediatePropagation();
      top.close();
    }
  }

  // ---------------------------------------------------------------- HUD
  _buildHUD() {
    const h = el('div', 'hidden'); h.id = 'hud';
    h.innerHTML = `
      <div class="hud-xpbar"><div id="hud-xpfill" style="width:0%"></div></div>
      <div class="hud-topleft osrs-panel">
        <div class="line"><span class="orange">Level</span><span id="hud-level" class="white">1</span></div>
        <div class="line"><span class="orange">Kills</span><span id="hud-kills" class="white">0</span></div>
        <div class="line"><span class="orange">Gold</span><span id="hud-gold" class="yellow">0</span></div>
        <div class="line"><span class="orange">Stage</span><span id="hud-stage" class="white">1</span></div>
        <div class="line hidden" id="hud-enemies-line"><span class="orange">Foes</span><span id="hud-enemies" class="white">0</span></div>
      </div>
      <div class="hud-buffs" id="hud-buffs"></div>
      <div class="hud-timer" id="hud-timer">0:00</div>
      <div class="boss-bar osrs-panel hidden" id="hud-boss"><div class="bname" id="hud-boss-name"></div>
        <div class="track"><div class="fill" id="hud-boss-fill"></div><div class="num" id="hud-boss-num"></div></div></div>
      <div class="hud-topright">
        <div class="orbs">
          <div class="orb-wrap"><div class="orb hp"><div class="liquid" id="orb-hp"></div><div class="icon">❤</div></div><span class="orb-val" id="orb-hp-val">100</span></div>
          <div class="orb-wrap"><div class="orb xp"><div class="liquid" id="orb-xp"></div><div class="icon">★</div></div><span class="orb-val cyan" id="orb-xp-val">0%</span></div>
          <div class="orb-wrap"><div class="orb gold"><div class="liquid" style="height:100%"></div><div class="icon">●</div></div><span class="orb-val yellow" id="orb-gold-val">0</span></div>
        </div>
        <div class="minimap-frame" id="minimap-frame"><canvas id="minimap" width="160" height="160"></canvas><div class="compass">N</div></div>
      </div>
      <div class="hud-stats-mini" id="hud-mini"></div>
      <div class="hud-abilities osrs-panel" id="hud-abilities"></div>
      <div class="chatbox" id="chatbox"><div class="chat-log" id="chat-log"></div>
        <div class="chat-tabs"><span class="on">All</span><span>Game</span><span>Loot</span></div></div>
      <div class="side-panel osrs-panel" id="side-panel">
        <div class="side-tabs" id="side-tabs"></div>
        <div class="side-body osrs-inset" id="side-body"></div>
      </div>`;
    this.root.insertBefore(h, this.dmgLayer);
    this.hud = h;
    const q = (id) => h.querySelector('#' + id);
    Object.assign(this, {
      xpFill: q('hud-xpfill'), levelEl: q('hud-level'), killsEl: q('hud-kills'), goldEl: q('hud-gold'),
      stageEl: q('hud-stage'), enemiesLine: q('hud-enemies-line'), enemiesEl: q('hud-enemies'),
      buffsEl: q('hud-buffs'), timerEl: q('hud-timer'), bossEl: q('hud-boss'), bossName: q('hud-boss-name'),
      bossFill: q('hud-boss-fill'), bossNum: q('hud-boss-num'), orbHp: q('orb-hp'), orbHpVal: q('orb-hp-val'),
      orbXp: q('orb-xp'), orbXpVal: q('orb-xp-val'), orbGoldVal: q('orb-gold-val'), minimapFrame: q('minimap-frame'),
      minimap: q('minimap'), miniEl: q('hud-mini'), abilitiesEl: q('hud-abilities'), chatbox: q('chatbox'),
      chatLog: q('chat-log'), sideTabs: q('side-tabs'), sideBody: q('side-body'),
    });
    const tabs = [['inv', '🎒', 'Inventory'], ['stats', '📊', 'Stats'], ['wpn', '⚔', 'Weapons'], ['runes', '🔮', 'Runes & Buffs']];
    tabs.forEach(([id, icon, title]) => {
      const t = el('div', 'side-tab' + (id === this.sideTab ? ' on' : ''), icon);
      t.title = title; t.dataset.tab = id;
      t.onclick = () => { this.sideTab = id; [...this.sideTabs.children].forEach((c) => c.classList.toggle('on', c.dataset.tab === id)); this._renderSide(true); };
      this.sideTabs.appendChild(t);
    });
    this.log('Welcome to Burrow Brawl.', '#000');
  }

  showHUD() { this.clearScreen(); this.hud.classList.remove('hidden'); this.hudVisible = true; this.applySettings(); }
  hideHUD() { this.hud?.classList.add('hidden'); this.hudVisible = false; this.hideTooltip(); }

  updateHUD(st) {
    if (!st) return;
    this._lastState = st;
    if (!this.hudVisible) return;
    const s = Settings.all();
    const hpPct = Math.max(0, Math.min(1, (st.hp || 0) / (st.maxHp || 1)));
    const xpPct = Math.max(0, Math.min(1, (st.xp || 0) / (st.xpNext || 1)));
    this.xpFill.style.width = (xpPct * 100).toFixed(1) + '%';
    this.orbHp.style.height = (hpPct * 100) + '%';
    this.orbHpVal.textContent = Math.ceil(st.hp || 0);
    this.orbHpVal.style.color = hpPct < 0.25 ? 'var(--red)' : hpPct < 0.5 ? 'var(--orange)' : 'var(--green)';
    this.orbXp.style.height = (xpPct * 100) + '%';
    this.orbXpVal.textContent = Math.floor(xpPct * 100) + '%';
    this.orbGoldVal.textContent = fmtNum(st.gold);
    this.levelEl.textContent = st.level ?? 1;
    this.killsEl.textContent = fmtNum(st.kills);
    this.goldEl.textContent = fmtNum(st.gold);
    const stName = Data.STAGES?.[st.stage]?.name;
    this.stageEl.textContent = (typeof st.stage === 'number' ? st.stage + 1 : st.stage ?? 1) + (st.loop ? ` (Loop ${st.loop})` : '');
    if (stName) this.stageEl.title = stName;
    this.enemiesLine.classList.toggle('hidden', !s.showEnemyCount);
    if (s.showEnemyCount) this.enemiesEl.textContent = st.enemies ?? st.enemyCount ?? 0;
    this.timerEl.classList.toggle('hidden', !s.showTimer);
    this.timerEl.textContent = fmtTime(st.time);
    // boss
    if (st.bossHp && st.bossHp.hp > 0) {
      this.bossEl.classList.remove('hidden');
      this.bossName.textContent = st.bossHp.name || 'Boss';
      const bp = Math.max(0, st.bossHp.hp / (st.bossHp.maxHp || 1));
      this.bossFill.style.width = (bp * 100) + '%';
      this.bossNum.textContent = `${fmtNum(st.bossHp.hp)} / ${fmtNum(st.bossHp.maxHp)}`;
    } else this.bossEl.classList.add('hidden');
    // mini stats
    const mini = [];
    if (s.showFps && st.fps != null) mini.push(`<span class="green">FPS ${Math.round(st.fps)}</span>`);
    if (s.showDps && st.dps != null) mini.push(`<span class="orange">DPS ${fmtNum(st.dps)}</span>`);
    this.miniEl.innerHTML = mini.join('<br>');
    this.miniEl.style.top = s.minimap ? '' : '140px';
    // abilities
    const abil = st.abilities || [];
    const sig = abil.map((a) => a.id).join('|');
    if (this._abilSig !== sig) {
      this._abilSig = sig;
      this.abilitiesEl.innerHTML = '';
      abil.forEach((a, i) => {
        const def = Data.ABILITIES?.[a.id] || {};
        const slot = el('div', 'ab-slot osrs-inset', `<span class="key"></span>${esc(def.icon || '✦')}<div class="cd"></div><div class="cdtxt"></div>`);
        this._bindTooltip(slot, () => `<div class="tt-name orange">${esc(def.name || a.id)}</div><div>${esc(def.desc || '')}</div><div class="muted">Cooldown ${def.cooldown ?? a.cdMax ?? '?'}s</div>`);
        this.abilitiesEl.appendChild(slot);
      });
    }
    abil.forEach((a, i) => {
      const slot = this.abilitiesEl.children[i]; if (!slot) return;
      slot.querySelector('.key').textContent = keyLabel(Settings.get(i ? 'keybinds.ability2' : 'keybinds.ability1'));
      const frac = a.cdMax ? Math.max(0, Math.min(1, a.cdRemaining / a.cdMax)) : 0;
      slot.querySelector('.cd').style.height = (frac * 100) + '%';
      slot.querySelector('.cdtxt').textContent = a.cdRemaining > 0.05 ? (a.cdRemaining < 10 ? a.cdRemaining.toFixed(1) : Math.ceil(a.cdRemaining)) : '';
      slot.classList.toggle('ready', !(a.cdRemaining > 0.05));
    });
    // buffs
    const buffs = st.buffs || [];
    const bsig = buffs.map((b) => b.name).join('|');
    if (this._buffSig !== bsig) {
      this._buffSig = bsig;
      this.buffsEl.innerHTML = '';
      buffs.forEach((b) => {
        const d = el('div', 'buff osrs-inset', `${esc(b.icon || '✨')}<span class="t"></span>`);
        this._bindTooltip(d, () => `<div class="tt-name cyan">${esc(b.name)}</div>${b.desc ? `<div>${esc(b.desc)}</div>` : ''}`);
        this.buffsEl.appendChild(d);
      });
    }
    buffs.forEach((b, i) => {
      const t = this.buffsEl.children[i]?.querySelector('.t');
      if (t) t.textContent = b.remaining != null && isFinite(b.remaining) ? Math.ceil(b.remaining) : '';
    });
    this._renderSide(false);
  }

  _renderSide(force) {
    const st = this._lastState || {};
    let sig;
    const tab = this.sideTab;
    if (tab === 'inv') sig = 'inv' + (st.items || []).map((i) => (i.id || i.name) + (i.count || '')).join(',');
    else if (tab === 'wpn') sig = 'wpn' + (st.weapons || []).map((w) => w.id + w.level).join(',');
    else if (tab === 'runes') sig = 'runes' + (st.buffs || []).map((b) => b.name + Math.ceil(b.remaining || 0)).join(',') + (st.runes || []).length;
    else sig = 'stats' + JSON.stringify(this.game?.player?.stats || st.stats || {}) + st.level;
    if (!force && sig === this._sideSig) return;
    this._sideSig = sig;
    const b = this.sideBody;
    b.innerHTML = '';
    if (tab === 'inv') {
      b.appendChild(el('div', 'sec-title', 'Inventory'));
      const g = el('div', 'slot-grid');
      const items = st.items || [];
      for (let i = 0; i < Math.max(20, items.length); i++) g.appendChild(items[i] ? this._itemSlot(items[i]) : el('div', 'slot empty'));
      b.appendChild(g);
    } else if (tab === 'wpn') {
      b.appendChild(el('div', 'sec-title', 'Weapons'));
      (st.weapons || []).forEach((w) => {
        const d = Data.WEAPONS?.[w.id] || {};
        const r = el('div', 'kv', `<span>${esc(d.icon || '🗡')} <span class="orange">${esc(d.name || w.id)}</span></span><span class="v">Lv ${w.level}${w.level >= (d.maxLevel || 8) ? ' <span class="yellow">MAX</span>' : ''}</span>`);
        this._bindTooltip(r, () => `<div class="tt-name orange">${esc(d.name || w.id)} (Lv ${w.level})</div><div>${esc(d.desc || '')}</div>${w.dmg != null ? `<div class="muted">Damage dealt: ${fmtNum(w.dmg)}</div>` : ''}`);
        b.appendChild(r);
      });
    } else if (tab === 'runes') {
      b.appendChild(el('div', 'sec-title', 'Active Effects'));
      const buffs = st.buffs || [];
      if (!buffs.length) b.appendChild(el('div', 'muted', 'None active.'));
      buffs.forEach((x) => b.appendChild(el('div', 'kv', `<span>${esc(x.icon || '✨')} <span class="cyan">${esc(x.name)}</span></span><span class="v">${x.remaining != null && isFinite(x.remaining) ? Math.ceil(x.remaining) + 's' : '∞'}</span>`)));
      if ((st.runes || []).length) {
        b.appendChild(el('div', 'sec-title', 'Runes Absorbed'));
        st.runes.forEach((r) => b.appendChild(el('div', 'kv', `<span>${esc(r.icon || '🔮')} ${esc(r.name)}</span>`)));
      }
    } else {
      b.appendChild(el('div', 'sec-title', 'Stats'));
      const stats = this.game?.player?.stats || st.stats || {};
      Object.keys(STAT_LABELS).forEach((k) => {
        if (stats[k] == null) return;
        b.appendChild(el('div', 'kv', `<span>${STAT_LABELS[k]}</span><span class="v">${fmtStat(k, stats[k])}</span>`));
      });
      if (!Object.keys(stats).length) b.appendChild(el('div', 'muted', 'No data.'));
    }
  }

  _itemSlot(it, onClick) {
    const r = it.rarity || 'common';
    const s = el('div', `slot rar-${r}${onClick ? ' clickable' : ''}`, `${esc(it.icon || '❔')}${it.count > 1 ? `<span class="cnt">${it.count}</span>` : ''}`);
    s.style.borderColor = `var(--r-${r})`;
    this._bindTooltip(s, () => this._itemTip(it));
    if (onClick) s.onclick = onClick;
    return s;
  }
  _itemTip(it) {
    const r = it.rarity || 'common';
    return `<div class="tt-name rt-${esc(r)}">${esc(it.icon || '')} ${esc(it.name)}</div>
      <div class="muted" style="text-transform:capitalize">${esc(Data.RARITY?.[r]?.name || r)}</div>
      <div>${esc(it.desc || '')}</div><div class="tt-stats">${statsLines(it.stats).join('<br>')}</div>`;
  }

  // ---------------------------------------------------------------- tooltip
  _bindTooltip(node, htmlFn) {
    node.addEventListener('mouseenter', (e) => {
      if (Settings.get('showTooltips') === false) return;
      this.tooltip.innerHTML = htmlFn();
      const rm = this.tooltip.querySelector('[class*="rt-"]');
      const rr = rm && [...rm.classList].find((c) => c.startsWith('rt-'));
      this.tooltip.style.borderColor = rr ? `var(--r-${rr.slice(3)})` : 'var(--r-common)';
      this.tooltip.classList.remove('hidden');
      this._moveTooltip(e);
    });
    node.addEventListener('mouseleave', () => this.hideTooltip());
  }
  _moveTooltip(e) {
    if (this.tooltip.classList.contains('hidden')) return;
    const w = this.tooltip.offsetWidth, h = this.tooltip.offsetHeight;
    let x = e.clientX + 14, y = e.clientY + 14;
    if (x + w > innerWidth) x = e.clientX - w - 10;
    if (y + h > innerHeight) y = e.clientY - h - 10;
    this.tooltip.style.left = Math.max(0, x) + 'px';
    this.tooltip.style.top = Math.max(0, y) + 'px';
  }
  hideTooltip() { this.tooltip?.classList.add('hidden'); }

  // ---------------------------------------------------------------- chat / numbers
  log(msg, color) {
    if (!this.chatLog) return;
    const d = el('div', 'm' + (color && color !== '#000' ? ' colored' : ''));
    d.textContent = msg;
    if (color) d.style.color = color;
    this.chatLog.appendChild(d);
    while (this.chatLog.children.length > 80) this.chatLog.firstChild.remove();
    this.chatLog.scrollTop = this.chatLog.scrollHeight;
  }

  damageNumber(x, y, amount, crit) {
    if (!Settings.get('damageNumbers')) return;
    if (Settings.get('damageNumbersCritsOnly') && !crit) return;
    if (this.dmgLayer.childElementCount > 120) return;
    const d = el('div', 'dmg' + (crit ? ' crit' : '') + (Settings.get('reducedMotion') ? ' static' : ''));
    d.textContent = typeof amount === 'number' ? fmtNum(amount) + (crit ? '!' : '') : amount;
    d.style.left = x + 'px'; d.style.top = y + 'px';
    this.dmgLayer.appendChild(d);
    setTimeout(() => d.remove(), 850);
  }

  // ---------------------------------------------------------------- modals
  showLevelUp(choices, onPick) {
    choices = (choices || []).slice(0, 4);
    if (!choices.length) { onPick?.(null); return; }
    if (Settings.get('autoLevelUp')) {
      const order = { legendary: 5, epic: 4, rare: 3, uncommon: 2, common: 1 };
      const best = [...choices].sort((a, b) => (order[b.rarity] || 0) - (order[a.rarity] || 0) || Math.random() - 0.5)[0];
      this.log(`Auto-picked: ${best.name}`, '#00ffff');
      onPick?.(best, choices.indexOf(best));
      return;
    }
    const lv = this._lastState?.level;
    const box = el('div', '', `<h2>Level Up!${lv ? ` <span class="white">(${lv})</span>` : ''}</h2>`);
    const cards = el('div', 'lvl-cards waiting');
    const footer = el('div', 'row center muted', 'Press 1–' + choices.length + ' or click to choose');
    footer.style.marginTop = '10px';
    box.append(cards, footer);
    const pause = Settings.get('pauseOnLevelUp') !== 'never';
    const m = this._openModal(box, { closable: false, pause });
    let ready = false, done = false;
    const pick = (i) => {
      if (!ready || done || !choices[i]) return;
      done = true; m.close(); onPick?.(choices[i], i);
    };
    choices.forEach((c, i) => {
      const r = c.rarity || 'common';
      const card = el('div', `lvl-card rar-${r}`, `<span class="hotkey">${i + 1}</span><span class="kind">${esc(c.kind || '')}${c.isNew ? ' · NEW' : ''}</span>
        <div class="icon">${esc(c.icon || '✦')}</div><div class="name rt-${r}">${esc(c.name)}</div><div class="desc">${esc(c.desc || '')}</div>`);
      card.onclick = () => pick(i);
      cards.appendChild(card);
    });
    m.keyHandler = (e) => {
      const n = parseInt(e.key, 10);
      if (n >= 1 && n <= choices.length) { pick(n - 1); return true; }
      return false;
    };
    const delay = (Settings.get('levelUpPickDelay') ?? 0.3) * 1000;
    setTimeout(() => { ready = true; cards.classList.remove('waiting'); }, delay);
    return m;
  }

  showMerchant(stock, gold, onBuy, onReroll, onClose) {
    stock = stock || [];
    let curGold = gold || 0;
    const sold = new Set();
    const box = el('div', '', '<h2>🕵 Black Market Dealer</h2>');
    const top = el('div', 'row', '');
    const goldEl = el('span', 'gold-display');
    top.append(el('span', 'muted', '"Psst... finest wares in the burrow."'), el('span', 'spacer'), goldEl);
    const list = el('div', 'shop-list');
    const msg = el('div', 'flash-msg');
    const nav = el('div', 'nav-row');
    const reroll = el('button', 'osrs-btn', `Reroll (${Data.MERCHANT?.rerollCost ?? '?'}g)`);
    const leave = el('button', 'osrs-btn', 'Leave');
    nav.append(reroll, leave);
    box.append(top, list, msg, nav);
    const m = this._openModal(box, { closable: true, onClose });
    const flash = (t, ok) => { msg.textContent = t; msg.style.color = ok ? 'var(--green)' : 'var(--red)'; clearTimeout(this._flashT); this._flashT = setTimeout(() => { msg.textContent = ''; }, 1800); };
    const readGold = () => {
      const g = this.game?.player?.gold ?? this.game?.state?.gold;
      if (typeof g === 'number') curGold = g;
      goldEl.textContent = `● ${fmtNum(curGold)} gp`;
    };
    const render = () => {
      readGold();
      list.innerHTML = '';
      stock.forEach((s, i) => {
        const it = s.item || s; const r = it.rarity || 'common';
        const isSold = sold.has(i);
        const card = el('div', `shop-item rar-${r}${isSold ? ' sold' : ''}`);
        card.innerHTML = `<div class="top"><span class="icon">${esc(it.icon || '❔')}</span><div><div class="rt-${r}">${esc(it.name)}</div><div class="price">${fmtNum(s.price)} gp</div></div></div>
          <div class="muted" style="font-size:16px">${esc(it.desc || '')}</div><div class="green" style="font-size:16px">${statsLines(it.stats).join(', ')}</div>`;
        const btn = el('button', 'osrs-btn small', isSold ? 'Sold' : 'Buy');
        btn.disabled = isSold;
        if (!isSold && curGold < s.price) btn.style.color = 'var(--red)';
        btn.onclick = () => {
          if (curGold < s.price) { card.classList.remove('shake'); void card.offsetWidth; card.classList.add('shake'); flash("You don't have enough gold."); return; }
          if (Settings.get('confirmShopPurchase') && !confirm(`Buy ${it.name} for ${s.price} gp?`)) return;
          const ok = onBuy ? onBuy(i) : true;
          if (ok === false) { card.classList.add('shake'); flash("You can't buy that."); return; }
          sold.add(i); curGold -= s.price; flash(`Purchased ${it.name}!`, true);
          this.log(`You buy the ${it.name}.`, '#ff981f');
          render();
        };
        this._bindTooltip(card.querySelector('.icon'), () => this._itemTip(it));
        card.appendChild(btn);
        list.appendChild(card);
      });
      const cost = Data.MERCHANT?.rerollCost ?? 0;
      reroll.style.color = curGold < cost ? 'var(--red)' : '';
    };
    reroll.onclick = () => {
      const cost = Data.MERCHANT?.rerollCost ?? 0;
      if (curGold < cost) { flash('Not enough gold to reroll.'); return; }
      const ns = onReroll ? onReroll() : null;
      if (!ns) { flash('The dealer refuses.'); return; }
      stock = ns; sold.clear();
      if (this.game?.player?.gold == null && this.game?.state?.gold == null) curGold -= cost;
      flash('New wares!', true); render();
    };
    leave.onclick = () => m.close();
    render();
    return m;
  }

  showShrine(playerItems, onTrade, onClose) {
    const items = playerItems || [];
    const box = el('div', '', '<h2>⛩ Shrine of Exchange</h2>');
    box.appendChild(el('div', 'white', 'Offer an item. The shrine returns a random item of the same rarity.'));
    const grid = el('div', 'slot-grid'); grid.style.margin = '12px auto'; grid.style.gridTemplateColumns = 'repeat(6, 42px)';
    const result = el('div', 'flash-msg');
    const nav = el('div', 'nav-row');
    const leave = el('button', 'osrs-btn', 'Leave');
    nav.append(el('span'), leave);
    box.append(grid, result, nav);
    const m = this._openModal(box, { closable: true, onClose });
    let used = false;
    if (!items.length) grid.replaceWith(el('div', 'muted', 'You have nothing to offer.'));
    items.forEach((it, i) => grid.appendChild(this._itemSlot(it, () => {
      if (used) return;
      used = true;
      const ni = onTrade ? onTrade(i) : null;
      grid.querySelectorAll('.slot').forEach((s) => { s.classList.remove('clickable'); s.style.opacity = .4; });
      if (ni) {
        result.style.color = 'var(--green)';
        result.innerHTML = `The shrine takes your ${esc(it.name)} and grants: <span class="rt-${esc(ni.rarity)}">${esc(ni.icon || '')} ${esc(ni.name)}</span>`;
        this.log(`Shrine: ${it.name} → ${ni.name}`, '#00ffff');
      } else { result.textContent = 'The shrine is silent.'; }
      leave.textContent = 'Done';
    })));
    leave.onclick = () => m.close();
    return m;
  }

  showChest(item, onTake) {
    const r = item?.rarity || 'common';
    const box = el('div', '', '<h2>📦 Treasure Chest</h2>');
    const c = el('div', 'col'); c.style.alignItems = 'center';
    c.innerHTML = `<div class="lvl-card rar-${r}" style="cursor:default"><div class="icon">${esc(item?.icon || '❔')}</div>
      <div class="name rt-${r}">${esc(item?.name || 'Nothing')}</div><div class="muted" style="text-transform:capitalize">${esc(r)}</div>
      <div class="desc">${esc(item?.desc || '')}</div><div class="green">${statsLines(item?.stats).join('<br>')}</div></div>`;
    const take = el('button', 'osrs-btn', 'Take (Space)');
    take.style.marginTop = '10px';
    c.appendChild(take);
    box.appendChild(c);
    let taken = false;
    const m = this._openModal(box, { closable: true, onClose: () => { if (!taken) { taken = true; onTake?.(item); } } });
    take.onclick = () => m.close();
    m.keyHandler = (e) => { if (e.code === 'Space' || e.code === 'Enter' || e.code === Settings.get('keybinds.interact')) { m.close(); return true; } return false; };
    if (item) this.log(`You find: ${item.name}`, this.rarityColor(r));
    return m;
  }

  showPause(onResume, onSettings, onQuit) {
    const box = el('div', 'col', '<h2>Paused</h2>');
    box.style.alignItems = 'center';
    const st = this._lastState;
    if (st) box.appendChild(el('div', 'muted', `Time ${fmtTime(st.time)} · Level ${st.level} · Kills ${fmtNum(st.kills)}`));
    let m;
    const btn = (t, fn, cls = '') => { const b = el('button', 'osrs-btn ' + cls, t); b.style.width = '240px'; b.onclick = fn; box.appendChild(b); return b; };
    let action = 'resume';
    btn('Resume', () => m.close());
    btn('Stats', () => this.showStats(this.game?.player));
    btn('Settings', () => { if (onSettings) onSettings(); else this.showSettings(); });
    btn('Quit to Menu', () => {
      if (Settings.get('confirmQuit') && !confirm('Quit this run? Progress will be lost.')) return;
      action = 'quit'; m.close();
    }, 'danger');
    m = this._openModal(box, { closable: true, onClose: () => {
      if (action === 'quit') { if (onQuit) onQuit(); else this.game?.quitToMenu?.(); }
      else onResume?.();
    } });
    m.keyHandler = (e) => {
      if (e.code === Settings.get('keybinds.pause') && e.code !== 'Escape') { m.close(); return true; }
      return false;
    };
    return m;
  }

  showStats(player) {
    const p = player || this.game?.player || {};
    const stats = p.stats || p;
    const box = el('div', '', `<h2>${esc(p.name || p.character?.name || 'Character')} — Stats</h2>`);
    const t = el('div', 'stat-table osrs-inset'); t.style.padding = '8px'; t.style.minWidth = '420px';
    Object.keys(STAT_LABELS).forEach((k) => { if (stats[k] != null) t.innerHTML += `<div><span class="k">${STAT_LABELS[k]}</span><span class="v">${fmtStat(k, stats[k])}</span></div>`; });
    box.appendChild(t);
    const items = p.items || this._lastState?.items || [];
    if (items.length) {
      box.appendChild(el('div', 'orange', 'Items')).style.marginTop = '8px';
      const g = el('div', 'slot-grid'); g.style.gridTemplateColumns = 'repeat(8, 42px)';
      items.forEach((it) => g.appendChild(this._itemSlot(it)));
      box.appendChild(g);
    }
    const m = this._openModal(box, { closable: true });
    m.keyHandler = (e) => { if (e.code === Settings.get('keybinds.stats')) { m.close(); return true; } return false; };
    return m;
  }

  showHoleConfirm({ finalStage = false, nextStageName = '' } = {}, onJump, onCancel) {
    const box = el('div', 'col hole-confirm', `<h2>${finalStage ? 'The Abyss Beckons' : 'A Gaping Hole'}</h2>`);
    box.style.alignItems = 'center';
    box.appendChild(el('div', 'white', finalStage ? 'Leap into the abyss and end your run in victory?'
      : `Descend to <span class="yellow">${esc(nextStageName || 'the next stage')}</span>? Your build carries over.`));
    const nav = el('div', 'row center');
    const jump = el('button', 'osrs-btn', finalStage ? '★ Leap (F)' : '⇩ Jump In (F)');
    const stay = el('button', 'osrs-btn', 'Stay (Esc)');
    nav.append(stay, jump); box.appendChild(nav);
    let act = 'cancel';
    const m = this._openModal(box, { closable: true, onClose: () => { if (act === 'jump') onJump?.(); else onCancel?.(); } });
    jump.onclick = () => { act = 'jump'; m.close(); };
    stay.onclick = () => { act = 'cancel'; m.close(); };
    m.keyHandler = (e) => {
      if (e.code === Settings.get('keybinds.interact') || e.code === 'Enter') { act = 'jump'; m.close(); return true; }
      return false;
    };
    return m;
  }

  showGameOver(summary = {}, onRetry, onMenu) {
    const win = !!summary.victory || summary.endedBy === 'victory';
    const title = win ? 'Congratulations, you are victorious!' : summary.endedBy === 'quit' ? 'Run Abandoned' : 'Oh dear, you are dead!';
    const box = el('div', win ? 'victory' : '', `<h2 class="${win ? 'victory-title' : 'red'}" style="${win ? '' : 'color:var(--red)'}">${title}</h2>`);
    const g = el('div', 'summary-grid osrs-inset'); g.style.padding = '8px';
    const rows = [
      ['Time Survived', fmtTime(summary.time)], ['Level', summary.level], ['Kills', fmtNum(summary.kills)],
      ['Score', summary.score != null ? fmtNum(summary.score) : null],
      ['Gold', fmtNum(summary.gold)], ['Stage', typeof summary.stage === 'number' ? summary.stage + 1 : summary.stage],
      ['Difficulty', Data.DIFFICULTIES?.find((d) => d.id === summary.difficulty)?.name || summary.difficulty],
      ['Damage Dealt', summary.damageDealt != null ? fmtNum(summary.damageDealt) : null],
      ['Bosses Slain', summary.bossesKilled], ['Loop', summary.loop],
    ].filter(([, v]) => v != null && v !== '');
    g.innerHTML = rows.map(([k, v]) => `<span class="k">${k}</span><span class="v">${esc(v)}</span>`).join('');
    box.appendChild(g);
    const who = Accounts.current()?.username || 'Guest';
    box.appendChild(el('div', 'muted center-text saved-to', `Saved to ${esc(who)}'s record`));
    if (summary.newBest) box.appendChild(el('div', 'yellow', '★ New best time! ★')).style.textAlign = 'center';
    (summary.unlocks || []).forEach((u) => box.appendChild(el('div', 'green', `Unlocked: ${esc(u)}`)));
    if (summary.weapons?.length) {
      const w = el('div', 'muted', 'Weapons: ' + summary.weapons.map((x) => esc((Data.WEAPONS?.[x.id]?.name || x.id) + ' ' + (x.level ?? ''))).join(', '));
      box.appendChild(w);
    }
    const nav = el('div', 'nav-row');
    const retry = el('button', 'osrs-btn', win ? 'Play Again' : 'Try Again');
    const menu = el('button', 'osrs-btn', 'Main Menu');
    nav.append(menu, retry); box.appendChild(nav);
    let act = 'menu';
    const m = this._openModal(box, { closable: false, onClose: () => { if (act === 'retry') onRetry?.(); else { onMenu ? onMenu() : this.game?.quitToMenu?.(); } } });
    retry.onclick = () => { act = 'retry'; m.close(); };
    menu.onclick = () => { act = 'menu'; m.close(); };
    this.log(title, win ? '#ffff00' : '#ff2a1a');
    return m;
  }

  showBossDefeated(bossName, onContinueEndless, onNextStage) {
    const box = el('div', 'col', `<h2>Victory!</h2>`);
    box.style.alignItems = 'center';
    box.appendChild(el('div', 'white', `You have defeated <span class="red">${esc(bossName || 'the boss')}</span>!`));
    const st = this._lastState?.stage;
    const hasNext = Data.STAGES ? (typeof st === 'number' ? st < Data.STAGES.length - 1 : true) : true;
    box.appendChild(el('div', 'muted', 'Continue in endless mode (enemies keep growing stronger) or travel onward.'));
    const nav = el('div', 'row center');
    const endless = el('button', 'osrs-btn', '∞ Continue Endless');
    const next = el('button', 'osrs-btn', hasNext ? 'Next Stage ▶' : 'Return to Menu');
    nav.append(endless, next); box.appendChild(nav);
    let act = 'endless';
    const m = this._openModal(box, { closable: false, onClose: () => { if (act === 'next') onNextStage?.(); else onContinueEndless?.(); } });
    endless.onclick = () => { act = 'endless'; m.close(); };
    next.onclick = () => { act = 'next'; m.close(); };
    this.log(`Congratulations! You have defeated ${bossName}.`, '#ff981f');
    return m;
  }
  showVictory(bossName, onContinueEndless, onNextStage) { return this.showBossDefeated(bossName, onContinueEndless, onNextStage); }

  showMessage(title, text, onClose) {
    const box = el('div', '', `<h2>${esc(title)}</h2><div class="white">${esc(text)}</div>`);
    const ok = el('button', 'osrs-btn', 'OK'); ok.style.marginTop = '10px';
    box.appendChild(ok);
    const m = this._openModal(box, { closable: true, onClose });
    ok.onclick = () => m.close();
    return m;
  }

  getMinimapCanvas() { return Settings.get('minimap') && this.hudVisible ? this.minimap : null; }
}

export default UI;
