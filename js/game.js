// Burrow Brawl — core engine (Game class).
import * as THREE from 'three';
import * as D from './data.js';
import * as M from './models.js';
import { Settings } from './settings.js';
import { Audio } from './audio.js';

const S = (k, d) => { try { const v = Settings?.get?.(k); return v == null ? d : v; } catch { return d; } };
const rand = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const MAP_HALF = 140;
const MAX_WEAPONS = 6;
const DEFAULT_STATS = { maxHp: 100, hpRegen: 0, armor: 0, moveSpeed: 5, damage: 1, attackSpeed: 1, critChance: 0.05, critDamage: 1.5, area: 1, projectiles: 0, pickupRange: 3, xpGain: 1, luck: 0, dodge: 0, lifesteal: 0, cooldown: 1 };
const DEFAULT_KEYS = { up: 'KeyW', down: 'KeyS', left: 'KeyA', right: 'KeyD', ability1: 'KeyQ', ability2: 'KeyE', interact: 'KeyF', pause: 'Escape', map: 'KeyM', stats: 'Tab' };
const META_KEY = 'burrowbrawl.meta.v1';
const growth = (v, minutes) => (v >= 1 ? Math.pow(v, minutes) : Math.pow(1 + v, minutes));

function blob(color = 0xff00ff, size = 1) {
  const g = new THREE.Group();
  const m = new THREE.Mesh(new THREE.IcosahedronGeometry(0.5 * size, 0), new THREE.MeshLambertMaterial({ color, flatShading: true }));
  m.position.y = 0.5 * size; g.add(m); return g;
}
function safeBuild(fn, fallback) {
  try { const g = fn(); if (g) return g; } catch (e) { console.warn('[build]', e); }
  return fallback();
}

const _matCache = new Map();
function basicMat(color, opacity = 1) {
  const key = String(color) + '|' + opacity;
  let m = _matCache.get(key);
  if (!m) {
    m = new THREE.MeshBasicMaterial({ color: new THREE.Color(color), transparent: opacity < 1, opacity, depthWrite: opacity >= 1 });
    _matCache.set(key, m);
  }
  return m;
}
const GEO = {
  proj: new THREE.SphereGeometry(0.22, 7, 5),
  eproj: new THREE.SphereGeometry(0.28, 6, 4),
  boom: new THREE.BoxGeometry(0.9, 0.1, 0.25),
  orb: new THREE.OctahedronGeometry(0.32, 0),
  disc: new THREE.CircleGeometry(1, 40),
  ring: new THREE.RingGeometry(0.85, 1, 40),
  plane: new THREE.PlaneGeometry(1, 1),

  dust: new THREE.BoxGeometry(0.3, 0.3, 0.3),
};
const SHARED_GEO = new Set(Object.values(GEO));

// Dispose every geometry/material/texture in a subtree, except shared module-level caches.
function disposeTree(root) {
  if (!root) return;
  const shared = new Set(_matCache.values());
  root.traverse((o) => {
    if (o.geometry && !SHARED_GEO.has(o.geometry)) o.geometry.dispose?.();
    if (o.material) {
      const ms = Array.isArray(o.material) ? o.material : [o.material];
      for (const m of ms) {
        if (!m || shared.has(m)) continue;
        for (const k in m) { const v = m[k]; if (v && v.isTexture) v.dispose(); }
        m.dispose?.();
      }
    }
  });
}

// ---------------- accounts (owned by UI agent; loaded lazily so a missing file never breaks the game) ----------------
let Accounts = null;
const accountsReady = import('./accounts.js')
  .then((mod) => { Accounts = mod.Accounts || mod.default || null; })
  .catch((e) => { console.warn('[accounts] unavailable, using local meta fallback', e); });

const DIFF_SCORE_MULT = { easy: 0.75, normal: 1, hard: 1.5, nightmare: 2, endless_hell: 3 };
const BASE_UNLOCKED = new Map((D.CHARACTERS || []).map((c) => [c.id, !!c.unlocked]));

// ---------------- meta ----------------
function readMetaRaw() {
  if (Accounts?.loadMeta) { try { return Accounts.loadMeta(); } catch (e) { console.warn(e); } }
  try { return JSON.parse(localStorage.getItem(META_KEY)); } catch { return null; }
}
function writeMetaRaw(m) {
  if (Accounts?.saveMeta) { try { Accounts.saveMeta(m); return; } catch (e) { console.warn(e); } }
  try { localStorage.setItem(META_KEY, JSON.stringify(m)); } catch {}
}
function loadMeta() {
  let m = readMetaRaw();
  m = m && typeof m === 'object' ? { ...m } : {};
  m.unlockedCharacters = Array.isArray(m.unlockedCharacters) ? m.unlockedCharacters : [];
  m.unlockedStages = Array.isArray(m.unlockedStages) ? m.unlockedStages : [0];
  if (!m.unlockedStages.includes(0)) m.unlockedStages.push(0);
  m.bestTimes = m.bestTimes || {};
  m.stagesCleared = Array.isArray(m.stagesCleared) ? m.stagesCleared : [];
  m.totalKills = m.totalKills || 0;
  m.bestTime = Number(m.bestTime) || 0;
  for (const c of D.CHARACTERS || []) if (BASE_UNLOCKED.get(c.id) && !m.unlockedCharacters.includes(c.id)) m.unlockedCharacters.push(c.id);
  m.deathsBy = m.deathsBy && typeof m.deathsBy === 'object' ? m.deathsBy : {};
  const eids = Object.keys(D.ENEMIES || {});
  if (eids.length && eids.every((id) => m.deathsBy[id] > 0) && !m.unlockedCharacters.includes('nacho')) m.unlockedCharacters.push('nacho');
  return m;
}

export class Game {
  constructor(container) {
    this.container = container || document.body;
    this.ui = null;
    this.pauseCount = 0;
    this.state = 'menu';
    this.meta = loadMeta();
    this._syncMetaFlags();
    this.keys = new Set();
    this.zoom = 1;
    this.fps = 60; this._fpsAcc = 0; this._fpsFrames = 0;
    this.shake = 0;
    this.player = null;
    this.run = null;

    const q = S('quality', 'medium');
    this.renderer = new THREE.WebGLRenderer({ antialias: q !== 'low', powerPreference: 'high-performance' });
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.container.appendChild(this.renderer.domElement);
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(S('fov', 60), 1, 0.1, 400);
    this.camera.position.set(0, 14, 12);

    this.hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 0.9);
    this.sun = new THREE.DirectionalLight(0xffffff, 1.1);
    this.sun.position.set(20, 40, 15);
    this.sun.shadow.mapSize.set(1024, 1024);
    const sc = this.sun.shadow.camera; sc.left = -30; sc.right = 30; sc.top = 30; sc.bottom = -30; sc.near = 1; sc.far = 120;
    this.scene.add(this.hemi, this.sun, this.sun.target);

    this._makeOverlay();
    this.applySettings();
    try { Settings?.onChange?.(() => this.applySettings()); } catch {}
    this._resize = () => this.onResize();
    window.addEventListener('resize', this._resize);
    this.onResize();
    this._bindInput();

    this.buildWorld(0);
    this._makeReticle();
    // re-load per-account meta once accounts.js is available and whenever the account changes
    accountsReady.then(() => {
      this.reloadMeta();
      try { Accounts?.onChange?.(() => this.reloadMeta()); } catch {}
    });
    this._last = performance.now();
    this._loop = this._loop.bind(this);
    requestAnimationFrame(this._loop);
  }

  // ======================= meta =======================
  _syncMetaFlags() {
    for (const c of D.CHARACTERS || []) c.unlocked = !!BASE_UNLOCKED.get(c.id) || this.meta.unlockedCharacters.includes(c.id);
    (D.STAGES || []).forEach((s, i) => { s.unlocked = this.meta.unlockedStages.includes(i); s.bestTime = this.meta.bestTimes[s.id] || 0; });
  }
  reloadMeta() {
    this.meta = loadMeta();
    this._syncMetaFlags();
  }
  saveMeta() {
    writeMetaRaw(this.meta);
    this._syncMetaFlags();
  }
  unlockStage(i) {
    const stages = D.STAGES || [];
    if (i < 0 || i >= stages.length || this.meta.unlockedStages.includes(i)) return false;
    this.meta.unlockedStages.push(i); this.saveMeta();
    this.ui?.log?.(`New stage unlocked: ${stages[i].name}!`, '#ffff00');
    return true;
  }
  isCharacterUnlocked(id) { return this.meta.unlockedCharacters.includes(id); }
  isStageUnlocked(i) { return this.meta.unlockedStages.includes(i); }
  unlockCharacter(id) {
    if (!id || this.meta.unlockedCharacters.includes(id)) return false;
    this.meta.unlockedCharacters.push(id); this.saveMeta();
    const c = (D.CHARACTERS || []).find((x) => x.id === id);
    this.ui?.log?.(`New character unlocked: ${c?.name || id}!`, '#ffff00');
    return true;
  }

  // ======================= pause =======================
  get paused() { return this.pauseCount > 0; }
  pause() { this.pauseCount++; }
  resume() { this.pauseCount = Math.max(0, this.pauseCount - 1); this._last = performance.now(); }

  // ======================= settings =======================
  applySettings() {
    const q = S('quality', 'medium');
    let rs = Number(S('renderScale', 1)); if (rs > 4) rs /= 100; rs = clamp(rs || 1, 0.25, 2);
    const cap = q === 'low' ? 1 : q === 'medium' ? 1.5 : 2;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, cap) * rs);
    const sh = !!S('shadows', true) && q !== 'low';
    if (this.renderer.shadowMap.enabled !== sh) {
      this.renderer.shadowMap.enabled = sh;
      this.scene?.traverse((o) => { if (o.material) { const ms = Array.isArray(o.material) ? o.material : [o.material]; ms.forEach((m) => (m.needsUpdate = true)); } });
    }
    this.sun.castShadow = sh;
    this.sun.shadow.mapSize.set(q === 'high' ? 2048 : 1024, q === 'high' ? 2048 : 1024);
    this.camera.fov = Number(S('fov', 60)) || 60; this.camera.updateProjectionMatrix();
    this.enemyCap = q === 'low' ? 140 : q === 'medium' ? 220 : 300;
    if (this.fpsEl) this.fpsEl.style.display = S('showFps', false) ? 'block' : 'none';
    Audio.apply?.();
  }
  onResize() {
    const w = this.container.clientWidth || window.innerWidth, h = this.container.clientHeight || window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
  }

  _makeOverlay() {
    const mk = (css) => { const d = document.createElement('div'); d.style.cssText = css; this.container.appendChild(d); return d; };
    this.flashEl = mk('position:absolute;inset:0;pointer-events:none;background:#ff0000;opacity:0;transition:opacity .25s;z-index:2');
    this.promptEl = mk('position:absolute;left:50%;top:62%;transform:translateX(-50%);pointer-events:none;display:none;z-index:3;' +
      'font:20px VT323,"Press Start 2P",monospace;color:#ffff00;text-shadow:1px 1px 0 #000;background:rgba(62,53,41,.9);border:2px solid #000;padding:4px 12px;');
    this.fadeEl = mk('position:absolute;inset:0;pointer-events:none;background:#000;opacity:0;transition:opacity .5s;z-index:4');
    this.fpsEl = mk('position:absolute;left:6px;top:4px;pointer-events:none;z-index:3;font:14px monospace;color:#0f0;text-shadow:1px 1px 0 #000;display:none');
  }

  // ======================= input =======================
  _bindVals(action) {
    const kb = S('keybinds', {}) || {};
    const b = kb[action] ?? DEFAULT_KEYS[action];
    return (Array.isArray(b) ? b : [b]).filter(Boolean).map((x) => String(x).toLowerCase());
  }
  _match(e, action) {
    const vals = this._bindVals(action);
    return vals.includes(String(e.code).toLowerCase()) || vals.includes(String(e.key).toLowerCase());
  }
  isHeld(action) { return this._bindVals(action).some((v) => this.keys.has(v)); }
  _bindInput() {
    window.addEventListener('keydown', (e) => {
      const tag = e.target?.tagName;
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
      this.keys.add(String(e.code).toLowerCase()); this.keys.add(String(e.key).toLowerCase());
      if (this._match(e, 'stats') || e.code === 'Tab') e.preventDefault();
      if (this.state !== 'playing' || e.repeat) return;
      const modal = this._modalOpen();
      if (this._match(e, 'pause') || e.code === 'Escape') { if (!modal) this.openPause(); return; }
      if (modal || this.paused) return;
      if (this._match(e, 'stats')) { this.ui?.showStats?.(this.player); return; }
      if (this._match(e, 'ability1')) this.useAbility(0);
      else if (this._match(e, 'ability2')) this.useAbility(1);
      else if (this._match(e, 'interact')) this.interact();
      else if (this._match(e, 'map')) this.minimapLarge = !this.minimapLarge;
    });
    window.addEventListener('keyup', (e) => { this.keys.delete(String(e.code).toLowerCase()); this.keys.delete(String(e.key).toLowerCase()); });
    window.addEventListener('blur', () => {
      this.keys.clear();
      if (S('muteOnFocusLoss', false)) Audio.setFocusMuted?.(true);
      if (this.state === 'playing' && S('pauseOnFocusLoss', true) && !this._modalOpen() && !this.paused) this.openPause();
    });
    window.addEventListener('focus', () => Audio.setFocusMuted?.(false));
    this.renderer.domElement.addEventListener('wheel', (e) => {
      e.preventDefault();
      const sens = Number(S('mouseSensitivity', 1)) || 1;
      this.zoom = clamp(this.zoom * (1 + Math.sign(e.deltaY) * 0.08 * sens), 0.45, 2.2);
    }, { passive: false });
    window.addEventListener('mousemove', (e) => { this.mouse = { x: e.clientX, y: e.clientY }; });
  }
  _modalOpen() { try { return !!this.ui?.isModalOpen?.(); } catch { return false; } }

  openPause() {
    if (this.state !== 'playing') return;
    if (!this.ui?.showPause) { this.pauseCount ? this.resume() : this.pause(); return; }
    this.ui.showPause(
      () => {},
      () => this.ui?.showSettings?.(() => { this.applySettings(); }),
      () => this.quitToMenu(),
    );
  }

  // ======================= world =======================
  _clearWorld() {
    if (this.world) {
      this.scene.remove(this.world);
      // keep the player's mesh alive across stage transitions
      if (this.player?.mesh?.parent === this.world) this.world.remove(this.player.mesh);
      if (this.weaponFx?.parent === this.world) this.world.remove(this.weaponFx);
      disposeTree(this.world);
    }
    this.pools = {};
    this.world = new THREE.Group();
    this.scene.add(this.world);
    this.colliders = [];
  }
  buildWorld(stageIndex) {
    this._clearWorld();
    const st = (D.STAGES || [])[stageIndex] || { map: {} };
    const map = st.map || {};
    const sky = new THREE.Color(map.sky || '#9fd4ff');
    this.scene.background = sky;
    this.scene.fog = new THREE.Fog(new THREE.Color(map.fog || map.sky || '#cccccc'), 35, 120);
    this.hemi.color.set(map.ambient || '#ffffff'); this.hemi.groundColor.set(map.ground || '#555555');
    const dark = sky.getHSL({}).l < 0.25;
    this.hemi.intensity = dark ? 1.1 : 0.85; this.sun.intensity = dark ? 0.6 : 1.1;

    const groundMat = new THREE.MeshLambertMaterial({ color: new THREE.Color(map.ground || '#6fae4a') });
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(MAP_HALF * 2 + 120, MAP_HALF * 2 + 120, 1, 1), groundMat);
    ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true;
    this.world.add(ground);
    // subtle darker patches for texture
    const patchMat = new THREE.MeshLambertMaterial({ color: new THREE.Color(map.ground || '#6fae4a').multiplyScalar(0.85) });
    for (let i = 0; i < 60; i++) {
      const p = new THREE.Mesh(GEO.disc, patchMat); p.rotation.x = -Math.PI / 2;
      p.position.set(rand(-MAP_HALF, MAP_HALF), 0.01, rand(-MAP_HALF, MAP_HALF)); p.scale.setScalar(rand(2, 7));
      p.receiveShadow = true; this.world.add(p);
    }
    // boundary ring
    const bound = new THREE.Mesh(new THREE.RingGeometry(MAP_HALF, MAP_HALF + 3, 64), basicMat('#000000', 0.35));
    bound.rotation.x = -Math.PI / 2; bound.position.y = 0.03; this.world.add(bound);

    const q = S('quality', 'medium');
    const dens = Number(map.propDensity ?? 0.5);
    const count = Math.round((dens <= 1 ? dens * 500 : dens) * (q === 'low' ? 0.4 : q === 'medium' ? 0.7 : 1));
    const types = map.props?.length ? map.props : ['rock'];
    const blocking = new Set(['tree', 'rock', 'pillar', 'ruin', 'cactus', 'lavaRock', 'crystal']);
    for (let i = 0; i < count; i++) {
      const x = rand(-MAP_HALF, MAP_HALF), z = rand(-MAP_HALF, MAP_HALF);
      if (x * x + z * z < 64) continue;
      const type = pick(types);
      const g = safeBuild(() => M.buildProp(type, Math.random), () => blob(0x888888, 0.8));
      g.position.set(x, 0, z);
      g.traverse((o) => { if (o.isMesh) { o.castShadow = q === 'high'; o.receiveShadow = false; } });
      g.updateMatrixWorld(true);
      g.matrixAutoUpdate = false; g.traverse((o) => { o.matrixAutoUpdate = false; });
      this.world.add(g);
      if (blocking.has(type)) this.colliders.push({ x, z, r: g.userData?.radius || 0.6 });
    }
    this.stageIndex = stageIndex;
  }

  // ======================= run lifecycle =======================
  startRun(opts = {}) {
    const chars = D.CHARACTERS || [];
    const char = chars.find((c) => c.id === opts.characterId) || chars[0];
    const stageIndex = clamp(opts.stageIndex | 0, 0, (D.STAGES || [1]).length - 1);
    const diff = (D.DIFFICULTIES || []).find((d) => d.id === opts.difficultyId) || (D.DIFFICULTIES || [])[1] || { id: 'normal', name: 'Normal', enemyHp: 1, enemyDmg: 1, spawnRate: 1, xpMult: 1, goldMult: 1, scalingMult: 1 };
    this.lastRunOpts = { characterId: char.id, stageIndex, difficultyId: diff.id };
    this.pauseCount = 0; this.levelUpOpen = false; this.transitioning = false;
    if (this.fadeEl) this.fadeEl.style.opacity = '0';
    // drop the previous run's player so its mesh gets disposed with the old world
    this.player = null; this.weaponFx = null;

    this.run = {
      stage: null, stageIndex, diff, time: 0, kills: 0, spawnAcc: 0, eliteTimer: 50, runeTimer: 20, merchantTimer: 0,
      bossSpawned: false, boss: null, bossKilledAt: null, loop: 0, bossCount: 0, nextBossAt: 300, bossPending: null, hole: null,
      dmgLog: [], dmgTotal: 0, hudT: 0, minimapT: 0, pendingLevels: 0, victory: false, over: false, bossesKilled: 0,
      timeSlow: 0, magnetAll: 0, doubleXp: 0, invuln: 0, prevBest: 0,
      seg: { time: 0, kills: 0, dmg: 0, bosses: 0 }, unlocks: [],
    };
    this.enemies = []; this.projectiles = []; this.eprojs = []; this.hazards = [];
    this.effects = []; this.pickups = []; this.allies = []; this.merchant = null; this.shrines = [];
    this.buildWorld(stageIndex);

    // player
    const mesh = safeBuild(() => M.buildCharacter(char.model), () => blob(0x8b6a4a, 1));
    mesh.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    const p = this.player = {
      character: char, char, id: char.id, name: char.name, mesh, pos: mesh.position,
      level: 1, xp: 0, xpNext: D.xpForLevel ? D.xpForLevel(1) : 10, gold: 0, kills: 0,
      items: [], upgrades: [], runeStats: {}, runes: [], buffs: [], weapons: [], abilities: [],
      facing: new THREE.Vector3(0, 0, 1), moving: false, invuln: 0, hurtCd: 0, hurtFlash: 0,
      lives: 0, dash: null, shield: null, heal: null, barrage: null, stats: { ...DEFAULT_STATS }, hp: 100, maxHp: 100,
    };
    this.weaponFx = new THREE.Group();
    this.addWeapon(char.startWeapon);
    p.abilities = (char.moves || []).slice(0, 2).map((id) => ({ id, def: D.ABILITIES?.[id], cd: 0 }));
    this.computeStats(); p.hp = p.stats.maxHp;

    this._setupStage(stageIndex);
    this.state = 'playing';
    this.ui?.showHUD?.();
  }

  // Populate the current world for a stage: player placement, shrines, runes, timers. Used by startRun and stage jumps.
  _setupStage(stageIndex) {
    const r = this.run, p = this.player;
    const stage = (D.STAGES || [])[stageIndex] || { name: 'Stage', map: {}, enemies: Object.keys(D.ENEMIES || {}), elites: [], bossTime: 300 };
    r.stage = stage; r.stageIndex = stageIndex;
    r.stageStart = r.time;
    r.boss = null; r.bossPending = null; r.hole = null; r.bossSpawned = false; r.bossKilledAt = null; r.bossCount = 0;
    r.nextBossAt = r.time + (stage.bossTime || 300);
    r.eliteTimer = 50; r.runeTimer = 20; r.merchantTimer = 0; r.spawnAcc = 0;
    r.prevBest = this.meta.bestTimes[stage.id] || 0;
    r.seg = { time: r.time, kills: r.kills, dmg: r.dmgTotal, bosses: r.bossesKilled || 0 };
    this.lastRunOpts = { ...this.lastRunOpts };

    p.pos.set(0, 0, 0); p.dash = null;
    this.world.add(p.mesh); this.world.add(this.weaponFx);
    for (const w of p.weapons) w.hits?.clear?.();

    const nS = D.SHRINE?.count ?? 3;
    for (let i = 0; i < nS; i++) {
      const a = (i / nS) * Math.PI * 2 + rand(-0.4, 0.4), rr = rand(25, 70);
      const g = safeBuild(() => M.buildShrine(), () => blob(0x80c0ff, 1.2));
      g.position.set(Math.cos(a) * rr, 0, Math.sin(a) * rr);
      this.world.add(g);
      this.shrines.push({ mesh: g, uses: D.SHRINE?.usesPerShrine ?? 1 });
      this._clearColliders(g.position.x, g.position.z, 3);
    }
    for (let i = 0; i < 3; i++) this.spawnRune(null, rand(15, 50));
    this.ui?.log?.(`Welcome to ${stage.name}. Survive ${Math.round((stage.bossTime || 300) / 60)} minutes to face the boss!`, '#ffff00');
    import('./titlecard.js').then((m) => m.showStageBanner?.(stageIndex)).catch(() => {});
    Audio.startMusic(stageIndex);
    this._last = performance.now();
  }

  // Tear down everything stage-specific (enemies, pickups, merchant, shrines, fx) and rebuild for the next stage.
  _gotoStage(next) {
    const p = this.player;
    for (const w of p.weapons) { if (w.orbs) { for (const o of w.orbs) this.weaponFx.remove(o); w.orbs = []; } }
    this.enemies = []; this.projectiles = []; this.eprojs = []; this.hazards = [];
    this.effects = []; this.pickups = []; this.allies = []; this.merchant = null; this.shrines = [];
    p.barrage = null;
    this.buildWorld(next); // disposes the old world (player mesh + weaponFx are detached first)
    this._setupStage(next);
  }
  _clearColliders(x, z, r) { this.colliders = this.colliders.filter((c) => (c.x - x) ** 2 + (c.z - z) ** 2 > (r + c.r) ** 2); }

  quit() { this.quitToMenu(); }
  quitToMenu() {
    if (this.run && !this.run.over && this.state === 'playing') {
      this.run.over = true;
      try { this._recordBest(); this.recordRun('quit'); } catch (e) { console.warn(e); }
    }
    this.state = 'menu';
    this.pauseCount = 0; this.levelUpOpen = false; this.transitioning = false;
    if (this.fadeEl) this.fadeEl.style.opacity = '0';
    Audio.stopMusic();
    this.promptEl.style.display = 'none';
    if (this.reticle) this.reticle.visible = false;
    this.ui?.hideHUD?.();
    this.player = null; this.weaponFx = null;
    this.enemies = []; this.projectiles = []; this.eprojs = []; this.hazards = []; this.effects = []; this.pickups = []; this.allies = [];
    this.merchant = null; this.shrines = [];
    this.buildWorld(this.lastRunOpts?.stageIndex || 0);
    this.run = null;
    this.ui?.showMainMenu?.();
  }

  // ======================= stats =======================
  computeStats() {
    const p = this.player; if (!p) return;
    const s = { ...DEFAULT_STATS, ...(p.char.baseStats || {}) };
    const add = (o) => { if (o) for (const k in o) if (typeof o[k] === 'number') s[k] = (s[k] || 0) + o[k]; };
    add(p.char.passive?.stats);
    for (const it of p.items) add(it.stats);
    add(p.runeStats);
    for (const b of p.buffs) add(b.rune?.stats);
    const mults = [];
    for (const u of p.upgrades) {
      if (u.mode === 'mult') mults.push(u); else s[u.stat] = (s[u.stat] || 0) + u.amount;
    }
    for (const u of mults) s[u.stat] = (s[u.stat] || 0) * u.amount;
    s.dodge = clamp(s.dodge, 0, 0.7); s.cooldown = clamp(s.cooldown, 0.3, 3); s.critChance = clamp(s.critChance, 0, 1);
    s.moveSpeed = Math.max(1.5, s.moveSpeed); s.attackSpeed = Math.max(0.2, s.attackSpeed); s.area = Math.max(0.3, s.area);
    s.damage = Math.max(0.1, s.damage); s.maxHp = Math.max(1, Math.round(s.maxHp)); s.projectiles = Math.max(0, Math.floor(s.projectiles));
    s.lifesteal = clamp(s.lifesteal, 0, 0.5);
    const oldMax = p.stats.maxHp;
    p.stats = s;
    if (p.hp != null && s.maxHp > oldMax) p.hp += s.maxHp - oldMax;
    p.maxHp = s.maxHp; p.hp = Math.min(p.hp ?? s.maxHp, s.maxHp);
    p.effects = {};
    for (const it of p.items) if (it.effect) p.effects[it.effect] = (p.effects[it.effect] || 0) + (it.effectValue ?? 1);
    if (p.char.id === 'antknight') p.effects.thorns = (p.effects.thorns || 0) + 0.2;
    if (p.char.id === 'nacho') p.effects.thorns = (p.effects.thorns || 0) + 0.35;
  }
  eff(key) { return this.player?.effects?.[key] || 0; }

  // ======================= weapons =======================
  addWeapon(id) {
    const def = D.WEAPONS?.[id]; if (!def) return;
    const p = this.player;
    const w = p.weapons.find((x) => x.id === id);
    if (w) { w.level = Math.min(def.maxLevel || 8, w.level + 1); return; }
    if (p.weapons.length >= MAX_WEAPONS) return;
    p.weapons.push({ id, def, level: 1, timer: 0.3, hits: new Map(), orbs: [], angle: 0 });
  }
  wp(w) {
    const b = w.def.base || {}, pl = w.def.perLevel || {}, o = {};
    for (const k of new Set([...Object.keys(b), ...Object.keys(pl)])) o[k] = (b[k] || 0) + (pl[k] || 0) * (w.level - 1);
    return o;
  }
  rollDamage(base) {
    const p = this.player, s = p.stats;
    let d = base * s.damage;
    const low = this.eff('lowHpDamage'); if (low && p.hp < p.stats.maxHp * 0.4) d *= 1 + low;
    const crit = Math.random() < s.critChance;
    if (crit) d *= s.critDamage;
    return { d: d * rand(0.92, 1.08), crit };
  }
  nearestEnemy(x, z, range = 1e9, exclude = null) {
    let best = null, bd = range * range;
    for (const e of this.enemies) {
      if (!e.alive || (exclude && exclude.has(e))) continue;
      const d = (e.pos.x - x) ** 2 + (e.pos.z - z) ** 2;
      if (d < bd) { bd = d; best = e; }
    }
    return best;
  }
  // ======================= aiming =======================
  aimMode() {
    let m = S('aimMode', null);
    if (m == null) { const legacy = S('autoAim', null); m = legacy === 'mouse' ? 'mouse' : 'smart'; }
    if (m === 'nearest') m = 'closest';
    return m === 'mouse' || m === 'closest' ? m : 'smart';
  }
  // Mouse cursor projected onto the ground plane (y=0). Recomputed each frame so camera motion is accounted for.
  mouseGround() {
    if (!this.mouse) return null;
    const rect = this.renderer.domElement.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    const ndc = this._ndc || (this._ndc = new THREE.Vector2());
    ndc.set(((this.mouse.x - rect.left) / rect.width) * 2 - 1, -((this.mouse.y - rect.top) / rect.height) * 2 + 1);
    const rc = this._ray || (this._ray = new THREE.Raycaster());
    rc.setFromCamera(ndc, this.camera);
    const out = this._mouseHit || (this._mouseHit = new THREE.Vector3());
    const plane = this._groundPlane || (this._groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0));
    return rc.ray.intersectPlane(plane, out) ? out : null;
  }
  _leadPoint(e, speed) {
    if (!speed || !(e.vx || e.vz)) return { x: e.pos.x, z: e.pos.z };
    const p = this.player.pos;
    let t = Math.hypot(e.pos.x - p.x, e.pos.z - p.z) / speed;
    for (let i = 0; i < 2; i++) { const lx = e.pos.x + e.vx * t, lz = e.pos.z + e.vz * t; t = Math.hypot(lx - p.x, lz - p.z) / speed; }
    t = Math.min(t, 1.5);
    return { x: e.pos.x + e.vx * t, z: e.pos.z + e.vz * t };
  }
  _smartTarget(range) {
    const p = this.player.pos, r2 = range * range;
    let boss = null, elite = null, eliteD = Infinity;
    for (const e of this.enemies) {
      if (!e.alive || e.emerge) continue;
      const d = (e.pos.x - p.x) ** 2 + (e.pos.z - p.z) ** 2; if (d > r2) continue;
      if (e.boss) { boss = e; break; }
      if (e.elite && d < eliteD) { elite = e; eliteD = d; }
    }
    if (boss || elite) return boss || elite;
    // densest cluster: score a sample of candidates by neighbour count (cached per frame per range bucket)
    const key = Math.round(range);
    const cache = this._clusterCache || (this._clusterCache = { frame: -1, map: new Map() });
    if (cache.frame !== this._frame) { cache.frame = this._frame; cache.map.clear(); }
    if (cache.map.has(key)) { const c = cache.map.get(key); if (!c || c.alive) return c; }
    let best = null, bestScore = -1, n = 0;
    for (const e of this.enemies) {
      if (!e.alive || e.emerge) continue;
      const d2 = (e.pos.x - p.x) ** 2 + (e.pos.z - p.z) ** 2; if (d2 > r2) continue;
      if (++n > 40) break;
      let cnt = 0; this.queryEnemies(e.pos.x, e.pos.z, 3, () => { cnt++; });
      const score = cnt - Math.sqrt(d2) * 0.05 + (e.hp < e.maxHp * 0.3 ? 0.5 : 0);
      if (score > bestScore) { bestScore = score; best = e; }
    }
    if (best && bestScore < 1.5) best = this.nearestEnemy(p.x, p.z, range); // no real cluster -> closest
    cache.map.set(key, best);
    return best;
  }
  // Returns { x, z, target } to fire at, or null when nothing should be fired at.
  aim(range, projSpeed = 0, mode = this.aimMode()) {
    const p = this.player.pos;
    if (mode === 'mouse') {
      const m = this.mouseGround();
      if (m && (Math.abs(m.x - p.x) + Math.abs(m.z - p.z)) > 0.05) return { x: m.x, z: m.z, target: null, mouse: true };
      return { x: p.x + this.player.facing.x, z: p.z + this.player.facing.z, target: null, mouse: true };
    }
    const t = mode === 'closest' ? this.nearestEnemy(p.x, p.z, range) : this._smartTarget(range);
    if (!t) return null;
    const lp = mode === 'smart' && projSpeed ? this._leadPoint(t, projSpeed) : { x: t.pos.x, z: t.pos.z };
    return { x: lp.x, z: lp.z, target: t };
  }
  _makeReticle() {
    const g = new THREE.Group();
    const mat = new THREE.MeshBasicMaterial({ color: 0xffd040, transparent: true, opacity: 0.85, depthWrite: false, side: THREE.DoubleSide });
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.55, 0.7, 24), mat); ring.rotation.x = -Math.PI / 2; g.add(ring);
    const dot = new THREE.Mesh(new THREE.CircleGeometry(0.12, 10), mat); dot.rotation.x = -Math.PI / 2; g.add(dot);
    for (let i = 0; i < 4; i++) {
      const tick = new THREE.Mesh(new THREE.PlaneGeometry(0.1, 0.35), mat); tick.rotation.x = -Math.PI / 2;
      const a = i * Math.PI / 2; tick.position.set(Math.sin(a) * 0.9, 0, Math.cos(a) * 0.9); tick.rotation.z = a; g.add(tick);
    }
    g.position.y = 0.07; g.visible = false; g.renderOrder = 5;
    this.scene.add(g); // lives in the scene (not the world) so it survives world rebuilds
    this.reticle = g;
  }
  updateReticle(dt) {
    const g = this.reticle; if (!g) return;
    const show = this.state === 'playing' && this.player && S('showAimIndicator', true) !== false;
    if (!show) { g.visible = false; return; }
    const a = this.aim(16, 0);
    if (!a) { g.visible = false; return; }
    g.visible = true;
    g.position.set(a.x, 0.07, a.z);
    g.rotation.y += dt * 1.5;
    const k = a.target?.boss || a.target?.elite ? 1.6 : a.target ? Math.max(0.8, a.target.r * 1.6) : 1;
    g.scale.setScalar(k);
    g.children[0].material.color.set(a.mouse ? '#ffd040' : a.target?.boss ? '#ff3030' : a.target?.elite ? '#ff9a00' : '#ffffff');
  }

  updateWeapons(dt) {
    const p = this.player, s = p.stats, mode = this.aimMode();
    for (const w of p.weapons) {
      const prm = this.wp(w); const type = w.def.type;
      const area = (prm.area || 1) * s.area;
      const cd = Math.max(0.08, (prm.cooldown || 1) * s.cooldown / s.attackSpeed);
      const range = prm.range || 8;
      if (type === 'orbit') { this.updateOrbit(w, prm, s, dt); continue; }
      if (type === 'aura') { this.updateAura(w, prm, area, cd, dt); continue; }
      w.timer -= dt; if (w.timer > 0) continue;
      const color = w.def.color || '#ffffff';
      const count = Math.max(1, Math.floor(prm.count || 1));
      if (type === 'nova') {
        if (!this.nearestEnemy(p.pos.x, p.pos.z, area + 1)) { w.timer = 0.15; continue; }
        w.timer = cd;
        this.areaDamage(p.pos.x, p.pos.z, area, prm.damage || 10, color, true);
        continue;
      }
      const searchR = Math.max(range, 6) * 1.6;
      const isProj = type === 'projectile';
      const aim = this.aim(type === 'melee' ? Math.max((prm.range || 3) * Math.sqrt(area) + 1.5, 4) : searchR, isProj ? (prm.speed || 12) : 0, mode);
      if (!aim) { w.timer = 0.15; continue; }
      let base = Math.atan2(aim.x - p.pos.x, aim.z - p.pos.z);
      if (!isFinite(base)) base = Math.atan2(p.facing.x, p.facing.z);
      if (type === 'chain') {
        // chain needs a real enemy: the one nearest the aim point
        const tgt = aim.target || this.nearestEnemy(aim.x, aim.z, Math.max(4, range)) || this.nearestEnemy(p.pos.x, p.pos.z, searchR);
        if (!tgt) { w.timer = 0.15; continue; }
        w.timer = cd;
        this.chainLightning(p.pos, tgt, count + s.projectiles, (prm.range || 6) * Math.sqrt(s.area), prm.damage || 10, color);
        continue;
      }
      w.timer = cd;
      if (type === 'projectile') {
        const n = count + s.projectiles;
        const homing = /homing/i.test(w.def.desc || '');
        const explode = /explod|blast/i.test(w.def.desc || '') ? area * 1.2 : 0;
        for (let i = 0; i < n; i++) {
          const a = base + (i - (n - 1) / 2) * 0.16;
          this.spawnProjectile({ x: p.pos.x, z: p.pos.z, a, speed: prm.speed || 12, dmg: prm.damage || 10, pierce: Math.max(1, Math.floor(prm.pierce || 1)),
            life: Math.max(0.4, ((range * 1.6) / (prm.speed || 12))), color, scale: clamp(Math.sqrt(prm.area || 1), 0.7, 2), homing, explode });
        }
        Audio.play('shoot');
      } else if (type === 'boomerang') {
        const n = count + s.projectiles;
        for (let i = 0; i < n; i++) {
          const a = base + (i - (n - 1) / 2) * 0.5;
          this.spawnProjectile({ x: p.pos.x, z: p.pos.z, a, speed: prm.speed || 12, dmg: prm.damage || 10, pierce: 9999, life: 6, color, boomerang: true,
            range: range * Math.sqrt(s.area), scale: clamp(prm.area || 1, 0.8, 2) });
        }
        Audio.play('shoot');
      } else if (type === 'melee') {
        const radius = (prm.range || 3) * Math.sqrt(area);
        for (let i = 0; i < count; i++) {
          const a = base + i * Math.PI;
          this.meleeSwing(p.pos.x, p.pos.z, a, radius, Math.PI * 0.75, prm.damage || 10, color);
        }
      }
    }
  }
  updateOrbit(w, prm, s, dt) {
    const p = this.player;
    const n = Math.max(1, Math.floor(prm.count || 1)) + s.projectiles;
    const radius = (prm.range || 2.5) * s.area;
    while (w.orbs.length < n) { const m = new THREE.Mesh(GEO.orb, basicMat(w.def.color || '#cccccc')); this.weaponFx.add(m); w.orbs.push(m); }
    while (w.orbs.length > n) this.weaponFx.remove(w.orbs.pop());
    w.angle += dt * clamp(prm.speed || 3, 1, 8) * s.attackSpeed;
    const hitCd = Math.max(0.2, 0.6 / s.attackSpeed);
    const sc = clamp(Math.sqrt(s.area), 0.8, 2);
    for (let i = 0; i < n; i++) {
      const a = w.angle + (i / n) * Math.PI * 2;
      const m = w.orbs[i];
      m.position.set(p.pos.x + Math.sin(a) * radius, 0.8, p.pos.z + Math.cos(a) * radius);
      m.rotation.y += dt * 8; m.scale.setScalar(sc);
      this.queryEnemies(m.position.x, m.position.z, 0.6 * sc + 0.6, (e) => {
        const last = w.hits.get(e) || 0;
        if (this.run.time - last < hitCd) return;
        w.hits.set(e, this.run.time);
        const r = this.rollDamage(prm.damage || 8);
        this.damageEnemy(e, r.d, r.crit, { kx: Math.sin(a), kz: Math.cos(a), knock: 0.4 });
      });
    }
    if (w.hits.size > 500) w.hits.clear();
  }
  updateAura(w, prm, area, cd, dt) {
    const p = this.player;
    const radius = area;
    if (!w.auraMesh) {
      w.auraMesh = new THREE.Mesh(GEO.disc, basicMat(w.def.color || '#ff80ff', 0.18)); w.auraMesh.rotation.x = -Math.PI / 2;
      w.auraRing = new THREE.Mesh(GEO.ring, basicMat(w.def.color || '#ff80ff', 0.5)); w.auraRing.rotation.x = -Math.PI / 2;
      this.weaponFx.add(w.auraMesh, w.auraRing);
    }
    const pulse = 1 + Math.sin(this.run.time * 4) * 0.03;
    w.auraMesh.position.set(p.pos.x, 0.05, p.pos.z); w.auraMesh.scale.setScalar(radius * pulse);
    w.auraRing.position.set(p.pos.x, 0.06, p.pos.z); w.auraRing.scale.setScalar(radius * pulse);
    w.timer -= dt; if (w.timer > 0) return;
    w.timer = cd;
    const slow = /slow|chill|frost/i.test(w.def.desc || '');
    this.queryEnemies(p.pos.x, p.pos.z, radius, (e) => {
      const r = this.rollDamage(prm.damage || 4);
      this.damageEnemy(e, r.d, r.crit, { quiet: true });
      if (slow) e.slow = 0.6;
    });
  }
  spawnProjectile(o) {
    const m = new THREE.Mesh(o.boomerang ? GEO.boom : GEO.proj, basicMat(o.color || '#ffffff'));
    m.position.set(o.x, 0.8, o.z); m.scale.setScalar(o.scale || 1);
    this.world.add(m);
    this.projectiles.push({ mesh: m, vx: Math.sin(o.a) * o.speed, vz: Math.cos(o.a) * o.speed, speed: o.speed, life: o.life, dmg: o.dmg,
      pierce: o.pierce, hit: new Set(), boomerang: !!o.boomerang, range: o.range || 8, dist: 0, back: false, homing: !!o.homing,
      explode: o.explode || 0, raw: !!o.raw, color: o.color, hitT: new Map(), r: 0.35 * (o.scale || 1) });
  }
  updateProjectiles(dt) {
    const p = this.player;
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const pr = this.projectiles[i];
      pr.life -= dt;
      if (pr.boomerang) {
        pr.mesh.rotation.y += dt * 18;
        if (!pr.back) { pr.dist += pr.speed * dt; if (pr.dist >= pr.range) pr.back = true; }
        else {
          const dx = p.pos.x - pr.mesh.position.x, dz = p.pos.z - pr.mesh.position.z, d = Math.hypot(dx, dz) || 1;
          pr.vx = dx / d * pr.speed * 1.2; pr.vz = dz / d * pr.speed * 1.2;
          if (d < 0.8) pr.life = 0;
        }
      } else if (pr.homing) {
        const t = this.nearestEnemy(pr.mesh.position.x, pr.mesh.position.z, 10, pr.hit);
        if (t) {
          const dx = t.pos.x - pr.mesh.position.x, dz = t.pos.z - pr.mesh.position.z, d = Math.hypot(dx, dz) || 1;
          pr.vx += (dx / d * pr.speed - pr.vx) * Math.min(1, dt * 5); pr.vz += (dz / d * pr.speed - pr.vz) * Math.min(1, dt * 5);
        }
      }
      pr.mesh.position.x += pr.vx * dt; pr.mesh.position.z += pr.vz * dt;
      if (pr.life > 0) {
        this.queryEnemies(pr.mesh.position.x, pr.mesh.position.z, pr.r + 0.2, (e) => {
          if (pr.life <= 0) return;
          if (pr.boomerang) {
            const last = pr.hitT.get(e); if (last != null && this.run.time - last < 0.4) return; pr.hitT.set(e, this.run.time);
          } else { if (pr.hit.has(e)) return; pr.hit.add(e); }
          let d = pr.dmg, crit = false;
          if (!pr.raw) { const r = this.rollDamage(pr.dmg); d = r.d; crit = r.crit; }
          const len = Math.hypot(pr.vx, pr.vz) || 1;
          this.damageEnemy(e, d, crit, { kx: pr.vx / len, kz: pr.vz / len, knock: 0.25 });
          if (pr.explode) this.areaDamage(pr.mesh.position.x, pr.mesh.position.z, pr.explode, pr.dmg * 0.6, pr.color, false, pr.raw);
          if (!pr.boomerang && --pr.pierce <= 0) pr.life = 0;
        });
      }
      if (pr.life <= 0) { this.world.remove(pr.mesh); this.projectiles[i] = this.projectiles[this.projectiles.length - 1]; this.projectiles.pop(); }
    }
  }
  meleeSwing(x, z, angle, radius, arc, dmg, color) {
    const geo = new THREE.RingGeometry(0.25, 1, 20, 1, -arc / 2, arc);
    const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: new THREE.Color(color), transparent: true, opacity: 0.6, side: THREE.DoubleSide, depthWrite: false }));
    m.rotation.x = -Math.PI / 2; m.rotation.z = angle - Math.PI / 2; // ring theta 0 = +x
    m.position.set(x, 0.3, z); m.scale.setScalar(radius);
    this.addEffect(m, 0.2, (fx, k) => { fx.mesh.material.opacity = 0.6 * (1 - k); fx.mesh.scale.setScalar(radius * (0.8 + 0.2 * k)); }, true);
    this.queryEnemies(x, z, radius + 0.5, (e) => {
      const dx = e.pos.x - x, dz = e.pos.z - z;
      let da = Math.atan2(dx, dz) - angle; da = Math.atan2(Math.sin(da), Math.cos(da));
      if (Math.abs(da) > arc / 2 + 0.2 && dx * dx + dz * dz > 1) return;
      const r = this.rollDamage(dmg);
      const len = Math.hypot(dx, dz) || 1;
      this.damageEnemy(e, r.d, r.crit, { kx: dx / len, kz: dz / len, knock: 0.6 });
    });
    Audio.play('hit');
  }
  areaDamage(x, z, radius, dmg, color, roll = true, raw = false, opts = {}) {
    const m = new THREE.Mesh(GEO.ring, new THREE.MeshBasicMaterial({ color: new THREE.Color(color || '#ffffff'), transparent: true, opacity: 0.7, depthWrite: false, side: THREE.DoubleSide }));
    m.rotation.x = -Math.PI / 2; m.position.set(x, 0.2, z);
    this.addEffect(m, 0.3, (fx, k) => { fx.mesh.scale.setScalar(radius * (0.3 + 0.7 * k)); fx.mesh.material.opacity = 0.7 * (1 - k); }, false, true);
    this.queryEnemies(x, z, radius, (e) => {
      let d = dmg, crit = false;
      if (roll && !raw) { const r = this.rollDamage(dmg); d = r.d; crit = r.crit; }
      const dx = e.pos.x - x, dz = e.pos.z - z, len = Math.hypot(dx, dz) || 1;
      this.damageEnemy(e, d, crit, { kx: dx / len, kz: dz / len, knock: opts.knock ?? 0.5, noProc: opts.noProc, quiet: opts.quiet });
      if (opts.stun) e.freeze = Math.max(e.freeze, opts.stun);
    });
  }
  chainLightning(from, first, hops, hopRange, dmg, color, noProc = false) {
    const hit = new Set(); let cur = first; const pts = [new THREE.Vector3(from.x, 0.9, from.z)];
    for (let i = 0; i < hops && cur; i++) {
      hit.add(cur); pts.push(new THREE.Vector3(cur.pos.x, 0.9, cur.pos.z));
      const r = noProc ? { d: dmg, crit: false } : this.rollDamage(dmg);
      this.damageEnemy(cur, r.d, r.crit, { noProc });
      cur = this.nearestEnemy(cur.pos.x, cur.pos.z, hopRange, hit);
    }
    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: new THREE.Color(color || '#7fe8ff'), transparent: true }));
    this.addEffect(line, 0.18, (fx, k) => { fx.mesh.material.opacity = 1 - k; }, true);
    Audio.play('shoot');
  }
  addEffect(mesh, dur, update, ownGeo = false, ownMat = true) {
    this.world.add(mesh);
    this.effects.push({ mesh, t: 0, dur, update, ownGeo, ownMat });
  }
  updateEffects(dt) {
    for (let i = this.effects.length - 1; i >= 0; i--) {
      const fx = this.effects[i]; fx.t += dt;
      const k = Math.min(1, fx.t / fx.dur);
      fx.update?.(fx, k);
      if (fx.t >= fx.dur) {
        this.world.remove(fx.mesh);
        if (fx.ownGeo) fx.mesh.geometry?.dispose();
        if (fx.ownMat) fx.mesh.material?.dispose?.();
        this.effects.splice(i, 1);
      }
    }
  }

  // ======================= abilities =======================
  useAbility(i) {
    const p = this.player; const ab = p?.abilities[i];
    if (!ab || !ab.def || ab.cd > 0) return;
    const d = ab.def, s = p.stats;
    ab.cdMax = (d.cooldown || 5) * s.cooldown; ab.cd = ab.cdMax;
    const color = d.color || '#ffffff';
    const dir = p.facing.clone();
    Audio.play('ability');
    switch (d.kind) {
      case 'dash': p.dash = { t: d.duration || 0.25, dur: d.duration || 0.25, vx: dir.x, vz: dir.z, speed: 7 / (d.duration || 0.25) * 0.9 + 6, dmg: d.power || 0, r: d.radius || 1.5, hit: new Set() }; p.invuln = Math.max(p.invuln, (d.duration || 0.25) + 0.15); break;
      case 'blink': {
        const dist = d.radius || 7;
        this.ringFx(p.pos.x, p.pos.z, 1.5, color);
        p.pos.x = clamp(p.pos.x + dir.x * dist, -MAP_HALF, MAP_HALF); p.pos.z = clamp(p.pos.z + dir.z * dist, -MAP_HALF, MAP_HALF);
        this.ringFx(p.pos.x, p.pos.z, 2, color); p.invuln = Math.max(p.invuln, 0.4); break;
      }
      case 'nova': this.areaDamage(p.pos.x, p.pos.z, (d.radius || 5) * s.area, d.power || 40, color, true, false, { knock: 1.5 }); this.addShake(0.3); break;
      case 'slam': this.areaDamage(p.pos.x, p.pos.z, (d.radius || 4) * s.area, d.power || 50, color, true, false, { knock: 1, stun: 1 }); this.addShake(0.5); break;
      case 'shield': p.shield = { t: d.duration || 2, reduce: d.power > 0 && d.power < 1 ? d.power : 1 }; break;
      case 'heal': {
        const pct = (d.power || 30) > 1 ? (d.power || 30) / 100 : d.power;
        const amt = pct * s.maxHp;
        if ((d.duration || 0) > 0) p.heal = { t: d.duration, rate: amt / d.duration }; else this.healPlayer(amt);
        this.ringFx(p.pos.x, p.pos.z, 2, color); break;
      }
      case 'summon': {
        const n = /swarm|flock|bees/i.test(d.name + d.desc) ? 5 : 1;
        for (let k = 0; k < n; k++) {
          const turret = /turret/i.test(d.name);
          const g = turret ? new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.5, 0.9, 6), basicMat(color)) : new THREE.Mesh(GEO.orb, basicMat(color));
          g.position.set(p.pos.x + rand(-1.5, 1.5), turret ? 0.45 : 1.3, p.pos.z + rand(-1.5, 1.5));
          this.world.add(g);
          this.allies.push({ mesh: g, t: d.duration || 8, cd: rand(0, 0.5), dmg: d.power || 10, range: d.radius || 7, turret, a: rand(0, 6.28), color, ownGeo: turret });
        }
        break;
      }
      case 'barrage': {
        const n = 10 + s.projectiles * 2;
        const dur = d.duration || 1.5;
        p.barrage = { t: dur, every: dur / n, acc: 0, dmg: d.power || 20, color, area: d.radius || 6 };
        break;
      }
      default: this.areaDamage(p.pos.x, p.pos.z, 4, d.power || 30, color);
    }
    this.ui?.log?.(`${d.name}!`, color);
  }
  ringFx(x, z, r, color) {
    const m = new THREE.Mesh(GEO.ring, new THREE.MeshBasicMaterial({ color: new THREE.Color(color), transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false }));
    m.rotation.x = -Math.PI / 2; m.position.set(x, 0.2, z);
    this.addEffect(m, 0.35, (fx, k) => { fx.mesh.scale.setScalar(r * (0.3 + k)); fx.mesh.material.opacity = 0.8 * (1 - k); });
  }
  updateAbilities(dt) {
    const p = this.player;
    for (const ab of p.abilities) if (ab.cd > 0) ab.cd = Math.max(0, ab.cd - dt);
    if (p.shield) { p.shield.t -= dt; if (p.shield.t <= 0) p.shield = null; }
    if (p.heal) { this.healPlayer(p.heal.rate * dt); p.heal.t -= dt; if (p.heal.t <= 0) p.heal = null; }
    if (p.barrage) {
      const b = p.barrage; b.t -= dt; b.acc += dt;
      while (b.acc >= b.every) {
        b.acc -= b.every;
        const t = this.aim(18, 16);
        const a = t ? Math.atan2(t.x - p.pos.x, t.z - p.pos.z) + rand(-0.4, 0.4) : rand(0, Math.PI * 2);
        this.spawnProjectile({ x: p.pos.x, z: p.pos.z, a, speed: 16, dmg: b.dmg, pierce: 1, life: 1.4, color: b.color, homing: true, explode: 1.5 });
      }
      if (b.t <= 0) p.barrage = null;
    }
    for (let i = this.allies.length - 1; i >= 0; i--) {
      const al = this.allies[i]; al.t -= dt; al.cd -= dt;
      if (!al.turret) {
        al.a += dt * 2;
        const tx = p.pos.x + Math.sin(al.a) * 2.2, tz = p.pos.z + Math.cos(al.a) * 2.2;
        al.mesh.position.x += (tx - al.mesh.position.x) * Math.min(1, dt * 4); al.mesh.position.z += (tz - al.mesh.position.z) * Math.min(1, dt * 4);
      }
      if (al.cd <= 0) {
        const t = this.nearestEnemy(al.mesh.position.x, al.mesh.position.z, al.range * 1.5);
        if (t) {
          al.cd = al.turret ? 0.35 : 0.6;
          const a = Math.atan2(t.pos.x - al.mesh.position.x, t.pos.z - al.mesh.position.z);
          this.spawnProjectile({ x: al.mesh.position.x, z: al.mesh.position.z, a, speed: 18, dmg: al.dmg, pierce: 1, life: 1, color: al.color });
        } else al.cd = 0.2;
      }
      if (al.t <= 0) { this.world.remove(al.mesh); if (al.ownGeo) al.mesh.geometry.dispose(); this.allies.splice(i, 1); }
    }
  }

  // ======================= player =======================
  healPlayer(a) { const p = this.player; p.hp = Math.min(p.stats.maxHp, p.hp + a); }
  updatePlayer(dt) {
    const p = this.player, s = p.stats;
    let mx = 0, mz = 0;
    if (this.isHeld('up') || this.keys.has('arrowup')) mz -= 1;
    if (this.isHeld('down') || this.keys.has('arrowdown')) mz += 1;
    if (this.isHeld('left') || this.keys.has('arrowleft')) mx -= 1;
    if (this.isHeld('right') || this.keys.has('arrowright')) mx += 1;
    const len = Math.hypot(mx, mz);
    p.moving = len > 0;
    if (p.dash) {
      const d = p.dash; d.t -= dt;
      p.pos.x += d.vx * d.speed * dt; p.pos.z += d.vz * d.speed * dt;
      if (d.dmg > 0) this.queryEnemies(p.pos.x, p.pos.z, d.r, (e) => {
        if (d.hit.has(e)) return; d.hit.add(e);
        const r = this.rollDamage(d.dmg); this.damageEnemy(e, r.d, r.crit, { kx: d.vx, kz: d.vz, knock: 1.2 });
      });
      if (d.t <= 0) p.dash = null;
      p.moving = true;
    } else if (len > 0) {
      mx /= len; mz /= len;
      p.pos.x += mx * s.moveSpeed * dt; p.pos.z += mz * s.moveSpeed * dt;
      p.facing.set(mx, 0, mz);
    }
    // colliders
    for (const c of this.colliders) {
      const dx = p.pos.x - c.x, dz = p.pos.z - c.z; const rr = c.r + 0.45;
      const d2 = dx * dx + dz * dz;
      if (d2 < rr * rr && d2 > 1e-6) { const d = Math.sqrt(d2); p.pos.x = c.x + dx / d * rr; p.pos.z = c.z + dz / d * rr; }
    }
    // soft boundary
    const lim = MAP_HALF;
    if (Math.abs(p.pos.x) > lim) p.pos.x -= Math.sign(p.pos.x) * (Math.abs(p.pos.x) - lim) * Math.min(1, dt * 8);
    if (Math.abs(p.pos.z) > lim) p.pos.z -= Math.sign(p.pos.z) * (Math.abs(p.pos.z) - lim) * Math.min(1, dt * 8);
    p.pos.x = clamp(p.pos.x, -lim - 4, lim + 4); p.pos.z = clamp(p.pos.z, -lim - 4, lim + 4);
    const targetRot = Math.atan2(p.facing.x, p.facing.z);
    let dr = targetRot - p.mesh.rotation.y; dr = Math.atan2(Math.sin(dr), Math.cos(dr));
    p.mesh.rotation.y += dr * Math.min(1, dt * 14);
    try { M.animate?.(p.mesh, this.run.time, p.moving); } catch {}
    // blink while invulnerable
    p.mesh.visible = !(p.invuln > 0 && p.hurtFlash > 0) || Math.floor(this.run.time * 20) % 2 === 0;
    if (p.invuln > 0) p.invuln -= dt;
    if (p.hurtFlash > 0) p.hurtFlash -= dt;
    // regen
    if (s.hpRegen > 0 && p.hp > 0) this.healPlayer(s.hpRegen * dt);
    // buffs
    for (let i = p.buffs.length - 1; i >= 0; i--) {
      const b = p.buffs[i]; b.remaining -= dt;
      if (b.remaining <= 0) { p.buffs.splice(i, 1); this.computeStats(); }
    }
    const has = (eff) => p.buffs.some((b) => b.rune?.effect === eff);
    this.run.timeSlow = has('timeSlow'); this.run.doubleXp = has('doubleXp'); this.run.invuln = has('invuln');
  }
  damagePlayer(amount, src, srcType) {
    const p = this.player; if (!p || p.hp <= 0) return;
    const killerType = srcType || (src && !src.boss ? src.id : null);
    if (p.invuln > 0 || this.run.invuln) return;
    if (p.shield && p.shield.reduce >= 1) return;
    const s = p.stats;
    if (Math.random() < s.dodge) { this.numberAt(p.pos, 'Dodge', false, '#ffffff'); return; }
    let d = amount * (1 - s.armor / (s.armor + 25));
    if (p.shield) d *= 1 - p.shield.reduce;
    d = Math.max(1, d);
    p.hp -= d; p.invuln = 0.35; p.hurtFlash = 0.35;
    const th = this.eff('thorns');
    if (th && src && src.alive) this.damageEnemy(src, amount * th * s.damage + 3, false, { noProc: true });
    this.addShake(0.25); this.flash(0.25);
    Audio.play('hurt');
    if (p.hp <= 0) { this.run.killedBy = killerType || null; this.onPlayerDeath(); }
  }
  onPlayerDeath() {
    const p = this.player;
    if (p.lives > 0) {
      p.lives--; p.hp = p.stats.maxHp * 0.5; p.invuln = 3;
      this.areaDamage(p.pos.x, p.pos.z, 8, 200, '#ffb040', false, true, { knock: 3, noProc: true });
      this.ui?.log?.('You rise again from the ashes!', '#ff981f');
      return;
    }
    p.hp = 0;
    this._recordDeathBy(this.run.killedBy);
    this.endRun(false);
  }
  // Secret unlock: perish to every regular/elite enemy type (meta.deathsBy = {enemyId: count}).
  _recordDeathBy(type) {
    if (!type || !D.ENEMIES?.[type]) return;
    const m = this.meta; m.deathsBy = m.deathsBy && typeof m.deathsBy === 'object' ? m.deathsBy : {};
    m.deathsBy[type] = (m.deathsBy[type] || 0) + 1;
    this.saveMeta();
    this._checkNachoUnlock();
  }
  _checkNachoUnlock() {
    const ids = Object.keys(D.ENEMIES || {}), db = this.meta.deathsBy || {};
    if (!ids.length || !ids.every((id) => db[id] > 0)) return false;
    if (!this.unlockCharacter('nacho')) return false;
    const c = (D.CHARACTERS || []).find((x) => x.id === 'nacho');
    this.ui?.log?.('A crunchy legend emerges... ' + (c?.name || 'Nacho') + ' has joined the brawl!', '#ffb632');
    import('./titlecard.js').then((t) => t.showAreaBanner?.('A crunchy legend emerges...', (c?.name || 'Nacho') + ' unlocked!')).catch(() => {});
    if (this.run) (this.run.unlocks = this.run.unlocks || []).push(c?.name || 'Nacho');
    return true;
  }
  debugUnlock(id = 'nacho') {
    if (id === 'nacho') { this.meta.deathsBy = this.meta.deathsBy || {}; for (const k of Object.keys(D.ENEMIES || {})) this.meta.deathsBy[k] = this.meta.deathsBy[k] || 1; this.saveMeta(); return this._checkNachoUnlock() || this.isCharacterUnlocked(id); }
    return this.unlockCharacter(id);
  }
  score() {
    const r = this.run, p = this.player;
    const base = Math.floor((r.kills || 0) * 10 + (r.time || 0) * 2 + (p?.level || 1) * 50 + (r.bossesKilled || 0) * 1000);
    const mult = r.diff?.scoreMult ?? DIFF_SCORE_MULT[r.diff?.id] ?? 1;
    return Math.floor(base * mult);
  }
  summary(endedBy) {
    const r = this.run, p = this.player;
    return { character: p.char.id, characterId: p.char.id, characterName: p.char.name,
      stage: r.stageIndex, stageIndex: r.stageIndex, stageName: r.stage.name, difficulty: r.diff.id,
      time: r.time, kills: r.kills, level: p.level, gold: p.gold,
      damage: Math.round(r.dmgTotal), damageDealt: Math.round(r.dmgTotal), bossesKilled: r.bossesKilled || 0,
      endedBy: endedBy || (r.victory ? 'victory' : 'death'), loop: r.loop, score: this.score(), victory: !!r.victory,
      newBest: r.time > (r.prevBest || 0) && r.time > 0, bestTime: this.meta.bestTimes[r.stage.id] || 0,
      items: p.items.length, unlocks: (r.unlocks || []).slice(), date: Date.now(),
      weapons: p.weapons.map((w) => ({ id: w.id, name: w.def.name, icon: w.def.icon, level: w.level })) };
  }
  // Every run end (death / quit / victory) and every stage jump ('nextStage') goes through here. Stats are cumulative.
  recordRun(endedBy) {
    const sum = this.summary(endedBy);
    try { Accounts?.recordRun?.(sum); } catch (e) { console.warn('[recordRun]', e); }
    return sum;
  }
  _recordBest() {
    const r = this.run; const id = r.stage.id;
    const segTime = r.time - (r.stageStart || 0);
    if (segTime > (this.meta.bestTimes[id] || 0)) this.meta.bestTimes[id] = Math.floor(segTime);
    if (r.time > (this.meta.bestTime || 0)) this.meta.bestTime = Math.floor(r.time);
    this.meta.totalKills += r.kills - (r.seg?.kills || 0);
    if (r.time >= 600) { const c = (D.CHARACTERS || []).find((x) => /10 minutes/i.test(x.unlockHint || '')); if (c) this.unlockCharacter(c.id); }
    this.saveMeta();
  }
  endRun(victory) {
    if (!this.run || this.run.over) return;
    this.run.over = true; this.state = 'over';
    this.run.victory = !!victory;
    this._recordBest();
    Audio.stopMusic(); Audio.play(victory ? 'victory' : 'death');
    this.promptEl.style.display = 'none';
    if (this.reticle) this.reticle.visible = false;
    const sum = this.recordRun(victory ? 'victory' : 'death');
    const retry = () => this.startRun(this.lastRunOpts);
    const menu = () => this.quitToMenu();
    if (this.ui?.showGameOver) this.ui.showGameOver(sum, retry, menu); else menu();
  }

  // ======================= enemies =======================
  scaleMults() {
    const r = this.run, sc = D.SCALING || {}, si = r.stageIndex, m = r.time / 60, sm = r.diff.scalingMult || 1;
    let hp = (r.diff.enemyHp || 1) * (sc.stageHpMult?.[si] || 1) * growth(sc.hpPerMinute ?? 0.15, m * sm);
    let dmg = (r.diff.enemyDmg || 1) * (sc.stageDmgMult?.[si] || 1) * growth(sc.dmgPerMinute ?? 0.08, m * sm);
    let spawn = (r.diff.spawnRate || 1) * growth(sc.spawnPerMinute ?? 0.1, m);
    if (r.bossKilledAt != null) {
      const pm = (r.time - r.bossKilledAt) / 60, pb = sc.postBossMult ?? 1.25;
      hp *= growth(pb, pm); dmg *= growth(pb, pm * 0.6); spawn *= 1 + 0.15 * pm;
    }
    return { hp, dmg, spawn: Math.min(spawn, 6) };
  }
  _getEnemyMesh(key, def) {
    const pool = this.pools[key] || (this.pools[key] = []);
    let m = pool.pop();
    if (!m) {
      m = safeBuild(() => M.buildEnemy(def.model, def.color, def.size), () => blob(def.color || 0xff00ff, def.size || 1));
      if (S('quality', 'medium') === 'high') m.traverse((o) => { if (o.isMesh) o.castShadow = true; });
      this.world.add(m);
    }
    m.visible = true; m.scale.setScalar(1); m.rotation.set(0, 0, 0);
    return m;
  }
  spawnEnemy(id, x, z, opts = {}) {
    const def = opts.def || D.ENEMIES?.[id];
    if (!def) return null;
    if (!opts.force && this.enemies.length >= this.enemyCap) return null;
    const mult = this.scaleMults();
    const key = (opts.boss ? 'boss_' : '') + id;
    const mesh = opts.boss ? safeBuild(() => M.buildEnemy(def.model, def.color, def.size), () => blob(def.color, def.size)) : this._getEnemyMesh(key, def);
    if (opts.boss) { mesh.traverse((o) => { if (o.isMesh) o.castShadow = this.sun.castShadow; }); this.world.add(mesh); }
    mesh.position.set(x, 0, z);
    const sc = opts.scale || 1;
    mesh.scale.setScalar(sc);
    let hp = (def.hp || 10) * mult.hp * (opts.hpMult || 1);
    const e = {
      id, key, def, mesh, pos: mesh.position, hp, maxHp: hp, dmg: (def.damage || 5) * mult.dmg * (opts.dmgMult || 1),
      speed: (def.speed || 2) * (opts.speedMult || 1), size: (def.size || 1) * sc, r: 0.45 * (def.size || 1) * sc,
      behavior: opts.boss ? 'boss' : def.behavior || 'chase', t: rand(0, 3), cd: rand(1, 3), state: 0, alive: true,
      elite: !!opts.elite, boss: !!opts.boss, split: opts.split || 0, xp: (def.xp || 1) * (opts.xpMult || 1), touchCd: 0,
      burn: 0, burnDps: 0, freeze: 0, slow: 0, kx: 0, kz: 0, bar: null, hitPunch: 0, baseScale: sc,
    };
    if (e.boss) Object.assign(e, { phases: def.phases || 1, atkCd: 2.5, phase: 0, charge: null, spiral: null, name: def.name, title: def.title });
    this.enemies.push(e);
    return e;
  }
  spawnAround(id, opts = {}) {
    const p = this.player.pos;
    const a = rand(0, Math.PI * 2), r = rand(22, 30);
    const x = clamp(p.x + Math.sin(a) * r, -MAP_HALF, MAP_HALF), z = clamp(p.z + Math.cos(a) * r, -MAP_HALF, MAP_HALF);
    return this.spawnEnemy(id, x, z, opts);
  }
  updateSpawning(dt) {
    const r = this.run, st = r.stage;
    const mult = this.scaleMults();
    const rate = 1.1 * mult.spawn * (r.boss ? 0.5 : 1);
    r.spawnAcc += dt * rate;
    while (r.spawnAcc >= 1) {
      r.spawnAcc -= 1;
      const id = pick(st.enemies || Object.keys(D.ENEMIES));
      const def = D.ENEMIES[id];
      if (def?.behavior === 'swarm') {
        const lead = this.spawnAround(id);
        if (lead) for (let i = 0; i < 4; i++) this.spawnEnemy(id, lead.pos.x + rand(-2, 2), lead.pos.z + rand(-2, 2));
      } else this.spawnAround(id);
    }
    r.eliteTimer -= dt;
    if (r.eliteTimer <= 0 && st.elites?.length) {
      r.eliteTimer = Math.max(25, 55 - r.time / 30);
      const e = this.spawnAround(pick(st.elites), { force: true, elite: true, scale: 1.15, hpMult: 1.5, xpMult: 1.5 });
      if (e) this.ui?.log?.(`An elite ${e.def.name} approaches!`, '#ff981f');
    }
    // boss
    if (!r.boss && !r.bossPending && r.time >= r.nextBossAt) this.beginBossEmergence();
  }
  spawnBoss(hx, hz) {
    const r = this.run, bdef = D.BOSSES?.[r.stage.boss];
    if (!bdef) { r.nextBossAt = Infinity; return; }
    const loopMult = Math.pow(1.6, r.bossCount);
    // boss uses scaleMults for stage/difficulty but not minute growth (bosses are already big)
    const p = this.player.pos, a = rand(0, 6.28);
    const bx = hx ?? p.x + Math.sin(a) * 18, bz = hz ?? p.z + Math.cos(a) * 18;
    const minuteHp = growth(D.SCALING?.hpPerMinute ?? 0.15, (r.time / 60) * (r.diff.scalingMult || 1));
    const hpMult = loopMult / Math.max(1, Math.sqrt(minuteHp));
    const e = this.spawnEnemy(r.stage.boss, bx, bz, { def: bdef, boss: true, force: true, hpMult, dmgMult: 0.85 * Math.pow(1.2, r.bossCount), xpMult: 1 });
    if (!e) return;
    e.xp = 200 * (r.stageIndex + 1);
    r.boss = e; r.bossSpawned = true; r.bossCount++;
    r.nextBossAt = Infinity;
    e.emerge = { t: 0, dur: 2.4 };
    e.pos.y = -e.size * 2;
    this.ui?.log?.(`${bdef.name}${bdef.title ? ', ' + bdef.title + ',' : ''} claws its way out of the hole!`, '#ff0000');
    Audio.play('boss'); Audio.startMusic(r.stageIndex + 7, true);
    import('./titlecard.js').then((m) => m.showBossBanner?.(r.stage.boss)).catch(() => {});
    this.addShake(0.6);
  }
  buildGrid() {
    const g = this.grid || (this.grid = new Map()); g.clear();
    for (const e of this.enemies) {
      if (!e.alive) continue;
      const k = (Math.floor(e.pos.x / 3) + 512) * 1024 + (Math.floor(e.pos.z / 3) + 512);
      let c = g.get(k); if (!c) g.set(k, (c = [])); c.push(e);
    }
  }
  queryEnemies(x, z, r, cb) {
    const g = this.grid; if (!g) return;
    const ext = r + 3; // max enemy radius margin
    const x0 = Math.floor((x - ext) / 3), x1 = Math.floor((x + ext) / 3), z0 = Math.floor((z - ext) / 3), z1 = Math.floor((z + ext) / 3);
    for (let ix = x0; ix <= x1; ix++) for (let iz = z0; iz <= z1; iz++) {
      const c = g.get((ix + 512) * 1024 + (iz + 512)); if (!c) continue;
      for (let i = 0; i < c.length; i++) {
        const e = c[i]; if (!e.alive) continue;
        const rr = r + e.r; const dx = e.pos.x - x, dz = e.pos.z - z;
        if (dx * dx + dz * dz <= rr * rr) cb(e);
      }
    }
  }
  updateEnemies(dt) {
    const p = this.player, r = this.run;
    const slowAll = r.timeSlow ? 0.3 : 1;
    const animate = this.enemies.length < 160 || S('quality', 'medium') !== 'low';
    const bars = !!S('healthBars', true);
    for (let i = 0; i < this.enemies.length; i++) {
      const e = this.enemies[i]; if (!e.alive) continue;
      e.t += dt;
      // status
      if (e.burn > 0) { e.burn -= dt; e.burnAcc = (e.burnAcc || 0) + dt; if (e.burnAcc >= 0.5) { e.burnAcc = 0; this.damageEnemy(e, e.burnDps * 0.5, false, { noProc: true, quiet: true, color: '#ff8030' }); if (!e.alive) continue; } }
      if (e.slow > 0) e.slow -= dt;
      const dx = p.pos.x - e.pos.x, dz = p.pos.z - e.pos.z; const dist = Math.hypot(dx, dz) || 0.001;
      const nx = dx / dist, nz = dz / dist;
      // recycle far-away enemies
      if (!e.boss && dist > 55) {
        const a = rand(0, 6.28); e.pos.x = clamp(p.pos.x + Math.sin(a) * 26, -MAP_HALF, MAP_HALF); e.pos.z = clamp(p.pos.z + Math.cos(a) * 26, -MAP_HALF, MAP_HALF); continue;
      }
      let vx = 0, vz = 0;
      const spd = e.speed * slowAll * (e.slow > 0 ? 0.5 : 1);
      if (e.freeze > 0) { e.freeze -= dt; }
      else if (e.boss) { const v = this.updateBoss(e, dt, nx, nz, dist, spd); vx = v[0]; vz = v[1]; }
      else switch (e.behavior) {
        case 'ranged': {
          const want = 9;
          const f = dist > want + 1 ? 1 : dist < want - 2 ? -0.7 : 0;
          vx = (nx * f + -nz * 0.4) * spd; vz = (nz * f + nx * 0.4) * spd;
          e.cd -= dt * slowAll;
          if (e.cd <= 0 && dist < 18) {
            e.cd = rand(2, 3.2);
            const pj = e.def.projectile || {};
            this.spawnEnemyProjectile(e.pos.x, e.pos.z, Math.atan2(dx, dz), pj.speed || 8, (pj.damage || e.def.damage || 5) * this.scaleMults().dmg * (e.elite ? 1.3 : 1), pj.color || e.def.color, 4, e.id);
            if (e.elite) for (const off of [-0.25, 0.25]) this.spawnEnemyProjectile(e.pos.x, e.pos.z, Math.atan2(dx, dz) + off, pj.speed || 8, (pj.damage || 5) * this.scaleMults().dmg, pj.color || e.def.color, 4, e.id);
          }
          break;
        }
        case 'charger': {
          if (e.state === 0) { vx = nx * spd; vz = nz * spd; e.cd -= dt; if (dist < 12 && e.cd <= 0) { e.state = 1; e.st = 0.6; e.cx = nx; e.cz = nz; } }
          else if (e.state === 1) { e.st -= dt; e.mesh.position.y = Math.abs(Math.sin(e.t * 30)) * 0.15; if (e.st <= 0) { e.state = 2; e.st = 0.7; } }
          else { vx = e.cx * spd * 4; vz = e.cz * spd * 4; e.st -= dt; if (e.st <= 0) { e.state = 0; e.cd = rand(2, 3.5); e.mesh.position.y = 0; } }
          break;
        }
        case 'swarm': { const w = Math.sin(e.t * 4 + i) * 0.6; vx = (nx - nz * w) * spd; vz = (nz + nx * w) * spd; break; }
        case 'exploder': {
          vx = nx * spd; vz = nz * spd;
          if (dist < 1.6 + e.r && !e.fuse) { e.fuse = 0.5; }
          if (e.fuse) {
            vx *= 0.2; vz *= 0.2; e.fuse -= dt; e.mesh.scale.setScalar(e.baseScale * (1 + (0.5 - e.fuse) * 0.8));
            if (e.fuse <= 0) {
              const rad = 2.8 * e.size;
              this.ringFx(e.pos.x, e.pos.z, rad, e.def.color || '#ffaa00');
              if (dist < rad) this.damagePlayer(e.dmg, null, e.id);
              Audio.play('explode');
              this.killEnemy(e, true);
              continue;
            }
          }
          break;
        }
        case 'healer': {
          const want = 8; const f = dist > want + 1 ? 1 : dist < want - 1 ? -0.8 : 0;
          vx = nx * f * spd; vz = nz * f * spd;
          e.cd -= dt;
          if (e.cd <= 0) {
            e.cd = 3;
            let healed = 0;
            this.queryEnemies(e.pos.x, e.pos.z, 7, (o) => { if (o !== e && !o.boss && o.hp < o.maxHp) { o.hp = Math.min(o.maxHp, o.hp + o.maxHp * 0.25); healed++; } });
            if (healed) this.ringFx(e.pos.x, e.pos.z, 7, '#60ff80');
          }
          break;
        }
        case 'teleporter': {
          vx = nx * spd; vz = nz * spd; e.cd -= dt;
          if (e.cd <= 0 && dist > 5) {
            e.cd = rand(3.5, 5.5);
            this.ringFx(e.pos.x, e.pos.z, 1.2, e.def.color || '#a040ff');
            const a = rand(0, 6.28), rr = rand(4, 6);
            e.pos.x = p.pos.x + Math.sin(a) * rr; e.pos.z = p.pos.z + Math.cos(a) * rr;
            e.freeze = 0.4;
            this.ringFx(e.pos.x, e.pos.z, 1.2, e.def.color || '#a040ff');
          }
          break;
        }
        case 'tank': vx = nx * spd; vz = nz * spd; break;
        default: vx = nx * spd; vz = nz * spd;
      }
      // knockback
      if (e.kx || e.kz) { vx += e.kx * 12; vz += e.kz * 12; e.kx *= Math.max(0, 1 - dt * 10); e.kz *= Math.max(0, 1 - dt * 10); if (Math.abs(e.kx) + Math.abs(e.kz) < 0.02) e.kx = e.kz = 0; }
      // separation
      if (!e.boss) {
        let sx = 0, sz = 0;
        const g = this.grid.get((Math.floor(e.pos.x / 3) + 512) * 1024 + (Math.floor(e.pos.z / 3) + 512));
        if (g) for (let k = 0; k < g.length && k < 12; k++) {
          const o = g[k]; if (o === e) continue;
          const ox = e.pos.x - o.pos.x, oz = e.pos.z - o.pos.z, rr = e.r + o.r, d2 = ox * ox + oz * oz;
          if (d2 < rr * rr && d2 > 1e-5) { const d = Math.sqrt(d2); sx += ox / d * (rr - d); sz += oz / d * (rr - d); }
        }
        vx += sx * 6; vz += sz * 6;
      }
      e.pos.x += vx * dt; e.pos.z += vz * dt; e.vx = vx; e.vz = vz;
      if (vx || vz) { const tr = Math.atan2(vx, vz); let dr = tr - e.mesh.rotation.y; dr = Math.atan2(Math.sin(dr), Math.cos(dr)); e.mesh.rotation.y += dr * Math.min(1, dt * 8); }
      if (e.hitPunch > 0) { e.hitPunch -= dt; const k = 1 + Math.max(0, e.hitPunch) * 1.2; e.mesh.scale.set(e.baseScale * k, e.baseScale / k, e.baseScale * k); }
      else if (!e.fuse && e.mesh.scale.y !== e.baseScale) e.mesh.scale.setScalar(e.baseScale);
      if (animate) { try { M.animate?.(e.mesh, e.t, true); } catch {} }
      // contact damage
      e.touchCd -= dt;
      if (dist < e.r + 0.45 && e.touchCd <= 0 && e.freeze <= 0 && !e.emerge) { e.touchCd = 0.8; this.damagePlayer(e.dmg, e); }
      // health bar
      if (bars && (e.hp < e.maxHp || e.elite) && !e.boss) this._updateBar(e); else if (e.bar) e.bar.visible = false;
    }
    // compact dead
    if (this.enemies.some((e) => !e.alive)) this.enemies = this.enemies.filter((e) => e.alive);
  }
  _updateBar(e) {
    if (!e.bar) {
      const g = new THREE.Group();
      const bg = new THREE.Mesh(GEO.plane, basicMat('#300000')); const fg = new THREE.Mesh(GEO.plane, basicMat(e.elite ? '#ffb000' : '#20e020'));
      fg.position.z = 0.001; g.add(bg, fg); g.userData.fg = fg; this.world.add(g); e.bar = g;
    }
    const g = e.bar; g.visible = true;
    const w = Math.max(0.8, e.size * 0.9);
    g.position.set(e.pos.x, e.size * 1.25 + 0.6, e.pos.z);
    g.quaternion.copy(this.camera.quaternion);
    g.children[0].scale.set(w, 0.12, 1);
    const k = clamp(e.hp / e.maxHp, 0, 1);
    g.userData.fg.scale.set(w * k, 0.12, 1); g.userData.fg.position.x = -w * (1 - k) / 2;
  }
  spawnEnemyProjectile(x, z, a, speed, dmg, color, life = 4, srcType = null) {
    const m = new THREE.Mesh(GEO.eproj, basicMat(color || '#ff4040'));
    m.position.set(x, 0.9, z); this.world.add(m);
    this.eprojs.push({ mesh: m, vx: Math.sin(a) * speed, vz: Math.cos(a) * speed, life, dmg, srcType });
  }
  updateEnemyProjectiles(dt) {
    const p = this.player, k = this.run.timeSlow ? 0.4 : 1;
    for (let i = this.eprojs.length - 1; i >= 0; i--) {
      const pr = this.eprojs[i]; pr.life -= dt;
      pr.mesh.position.x += pr.vx * dt * k; pr.mesh.position.z += pr.vz * dt * k;
      const dx = pr.mesh.position.x - p.pos.x, dz = pr.mesh.position.z - p.pos.z;
      if (dx * dx + dz * dz < 0.6) { this.damagePlayer(pr.dmg, null, pr.srcType); pr.life = 0; }
      if (pr.life <= 0) { this.world.remove(pr.mesh); this.eprojs.splice(i, 1); }
    }
  }

  // ======================= boss =======================
  updateBoss(b, dt, nx, nz, dist, spd) {
    if (b.emerge) {
      const em = b.emerge; em.t += dt;
      const k = Math.min(1, em.t / em.dur), ease = 1 - Math.pow(1 - k, 3);
      b.pos.y = -b.size * 2 * (1 - ease);
      if (Math.random() < dt * 12) this.spawnDust(b.pos.x, b.pos.z, 2, b.r + 1.5);
      this.shake = Math.max(this.shake, 0.1 * (S('reducedMotion', false) ? 0 : Number(S('cameraShake', 0.6)) || 0));
      if (k >= 1) { b.emerge = null; b.pos.y = 0; this.addShake(0.6); this.spawnDust(b.pos.x, b.pos.z, 14, b.r + 2); Audio.play('boss'); }
      return [0, 0];
    }
    b.phase = Math.min(b.phases - 1, Math.floor((1 - b.hp / b.maxHp) * b.phases));
    if (b.phase !== b.lastPhase) {
      if (b.lastPhase != null) { this.ui?.log?.(`${b.name} enters phase ${b.phase + 1}!`, '#ff4040'); this.addShake(0.5); Audio.play('boss'); }
      b.lastPhase = b.phase;
    }
    if (b.windup > 0) { b.windup -= dt; return [0, 0]; }
    if (b.charge) {
      b.charge.t -= dt;
      if (b.charge.t <= 0) b.charge = null;
      else return [b.charge.x * spd * 5, b.charge.z * spd * 5];
    }
    if (b.spiral) {
      b.spiral.t -= dt; b.spiral.acc += dt;
      while (b.spiral.acc > 0.09) {
        b.spiral.acc -= 0.09; b.spiral.a += 0.35;
        for (let k = 0; k < 2 + b.phase; k++) this.spawnEnemyProjectile(b.pos.x, b.pos.z, b.spiral.a + k * Math.PI * 2 / (2 + b.phase), 8, b.dmg * 0.5, b.def.color || '#ff00ff');
      }
      if (b.spiral.t <= 0) b.spiral = null;
      return [nx * spd * 0.3, nz * spd * 0.3];
    }
    b.atkCd -= dt * (1 + b.phase * 0.35);
    if (b.atkCd <= 0) {
      b.atkCd = 3.2;
      const atk = pick(b.def.attacks?.length ? b.def.attacks : ['slam']);
      this.bossAttack(b, atk, nx, nz);
    }
    return dist > b.r + 1 ? [nx * spd, nz * spd] : [0, 0];
  }
  bossAttack(b, atk, nx, nz) {
    const p = this.player, color = b.def.color || '#ff3030';
    const ph = b.phase;
    switch (atk) {
      case 'slam': this.addHazard({ type: 'circle', x: b.pos.x, z: b.pos.z, r: 5 + b.size, delay: 1.1, dmg: b.dmg * 1.2 }); b.windup = 1.1; break;
      case 'radialShot': { const n = 14 + ph * 6; const off = rand(0, 1); for (let i = 0; i < n; i++) this.spawnEnemyProjectile(b.pos.x, b.pos.z, off + i / n * Math.PI * 2, 7 + ph, b.dmg * 0.6, color); break; }
      case 'charge': b.windup = 0.7; b.charge = { x: nx, z: nz, t: 0.9 }; this.addHazard({ type: 'line', x: b.pos.x, z: b.pos.z, ax: nx, az: nz, len: b.speed * 5 * 0.9 + 2, w: b.r * 2, delay: 0.7, dmg: 0, visualOnly: true }); break;
      case 'summon': { const n = 4 + ph * 2; for (let i = 0; i < n; i++) { const a = i / n * 6.28; this.spawnEnemy(pick(this.run.stage.enemies), b.pos.x + Math.sin(a) * 4, b.pos.z + Math.cos(a) * 4, { force: true }); } this.ringFx(b.pos.x, b.pos.z, 5, color); break; }
      case 'beam': { const n = 1 + (ph >= 2 ? 2 : 0); const a0 = Math.atan2(nx, nz); for (let i = 0; i < n; i++) { const a = a0 + (i - (n - 1) / 2) * 0.5; this.addHazard({ type: 'line', x: b.pos.x, z: b.pos.z, ax: Math.sin(a), az: Math.cos(a), len: 35, w: 2.6, delay: 1.0, dmg: b.dmg * 1.1 }); } b.windup = 1.1; break; }
      case 'meteor': { const n = 4 + ph * 2; for (let i = 0; i < n; i++) this.addHazard({ type: 'circle', x: p.pos.x + (i ? rand(-7, 7) : 0), z: p.pos.z + (i ? rand(-7, 7) : 0), r: 2.6, delay: 1.2 + i * 0.12, dmg: b.dmg }); break; }
      case 'teleport': {
        this.ringFx(b.pos.x, b.pos.z, 3, color);
        const a = rand(0, 6.28); b.pos.x = p.pos.x + Math.sin(a) * 7; b.pos.z = p.pos.z + Math.cos(a) * 7;
        this.ringFx(b.pos.x, b.pos.z, 3, color);
        this.addHazard({ type: 'circle', x: b.pos.x, z: b.pos.z, r: 4.5, delay: 0.9, dmg: b.dmg }); b.windup = 0.9; break;
      }
      case 'spiral': b.spiral = { t: 2.4, acc: 0, a: rand(0, 6.28) }; break;
      default: this.addHazard({ type: 'circle', x: b.pos.x, z: b.pos.z, r: 5, delay: 1, dmg: b.dmg });
    }
  }
  addHazard(h) {
    const mat = new THREE.MeshBasicMaterial({ color: h.visualOnly ? 0xffaa00 : 0xff2020, transparent: true, opacity: 0.25, depthWrite: false, side: THREE.DoubleSide });
    let m;
    if (h.type === 'line') {
      m = new THREE.Mesh(GEO.plane, mat); m.rotation.x = -Math.PI / 2; m.rotation.z = Math.atan2(h.ax, h.az);
      m.scale.set(h.w, h.len, 1); m.position.set(h.x + h.ax * h.len / 2, 0.06, h.z + h.az * h.len / 2);
    } else { m = new THREE.Mesh(GEO.disc, mat); m.rotation.x = -Math.PI / 2; m.scale.setScalar(h.r); m.position.set(h.x, 0.06, h.z); }
    this.world.add(m);
    h.mesh = m; h.t = 0; this.hazards.push(h);
  }
  updateHazards(dt) {
    const p = this.player;
    for (let i = this.hazards.length - 1; i >= 0; i--) {
      const h = this.hazards[i]; h.t += dt;
      h.mesh.material.opacity = 0.2 + 0.4 * (h.t / h.delay) * (0.6 + 0.4 * Math.sin(h.t * 20));
      if (h.t >= h.delay) {
        if (!h.visualOnly) {
          let inside = false;
          if (h.type === 'line') {
            const rx = p.pos.x - h.x, rz = p.pos.z - h.z; const along = rx * h.ax + rz * h.az; const perp = Math.abs(rx * h.az - rz * h.ax);
            inside = along >= 0 && along <= h.len && perp <= h.w / 2 + 0.4;
          } else inside = (p.pos.x - h.x) ** 2 + (p.pos.z - h.z) ** 2 <= (h.r + 0.4) ** 2;
          if (inside) this.damagePlayer(h.dmg, null, h.srcType);
          if (h.type === 'circle') { this.ringFx(h.x, h.z, h.r, '#ff6020'); this.addShake(0.2); Audio.play('explode'); }
        }
        this.world.remove(h.mesh); h.mesh.material.dispose(); this.hazards.splice(i, 1);
      }
    }
  }

  // ======================= damage & kills =======================
  damageEnemy(e, amount, crit, opts = {}) {
    if (!e.alive || !(amount > 0)) return;
    if (e.emerge) { if (!opts.quiet && Math.random() < 0.1) this.numberAt(e.pos, 'Immune', false, '#aaaaaa', e.size); return; }
    e.hp -= amount;
    this.run.dmgTotal += amount; this.run.dmgLog.push([this.run.time, amount]);
    e.hitPunch = 0.12;
    if (opts.knock && !e.boss) { const kb = opts.knock * (e.elite ? 0.3 : 1) / Math.max(0.6, e.size); e.kx += (opts.kx || 0) * kb; e.kz += (opts.kz || 0) * kb; }
    const s = this.player.stats;
    if (s.lifesteal > 0 && !opts.noProc) this.healPlayer(Math.min(amount * s.lifesteal, s.maxHp * 0.02));
    if (!opts.noProc) {
      const burn = this.eff('burnOnHit'); if (burn && Math.random() < burn) { e.burn = 3; e.burnDps = Math.max(e.burnDps * 0.5, amount * 0.3); }
      const fr = this.eff('freezeChance'); if (fr && Math.random() < fr && !e.boss) e.freeze = Math.max(e.freeze, 1.2);
      const ch = this.eff('chainOnCrit'); if (crit && ch && Math.random() < Math.min(1, ch)) {
        const n = this.nearestEnemy(e.pos.x, e.pos.z, 6, new Set([e]));
        if (n) this.chainLightning(e.pos, n, 2, 6, amount * 0.5, '#9fe8ff', true);
      }
    }
    if (!opts.quiet || crit) this.numberAt(e.pos, amount, crit, opts.color, e.size);
    if (!opts.quiet) Audio.play(crit ? 'crit' : 'hit');
    if (e.hp <= 0) this.killEnemy(e);
  }
  numberAt(pos, amount, crit, color, h = 1) {
    if (!S('damageNumbers', true) || this.dmgNumBudget <= 0) return;
    if (S('damageNumbersCritsOnly', false) && !crit && typeof amount === 'number') return;
    this.dmgNumBudget--;
    const v = new THREE.Vector3(pos.x, (h || 1) * 1.3 + 0.5, pos.z).project(this.camera);
    if (v.z > 1) return;
    const rect = this.container.getBoundingClientRect();
    const sx = (v.x * 0.5 + 0.5) * rect.width + rect.left, sy = (-v.y * 0.5 + 0.5) * rect.height + rect.top;
    try { this.ui?.damageNumber?.(sx, sy, typeof amount === 'number' ? Math.max(1, Math.round(amount)) : amount, crit, color); } catch {}
  }
  killEnemy(e, silent = false) {
    if (!e.alive) return;
    e.alive = false;
    const r = this.run, x = e.pos.x, z = e.pos.z;
    r.kills++; this.player.kills = r.kills;
    if (e.bar) { this.world.remove(e.bar); e.bar = null; }
    if (e.boss) { this.world.remove(e.mesh); disposeTree(e.mesh); } else { e.mesh.visible = false; (this.pools[e.key] || (this.pools[e.key] = [])).push(e.mesh); }
    // drops
    const xpMult = r.diff.xpMult || 1;
    this.dropXp(x, z, e.xp * xpMult);
    const gm = r.diff.goldMult || 1;
    if (Math.random() < 0.08 + (e.elite ? 1 : 0)) this.dropGold(x + rand(-0.5, 0.5), z + rand(-0.5, 0.5), Math.ceil((1 + r.stageIndex) * gm * (e.elite ? 10 : rand(1, 3))));
    if (Math.random() < 0.006 + (this.player.stats.luck || 0) * 0.004 || (e.elite && Math.random() < 0.25)) this.spawnRune(null, 0, x, z);
    if (e.elite) { this.dropChest(x, z); }
    if (e.behavior === 'splitter' && e.split < 1 && !silent) {
      for (let k = 0; k < 2; k++) {
        const c = this.spawnEnemy(e.id, x + rand(-0.8, 0.8), z + rand(-0.8, 0.8), { force: true, split: e.split + 1, scale: e.baseScale * 0.6, hpMult: 0.35 * (e.elite ? 1.5 : 1), xpMult: 0.4, speedMult: 1.25 });
        if (c) { c.kx = rand(-1, 1); c.kz = rand(-1, 1); }
      }
    }
    const ke = this.eff('onKillExplode');
    if (ke && !e.boss && Math.random() < 0.5) {
      this.areaDamage(x, z, 2.2 * this.player.stats.area, Math.max(5, e.maxHp * 0.15 + 10) * ke * this.player.stats.damage, '#ffd060', false, true, { noProc: true, quiet: true, knock: 0.3 });
    }
    if (e.boss) this.onBossKilled(e);
  }
  dropXp(x, z, value) {
    if (this.pickups.length > 450) {
      const g = this.pickups.find((q) => q.kind === 'xp'); if (g) { g.value += value; return; }
    }
    const tier = value >= 50 ? 3 : value >= 10 ? 2 : value >= 3 ? 1 : 0;
    const key = 'xp' + tier;
    const m = (this.pools[key] || []).pop() || safeBuild(() => M.buildXpGem(tier), () => new THREE.Mesh(GEO.orb, basicMat('#40a0ff')));
    m.visible = true; m.position.set(x, 0, z); if (!m.parent) this.world.add(m);
    this.pickups.push({ kind: 'xp', mesh: m, value, poolKey: key, magnet: false });
  }
  dropGold(x, z, value) {
    const m = (this.pools.gold || []).pop() || safeBuild(() => M.buildGold(), () => new THREE.Mesh(GEO.orb, basicMat('#ffc020')));
    m.visible = true; m.position.set(x, 0, z); if (!m.parent) this.world.add(m);
    this.pickups.push({ kind: 'gold', mesh: m, value, poolKey: 'gold', magnet: false });
  }
  dropChest(x, z) {
    const m = safeBuild(() => M.buildChest(), () => blob(0x8a5a2a, 0.8));
    m.position.set(x, 0, z); this.world.add(m);
    this.pickups.push({ kind: 'chest', mesh: m });
  }
  spawnRune(rune, dist = 0, x, z) {
    const runes = D.RUNES || []; if (!runes.length) return;
    if (this.pickups.filter((q) => q.kind === 'rune').length >= 8) return;
    rune = rune || pick(runes);
    if (x == null) {
      const p = this.player?.pos || { x: 0, z: 0 }; const a = rand(0, 6.28); dist = dist || rand(15, 40);
      x = clamp(p.x + Math.sin(a) * dist, -MAP_HALF + 2, MAP_HALF - 2); z = clamp(p.z + Math.cos(a) * dist, -MAP_HALF + 2, MAP_HALF - 2);
    }
    const m = safeBuild(() => M.buildRune(rune.color), () => new THREE.Mesh(GEO.orb, basicMat(rune.color || '#ff60ff')));
    m.position.set(x, 0, z); this.world.add(m);
    this.pickups.push({ kind: 'rune', mesh: m, rune });
  }
  updatePickups(dt) {
    const p = this.player, s = p.stats, r = this.run;
    if (r.magnetAll > 0) r.magnetAll -= dt;
    const range = s.pickupRange * (S('pickupMagnetBoost', false) ? 1.3 : 1);
    const xpMag = this.eff('xpMagnet');
    if (xpMag) { r.xpMagT = (r.xpMagT || 0) - dt; if (r.xpMagT <= 0) { r.xpMagT = Math.max(4, 14 - xpMag * 3); r.magnetAll = Math.max(r.magnetAll, 0.6); } }
    for (let i = this.pickups.length - 1; i >= 0; i--) {
      const q = this.pickups[i], m = q.mesh;
      const dx = p.pos.x - m.position.x, dz = p.pos.z - m.position.z, d = Math.hypot(dx, dz);
      if (q.kind === 'xp' || q.kind === 'gold') {
        if (!q.magnet && (d < range || (r.magnetAll > 0 && q.kind === 'xp' && d < 120))) q.magnet = true;
        if (q.magnet) { const sp = Math.max(14, s.moveSpeed * 2.5) * dt; m.position.x += dx / (d || 1) * Math.min(d, sp); m.position.z += dz / (d || 1) * Math.min(d, sp); }
        try { M.animate?.(m, r.time, false); } catch {}
        if (d < 0.8) {
          if (q.kind === 'xp') this.gainXp(q.value); else { p.gold += q.value; Audio.play('gold'); }
          if (q.kind === 'xp') Audio.play('pickup');
          m.visible = false; (this.pools[q.poolKey] || (this.pools[q.poolKey] = [])).push(m);
          this.pickups[i] = this.pickups[this.pickups.length - 1]; this.pickups.pop();
        }
      } else {
        try { M.animate?.(m, r.time, false); } catch {}
        if (q.kind === 'rune') { m.rotation.y += dt; }
        if (d < 1.4) {
          if (q.kind === 'chest') { this.openChest(); }
          else if (q.kind === 'rune') this.applyRune(q.rune);
          this.world.remove(m); disposeTree(m);
          this.pickups.splice(i, 1);
        }
      }
    }
  }
  gainXp(v) {
    const p = this.player;
    p.xp += v * p.stats.xpGain * (this.run.doubleXp ? 2 : 1);
    while (p.xp >= p.xpNext) {
      p.xp -= p.xpNext; p.level++;
      p.xpNext = D.xpForLevel ? D.xpForLevel(p.level) : 10 + p.level * 8;
      this.run.pendingLevels++;
    }
  }
  applyRune(rune) {
    const p = this.player;
    Audio.play('rune');
    if (rune.kind === 'permanent') {
      for (const k in rune.stats || {}) p.runeStats[k] = (p.runeStats[k] || 0) + rune.stats[k];
      p.runes.push(rune);
    } else {
      const ex = p.buffs.find((b) => b.rune.id === rune.id);
      if (ex) ex.remaining = rune.duration || 5;
      else p.buffs.push({ rune, id: rune.id, name: rune.name, icon: rune.icon, remaining: rune.duration || 5, duration: rune.duration || 5 });
      if (rune.effect === 'heal') this.healPlayer(p.stats.maxHp);
      if (rune.effect === 'magnet') this.run.magnetAll = 3;
      if (rune.effect === 'invuln') p.invuln = Math.max(p.invuln, 0.1);
    }
    this.computeStats();
    this.ui?.log?.(`You absorb the ${rune.name}: ${rune.desc}`, rune.color || '#ffff00');
  }

  // ======================= items =======================
  rollItem(rarity) {
    const items = D.ITEMS || [];
    rarity = rarity || (D.rollRarity ? D.rollRarity(this.player?.stats.luck || 0) : 'common');
    const pool = items.filter((i) => i.rarity === rarity);
    return pick(pool.length ? pool : items);
  }
  addItem(item) {
    if (!item) return;
    this.player.items.push(item);
    if (item.effect === 'extraLife') this.player.lives += item.effectValue || 1;
    this.computeStats();
    this.ui?.log?.(`You obtain: ${item.name}.`, D.RARITY?.[item.rarity]?.color || '#ffffff');
  }
  openChest() {
    const item = this.rollItem();
    Audio.play('chest');
    if (this.ui?.showChest) this.ui.showChest(item, () => this.addItem(item));
    else this.addItem(item);
  }

  // ======================= level up =======================
  makeChoices() {
    const p = this.player, s = p.stats;
    const n = 3 + (Math.random() < Math.min(0.6, (s.luck || 0) * 1.2) ? 1 : 0);
    const weaponUp = [], weaponNew = [], stats = [];
    for (const w of p.weapons) if (w.level < (w.def.maxLevel || 8)) weaponUp.push({ kind: 'weapon', id: w.id, name: `${w.def.name} (Lv ${w.level + 1})`, icon: w.def.icon, desc: this._weaponUpDesc(w), rarity: 'uncommon', level: w.level + 1 });
    if (p.weapons.length < MAX_WEAPONS) for (const id in D.WEAPONS || {}) if (!p.weapons.find((w) => w.id === id)) { const d = D.WEAPONS[id]; weaponNew.push({ kind: 'weapon', id, name: d.name, icon: d.icon, desc: `NEW! ${d.desc}`, rarity: 'rare', level: 1, isNew: true }); }
    for (const u of D.STAT_UPGRADES || []) stats.push({ kind: 'stat', id: u.id, name: u.name, icon: u.icon, desc: u.desc, rarity: 'common' });
    const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
    shuffle(weaponUp); shuffle(weaponNew); shuffle(stats);
    const out = [];
    const wantW = Math.random() < 0.85 ? 1 + (Math.random() < 0.5 ? 1 : 0) : 0;
    for (let i = 0; i < wantW; i++) {
      const src = (weaponNew.length && (Math.random() < 0.45 || !weaponUp.length)) ? weaponNew : weaponUp;
      if (src.length) out.push(src.pop());
    }
    if (Math.random() < 0.1 + (s.luck || 0) * 0.1) { const it = this.rollItem(); if (it) out.push({ kind: 'item', id: it.id, name: it.name, icon: it.icon, desc: it.desc, rarity: it.rarity, item: it }); }
    while (out.length < n && stats.length) out.push(stats.pop());
    while (out.length < n && (weaponUp.length || weaponNew.length)) out.push((weaponUp.length ? weaponUp : weaponNew).pop());
    return shuffle(out.slice(0, n));
  }
  _weaponUpDesc(w) {
    const pl = w.def.perLevel || {};
    const parts = Object.entries(pl).map(([k, v]) => `${v > 0 ? '+' : ''}${Math.round(v * 100) / 100} ${k}`);
    return parts.join(', ') || 'Improved.';
  }
  applyChoice(c) {
    if (!c) return;
    const p = this.player;
    if (c.kind === 'weapon') this.addWeapon(c.id);
    else if (c.kind === 'stat') { const u = (D.STAT_UPGRADES || []).find((x) => x.id === c.id); if (u) p.upgrades.push(u); this.computeStats(); }
    else if (c.kind === 'item') this.addItem(c.item || (D.ITEMS || []).find((i) => i.id === c.id));
  }
  processLevelUps() {
    const r = this.run;
    if (r.pendingLevels <= 0 || this._modalOpen() || this.paused || this.levelUpOpen) return;
    r.pendingLevels--;
    Audio.play('levelup');
    this.ringFx(this.player.pos.x, this.player.pos.z, 3, '#ffff60');
    const choices = this.makeChoices();
    this.ui?.log?.(`Congratulations, you just advanced a level! You are now level ${this.player.level}.`, '#00ffff');
    if (S('autoLevelUp', false) || !this.ui?.showLevelUp || !choices.length) { this.applyChoice(pick(choices)); return; }
    this.levelUpOpen = true;
    this.ui.showLevelUp(choices, (c) => {
      this.levelUpOpen = false;
      const choice = typeof c === 'number' ? choices[c] : c;
      this.applyChoice(choice);
    });
  }

  // ======================= merchant & shrines =======================
  makeStock() {
    const MER = D.MERCHANT || {}; const n = MER.stockSize || 4; const out = [];
    const minute = this.run.time / 60;
    for (let i = 0; i < n; i++) {
      const it = this.rollItem();
      const base = MER.priceByRarity?.[it.rarity] || 50;
      out.push({ item: it, price: Math.round(base * (1 + minute * 0.04)), sold: false });
    }
    return out;
  }
  updateMerchant(dt) {
    const r = this.run, MER = D.MERCHANT || {};
    r.merchantTimer += dt;
    if (r.merchantTimer >= (MER.spawnInterval || 15)) {
      r.merchantTimer = 0;
      if (!this.merchant && Math.random() < (MER.spawnChance ?? 0.35)) {
        const p = this.player.pos, a = rand(0, 6.28), d = rand(9, 14);
        const g = safeBuild(() => M.buildMerchant(), () => blob(0x601a6a, 1.5));
        g.position.set(clamp(p.x + Math.sin(a) * d, -MAP_HALF, MAP_HALF), 0, clamp(p.z + Math.cos(a) * d, -MAP_HALF, MAP_HALF));
        g.rotation.y = Math.atan2(p.x - g.position.x, p.z - g.position.z);
        this.world.add(g);
        this.merchant = { mesh: g, life: MER.lifetime || 45, stock: null };
        this.ui?.log?.('A shady black market dealer has set up shop nearby...', '#ff981f');
      }
    }
    if (this.merchant) {
      this.merchant.life -= dt;
      try { M.animate?.(this.merchant.mesh, r.time, false); } catch {}
      if (this.merchant.life <= 0) { this.world.remove(this.merchant.mesh); disposeTree(this.merchant.mesh); this.merchant = null; this.ui?.log?.('The dealer packs up and vanishes.', '#aaaaaa'); }
    }
    for (const sh of this.shrines) { if (sh.uses > 0) { try { M.animate?.(sh.mesh, r.time, false); } catch {} } }
  }
  _nearInteract() {
    const p = this.player.pos, h = this.run?.hole;
    if (h?.portal && !this.run.bossPending && (h.x - p.x) ** 2 + (h.z - p.z) ** 2 < h.r * h.r) return { type: 'hole' };
    if (this.merchant) { const m = this.merchant.mesh.position; if ((m.x - p.x) ** 2 + (m.z - p.z) ** 2 < 16) return { type: 'merchant' }; }
    for (const sh of this.shrines) { if (sh.uses <= 0) continue; const m = sh.mesh.position; if ((m.x - p.x) ** 2 + (m.z - p.z) ** 2 < 9) return { type: 'shrine', shrine: sh }; }
    return null;
  }
  _keyLabel(action) {
    const v = (S('keybinds', {}) || {})[action] ?? DEFAULT_KEYS[action];
    return String(v).replace(/^Key/, '').replace(/^Digit/, '');
  }
  updatePrompt() {
    const n = (this.state === 'playing' && !this.paused && !this._modalOpen()) ? this._nearInteract() : null;
    if (n) {
      const txt = n.type === 'hole' ? `[${this._keyLabel('interact')}] Jump into the hole`
        : `[${this._keyLabel('interact')}] Trade` + (n.type === 'merchant' ? ' — Black Market' : ' — Shrine');
      if (this.promptEl.textContent !== txt) this.promptEl.textContent = txt;
      this.promptEl.style.display = 'block';
    } else this.promptEl.style.display = 'none';
  }
  interact() {
    const n = this._nearInteract(); if (!n) return;
    const p = this.player;
    if (n.type === 'hole') {
      const stages = D.STAGES || [], si = this.run.stageIndex, finalStage = si >= stages.length - 1;
      const info = { finalStage, nextStageName: finalStage ? '' : (stages[si + 1]?.name || '') };
      if (this.ui?.showHoleConfirm) this.ui.showHoleConfirm(info, () => this.jumpIntoHole(), () => {});
      else if (window.confirm(finalStage ? 'Jump into the hole and end your run victorious?' : `Jump into the hole to ${info.nextStageName}?`)) this.jumpIntoHole();
      return;
    }
    if (n.type === 'merchant') {
      const mer = this.merchant;
      if (!mer.stock) mer.stock = this.makeStock();
      const onBuy = (i) => {
        const s = mer.stock[i]; if (!s || s.sold || p.gold < s.price) return false;
        p.gold -= s.price; s.sold = true; this.addItem(s.item); Audio.play('buy'); return true;
      };
      const onReroll = () => {
        const cost = D.MERCHANT?.rerollCost ?? 15;
        if (p.gold < cost) return null;
        p.gold -= cost; mer.stock = this.makeStock(); return mer.stock;
      };
      this.ui?.showMerchant?.(mer.stock, p.gold, onBuy, onReroll, () => {});
    } else {
      const sh = n.shrine;
      const onTrade = (idx) => {
        const old = p.items[idx]; if (!old || sh.uses <= 0) return null;
        const pool = (D.ITEMS || []).filter((i) => i.rarity === old.rarity && i.id !== old.id);
        const nu = pick(pool.length ? pool : (D.ITEMS || [old]));
        p.items.splice(idx, 1);
        if (old.effect === 'extraLife') p.lives = Math.max(0, p.lives - (old.effectValue || 1));
        this.addItem(nu);
        sh.uses--;
        if (sh.uses <= 0) this._dimShrine(sh);
        Audio.play('rune');
        return nu;
      };
      this.ui?.showShrine?.(p.items, onTrade, () => {});
    }
  }
  _dimShrine(sh) {
    sh.mesh.traverse((o) => {
      if (o.isMesh && o.material) { o.material = o.material.clone(); o.material.color?.multiplyScalar(0.35); if (o.material.emissive) o.material.emissive.setScalar(0); }
      if (o.isLight) o.intensity = 0;
    });
  }

  // ======================= boss defeated =======================
  onBossKilled(b) {
    const r = this.run, si = r.stageIndex;
    r.boss = null;
    // drop chests in a ring outside the hole so they don't stack on the portal
    const hx = r.hole ? r.hole.x : b.pos.x, hz = r.hole ? r.hole.z : b.pos.z;
    for (let i = 0; i < 3; i++) { const a = i * 2.094 + rand(-0.3, 0.3); this.dropChest(hx + Math.sin(a) * 6, hz + Math.cos(a) * 6); }
    this.dropGold(b.pos.x, b.pos.z, 100 * (si + 1));
    this.addShake(0.8); this.flash(0.4, '#ffffff');
    Audio.play('victory');
    Audio.startMusic(si);
    r.bossesKilled = (r.bossesKilled || 0) + 1;
    const firstKill = r.bossKilledAt == null;
    r.bossKilledAt = r.bossKilledAt ?? r.time;
    r.nextBossAt = r.time + 180; // re-emerges stronger from the same hole
    r.loop++;
    this.openPortal();
    if (!firstKill) { this.ui?.log?.(`${b.name} falls again! It will return even stronger...`, '#ff981f'); return; }
    // meta unlocks
    const stages = D.STAGES || [];
    if (!this.meta.stagesCleared.includes(si)) this.meta.stagesCleared.push(si);
    this.unlockStage(si + 1);
    const bname = (b.name || '').toLowerCase(), btitle = (b.title || '').toLowerCase(), sname = (r.stage.name || '').toLowerCase();
    let unlocked = false;
    for (const c of D.CHARACTERS || []) {
      const h = (c.unlockHint || '').toLowerCase(); if (!h) continue;
      if (h.includes(`stage ${si + 1}`) || h.includes(sname) || (bname && h.includes(bname)) || (btitle && h.includes(btitle.replace(/^the /, '')))) { if (this.unlockCharacter(c.id)) unlocked = true; }
    }
    if (!unlocked) { // fallback: unlock the next locked character
      const c = (D.CHARACTERS || []).find((x) => !x.secret && !this.meta.unlockedCharacters.includes(x.id)); if (c) this.unlockCharacter(c.id);
    }
    if (si >= stages.length - 1) for (const c of D.CHARACTERS || []) if (!c.secret) this.unlockCharacter(c.id);
    this.saveMeta();
    this.ui?.log?.(`The burrows grow ever more dangerous... Stand on the glowing hole and press [${this._keyLabel('interact')}] to jump in.`, '#ff4040');
  }

  // ======================= boss hole =======================
  _createHole(x, z) {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    const ground = new THREE.Color((this.run?.stage?.map?.ground) || '#6fae4a');
    const mound = new THREE.Mesh(new THREE.RingGeometry(3.1, 4.8, 11, 1), new THREE.MeshLambertMaterial({ color: ground.clone().multiplyScalar(0.55), flatShading: true }));
    mound.rotation.x = -Math.PI / 2; mound.position.y = 0.015; g.add(mound);
    const crater = new THREE.Mesh(new THREE.CircleGeometry(3.3, 9), new THREE.MeshBasicMaterial({ color: 0x0b0604 }));
    crater.rotation.x = -Math.PI / 2; crater.position.y = 0.025; g.add(crater);
    const pit = new THREE.Mesh(new THREE.CircleGeometry(2.1, 7), new THREE.MeshBasicMaterial({ color: 0x000000 }));
    pit.rotation.x = -Math.PI / 2; pit.position.y = 0.03; pit.rotation.z = 0.3; g.add(pit);
    const rockMat = new THREE.MeshLambertMaterial({ color: 0x5a4a3a, flatShading: true });
    const rockGeo = new THREE.DodecahedronGeometry(0.6, 0);
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2 + rand(-0.15, 0.15), rr = rand(3.3, 4.1);
      const m = new THREE.Mesh(rockGeo, rockMat);
      m.position.set(Math.sin(a) * rr, rand(0.05, 0.25), Math.cos(a) * rr);
      m.scale.set(rand(0.5, 1.2), rand(0.5, 1.6), rand(0.5, 1.1));
      m.rotation.set(rand(-0.6, 0.6), rand(0, 6.28), rand(-0.6, 0.6));
      g.add(m);
    }
    const rimMat = new THREE.MeshBasicMaterial({ color: 0xff5a1a, transparent: true, opacity: 0.8, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending });
    const rim = new THREE.Mesh(new THREE.RingGeometry(2.8, 3.35, 9, 1), rimMat);
    rim.rotation.x = -Math.PI / 2; rim.position.y = 0.04; g.add(rim);
    const swirlMat = new THREE.MeshBasicMaterial({ color: 0xa040ff, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending });
    const swirl = new THREE.Mesh(new THREE.RingGeometry(0.3, 2.7, 7, 3, 0, Math.PI * 1.6), swirlMat);
    swirl.rotation.x = -Math.PI / 2; swirl.position.y = 0.05; swirl.visible = false; g.add(swirl);
    g.scale.setScalar(0.05);
    this.world.add(g);
    this._clearColliders(x, z, 5);
    return { mesh: g, rim, swirl, x, z, r: 2.6, t: 0, portal: false, dustAcc: 0 };
  }
  beginBossEmergence() {
    const r = this.run;
    if (!D.BOSSES?.[r.stage.boss]) { r.nextBossAt = Infinity; return; }
    if (!r.hole) {
      const p = this.player.pos, a = rand(0, 6.28), lim = MAP_HALF - 10;
      r.hole = this._createHole(clamp(p.x + Math.sin(a) * 14, -lim, lim), clamp(p.z + Math.cos(a) * 14, -lim, lim));
    }
    r.bossPending = { t: 3 };
    r.nextBossAt = Infinity;
    this.ui?.log?.('The ground trembles...', '#ff981f');
    Audio.play('rumble');
    this.addShake(0.4);
  }
  spawnDust(x, z, n, radius = 2, color = '#8b7355') {
    if (S('quality', 'medium') === 'low') n = Math.ceil(n / 2);
    for (let i = 0; i < n; i++) {
      const a = rand(0, 6.28), d = rand(0, radius);
      const m = new THREE.Mesh(GEO.dust, basicMat(color));
      const sx = x + Math.sin(a) * d, sz = z + Math.cos(a) * d, vx = Math.sin(a) * rand(1, 3), vz = Math.cos(a) * rand(1, 3), vy = rand(3, 7), s0 = rand(0.6, 1.4);
      m.position.set(sx, 0.2, sz); m.rotation.set(rand(0, 3), rand(0, 3), 0);
      const dur = rand(0.6, 1.1);
      this.addEffect(m, dur, (fx, k) => {
        const t = k * dur;
        fx.mesh.position.set(sx + vx * t, Math.max(0.1, 0.2 + vy * t - 9 * t * t), sz + vz * t);
        fx.mesh.scale.setScalar(s0 * (1 - k * 0.8));
      }, false, false);
    }
  }
  updateHole(dt) {
    const r = this.run, h = r.hole;
    if (!h) return;
    h.t += dt;
    const sc = h.mesh.scale.x;
    if (sc < 1) h.mesh.scale.setScalar(Math.min(1, sc + dt * 0.6));
    if (r.bossPending) {
      const bp = r.bossPending; bp.t -= dt;
      this.shake = Math.max(this.shake, 0.12 * (Number(S('cameraShake', 0.6)) || 0) * (S('reducedMotion', false) ? 0 : 1));
      h.rim.material.opacity = 0.5 + 0.5 * Math.abs(Math.sin(h.t * 10));
      h.dustAcc += dt;
      if (h.dustAcc > 0.15) { h.dustAcc = 0; this.spawnDust(h.x, h.z, 3, 3.2); }
      if (bp.t <= 0) { r.bossPending = null; h.mesh.scale.setScalar(1); this.spawnBoss(h.x, h.z); }
    } else if (h.portal) {
      h.swirl.rotation.z -= dt * 2.5;
      h.swirl.material.opacity = 0.45 + 0.25 * Math.sin(h.t * 3);
      h.rim.material.opacity = 0.7 + 0.3 * Math.sin(h.t * 4);
    } else h.rim.material.opacity = 0.6 + 0.2 * Math.sin(h.t * 3);
  }
  openPortal() {
    const h = this.run.hole; if (!h) return;
    h.portal = true;
    h.rim.material.color.set('#c070ff');
    h.swirl.visible = true;
    this.ringFx(h.x, h.z, 4, '#c070ff');
    Audio.play('portal');
  }
  jumpIntoHole() {
    const r = this.run;
    if (!r || r.over || this.transitioning || this.state !== 'playing') return;
    const stages = D.STAGES || [], si = r.stageIndex;
    if (si >= stages.length - 1) {
      for (const c of D.CHARACTERS || []) if (!c.secret) this.unlockCharacter(c.id);
      r.victory = true;
      this.endRun(true);
      return;
    }
    if (!this.meta.stagesCleared.includes(si)) this.meta.stagesCleared.push(si);
    this._recordBest();
    this.recordRun('nextStage');
    this.unlockStage(si + 1);
    this.transitioning = true;
    this.pause();
    Audio.play('portal');
    this.promptEl.style.display = 'none';
    if (this.fadeEl) { this.fadeEl.style.transition = 'opacity .5s'; this.fadeEl.style.opacity = '1'; }
    const runRef = r;
    setTimeout(() => {
      if (this.run !== runRef || runRef.over) { this.transitioning = false; return; }
      try { this._gotoStage(si + 1); } catch (e) { console.error('[stage transition]', e); }
      this.ui?.log?.(`You plunge into the depths... ${stages[si + 1].name} awaits.`, '#c070ff');
      if (this.fadeEl) this.fadeEl.style.opacity = '0';
      this.transitioning = false;
      this.resume();
    }, 600);
  }

  // ======================= fx =======================
  addShake(a) {
    if (S('reducedMotion', false)) return;
    let k = S('cameraShake', 0.6); k = typeof k === 'boolean' ? (k ? 1 : 0) : Number(k) || 0;
    this.shake = Math.max(this.shake, a * k);
  }
  flash(a = 0.25, color = '#ff0000') {
    if (!S('screenFlash', true) || S('reducedMotion', false)) return;
    this.flashEl.style.background = color; this.flashEl.style.transition = 'none'; this.flashEl.style.opacity = String(a);
    requestAnimationFrame(() => { this.flashEl.style.transition = 'opacity .3s'; this.flashEl.style.opacity = '0'; });
  }

  // ======================= HUD / minimap =======================
  hudState() {
    const p = this.player, r = this.run;
    while (r.dmgLog.length && r.dmgLog[0][0] < r.time - 5) r.dmgLog.shift();
    const dps = r.dmgLog.reduce((a, b) => a + b[1], 0) / Math.min(5, Math.max(1, r.time));
    return {
      hp: Math.ceil(p.hp), maxHp: p.stats.maxHp, xp: Math.floor(p.xp), xpNext: p.xpNext, level: p.level, gold: p.gold, time: r.time, kills: r.kills,
      stage: r.stageIndex, stageName: r.stage.name, stageIndex: r.stageIndex, difficulty: r.diff.id,
      weapons: p.weapons.map((w) => ({ id: w.id, level: w.level, name: w.def.name, icon: w.def.icon, maxLevel: w.def.maxLevel || 8 })),
      items: p.items.slice(),
      buffs: p.buffs.map((b) => ({ name: b.name, icon: b.icon, remaining: b.remaining, duration: b.duration })),
      abilities: p.abilities.map((a, i) => ({ id: a.id, name: a.def?.name, icon: a.def?.icon, key: i === 0 ? this._keyLabel('ability1') : this._keyLabel('ability2'), cdRemaining: a.cd, cdMax: a.cdMax || a.def?.cooldown || 1 })),
      bossHp: r.boss ? { name: r.boss.name, title: r.boss.title, hp: Math.max(0, r.boss.hp), maxHp: r.boss.maxHp, phase: r.boss.phase + 1 } : null,
      fps: Math.round(this.fps), dps: Math.round(dps), loop: r.loop, enemies: this.enemies.length, lives: p.lives,
      nextBossIn: isFinite(r.nextBossAt) ? Math.max(0, r.nextBossAt - r.time) : null,
    };
  }
  drawMinimap() {
    const c = this.ui?.getMinimapCanvas ? this.ui.getMinimapCanvas() : document.getElementById('minimap');
    if (!c || !S('minimap', true)) return;
    const ctx = c.getContext('2d'); if (!ctx) return;
    const w = c.width, h = c.height, p = this.player.pos;
    const view = this.minimapLarge ? MAP_HALF : 40;
    const sc = Math.min(w, h) / (view * 2);
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(20,16,10,0.85)'; ctx.fillRect(0, 0, w, h);
    const tx = (x) => w / 2 + (x - (this.minimapLarge ? 0 : p.x)) * sc, tz = (z) => h / 2 + (z - (this.minimapLarge ? 0 : p.z)) * sc;
    ctx.strokeStyle = '#000'; ctx.strokeRect(tx(-MAP_HALF), tz(-MAP_HALF), MAP_HALF * 2 * sc, MAP_HALF * 2 * sc);
    const dot = (x, z, r, col) => { const X = tx(x), Z = tz(z); if (X < -4 || Z < -4 || X > w + 4 || Z > h + 4) return; ctx.fillStyle = col; ctx.fillRect(X - r / 2, Z - r / 2, r, r); };
    for (const q of this.pickups) if (q.kind === 'rune') dot(q.mesh.position.x, q.mesh.position.z, 4, '#ff60ff'); else if (q.kind === 'chest') dot(q.mesh.position.x, q.mesh.position.z, 4, '#ffd040');
    for (const e of this.enemies) if (!e.boss) dot(e.pos.x, e.pos.z, e.elite ? 4 : 2, e.elite ? '#ff9a00' : '#ff3030');
    for (const s of this.shrines) dot(s.mesh.position.x, s.mesh.position.z, 5, s.uses > 0 ? '#80c0ff' : '#506070');
    if (this.merchant) dot(this.merchant.mesh.position.x, this.merchant.mesh.position.z, 6, '#c060ff');
    if (this.run.hole) dot(this.run.hole.x, this.run.hole.z, 7, this.run.hole.portal ? '#c070ff' : '#ff6a1a');
    if (this.run.boss) dot(this.run.boss.pos.x, this.run.boss.pos.z, 8, '#ff0000');
    dot(p.x, p.z, 5, '#ffffff');
  }

  // ======================= main loop =======================
  update(dt) {
    const r = this.run;
    r.time += dt;
    this.dmgNumBudget = 30;
    this._frame = (this._frame || 0) + 1;
    this.buildGrid();
    this.updatePlayer(dt);
    if (this.state !== 'playing') return;
    this.updateAbilities(dt);
    this.updateWeapons(dt);
    this.updateProjectiles(dt);
    this.updateEnemies(dt);
    if (this.state !== 'playing') return;
    this.updateEnemyProjectiles(dt);
    this.updateHazards(dt);
    this.updateEffects(dt);
    this.updatePickups(dt);
    this.updateSpawning(dt);
    this.updateHole(dt);
    this.updateMerchant(dt);
    r.runeTimer -= dt;
    if (r.runeTimer <= 0) { r.runeTimer = rand(25, 40); this.spawnRune(); }
    this.processLevelUps();
  }
  updateCamera(dt) {
    let target = this.player?.pos;
    if (!target || this.state === 'menu') {
      const t = performance.now() / 1000 * 0.05;
      target = new THREE.Vector3(Math.sin(t) * 20, 0, Math.cos(t) * 20);
    }
    const dist = (Number(S('cameraDistance', 16)) || 16) * this.zoom;
    const ang = THREE.MathUtils.degToRad(Number(S('cameraAngle', 55)) || 55);
    const want = new THREE.Vector3(target.x, target.y + Math.sin(ang) * dist, target.z + Math.cos(ang) * dist);
    this.camera.position.lerp(want, Math.min(1, dt * 8));
    if (this.shake > 0.001) {
      this.camera.position.x += rand(-1, 1) * this.shake; this.camera.position.y += rand(-1, 1) * this.shake * 0.5;
      this.shake *= Math.max(0, 1 - dt * 8);
    }
    this.camera.lookAt(target.x, target.y + 0.8, target.z);
    this.sun.position.set(target.x + 20, 40, target.z + 15); this.sun.target.position.set(target.x, 0, target.z); this.sun.target.updateMatrixWorld();
  }
  _loop(now) {
    requestAnimationFrame(this._loop);
    now = now ?? performance.now();
    const cap = Number(S('fpsCap', 60)) || 0;
    const elapsed = now - this._last;
    if (cap > 0 && elapsed < 1000 / cap - 1.5) return;
    this._last = now;
    const dtRaw = Math.max(0, elapsed / 1000);
    const dt = Math.min(dtRaw, 0.05);
    this._fpsAcc += dtRaw; this._fpsFrames++;
    if (this._fpsAcc >= 0.5) { this.fps = this._fpsFrames / this._fpsAcc; this._fpsAcc = 0; this._fpsFrames = 0; if (this.fpsEl.style.display !== 'none') this.fpsEl.textContent = `${Math.round(this.fps)} FPS`; }
    try {
      if (this.state === 'playing' && !this.paused) this.update(dt);
      if (this.state === 'playing' && this.run) {
        this.updatePrompt();
        this.run.hudT -= dtRaw;
        if (this.run.hudT <= 0) { this.run.hudT = 0.066; try { this.ui?.updateHUD?.(this.hudState()); } catch (e) { console.warn(e); } }
        this.run.minimapT -= dtRaw;
        if (this.run.minimapT <= 0) { this.run.minimapT = 0.1; this.drawMinimap(); }
      }
    } catch (e) { console.error('[game update]', e); }
    this.updateCamera(this.paused ? 0 : dt);
    try { this.updateReticle(this.paused ? 0 : dt); } catch (e) { console.warn(e); }
    this.renderer.render(this.scene, this.camera);
  }
}

export default Game;
