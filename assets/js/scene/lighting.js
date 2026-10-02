import * as THREE from 'three';

// Time of day. The Lounge follows the visitor's clock — morning sun, golden hour,
// then evening when the sun is gone and the hidden lights carry the room — and the
// visitor can pick one from the Atmosphere panel.
//
// Each preset drives the live lights (for furniture and garments), the street outside,
// the skylight, the cove, the light shafts and which baked lightmap set is shown.

export const TIMES = {
  morning: {
    label: 'Morning',
    // Sun high enough (~37°) that its patches and the olive's shadow stay round the Steps.
    sun: { position: [-15, 12.4, 6.5], color: 0xffe0b8, intensity: 4.4 },
    hemi: { sky: 0xfff0db, ground: 0xdcc4a0, intensity: 0.7 },
    fill: 0.26,
    exposure: 1.02,
    env: 0.45,
    glow: 0.4,
    background: 0xe9dfd0,
    sky: { pane: 0xfffaf1, color: 0xfff3e4, intensity: 34 },
    cove: { color: 0xffeccf, wash: 0.44 },
    interior: 1.0,
    shafts: { opacity: 0.07, color: 0xffdcae },
    dust: 1,
    street: 'morning',
    // What the lightmap baker uses for this time (see tools/bake.html).
    bake: { skyColor: 0xfff4e6, sky: 2.6, skylight: 3.2, cove: 7, coveColor: 0xffe6c4, bounce: 0.3, ambient: 0.6, ceiling: 128, ceilingColor: 0xffe9cf },
  },
  golden: {
    label: 'Golden hour',
    // Low and warm (~21°): long light across the floor without the tree's shadow crossing the room.
    sun: { position: [-16, 6.3, 2.2], color: 0xffae62, intensity: 5.4 },
    hemi: { sky: 0xffdcb4, ground: 0xcfa982, intensity: 0.55 },
    fill: 0.2,
    exposure: 1.0,
    env: 0.38,
    glow: 0.7,
    background: 0xe6d2bd,
    sky: { pane: 0xffe2b4, color: 0xffd6a0, intensity: 22 },
    cove: { color: 0xffe4bf, wash: 0.5 },
    interior: 1.15,
    shafts: { opacity: 0.11, color: 0xffc27a },
    dust: 1.25,
    street: 'golden',
    bake: { skyColor: 0xffdcb8, sky: 1.9, skylight: 2.2, cove: 8, coveColor: 0xffdcb0, bounce: 0.3, ambient: 0.6, ceiling: 128, ceilingColor: 0xffe2c0 },
  },
  evening: {
    label: 'Evening',
    sun: null,
    hemi: { sky: 0x33405a, ground: 0x5c4838, intensity: 0.34 },
    fill: 0.08,
    // More of the room's own glow on the furniture (it reads as the ceiling lights catching
    // it), a touch less exposure overall: same dim evening, but the pieces no longer sit dark
    // on a bright floor.
    exposure: 1.04,
    env: 0.28,
    glow: 1.15,
    background: 0x1c1b1f,
    sky: { pane: 0x55648a, color: 0x8ea2cf, intensity: 7 },
    cove: { color: 0xffe2b8, wash: 0.66 },
    interior: 1.8,
    shafts: { opacity: 0, color: 0xffc27a },
    dust: 0.25,
    street: 'evening',
    bake: { skyColor: 0x6a7aa0, sky: 0.35, skylight: 0.6, cove: 11, coveColor: 0xffd6a4, bounce: 0.3, ambient: 0.6, ceiling: 145, ceilingColor: 0xffdcb2 },
  },
};

export const TIME_ORDER = ['morning', 'golden', 'evening'];

export function timeForClock(date = new Date()) {
  const h = date.getHours();
  if (h >= 5 && h < 12) return 'morning';
  if (h >= 12 && h < 19) return 'golden';
  return 'evening';
}

const PREF = 'increments-lounge:time';
export function savedTimePreference() {
  try { return localStorage.getItem(PREF) || 'auto'; } catch { return 'auto'; }
}
export function saveTimePreference(value) {
  try { localStorage.setItem(PREF, value); } catch { /* ignore */ }
}
export function resolveTime(pref = savedTimePreference()) {
  const q = new URLSearchParams(location.search).get('time');
  if (q && TIMES[q]) return q;
  return pref !== 'auto' && TIMES[pref] ? pref : timeForClock();
}

/**
 * Owns every light-related knob in the room and fades between presets.
 * `refs` come from room.js (sun, hemi, fill, skylight, cove, washes, street), furniture
 * anchors (interior lights) and fx (shafts & dust).
 */
export class Lighting {
  constructor({ world, room, anchors, fx, lightmaps, glows = [] }) {
    // Signs, sconces, LED lines and lit windows: faint by day, full at night.
    this.glows = glows;
    this.world = world;
    this.room = room;
    this.fx = fx;
    this.lightmaps = lightmaps;
    this.interior = anchors.lights.map(l => ({ light: l, base: l.intensity }));
    this.current = null;
    this.fade = null;
    this.streets = {};
  }

  apply(name, { instant = false } = {}) {
    const p = TIMES[name] || TIMES.morning;
    const r = this.room;
    const from = this.#snapshot();
    const to = {
      sun: p.sun ? p.sun.intensity : 0,
      sunColor: new THREE.Color(p.sun ? p.sun.color : 0xffffff),
      hemi: p.hemi.intensity, hemiSky: new THREE.Color(p.hemi.sky), hemiGround: new THREE.Color(p.hemi.ground),
      fill: p.fill,
      exposure: p.exposure,
      env: p.env ?? 0.45,
      glow: p.glow ?? 1,
      background: new THREE.Color(p.background),
      pane: new THREE.Color(p.sky.pane), skyColor: new THREE.Color(p.sky.color), skyI: p.sky.intensity,
      cove: new THREE.Color(p.cove.color), wash: p.cove.wash,
      interior: p.interior,
      shafts: p.shafts.opacity, shaftColor: new THREE.Color(p.shafts.color),
      dust: p.dust,
    };
    // Things that can't fade: sun direction (moves the shafts), the street outside, lightmaps.
    if (p.sun) {
      r.sun.position.set(...p.sun.position);
      this.fx?.setSun(r.sun.position, r.sun.target.position);
    }
    // The sun's shadow stays on even in the evening (at zero intensity it costs nothing visible):
    // turning it off up front let the fading sun light the room through its walls for a second,
    // and toggling it recompiles every shader — a hitch on phones.
    this.#street(p.street);
    const ready = this.lightmaps?.use(name) ?? Promise.resolve(false);
    this.world.renderer.shadowMap.needsUpdate = true;
    this.current = name;
    document.documentElement.dataset.time = name;
    if (instant || matchMedia('(prefers-reduced-motion: reduce)').matches) this.#set(to, 1, to);
    else this.fade = { from, to, t: 0 };
    return ready;
  }

  update(dt) {
    if (!this.fade) return;
    this.fade.t = Math.min(1, this.fade.t + dt / 1.4);
    const e = this.fade.t * this.fade.t * (3 - 2 * this.fade.t);
    this.#set(this.fade.from, e, this.fade.to);
    if (this.fade.t >= 1) this.fade = null;
  }

  #snapshot() {
    const r = this.room;
    return {
      sun: r.sun.intensity, sunColor: r.sun.color.clone(),
      hemi: r.hemi.intensity, hemiSky: r.hemi.color.clone(), hemiGround: r.hemi.groundColor.clone(),
      fill: r.fill.intensity,
      exposure: this.world.renderer.toneMappingExposure,
      env: this.world.scene.environmentIntensity ?? 0.45,
      glow: this.glowLevel ?? 1,
      background: this.world.scene.background.clone(),
      pane: r.skyPane.material.color.clone(), skyColor: r.skyLight.color.clone(), skyI: r.skyLight.intensity,
      cove: r.cove.material.color.clone(), wash: r.washMat.opacity,
      interior: this.interiorScale ?? 1,
      shafts: this.fx?.shaftOpacity ?? 0, shaftColor: this.fx?.shaftColor?.clone() ?? new THREE.Color(),
      dust: this.fx?.dustLevel ?? 1,
    };
  }

  #set(a, e, b) {
    const r = this.room, lerp = (x, y) => x + (y - x) * e;
    const col = (target, x, y) => target.copy(x).lerp(y, e);
    r.sun.intensity = lerp(a.sun, b.sun);
    col(r.sun.color, a.sunColor, b.sunColor);
    r.hemi.intensity = lerp(a.hemi, b.hemi);
    col(r.hemi.color, a.hemiSky, b.hemiSky);
    col(r.hemi.groundColor, a.hemiGround, b.hemiGround);
    r.fill.intensity = lerp(a.fill, b.fill);
    this.world.renderer.toneMappingExposure = lerp(a.exposure, b.exposure);
    this.world.scene.environmentIntensity = lerp(a.env, b.env);
    this.glowLevel = lerp(a.glow, b.glow);
    for (const m of this.glows) {
      const k = Math.max(this.glowLevel, m.userData.glowMin ?? 0);
      if (m.userData.glowBase != null) m.opacity = Math.min(1, m.userData.glowBase * k);
      else if (m.userData.glowEmissive != null) m.emissiveIntensity = m.userData.glowEmissive * k;
      else if (m.userData.glowColor) m.color.setRGB(1, 0.906, 0.769).multiplyScalar(0.72 + 0.28 * Math.min(1, k));
    }
    col(this.world.scene.background, a.background, b.background);
    this.world.scene.fog?.color.copy(this.world.scene.background);
    col(r.skyPane.material.color, a.pane, b.pane);
    col(r.skyLight.color, a.skyColor, b.skyColor);
    r.skyLight.intensity = lerp(a.skyI, b.skyI);
    col(r.cove.material.color, a.cove, b.cove);
    r.washMat.opacity = lerp(a.wash, b.wash);
    this.interiorScale = lerp(a.interior, b.interior);
    for (const { light, base } of this.interior) light.intensity = base * this.interiorScale;
    this.fx?.setAtmosphere({ shafts: lerp(a.shafts, b.shafts), shaftColor: a.shaftColor.clone().lerp(b.shaftColor, e), dust: lerp(a.dust, b.dust) });
  }

  #street(name) {
    const r = this.room;
    if (!this.streets[name]) {
      const t = new THREE.CanvasTexture(streetCanvas(name));
      t.colorSpace = THREE.SRGBColorSpace;
      this.streets[name] = t;
    }
    const old = r.street.map;
    if (old && old !== this.streets[name] && !Object.values(this.streets).includes(old)) old.dispose(); // room.js's first one
    r.street.map = this.streets[name];
    r.street.needsUpdate = true;
  }
}

/** The street outside the windows and door, at three times of day. */
export function streetCanvas(name = 'morning') {
  const c = document.createElement('canvas');
  c.width = 1024; c.height = 512;
  const ctx = c.getContext('2d');
  const rand = mulberry(name.length * 97);
  const P = {
    morning: { sky: ['#fbf6ee', '#f7ecdc', '#efe0c9'], facade: 'rgba(232,218,196,0.9)', win: 'rgba(214,196,168,0.55)', tree: '150,160,128', haze: [0.2, 0.55, 0.3] },
    golden: { sky: ['#f8e2c4', '#f4c894', '#e9b27c'], facade: 'rgba(226,190,150,0.92)', win: 'rgba(196,150,108,0.55)', tree: '128,120,86', haze: [0.15, 0.45, 0.25] },
    evening: { sky: ['#1d2436', '#2f3a55', '#4a4a5c'], facade: 'rgba(52,50,58,0.95)', win: 'rgba(255,196,128,0.85)', tree: '26,30,34', haze: [0.05, 0.12, 0.08] },
  }[name] || null;
  const p = P || { sky: ['#fbf6ee', '#f7ecdc', '#efe0c9'], facade: 'rgba(232,218,196,0.9)', win: 'rgba(214,196,168,0.55)', tree: '150,160,128', haze: [0.2, 0.55, 0.3] };
  const sky = ctx.createLinearGradient(0, 0, 0, 512);
  sky.addColorStop(0, p.sky[0]); sky.addColorStop(0.55, p.sky[1]); sky.addColorStop(1, p.sky[2]);
  ctx.fillStyle = sky; ctx.fillRect(0, 0, 1024, 512);
  ctx.fillStyle = p.facade; ctx.fillRect(0, 150, 1024, 362);
  for (let x = 30; x < 1024; x += 150) {
    for (const y of [200, 330]) {
      const lit = name !== 'evening' || rand() < 0.7;
      ctx.fillStyle = lit ? p.win : 'rgba(30,30,36,0.9)';
      ctx.fillRect(x, y, 60, 90);
    }
  }
  if (name === 'evening') {
    // Street lamps.
    for (let x = 100; x < 1024; x += 260) {
      const g = ctx.createRadialGradient(x, 300, 0, x, 300, 90);
      g.addColorStop(0, 'rgba(255,214,150,0.9)'); g.addColorStop(1, 'rgba(255,214,150,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, 300, 90, 0, Math.PI * 2); ctx.fill();
    }
  }
  for (let i = 0; i < 40; i++) {
    const x = rand() * 1024, y = 120 + rand() * 160, r = 40 + rand() * 90, a = 0.18 + rand() * 0.2;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(${p.tree},${a})`); g.addColorStop(1, `rgba(${p.tree},0)`);
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  }
  const haze = ctx.createLinearGradient(0, 0, 0, 512);
  const hz = name === 'evening' ? '120,130,170' : '255,248,236';
  haze.addColorStop(0, `rgba(${hz},${p.haze[0]})`); haze.addColorStop(0.7, `rgba(${hz},${p.haze[1]})`); haze.addColorStop(1, `rgba(${hz},${p.haze[2]})`);
  ctx.fillStyle = haze; ctx.fillRect(0, 0, 1024, 512);
  return c;
}

function mulberry(seed) {
  let a = seed;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
