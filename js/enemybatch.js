// Burrow Brawl — instanced enemy rendering (owned by core/perf).
// Each enemy model key is merged once into a single vertex-coloured BufferGeometry and drawn with one
// THREE.InstancedMesh per (key, opaque|transparent). Enemies keep a lightweight Object3D proxy as `e.mesh`
// so gameplay code can keep writing position/rotation/scale/visible; the batcher composes instance matrices
// (plus a cheap bob/squash/waddle) from those proxies each frame. Health bars are one shared InstancedMesh.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

function patchEmissive(mat) {
  mat.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec3 emis;\nvarying vec3 vEmis;')
      .replace('#include <color_vertex>', '#include <color_vertex>\nvEmis = emis;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vEmis;')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += vEmis;');
  };
  mat.customProgramCacheKey = () => 'enemyBatchEmis';
  return mat;
}
const MAT_OPAQUE = patchEmissive(new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }));
const MAT_TRANS = patchEmissive(new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, transparent: true, depthWrite: false }));
const BAR_GEO = new THREE.PlaneGeometry(1, 1);
const BAR_MAT = new THREE.MeshBasicMaterial({ color: 0xffffff, depthWrite: false, transparent: true, fog: false });

// Template cache survives stage changes (merged geometries are ours, never disposed by the world teardown).
const TEMPLATES = new Map();

function mergeTemplate(group) {
  group.updateMatrixWorld(true);
  const parts = { opaque: [], trans: [] };
  const col = new THREE.Color(), em = new THREE.Color();
  group.traverse((o) => {
    if (!o.isMesh || !o.geometry?.attributes?.position) return;
    const m = Array.isArray(o.material) ? o.material[0] : o.material;
    let g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
    for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k);
    if (!g.attributes.normal) g.computeVertexNormals();
    g.applyMatrix4(o.matrixWorld);
    const n = g.attributes.position.count;
    col.copy(m?.color || col.set(0xffffff));
    if (m?.emissive) em.copy(m.emissive).multiplyScalar(m.emissiveIntensity ?? 1); else em.setRGB(0, 0, 0);
    const a = m?.transparent ? (m.opacity ?? 1) : 1;
    const c = new Float32Array(n * 4), e = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { c[i * 4] = col.r; c[i * 4 + 1] = col.g; c[i * 4 + 2] = col.b; c[i * 4 + 3] = a; e[i * 3] = em.r; e[i * 3 + 1] = em.g; e[i * 3 + 2] = em.b; }
    g.setAttribute('color', new THREE.BufferAttribute(c, 4));
    g.setAttribute('emis', new THREE.BufferAttribute(e, 3));
    (a < 1 ? parts.trans : parts.opaque).push(g);
  });
  const out = [];
  for (const k of ['opaque', 'trans']) {
    if (!parts[k].length) continue;
    const merged = mergeGeometries(parts[k], false);
    parts[k].forEach((g) => g.dispose());
    if (merged) { merged.computeBoundingSphere(); out.push({ geo: merged, mat: k === 'opaque' ? MAT_OPAQUE : MAT_TRANS }); }
  }
  return out;
}

export function getTemplate(key, build) {
  let t = TEMPLATES.get(key);
  if (t) return t;
  const g = build();
  const u = g.userData || {};
  t = { key, buckets: mergeTemplate(g), float: !!u.float, squash: !!u.squash, legs: !!(u.limbs?.legs?.length), wings: !!u.wings,
    radius: 1, meshes: null, cap: 0, count: 0 };
  t.radius = Math.max(0.6, ...t.buckets.map((b) => b.geo.boundingSphere.radius + b.geo.boundingSphere.center.length()));
  TEMPLATES.set(key, t);
  return t;
}

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _s = new THREE.Vector3();
const _c = new THREE.Color(), _frustum = new THREE.Frustum(), _pv = new THREE.Matrix4(), _sph = new THREE.Sphere();

export class EnemyBatcher {
  constructor(scene) {
    this.root = new THREE.Group(); this.root.name = 'enemyBatch';
    scene.add(this.root);
    this.active = new Set();
    this.bars = null; this.barCap = 0; this.barCount = 0;
    this.animate = true;
  }
  _ensure(t, n) {
    if (t.cap >= n && t.meshes) return;
    let cap = Math.max(32, t.cap || 32); while (cap < n) cap *= 2;
    if (t.meshes) for (const m of t.meshes) { this.root.remove(m); m.dispose(); }
    t.meshes = t.buckets.map((b) => {
      const im = new THREE.InstancedMesh(b.geo, b.mat, cap);
      im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      im.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3).fill(1), 3); im.instanceColor.setUsage(THREE.DynamicDrawUsage);
      im.frustumCulled = false; im.castShadow = false; im.receiveShadow = false; im.count = 0;
      if (b.mat.transparent) im.renderOrder = 1;
      this.root.add(im); return im;
    });
    t.cap = cap;
  }
  // Pre-size buffers & upload so the first fight frame doesn't hitch.
  warm(t, n = 32) { this._ensure(t, n); }
  _ensureBars(n) {
    if (this.bars && this.barCap >= n) return;
    let cap = Math.max(64, this.barCap || 64); while (cap < n) cap *= 2;
    if (this.bars) { this.root.remove(this.bars); this.bars.dispose(); }
    const im = new THREE.InstancedMesh(BAR_GEO, BAR_MAT, cap);
    im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    im.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3), 3); im.instanceColor.setUsage(THREE.DynamicDrawUsage);
    im.frustumCulled = false; im.renderOrder = 2; im.count = 0;
    this.root.add(im); this.bars = im; this.barCap = cap;
  }
  // enemies: game enemy list; non-boss enemies with e.tpl are drawn. camera for frustum culling + bar billboarding.
  update(enemies, camera, showBars, pickups = null, time = 0) {
    camera.updateMatrixWorld();
    _pv.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse); _frustum.setFromProjectionMatrix(_pv);
    for (const t of this.active) t.count = 0;
    let nb = 0, needBars = 0;
    for (let i = 0; i < enemies.length; i++) {
      const e = enemies[i]; const t = e.tpl;
      if (!t || !e.alive || !e.mesh.visible) continue;
      const o = e.mesh;
      _sph.center.set(o.position.x, o.position.y + t.radius * 0.5 * o.scale.y, o.position.z); _sph.radius = t.radius * Math.max(o.scale.x, o.scale.y);
      if (!_frustum.intersectsSphere(_sph)) continue;
      if (!this.active.has(t)) this.active.add(t);
      if (t.count >= t.cap || !t.meshes) this._ensure(t, t.count + 1);
      // cheap procedural animation (replaces per-limb animation)
      const ph = e.t + (e.phase || 0);
      let y = 0, sx = 1, sy = 1, rz = 0, rx = 0;
      if (this.animate) {
        if (t.float) y = 0.15 + Math.sin(ph * 3) * 0.12;
        else if (t.squash) { const s = Math.sin(ph * 8); sx = 1 - s * 0.08; sy = 1 + s * 0.12; }
        else { const s = Math.sin(ph * 10); y = Math.abs(s) * 0.08; if (t.legs) rz = s * 0.07; rx = 0.05; }
        if (t.wings) rz = Math.sin(ph * 14) * 0.05;
      }
      _p.set(o.position.x, o.position.y + y * o.scale.y, o.position.z);
      _e.set(rx, o.rotation.y, rz, 'YXZ'); _q.setFromEuler(_e);
      _s.set(o.scale.x * sx, o.scale.y * sy, o.scale.z * sx);
      _m.compose(_p, _q, _s);
      const k = t.count++;
      const f = e.hitPunch > 0 ? 1 + Math.min(1, e.hitPunch * 6) * 0.9 : 1;
      if (e.freeze > 0) _c.setRGB(0.6 * f, 0.85 * f, 1.4 * f); else _c.setRGB(f, f, f);
      for (const im of t.meshes) { im.setMatrixAt(k, _m); im.setColorAt(k, _c); }
      if (e.showBar) needBars++;
    }
    // pickups (xp gems / gold): spin + bob in the instance matrix
    if (pickups) {
      _c.setRGB(1, 1, 1);
      for (let i = 0; i < pickups.length; i++) {
        const q = pickups[i], t = q.tpl; if (!t) continue;
        const o = q.mesh; if (!o.visible) continue;
        _sph.center.set(o.position.x, 0.3, o.position.z); _sph.radius = t.radius; if (!_frustum.intersectsSphere(_sph)) continue;
        if (!this.active.has(t)) this.active.add(t);
        if (t.count >= t.cap || !t.meshes) this._ensure(t, t.count + 1);
        _p.set(o.position.x, o.position.y + Math.sin(time * 4) * 0.06, o.position.z);
        _e.set(0, time * 3, 0, 'YXZ'); _q.setFromEuler(_e); _s.set(1, 1, 1); _m.compose(_p, _q, _s);
        const k = t.count++; for (const im of t.meshes) { im.setMatrixAt(k, _m); im.setColorAt(k, _c); }
      }
    }
    for (const t of this.active) if (t.meshes) for (const im of t.meshes) {
      im.count = t.count;
      if (t.count) { im.instanceMatrix.needsUpdate = true; im.instanceColor.needsUpdate = true; }
    }
    // health bars: 2 instances (bg + fill) per damaged/elite enemy
    if (showBars && needBars) {
      this._ensureBars(needBars * 2);
      const bars = this.bars; const cq = camera.quaternion;
      for (let i = 0; i < enemies.length; i++) {
        const e = enemies[i]; if (!e.showBar || !e.alive || !e.tpl) continue;
        const w = Math.max(0.8, e.size * 0.9), hy = e.size * 1.25 + 0.6;
        _p.set(e.pos.x, hy, e.pos.z);
        _sph.center.copy(_p); _sph.radius = w; if (!_frustum.intersectsSphere(_sph)) continue;
        _s.set(w, 0.12, 1); _m.compose(_p, cq, _s); bars.setMatrixAt(nb, _m); bars.setColorAt(nb, _c.set(0x300000)); nb++;
        const k = Math.max(0, Math.min(1, e.hp / e.maxHp));
        _s.set(w * k, 0.12, 1); _p.set(-w * (1 - k) / 2, 0, 0.001).applyQuaternion(cq); _p.x += e.pos.x; _p.y += hy; _p.z += e.pos.z;
        _m.compose(_p, cq, _s); bars.setMatrixAt(nb, _m); bars.setColorAt(nb, e.elite ? _c.set(0xffb000) : _c.set(0x20e020)); nb++;
      }
    }
    if (this.bars) { this.bars.count = nb; if (nb) { this.bars.instanceMatrix.needsUpdate = true; this.bars.instanceColor.needsUpdate = true; } }
  }
  clear() { for (const t of this.active) { t.count = 0; if (t.meshes) for (const im of t.meshes) im.count = 0; } if (this.bars) this.bars.count = 0; }
}
