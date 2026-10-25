// Burrow Brawl — tiny WebAudio synth: sfx + procedural music loop.
import { Settings } from './settings.js';

const S = (k, d) => { try { const v = Settings?.get?.(k); return v == null ? d : v; } catch { return d; } };
const vol = (k, d) => { let v = Number(S(k, d)); if (!isFinite(v)) v = d; if (v > 1) v /= 100; return Math.max(0, Math.min(1, v)); };

let ctx = null, master, sfxBus, musicBus;
let focusMuted = false;
const last = {};
let music = null;

function init() {
  if (ctx) return ctx;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  try {
    ctx = new AC();
    master = ctx.createGain(); master.connect(ctx.destination);
    sfxBus = ctx.createGain(); sfxBus.connect(master);
    musicBus = ctx.createGain(); musicBus.connect(master);
    apply();
  } catch (e) { ctx = null; }
  return ctx;
}

function apply() {
  if (!ctx) return;
  const muted = S('mute', false) || focusMuted;
  master.gain.value = muted ? 0 : vol('masterVolume', 0.8);
  sfxBus.gain.value = vol('sfxVolume', 0.8);
  musicBus.gain.value = vol('musicVolume', 0.5) * 0.35;
}

function tone(freq, dur, type = 'square', v = 0.15, slideTo = null, delay = 0, bus = sfxBus) {
  if (!ctx) return;
  const t = ctx.currentTime + delay;
  const o = ctx.createOscillator(); const g = ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(v, t + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(bus); o.start(t); o.stop(t + dur + 0.02);
}

let noiseBuf = null;
function noise(dur, v = 0.15, freq = 1200, delay = 0) {
  if (!ctx) return;
  if (!noiseBuf) {
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  const t = ctx.currentTime + delay;
  const s = ctx.createBufferSource(); s.buffer = noiseBuf;
  const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = freq;
  const g = ctx.createGain(); g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f); f.connect(g); g.connect(sfxBus); s.start(t); s.stop(t + dur + 0.02);
}

const SFX = {
  hit: () => tone(180 + Math.random() * 60, 0.06, 'square', 0.05, 90),
  crit: () => tone(520, 0.08, 'square', 0.07, 260),
  shoot: () => tone(700 + Math.random() * 100, 0.05, 'triangle', 0.03, 400),
  pickup: () => tone(880 + Math.random() * 120, 0.06, 'sine', 0.06, 1400),
  gold: () => { tone(1320, 0.05, 'square', 0.04); tone(1760, 0.08, 'square', 0.04, null, 0.05); },
  levelup: () => [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.16, 'triangle', 0.12, null, i * 0.08)),
  hurt: () => { tone(220, 0.15, 'sawtooth', 0.1, 80); noise(0.1, 0.08, 800); },
  explode: () => { noise(0.35, 0.18, 600); tone(110, 0.3, 'sine', 0.15, 40); },
  boss: () => { [110, 104, 98, 82].forEach((f, i) => tone(f, 0.5, 'sawtooth', 0.12, null, i * 0.35)); noise(1.2, 0.1, 300); },
  ability: () => tone(300, 0.2, 'sawtooth', 0.08, 900),
  chest: () => [392, 523, 659, 784, 1046].forEach((f, i) => tone(f, 0.12, 'square', 0.06, null, i * 0.06)),
  rune: () => { tone(660, 0.3, 'sine', 0.1, 1320); tone(990, 0.3, 'sine', 0.06, 1980, 0.05); },
  buy: () => { tone(1046, 0.06, 'square', 0.05); tone(1318, 0.1, 'square', 0.05, null, 0.06); },
  death: () => [392, 330, 262, 196].forEach((f, i) => tone(f, 0.3, 'triangle', 0.12, null, i * 0.2)),
  victory: () => [523, 659, 784, 1046, 784, 1046].forEach((f, i) => tone(f, 0.22, 'triangle', 0.12, null, i * 0.14)),
  ui: () => tone(600, 0.04, 'square', 0.04),
  rumble: () => { noise(2.8, 0.22, 160); tone(55, 2.6, 'sawtooth', 0.12, 35); tone(41, 2.8, 'sine', 0.18, 30, 0.2); },
  portal: () => { tone(220, 0.8, 'sine', 0.1, 880); tone(330, 0.8, 'triangle', 0.06, 1320, 0.1); noise(0.6, 0.05, 2000); },
};

// ---------------- music ----------------
const SCALES = [[0, 3, 5, 7, 10], [0, 2, 4, 7, 9], [0, 2, 3, 7, 8], [0, 1, 5, 7, 10], [0, 3, 6, 7, 10]];
function mulberry(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

function makePattern(seed) {
  const r = mulberry(seed * 9973 + 17);
  const scale = SCALES[seed % SCALES.length];
  const root = 110 * Math.pow(2, [0, 2, -2, -4, -1][seed % 5] / 12);
  const lead = [], bass = [];
  for (let i = 0; i < 32; i++) {
    lead.push(r() < 0.55 ? scale[Math.floor(r() * scale.length)] + 12 * (r() < 0.3 ? 2 : 1) : null);
    bass.push(i % 4 === 0 ? scale[[0, 0, 3, 4][(i / 8) | 0] % scale.length] : (i % 4 === 2 && r() < 0.5 ? 12 : null));
  }
  return { lead, bass, root };
}

export const Audio = {
  unlock() { init(); try { ctx?.resume?.(); } catch {} },
  apply,
  setFocusMuted(m) { focusMuted = !!m; apply(); },
  play(name) {
    if (!ctx || ctx.state !== 'running') return;
    const now = performance.now();
    const gap = name === 'hit' ? 45 : name === 'pickup' ? 35 : 25;
    if (last[name] && now - last[name] < gap) return;
    last[name] = now;
    try { (SFX[name] || SFX.ui)(); } catch {}
  },
  startMusic(seed = 0, intense = false) {
    this.stopMusic();
    init(); if (!ctx) return;
    const pat = makePattern(seed);
    const bpm = intense ? 150 : 118;
    const step = 60 / bpm / 2;
    let next = ctx.currentTime + 0.1, i = 0;
    const timer = setInterval(() => {
      if (!ctx || ctx.state !== 'running') return;
      while (next < ctx.currentTime + 0.25) {
        const d = next - ctx.currentTime;
        const L = pat.lead[i % 32], B = pat.bass[i % 32];
        if (L != null) tone(pat.root * 2 * Math.pow(2, L / 12), step * 0.9, 'square', 0.05, null, d, musicBus);
        if (B != null) tone(pat.root / 2 * Math.pow(2, B / 12), step * 1.8, 'triangle', 0.12, null, d, musicBus);
        if (i % 4 === 0 || (intense && i % 2 === 0)) { // kick-ish
          tone(90, 0.12, 'sine', 0.12, 40, d, musicBus);
        }
        next += step; i++;
      }
    }, 80);
    music = { timer };
  },
  stopMusic() { if (music) { clearInterval(music.timer); music = null; } },
};

try { Settings?.onChange?.(() => apply()); } catch {}
const unlockOnce = () => Audio.unlock();
window.addEventListener('pointerdown', unlockOnce);
window.addEventListener('keydown', unlockOnce);

export default Audio;
