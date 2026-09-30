import * as THREE from 'three';
import { ROOM } from './layout.js';

// The seven stations, and the camera rig that glides between them.
// `pos`/`target` are authored for a 16:9 screen; `fit` is the width (m) that must stay
// in view, so on a phone held upright the camera eases back instead of cropping the display.

export const STATIONS = [
  {
    id: 'entrance', stamp: 'enter', name: 'Step inside',
    eyebrow: 'The Increments Lounge', title: 'Take your <em>time.</em>',
    body: 'Life unfolds in increments. Wander the room — every station is a small step, and every step earns a stamp.',
    pos: [5.5, 1.72, 4.9], target: [-2.6, 1.4, -1.7], fit: 9,
    portrait: { pos: [2.5, 1.72, 4.9], target: [-0.7, 1.45, -3.2], fit: 4.4 },
  },
  {
    id: 'window', stamp: 'window', name: 'The Steps',
    eyebrow: 'Now showing', title: '<em>Still</em> Becoming',
    body: 'Three colours, three steps up. Scarlet, Evergreen and Midnight, rising toward the light.',
    pos: [-0.25, 1.85, 5.0], target: [-4.35, 1.8, 2.1], fit: 5.6,
    portrait: { pos: [-0.9, 1.8, 4.9], target: [-4.45, 1.85, 1.55], fit: 4.3 },
  },
  {
    id: 'counter', stamp: 'counter', name: 'The Collection',
    eyebrow: 'Every piece', title: 'The <em>Collection</em>',
    body: 'Every piece and price, carved into the stone. Tap a line to see it. Socks and caps wait at the till.',
    pos: [-0.25, 1.62, 0.9], target: [-0.25, 1.8, -4.4], fit: 5.4,
    portrait: { pos: [-0.35, 1.55, 0.2], target: [-0.35, 1.75, -4.4], fit: 3.4 },
  },
  {
    id: 'lounge', stamp: 'lounge', name: 'The Lounge',
    eyebrow: 'Worn, all day', title: 'Worn in, <em>not worn out</em>',
    body: 'Garment-washed and faded in Cloudstone, Chestnut and Charcoal, hung in the lit niche. Pull up a chair.',
    pos: [2.2, 1.62, 0.5], target: [6.9, 2.0, 0.1], fit: 5.4,
    portrait: { pos: [3.5, 1.62, 0.3], target: [7.2, 2.15, 0.25], fit: 3.1 },
  },
  {
    id: 'movement', stamp: 'movement', name: 'Movement',
    eyebrow: 'For the next step', title: '<em>Movement</em>',
    body: 'Leggings, long sleeves and sets built to move. The fitting rooms are just behind.',
    pos: [-3.1, 1.5, 0.4], target: [-4.4, 1.45, -4.1], fit: 2.9,
    portrait: { pos: [-3.9, 1.5, -0.4], target: [-4.4, 1.5, -4.0], fit: 2.35 },
  },
  {
    id: 'archive', stamp: 'archive', name: 'The Archive',
    eyebrow: 'Past chapters', title: 'The <em>Archive</em>',
    body: 'Every chapter we’ve closed, shelved in the stone. A couple of pieces are still on it.',
    pos: [3.05, 1.7, -0.9], target: [4.25, 2.15, -5.4], fit: 3.6,
    portrait: { pos: [3.6, 1.62, -1.9], target: [4.4, 2.2, -5.4], fit: 2.8 },
  },
  {
    id: 'board', stamp: null, name: 'Notice Board',
    eyebrow: 'Community', title: 'Your next <em>increment</em>',
    body: 'Pin the next small step you’re taking. We’ll turn it into a card you can keep or share.',
    pos: [2.9, 1.58, 2.35], target: [3.55, 1.5, 5.5], fit: 2.7,
    portrait: { pos: [3.35, 1.55, 3.0], target: [3.55, 1.58, 5.5], fit: 2.55 },
  },
];

const ease = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const easeSine = t => -(Math.cos(Math.PI * t) - 1) / 2;
const reduceMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

export class CameraRig {
  constructor(world) {
    this.world = world;
    this.camera = world.camera;
    this.index = 0;
    this.basePos = new THREE.Vector3();
    this.baseLook = new THREE.Vector3();
    this.tween = null;
    this.pointer = new THREE.Vector2();
    this.parallax = new THREE.Vector2();
    this.drift = true;
    world.addEventListener('resize', () => this.#onResize());
    addEventListener('pointermove', e => {
      if (e.pointerType !== 'mouse') return;
      this.pointer.set((e.clientX / innerWidth) * 2 - 1, (e.clientY / innerHeight) * 2 - 1);
    });
    this.#applyProjection();
  }

  get station() { return STATIONS[this.index]; }
  get moving() { return !!this.tween; }

  /** The UI covers the bottom of a phone screen, so shift the view's centre up a touch. */
  #layout() {
    const w = innerWidth, h = innerHeight, aspect = w / h;
    const portrait = aspect < 1;
    const vfov = portrait ? (aspect < 0.6 ? 62 : 58) : aspect < 1.4 ? 50 : 44;
    const k = portrait ? 0.13 : 0.04;
    return { w, h, aspect, portrait, vfov, k };
  }

  #applyProjection() {
    const { w, h, vfov, k } = this.#layout();
    const cam = this.camera;
    const fullH = h * (1 + 2 * k);
    cam.aspect = w / fullH;
    cam.fov = THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(vfov) / 2) * (1 + 2 * k)));
    cam.setViewOffset(w, fullH, 0, 2 * k * h, w, h);
    cam.updateProjectionMatrix();
  }

  #onResize() {
    this.#applyProjection();
    if (!this.tween) {
      const f = this.frameFor(this.station);
      this.basePos.copy(f.pos);
      this.baseLook.copy(f.look);
    }
  }

  frameFor(station) {
    const { aspect, vfov, portrait } = this.#layout();
    // Phones held upright get their own framing where authored.
    const shot = portrait && station.portrait ? { ...station, ...station.portrait } : station;
    const T = new THREE.Vector3(...shot.target);
    const P = new THREE.Vector3(...shot.pos);
    const dir = P.clone().sub(T);
    const d0 = dir.length();
    dir.normalize();
    const hfov = 2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(vfov) / 2) * aspect);
    const dFit = (shot.fit / 2) / Math.tan(hfov / 2);
    const d = Math.min(Math.max(d0, dFit), d0 * (aspect < 1 ? 1.85 : 1.15));
    const pos = T.clone().addScaledVector(dir, d);
    pos.x = THREE.MathUtils.clamp(pos.x, ROOM.x0 + 0.5, ROOM.x1 - 0.5);
    pos.z = THREE.MathUtils.clamp(pos.z, ROOM.z0 + 0.5, ROOM.z1 - 0.4);
    pos.y = THREE.MathUtils.clamp(pos.y, 1.2, 2.3);
    return { pos, look: T };
  }

  jump(index) {
    this.index = index;
    const f = this.frameFor(this.station);
    this.basePos.copy(f.pos);
    this.baseLook.copy(f.look);
    this.tween = null;
  }

  goTo(index) {
    if (index === this.index && !this.tween) return Promise.resolve();
    this.index = index;
    const to = this.frameFor(this.station);
    if (reduceMotion()) { this.jump(index); return Promise.resolve(); }
    const from = { pos: this.basePos.clone(), look: this.baseLook.clone() };
    const dist = from.pos.distanceTo(to.pos);
    const control = from.pos.clone().lerp(to.pos, 0.5);
    control.y += 0.18;
    if (dist > 4) control.lerp(new THREE.Vector3(0, 1.75, 0.6), 0.5);
    const duration = THREE.MathUtils.clamp(0.9 + dist * 0.17, 1.1, 2.3);
    return new Promise(resolve => {
      this.tween?.resolve();
      this.tween = { from, to, control, t: 0, duration, resolve };
    });
  }

  update(dt, t) {
    if (this.tween) {
      const tw = this.tween;
      tw.t = Math.min(1, tw.t + dt / tw.duration);
      const e = ease(tw.t);
      const a = tw.from.pos, c = tw.control, b = tw.to.pos;
      // Quadratic Bézier: arcs through the middle of the room instead of clipping furniture.
      this.basePos.set(
        (1 - e) * (1 - e) * a.x + 2 * (1 - e) * e * c.x + e * e * b.x,
        (1 - e) * (1 - e) * a.y + 2 * (1 - e) * e * c.y + e * e * b.y,
        (1 - e) * (1 - e) * a.z + 2 * (1 - e) * e * c.z + e * e * b.z,
      );
      this.baseLook.lerpVectors(tw.from.look, tw.to.look, easeSine(tw.t));
      if (tw.t >= 1) { this.tween = null; tw.resolve(); }
    }

    // Breathing drift + a little mouse parallax.
    const still = reduceMotion() || !this.drift;
    this.parallax.lerp(this.pointer, Math.min(1, dt * 2.5));
    const cam = this.camera;
    cam.position.copy(this.basePos);
    if (!still) {
      cam.position.x += Math.sin(t * 0.21) * 0.025;
      cam.position.y += Math.sin(t * 0.17 + 1) * 0.012;
    }
    const look = this.baseLook.clone();
    if (!still) {
      const fwd = look.clone().sub(cam.position).normalize();
      const right = new THREE.Vector3().crossVectors(fwd, cam.up).normalize();
      const d = look.distanceTo(cam.position);
      look.addScaledVector(right, this.parallax.x * 0.035 * d);
      look.y -= this.parallax.y * 0.02 * d;
    }
    cam.lookAt(look);
  }
}
