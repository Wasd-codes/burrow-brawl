// Burrow Brawl — data tables. Pure data, no imports. See CONTRACT.md.

export const RARITY = {
  common:    { name: 'Common',    color: '#c8c8c8', weight: 60 },
  uncommon:  { name: 'Uncommon',  color: '#4fd45a', weight: 25 },
  rare:      { name: 'Rare',      color: '#3f8cff', weight: 10 },
  epic:      { name: 'Epic',      color: '#b04fff', weight: 4 },
  legendary: { name: 'Legendary', color: '#ff981f', weight: 1 },
};

const BASE = {
  maxHp: 100, hpRegen: 0.2, armor: 0, moveSpeed: 5, damage: 1, attackSpeed: 1,
  critChance: 0.05, critDamage: 1.5, area: 1, projectiles: 0, pickupRange: 3,
  xpGain: 1, luck: 0, dodge: 0, lifesteal: 0, cooldown: 1,
};
const stats = (o) => ({ ...BASE, ...o });

export const CHARACTERS = [
  { id: 'ninja_mole', name: 'Ninja Mole', model: 'ninja_mole', icon: '🥷', unlocked: true, unlockHint: '',
    desc: 'A swift tunneler who strikes from the dirt with throwing stars.',
    passive: { name: 'Burrow Reflexes', desc: '+12% dodge and +10% move speed.', stats: { dodge: 0.12, moveSpeed: 0.5 } },
    baseStats: stats({ maxHp: 85, moveSpeed: 5.8, critChance: 0.12, attackSpeed: 1.1 }),
    startWeapon: 'pebble_shuriken', moves: ['tunnel_dash', 'smoke_bomb'] },
  { id: 'wizard_hamster', name: 'Wizard Hamster', model: 'wizard_hamster', icon: '🐹', unlocked: true, unlockHint: '',
    desc: 'A cheek-stuffed arcanist whose spells grow with every level.',
    passive: { name: 'Cheek Pouch Mana', desc: '+20% area and -10% cooldowns.', stats: { area: 0.2, cooldown: -0.1 } },
    baseStats: stats({ maxHp: 75, damage: 1.15, area: 1.1, xpGain: 1.1, cooldown: 0.95 }),
    startWeapon: 'seed_missile', moves: ['arcane_burst', 'wheel_warp'] },
  { id: 'antknight', name: 'Anteater Knight', model: 'antknight', icon: '🛡️', unlocked: true, unlockHint: '',
    desc: 'An armored lancer with a long tongue and longer patience.',
    passive: { name: 'Plated Snout', desc: '+4 armor and 20% thorns-like resilience (+30 max HP).', stats: { armor: 4, maxHp: 30 } },
    baseStats: stats({ maxHp: 140, armor: 3, moveSpeed: 4.4, damage: 1.1, attackSpeed: 0.9, hpRegen: 0.5 }),
    startWeapon: 'tongue_lance', moves: ['shield_curl', 'lance_charge'] },
  { id: 'frog_monk', name: 'Frog Monk', model: 'frog_monk', icon: '🐸', unlocked: false, unlockHint: 'Defeat the Bramble Queen (Stage 1).',
    desc: 'A meditative brawler whose palms ripple the air.',
    passive: { name: 'Lily Pad Calm', desc: '+1.5 HP regen and +5% lifesteal.', stats: { hpRegen: 1.5, lifesteal: 0.05 } },
    baseStats: stats({ maxHp: 110, hpRegen: 1, attackSpeed: 1.15, moveSpeed: 5.2 }),
    startWeapon: 'ripple_palm', moves: ['leap_slam', 'pond_meditation'] },
  { id: 'robo_turtle', name: 'Robo Turtle', model: 'robo_turtle', icon: '🐢', unlocked: false, unlockHint: 'Survive 10 minutes on any stage.',
    desc: 'A clanking shell-bot that orbits drones around itself.',
    passive: { name: 'Reinforced Shell', desc: '+8 armor, but -10% move speed.', stats: { armor: 8, moveSpeed: -0.5 } },
    baseStats: stats({ maxHp: 160, armor: 5, moveSpeed: 4, attackSpeed: 0.85, projectiles: 1 }),
    startWeapon: 'gear_drones', moves: ['turret_deploy', 'missile_volley'] },
  { id: 'fox_ranger', name: 'Fox Ranger', model: 'fox_ranger', icon: '🦊', unlocked: false, unlockHint: 'Defeat the Dune Wyrm (Stage 2).',
    desc: 'A sharp-eyed archer who never misses a weak spot.',
    passive: { name: 'Keen Sight', desc: '+15% crit chance and +40% crit damage.', stats: { critChance: 0.15, critDamage: 0.4 } },
    baseStats: stats({ maxHp: 90, critChance: 0.1, critDamage: 1.8, moveSpeed: 5.4, projectiles: 1 }),
    startWeapon: 'briar_bow', moves: ['arrow_rain', 'fox_roll'] },
  { id: 'bee_witch', name: 'Bee Witch', model: 'bee_witch', icon: '🐝', unlocked: false, unlockHint: 'Defeat the Frost Matriarch (Stage 3).',
    desc: 'A buzzing hexer who commands a personal swarm.',
    passive: { name: 'Hive Mind', desc: '+2 projectiles, -10% damage.', stats: { projectiles: 2, damage: -0.1 } },
    baseStats: stats({ maxHp: 80, projectiles: 1, attackSpeed: 1.1, luck: 0.1 }),
    startWeapon: 'honey_swarm', moves: ['swarm_call', 'royal_jelly'] },
  { id: 'axolotl_bard', name: 'Axolotl Bard', model: 'axolotl_bard', icon: '🦎', unlocked: false, unlockHint: 'Defeat the Magma Colossus (Stage 4).',
    desc: 'A regenerating troubadour whose chords shatter foes.',
    passive: { name: 'Regrowth Ballad', desc: '+3 HP regen and +15% XP gain.', stats: { hpRegen: 3, xpGain: 0.15 } },
    baseStats: stats({ maxHp: 100, hpRegen: 1.2, xpGain: 1.1, area: 1.15, pickupRange: 4 }),
    startWeapon: 'sonic_lute', moves: ['power_chord', 'encore_heal'] },
  { id: 'pigeon_pirate', name: 'Pigeon Pirate', model: 'pigeon_pirate', icon: '🐦', unlocked: false, unlockHint: 'Defeat the Void Sovereign (Stage 5).',
    desc: 'A swaggering sky-scoundrel who lives for loot.',
    passive: { name: 'Plunderer', desc: '+30% luck and +50% pickup range.', stats: { luck: 0.3, pickupRange: 1.5 } },
    baseStats: stats({ maxHp: 95, luck: 0.2, damage: 1.05, moveSpeed: 5.5, pickupRange: 4 }),
    startWeapon: 'breadcrumb_cannon', moves: ['cannon_barrage', 'flock_summon'] },
  { id: 'nacho', name: 'Nacho Supremo', model: 'nacho', icon: '🔺', unlocked: false, secret: true, unlockHint: 'Secret: ???',
    desc: 'A legendary tortilla chip in shades. Has seen every way to die, and is extremely chill about it.',
    passive: { name: 'Extra Crunchy', desc: '+100% crit damage, +10% crit chance, and attackers take crunchy thorn damage.', stats: { critDamage: 1.0, critChance: 0.1 } },
    baseStats: stats({ maxHp: 90, armor: 2, moveSpeed: 5.4, critChance: 0.12, critDamage: 2.0, luck: 0.1 }),
    startWeapon: 'chip_shards', moves: ['guac_shield', 'cheese_avalanche'] },
];

const W = (name, icon, type, color, desc, base, perLevel) => ({
  name, icon, type, color, desc, maxLevel: 8,
  base: { damage: 10, cooldown: 1, area: 1, speed: 10, count: 1, pierce: 1, duration: 1, range: 8, ...base },
  perLevel,
});
export const WEAPONS = {
  pebble_shuriken: W('Pebble Shuriken', '✴️', 'projectile', '#9aa0a8', 'Throws spinning stones at the nearest foe.', { damage: 9, cooldown: 0.7, speed: 16, pierce: 2 }, { damage: 3, count: 0.25, cooldown: -0.03 }),
  seed_missile: W('Seed Missile', '🌰', 'projectile', '#b98cff', 'Homing magic seeds.', { damage: 12, cooldown: 1.0, speed: 11 }, { damage: 4, count: 0.34 }),
  tongue_lance: W('Tongue Lance', '🗡️', 'melee', '#e86a8a', 'A long sweeping lash in front of you.', { damage: 20, cooldown: 1.2, area: 1.4, range: 3.5, pierce: 99 }, { damage: 6, area: 0.1 }),
  ripple_palm: W('Ripple Palm', '🌊', 'nova', '#5ec8d8', 'Pulses a shockwave around you.', { damage: 14, cooldown: 1.6, area: 3, pierce: 99 }, { damage: 4, area: 0.3, cooldown: -0.05 }),
  gear_drones: W('Gear Drones', '⚙️', 'orbit', '#c0c6cc', 'Cogs orbit and grind enemies.', { damage: 8, cooldown: 3, count: 2, duration: 3, range: 2.5, speed: 3, pierce: 99 }, { damage: 2, count: 0.5, duration: 0.3 }),
  briar_bow: W('Briar Bow', '🏹', 'projectile', '#7cc24a', 'Fast piercing thorned arrows.', { damage: 11, cooldown: 0.8, speed: 22, pierce: 3, range: 14 }, { damage: 3, pierce: 0.5, cooldown: -0.03 }),
  honey_swarm: W('Honey Swarm', '🐝', 'chain', '#ffc23a', 'Bees hop between nearby foes.', { damage: 7, cooldown: 1.1, count: 3, range: 6 }, { damage: 2, count: 0.5 }),
  sonic_lute: W('Sonic Lute', '🎸', 'aura', '#ff7ad9', 'A constant damaging melody around you.', { damage: 4, cooldown: 0.5, area: 2.5, pierce: 99 }, { damage: 1.5, area: 0.25 }),
  breadcrumb_cannon: W('Breadcrumb Cannon', '💣', 'projectile', '#d9a35b', 'Lobbed crumbs that explode on impact.', { damage: 22, cooldown: 1.8, area: 1.5, speed: 9 }, { damage: 7, area: 0.15 }),
  acorn_boomerang: W('Acorn Boomerang', '🪃', 'boomerang', '#a0703a', 'Returns to you, hitting twice.', { damage: 13, cooldown: 1.4, speed: 12, pierce: 99, range: 9 }, { damage: 4, count: 0.34 }),
  static_whisker: W('Static Whisker', '⚡', 'chain', '#7fe8ff', 'Lightning arcs between enemies.', { damage: 15, cooldown: 1.5, count: 4, range: 7 }, { damage: 4, count: 0.5 }),
  thorn_ring: W('Thorn Ring', '🌿', 'orbit', '#4caf50', 'Bramble spikes circle you.', { damage: 10, cooldown: 4, count: 3, duration: 4, range: 3.2, speed: 2.5, pierce: 99 }, { damage: 3, count: 0.5 }),
  frost_breath: W('Frost Breath', '❄️', 'aura', '#bfefff', 'Chilling aura that slows foes.', { damage: 3, cooldown: 0.4, area: 2.2, pierce: 99 }, { damage: 1, area: 0.2 }),
  ember_nova: W('Ember Nova', '🔥', 'nova', '#ff6a2a', 'Bursts of flame in a ring.', { damage: 25, cooldown: 3, area: 4, pierce: 99 }, { damage: 7, area: 0.3, cooldown: -0.1 }),
  pine_cone_mortar: W('Pine Cone Mortar', '🌲', 'projectile', '#6b8e23', 'Random lobbed pinecone blasts.', { damage: 18, cooldown: 2, area: 2, count: 2, speed: 8, range: 10 }, { damage: 5, count: 0.5 }),
  chip_shards: W('Chip Shards', '🔺', 'projectile', '#f2b632', 'Flings salsa-dipped tortilla shards in a crunchy spread.', { damage: 8, cooldown: 0.75, count: 3, speed: 15, pierce: 1, range: 10 }, { damage: 3, count: 0.34, cooldown: -0.03 }),
  void_fang: W('Void Fang', '🌑', 'melee', '#7a3cff', 'Huge spectral bites around you.', { damage: 35, cooldown: 2.2, area: 2.2, range: 4, pierce: 99 }, { damage: 10, area: 0.15, cooldown: -0.08 }),
};

const A = (name, icon, key, kind, cooldown, power, radius, duration, color, desc) => ({ name, icon, key, kind, cooldown, power, radius, duration, color, desc });
export const ABILITIES = {
  tunnel_dash: A('Tunnel Dash', '💨', 'Q', 'dash', 4, 20, 1.5, 0.25, '#8b6a4a', 'Burrow forward, damaging anything you pass under.'),
  smoke_bomb: A('Smoke Bomb', '💨', 'E', 'shield', 14, 0, 4, 2.5, '#888888', 'Vanish in smoke, becoming untargetable briefly.'),
  arcane_burst: A('Arcane Burst', '✨', 'Q', 'nova', 6, 60, 5, 0, '#b98cff', 'Explosion of arcane energy around you.'),
  wheel_warp: A('Wheel Warp', '🌀', 'E', 'blink', 8, 0, 7, 0, '#d9b8ff', 'Teleport toward your cursor/facing.'),
  shield_curl: A('Shield Curl', '🛡️', 'Q', 'shield', 12, 0.7, 2, 3, '#c9a24a', 'Curl into armor, reducing damage by 70%.'),
  lance_charge: A('Lance Charge', '🐜', 'E', 'dash', 7, 45, 2, 0.5, '#e86a8a', 'Charge forward, knocking enemies back.'),
  leap_slam: A('Leap Slam', '🐸', 'Q', 'slam', 7, 70, 4.5, 0.6, '#5ec8d8', 'Leap and crash down in a wide splash.'),
  pond_meditation: A('Pond Meditation', '🧘', 'E', 'heal', 18, 40, 0, 2, '#7fe0a0', 'Restore 40% HP over 2s.'),
  turret_deploy: A('Turret Deploy', '🛰️', 'Q', 'summon', 15, 12, 8, 10, '#c0c6cc', 'Deploy an auto-firing turret.'),
  missile_volley: A('Missile Volley', '🚀', 'E', 'barrage', 10, 25, 8, 1.5, '#ff8844', 'Fire a volley of homing missiles.'),
  arrow_rain: A('Arrow Rain', '🌧️', 'Q', 'barrage', 9, 18, 5, 2.5, '#7cc24a', 'Arrows rain in an area for 2.5s.'),
  fox_roll: A('Fox Roll', '🦊', 'E', 'dash', 3.5, 0, 1, 0.3, '#ff9a4a', 'Quick invulnerable roll.'),
  swarm_call: A('Swarm Call', '🐝', 'Q', 'summon', 12, 8, 6, 8, '#ffc23a', 'Summon a cloud of attacking bees.'),
  royal_jelly: A('Royal Jelly', '🍯', 'E', 'heal', 16, 30, 0, 0, '#ffe08a', 'Heal 30% HP instantly.'),
  power_chord: A('Power Chord', '🎵', 'Q', 'nova', 7, 55, 6, 0, '#ff7ad9', 'A thunderous chord blasts enemies away.'),
  encore_heal: A('Encore', '💖', 'E', 'heal', 20, 50, 0, 3, '#ffa0c8', 'Heal 50% HP over 3s.'),
  cannon_barrage: A('Cannon Barrage', '💥', 'Q', 'barrage', 11, 35, 7, 2, '#d9a35b', 'Rapid volley of crumb bombs.'),
  guac_shield: A('Guac Shield', '🥑', 'Q', 'shield', 12, 0.75, 2.5, 3, '#6fbf3a', 'Smother yourself in guacamole, reducing damage by 75%.'),
  cheese_avalanche: A('Cheese Avalanche', '🧀', 'E', 'slam', 9, 85, 5, 0.6, '#ffd23a', 'Leap and bury nearby foes under molten queso.'),
  flock_summon: A('Flock Summon', '🕊️', 'E', 'summon', 16, 10, 7, 9, '#b0b8c8', 'Call a flock of pigeon mates to peck foes.'),
};

const S = (id, name, icon, stat, amount, mode, desc) => ({ id, name, icon, stat, amount, mode, desc });
export const STAT_UPGRADES = [
  S('vitality', 'Vitality', '❤️', 'maxHp', 20, 'add', '+20 max HP'),
  S('regen', 'Regrowth', '💚', 'hpRegen', 0.5, 'add', '+0.5 HP/s'),
  S('armor', 'Thick Hide', '🛡️', 'armor', 1, 'add', '+1 armor'),
  S('speed', 'Quick Paws', '👟', 'moveSpeed', 0.4, 'add', '+0.4 move speed'),
  S('might', 'Might', '💪', 'damage', 0.1, 'add', '+10% damage'),
  S('haste', 'Haste', '⏩', 'attackSpeed', 0.1, 'add', '+10% attack speed'),
  S('precision', 'Precision', '🎯', 'critChance', 0.05, 'add', '+5% crit chance'),
  S('ferocity', 'Ferocity', '💢', 'critDamage', 0.25, 'add', '+25% crit damage'),
  S('reach', 'Reach', '⭕', 'area', 0.1, 'add', '+10% area'),
  S('multishot', 'Multishot', '➕', 'projectiles', 1, 'add', '+1 projectile'),
  S('magnet', 'Magnetism', '🧲', 'pickupRange', 1, 'add', '+1 pickup range'),
  S('wisdom', 'Wisdom', '📘', 'xpGain', 0.1, 'add', '+10% XP gain'),
  S('fortune', 'Fortune', '🍀', 'luck', 0.1, 'add', '+10% luck'),
  S('evasion', 'Evasion', '🌫️', 'dodge', 0.04, 'add', '+4% dodge'),
  S('vampirism', 'Vampirism', '🩸', 'lifesteal', 0.02, 'add', '+2% lifesteal'),
  S('focus', 'Focus', '⏳', 'cooldown', 0.93, 'mult', '-7% cooldowns'),
];

const I = (id, name, icon, rarity, desc, stats, effect, effectValue) => {
  const o = { id, name, icon, rarity, desc, stats };
  if (effect) { o.effect = effect; o.effectValue = effectValue; }
  return o;
};
export const ITEMS = [
  // common
  I('acorn_cap', 'Acorn Cap', '🌰', 'common', '+2 armor.', { armor: 2 }),
  I('clover_sprig', 'Clover Sprig', '☘️', 'common', '+8% luck.', { luck: 0.08 }),
  I('earthworm_snack', 'Earthworm Snack', '🪱', 'common', '+15 max HP.', { maxHp: 15 }),
  I('pebble_charm', 'Pebble Charm', '🪨', 'common', '+6% damage.', { damage: 0.06 }),
  I('dandelion_fluff', 'Dandelion Fluff', '🌼', 'common', '+0.3 move speed.', { moveSpeed: 0.3 }),
  I('twig_bracer', 'Twig Bracer', '🥢', 'common', '+6% attack speed.', { attackSpeed: 0.06 }),
  I('dewdrop_vial', 'Dewdrop Vial', '💧', 'common', '+0.4 HP regen.', { hpRegen: 0.4 }),
  I('iron_filings', 'Iron Filings', '🧲', 'common', '+1 pickup range; pulls XP.', { pickupRange: 1 }, 'xpMagnet', 1),
  // uncommon
  I('burr_coat', 'Burr Coat', '🌵', 'uncommon', 'Reflect 20% of melee damage.', { armor: 1 }, 'thorns', 0.2),
  I('firefly_jar', 'Firefly Jar', '🏮', 'uncommon', '10% chance to burn on hit.', { damage: 0.04 }, 'burnOnHit', 0.1),
  I('owl_monocle', 'Owl Monocle', '🧐', 'uncommon', '+7% crit chance.', { critChance: 0.07 }),
  I('grub_satchel', 'Grub Satchel', '👜', 'uncommon', '+12% XP gain.', { xpGain: 0.12 }),
  I('moss_cloak', 'Moss Cloak', '🧥', 'uncommon', '+6% dodge.', { dodge: 0.06 }),
  I('frost_whisker', 'Frost Whisker', '🧊', 'uncommon', '8% chance to freeze on hit.', {}, 'freezeChance', 0.08),
  I('mushroom_cap', 'Spore Cap', '🍄', 'uncommon', '+12% area.', { area: 0.12 }),
  I('tick_fang', 'Tick Fang', '🦷', 'uncommon', '+3% lifesteal.', { lifesteal: 0.03 }),
  // rare
  I('popcorn_kernel', 'Popcorn Kernel', '🍿', 'rare', 'Enemies pop on death for 30% damage.', {}, 'onKillExplode', 0.3),
  I('berserker_berry', 'Berserker Berry', '🫐', 'rare', '+40% damage below 40% HP.', { maxHp: 10 }, 'lowHpDamage', 0.4),
  I('storm_feather', 'Storm Feather', '🪶', 'rare', 'Crits chain lightning.', { critChance: 0.04 }, 'chainOnCrit', 0.5),
  I('tortoise_plate', 'Tortoise Plate', '🐢', 'rare', '+5 armor, +30 HP, -0.3 speed.', { armor: 5, maxHp: 30, moveSpeed: -0.3 }),
  I('hourglass_seed', 'Hourglass Seed', '⌛', 'rare', '-12% cooldowns.', { cooldown: -0.12 }),
  I('extra_quiver', 'Extra Quiver', '🎒', 'rare', '+1 projectile.', { projectiles: 1 }),
  I('glow_moss', 'Glow Moss', '✨', 'rare', '+1.2 HP regen, +10% XP.', { hpRegen: 1.2, xpGain: 0.1 }),
  I('hornet_stinger', 'Hornet Stinger', '🐝', 'rare', '+50% crit damage.', { critDamage: 0.5 }),
  // epic
  I('ember_heart', 'Ember Heart', '❤️‍🔥', 'epic', '25% burn on hit, +10% damage.', { damage: 0.1 }, 'burnOnHit', 0.25),
  I('glacier_core', 'Glacier Core', '💎', 'epic', '18% freeze chance, +3 armor.', { armor: 3 }, 'freezeChance', 0.18),
  I('thunder_tail', 'Thunder Tail', '🌩️', 'epic', 'Crits always chain; +8% crit.', { critChance: 0.08 }, 'chainOnCrit', 1),
  I('bramble_crown', 'Bramble Crown', '👑', 'epic', 'Reflect 60% damage, +4 armor.', { armor: 4 }, 'thorns', 0.6),
  I('vacuum_burrow', 'Vacuum Burrow', '🌪️', 'epic', 'Massive XP pull, +20% XP.', { pickupRange: 4, xpGain: 0.2 }, 'xpMagnet', 3),
  I('twin_tails', 'Twin Tails', '🦊', 'epic', '+2 projectiles, +10% attack speed.', { projectiles: 2, attackSpeed: 0.1 }),
  I('blood_moon_tooth', 'Blood Moon Tooth', '🌕', 'epic', '+7% lifesteal, +10% damage.', { lifesteal: 0.07, damage: 0.1 }),
  // legendary
  I('phoenix_feather', 'Phoenix Feather', '🔥', 'legendary', 'Revive once at 50% HP.', { maxHp: 25 }, 'extraLife', 1),
  I('supernova_seed', 'Supernova Seed', '🌟', 'legendary', 'Kills explode for 100% damage; +15% area.', { area: 0.15 }, 'onKillExplode', 1),
  I('last_stand_badge', 'Last Stand Badge', '🎖️', 'legendary', '+100% damage below 40% HP; +10% dodge.', { dodge: 0.1 }, 'lowHpDamage', 1),
  I('golden_burrow', 'Golden Burrow', '🏆', 'legendary', '+25% damage, attack speed, area and luck.', { damage: 0.25, attackSpeed: 0.25, area: 0.25, luck: 0.25 }),
  I('ancient_shell', 'Ancient Shell', '🐚', 'legendary', '+10 armor, +80 HP, reflect 40%.', { armor: 10, maxHp: 80 }, 'thorns', 0.4),
  I('eternal_acorn', 'Eternal Acorn', '🌳', 'legendary', 'Extra life, +3 HP regen.', { hpRegen: 3 }, 'extraLife', 1),
];

export const RUNES = [
  { id: 'rune_might', name: 'Rune of Might', icon: '🔴', color: '#ff4040', kind: 'permanent', desc: '+5% damage permanently.', stats: { damage: 0.05 } },
  { id: 'rune_vigor', name: 'Rune of Vigor', icon: '💗', color: '#ff80a0', kind: 'permanent', desc: '+10 max HP permanently.', stats: { maxHp: 10 } },
  { id: 'rune_swift', name: 'Rune of Swiftness', icon: '🟢', color: '#40ff80', kind: 'permanent', desc: '+0.2 move speed.', stats: { moveSpeed: 0.2 } },
  { id: 'rune_ward', name: 'Rune of Warding', icon: '🟤', color: '#a07040', kind: 'permanent', desc: '+1 armor.', stats: { armor: 1 } },
  { id: 'rune_fortune', name: 'Rune of Fortune', icon: '🟡', color: '#ffe040', kind: 'permanent', desc: '+5% luck.', stats: { luck: 0.05 } },
  { id: 'rune_keen', name: 'Rune of Keenness', icon: '🔷', color: '#40a0ff', kind: 'permanent', desc: '+3% crit chance.', stats: { critChance: 0.03 } },
  { id: 'rune_tempo', name: 'Rune of Tempo', icon: '🟣', color: '#a040ff', kind: 'permanent', desc: '+5% attack speed.', stats: { attackSpeed: 0.05 } },
  { id: 'rune_expanse', name: 'Rune of Expanse', icon: '🔶', color: '#ff9a40', kind: 'permanent', desc: '+5% area.', stats: { area: 0.05 } },
  { id: 'rune_aegis', name: 'Aegis Rune', icon: '🛡️', color: '#ffffff', kind: 'temporary', duration: 6, desc: 'Invulnerable for 6s.', stats: {}, effect: 'invuln' },
  { id: 'rune_lodestone', name: 'Lodestone Rune', icon: '🧲', color: '#60e0ff', kind: 'temporary', duration: 1, desc: 'Pulls every XP gem on the map.', stats: {}, effect: 'magnet' },
  { id: 'rune_frenzy', name: 'Frenzy Rune', icon: '⚔️', color: '#ff2020', kind: 'temporary', duration: 10, desc: '+50% attack speed and damage for 10s.', stats: { attackSpeed: 0.5, damage: 0.5 }, effect: 'frenzy' },
  { id: 'rune_stillness', name: 'Stillness Rune', icon: '⏸️', color: '#80a0ff', kind: 'temporary', duration: 6, desc: 'Enemies slowed 70% for 6s.', stats: {}, effect: 'timeSlow' },
  { id: 'rune_scholar', name: 'Scholar Rune', icon: '📜', color: '#c0ff40', kind: 'temporary', duration: 20, desc: 'Double XP for 20s.', stats: {}, effect: 'doubleXp' },
  { id: 'rune_bloom', name: 'Bloom Rune', icon: '🌸', color: '#40ff40', kind: 'temporary', duration: 1, desc: 'Fully heal.', stats: {}, effect: 'heal' },
  { id: 'rune_gale', name: 'Gale Rune', icon: '🌬️', color: '#d0fff0', kind: 'temporary', duration: 12, desc: '+2 move speed for 12s.', stats: { moveSpeed: 2 } },
];

const E = (name, model, behavior, hp, damage, speed, xp, size, color, desc, projectile) => {
  const o = { name, model, behavior, hp, damage, speed, xp, size, color, desc };
  if (projectile) o.projectile = projectile;
  return o;
};
export const ENEMIES = {
  // Stage 1 — Clover Meadow
  sprout_grub: E('Sprout Grub', 'sprout_grub', 'chase', 12, 5, 2.4, 1, 0.7, '#9ccc65', 'A grub with a leaf growing from its back.'),
  pollen_puff: E('Pollen Puff', 'pollen_puff', 'swarm', 6, 3, 3.6, 1, 0.5, '#fff176', 'Drifting fuzzballs that come in clouds.'),
  thistle_hog: E('Thistle Hog', 'thistle_hog', 'charger', 30, 10, 2.2, 3, 1.0, '#8d6e63', 'Spiny boar that charges in straight lines.'),
  slug_spitter: E('Slug Spitter', 'slug_spitter', 'ranged', 18, 6, 1.6, 2, 0.8, '#aed581', 'Lobs slime globs from afar.', { speed: 7, damage: 6, color: '#aed581' }),
  puffball_shroom: E('Puffball Shroom', 'puffball_shroom', 'exploder', 14, 18, 2.8, 2, 0.8, '#d7ccc8', 'Bursts in a spore cloud when close.'),
  elite_oak_golem: E('Oak Golem', 'oak_golem', 'tank', 220, 18, 1.6, 25, 1.8, '#6d4c41', 'A walking stump, slow and sturdy.'),
  elite_bramble_witch: E('Bramble Shaman', 'bramble_shaman', 'healer', 140, 8, 2.0, 25, 1.3, '#558b2f', 'Heals nearby meadow critters.'),
  // Stage 2 — Sunscorch Dunes
  sand_skink: E('Sand Skink', 'sand_skink', 'swarm', 16, 6, 4.2, 1, 0.6, '#e0b060', 'Darting lizards in packs.'),
  dune_scarab: E('Dune Scarab', 'dune_scarab', 'splitter', 40, 9, 2.2, 3, 1.0, '#c08a2a', 'Splits into smaller beetles when slain.'),
  cactus_crab: E('Cactus Crab', 'cactus_crab', 'tank', 70, 12, 1.5, 4, 1.1, '#6aa84f', 'Armored crab with a cactus shell.'),
  mirage_jackal: E('Mirage Jackal', 'mirage_jackal', 'teleporter', 32, 11, 3.2, 3, 0.9, '#f4d58d', 'Flickers in and out of sight.'),
  tumble_imp: E('Tumble Imp', 'tumble_imp', 'charger', 28, 10, 3.0, 2, 0.8, '#b58b4c', 'Rolls inside a tumbleweed.'),
  elite_sun_sphinx: E('Sun Sphinx Cub', 'sun_sphinx', 'ranged', 380, 16, 2.0, 40, 1.7, '#ffcc33', 'Fires solar bolts.', { speed: 9, damage: 14, color: '#ffdd55' }),
  elite_sandstone_brute: E('Sandstone Brute', 'sandstone_brute', 'tank', 520, 24, 1.6, 40, 2.0, '#c9a46a', 'A living rock pile.'),
  // Stage 3 — Rimefang Caverns
  icicle_bat: E('Icicle Bat', 'icicle_bat', 'swarm', 22, 8, 4.4, 2, 0.6, '#b3e5fc', 'Shrieking frost bats.'),
  snow_mite: E('Snow Mite', 'snow_mite', 'splitter', 45, 10, 2.6, 3, 0.8, '#e1f5fe', 'Divides into tiny mites.'),
  glacier_yeti_pup: E('Glacier Pup', 'glacier_pup', 'charger', 80, 16, 2.6, 4, 1.2, '#cfd8dc', 'An overexcited frost pup that rams.'),
  rime_wisp: E('Rime Wisp', 'rime_wisp', 'ranged', 40, 12, 2.2, 3, 0.7, '#80deea', 'Floating ice lantern that shoots shards.', { speed: 10, damage: 12, color: '#80deea' }),
  crystal_tick: E('Crystal Tick', 'crystal_tick', 'exploder', 35, 30, 3.4, 3, 0.7, '#4dd0e1', 'Shatters violently on contact.'),
  elite_permafrost_walrus: E('Permafrost Walrus', 'permafrost_walrus', 'tank', 950, 30, 1.7, 60, 2.2, '#90a4ae', 'Tusked titan coated in ice.'),
  elite_aurora_seer: E('Aurora Seer', 'aurora_seer', 'healer', 600, 14, 2.2, 60, 1.5, '#b388ff', 'Mends allies with shimmering light.'),
  // Stage 4 — Cinderforge Rift
  ash_newt: E('Ash Newt', 'ash_newt', 'swarm', 35, 12, 4.4, 2, 0.6, '#ff7043', 'Smoldering newts that scurry in waves.'),
  magma_slug: E('Magma Slug', 'magma_slug', 'splitter', 90, 16, 2.0, 4, 1.1, '#ff5722', 'Splits into molten blobs.'),
  cinder_hound: E('Cinder Hound', 'cinder_hound', 'charger', 110, 22, 3.2, 5, 1.2, '#bf360c', 'Charges trailing embers.'),
  obsidian_imp: E('Obsidian Imp', 'obsidian_imp', 'teleporter', 75, 18, 3.0, 4, 0.9, '#37474f', 'Blinks through smoke.'),
  fumarole_toad: E('Fumarole Toad', 'fumarole_toad', 'ranged', 85, 16, 2.0, 4, 1.0, '#e64a19', 'Spits lava globs.', { speed: 8, damage: 18, color: '#ff8a50' }),
  elite_slag_juggernaut: E('Slag Juggernaut', 'slag_juggernaut', 'tank', 1900, 40, 1.8, 90, 2.4, '#4e342e', 'Armored forge beast.'),
  elite_ember_priest: E('Ember Priest', 'ember_priest', 'healer', 1200, 20, 2.2, 90, 1.5, '#ffab40', 'Rekindles fallen allies.'),
  // Stage 5 — Hollow Void Citadel
  void_mote: E('Void Mote', 'void_mote', 'swarm', 60, 16, 5.0, 3, 0.5, '#7c4dff', 'Flickering specks of nothing.'),
  gloom_stalker: E('Gloom Stalker', 'gloom_stalker', 'teleporter', 150, 26, 3.4, 6, 1.1, '#311b92', 'Blinks behind you.'),
  rift_eye: E('Rift Eye', 'rift_eye', 'ranged', 130, 22, 2.2, 6, 1.0, '#ea80fc', 'A floating eye firing void bolts.', { speed: 11, damage: 24, color: '#e040fb' }),
  null_bloater: E('Null Bloater', 'null_bloater', 'exploder', 120, 55, 2.8, 6, 1.2, '#4a148c', 'Collapses into a gravity pop.'),
  shade_knight: E('Shade Knight', 'shade_knight', 'charger', 220, 32, 3.0, 7, 1.4, '#1a1a40', 'Hollow armor that lunges.'),
  elite_star_eater: E('Star Eater', 'star_eater', 'tank', 3600, 55, 2.0, 140, 2.6, '#12005e', 'Devours light; enormous HP.'),
  elite_echo_weaver: E('Echo Weaver', 'echo_weaver', 'splitter', 2400, 35, 2.4, 140, 1.8, '#9575cd', 'Fractures into echoes of itself.'),
};

export const BOSSES = {
  bramble_queen: { name: 'Thornmother Briarelle', title: 'Queen of the Bramble', model: 'bramble_queen', hp: 3500, damage: 22, speed: 2.4, size: 3.2, color: '#2e7d32', phases: 2,
    attacks: ['summon', 'radialShot', 'charge'], desc: 'An ancient rosebush that tore up its own roots to walk.' },
  dune_wyrm: { name: 'Sizzlecoil', title: 'The Dune Wyrm', model: 'dune_wyrm', hp: 9000, damage: 32, speed: 3.0, size: 3.6, color: '#d4a03a', phases: 2,
    attacks: ['charge', 'teleport', 'spiral', 'slam'], desc: 'A sand serpent that swims beneath the dunes and erupts beneath prey.' },
  frost_matriarch: { name: 'Mother Rimeclaw', title: 'Frost Matriarch', model: 'frost_matriarch', hp: 20000, damage: 42, speed: 2.6, size: 3.8, color: '#a7e8ff', phases: 3,
    attacks: ['beam', 'radialShot', 'summon', 'slam'], desc: 'A colossal ice owl-bear who freezes the air with every breath.' },
  magma_colossus: { name: 'Pyrrhogrim', title: 'The Magma Colossus', model: 'magma_colossus', hp: 42000, damage: 58, speed: 2.2, size: 4.4, color: '#ff5722', phases: 3,
    attacks: ['meteor', 'slam', 'charge', 'spiral'], desc: 'A furnace-bellied giant that rains molten stone.' },
  void_sovereign: { name: 'Nihilune', title: 'Sovereign of the Hollow', model: 'void_sovereign', hp: 90000, damage: 75, speed: 3.0, size: 4.8, color: '#6a1b9a', phases: 4,
    attacks: ['teleport', 'beam', 'spiral', 'meteor', 'summon', 'radialShot'], desc: 'The final burrow-dweller who swallowed the sky. Every phase unravels reality further.' },
};

export const STAGES = [
  { id: 'clover_meadow', name: 'Clover Meadow', desc: 'Sunny fields above the burrows. A gentle start… for now.',
    map: { ground: '#6fae4a', fog: '#cfe8b8', sky: '#9fd4ff', ambient: '#ffffff', props: ['tree', 'rock', 'mushroom'], propDensity: 0.6 },
    enemies: ['sprout_grub', 'pollen_puff', 'thistle_hog', 'slug_spitter', 'puffball_shroom'], elites: ['elite_oak_golem', 'elite_bramble_witch'],
    boss: 'bramble_queen', bossTime: 300, unlocksStage: true },
  { id: 'sunscorch_dunes', name: 'Sunscorch Dunes', desc: 'Blistering sands hiding things that bite.',
    map: { ground: '#e3c17a', fog: '#f2dfae', sky: '#ffd98a', ambient: '#fff0d0', props: ['cactus', 'rock', 'bones', 'ruin'], propDensity: 0.4 },
    enemies: ['sand_skink', 'dune_scarab', 'cactus_crab', 'mirage_jackal', 'tumble_imp'], elites: ['elite_sun_sphinx', 'elite_sandstone_brute'],
    boss: 'dune_wyrm', bossTime: 330, unlocksStage: true },
  { id: 'rimefang_caverns', name: 'Rimefang Caverns', desc: 'Frozen tunnels lit by glowing crystal.',
    map: { ground: '#d8eef7', fog: '#9fc4d8', sky: '#284a66', ambient: '#bfe4ff', props: ['crystal', 'rock', 'pillar'], propDensity: 0.55 },
    enemies: ['icicle_bat', 'snow_mite', 'glacier_yeti_pup', 'rime_wisp', 'crystal_tick'], elites: ['elite_permafrost_walrus', 'elite_aurora_seer'],
    boss: 'frost_matriarch', bossTime: 360, unlocksStage: true },
  { id: 'cinderforge_rift', name: 'Cinderforge Rift', desc: 'A volcanic chasm where the earth bleeds fire.',
    map: { ground: '#3a2622', fog: '#5a2a1a', sky: '#2a0d06', ambient: '#ff9a6a', props: ['lavaRock', 'rock', 'bones'], propDensity: 0.5 },
    enemies: ['ash_newt', 'magma_slug', 'cinder_hound', 'obsidian_imp', 'fumarole_toad'], elites: ['elite_slag_juggernaut', 'elite_ember_priest'],
    boss: 'magma_colossus', bossTime: 390, unlocksStage: true },
  { id: 'void_citadel', name: 'Hollow Void Citadel', desc: 'The final fortress floating in nothing. Face the Sovereign.',
    map: { ground: '#1c1430', fog: '#120a24', sky: '#05010f', ambient: '#a080ff', props: ['pillar', 'ruin', 'crystal'], propDensity: 0.45 },
    enemies: ['void_mote', 'gloom_stalker', 'rift_eye', 'null_bloater', 'shade_knight'], elites: ['elite_star_eater', 'elite_echo_weaver'],
    boss: 'void_sovereign', bossTime: 420, unlocksStage: false },
];

export const DIFFICULTIES = [
  { id: 'easy', name: 'Easy', desc: 'Relaxed burrowing.', enemyHp: 0.7, enemyDmg: 0.6, spawnRate: 0.8, xpMult: 1.2, goldMult: 1.0, scalingMult: 0.75 },
  { id: 'normal', name: 'Normal', desc: 'The intended brawl.', enemyHp: 1, enemyDmg: 1, spawnRate: 1, xpMult: 1, goldMult: 1.1, scalingMult: 1 },
  { id: 'hard', name: 'Hard', desc: 'Tougher foes, better loot.', enemyHp: 1.4, enemyDmg: 1.3, spawnRate: 1.25, xpMult: 1, goldMult: 1.3, scalingMult: 1.2 },
  { id: 'nightmare', name: 'Nightmare', desc: 'Only veterans survive.', enemyHp: 2, enemyDmg: 1.7, spawnRate: 1.5, xpMult: 0.95, goldMult: 1.6, scalingMult: 1.45 },
  { id: 'endless_hell', name: 'Endless Hell', desc: 'Scaling never stops — and starts high.', enemyHp: 3, enemyDmg: 2.2, spawnRate: 1.9, xpMult: 0.9, goldMult: 2.0, scalingMult: 1.8 },
];

// Engine suggestion: mult = (1+hpPerMinute)^minutes (compounding), times postBossMult^(minutesSinceBoss) after boss.
export const SCALING = {
  hpPerMinute: 0.16,       // ~+16%/min compounding
  dmgPerMinute: 0.09,
  spawnPerMinute: 0.12,
  stageHpMult: [1, 1.6, 2.6, 4.2, 6.8],
  stageDmgMult: [1, 1.35, 1.8, 2.4, 3.2],
  postBossMult: 1.25,      // extra per-minute growth factor once the boss is dead
};

export const MERCHANT = {
  spawnInterval: 15, spawnChance: 0.35, lifetime: 45, stockSize: 4,
  priceByRarity: { common: 25, uncommon: 55, rare: 110, epic: 220, legendary: 450 },
  rerollCost: 15,
};

export const SHRINE = { count: 3, usesPerShrine: 1 };

export function xpForLevel(level) {
  const l = Math.max(1, level | 0);
  return Math.floor(5 + l * 6 + Math.pow(l, 1.9) * 1.2);
}

export function rollRarity(luck = 0) {
  const keys = Object.keys(RARITY);
  const l = Math.max(0, luck);
  const weights = keys.map((k, i) => RARITY[k].weight * (i === 0 ? 1 / (1 + l) : 1 + l * i));
  let r = Math.random() * weights.reduce((a, b) => a + b, 0);
  for (let i = 0; i < keys.length; i++) { r -= weights[i]; if (r <= 0) return keys[i]; }
  return 'common';
}

export const MODEL_KEYS = {
  characters: CHARACTERS.map((c) => c.model),
  enemies: [...new Set(Object.values(ENEMIES).map((e) => e.model))],
  bosses: Object.values(BOSSES).map((b) => b.model),
};
