// Burrow Brawl — small standalone 3D character preview (stone pedestal + torchlight).
import * as THREE from 'three';
import { buildCharacter, animate } from './models.js';

export class CharPreview {
  constructor(canvas, { drag = true, autoRotate = 0.6 } = {}) {
    this.canvas = canvas;
    this.autoRotate = autoRotate;
    this.yaw = 0.4;
    this.disposed = false;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    this.renderer.setClearColor(0x000000, 0);
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(32, 1, 0.1, 50);
    this.camera.position.set(0, 1.9, 7.2);
    this.camera.lookAt(0, 0.95, 0);

    this.scene.add(new THREE.HemisphereLight(0xbfb8a8, 0x2a2018, 0.9));
    const key = new THREE.DirectionalLight(0xffffff, 1.1); key.position.set(2, 4, 3); this.scene.add(key);
    this.torchL = new THREE.PointLight(0xff8a2a, 2.2, 8); this.torchL.position.set(-1.8, 1.8, 1); this.scene.add(this.torchL);
    this.torchR = new THREE.PointLight(0xff8a2a, 2.2, 8); this.torchR.position.set(1.8, 1.8, 1); this.scene.add(this.torchR);

    // stone pedestal: octagonal tiers
    const stone = new THREE.MeshLambertMaterial({ color: 0x7a7a72, flatShading: true });
    const stoneD = new THREE.MeshLambertMaterial({ color: 0x55554f, flatShading: true });
    const ped = new THREE.Group();
    const t1 = new THREE.Mesh(new THREE.CylinderGeometry(1.25, 1.4, 0.3, 8), stoneD); t1.position.y = -0.3;
    const t2 = new THREE.Mesh(new THREE.CylinderGeometry(1.05, 1.15, 0.2, 8), stone); t2.position.y = -0.07;
    ped.add(t1, t2);
    this.scene.add(ped);
    this.pedestal = ped;

    this.holder = new THREE.Group();
    this.scene.add(this.holder);
    this.model = null;

    if (drag) this._bindDrag();
    this._t0 = performance.now();
    this._loop = this._loop.bind(this);
    this._raf = requestAnimationFrame(this._loop);
  }

  setModel(key, opts = {}) {
    if (this.disposed) return;
    if (this.model) { this.holder.remove(this.model); this.model = null; } // models.js shares cached geo/materials: never dispose
    let m = null;
    try { m = buildCharacter(key); } catch (e) { console.warn('preview build failed', e); }
    if (!m) return;
    // normalise height to ~1.8
    const box = new THREE.Box3().setFromObject(m);
    const h = Math.max(0.01, box.max.y - box.min.y);
    const s = 1.8 / h;
    m.scale.multiplyScalar(s);
    m.position.y = 0.03 - box.min.y * s;
    if (opts.silhouette) { const blk = new THREE.MeshBasicMaterial({ color: 0x050505 }); m.traverse((o) => { if (o.isMesh) o.material = blk; }); }
    this.model = m;
    this.holder.add(m);
  }

  _bindDrag() {
    let down = false, lx = 0;
    this._pd = (e) => { down = true; lx = e.clientX; this.canvas.setPointerCapture?.(e.pointerId); this._lastDrag = performance.now(); };
    this._pm = (e) => { if (!down) return; this.yaw += (e.clientX - lx) * 0.012; lx = e.clientX; this._lastDrag = performance.now(); };
    this._pu = () => { down = false; };
    this.canvas.addEventListener('pointerdown', this._pd);
    this.canvas.addEventListener('pointermove', this._pm);
    window.addEventListener('pointerup', this._pu);
  }

  _resize() {
    const w = this.canvas.clientWidth | 0, h = this.canvas.clientHeight | 0;
    if (!w || !h) return;
    if (w !== this._w || h !== this._h) {
      this._w = w; this._h = h;
      this.renderer.setSize(w, h, false);
      this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
    }
  }

  _loop(now) {
    if (this.disposed) return;
    this._raf = requestAnimationFrame(this._loop);
    if (!this.canvas.isConnected) return this.dispose();
    const t = (now - this._t0) / 1000;
    const dt = Math.min(0.05, (now - (this._last || now)) / 1000); this._last = now;
    if (!this._lastDrag || now - this._lastDrag > 1500) this.yaw += dt * this.autoRotate;
    this.holder.rotation.y = this.yaw;
    this.pedestal.rotation.y = this.yaw;
    const fl = 2 + Math.sin(t * 9) * 0.25 + Math.sin(t * 23) * 0.15;
    this.torchL.intensity = fl; this.torchR.intensity = 4.2 - fl;
    if (this.model) { try { animate(this.model, t, false); } catch (e) { /* */ } }
    this._resize();
    this.renderer.render(this.scene, this.camera);
  }

  _disposeObj(o) {
    o.traverse((c) => {
      c.geometry?.dispose?.();
      const mats = Array.isArray(c.material) ? c.material : c.material ? [c.material] : [];
      mats.forEach((m) => m.dispose?.());
    });
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    cancelAnimationFrame(this._raf);
    if (this._pd) {
      this.canvas.removeEventListener('pointerdown', this._pd);
      this.canvas.removeEventListener('pointermove', this._pm);
      window.removeEventListener('pointerup', this._pu);
    }
    this.scene.remove(this.holder);
    this._disposeObj(this.pedestal);
    this.renderer.dispose();
    this.renderer.forceContextLoss?.();
  }
}

// ---------- head portraits ----------
// One shared offscreen renderer; each character's head is rendered once and cached as a data URL.
let shotR = null, shotScene = null, shotCam = null;
const shotCache = new Map();
export function headshot(key, { silhouette = false } = {}) {
  const ck = key + (silhouette ? ':s' : '');
  if (shotCache.has(ck)) return shotCache.get(ck);
  let url = '';
  try {
    if (!shotR) {
      shotR = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
      shotR.setSize(128, 128, false);
      shotR.setClearColor(0x000000, 0);
      shotScene = new THREE.Scene();
      shotScene.add(new THREE.HemisphereLight(0xfff4e0, 0x3a2a1a, 1.1));
      const k = new THREE.DirectionalLight(0xffffff, 1.2); k.position.set(1.5, 2.5, 3); shotScene.add(k);
      const rim = new THREE.PointLight(0xff8a2a, 1.6, 10); rim.position.set(-2, 2, -1); shotScene.add(rim);
      shotCam = new THREE.PerspectiveCamera(30, 1, 0.05, 50);
    }
    const m = buildCharacter(key);
    const box = new THREE.Box3().setFromObject(m);
    const h = Math.max(0.01, box.max.y - box.min.y);
    const s = 1.8 / h;
    m.scale.multiplyScalar(s);
    m.position.y = -box.min.y * s;
    m.rotation.y = 0.35;
    if (silhouette) { const blk = new THREE.MeshBasicMaterial({ color: 0x050505 }); m.traverse((o) => { if (o.isMesh) o.material = blk; }); }
    shotScene.add(m);
    // frame the top ~40% of the model (the head)
    const headY = 1.8 * 0.78, span = 0.95;
    shotCam.position.set(0.25, headY + 0.1, span / (2 * Math.tan((shotCam.fov * Math.PI) / 360)) + 0.4);
    shotCam.lookAt(0, headY + 0.05, 0);
    shotR.render(shotScene, shotCam);
    url = shotR.domElement.toDataURL('image/png');
    shotScene.remove(m); // models.js shares cached geo/materials: never dispose
  } catch (e) { console.warn('headshot failed', key, e); }
  shotCache.set(ck, url);
  return url;
}
