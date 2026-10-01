import * as THREE from 'three';
import { ROOM, STREET, STEPS, COUNTER, BANQUETTE, MOVEMENT_RACK, ARCHIVE_SHELF, NOTICE_BOARD } from './layout.js';

// The seven stations, and the camera rig that glides between them.
// `pos`/`target` are authored for a 16:9 screen; `fit` is the width (m) that must stay
// in view, so on a phone held upright the camera eases back instead of cropping the display.
// Each shot is set relative to the piece it looks at, so moving a piece in layout.js moves its shot.

const near = (o, dx, y, dz, z = o.z) => [o.x + dx, y, z + dz];

export const STATIONS = [
  {
    id: 'entrance', stamp: 'enter', name: 'Step inside',
    eyebrow: 'The Increments Lounge', title: 'Take your <em>time.</em>',
    body: 'Life unfolds in increments. Wander the room — every station is a small step, and every step earns a stamp.',
    pos: [ROOM.x1 - 1.7, 1.75, 3.1], target: [-3.6, 1.5, -2.2], fit: 11,
    portrait: { pos: [3.0, 1.72, ROOM.z1 - 0.6], target: [-1.0, 1.45, -3.6], fit: 5 },
  },
  {
    id: 'window', stamp: 'window', name: 'The Steps',
    eyebrow: 'Now showing', title: '<em>Still</em> Becoming',
    body: 'Three colours, three steps up. Scarlet, Evergreen and Midnight, rising toward the light.',
    pos: near(STEPS, 4.1, 1.85, 2.9), target: near(STEPS, 0, 1.8, 0), fit: 5.6,
    portrait: { pos: near(STEPS, 3.45, 1.8, 2.8), target: near(STEPS, -0.1, 1.85, -0.55), fit: 4.3 },
  },
  {
    id: 'counter', stamp: 'counter', name: 'The Collection',
    eyebrow: 'Every piece', title: 'The <em>Collection</em>',
    body: 'Every piece and price, carved into the stone. Tap a line to see it. Socks and caps wait at the till.',
    pos: near(COUNTER, 0, 1.62, 4.1), target: near(COUNTER, 0, 1.8, -1.2), fit: 5.4,
    portrait: { pos: near(COUNTER, -0.1, 1.55, 3.4), target: near(COUNTER, -0.1, 1.75, -1.2), fit: 3.4 },
  },
  {
    id: 'lounge', stamp: 'lounge', name: 'The Lounge',
    eyebrow: 'Worn, all day', title: 'Worn in, <em>not worn out</em>',
    body: 'Garment-washed and faded in Cloudstone, Chestnut and Charcoal, hung in the lit niche. Pull up a chair.',
    pos: near(BANQUETTE, -4.42, 1.62, 0.4), target: near(BANQUETTE, 0.28, 2.0, 0), fit: 5.4,
    portrait: { pos: near(BANQUETTE, -3.12, 1.62, 0.2), target: near(BANQUETTE, 0.58, 2.15, 0.15), fit: 3.1 },
  },
  {
    id: 'movement', stamp: 'movement', name: 'Movement',
    eyebrow: 'For the next step', title: '<em>Movement</em>',
    body: 'Leggings, long sleeves and sets built to move. The fitting rooms are just behind.',
    pos: near(MOVEMENT_RACK, 1.3, 1.5, 3.6), target: near(MOVEMENT_RACK, 0, 1.45, -0.9), fit: 2.9,
    portrait: { pos: near(MOVEMENT_RACK, 0.5, 1.5, 2.8), target: near(MOVEMENT_RACK, 0, 1.5, -0.8), fit: 2.35 },
  },
  {
    id: 'archive', stamp: 'archive', name: 'The Archive',
    eyebrow: 'Past chapters', title: 'The <em>Archive</em>',
    body: 'Every chapter we’ve closed, shelved in the stone. A couple of pieces are still on it.',
    pos: near(ARCHIVE_SHELF, -1.2, 1.7, 4.6, ROOM.z0), target: near(ARCHIVE_SHELF, 0, 2.15, 0.1, ROOM.z0), fit: 3.6,
    portrait: { pos: near(ARCHIVE_SHELF, -0.65, 1.62, 3.6, ROOM.z0), target: near(ARCHIVE_SHELF, 0.15, 2.2, 0.1, ROOM.z0), fit: 2.8 },
  },
  {
    id: 'board', stamp: null, name: 'Notice Board',
    eyebrow: 'Community', title: 'Your next <em>increment</em>',
    body: 'Pin the next small step you’re taking and keep it as a card. Share it, and once the team has read it, it goes up here for everyone.',
    pos: near(NOTICE_BOARD, -0.25, 1.62, -3.71), target: near(NOTICE_BOARD, 0, 1.98, 0.04), fit: 3.7,
    portrait: { pos: near(NOTICE_BOARD, -0.2, 1.62, -2.86), target: near(NOTICE_BOARD, -0.18, 1.92, 0.04), fit: 2.5 }, // neon, invitation and visitors' notes; drag for the rest
  },
];

const ease = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const easeSine = t => -(Math.cos(Math.PI * t) - 1) / 2;
const ZERO2 = new THREE.Vector2();
const reduceMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

// Look-around limits and feel.
const LOOK = {
  maxYaw: THREE.MathUtils.degToRad(38),
  maxPitch: THREE.MathUtils.degToRad(16),
  perPx: 0.0042,           // radians per pixel dragged
  settleAfter: 1600,       // ms of stillness before the view drifts home
  pullToStep: 70,          // px dragged past the edge that means "next station"
};

export class CameraRig {
  constructor(world) {
    this.world = world;
    this.camera = world.camera;
    this.index = 0;
    this.basePos = new THREE.Vector3();
    this.baseLook = new THREE.Vector3();
    this.tween = null;
    this.focused = null;      // lean-in state
    this.push = 0;            // slow push-in used by the walk
    this.pointer = new THREE.Vector2();
    this.parallax = new THREE.Vector2();
    this.drift = true;
    this.look = { yaw: 0, pitch: 0, tYaw: 0, tPitch: 0, over: 0, dragging: false, last: 0 };
    this._q = new THREE.Quaternion();
    world.addEventListener('resize', () => this.#onResize());
    addEventListener('pointermove', e => {
      if (e.pointerType !== 'mouse') return;
      this.pointer.set((e.clientX / innerWidth) * 2 - 1, (e.clientY / innerHeight) * 2 - 1);
    });
    this.#applyProjection();
  }

  get station() { return STATIONS[this.index]; }
  get moving() { return !!this.tween; }
  get portrait() { return this.#layout().portrait; }

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
    if (!this.tween && !this.focused) {
      const f = this.frameFor(this.outside ? { ...STREET, outside: true } : this.station);
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
    if (!station.outside) clampToRoom(pos);
    return { pos, look: T };
  }

  jump(index) {
    this.index = index;
    this.outside = false;
    const f = this.frameFor(this.station);
    this.basePos.copy(f.pos);
    this.baseLook.copy(f.look);
    this.tween = null;
    this.focused = null;
    this.push = 0;
    this.resetLook();
  }

  /** Stand on the pavement outside, looking at the door. */
  street() {
    this.jump(0);
    this.outside = true;
    const f = this.frameFor({ ...STREET, outside: true });
    this.basePos.copy(f.pos);
    this.baseLook.copy(f.look);
  }

  /**
   * From the street, through the door, to the entrance shot — one continuous, unhurried
   * move. `via` gives the points just outside and just inside the door; `onProgress(t)`
   * lets the door swing open as you reach it.
   */
  walkIn({ via, duration = 4.8, onProgress } = {}) {
    const to = this.frameFor(STATIONS[0]);
    this.index = 0;
    if (reduceMotion() || !via) { this.jump(0); onProgress?.(1); return Promise.resolve(); }
    const doorPlane = via.doorOut.clone().setZ(ROOM.z1 + ROOM.t / 2);
    const curve = new THREE.CatmullRomCurve3([this.basePos.clone(), via.doorOut, doorPlane, via.doorIn, to.pos], false, 'centripetal');
    const looks = new THREE.CatmullRomCurve3([
      this.baseLook.clone(),
      new THREE.Vector3(doorPlane.x, 1.8, ROOM.z1 - 1.5),
      new THREE.Vector3(-0.6, 1.62, 0.4),
      new THREE.Vector3(-1.9, 1.5, -1.0),
      to.look,
    ], false, 'centripetal');
    this.#settlePush();
    return new Promise(resolve => {
      this.tween?.resolve();
      this.tween = { path: curve, looks, t: 0, duration, resolve, onProgress, from: { pos: this.basePos.clone(), look: this.baseLook.clone() }, to: { pos: to.pos, look: to.look } };
    }).then(() => { this.outside = false; });
  }

  /** Glide to a station. `slow` stretches the move for the guided walk. */
  goTo(index, { slow = 1 } = {}) {
    if (index === this.index && !this.tween && !this.focused) return Promise.resolve();
    this.index = index;
    this.focused = null;
    this.resetLook(true);
    const to = this.frameFor(this.station);
    if (reduceMotion()) { this.jump(index); return Promise.resolve(); }
    const dist = this.basePos.distanceTo(to.pos);
    const duration = THREE.MathUtils.clamp(0.9 + dist * 0.17, 1.1, 2.3) * slow;
    return this.#tweenTo(to.pos, to.look, { duration, arc: dist > 4 });
  }

  /**
   * Lean in: walk up to a piece before its details open. The piece is framed in the part of
   * the screen the details leave clear — left of the side panel on wide screens, above the
   * peek sheet on phones — at whatever distance makes it fit there.
   */
  focusOn(point, normal, { dims = new THREE.Vector3(0.8, 0.8, 0.8) } = {}) {
    const cam = this.camera;
    const n = normal.clone().setY(0);
    if (n.lengthSq() < 1e-4) n.copy(cam.position).sub(point).setY(0);
    n.normalize();
    if (n.dot(cam.position.clone().sub(point)) < 0) n.negate();

    const { w, aspect, vfov, k } = this.#layout();
    const tanV = Math.tan(THREE.MathUtils.degToRad(vfov) / 2), tanH = tanV * aspect;
    // Screen fractions (from the top-left) left clear by the product details; see lounge.css.
    const region = w >= 900
      ? { x0: 0.04, x1: (w - 440) / w - 0.03, y0: 0.12, y1: 0.88 }
      : { x0: 0.08, x1: 0.92, y0: 0.08, y1: 0.39 };
    const fill = 0.8;
    const pieceW = Math.max(dims.x, dims.z), pieceH = dims.y;
    const want = Math.max(
      pieceW / (2 * fill * (region.x1 - region.x0) * tanH),
      pieceH / (2 * fill * (region.y1 - region.y0) * tanV),
    );
    const pos = point.clone().addScaledVector(n, THREE.MathUtils.clamp(want, 0.75, 3.2));
    pos.y = THREE.MathUtils.clamp(point.y, 1.1, 2.4);
    clampToRoom(pos);

    // Aim so the piece lands in the middle of that region. (The rig's view offset already
    // puts the aim point k above the screen's centre.)
    const d = pos.distanceTo(point);
    const cx = (region.x0 + region.x1) / 2, cy = (region.y0 + region.y1) / 2;
    const fwd = point.clone().sub(pos).setY(0).normalize();
    const right = new THREE.Vector3().crossVectors(fwd, cam.up).normalize();
    const look = point.clone().addScaledVector(right, (0.5 - cx) * 2 * d * tanH);
    look.y -= ((0.5 - k) - cy) * 2 * d * tanV;

    this.focused = { point: point.clone() };
    this.resetLook(true);
    if (reduceMotion()) { this.basePos.copy(pos); this.baseLook.copy(look); return Promise.resolve(); }
    return this.#tweenTo(pos, look, { duration: 0.95 });
  }

  /** Step back out to the station after a lean-in. */
  unfocus() {
    if (!this.focused) return Promise.resolve();
    this.focused = null;
    const f = this.frameFor(this.station);
    if (reduceMotion()) { this.basePos.copy(f.pos); this.baseLook.copy(f.look); return Promise.resolve(); }
    return this.#tweenTo(f.pos, f.look, { duration: 0.9 });
  }

  #tweenTo(pos, look, { duration, arc = false }) {
    this.#settlePush();
    const from = { pos: this.basePos.clone(), look: this.baseLook.clone() };
    const control = from.pos.clone().lerp(pos, 0.5);
    control.y += arc ? 0.18 : 0.05;
    if (arc) control.lerp(new THREE.Vector3(0, 1.75, 0.6), 0.5);
    return new Promise(resolve => {
      this.tween?.resolve();
      this.tween = { from, to: { pos: pos.clone(), look: look.clone() }, control, t: 0, duration, resolve };
    });
  }

  /** The walk's slow push-in becomes where the camera stands, so the next move starts from there. */
  #settlePush() {
    if (!this.push) return;
    const fwd = this.baseLook.clone().sub(this.basePos).normalize();
    this.basePos.addScaledVector(fwd, this.push);
    this.push = 0;
  }

  // --- Look-around ------------------------------------------------------------------

  resetLook(soft = false) {
    const L = this.look;
    L.tYaw = 0; L.tPitch = 0; L.over = 0; L.dragging = false;
    if (!soft) { L.yaw = 0; L.pitch = 0; }
  }

  dragStart() {
    if (this.tween || this.focused) return false;
    this.look.dragging = true;
    this.look.over = 0;
    return true;
  }

  /** Content follows the finger: drag right to look left. Past the edge, the pull is remembered. */
  dragBy(dx, dy) {
    const L = this.look;
    if (!L.dragging) return;
    L.last = performance.now();
    const want = L.tYaw + dx * LOOK.perPx;
    if (Math.abs(want) > LOOK.maxYaw) {
      L.over += (want - Math.sign(want) * LOOK.maxYaw) / LOOK.perPx;
      L.tYaw = Math.sign(want) * LOOK.maxYaw;
    } else {
      if (L.over && Math.sign(dx) !== Math.sign(L.over)) L.over = Math.abs(L.over) < Math.abs(dx) ? 0 : L.over + dx;
      L.tYaw = want;
    }
    L.tPitch = THREE.MathUtils.clamp(L.tPitch + dy * LOOK.perPx * 0.8, -LOOK.maxPitch, LOOK.maxPitch);
  }

  /** @returns -1 / 1 when the drag pulled past the edge far enough to move on, else 0. */
  dragEnd() {
    const L = this.look;
    if (!L.dragging) return 0;
    L.dragging = false;
    L.last = performance.now();
    const pulled = Math.abs(L.over) > LOOK.pullToStep ? -Math.sign(L.over) : 0;
    L.over = 0;
    return pulled;
  }

  update(dt, t) {
    if (this.tween?.path) {
      const tw = this.tween;
      tw.t = Math.min(1, tw.t + dt / tw.duration);
      const e = easeSine(tw.t);
      tw.path.getPoint(e, this.basePos);
      tw.looks.getPoint(Math.min(1, e * 1.04), this.baseLook);
      tw.onProgress?.(tw.t);
      if (tw.t >= 1) { this.tween = null; tw.resolve(); }
    } else if (this.tween) {
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

    // Look-around: ease toward the target; drift home after a pause.
    const L = this.look;
    if (!L.dragging && performance.now() - L.last > LOOK.settleAfter) {
      L.tYaw *= Math.max(0, 1 - dt * 1.4);
      L.tPitch *= Math.max(0, 1 - dt * 1.4);
    }
    const rubber = L.dragging && L.over ? Math.sign(L.over) * Math.min(0.12, Math.abs(L.over) * 0.0012) : 0;
    const k = reduceMotion() ? 1 : Math.min(1, dt * 7);
    L.yaw += (L.tYaw + rubber - L.yaw) * k;
    L.pitch += (L.tPitch - L.pitch) * k;

    const still = reduceMotion() || !this.drift;
    this.parallax.lerp(L.dragging ? ZERO2 : this.pointer, Math.min(1, dt * 2.5));
    const cam = this.camera;
    cam.position.copy(this.basePos);
    const fwd = this.baseLook.clone().sub(this.basePos);
    const dist = fwd.length();
    fwd.normalize();
    if (this.push) cam.position.addScaledVector(fwd, this.push);
    if (!still && !this.focused) {
      cam.position.x += Math.sin(t * 0.21) * 0.025;
      cam.position.y += Math.sin(t * 0.17 + 1) * 0.012;
    }
    // Rotate the gaze by the look-around yaw (around up) and pitch (around the camera's right).
    if (L.yaw || L.pitch) {
      this._q.setFromAxisAngle(cam.up, L.yaw);
      fwd.applyQuaternion(this._q);
      const right = new THREE.Vector3().crossVectors(fwd, cam.up).normalize();
      this._q.setFromAxisAngle(right, L.pitch);
      fwd.applyQuaternion(this._q);
    }
    const look = cam.position.clone().addScaledVector(fwd, dist);
    if (!still && !this.focused) {
      const right = new THREE.Vector3().crossVectors(fwd, cam.up).normalize();
      look.addScaledVector(right, this.parallax.x * 0.035 * dist);
      look.y -= this.parallax.y * 0.02 * dist;
    }
    cam.lookAt(look);
  }
}

function clampToRoom(pos) {
  pos.x = THREE.MathUtils.clamp(pos.x, ROOM.x0 + 0.5, ROOM.x1 - 0.5);
  pos.z = THREE.MathUtils.clamp(pos.z, ROOM.z0 + 0.5, ROOM.z1 - 0.4);
  pos.y = THREE.MathUtils.clamp(pos.y, 1.1, 2.4);
  return pos;
}
