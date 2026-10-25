// Burrow Brawl — title card visuals: carved-slab logo, intro splash, area/boss banners.
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
// deterministic RNG so the logo looks identical every time
function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

// Rough polygon path (jittered points along a closed outline)
function roughPoly(pts, r, j = 3) {
  return 'M' + pts.map(([x, y]) => `${(x + (r() - 0.5) * j).toFixed(1)},${(y + (r() - 0.5) * j).toFixed(1)}`).join(' L') + 'Z';
}

let logoId = 0;
export function createLogo() {
  const id = 'bbl' + (logoId++);
  const r = rng(4242);
  const W = 640, H = 360;
  const svg = svgEl('svg', { viewBox: `0 0 ${W} ${H}`, class: 'bb-logo', role: 'img', 'aria-label': 'Burrow Brawl' });
  const defs = svgEl('defs', {}, svg);
  defs.innerHTML = `
    <linearGradient id="${id}-slab" x1="0" y1="0" x2="0.25" y2="1">
      <stop offset="0" stop-color="#8f8273"/><stop offset="0.55" stop-color="#6b5f52"/><stop offset="1" stop-color="#3f362d"/>
    </linearGradient>
    <linearGradient id="${id}-dirt" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#6e4a2a"/><stop offset="1" stop-color="#2e1d10"/>
    </linearGradient>
    <linearGradient id="${id}-amber" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#ffe27a"/><stop offset="0.5" stop-color="#ffa21a"/><stop offset="1" stop-color="#c2560a"/>
    </linearGradient>
    <linearGradient id="${id}-iron" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#d8d4cc"/><stop offset="0.5" stop-color="#8d8a84"/><stop offset="1" stop-color="#4a4743"/>
    </linearGradient>
    <filter id="${id}-grain" x="-5%" y="-5%" width="110%" height="110%">
      <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="3" seed="9" result="n"/>
      <feColorMatrix in="n" type="matrix" values="0 0 0 0 0.12  0 0 0 0 0.09  0 0 0 0 0.06  0 0 0 0.9 -0.15" result="g"/>
      <feComposite in="g" in2="SourceGraphic" operator="in" result="gi"/>
      <feMerge><feMergeNode in="SourceGraphic"/><feMergeNode in="gi"/></feMerge>
    </filter>
    <filter id="${id}-shadow" x="-20%" y="-20%" width="140%" height="160%">
      <feDropShadow dx="3" dy="6" stdDeviation="3" flood-color="#000" flood-opacity="0.7"/>
    </filter>`;

  // --- dirt mound behind/below slab
  const mound = svgEl('g', { filter: `url(#${id}-shadow)` }, svg);
  svgEl('path', { d: 'M20,330 C70,272 150,262 230,270 C300,250 380,256 440,268 C520,262 590,286 622,330 Z', fill: `url(#${id}-dirt)`, stroke: '#1a110a', 'stroke-width': 4, 'stroke-linejoin': 'round', filter: `url(#${id}-grain)` }, mound);

  // --- emblem behind slab top: crossed shovel + mole claw
  const em = svgEl('g', { transform: 'translate(320 66)', filter: `url(#${id}-shadow)` }, svg);
  const shovel = svgEl('g', { transform: 'rotate(142) translate(0 -20)' }, em);
  svgEl('rect', { x: -6, y: -78, width: 12, height: 120, rx: 4, fill: '#8a5a2b', stroke: '#1a110a', 'stroke-width': 3 }, shovel);
  svgEl('path', { d: 'M-16,-92 L16,-92 L16,-82 L-16,-82 Z M-9,-92 L-9,-104 L9,-104 L9,-92', fill: '#6b4420', stroke: '#1a110a', 'stroke-width': 3, 'stroke-linejoin': 'round' }, shovel);
  svgEl('path', { d: 'M-22,40 L22,40 L24,70 Q0,100 -24,70 Z', fill: `url(#${id}-iron)`, stroke: '#1a110a', 'stroke-width': 3, 'stroke-linejoin': 'round' }, shovel);
  const claw = svgEl('g', { transform: 'rotate(38)' }, em);
  svgEl('rect', { x: -7, y: -40, width: 14, height: 84, rx: 5, fill: '#5a3a1e', stroke: '#1a110a', 'stroke-width': 3 }, claw);
  svgEl('path', { d: 'M-24,-40 Q-26,-62 0,-66 Q26,-62 24,-40 Z', fill: '#6d6258', stroke: '#1a110a', 'stroke-width': 3 }, claw);
  [-16, -5, 6, 17].forEach((x, i) => svgEl('path', { d: `M${x - 5},-60 Q${x - 2},-96 ${x + 4 + i},-104 Q${x + 4},-84 ${x + 5},-60 Z`, fill: `url(#${id}-amber)`, stroke: '#1a110a', 'stroke-width': 2.5, 'stroke-linejoin': 'round' }, claw));

  // --- stone slab
  const slab = svgEl('g', { filter: `url(#${id}-shadow)` }, svg);
  const outline = [[70, 112], [150, 96], [250, 104], [330, 92], [430, 100], [520, 94], [578, 114], [588, 180], [574, 252], [590, 296], [480, 304], [330, 298], [190, 306], [60, 298], [52, 240], [64, 176]];
  const sd = roughPoly(outline, r, 4);
  svgEl('path', { d: sd, fill: '#1a110a', transform: 'translate(0 6)' }, slab);
  svgEl('path', { d: sd, fill: `url(#${id}-slab)`, stroke: '#1a110a', 'stroke-width': 4, 'stroke-linejoin': 'round', filter: `url(#${id}-grain)` }, slab);
  // bevel highlight along top edge
  svgEl('path', { d: 'M76,118 L150,103 L250,111 L330,99 L430,107 L520,101 L570,118', fill: 'none', stroke: '#c9bba8', 'stroke-width': 3, opacity: 0.6, 'stroke-linecap': 'round' }, slab);
  // cracks
  for (const c of ['M578,140 L556,150 L548,172 L530,180', 'M60,250 L84,244 L92,262 L112,266', 'M330,94 L324,112 L334,124', 'M470,302 L462,284 L470,272']) {
    svgEl('path', { d: c, fill: 'none', stroke: '#241a12', 'stroke-width': 2.5, 'stroke-linejoin': 'round' }, slab);
  }
  // carved words: dark recess + lower-edge light + face
  const carve = (txt, y, size, fill, spacing) => {
    const g = svgEl('g', {}, svg);
    const attrs = { x: 320, y, 'text-anchor': 'middle', class: 'bb-logo-letter', 'font-size': size, 'letter-spacing': spacing };
    svgEl('text', { ...attrs, y: y + 3, fill: '#e6d6bd', opacity: 0.55 }, g).textContent = txt;
    svgEl('text', { ...attrs, y: y - 2, fill: '#120c07' }, g).textContent = txt;
    svgEl('text', { ...attrs, fill, stroke: '#120c07', 'stroke-width': 2, 'paint-order': 'stroke' }, g).textContent = txt;
  };
  carve('BURROW', 192, 78, '#3a2f25', 6);
  // divider rune line
  svgEl('path', { d: 'M150,216 L290,216 M350,216 L490,216', stroke: '#2a2018', 'stroke-width': 3, 'stroke-linecap': 'round' }, svg);
  svgEl('path', { d: 'M320,206 L330,216 L320,226 L310,216 Z', fill: `url(#${id}-amber)`, stroke: '#1a110a', 'stroke-width': 2 }, svg);
  carve('BRAWL', 280, 64, `url(#${id}-amber)`, 10);

  // --- dirt spill over slab bottom + pebbles + roots
  const front = svgEl('g', {}, svg);
  svgEl('path', { d: 'M24,334 C60,300 110,286 170,296 C210,286 250,300 280,312 C360,300 440,292 500,304 C560,296 604,312 618,334 Z', fill: `url(#${id}-dirt)`, stroke: '#1a110a', 'stroke-width': 4, 'stroke-linejoin': 'round', filter: `url(#${id}-grain)` }, front);
  for (let i = 0; i < 16; i++) {
    const x = 50 + r() * 540, y = 306 + r() * 20, rr = 4 + r() * 7;
    svgEl('ellipse', { cx: x, cy: y, rx: rr * 1.3, ry: rr, fill: ['#9a8b78', '#7a6c5c', '#b3a38c'][i % 3], stroke: '#1a110a', 'stroke-width': 2 }, front);
  }
  for (const d of ['M96,300 C90,270 70,262 66,236', 'M548,302 C560,276 580,272 584,250 C586,236 596,230 600,222', 'M210,304 C214,290 206,282 210,272']) {
    svgEl('path', { d, fill: 'none', stroke: '#4a2f17', 'stroke-width': 4, 'stroke-linecap': 'round' }, front);
  }
  const wrap = document.createElement('div');
  wrap.className = 'bb-logo-wrap';
  wrap.appendChild(svg);
  return wrap;
}

// ---------- Intro splash ----------
export function showSplash() {
  if (document.querySelector('.bb-splash')) return;
  const red = reduced();
  const s = document.createElement('div');
  s.className = 'bb-splash' + (red ? ' bb-reduced' : '');
  const r = rng(99);
  // underground cross-section: tunnels, gems, worms
  let deco = '';
  for (const d of ['M-20,720 C180,660 300,780 520,700 S880,640 1300,720', 'M-20,880 C200,840 380,940 700,880 S1100,820 1300,900', 'M900,560 C980,600 1100,560 1300,600']) {
    deco += `<path d="${d}" fill="none" stroke="#0d0805" stroke-width="54" stroke-linecap="round" opacity=".75"/><path d="${d}" fill="none" stroke="#000" stroke-width="40" stroke-linecap="round" opacity=".55"/>`;
  }
  const gc = ['#ffb43a', '#6fe3ff', '#ff6a4a', '#b7ff6a'];
  for (let i = 0; i < 14; i++) {
    const x = r() * 1280, y = 420 + r() * 560, c = gc[i % 4], k = 5 + r() * 6;
    deco += `<g class="bb-gem" style="animation-delay:${(r() * 4).toFixed(2)}s"><circle cx="${x.toFixed(0)}" cy="${y.toFixed(0)}" r="${k * 3}" fill="${c}" opacity=".18"/><path d="M${x},${y - k} L${x + k * .8},${y} L${x},${y + k} L${x - k * .8},${y}Z" fill="${c}" stroke="#000" stroke-width="2"/></g>`;
  }
  for (let i = 0; i < 4; i++) {
    const x = 100 + r() * 1080, y = 500 + r() * 400;
    deco += `<path d="M${x},${y} q14,-12 28,0 t28,0 t28,0" fill="none" stroke="#c97a6a" stroke-width="7" stroke-linecap="round" opacity=".7"/>`;
  }
  s.innerHTML = `<div class="bb-strata"></div>
    <svg class="bb-under" viewBox="0 0 1280 1000" preserveAspectRatio="xMidYMid slice" aria-hidden="true">${deco}</svg>
    <div class="bb-motes" aria-hidden="true"></div>
    <svg class="bb-noise" aria-hidden="true"><filter id="bb-splash-noise"><feTurbulence type="fractalNoise" baseFrequency="0.75" numOctaves="3" stitchTiles="stitch"/><feColorMatrix type="saturate" values="0"/></filter><rect width="100%" height="100%" filter="url(#bb-splash-noise)"/></svg>
    <div class="bb-vignette"></div>`;
  const motes = s.querySelector('.bb-motes');
  if (!red) for (let i = 0; i < 28; i++) {
    const m = document.createElement('i');
    m.style.cssText = `left:${(r() * 100).toFixed(1)}%;top:${(r() * 100).toFixed(1)}%;animation-duration:${(8 + r() * 10).toFixed(1)}s;animation-delay:${(-r() * 18).toFixed(1)}s;--s:${(1 + r() * 2.5).toFixed(1)}px`;
    motes.appendChild(m);
  }
  const logo = createLogo(); logo.classList.add('bb-splash-logo');
  s.appendChild(logo);
  const c = document.createElement('div'); c.className = 'bb-continue bb-title-font'; c.textContent = 'Press any key to dig in';
  s.appendChild(c);
  document.body.appendChild(s);
  const under = s.querySelector('.bb-under');
  const onMove = (e) => {
    const dx = e.clientX / innerWidth - 0.5, dy = e.clientY / innerHeight - 0.5;
    under.style.transform = `translate(${(-dx * 18).toFixed(1)}px, ${(-dy * 12).toFixed(1)}px)`;
    logo.style.translate = `${(dx * 8).toFixed(1)}px ${(dy * 6).toFixed(1)}px`;
  };
  if (!red) s.addEventListener('mousemove', onMove);
  let done = false;
  const go = () => {
    if (done) return; done = true;
    removeEventListener('keydown', go, true);
    s.classList.add('bb-out');
    setTimeout(() => s.remove(), reduced() ? 0 : 700);
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
