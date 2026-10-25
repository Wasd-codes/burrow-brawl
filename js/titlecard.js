// Burrow Brawl — title card visuals: minimal wordmark logo, intro splash, area/boss banners.
import { Settings } from './settings.js';
import { STAGES, BOSSES } from './data.js';

const NS = 'http://www.w3.org/2000/svg';
const reduced = () => { try { return !!Settings?.get?.('reducedMotion'); } catch { return false; } };
const svgEl = (tag, attrs = {}, parent) => {
  const n = document.createElementNS(NS, tag);
  for (const k in attrs) n.setAttribute(k, attrs[k]);
  if (parent) parent.appendChild(n);
  return n;
};
let logoId = 0;
// Minimal wordmark: two words, a thin rule and three claw marks as the only accent.
export function createLogo() {
  const id = 'bbl' + (logoId++);
  const W = 640, H = 250;
  const svg = svgEl('svg', { viewBox: `0 0 ${W} ${H}`, class: 'bb-logo', role: 'img', 'aria-label': 'Burrow Brawl' });
  svgEl('defs', {}, svg).innerHTML = `
    <linearGradient id="${id}-amber" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#ffd166"/><stop offset="1" stop-color="#f08a1c"/>
    </linearGradient>`;
  const word = (txt, y, size, fill, spacing) => {
    const t = svgEl('text', { x: W / 2, y, 'text-anchor': 'middle', class: 'bb-logo-letter', 'font-size': size, 'letter-spacing': spacing, fill }, svg);
    t.textContent = txt;
  };
  word('BURROW', 104, 84, '#ece4d6', 8);
  // rule with claw marks in the middle
  svgEl('path', { d: 'M150,140 L282,140 M358,140 L490,140', stroke: '#6b5d4c', 'stroke-width': 2, 'stroke-linecap': 'round' }, svg);
  [-14, 0, 14].forEach((dx) => svgEl('path', { d: `M${312 + dx},124 L${326 + dx},156`, stroke: `url(#${id}-amber)`, 'stroke-width': 5, 'stroke-linecap': 'round' }, svg));
  word('BRAWL', 222, 70, `url(#${id}-amber)`, 18);
  const wrap = document.createElement('div');
  wrap.className = 'bb-logo-wrap';
  wrap.appendChild(svg);
  return wrap;
}

// ---------- Intro splash ----------
export function showSplash() {
  if (document.querySelector('.bb-splash')) return;
  const s = document.createElement('div');
  s.className = 'bb-splash' + (reduced() ? ' bb-reduced' : '');
  const logo = createLogo(); logo.classList.add('bb-splash-logo');
  s.appendChild(logo);
  const c = document.createElement('div'); c.className = 'bb-continue bb-title-font'; c.textContent = 'Press any key';
  s.appendChild(c);
  document.body.appendChild(s);
  let done = false;
  const go = () => {
    if (done) return; done = true;
    removeEventListener('keydown', go, true);
    s.classList.add('bb-out');
    setTimeout(() => s.remove(), reduced() ? 0 : 600);
  };
  s.addEventListener('click', go);
  addEventListener('keydown', go, true);
}

// ---------- Menu logo injection ----------
function injectLogo(root) {
  const slot = root.querySelector('#game-logo');
  if (slot) { if (!slot.querySelector('.bb-logo-wrap')) { slot.querySelectorAll('.logo').forEach((n) => n.classList.add('bb-hidden')); slot.appendChild(createLogo()); } return; }
  const menu = root.querySelector('.main-menu');
  if (menu && !menu.querySelector('.bb-logo-wrap')) {
    menu.querySelector('.logo')?.classList.add('bb-hidden');
    menu.prepend(createLogo());
  }
}
function watchMenu() {
  const root = document.getElementById('ui');
  if (!root) return;
  injectLogo(root);
  new MutationObserver(() => injectLogo(root)).observe(root, { childList: true, subtree: true });
}

// ---------- Area / boss banner ----------
export const STAGE_SUBTITLES = {
  clover_meadow: 'Where the brawl begins',
  sunscorch_dunes: 'Where the sands bite back',
  rimefang_caverns: 'Where the cold never sleeps',
  cinderforge_rift: 'Where the earth bleeds fire',
  void_citadel: 'Where it all ends',
};
let bannerEl = null, bannerTimer = 0;
export function showAreaBanner(title, subtitle = '', opts = {}) {
  bannerEl?.remove(); clearTimeout(bannerTimer);
  const b = document.createElement('div');
  b.className = 'bb-banner bb-title-font' + (opts.boss ? ' bb-boss' : '') + (reduced() ? ' bb-reduced' : '');
  const t = document.createElement('div'); t.className = 'bb-banner-title'; t.textContent = title;
  if (title.length > 14) t.style.fontSize = `clamp(20px, ${Math.max(2.6, 84 / title.length).toFixed(2)}vw, 64px)`;
  b.appendChild(t);
  if (subtitle) { const st = document.createElement('div'); st.className = 'bb-banner-sub'; st.textContent = subtitle; b.appendChild(st); }
  document.body.appendChild(b);
  bannerEl = b;
  const hold = opts.hold ?? 3000;
  requestAnimationFrame(() => b.classList.add('bb-in'));
  bannerTimer = setTimeout(() => { b.classList.remove('bb-in'); bannerTimer = setTimeout(() => { b.remove(); if (bannerEl === b) bannerEl = null; }, 900); }, hold + 700);
  return b;
}
export function showStageBanner(stageIndex) {
  const st = STAGES?.[stageIndex]; if (!st) return;
  showAreaBanner(st.name, STAGE_SUBTITLES[st.id] || st.desc || '');
}
export function showBossBanner(bossId) {
  const b = BOSSES?.[bossId]; if (!b) return;
  showAreaBanner(b.name, b.title || '', { boss: true });
}

// auto-init
if (typeof document !== 'undefined') {
  const init = () => { watchMenu(); if (!/[?&]nosplash/.test(location.search)) showSplash(); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
}
