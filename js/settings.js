// Burrow Brawl settings — localStorage persisted.
const STORAGE_KEY = 'burrowbrawl.settings.v1';

const DEFAULT_KEYBINDS = {
  up: 'KeyW', down: 'KeyS', left: 'KeyA', right: 'KeyD',
  ability1: 'KeyQ', ability2: 'KeyE', interact: 'KeyF',
  pause: 'Escape', map: 'KeyM', stats: 'Tab',
};

const SCHEMA = [
  { group: 'Video', items: [
    { key: 'quality', label: 'Graphics Quality', type: 'select', options: ['low', 'medium', 'high'] },
    { key: 'shadows', label: 'Shadows', type: 'toggle' },
    { key: 'fov', label: 'Field of View', type: 'slider', min: 50, max: 100, step: 1 },
    { key: 'renderScale', label: 'Render Scale', type: 'slider', min: 0.5, max: 2, step: 0.05 },
    { key: 'fpsCap', label: 'FPS Cap', type: 'select', options: [30, 60, 120, 144, 0], labels: ['30', '60', '120', '144', 'Unlimited'] },
    { key: 'showFps', label: 'Show FPS', type: 'toggle' },
    { key: 'cameraDistance', label: 'Camera Distance', type: 'slider', min: 8, max: 30, step: 0.5 },
    { key: 'cameraAngle', label: 'Camera Angle', type: 'slider', min: 25, max: 80, step: 1 },
    { key: 'cameraShake', label: 'Camera Shake', type: 'slider', min: 0, max: 1, step: 0.05 },
    { key: 'screenFlash', label: 'Screen Flash', type: 'toggle' },
    { key: 'enemyOutlines', label: 'Enemy Outlines', type: 'toggle' },
  ]},
  { group: 'Audio', items: [
    { key: 'masterVolume', label: 'Master Volume', type: 'slider', min: 0, max: 1, step: 0.05 },
    { key: 'musicVolume', label: 'Music Volume', type: 'slider', min: 0, max: 1, step: 0.05 },
    { key: 'sfxVolume', label: 'Effects Volume', type: 'slider', min: 0, max: 1, step: 0.05 },
    { key: 'mute', label: 'Mute All', type: 'toggle' },
    { key: 'muteOnFocusLoss', label: 'Mute When Unfocused', type: 'toggle' },
  ]},
  { group: 'Gameplay', items: [
    { key: 'autoAttack', label: 'Auto Attack', type: 'toggle', locked: true },
    { key: 'aimMode', label: 'Aim Mode', type: 'select', options: ['smart', 'mouse', 'closest'],
      labels: ['Smart (bosses/elites, clusters, leads targets)', 'Mouse (fire toward cursor)', 'Closest (nearest enemy)'] },
    { key: 'showAimIndicator', label: 'Show Aim Indicator', type: 'toggle' },
    { key: 'autoPickupItems', label: 'Auto Pickup Items', type: 'toggle' },
    { key: 'pickupMagnetBoost', label: 'Pickup Magnet Boost', type: 'toggle' },
    { key: 'autoLevelUp', label: 'Auto Pick Level-Ups', type: 'toggle' },
    { key: 'levelUpPickDelay', label: 'Level-Up Input Delay (s)', type: 'slider', min: 0, max: 1.5, step: 0.1 },
    { key: 'pauseOnLevelUp', label: 'Pause On Level-Up', type: 'select', options: ['always', 'never'] },
    { key: 'pauseOnFocusLoss', label: 'Pause On Focus Loss', type: 'toggle' },
    { key: 'confirmQuit', label: 'Confirm Quit', type: 'toggle' },
    { key: 'confirmShopPurchase', label: 'Confirm Shop Purchases', type: 'toggle' },
    { key: 'showRanges', label: 'Show Weapon Ranges', type: 'toggle' },
  ]},
  { group: 'Controls', items: [
    { key: 'keybinds.up', label: 'Move Up', type: 'keybind' },
    { key: 'keybinds.down', label: 'Move Down', type: 'keybind' },
    { key: 'keybinds.left', label: 'Move Left', type: 'keybind' },
    { key: 'keybinds.right', label: 'Move Right', type: 'keybind' },
    { key: 'keybinds.ability1', label: 'Ability 1', type: 'keybind' },
    { key: 'keybinds.ability2', label: 'Ability 2', type: 'keybind' },
    { key: 'keybinds.interact', label: 'Interact', type: 'keybind' },
    { key: 'keybinds.pause', label: 'Pause', type: 'keybind' },
    { key: 'keybinds.map', label: 'Toggle Minimap', type: 'keybind' },
    { key: 'keybinds.stats', label: 'Stats Panel', type: 'keybind' },
    { key: 'mouseSensitivity', label: 'Zoom Sensitivity', type: 'slider', min: 0.1, max: 3, step: 0.1 },
  ]},
  { group: 'Interface', items: [
    { key: 'uiScale', label: 'UI Scale', type: 'slider', min: 0.6, max: 1.6, step: 0.05 },
    { key: 'minimap', label: 'Show Minimap', type: 'toggle' },
    { key: 'showTimer', label: 'Show Timer', type: 'toggle' },
    { key: 'showDps', label: 'Show DPS', type: 'toggle' },
    { key: 'showEnemyCount', label: 'Show Enemy Count', type: 'toggle' },
    { key: 'damageNumbers', label: 'Damage Numbers', type: 'toggle' },
    { key: 'damageNumbersCritsOnly', label: 'Damage Numbers: Crits Only', type: 'toggle' },
    { key: 'healthBars', label: 'Enemy Health Bars', type: 'toggle' },
    { key: 'chatboxOpacity', label: 'Chatbox Opacity', type: 'slider', min: 0, max: 1, step: 0.05 },
    { key: 'showChatbox', label: 'Show Chatbox', type: 'toggle' },
    { key: 'showTooltips', label: 'Item Tooltips', type: 'toggle' },
  ]},
  { group: 'Accessibility', items: [
    { key: 'colorblindMode', label: 'Colorblind Mode', type: 'select', options: ['off', 'protanopia', 'deuteranopia', 'tritanopia'] },
    { key: 'textSize', label: 'Text Size', type: 'select', options: ['small', 'medium', 'large', 'xlarge'] },
    { key: 'reducedMotion', label: 'Reduced Motion', type: 'toggle' },
    { key: 'highContrast', label: 'High Contrast UI', type: 'toggle' },
  ]},
];

const DEFAULTS = {
  quality: 'medium', shadows: true, fov: 60, renderScale: 1, fpsCap: 60, showFps: false,
  cameraDistance: 16, cameraAngle: 55, cameraShake: 0.6, screenFlash: true, enemyOutlines: false,
  masterVolume: 0.8, musicVolume: 0.5, sfxVolume: 0.8, mute: false, muteOnFocusLoss: true,
  autoAttack: true, aimMode: 'smart', showAimIndicator: true, autoPickupItems: true, pickupMagnetBoost: false,
  autoLevelUp: false, levelUpPickDelay: 0.3, pauseOnLevelUp: 'always', pauseOnFocusLoss: true,
  confirmQuit: true, confirmShopPurchase: false, showRanges: false,
  keybinds: { ...DEFAULT_KEYBINDS }, mouseSensitivity: 1,
  uiScale: 1, minimap: true, showTimer: true, showDps: false, showEnemyCount: false,
  damageNumbers: true, damageNumbersCritsOnly: false, healthBars: true, chatboxOpacity: 0.85, showChatbox: true, showTooltips: true,
  colorblindMode: 'off', textSize: 'medium', reducedMotion: false, highContrast: false,
};

const clone = (o) => JSON.parse(JSON.stringify(o));
let values = clone(DEFAULTS);
const listeners = new Set();

try {
  const raw = typeof localStorage !== 'undefined' && localStorage.getItem(STORAGE_KEY);
  if (raw) {
    const saved = JSON.parse(raw);
    if (saved && typeof saved === 'object') {
      Object.assign(values, saved);
      values.keybinds = { ...DEFAULT_KEYBINDS, ...(saved.keybinds || {}) };
      values.autoAttack = true;
      if ('autoAim' in saved) {
        if (!('aimMode' in saved)) values.aimMode = saved.autoAim === 'mouse' ? 'mouse' : 'closest';
        delete values.autoAim;
      }
      if (!['smart', 'mouse', 'closest'].includes(values.aimMode)) values.aimMode = 'smart';
    }
  }
} catch (e) { /* ignore */ }

delete values.autoAim;
function save() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(values)); } catch (e) { /* ignore */ }
}
function emit(key, val) {
  for (const fn of listeners) { try { fn(key, val, values); } catch (e) { console.error(e); } }
}

export const Settings = {
  DEFAULTS, SCHEMA,
  get(key) {
    if (key.includes('.')) return key.split('.').reduce((o, k) => (o == null ? undefined : o[k]), values);
    return values[key];
  },
  set(key, val) {
    if (key === 'autoAttack') val = true;
    if (key.includes('.')) {
      const parts = key.split('.');
      let o = values;
      for (let i = 0; i < parts.length - 1; i++) { o[parts[i]] = o[parts[i]] || {}; o = o[parts[i]]; }
      o[parts[parts.length - 1]] = val;
    } else values[key] = val;
    save(); emit(key, val);
  },
  all() { return clone(values); },
  reset() { values = clone(DEFAULTS); save(); emit('*', null); },
  onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); },
};
export default Settings;
