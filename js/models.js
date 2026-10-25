import * as THREE from 'three';

// ---------- shared caches ----------
const G = new Map();
const M = new Map();
function geo(key, make) { let g = G.get(key); if (!g) { g = make(); G.set(key, g); } return g; }
const box = (w, h, d) => geo(`b${w},${h},${d}`, () => new THREE.BoxGeometry(w, h, d));
const cone = (r, h, s = 6) => geo(`c${r},${h},${s}`, () => new THREE.ConeGeometry(r, h, s));
const cyl = (rt, rb, h, s = 6) => geo(`y${rt},${rb},${h},${s}`, () => new THREE.CylinderGeometry(rt, rb, h, s));
const ico = (r, d = 0) => geo(`i${r},${d}`, () => new THREE.IcosahedronGeometry(r, d));
const dode = (r) => geo(`d${r}`, () => new THREE.DodecahedronGeometry(r, 0));
const tet = (r) => geo(`t${r}`, () => new THREE.TetrahedronGeometry(r, 0));
const oct = (r) => geo(`o${r}`, () => new THREE.OctahedronGeometry(r, 0));
const torus = (r, t) => geo(`r${r},${t}`, () => new THREE.TorusGeometry(r, t, 4, 10));

function mat(color, emissive = 0, opts = {}) {
  const c = new THREE.Color(color).getHex();
  const e = emissive ? new THREE.Color(emissive).getHex() : 0;
  const key = `${c}|${e}|${opts.opacity ?? 1}`;
  let m = M.get(key);
  if (!m) {
    m = new THREE.MeshLambertMaterial({ color: c, flatShading: true, emissive: e });
    if (opts.opacity != null && opts.opacity < 1) { m.transparent = true; m.opacity = opts.opacity; m.depthWrite = false; }
    M.set(key, m);
  }
  return m;
}
const glow = (c) => mat(c, c);

function mesh(g, m, x = 0, y = 0, z = 0, parent) {
  const o = new THREE.Mesh(g, m);
  o.position.set(x, y, z);
  o.castShadow = true;
  if (parent) parent.add(o);
  return o;
}
function pivot(parent, x, y, z) { const p = new THREE.Group(); p.position.set(x, y, z); parent.add(p); return p; }
function shade(color, f) { const c = new THREE.Color(color); return f > 0 ? c.lerp(new THREE.Color(0xffffff), f) : c.multiplyScalar(1 + f); }

function eyes(g, y, z, sep = 0.12, r = 0.06, color = 0x111111, white = true) {
  for (const s of [-1, 1]) {
    if (white) mesh(ico(r * 1.5), mat(0xffffff), s * sep, y, z - 0.01, g);
    mesh(ico(r), mat(color), s * sep, y, z + r * 0.6, g);
  }
}
function legs(g, color, sep = 0.15, len = 0.35, w = 0.14, y = 0.35) {
  const out = [];
  for (const s of [-1, 1]) {
    const p = pivot(g, s * sep, y, 0);
    mesh(box(w, len, w), mat(color), 0, -len / 2, 0, p);
    out.push(p);
  }
  return out;
}
function arms(g, color, sep, y, len = 0.35, w = 0.1) {
  const out = [];
  for (const s of [-1, 1]) {
    const p = pivot(g, s * sep, y, 0);
    mesh(box(w, len, w), mat(color), 0, -len / 2, 0, p);
    out.push(p);
  }
  return out;
}

// ---------- characters ----------
const CHAR = {
  ninja_mole(g) {
    const gi = 0x2a2a3a, fur = 0x5a4632;
    const L = legs(g, gi, 0.14, 0.35, 0.15);
    mesh(ico(0.38), mat(gi), 0, 0.68, 0, g).scale.set(1, 1.1, 0.9);
    mesh(box(0.62, 0.08, 0.5), mat(0xb02020), 0, 0.6, 0, g); // belt
    const head = mesh(ico(0.3), mat(fur), 0, 1.15, 0.03, g);
    mesh(cone(0.12, 0.25, 5), mat(fur), 0, 1.1, 0.33, g).rotation.x = Math.PI / 2;
    mesh(ico(0.07), mat(0xff8aa8), 0, 1.1, 0.47, g); // pink nose
    mesh(box(0.64, 0.09, 0.62), mat(0xc02828), 0, 1.24, 0, g); // headband
    for (const s of [-1, 1]) { const t = mesh(box(0.06, 0.04, 0.4), mat(0xc02828), s * 0.06, 1.2, -0.45, g); t.rotation.set(0.5, s * 0.25, 0); }
    eyes(g, 1.2, 0.27, 0.11, 0.035, 0x000000, false);
    const A = arms(g, gi, 0.38, 0.88, 0.3, 0.12);
    for (const a of A) for (const k of [-1, 0, 1]) { const c = mesh(cone(0.025, 0.14, 4), mat(0xeeeeee), k * 0.04, -0.34, 0.03, a); c.rotation.x = Math.PI; }
    void head;
    return { legs: L, arms: A };
  },
  wizard_hamster(g) {
    const fur = 0xe0a060, robe = 0x3b4cc0;
    const L = legs(g, fur, 0.14, 0.2, 0.14, 0.2);
    mesh(ico(0.45), mat(robe), 0, 0.6, 0, g).scale.set(1, 1, 0.95);
    mesh(ico(0.25), mat(0xfff0d8), 0, 0.62, 0.3, g); // belly
    mesh(ico(0.33), mat(fur), 0, 1.12, 0, g);
    for (const s of [-1, 1]) { mesh(ico(0.13), mat(0xf2b880), s * 0.22, 1.05, 0.18, g); mesh(ico(0.08), mat(0xd48850), s * 0.24, 1.38, 0, g); }
    mesh(ico(0.05), mat(0xff8aa8), 0, 1.13, 0.34, g);
    eyes(g, 1.2, 0.27, 0.12, 0.045, 0x000000, false);
    mesh(cyl(0.42, 0.42, 0.05, 8), mat(robe), 0, 1.36, 0, g);
    const hat = mesh(cone(0.28, 0.65, 6), mat(robe), 0, 1.7, -0.05, g); hat.rotation.x = -0.2;
    mesh(oct(0.07), glow(0xffe060), 0.1, 1.65, 0.22, g);
    const A = arms(g, fur, 0.44, 0.8, 0.25, 0.1);
    const staff = pivot(A[1], 0, -0.25, 0.08);
    mesh(cyl(0.03, 0.03, 1.3, 5), mat(0x7a5230), 0, 0.3, 0, staff);
    mesh(oct(0.12), glow(0x60e0ff), 0, 1.02, 0, staff);
    return { legs: L, arms: A };
  },
  antknight(g) {
    const fur = 0x8a7060, steel = 0xa8b0bc;
    const L = legs(g, steel, 0.16, 0.4, 0.16, 0.4);
    mesh(box(0.6, 0.6, 0.45), mat(steel), 0, 0.72, 0, g);
    for (let i = 0; i < 3; i++) mesh(box(0.64, 0.06, 0.5), mat(0x707a88), 0, 0.5 + i * 0.2, 0, g);
    mesh(box(0.42, 0.38, 0.4), mat(steel), 0, 1.22, 0, g); // helmet
    mesh(cone(0.08, 0.3, 4), mat(0xc03030), 0, 1.5, -0.05, g);
    const sn = mesh(cyl(0.05, 0.11, 0.6, 5), mat(fur), 0, 1.15, 0.45, g); sn.rotation.x = Math.PI / 2;
    mesh(box(0.34, 0.05, 0.05), mat(0x111111), 0, 1.26, 0.2, g); // visor slit
    const A = arms(g, steel, 0.4, 0.95, 0.35, 0.13);
    const sh = mesh(box(0.08, 0.5, 0.4), mat(0x2850a0), -0.06, -0.3, 0.12, A[0]);
    mesh(box(0.1, 0.12, 0.12), mat(0xffd040), -0.03, 0, 0, sh);
    const sw = pivot(A[1], 0, -0.35, 0.05); sw.rotation.x = Math.PI / 2;
    mesh(box(0.06, 0.9, 0.12), mat(0xe0e6ee), 0, 0.5, 0, sw);
    mesh(box(0.28, 0.05, 0.05), mat(0xffd040), 0, 0.05, 0, sw);
    return { legs: L, arms: A };
  },
  frog_monk(g) {
    const skin = 0x5cbf4a, robe = 0xe08a20;
    const L = legs(g, skin, 0.18, 0.25, 0.18, 0.25);
    mesh(ico(0.42), mat(robe), 0, 0.6, 0, g).scale.set(1.1, 0.9, 1);
    mesh(box(0.15, 0.7, 0.05), mat(0x8a3010), 0.1, 0.65, 0.4, g).rotation.z = 0.5;
    mesh(ico(0.34), mat(skin), 0, 1.05, 0.02, g).scale.set(1.2, 0.8, 1);
    for (const s of [-1, 1]) { mesh(ico(0.11), mat(skin), s * 0.2, 1.27, 0.1, g); mesh(ico(0.06), mat(0x111111), s * 0.2, 1.3, 0.18, g); }
    mesh(box(0.35, 0.03, 0.05), mat(0x2a6a20), 0, 0.98, 0.33, g);
    for (let i = 0; i < 7; i++) { const a = (i / 7) * Math.PI * 2; mesh(ico(0.05), mat(0x6a3a1a), Math.sin(a) * 0.3, 0.85 + Math.cos(a) * 0.05, Math.cos(a) * 0.3 + 0.05, g); }
    const A = arms(g, skin, 0.45, 0.8, 0.3, 0.1);
    return { legs: L, arms: A };
  },
  robo_turtle(g) {
    const metal = 0x7f8c99, skin = 0x58a878;
    const L = legs(g, skin, 0.22, 0.25, 0.18, 0.25);
    const shell = mesh(dode(0.48), mat(metal), 0, 0.65, -0.05, g); shell.scale.set(1, 0.75, 1);
    mesh(box(0.5, 0.5, 0.1), mat(0xc8c0a0), 0, 0.65, 0.33, g);
    mesh(box(0.15, 0.15, 0.05), glow(0x40ff80), 0, 0.7, 0.39, g);
    mesh(ico(0.24), mat(skin), 0, 1.05, 0.25, g);
    mesh(box(0.38, 0.1, 0.1), glow(0xff3030), 0, 1.1, 0.42, g); // visor
    mesh(cyl(0.015, 0.015, 0.3, 4), mat(0x333333), 0.1, 1.38, 0.2, g);
    mesh(ico(0.04), glow(0xff3030), 0.1, 1.54, 0.2, g);
    const A = arms(g, skin, 0.45, 0.8, 0.3, 0.12);
    for (const a of A) mesh(cyl(0.08, 0.1, 0.12, 6), mat(0x555f6a), 0, -0.32, 0, a);
    return { legs: L, arms: A };
  },
  fox_ranger(g) {
    const fur = 0xe86a20, cloak = 0x2f6a30;
    const L = legs(g, 0x3a2a1a, 0.13, 0.4, 0.13, 0.4);
    mesh(box(0.45, 0.5, 0.32), mat(cloak), 0, 0.68, 0, g);
    mesh(box(0.3, 0.3, 0.05), mat(0xfff0e0), 0, 0.72, 0.17, g);
    mesh(cone(0.28, 0.25, 4), mat(cloak), 0, 0.98, -0.05, g).rotation.y = Math.PI / 4;
    mesh(ico(0.24), mat(fur), 0, 1.15, 0, g);
    const sn = mesh(cone(0.11, 0.25, 4), mat(0xfff0e0), 0, 1.1, 0.28, g); sn.rotation.x = Math.PI / 2;
    mesh(ico(0.04), mat(0x111111), 0, 1.1, 0.41, g);
    for (const s of [-1, 1]) mesh(cone(0.08, 0.22, 4), mat(fur), s * 0.13, 1.4, 0, g);
    eyes(g, 1.2, 0.2, 0.09, 0.03, 0x224400, false);
    const tail = mesh(cone(0.14, 0.55, 5), mat(fur), 0, 0.55, -0.35, g); tail.rotation.x = -2.1;
    mesh(cone(0.07, 0.15, 5), mat(0xffffff), 0, 0.42, -0.6, g).rotation.x = -2.1;
    const A = arms(g, cloak, 0.3, 0.88, 0.32, 0.1);
    const bow = pivot(A[0], 0, -0.3, 0.1);
    mesh(torus(0.35, 0.025), mat(0x7a4a20), 0, 0, 0, bow).scale.set(0.4, 1, 1);
    bow.rotation.y = Math.PI / 2;
    mesh(box(0.15, 0.4, 0.12), mat(0x6a4020), 0.12, 0.85, -0.22, g); // quiver
    return { legs: L, arms: A };
  },
  bee_witch(g) {
    const y = 0xf0c020, k = 0x222222;
    const L = legs(g, k, 0.1, 0.3, 0.08, 0.3);
    for (let i = 0; i < 3; i++) mesh(cyl(0.3 - i * 0.03, 0.3 - i * 0.03, 0.15, 8), mat(i % 2 ? k : y), 0, 0.42 + i * 0.15, 0, g);
    mesh(cone(0.2, 0.3, 6), mat(k), 0, 0.3, -0.15, g).rotation.x = Math.PI * 0.75;
    mesh(ico(0.26), mat(y), 0, 1.07, 0, g);
    eyes(g, 1.1, 0.2, 0.1, 0.06, 0x000000, false);
    mesh(cyl(0.38, 0.38, 0.04, 8), mat(0x402060), 0, 1.25, 0, g);
    const hat = mesh(cone(0.2, 0.55, 6), mat(0x402060), 0, 1.52, -0.05, g); hat.rotation.x = -0.35;
    for (const s of [-1, 1]) { const w = mesh(box(0.04, 0.4, 0.25), mat(0xddeeff, 0, { opacity: 0.6 }), s * 0.3, 0.9, -0.25, g); w.rotation.z = s * 0.6; }
    const A = arms(g, k, 0.33, 0.78, 0.28, 0.07);
    const br = pivot(A[1], 0, -0.28, 0.05); br.rotation.x = 1.2;
    mesh(cyl(0.02, 0.02, 0.8, 4), mat(0x7a5230), 0, 0.2, 0, br);
    mesh(cone(0.1, 0.25, 6), mat(0xd0a050), 0, -0.25, 0, br);
    return { legs: L, arms: A };
  },
  axolotl_bard(g) {
    const pink = 0xf6a0c8, vest = 0x6a2a8a;
    const L = legs(g, pink, 0.15, 0.25, 0.14, 0.25);
    mesh(ico(0.36), mat(vest), 0, 0.6, 0, g).scale.set(1, 1.1, 0.9);
    mesh(box(0.42, 0.3, 0.42), mat(pink), 0, 1.07, 0.02, g);
    for (const s of [-1, 1]) for (let i = 0; i < 3; i++) { const f = mesh(cone(0.05, 0.25, 4), mat(0xe04080), s * 0.26, 1.0 + i * 0.1, -0.05, g); f.rotation.z = -s * (1.1 - i * 0.3); }
    eyes(g, 1.12, 0.22, 0.13, 0.04, 0x111111, false);
    mesh(box(0.15, 0.02, 0.02), mat(0x803050), 0, 1.0, 0.23, g);
    const tail = mesh(cone(0.14, 0.5, 4), mat(pink), 0, 0.4, -0.35, g); tail.rotation.x = -1.9;
    mesh(cyl(0.3, 0.3, 0.04, 8), mat(0x302018), 0, 1.24, 0, g);
    mesh(cyl(0.18, 0.2, 0.18, 8), mat(0x302018), 0, 1.33, 0, g);
    const A = arms(g, pink, 0.38, 0.78, 0.25, 0.09);
    const lute = pivot(g, 0.05, 0.62, 0.35); lute.rotation.z = 0.7;
    mesh(ico(0.16), mat(0xa06a30), 0, 0, 0, lute).scale.set(1, 1.2, 0.5);
    mesh(box(0.06, 0.4, 0.04), mat(0x5a3a1a), 0, 0.3, 0, lute);
    return { legs: L, arms: A };
  },
  pigeon_pirate(g) {
    const grey = 0x8a92a0;
    const L = legs(g, 0xe07040, 0.1, 0.3, 0.05, 0.3);
    mesh(ico(0.38), mat(grey), 0, 0.68, 0, g).scale.set(1, 1.1, 1.15);
    mesh(ico(0.22), mat(0x6aa88a), 0, 0.85, 0.2, g); // iridescent neck
    mesh(ico(0.24), mat(grey), 0, 1.13, 0.12, g);
    const bk = mesh(cone(0.06, 0.18, 4), mat(0x333333), 0, 1.1, 0.4, g); bk.rotation.x = Math.PI / 2;
    mesh(ico(0.04), mat(0xff6020), 0.1, 1.18, 0.3, g);
    mesh(box(0.1, 0.1, 0.03), mat(0x111111), -0.1, 1.18, 0.33, g); // eyepatch
    mesh(box(0.5, 0.15, 0.32), mat(0x1a1a1a), 0, 1.38, 0.12, g); // tricorn
    mesh(box(0.1, 0.06, 0.02), mat(0xffffff), 0, 1.4, 0.29, g);
    mesh(cone(0.2, 0.3, 4), mat(0x5a606a), 0, 0.45, -0.4, g).rotation.x = -1.6;
    const A = arms(g, grey, 0.4, 0.85, 0.32, 0.12);
    const sw = pivot(A[1], 0, -0.3, 0.05); sw.rotation.x = Math.PI / 2;
    mesh(box(0.04, 0.6, 0.1), mat(0xdde0e6), 0, 0.35, 0, sw);
    mesh(torus(0.07, 0.02), mat(0xffd040), 0, 0.03, 0, sw);
    return { legs: L, arms: A };
  },
  nacho(g) {
    const chip = 0xf2b632, edge = 0xc98a1c, blk = 0x111111, wht = 0xf8f8f8;
    // legs: thin black sticks + chunky sneakers
    const L = [];
    for (const s of [-1, 1]) {
      const p = pivot(g, s * 0.17, 0.62, 0);
      mesh(cyl(0.025, 0.025, 0.5, 5), mat(blk), 0, -0.27, 0, p);
      mesh(box(0.2, 0.12, 0.32), mat(wht), 0, -0.55, 0.05, p);
      mesh(box(0.21, 0.05, 0.33), mat(0xd02828), 0, -0.6, 0.05, p);
      mesh(box(0.16, 0.04, 0.08), mat(0xd02828), 0, -0.48, 0.12, p);
      L.push(p);
    }
    // chip body: triangular prism, point up
    const body = pivot(g, 0, 1.05, 0);
    const rim = mesh(cyl(0.68, 0.68, 0.16, 3), mat(edge), 0, 0, 0, body); rim.rotation.x = -Math.PI / 2;
    const face = mesh(cyl(0.62, 0.62, 0.24, 3), mat(chip), 0, 0, 0, body); face.rotation.x = -Math.PI / 2;
    const spots = [[-0.18, -0.12], [0.2, -0.18], [0.02, 0.28], [-0.3, -0.24], [0.33, -0.02]];
    for (const [x, y] of spots) { const d = mesh(ico(0.04), mat(0xd9771a), x, y, 0.125, body); d.scale.z = 0.3; }
    for (const z of [0.125, -0.125]) for (const [x, y] of [[0.1, -0.05], [-0.08, 0.12]]) { const d = mesh(ico(0.025), mat(0xa85a14), x, y, z, body); d.scale.z = 0.3; }
    // cheese drips on the lower edge
    for (const [x, h] of [[-0.22, 0.1], [0.12, 0.15]]) {
      mesh(box(0.1, 0.05, 0.27), mat(0xffd23a), x, -0.3, 0, body);
      mesh(box(0.06, h, 0.04), mat(0xffd23a), x, -0.3 - h / 2, 0.12, body);
      mesh(ico(0.04), mat(0xffd23a), x, -0.3 - h, 0.12, body);
    }
    // sunglasses
    const sh = pivot(body, 0, 0.02, 0.13); sh.scale.setScalar(1.3);
    for (const s of [-1, 1]) {
      const lens = mesh(cyl(0.13, 0.13, 0.04, 3), mat(0x0a0a10), s * 0.14, 0, 0.01, sh);
      lens.rotation.x = Math.PI / 2; lens.rotation.y = s * 0.25; lens.scale.set(1.15, 1, 0.75);
      const hl = mesh(box(0.11, 0.022, 0.01), mat(0xbfd8ff, 0x405070), s * 0.14 - 0.02, 0.025, 0.04, sh); hl.rotation.z = 0.5;
      const arm = mesh(box(0.02, 0.025, 0.2), mat(blk), s * 0.29, 0.03, -0.09, sh); void arm;
    }
    mesh(box(0.3, 0.035, 0.04), mat(blk), 0, 0.04, 0.01, sh);
    // stick arms + big cartoon gloves
    const A = [];
    for (const s of [-1, 1]) {
      const p = pivot(g, s * 0.42, 1.02, 0); p.rotation.z = s * 0.35;
      mesh(cyl(0.022, 0.022, 0.45, 5), mat(blk), 0, -0.22, 0, p);
      const hand = pivot(p, 0, -0.5, 0);
      mesh(cyl(0.07, 0.09, 0.07, 6), mat(wht), 0, 0.06, 0, hand);
      const palm = mesh(ico(0.12, 1), mat(wht), 0, -0.05, 0, hand); palm.scale.set(1.1, 1, 0.75);
      for (let i = 0; i < 3; i++) { const f = mesh(cyl(0.035, 0.035, 0.1, 5), mat(wht), (i - 1) * 0.06, -0.15, 0.02, hand); void f; }
      const th = mesh(cyl(0.035, 0.035, 0.1, 5), mat(wht), -s * 0.12, -0.02, 0.02, hand); th.rotation.z = s * 1.1;
      A.push(p);
    }
    return { legs: L, arms: A };
  },
};

export function buildCharacter(modelKey) {
  const g = new THREE.Group();
  const fn = CHAR[modelKey] || CHAR[Object.keys(CHAR).find((k) => String(modelKey).includes(k.split('_')[0]))] || CHAR.ninja_mole;
  const inner = new THREE.Group(); g.add(inner);
  const limbs = fn(inner);
  g.userData.inner = inner;
  g.userData.limbs = limbs;
  g.userData.kind = 'character';
  return g;
}

// ---------- enemies ----------
const FAM = {
  slime(g, c) {
    const b = mesh(ico(0.45), mat(c, 0, { opacity: 0.85 }), 0, 0.35, 0, g); b.scale.set(1, 0.75, 1);
    mesh(ico(0.15), mat(shade(c, 0.4)), 0.12, 0.55, 0.15, g);
    eyes(g, 0.45, 0.36, 0.13, 0.05);
    g.userData.squash = true;
  },
  bat(g, c) {
    mesh(ico(0.25), mat(c), 0, 1.0, 0, g);
    for (const s of [-1, 1]) mesh(cone(0.07, 0.18, 4), mat(c), s * 0.12, 1.25, 0, g);
    eyes(g, 1.05, 0.2, 0.08, 0.04, 0xff2020, false);
    const W = [];
    for (const s of [-1, 1]) { const p = pivot(g, s * 0.2, 1.0, 0); const w = mesh(box(0.55, 0.04, 0.3), mat(shade(c, -0.3)), s * 0.28, 0, 0, p); void w; W.push(p); }
    g.userData.wings = W; g.userData.float = true;
    return { arms: [], legs: [] };
  },
  golem(g, c) {
    const L = legs(g, shade(c, -0.2), 0.22, 0.45, 0.25, 0.45);
    mesh(dode(0.5), mat(c), 0, 0.95, 0, g).scale.set(1.1, 1, 0.8);
    mesh(dode(0.24), mat(c), 0, 1.55, 0.05, g);
    mesh(box(0.25, 0.06, 0.05), glow(0xffa020), 0, 1.58, 0.25, g);
    mesh(oct(0.12), glow(0x40e0ff), 0, 1.0, 0.38, g);
    const A = arms(g, shade(c, -0.1), 0.62, 1.25, 0.7, 0.25);
    for (const a of A) mesh(dode(0.18), mat(c), 0, -0.72, 0, a);
    return { legs: L, arms: A };
  },
  skeleton(g, c) {
    const bone = c || 0xe8e4d0;
    const L = legs(g, bone, 0.1, 0.45, 0.06, 0.45);
    mesh(box(0.06, 0.45, 0.06), mat(bone), 0, 0.7, 0, g);
    for (let i = 0; i < 3; i++) mesh(box(0.36 - i * 0.04, 0.04, 0.2), mat(bone), 0, 0.75 + i * 0.1, 0, g);
    mesh(dode(0.2), mat(bone), 0, 1.15, 0, g);
    for (const s of [-1, 1]) mesh(ico(0.05), glow(0xff4020), s * 0.07, 1.17, 0.16, g);
    const A = arms(g, bone, 0.24, 1.0, 0.45, 0.05);
    return { legs: L, arms: A };
  },
  spider(g, c) {
    mesh(ico(0.35), mat(c), 0, 0.45, -0.15, g).scale.set(1, 0.8, 1.2);
    mesh(ico(0.2), mat(shade(c, -0.2)), 0, 0.42, 0.25, g);
    for (let i = 0; i < 4; i++) mesh(ico(0.035), glow(0xff2020), (i - 1.5) * 0.06, 0.5, 0.42, g);
    const Ls = [];
    for (const s of [-1, 1]) for (let i = 0; i < 4; i++) {
      const p = pivot(g, s * 0.18, 0.45, 0.15 - i * 0.12); p.rotation.y = s * (0.3 - i * 0.3);
      const l = mesh(box(0.5, 0.05, 0.05), mat(shade(c, -0.3)), s * 0.25, 0.05, 0, p); l.rotation.z = s * -0.6;
      Ls.push(p);
    }
    return { legs: Ls, arms: [], legAxis: 'y' };
  },
  wisp(g, c) {
    mesh(ico(0.3), glow(c), 0, 1.0, 0, g);
    mesh(cone(0.22, 0.6, 5), mat(c, c, { opacity: 0.5 }), 0, 0.6, 0, g).rotation.x = Math.PI;
    mesh(ico(0.45), mat(c, c, { opacity: 0.25 }), 0, 1.0, 0, g);
    eyes(g, 1.05, 0.26, 0.09, 0.04, 0x000000, false);
    g.userData.float = true;
  },
  crab(g, c) {
    mesh(dode(0.4), mat(c), 0, 0.4, 0, g).scale.set(1.3, 0.55, 1);
    for (const s of [-1, 1]) { mesh(cyl(0.02, 0.02, 0.2, 4), mat(c), s * 0.1, 0.65, 0.2, g); mesh(ico(0.05), mat(0x111111), s * 0.1, 0.77, 0.2, g); }
    const A = [];
    for (const s of [-1, 1]) { const p = pivot(g, s * 0.45, 0.45, 0.25); mesh(box(0.1, 0.1, 0.3), mat(c), 0, 0, 0.1, p); mesh(tet(0.17), mat(shade(c, 0.1)), 0, 0, 0.3, p); A.push(p); }
    const Ls = [];
    for (const s of [-1, 1]) for (let i = 0; i < 3; i++) { const p = pivot(g, s * 0.4, 0.35, -0.1 - i * 0.12); const l = mesh(box(0.3, 0.05, 0.05), mat(shade(c, -0.2)), s * 0.12, -0.1, 0, p); l.rotation.z = s * -0.8; Ls.push(p); }
    return { legs: Ls, arms: A, legAxis: 'y' };
  },
  scorpion(g, c) {
    const r = FAM.crab(g, c);
    let prev = g, y = 0.5, z = -0.4;
    for (let i = 0; i < 4; i++) { mesh(ico(0.1), mat(c), 0, y, z, g); y += 0.18; z -= 0.05 - i * 0.06; }
    mesh(cone(0.07, 0.2, 4), glow(0xc0ff40), 0, y, z + 0.1, g).rotation.x = 2.2;
    void prev; return r;
  },
  yeti(g, c) {
    const fur = c || 0xeef4ff;
    const L = legs(g, fur, 0.2, 0.4, 0.22, 0.4);
    mesh(ico(0.55), mat(fur), 0, 0.95, 0, g).scale.set(1, 1.1, 0.85);
    mesh(ico(0.3), mat(fur), 0, 1.6, 0.05, g);
    mesh(box(0.35, 0.22, 0.1), mat(0x6a8aa8), 0, 1.58, 0.28, g);
    eyes(g, 1.64, 0.33, 0.09, 0.04, 0x000000, false);
    for (const s of [-1, 1]) mesh(cone(0.05, 0.12, 4), mat(0xffffff), s * 0.08, 1.48, 0.33, g).rotation.x = Math.PI;
    const A = arms(g, fur, 0.62, 1.3, 0.75, 0.22);
    return { legs: L, arms: A };
  },
  imp(g, c) {
    const L = legs(g, shade(c, -0.2), 0.1, 0.3, 0.08, 0.3);
    mesh(ico(0.25), mat(c), 0, 0.5, 0, g);
    mesh(ico(0.24), mat(c), 0, 0.88, 0.03, g);
    for (const s of [-1, 1]) { const h = mesh(cone(0.05, 0.2, 4), mat(0x2a1010), s * 0.14, 1.1, 0, g); h.rotation.z = -s * 0.4; }
    eyes(g, 0.92, 0.2, 0.08, 0.04, 0xffe020, false);
    const t = mesh(cone(0.04, 0.4, 4), mat(c), 0, 0.4, -0.3, g); t.rotation.x = -2;
    for (const s of [-1, 1]) { const w = mesh(tet(0.18), mat(shade(c, -0.4)), s * 0.25, 0.7, -0.15, g); w.scale.set(1.4, 1, 0.2); }
    const A = arms(g, c, 0.27, 0.65, 0.25, 0.06);
    return { legs: L, arms: A };
  },
  worm(g, c) {
    const segs = [];
    for (let i = 0; i < 6; i++) segs.push(mesh(ico(0.28 - i * 0.025), mat(i % 2 ? c : shade(c, -0.15)), 0, 0.28 + (i === 0 ? 0.25 : 0), -i * 0.3 + 0.2, g));
    segs[0].position.y = 0.55;
    for (let i = 0; i < 6; i++) { const t = mesh(cone(0.03, 0.12, 4), mat(0xffffff), Math.cos(i) * 0.12, 0.55 + Math.sin(i) * 0.12, 0.48, g); t.rotation.x = Math.PI / 2; }
    g.userData.segments = segs;
  },
  knight(g, c) {
    const steel = c || 0x404858;
    const L = legs(g, steel, 0.16, 0.45, 0.16, 0.45);
    mesh(box(0.55, 0.6, 0.38), mat(steel), 0, 0.75, 0, g);
    mesh(box(0.38, 0.38, 0.38), mat(shade(steel, -0.2)), 0, 1.25, 0, g);
    mesh(box(0.3, 0.05, 0.05), glow(0xff2020), 0, 1.27, 0.2, g);
    mesh(box(0.04, 0.2, 0.3), mat(0x801010), 0, 1.5, 0, g);
    const A = arms(g, steel, 0.36, 1.0, 0.4, 0.14);
    const sw = pivot(A[1], 0, -0.4, 0.05); sw.rotation.x = Math.PI / 2;
    mesh(box(0.08, 1.0, 0.14), mat(0x9098a8), 0, 0.55, 0, sw);
    return { legs: L, arms: A };
  },
  eye(g, c) {
    mesh(ico(0.45), mat(0xf4ecec), 0, 1.0, 0, g);
    mesh(cyl(0.22, 0.22, 0.05, 8), mat(c), 0, 1.0, 0.43, g).rotation.x = Math.PI / 2;
    mesh(cyl(0.1, 0.1, 0.06, 6), mat(0x000000), 0, 1.0, 0.45, g).rotation.x = Math.PI / 2;
    for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2; const t = mesh(cone(0.06, 0.5, 4), mat(shade(c, -0.3)), Math.cos(a) * 0.25, 0.55, Math.sin(a) * 0.25 - 0.1, g); t.rotation.x = Math.PI; }
    g.userData.float = true;
  },
  dragon(g, c) {
    const L = legs(g, shade(c, -0.2), 0.25, 0.4, 0.2, 0.4);
    mesh(ico(0.55), mat(c), 0, 0.9, -0.1, g).scale.set(1, 0.9, 1.4);
    const n = mesh(cyl(0.15, 0.22, 0.6, 5), mat(c), 0, 1.35, 0.45, g); n.rotation.x = 0.6;
    mesh(box(0.35, 0.3, 0.55), mat(c), 0, 1.65, 0.75, g);
    for (const s of [-1, 1]) { mesh(cone(0.05, 0.3, 4), mat(0xf0e0b0), s * 0.12, 1.88, 0.6, g).rotation.x = -0.6; mesh(ico(0.04), glow(0xffe020), s * 0.12, 1.72, 1.0, g); }
    const t = mesh(cone(0.2, 0.9, 5), mat(c), 0, 0.8, -0.95, g); t.rotation.x = -1.8;
    for (let i = 0; i < 4; i++) mesh(tet(0.1), mat(0xf0e0b0), 0, 1.35 - i * 0.05, 0.1 - i * 0.25, g);
    const W = [];
    for (const s of [-1, 1]) { const p = pivot(g, s * 0.4, 1.2, -0.1); const w = mesh(tet(0.6), mat(shade(c, -0.35)), s * 0.5, 0, 0, p); w.scale.set(1.3, 0.15, 0.9); W.push(p); }
    g.userData.wings = W;
    const A = arms(g, shade(c, -0.2), 0.42, 0.95, 0.3, 0.12);
    return { legs: L, arms: A };
  },
  mushroom(g, c) {
    const L = legs(g, 0xe8dcc0, 0.1, 0.2, 0.08, 0.2);
    mesh(cyl(0.18, 0.22, 0.5, 6), mat(0xf0e4c8), 0, 0.45, 0, g);
    mesh(cone(0.45, 0.4, 7), mat(c), 0, 0.88, 0, g);
    for (let i = 0; i < 4; i++) mesh(ico(0.05), mat(0xffffff), Math.cos(i * 1.6) * 0.25, 0.85, Math.sin(i * 1.6) * 0.25, g);
    eyes(g, 0.55, 0.2, 0.07, 0.035, 0x111111, false);
    return { legs: L, arms: [] };
  },
  ghost(g, c) { FAM.wisp(g, c); },
  rat(g, c) {
    const L = legs(g, shade(c, -0.2), 0.12, 0.18, 0.08, 0.18);
    mesh(ico(0.3), mat(c), 0, 0.35, -0.05, g).scale.set(0.9, 0.8, 1.3);
    const h = mesh(cone(0.18, 0.35, 5), mat(c), 0, 0.4, 0.38, g); h.rotation.x = Math.PI / 2;
    mesh(ico(0.04), mat(0xff8aa8), 0, 0.4, 0.56, g);
    for (const s of [-1, 1]) mesh(cyl(0.08, 0.08, 0.02, 6), mat(0xff9ab0), s * 0.12, 0.58, 0.28, g).rotation.x = Math.PI / 2;
    eyes(g, 0.48, 0.38, 0.08, 0.03, 0xff2020, false);
    const t = mesh(cyl(0.015, 0.03, 0.6, 4), mat(0xff9ab0), 0, 0.3, -0.6, g); t.rotation.x = 1.3;
    return { legs: L, arms: [] };
  },

  quad(g, c, o = {}) { // generic four-legged beast
    const L = [];
    for (const z of [0.25, -0.25]) for (const s of [-1, 1]) { const p = pivot(g, s * 0.2, 0.35, z); mesh(box(0.12, 0.35, 0.12), mat(shade(c, -0.25)), 0, -0.17, 0, p); L.push(p); }
    mesh(box(0.5, 0.4, 0.8), mat(c), 0, 0.55, 0, g);
    mesh(box(0.34, 0.3, 0.35), mat(c), 0, 0.75, 0.5, g);
    mesh(box(0.2, 0.15, 0.2), mat(shade(c, -0.15)), 0, 0.68, 0.72, g);
    eyes(g, 0.82, 0.67, 0.1, 0.035, o.eye ?? 0x111111, false);
    return { legs: L, arms: [] };
  },
  hog(g, c) { const r = FAM.quad(g, c); for (let i = 0; i < 7; i++) { const sp = mesh(cone(0.05, 0.3, 4), mat(0xe0d070), (i % 3 - 1) * 0.15, 0.85, 0.2 - i * 0.08, g); sp.rotation.x = -0.6; } mesh(cyl(0.08, 0.08, 0.05, 6), mat(0xffa0a0), 0, 0.68, 0.83, g).rotation.x = Math.PI / 2; for (const s of [-1, 1]) mesh(cone(0.03, 0.15, 4), mat(0xffffff), s * 0.1, 0.65, 0.82, g); return r; },
  hound(g, c) { const r = FAM.quad(g, c, { eye: 0xffa020 }); for (const s of [-1, 1]) mesh(cone(0.07, 0.2, 4), mat(c), s * 0.1, 1.0, 0.45, g); const t = mesh(cone(0.07, 0.4, 4), mat(shade(c, 0.2)), 0, 0.7, -0.55, g); t.rotation.x = -2.2; for (let i = 0; i < 3; i++) mesh(tet(0.08), glow(0xff8030), (i - 1) * 0.1, 0.8, -0.1 + i * 0.1, g); return r; },
  sphinx(g, c) { const r = FAM.quad(g, c); mesh(cyl(0.3, 0.3, 0.1, 6), mat(0x3050c0), 0, 0.8, 0.45, g).rotation.x = Math.PI / 2; mesh(oct(0.1), glow(0xffe060), 0, 1.05, 0.5, g); return r; },
  lizard(g, c) {
    const L = [];
    for (const z of [0.2, -0.2]) for (const s of [-1, 1]) { const p = pivot(g, s * 0.18, 0.15, z); mesh(box(0.2, 0.06, 0.06), mat(c), s * 0.08, -0.05, 0, p); L.push(p); }
    mesh(box(0.28, 0.18, 0.6), mat(c), 0, 0.2, 0, g);
    mesh(box(0.22, 0.14, 0.25), mat(c), 0, 0.22, 0.4, g);
    eyes(g, 0.3, 0.45, 0.08, 0.03, 0xffd020, false);
    const t = mesh(cone(0.1, 0.6, 4), mat(shade(c, -0.15)), 0, 0.18, -0.55, g); t.rotation.x = -Math.PI / 2;
    return { legs: L, arms: [], legAxis: 'y' };
  },
  toad(g, c) {
    const L = legs(g, shade(c, -0.2), 0.25, 0.2, 0.2, 0.2);
    mesh(ico(0.45), mat(c), 0, 0.45, 0, g).scale.set(1.2, 0.8, 1);
    for (const s of [-1, 1]) { mesh(ico(0.12), mat(c), s * 0.22, 0.78, 0.2, g); mesh(ico(0.06), mat(0xffd020, 0x553300), s * 0.22, 0.82, 0.29, g); }
    for (let i = 0; i < 4; i++) mesh(ico(0.07), glow(0xff8020), Math.cos(i * 1.7) * 0.3, 0.7, Math.sin(i * 1.7) * 0.25 - 0.1, g);
    return { legs: L, arms: [] };
  },
  caster(g, c, o = {}) {
    mesh(cone(0.4, 1.1, 6), mat(c), 0, 0.55, 0, g);
    mesh(ico(0.22), mat(o.skin ?? shade(c, 0.3)), 0, 1.2, 0, g);
    mesh(cone(0.27, 0.45, 6), mat(shade(c, -0.25)), 0, 1.4, -0.03, g);
    for (const s of [-1, 1]) mesh(ico(0.04), glow(o.eye ?? 0xffe080), s * 0.07, 1.22, 0.19, g);
    const A = arms(g, c, 0.32, 0.95, 0.4, 0.1);
    const st = pivot(A[1], 0, -0.4, 0.05);
    mesh(cyl(0.025, 0.025, 1.2, 4), mat(0x5a3a1a), 0, 0.3, 0, st);
    mesh(oct(0.1), glow(o.orb ?? 0x80ffa0), 0, 0.95, 0, st);
    g.userData.float = !!o.float;
    return { legs: [], arms: A };
  },
  walrus(g, c) {
    const L = legs(g, shade(c, -0.2), 0.3, 0.3, 0.25, 0.3);
    mesh(ico(0.6), mat(c), 0, 0.8, 0, g).scale.set(1.1, 1, 1.2);
    mesh(ico(0.3), mat(c), 0, 1.15, 0.5, g);
    for (const s of [-1, 1]) { const t = mesh(cone(0.05, 0.45, 4), mat(0xfffbe8), s * 0.1, 0.8, 0.7, g); t.rotation.x = Math.PI; mesh(ico(0.1), mat(shade(c, 0.2)), s * 0.09, 1.05, 0.75, g); }
    eyes(g, 1.3, 0.72, 0.13, 0.04, 0x111111, false);
    for (let i = 0; i < 5; i++) mesh(oct(0.12), mat(0xc0f0ff, 0x204050), (i - 2) * 0.2, 1.35, -0.2, g);
    return { legs: L, arms: [] };
  },
  puff(g, c) { mesh(dode(0.3), mat(c), 0, 0.7, 0, g); for (let i = 0; i < 6; i++) mesh(ico(0.12), mat(shade(c, 0.3)), Math.cos(i) * 0.25, 0.7 + Math.sin(i * 2) * 0.2, Math.sin(i) * 0.25, g); eyes(g, 0.75, 0.28, 0.08, 0.04, 0x111111, false); g.userData.float = true; },
  bloater(g, c) { FAM.blob(g, c); g.children[0].scale.setScalar(1.25); for (let i = 0; i < 8; i++) { const a = i * 0.785; const s = mesh(cone(0.06, 0.25, 4), glow(0xe080ff), Math.cos(a) * 0.5, 0.5, Math.sin(a) * 0.5, g); s.rotation.set(Math.sin(a) * 1.57, 0, -Math.cos(a) * 1.57); } g.userData.squash = true; },
  grub(g, c) { FAM.worm(g, c); const lf = mesh(tet(0.25), mat(0x4caf50), 0, 0.75, -0.2, g); lf.scale.set(1, 1.4, 0.2); },
  queen(g, c) { const r = FAM.caster(g, c, { skin: 0x9ccc65, orb: 0xff4080 }); for (let i = 0; i < 8; i++) { const a = i * 0.785; mesh(cone(0.07, 0.35, 4), mat(0x3e2723), Math.cos(a) * 0.45, 0.2, Math.sin(a) * 0.45, g); } for (let i = 0; i < 5; i++) mesh(cone(0.04, 0.2, 4), mat(0x8bc34a), Math.cos(i * 1.26) * 0.16, 1.62, Math.sin(i * 1.26) * 0.16, g); return r; },
  sovereign(g, c) { const r = FAM.caster(g, c, { skin: 0x111122, eye: 0xff40ff, orb: 0xc060ff, float: true }); const W = []; for (const s of [-1, 1]) { const p = pivot(g, s * 0.3, 1.0, -0.2); const w = mesh(tet(0.6), mat(shade(c, -0.4)), s * 0.5, 0, 0, p); w.scale.set(1.3, 0.15, 0.8); W.push(p); } g.userData.wings = W; for (let i = 0; i < 3; i++) { const o = mesh(oct(0.1), glow(0xe080ff), Math.cos(i * 2.1) * 0.7, 1.5, Math.sin(i * 2.1) * 0.7, g); void o; } return r; },
  blob(g, c) {
    mesh(dode(0.42), mat(c), 0, 0.42, 0, g);
    eyes(g, 0.55, 0.36, 0.12, 0.05);
    g.userData.squash = true;
  },
};
const FAM_KEYS = [
  ['slime', 'slime'], ['ooze', 'slime'], ['jelly', 'slime'], ['bat', 'bat'], ['golem', 'golem'], ['rock', 'golem'], ['stone', 'golem'], ['magma', 'golem'], ['titan', 'golem'], ['colossus', 'golem'],
  ['skel', 'skeleton'], ['bone', 'skeleton'], ['lich', 'skeleton'], ['spider', 'spider'], ['arach', 'spider'], ['wisp', 'wisp'], ['ghost', 'ghost'], ['spirit', 'wisp'], ['flame', 'wisp'], ['phantom', 'ghost'],
  ['crab', 'crab'], ['scorp', 'scorpion'], ['yeti', 'yeti'], ['ape', 'yeti'], ['imp', 'imp'], ['demon', 'imp'], ['devil', 'imp'], ['worm', 'worm'], ['snake', 'worm'], ['serpent', 'worm'], ['centipede', 'worm'], ['wyrm', 'worm'],
  ['knight', 'knight'], ['warrior', 'knight'], ['king', 'knight'], ['eye', 'eye'], ['beholder', 'eye'], ['dragon', 'dragon'], ['drake', 'dragon'], ['mushroom', 'mushroom'], ['shroom', 'mushroom'], ['fung', 'mushroom'],
  ['rat', 'rat'], ['hog', 'hog'], ['boar', 'hog'], ['hound', 'hound'], ['wolf', 'hound'], ['jackal', 'hound'], ['pup', 'hound'], ['newt', 'lizard'], ['lizard', 'lizard'], ['skink', 'lizard'], ['toad', 'toad'], ['frog', 'toad'], ['priest', 'caster'], ['shaman', 'caster'], ['seer', 'caster'], ['witch', 'caster'], ['walrus', 'walrus'], ['puff', 'puff'], ['bloat', 'bloater'], ['grub', 'grub'], ['mite', 'spider'], ['tick', 'spider'], ['slug', 'slime'], ['mouse', 'rat'], ['weasel', 'rat'], ['beetle', 'crab'], ['bug', 'crab'], ['mole', 'rat'],
];
const EXACT = {
  sprout_grub: 'grub', pollen_puff: 'puff', thistle_hog: 'hog', slug_spitter: 'slime', puffball_shroom: 'mushroom', oak_golem: 'golem', bramble_shaman: 'caster',
  sand_skink: 'lizard', dune_scarab: 'crab', cactus_crab: 'crab', mirage_jackal: 'hound', tumble_imp: 'imp', sun_sphinx: 'sphinx', sandstone_brute: 'golem',
  icicle_bat: 'bat', snow_mite: 'spider', glacier_pup: 'hound', rime_wisp: 'wisp', crystal_tick: 'spider', permafrost_walrus: 'walrus', aurora_seer: 'caster',
  ash_newt: 'lizard', magma_slug: 'slime', cinder_hound: 'hound', obsidian_imp: 'imp', fumarole_toad: 'toad', slag_juggernaut: 'golem', ember_priest: 'caster',
  void_mote: 'wisp', gloom_stalker: 'ghost', rift_eye: 'eye', null_bloater: 'bloater', shade_knight: 'knight', star_eater: 'bloater', echo_weaver: 'spider',
  bramble_queen: 'queen', dune_wyrm: 'worm', frost_matriarch: 'yeti', magma_colossus: 'golem', void_sovereign: 'sovereign',
};
function family(key) {
  if (EXACT[key]) return EXACT[key];
  const k = String(key || '').toLowerCase();
  if (FAM[k]) return k;
  for (const [w, f] of FAM_KEYS) if (k.includes(w)) return f;
  return 'blob';
}

export function buildEnemy(modelKey, color = 0x88cc44, size = 1) {
  const g = new THREE.Group();
  const inner = new THREE.Group();
  g.add(inner);
  const fam = family(modelKey);
  const limbs = FAM[fam](inner, color ?? 0x88cc44) || {};
  const isBoss = size >= 2 || /boss|king|queen|lord|titan|colossus|ancient/.test(String(modelKey));
  if (isBoss) { // crown of spikes for drama
    const top = new THREE.Box3().setFromObject(inner).max.y;
    for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2; mesh(cone(0.05, 0.22, 4), glow(0xffc020), Math.cos(a) * 0.18, top + 0.08, Math.sin(a) * 0.18, inner); }
    const aura = new THREE.Mesh(torus(0.8, 0.04), glow(color)); aura.rotation.x = Math.PI / 2; aura.position.y = 0.05; inner.add(aura);
    g.userData.aura = aura;
  }
  inner.scale.setScalar(size || 1);
  g.userData.inner = inner;
  g.userData.limbs = { legs: limbs.legs || [], arms: limbs.arms || [] };
  g.userData.legAxis = limbs.legAxis || 'x';
  g.userData.family = fam;
  g.userData.kind = 'enemy';
  g.userData.phase = Math.random() * 6.28;
  return g;
}

// ---------- props ----------
export function buildProp(type, rng = Math.random) {
  const g = new THREE.Group();
  const r = () => rng();
  switch (type) {
    case 'tree': {
      mesh(cyl(0.12, 0.18, 1.0, 5), mat(0x6a4a2a), 0, 0.5, 0, g);
      const c = [0x3a8a3a, 0x2f7a35, 0x4a9a40][Math.floor(r() * 3)];
      for (let i = 0; i < 3; i++) mesh(cone(0.8 - i * 0.2, 0.8, 6), mat(c), 0, 1.1 + i * 0.45, 0, g);
      break;
    }
    case 'rock': for (let i = 0; i < 1 + Math.floor(r() * 3); i++) { const m = mesh(dode(0.3 + r() * 0.4), mat(0x8a8a90), (r() - 0.5) * 0.8, 0.2, (r() - 0.5) * 0.8, g); m.rotation.set(r() * 3, r() * 3, 0); } break;
    case 'crystal': { const c = [0x60e0ff, 0xc060ff, 0x60ffb0][Math.floor(r() * 3)]; for (let i = 0; i < 3 + Math.floor(r() * 3); i++) { const m = mesh(oct(0.2 + r() * 0.25), mat(c, shade(c, -0.5)), (r() - 0.5) * 0.6, 0.4, (r() - 0.5) * 0.6, g); m.scale.y = 2; m.rotation.z = (r() - 0.5) * 0.8; } break; }
    case 'mushroom': { const c = r() < 0.5 ? 0xd03030 : 0x8060d0; mesh(cyl(0.12, 0.16, 0.6, 6), mat(0xf0e4c8), 0, 0.3, 0, g); mesh(cone(0.5, 0.4, 7), mat(c), 0, 0.75, 0, g); for (let i = 0; i < 4; i++) mesh(ico(0.05), mat(0xffffff), Math.cos(i * 1.6) * 0.28, 0.72, Math.sin(i * 1.6) * 0.28, g); break; }
    case 'pillar': { mesh(box(0.7, 0.2, 0.7), mat(0xb0a890), 0, 0.1, 0, g); const h = 1.5 + r() * 1.5; mesh(cyl(0.25, 0.25, h, 6), mat(0xc8c0a8), 0, 0.2 + h / 2, 0, g); if (r() < 0.6) mesh(box(0.7, 0.2, 0.7), mat(0xb0a890), 0, 0.3 + h, 0, g); break; }
    case 'cactus': { mesh(cyl(0.18, 0.2, 1.4, 6), mat(0x4a9a4a), 0, 0.7, 0, g); for (const s of [-1, 1]) { mesh(box(0.35, 0.14, 0.14), mat(0x4a9a4a), s * 0.25, 0.7 + s * 0.1, 0, g); mesh(cyl(0.1, 0.1, 0.4, 6), mat(0x4a9a4a), s * 0.4, 0.9 + s * 0.1, 0, g); } break; }
    case 'lavaRock': { const m = mesh(dode(0.5 + r() * 0.3), mat(0x2a1a1a), 0, 0.3, 0, g); m.rotation.y = r() * 3; mesh(ico(0.2), glow(0xff5010), 0, 0.65, 0, g); break; }
    case 'bones': { for (let i = 0; i < 4; i++) { const b = mesh(box(0.06, 0.06, 0.5), mat(0xe8e4d0), (r() - 0.5) * 0.6, 0.04, (r() - 0.5) * 0.6, g); b.rotation.y = r() * 3; } mesh(dode(0.15), mat(0xe8e4d0), 0, 0.12, 0, g); break; }
    case 'ruin': { for (let i = 0; i < 3; i++) mesh(box(0.5, 0.4 + r() * 1.2, 0.4), mat(0x9a9488), i * 0.55 - 0.55, 0.4, 0, g); mesh(box(0.6, 0.3, 0.4), mat(0x8a8478), 0.4, 0.15, 0.6, g).rotation.y = 0.5; break; }
    default: mesh(dode(0.4), mat(0x888888), 0, 0.3, 0, g);
  }
  g.rotation.y = r() * Math.PI * 2;
  const s = 0.8 + r() * 0.5; g.scale.setScalar(s);
  g.userData.kind = 'prop'; g.userData.radius = 0.6 * s;
  return g;
}

// ---------- interactables ----------
export function buildMerchant() {
  const g = new THREE.Group();
  const wood = 0x6a4a2a;
  mesh(box(1.8, 0.7, 0.9), mat(wood), 0, 0.6, 0, g);
  for (const s of [-1, 1]) { const w = mesh(cyl(0.3, 0.3, 0.1, 8), mat(0x3a2a1a), s * 0.95, 0.3, 0.1, g); w.rotation.z = Math.PI / 2; }
  for (const x of [-0.85, 0.85]) for (const z of [-0.4, 0.4]) mesh(box(0.06, 1.4, 0.06), mat(wood), x, 1.6, z, g);
  for (let i = 0; i < 4; i++) mesh(box(0.45, 0.06, 1.1), mat(i % 2 ? 0x601a6a : 0x2a1030), -0.68 + i * 0.45, 2.35, 0, g).rotation.x = 0.15;
  for (let i = 0; i < 3; i++) mesh(oct(0.1), glow([0xff4060, 0x40ff80, 0x60a0ff][i]), -0.5 + i * 0.5, 1.05, 0.25, g);
  // hooded dealer behind cart
  const d = new THREE.Group(); d.position.set(0, 0, -0.75); g.add(d);
  mesh(cone(0.4, 1.3, 6), mat(0x1a1420), 0, 0.65, 0, d);
  mesh(cone(0.25, 0.5, 6), mat(0x1a1420), 0, 1.45, 0, d);
  mesh(ico(0.16), mat(0x050505), 0, 1.35, 0.1, d);
  for (const s of [-1, 1]) mesh(ico(0.035), glow(0xffd020), s * 0.06, 1.37, 0.22, d);
  // lantern
  const l = pivot(g, 0.85, 2.1, 0.45);
  mesh(cyl(0.01, 0.01, 0.2, 3), mat(0x222222), 0, 0.05, 0, l);
  mesh(box(0.14, 0.18, 0.14), glow(0xffb040), 0, -0.12, 0, l);
  const light = new THREE.PointLight(0xffb040, 1.2, 6); light.position.set(0.85, 1.9, 0.45); g.add(light);
  g.userData.kind = 'merchant'; g.userData.lantern = l;
  return g;
}

export function buildShrine() {
  const g = new THREE.Group();
  mesh(box(1.4, 0.2, 1.4), mat(0x707078), 0, 0.1, 0, g);
  mesh(box(0.9, 0.7, 0.9), mat(0x8a8a94), 0, 0.55, 0, g);
  mesh(box(1.1, 0.12, 1.1), mat(0x9a9aa4), 0, 0.96, 0, g);
  for (const x of [-0.6, 0.6]) for (const z of [-0.6, 0.6]) mesh(cyl(0.06, 0.08, 0.5, 5), mat(0x707078), x, 0.45, z, g);
  const c = mesh(oct(0.28), glow(0x80c0ff), 0, 1.7, 0, g); c.scale.y = 1.6;
  mesh(ico(0.5), mat(0x80c0ff, 0x80c0ff, { opacity: 0.2 }), 0, 1.7, 0, c.parent);
  g.userData.crystal = c; g.userData.kind = 'shrine';
  return g;
}

export function buildRune(color = 0xff60ff) {
  const g = new THREE.Group();
  const o = mesh(oct(0.3), glow(color), 0, 0.9, 0, g);
  const ring = mesh(torus(0.5, 0.04), glow(color), 0, 0.9, 0, g); ring.rotation.x = Math.PI / 2;
  mesh(cyl(0.5, 0.5, 0.02, 10), mat(color, color, { opacity: 0.35 }), 0, 0.02, 0, g);
  g.userData.core = o; g.userData.ring = ring; g.userData.kind = 'rune';
  return g;
}

export function buildChest() {
  const g = new THREE.Group();
  mesh(box(0.9, 0.5, 0.6), mat(0x8a5a2a), 0, 0.25, 0, g);
  const lid = pivot(g, 0, 0.5, -0.3);
  mesh(box(0.9, 0.22, 0.6), mat(0x9a6a32), 0, 0.11, 0.3, lid);
  for (const x of [-0.35, 0.35]) mesh(box(0.08, 0.74, 0.62), mat(0xd0a020), x, 0.37, 0, g);
  mesh(box(0.14, 0.16, 0.05), mat(0xffd040), 0, 0.5, 0.31, g);
  g.userData.lid = lid; g.userData.kind = 'chest';
  return g;
}

const GEM_COLORS = [0x40a0ff, 0x40ff80, 0xff4060, 0xffd020];
export function buildXpGem(tier = 0) {
  const g = new THREE.Group();
  const t = Math.max(0, Math.min(3, tier | 0));
  const m = mesh(oct(0.14 + t * 0.04), glow(GEM_COLORS[t]), 0, 0.3, 0, g); m.scale.y = 1.5; m.castShadow = false;
  g.userData.kind = 'xp'; g.userData.spin = m;
  return g;
}

export function buildGold() {
  const g = new THREE.Group();
  const c = mesh(cyl(0.15, 0.15, 0.04, 8), mat(0xffc020, 0x604000), 0, 0.3, 0, g); c.rotation.x = Math.PI / 2; c.castShadow = false;
  g.userData.kind = 'gold'; g.userData.spin = c;
  return g;
}

// ---------- animation ----------
export function animate(group, t, moving = false) {
  const u = group?.userData; if (!u) return;
  const ph = (u.phase || 0) + t;
  const inner = u.inner; if (!inner) return;
  switch (u.kind) {
    case 'rune': if (u.core) { u.core.rotation.y = t * 2; u.core.position.y = 0.9 + Math.sin(t * 3) * 0.1; u.ring.rotation.z = t; u.ring.rotation.y = Math.sin(t) * 0.3; } return;
    case 'shrine': if (u.crystal) { u.crystal.rotation.y = t; u.crystal.position.y = 1.7 + Math.sin(t * 2) * 0.12; } return;
    case 'xp': case 'gold': if (u.spin) { u.spin.rotation.y = t * 3; u.spin.position.y = 0.3 + Math.sin(t * 4) * 0.06; } return;
    case 'merchant': if (u.lantern) u.lantern.rotation.z = Math.sin(t * 2) * 0.15; return;
    case 'prop': case 'chest': return;
  }
  const L = u.limbs || {};
  const sp = moving ? 10 : 2, amp = moving ? 0.7 : 0.08;
  const axis = u.legAxis || 'x';
  (L.legs || []).forEach((l, i) => { const b = axis === 'y' ? (l.userData.base ?? (l.userData.base = l.rotation.y)) : 0; l.rotation[axis] = b + Math.sin(ph * sp + (i % 2) * Math.PI) * amp * (axis === 'y' ? 0.4 : 1); });
  (L.arms || []).forEach((a, i) => { a.rotation.x = Math.sin(ph * sp + (i % 2 ? 0 : Math.PI)) * amp * 0.8; });
  if (u.wings) u.wings.forEach((w, i) => { w.rotation.z = Math.sin(ph * 14) * 0.6 * (i ? -1 : 1); });
  let y = 0;
  if (u.float) y = 0.15 + Math.sin(ph * 3) * 0.12;
  else if (u.squash) { const s = Math.sin(ph * (moving ? 8 : 3)); const base = inner.userData.base ?? (inner.userData.base = inner.scale.x); inner.scale.set(base * (1 - s * 0.08), base * (1 + s * 0.12), base * (1 - s * 0.08)); }
  else y = moving ? Math.abs(Math.sin(ph * sp)) * 0.08 : Math.sin(ph * 2) * 0.02;
  if (u.segments) u.segments.forEach((s, i) => { s.position.x = Math.sin(ph * 6 - i * 0.8) * 0.12; });
  if (u.aura) { u.aura.rotation.z = t; u.aura.scale.setScalar(1 + Math.sin(t * 3) * 0.08); }
  inner.position.y = y;
}
