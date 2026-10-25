# Burrow Brawl — Module Contract

Original 3D roguelike survival game (horde-survivor genre). Browser, no build step.
Three.js loaded via import map in `index.html`:
`"three": "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js"`.
All files are ES modules in `js/`. Use `import * as THREE from 'three'`.
Run with `python3 -m http.server` from the project root.

## Files and owners

| File | Exports | Owner |
|---|---|---|
| `js/data.js` | data tables (below) | Data agent |
| `js/models.js` | low-poly mesh builders | Models agent |
| `js/ui.js` + `css/osrs.css` | `UI` class | UI agent |
| `js/settings.js` | `Settings` | UI agent |
| `js/game.js`, `js/main.js`, `js/audio.js` | engine | Core agent |

Do not edit files you don't own. If something is missing from another module, code defensively (`?.`, defaults).

## js/data.js
```js
export const RARITY = { common:{name,color,weight}, uncommon, rare, epic, legendary };
export const CHARACTERS = [ {
  id, name, desc, model /*key for models.js*/, unlocked /*bool*/, unlockHint,
  passive: { name, desc, stats:{...statDeltas} },          // the "specific attribute"
  baseStats: { maxHp, hpRegen, armor, moveSpeed, damage /*mult 1*/, attackSpeed /*mult 1*/,
               critChance, critDamage, area /*mult*/, projectiles /*int add*/, pickupRange,
               xpGain /*mult*/, luck, dodge, lifesteal, cooldown /*mult, lower=better*/ },
  startWeapon: weaponId,
  moves: [ abilityId, abilityId ]   // character-specific actives on Q and E
} ];
// Starters (unlocked:true): 'ninja_mole', 'wizard_hamster', 'antknight' (anteater knight).
// At least 5 more locked characters (unlock by beating stages / bosses).
export const WEAPONS = { id: { name, desc, icon /*emoji*/, type:'projectile'|'melee'|'orbit'|'aura'|'nova'|'chain'|'boomerang',
  base:{ damage, cooldown /*s*/, area, speed, count, pierce, duration, range }, perLevel:{...additive deltas}, maxLevel:8, color } };
export const ABILITIES = { id: { name, desc, icon, key:'Q'|'E', cooldown, kind:'dash'|'blink'|'nova'|'shield'|'summon'|'barrage'|'slam'|'heal', power, radius, duration, color } };
export const STAT_UPGRADES = [ { id, name, icon, desc, stat, amount, mode:'add'|'mult' } ];  // level-up choices
export const ITEMS = [ { id, name, icon, rarity, desc, stats:{...}, effect? /*string key: 'onKillExplode','thorns','lowHpDamage','xpMagnet','extraLife','burnOnHit','chainOnCrit','freezeChance'*/, effectValue? } ]; // >=30 items across rarities
export const RUNES = [ { id, name, icon, color, kind:'permanent'|'temporary', duration? /*s*/, desc, stats:{...} , effect? /*'invuln','magnet','frenzy','timeSlow','doubleXp','heal'*/ } ]; // >=12
export const ENEMIES = { id: { name, model, hp, damage, speed, xp, size, color, behavior:'chase'|'ranged'|'charger'|'swarm'|'tank'|'exploder'|'splitter'|'healer'|'teleporter', projectile? , desc } }; // >=20
export const BOSSES = { id: { name, title, model, hp, damage, speed, size, color, attacks:[ 'slam'|'radialShot'|'charge'|'summon'|'beam'|'meteor'|'teleport'|'spiral' ], phases:int, desc } };
export const STAGES = [ {  // 5 entries, index 4 = final boss stage
  id, name, desc, map: { ground, fog, sky, ambient, props:[ 'tree'|'rock'|'crystal'|'mushroom'|'pillar'|'cactus'|'lavaRock'|'bones'|'ruin' ], propDensity },
  enemies:[ids], elites:[ids], boss: bossId, bossTime /*seconds until boss spawns e.g. 300*/, unlocksStage:true
} ];
export const DIFFICULTIES = [ { id:'easy'|'normal'|'hard'|'nightmare'|'endless_hell', name, desc, enemyHp, enemyDmg, spawnRate, xpMult, goldMult, scalingMult } ];
export const SCALING = { hpPerMinute, dmgPerMinute, spawnPerMinute, stageHpMult:[...5], stageDmgMult:[...5], postBossMult /*extra growth after boss killed: infinite loop*/ };
export const MERCHANT = { spawnInterval:15, spawnChance:0.35, lifetime:45, stockSize:4, priceByRarity:{common:..}, rerollCost };
export const SHRINE = { count:3 /*per map*/, usesPerShrine:1 };
export function xpForLevel(level) {}
export function rollRarity(luck) {} // returns rarity key
```

## js/models.js
Every builder returns a `THREE.Group` made of flat-shaded low-poly primitives (`MeshLambertMaterial({flatShading:true})` or `MeshStandardMaterial({flatShading:true})`), origin at feet, facing +Z, height ~1–2 units for normal-size.
```js
export function buildCharacter(modelKey) // 'ninja_mole','wizard_hamster','antknight' + every CHARACTERS model in data.js
export function buildEnemy(modelKey, color, size)  // every ENEMIES/BOSSES model key; unknown keys -> generic blob
export function buildProp(type, rng)     // map props
export function buildMerchant()  // black market dealer stall w/ hooded figure
export function buildShrine()
export function buildRune(color)
export function buildChest()
export function buildXpGem(tier)   // 0..3
export function buildGold()
export function animate(group, t, moving) // optional bob/limb swing; groups may set userData.limbs
```
Model keys must match data.js — Models agent reads data.js after it exists, or uses the key list below:
characters: ninja_mole, wizard_hamster, antknight, frog_monk, robo_turtle, fox_ranger, bee_witch, axolotl_bard, pigeon_pirate
(data agent must use these exact 9 character model keys).

## js/settings.js
```js
export const Settings = { get(key), set(key,val), all(), reset(), onChange(fn), DEFAULTS, SCHEMA }
// persisted in localStorage (try/catch). SCHEMA groups: Video, Audio, Gameplay, Controls, Interface, Accessibility.
// Keys must include: masterVolume, musicVolume, sfxVolume, mute, quality('low'|'medium'|'high'), shadows, fov,
// renderScale, showFps, cameraDistance, cameraAngle, cameraShake, screenFlash, damageNumbers, autoAttack(always true),
// autoPickupItems, showRanges, healthBars, enemyOutlines, uiScale, minimap, colorblindMode, reducedMotion,
// pauseOnFocusLoss, confirmQuit, showTimer, showDps, keybinds:{up,down,left,right,ability1,ability2,interact,pause,map,stats},
// autoLevelUp(false), levelUpPickDelay, textSize, fpsCap.
```

## js/ui.js  (OSRS-style: stone/brown beveled panels, gold `#ff981f` / yellow text, serif pixel-ish font "RuneScape-like" via Google font 'VT323' or 'Press Start 2P' fallback, orange chat box, tab panel bottom-right)
```js
export class UI {
  constructor(root /*#ui div*/, game /*Game instance*/)
  // menus
  showMainMenu()  // Play -> character select -> stage select (locked stages greyed) -> difficulty -> game.startRun({characterId, stageIndex, difficultyId})
                  // also Settings, Collection (characters/items/enemies codex), Quit
  showSettings(onClose)       // full settings from Settings.SCHEMA, every key adjustable, reset defaults
  // in-run HUD (update called every frame with game state)
  showHUD(); hideHUD(); updateHUD(state)  // state: {hp,maxHp,xp,xpNext,level,gold,time,kills,stage,difficulty,weapons:[{id,level}],items:[...],buffs:[{name,icon,remaining}],abilities:[{id,cdRemaining,cdMax}],bossHp?:{name,hp,maxHp},fps,dps,loop}
  log(msg, color)    // OSRS chatbox message
  // modal popups — each calls game.pause() on open and game.resume() on close
  showLevelUp(choices /*[{kind:'weapon'|'stat'|'ability', id, name, icon, desc, rarity}]*/, onPick)
  showMerchant(stock /*[{item,price}]*/, gold, onBuy(index)->bool, onReroll()->stock|null, onClose)
  showShrine(playerItems /*[item]*/, onTrade(itemIndex)->newItem, onClose)
  showChest(item, onTake)
  showPause(onResume, onSettings, onQuit)
  showStats(player)   // character stats panel (Tab key / 'stats' keybind)
  showGameOver(summary, onRetry, onMenu)
  showVictory / showBossDefeated(bossName, onContinueEndless, onNextStage)  // after boss: continue infinitely OR go to next stage
  isModalOpen()
  damageNumber(screenX, screenY, amount, crit)  // floating number (respect Settings)
}
```

## js/game.js / main.js (Core)
`Game` class: `pause()`, `resume()` (ref-counted so nested modals work), `startRun(opts)`, `quitToMenu()`, `player`, `state`.
Core owns: renderer, camera (3rd-person follow, mouse wheel zoom), WASD movement, auto-attacking weapons,
Q/E abilities, enemy spawning & per-stage roster, scaling over time + stage + difficulty, boss at `bossTime`
then infinite continuation with `postBossMult` escalation, XP gems, gold, chests, runes (random drops & spawns),
merchant (every 15s roll 35% if none present), shrines, interact key F within radius opens modal,
meta progression in localStorage (unlocked characters/stages, best times), FPS cap, render scale, pause on blur.

## v2 additions

### js/accounts.js (UI agent owns)
Local accounts stored in localStorage (no server). Passwords hashed with SubtleCrypto SHA-256 + salt (local-only; not real security).
```js
export const Accounts = {
  current() -> {username, createdAt, stats, meta} | null,   // guest account 'Guest' if none logged in
  async register(username, password) -> {ok, error?}, async login(username, password) -> {ok, error?}, logout(),
  list() -> [usernames],
  recordRun(summary) -> void   // ALWAYS called by core at run end: death, quit, victory, or jumping to next stage counts as a stage segment
  getStats() -> lifetime totals: runs, deaths, victories, kills, timePlayed, gold, bossesKilled, stagesCleared, highestLevel, bestTimes{stageIdx:sec}, characterRuns{charId:n}, damageDealt
  leaderboard(category /*'score'|'time'|'kills'|'level'*/, filter{stage?, difficulty?, character?}) -> [{username, character, stage, difficulty, score, time, kills, level, endedBy, date}] top 50 across ALL local accounts
  saveMeta(meta), loadMeta() -> meta   // per-account unlock progression (replaces game's own localStorage meta)
  onChange(fn)
}
```
summary: {character, stage, difficulty, time, kills, level, gold, damageDealt, bossesKilled, endedBy:'death'|'quit'|'victory'|'nextStage', loop, score}
score = floor(kills*10 + time*2 + level*50 + bossesKilled*1000) × difficulty mult (core computes).

### Boss hole flow (core owns gameplay; UI owns prompts)
- At bossTime a crack/hole appears with rumble + telegraph ~3s, boss rises from the ground through it (animate y from -size*2 to 0), invulnerable while emerging.
- Boss death: NO modal. The hole stays (glowing portal ring) and the run continues endlessly with postBossMult escalation + periodic stronger boss re-emerging from the same hole.
- Standing on the hole: prompt "[F] Jump into the hole". Pressing F opens `ui.showHoleConfirm({finalStage:bool, nextStageName}, onJump, onCancel)` (modal, pauses).
  - Non-final stage: jump => recordRun(endedBy:'nextStage'), unlock next stage, load next stage map KEEPING player build (level, weapons, items, stats, gold); timer continues; stage index increments; scaling uses new stage mult.
  - Final stage: jump => victory; run ends (recordRun endedBy:'victory'), ui.showGameOver(summary with victory:true).
- Death anywhere => run ends, recordRun(endedBy:'death'). Quit from pause => recordRun(endedBy:'quit').
- ui.log announces "The ground trembles..." etc.

### Aiming (Settings key `aimMode`: 'smart'|'mouse'|'closest', default 'smart')
- closest: nearest enemy.  mouse: direction from player to mouse cursor raycast on ground plane (y=0); weapons fire toward that point even with no enemies.
- smart: prioritize boss/elites in range, else lowest-time-to-kill / densest cluster in range, else closest; projectiles lead moving targets.
- Optional `showAimIndicator` toggle draws a ground reticle at aim point. Remove old `autoAim` key (migrate value).
