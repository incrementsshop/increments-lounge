import * as THREE from 'three';
import { mesh, box, cyl, lathe, place, group, contactShadow, canvasTexture } from './helpers.js';
import { applyBoxUV } from './materials.js';
import { seeded } from './stone.js';
import * as L from './layout.js';
import { olive, bistroChair, coffeeCup, espressoMachine, pampasVase, wheatRow } from './pieces.js';
import { storefront } from './storefront.js';
import { neonText, pillSign } from './signs.js';

// Everything that stands in the room. Products go on/in these pieces later
// (displays.js) via the `anchors` each builder records.

const H = L.ROOM.h;
const DEG = Math.PI / 180;

export function buildFurniture(scene, M, quality) {
  const root = new THREE.Group();
  root.name = 'furniture';
  scene.add(root);
  const A = { steam: [], lights: [], glows: [], floorDecals: [] };

  root.add(featureWall(M, A));
  root.add(counter(M, A));
  root.add(theSteps(M, A, quality));
  root.add(fittingRooms(M, A));
  root.add(movement(M, A));
  root.add(lounge(M, A));
  root.add(archive(M, A));
  root.add(noticeBoard(M, A));
  root.add(island(M, A));
  root.add(roomLights(A));
  root.add(plants(M));
  root.add(storefront(M, A, quality));
  root.add(sails(M));
  root.add(drapes(M));
  root.add(wordsInLight(M, A));
  root.add(entryInlay(M, A));
  return { root, anchors: A };
}
export default buildFurniture;

// ---------------------------------------------------------------------------
// Shared pieces
// ---------------------------------------------------------------------------

function book(M, w, h, d, color) {
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.8 });
  const b = box(w, h, d, mat);
  const pages = box(w * 0.96, h * 0.8, d * 0.97, new THREE.MeshStandardMaterial({ color: 0xf2ead9, roughness: 0.9 }));
  pages.position.x = 0.002;
  return group(b, pages);
}

function vase(M, material, scale = 1, stems = 0) {
  const g = group(lathe([[0, 0], [0.05, 0], [0.075, 0.06], [0.07, 0.16], [0.035, 0.22], [0.03, 0.26], [0.036, 0.27], [0, 0.26]].map(([r, y]) => [r * scale, y * scale]), material, { segments: 28 }));
  const twig = new THREE.MeshStandardMaterial({ color: 0x8a6a4a, roughness: 1 });
  const bud = new THREE.MeshStandardMaterial({ color: 0xd9c7a4, roughness: 1 });
  for (let i = 0; i < stems; i++) {
    const a = (i / stems) * Math.PI * 2, lean = 0.12 + Math.random() * 0.15, len = (0.5 + Math.random() * 0.35) * scale;
    const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0.2 * scale, 0), new THREE.Vector3(Math.cos(a) * lean * 0.4, 0.2 * scale + len * 0.5, Math.sin(a) * lean * 0.4), new THREE.Vector3(Math.cos(a) * lean, 0.2 * scale + len, Math.sin(a) * lean)]);
    const t = new THREE.Mesh(new THREE.TubeGeometry(curve, 8, 0.004, 5), twig);
    t.castShadow = true;
    g.add(t);
    for (let k = 0; k < 6; k++) {
      const b = new THREE.Mesh(new THREE.SphereGeometry(0.012 * scale, 6, 5), bud);
      b.position.copy(curve.getPoint(0.45 + k * 0.09)).add(new THREE.Vector3((Math.random() - 0.5) * 0.03, 0, (Math.random() - 0.5) * 0.03));
      b.scale.set(1, 1.8, 1);
      g.add(b);
    }
  }
  return g;
}

/** A paper shopping bag with rope handles and the wordmark. */
function shoppingBag(M) {
  const tex = canvasTexture(256, 320, (ctx, w, h) => {
    ctx.fillStyle = '#efe6d6'; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#2a1d16'; ctx.textAlign = 'center';
    ctx.font = '500 24px "Bodoni Moda", serif'; ctx.letterSpacing = '7px';
    ctx.fillText('INCREMENTS', w / 2 + 3, 150);
    ctx.letterSpacing = '0px';
    ctx.font = 'italic 17px "Bodoni Moda", serif';
    ctx.fillStyle = '#6c5746';
    ctx.fillText('Life unfolds in increments.', w / 2, 186);
  });
  const face = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9 });
  const plain = new THREE.MeshStandardMaterial({ color: 0xefe6d6, roughness: 0.9 });
  const b = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.32, 0.1), [plain, plain, plain, plain, face, plain]);
  b.position.y = 0.16;
  b.castShadow = b.receiveShadow = true;
  const rope = new THREE.MeshStandardMaterial({ color: 0xb9a282, roughness: 1 });
  const g = group(b);
  for (const dz of [-0.03, 0.03]) {
    const handle = new THREE.Mesh(new THREE.TorusGeometry(0.055, 0.004, 6, 18, Math.PI), rope);
    handle.position.set(0, 0.32, dz);
    g.add(handle);
  }
  return g;
}

/** 3D value noise for chiselled stone. */
function valueNoise3(seed) {
  const r = seeded(seed);
  const perm = new Uint8Array(512), vals = new Float32Array(256);
  for (let i = 0; i < 256; i++) { perm[i] = i; vals[i] = r(); }
  for (let i = 255; i > 0; i--) { const j = (r() * (i + 1)) | 0; [perm[i], perm[j]] = [perm[j], perm[i]]; }
  for (let i = 0; i < 256; i++) perm[i + 256] = perm[i];
  const f = t => t * t * (3 - 2 * t);
  const v = (x, y, z) => vals[perm[perm[perm[x & 255] + (y & 255)] + (z & 255)]];
  return (x, y, z) => {
    const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
    const tx = f(x - xi), ty = f(y - yi), tz = f(z - zi);
    const l = (a, b, t) => a + (b - a) * t;
    return l(
      l(l(v(xi, yi, zi), v(xi + 1, yi, zi), tx), l(v(xi, yi + 1, zi), v(xi + 1, yi + 1, zi), tx), ty),
      l(l(v(xi, yi, zi + 1), v(xi + 1, yi, zi + 1), tx), l(v(xi, yi + 1, zi + 1), v(xi + 1, yi + 1, zi + 1), tx), ty),
      tz);
  };
}

/**
 * A rough-hewn stone block: chiselled sides, a crisp honed top edge. Displacement depends
 * only on position, so the box's split vertices move together and no seams open up.
 */
function roughBlock(w, h, d, material, { seed = 3, amp = 0.03 } = {}) {
  const seg = v => Math.max(2, Math.round(v * 18));
  const g = new THREE.BoxGeometry(w, h, d, seg(w), seg(h), seg(d));
  const p = g.attributes.position;
  const n3 = valueNoise3(seed);
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const k = THREE.MathUtils.smoothstep(h / 2 - y, 0, 0.05);
    if (k <= 0) continue;
    const n = n3(x * 3.2 + 7, y * 3.2, z * 3.2) * 0.6 + n3(x * 11, y * 11 + 3, z * 11) * 0.4;
    const chisel = Math.sin(y * 42 + n3(x * 2, 1, z * 2) * 7) * 0.12;
    const disp = (n - 0.5 + chisel) * 2 * amp * k;
    const dx = x / w, dz = z / d, len = Math.hypot(dx, dz) || 1;
    p.setX(i, x + (dx / len) * disp);
    p.setZ(i, z + (dz / len) * disp);
  }
  g.computeVertexNormals();
  applyBoxUV(g, material.userData.uv);
  const m = new THREE.Mesh(g, material);
  m.castShadow = m.receiveShadow = true;
  return m;
}

/** An annular sector, extruded upward: one of the curved steps. Angles in radians, (x, z) = r(cos θ, sin θ). */
function sectorGeometry(rIn, rOut, a0, a1, h, { bevel = 0, seg = 18 } = {}) {
  const s = new THREE.Shape();
  const pt = (r, a) => [r * Math.cos(a), -r * Math.sin(a)];
  s.moveTo(...pt(rOut, a0));
  for (let i = 1; i <= seg; i++) s.lineTo(...pt(rOut, a0 + ((a1 - a0) * i) / seg));
  for (let i = seg; i >= 0; i--) s.lineTo(...pt(rIn, a0 + ((a1 - a0) * i) / seg));
  const g = new THREE.ExtrudeGeometry(s, bevel
    ? { depth: h, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 3 }
    : { depth: h, bevelEnabled: false });
  g.rotateX(-Math.PI / 2);
  return g;
}

// ---------------------------------------------------------------------------
// The black stone wall and the collection plaque
// ---------------------------------------------------------------------------

function featureWall(M, A) {
  const g = new THREE.Group();
  const { x, w } = L.FEATURE_WALL;
  const z0 = L.ROOM.z0;
  const geo = new THREE.BoxGeometry(w, H, 0.1);
  applyBoxUV(geo, M.blackStone.userData.uv, [0, 0.5]);
  const wall = new THREE.Mesh(geo, M.blackStone);
  wall.position.set(x, H / 2, z0 + 0.05);
  wall.receiveShadow = true;
  g.add(wall);

  // Grazing light from the cove, straight down the face: it's what makes the relief read.
  const spot = new THREE.SpotLight(0xffe2bd, 52, 7.5, 0.92, 1.0, 1.3);
  spot.position.set(x, H - 0.12, z0 + 0.42);
  spot.target.position.set(x, 0.4, z0 + 0.12);
  g.add(spot, spot.target);
  A.lights.push(spot);
  const wash = new THREE.Mesh(new THREE.PlaneGeometry(w, 2.4), M.wash(0xffc58c, 0.2));
  wash.position.set(x, H - 1.2, z0 + 0.106);
  wash.renderOrder = 4;
  g.add(wash);

  // The collection plaque: a honed travertine slab on steel standoffs. displays.js carves the text.
  const P = L.PLAQUE;
  const slab = box(P.w + 0.06, P.h + 0.06, 0.05, M.slabWarm, { r: 0.006, seg: 1 });
  slab.position.set(P.x, P.y, z0 + 0.155);
  g.add(slab);
  const face = new THREE.Mesh(new THREE.PlaneGeometry(P.w, P.h), new THREE.MeshStandardMaterial({ color: 0xe8dccb, roughness: 0.6 }));
  face.position.set(P.x, P.y, z0 + 0.1815);
  face.receiveShadow = true;
  face.name = 'plaque';
  g.add(face);
  A.plaque = face;
  for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const pin = cyl(0.014, 0.014, 0.03, M.steel, { segments: 12 });
    pin.rotation.x = Math.PI / 2;
    pin.position.set(P.x + sx * (P.w / 2 - 0.06), P.y + sy * (P.h / 2 - 0.06), z0 + 0.183);
    g.add(pin);
  }
  return g;
}

// ---------------------------------------------------------------------------
// The counter: a rough-hewn travertine block with a honed top
// ---------------------------------------------------------------------------

function counter(M, A) {
  const g = new THREE.Group();
  g.name = 'counter';
  const { x, z, w, d, h } = L.COUNTER;
  const block = roughBlock(w - 0.1, h - 0.05, d - 0.1, M.slab, { seed: 5, amp: 0.055 });
  block.position.set(x, (h - 0.05) / 2, z);
  g.add(block);
  const top = box(w, 0.05, d, M.slabWarm, { r: 0.008, seg: 1 });
  top.position.set(x, h - 0.025, z);
  g.add(top);
  g.add(place(contactShadow(w, d, { opacity: 0.55 }), x, 0, z));
  const topY = h;
  A.counter = { x, z, topY };

  // "At the till": the glass case for socks and caps.
  const tillX = x + 0.85, tillZ = z - 0.04;
  const tc = new THREE.Group();
  tc.add(place(box(0.94, 0.04, 0.5, M.steel), 0, 0.02, 0));
  tc.add(place(box(0.9, 0.02, 0.44, M.slabWarm), 0, 0.21, -0.01));
  const glassBox = box(0.92, 0.38, 0.48, M.glass, { cast: false, receive: false });
  glassBox.position.y = 0.23;
  glassBox.renderOrder = 3;
  tc.add(glassBox);
  for (const [ex, ez] of [[-0.46, -0.24], [0.46, -0.24], [-0.46, 0.24], [0.46, 0.24]]) tc.add(place(box(0.012, 0.38, 0.012, M.steel), ex, 0.23, ez));
  tc.add(place(box(0.92, 0.012, 0.48, M.steel), 0, 0.42, 0));
  tc.position.set(tillX, topY, tillZ);
  g.add(tc);
  A.till = { x: tillX, z: tillZ, shelves: [topY + 0.04, topY + 0.22], width: 0.84 };

  // Tablet register, stamp cards, a vase, and a stack of bags.
  const reg = new THREE.Group();
  const screen = box(0.25, 0.17, 0.014, M.blackSteel, { r: 0.006, seg: 2 });
  screen.position.set(0, 0.2, 0);
  screen.rotation.x = -0.35;
  reg.add(screen, place(cyl(0.012, 0.012, 0.16, M.steel), 0, 0.08, -0.03), place(cyl(0.06, 0.07, 0.012, M.steel), 0, 0.006, -0.03));
  reg.position.set(x - 0.55, topY, z - 0.1);
  reg.rotation.y = 0.35;
  g.add(reg);
  for (let k = 0; k < 6; k++) {
    const card = box(0.09, 0.003, 0.055, M.paper, { cast: k === 5 });
    card.position.set(x - 0.2, topY + 0.0015 + k * 0.003, z + 0.2);
    card.rotation.y = 0.2;
    g.add(card);
  }
  const v = vase(M, M.ceramic, 0.95, 5);
  v.position.set(x - 1.05, topY, z - 0.12);
  g.add(v);

  // The café half of the idea: an evergreen espresso machine and cups on the bar.
  const em = espressoMachine(M);
  em.position.set(x - 0.14, topY, z - 0.14);
  em.rotation.y = 0.12;
  g.add(em);
  [[0.13, 0.22, 0.4], [0.27, 0.16, 2.1]].forEach(([dx, dz, ry]) => {
    const c = coffeeCup(M);
    c.position.set(x + dx - 0.05, topY, z + dz);
    c.rotation.y = ry;
    g.add(c);
  });

  // Greenery hung over the bar: an oak trough on fine rods, trailing to just above head height.
  g.add(hangingGreens(M, x, z + 0.42, w - 0.5));
  for (let i = 0; i < 2; i++) {
    const bag = shoppingBag(M);
    bag.position.set(x - 1.42 + i * 0.05, topY, z + 0.05 - i * 0.12);
    bag.rotation.y = 0.25 - i * 0.3;
    g.add(bag);
  }
  return g;
}

/** An oak planter trough hung from the ceiling, spilling trailing leaves. */
function hangingGreens(M, x, z, len) {
  const g = new THREE.Group();
  const y = 3.3;
  g.add(place(box(len, 0.14, 0.26, M.oak, { r: 0.02, seg: 2 }), x, y, z));
  g.add(place(box(len - 0.04, 0.02, 0.22, M.soil), x, y + 0.07, z));
  for (const sx of [-1, 1]) g.add(place(cyl(0.004, 0.004, L.CEILING.drop - y - 0.07, M.steel, { segments: 5 }), x + sx * (len / 2 - 0.2), (L.CEILING.drop + y + 0.07) / 2, z));
  const r = seeded(404);
  const leafShape = new THREE.Shape();
  leafShape.moveTo(0, 0);
  leafShape.bezierCurveTo(0.03, 0.01, 0.035, 0.05, 0, 0.07);
  leafShape.bezierCurveTo(-0.035, 0.05, -0.03, 0.01, 0, 0);
  const strands = 34, perStrand = 16;
  const leaves = new THREE.InstancedMesh(new THREE.ShapeGeometry(leafShape, 4), M.leaf, strands * perStrand);
  const vine = new THREE.MeshStandardMaterial({ color: 0x5f6e4c, roughness: 0.9 });
  const d = new THREE.Object3D();
  const dark = new THREE.Color(0x5d7150), light = new THREE.Color(0x8fa278);
  let k = 0;
  for (let i = 0; i < strands; i++) {
    const sx = x + (r() - 0.5) * (len - 0.1), sz = z + (r() - 0.5) * 0.3;
    const drop = 0.08 + r() * r() * 0.34;
    const pts = [new THREE.Vector3(sx, y + 0.08, sz), new THREE.Vector3(sx + (r() - 0.5) * 0.08, y - drop * 0.4, sz + (r() < 0.5 ? -0.14 : 0.14)), new THREE.Vector3(sx + (r() - 0.5) * 0.12, y - drop, sz + (r() - 0.5) * 0.3)];
    const curve = new THREE.CatmullRomCurve3(pts);
    g.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 8, 0.0025, 3), vine));
    for (let j = 0; j < perStrand; j++) {
      const p = curve.getPoint(j / perStrand);
      d.position.set(p.x + (r() - 0.5) * 0.03, p.y, p.z + (r() - 0.5) * 0.03);
      d.rotation.set(-0.9 - r() * 1.2, r() * Math.PI * 2, r() * 0.6);
      d.scale.setScalar(0.9 + r() * 0.8);
      d.updateMatrix();
      leaves.setMatrixAt(k, d.matrix);
      leaves.setColorAt(k, r() < 0.5 ? dark : light);
      k++;
    }
  }
  leaves.castShadow = true;
  g.add(leaves);
  return g;
}

// ---------------------------------------------------------------------------
// The Steps: nine curved travertine steps round an olive, under the skylight
// ---------------------------------------------------------------------------

function theSteps(M, A, quality) {
  const g = new THREE.Group();
  const S = L.STEPS;
  const span = ((S.to - S.from) / S.count) * DEG;
  A.outfits = [];
  A.steps = { x: S.x, z: S.z };
  for (let i = 0; i < S.count; i++) {
    const a0 = S.from * DEG + span * i, a1 = a0 + span;
    const lo = Math.min(a0, a1), hi = Math.max(a0, a1);
    const hgt = S.rise * (i + 1);
    const geo = sectorGeometry(S.rIn, S.rOut, lo, hi, hgt);
    applyBoxUV(geo, M.slab.userData.uv, [i * 0.37, i * 0.21]);
    const step = new THREE.Mesh(geo, M.slab);
    step.position.set(S.x, 0, S.z);
    step.castShadow = step.receiveShadow = true;
    g.add(step);
    const mid = (a0 + a1) / 2, rMid = (S.rIn + S.rOut) / 2 + 0.05;
    if (i === 2 || i === 5 || i === 8) A.outfits.push(new THREE.Vector3(S.x + Math.cos(mid) * rMid, hgt, S.z + Math.sin(mid) * rMid));
  }
  g.add(place(contactShadow(S.rOut * 2.1, S.rOut * 2.1, { round: true, opacity: 0.35 }), S.x, 0, S.z));

  // Round travertine planter at the centre.
  const P = L.PLANTER;
  const planter = cyl(P.r, P.r + 0.03, P.h, M.slab, { segments: 64 });
  planter.position.set(S.x, P.h / 2, S.z);
  g.add(planter);
  const soil = new THREE.Mesh(new THREE.CircleGeometry(P.r - 0.05, 40), M.soil);
  soil.rotation.x = -Math.PI / 2;
  soil.position.set(S.x, P.h - 0.02, S.z);
  g.add(soil);
  for (let i = 0; i < 7; i++) {
    const pebble = new THREE.Mesh(new THREE.SphereGeometry(0.03 + Math.random() * 0.03, 8, 6), M.slabWarm);
    const a = Math.random() * Math.PI * 2, rr = 0.2 + Math.random() * 0.5;
    pebble.position.set(S.x + Math.cos(a) * rr, P.h - 0.015, S.z + Math.sin(a) * rr);
    pebble.scale.y = 0.5;
    g.add(pebble);
  }
  g.add(olive(M, S.x, P.h - 0.02, S.z, quality));

  // Gather round the olive: a crescent of travertine table wraps the planter on the open
  // side, with four cream chairs pulled up to it.
  const ringFrom = -52 * DEG, ringTo = 122 * DEG, topY = 0.74;
  const ringTop = new THREE.Mesh(sectorGeometry(P.r + 0.02, 1.34, ringFrom, ringTo, 0.05, { bevel: 0.012, seg: 48 }), M.slabWarm);
  applyBoxUV(ringTop.geometry, M.slabWarm.userData.uv);
  ringTop.position.set(S.x, topY - 0.05, S.z);
  ringTop.castShadow = ringTop.receiveShadow = true;
  g.add(ringTop);
  const ringBase = new THREE.Mesh(sectorGeometry(P.r + 0.02, 1.06, ringFrom + 4 * DEG, ringTo - 4 * DEG, topY - 0.05, { seg: 48 }), M.slab);
  applyBoxUV(ringBase.geometry, M.slab.userData.uv);
  ringBase.position.set(S.x, 0, S.z);
  ringBase.castShadow = ringBase.receiveShadow = true;
  g.add(ringBase);
  [-24, 18, 60, 102].forEach((deg, i) => {
    const a = deg * DEG, rr = 1.78;
    const ch = bistroChair(M, { frame: M.oak, seat: M.boucle });
    ch.position.set(S.x + Math.cos(a) * rr, 0, S.z + Math.sin(a) * rr);
    ch.rotation.y = -a - Math.PI / 2;
    g.add(ch);
    if (i === 1 || i === 2) {
      const cup = coffeeCup(M);
      cup.position.set(S.x + Math.cos(a) * 1.16, topY + 0.012, S.z + Math.sin(a) * 1.16);
      cup.rotation.y = i * 1.7;
      g.add(cup);
    }
  });
  const book2 = book(M, 0.15, 0.022, 0.21, 0xe9e0d1);
  book2.position.set(S.x + Math.cos(40 * DEG) * 1.12, topY + 0.023, S.z + Math.sin(40 * DEG) * 1.12);
  book2.rotation.y = 0.8;
  g.add(book2);
  return g;
}

// ---------------------------------------------------------------------------
// Fitting rooms: two arched alcoves with linen curtains
// ---------------------------------------------------------------------------

function fittingRooms(M, A) {
  const g = new THREE.Group();
  const z0 = L.ROOM.z0, T = L.ROOM.t, { depth, spring } = L.FITTING;
  const back = z0 - T - depth;
  L.FITTING_ROOMS.forEach((f, i) => {
    g.add(place(box(f.w + 0.02, 0.012, T + depth, M.floor, { cast: false }), f.x, 0.006, z0 - (T + depth) / 2));
    g.add(place(box(0.74, 0.42, 0.34, M.slab, { r: 0.02, seg: 2 }), f.x, 0.21, back + 0.2));
    // Warm light spilling down the back wall.
    const glow = new THREE.Mesh(new THREE.PlaneGeometry(f.w, 2.2), M.wash(0xffd09a, 0.34));
    glow.position.set(f.x, 1.35, back + 0.012);
    g.add(glow);
    g.add(place(box(0.34, 0.012, 0.03, M.led, { cast: false, receive: false }), f.x, 2.35, back + 0.02));
    // A hook and a single hanger.
    g.add(place(cyl(0.006, 0.006, 0.08, M.brass, { segments: 6 }), f.x + 0.25, 1.75, back + 0.04));
    // Rod and curtain (half drawn, gathered to the outside edge).
    const rodY = spring - 0.06, rodZ = z0 - 0.1;
    const rod = cyl(0.009, 0.009, f.w, M.steel, { segments: 8 });
    rod.rotation.z = Math.PI / 2;
    rod.position.set(f.x, rodY, rodZ);
    g.add(rod);
    const cw = f.w * 0.6, ch = rodY - 0.02;
    const cg = new THREE.PlaneGeometry(cw, ch, 40, 6);
    const pos = cg.attributes.position;
    for (let k = 0; k < pos.count; k++) {
      const u = (pos.getX(k) + cw / 2) / cw;
      const v = (pos.getY(k) + ch / 2) / ch;
      pos.setZ(k, 0.028 * Math.sin(u * Math.PI * 11) * (0.7 + 0.3 * (1 - v)));
      pos.setX(k, pos.getX(k) * (1 + 0.08 * (1 - v)));
    }
    cg.computeVertexNormals();
    const cur = new THREE.Mesh(cg, M.curtain);
    const side = i === 0 ? -1 : 1;
    cur.position.set(f.x + side * (f.w / 2 - cw / 2 - 0.02), ch / 2 + 0.02, rodZ);
    cur.castShadow = true;
    g.add(cur);
  });
  return g;
}

// ---------------------------------------------------------------------------
// Movement: steel rack in front of the fitting rooms
// ---------------------------------------------------------------------------

function movement(M, A) {
  const g = new THREE.Group();
  const { x, z, w } = L.MOVEMENT_RACK;
  const tube = 0.016;
  for (const sx of [-1, 1]) {
    g.add(place(cyl(tube, tube, 1.96, M.steel), x + sx * w / 2, 0.98, z));
    g.add(place(box(0.04, 0.025, 0.5, M.steel), x + sx * w / 2, 0.0125, z));
  }
  const bars = [1.93, 1.13];
  for (const by of bars) {
    const bar = cyl(0.013, 0.013, w, M.steel);
    bar.rotation.z = Math.PI / 2;
    bar.position.set(x, by, z);
    g.add(bar);
  }
  A.rackBars = bars.map(y => ({ y, x0: x - w / 2 + 0.12, x1: x + w / 2 - 0.12, z }));
  g.add(place(contactShadow(w, 0.4, { opacity: 0.3 }), x, 0, z));
  [0xd4c8b5, 0x9c8872].forEach((c, i) => {
    const mt = cyl(0.065, 0.065, 0.64, new THREE.MeshStandardMaterial({ color: c, roughness: 0.9 }));
    mt.position.set(x + w / 2 + 0.2 + i * 0.14, 0.33, z - 0.1);
    mt.rotation.z = -0.1;
    g.add(mt);
  });
  return g;
}

// ---------------------------------------------------------------------------
// Lounge: sand leather banquette, travertine tables, bouclé chairs, the lit niche
// ---------------------------------------------------------------------------

function lounge(M, A) {
  const g = new THREE.Group();
  const { x, z, len } = L.BANQUETTE;
  const x1 = L.ROOM.x1, T = L.ROOM.t, n = L.LOUNGE_NICHE;

  g.add(place(box(0.66, 0.2, len, M.wood), x, 0.1, z));
  g.add(place(box(0.64, 0.17, len - 0.04, M.leather, { r: 0.05, seg: 3 }), x - 0.01, 0.285, z));
  const count = Math.floor(len / 0.31), pitch = len / count;
  for (let i = 0; i < count; i++) {
    const ch = box(0.13, 0.6, pitch - 0.018, M.leather, { r: 0.05, seg: 3 });
    ch.position.set(x + 0.26, 0.7, z - len / 2 + pitch / 2 + i * pitch);
    ch.rotation.z = -0.12;
    g.add(ch);
  }
  g.add(place(box(0.16, 0.04, len, M.slabWarm), x1 - 0.08, 1.04, z));
  // Dried wheat along the ledge behind the banquette, and pampas standing at either end.
  const wheat = wheatRow(len - 0.3, { count: 280 });
  wheat.position.set(x1 - 0.08, 1.06, z);
  g.add(wheat);
  [[z - len / 2 - 0.34, 3], [z + len / 2 + 0.34, 9]].forEach(([pz, seed]) => {
    const pv = pampasVase(M, { seed, plumes: 6 });
    pv.position.set(x1 - 0.42, 0, pz);
    g.add(pv);
  });
  g.add(place(contactShadow(0.7, len, { opacity: 0.45 }), x, 0, z));

  const rug = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 4.6), M.rug);
  rug.rotation.x = -Math.PI / 2;
  rug.rotation.z = Math.PI / 2;
  rug.position.set(5.2, 0.004, z);
  rug.receiveShadow = true;
  g.add(rug);

  A.loungeTables = [];
  for (const [tx, tz] of L.LOUNGE_TABLES) {
    g.add(place(cyl(0.27, 0.29, 0.04, M.slab, { segments: 40 }), tx, 0.02, tz));
    g.add(place(cyl(0.075, 0.095, 0.68, M.slab, { segments: 28 }), tx, 0.38, tz));
    g.add(place(cyl(0.4, 0.4, 0.035, M.slabWarm, { segments: 48 }), tx, 0.7375, tz));
    g.add(place(contactShadow(0.7, 0.7, { round: true, opacity: 0.45 }), tx, 0.006, tz));
    A.loungeTables.push(new THREE.Vector3(tx, 0.755, tz));
    const ch = new THREE.Group();
    ch.add(place(box(0.66, 0.06, 0.66, M.wood), 0, 0.03, 0));
    ch.add(place(box(0.74, 0.24, 0.76, M.boucle, { r: 0.1, seg: 4 }), 0, 0.26, 0));
    ch.add(place(box(0.2, 0.5, 0.76, M.boucle, { r: 0.09, seg: 4 }), -0.28, 0.58, 0));
    for (const sz of [-1, 1]) ch.add(place(box(0.64, 0.3, 0.16, M.boucle, { r: 0.075, seg: 4 }), 0.02, 0.48, sz * 0.31));
    ch.position.set(tx - 1.2, 0, tz);
    ch.rotation.y = tz < 0 ? 0.18 : -0.18;
    g.add(ch);
    g.add(place(contactShadow(0.8, 0.8, { opacity: 0.4 }), tx - 1.2, 0, tz));
  }
  const [t1, t2] = A.loungeTables;
  const b1 = book(M, 0.16, 0.025, 0.23, 0xcdbfa9); b1.position.copy(t2).add(new THREE.Vector3(0.1, 0.0125, 0.12)); b1.rotation.y = 0.4; g.add(b1);
  const b2 = book(M, 0.15, 0.02, 0.21, 0xefe6d6); b2.position.copy(t2).add(new THREE.Vector3(0.1, 0.037, 0.12)); b2.rotation.y = 0.2; g.add(b2);
  const v = vase(M, M.ceramic, 0.6, 3); v.position.copy(t1).add(new THREE.Vector3(0.12, 0, -0.1)); g.add(v);

  // Inside the niche: a slim rail hung from the niche head, an LED line, and the glow it throws.
  const inner = x1 + T;
  const railX = inner + 0.22, railY = n.y1 - 0.34;
  const rail = cyl(0.012, 0.012, n.z1 - n.z0 - 0.5, M.steel);
  rail.rotation.x = Math.PI / 2;
  rail.position.set(railX, railY, (n.z0 + n.z1) / 2);
  g.add(rail);
  for (const rz of [n.z0 + 0.35, n.z1 - 0.35]) g.add(place(cyl(0.005, 0.005, n.y1 - railY, M.steel, { segments: 6 }), railX, (n.y1 + railY) / 2, rz));
  g.add(place(box(0.018, 0.01, n.z1 - n.z0 - 2 * n.radius, M.led, { cast: false, receive: false }), inner + 0.06, n.y1 - 0.012, (n.z0 + n.z1) / 2));
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(n.z1 - n.z0 - 0.2, n.y1 - n.y0 - 0.1), M.wash(0xffd49e, 0.4));
  glow.rotation.y = -Math.PI / 2;
  glow.position.set(inner + n.depth - 0.012, (n.y0 + n.y1) / 2, (n.z0 + n.z1) / 2);
  g.add(glow);
  A.loungeRail = { x: railX, y: railY, z0: n.z0 + 0.62, z1: n.z1 - 0.62 };
  return g;
}

// ---------------------------------------------------------------------------
// Archive: travertine shelving lit from within, the brand line carved above
// ---------------------------------------------------------------------------

function archive(M, A) {
  const g = new THREE.Group();
  const { x, w, h } = L.ARCHIVE_SHELF;
  const z0 = L.ROOM.z0, d = 0.38;
  const z = z0 + 0.05 + d / 2;

  // Rough-cut travertine cladding from the black wall to the corner, full height.
  const cx0 = L.FEATURE_WALL.x + L.FEATURE_WALL.w / 2, cx1 = L.ROOM.x1 - L.ROOM.corner;
  const clad = box(cx1 - cx0, H, 0.05, M.claddingRough, { cast: false });
  clad.position.set((cx0 + cx1) / 2, H / 2, z0 + 0.025);
  g.add(clad);

  for (const sx of [-1, 1]) g.add(place(box(0.1, h, d, M.slab, { r: 0.02, seg: 2 }), x + sx * (w / 2 - 0.05), h / 2, z));
  const levels = [0.06, 0.56, 1.06, 1.56, 2.06, h - 0.03];
  for (const ly of levels) g.add(place(box(w - 0.12, 0.05, d - 0.02, M.slab, { r: 0.015, seg: 2 }), x, ly, z));
  g.add(place(box(w, 0.07, d, M.slab), x, 0.035, z));
  // LED under each shelf, and the glow on the stone behind.
  const glowMat = M.wash(0xffd6a2, 0.3);
  for (let i = 1; i < levels.length; i++) {
    g.add(place(box(w - 0.24, 0.006, 0.014, M.led, { cast: false, receive: false }), x, levels[i] - 0.028, z + d / 2 - 0.05));
    const glow = new THREE.Mesh(new THREE.PlaneGeometry(w - 0.24, 0.44), glowMat);
    glow.position.set(x, levels[i] - 0.25, z0 + 0.052);
    g.add(glow);
  }
  A.archiveShelves = levels.slice(0, -1).map(ly => ({ y: ly + 0.025, x0: x - w / 2 + 0.1, x1: x + w / 2 - 0.1, z: z + 0.02 }));
  g.add(place(contactShadow(w, d, { opacity: 0.45 }), x, 0, z));
  const shelfLight = new THREE.PointLight(0xffd3a0, 1.3, 2.6, 2);
  shelfLight.position.set(x, 1.5, z + 0.5);
  g.add(shelfLight);
  A.lights.push(shelfLight);

  // Reading lamp beside it (glows; no extra light source).
  const lx = x - w / 2 - 0.45, lz = z + 0.5;
  g.add(place(cyl(0.15, 0.16, 0.025, M.slab), lx, 0.0125, lz));
  g.add(place(cyl(0.011, 0.011, 1.55, M.brass), lx, 0.8, lz));
  const shade = cyl(0.17, 0.23, 0.28, M.linenShade, { open: true, segments: 28, cast: false });
  shade.position.set(lx, 1.66, lz);
  g.add(shade);

  // The brand line, in raised letters on the rough stone above the shelves.
  const B = L.BRAND_LINE;
  const W = 2048, Hc = 620;
  const tex = canvasTexture(W, Hc, (ctx) => {
    ctx.clearRect(0, 0, W, Hc);
    ctx.textAlign = 'center';
    const line = (text, y, size) => {
      ctx.font = `italic 400 ${size}px "Bodoni Moda", serif`;
      ctx.fillStyle = 'rgba(62,44,30,0.66)';     // shadow the cove light throws below the letters
      ctx.fillText(text, W / 2 + 3, y + 7);
      ctx.fillStyle = 'rgba(255,248,236,0.9)';   // lit top edges
      ctx.fillText(text, W / 2 - 1, y - 2);
      ctx.fillStyle = '#e3d4bd';                  // the stone face of the letter
      ctx.fillText(text, W / 2, y);
    };
    line('Life unfolds in increments.', 250, 178);
    line('You define your story.', 470, 132);
  });
  const letters = new THREE.Mesh(new THREE.PlaneGeometry(B.w, B.w * (Hc / W)), new THREE.MeshStandardMaterial({ map: tex, transparent: true, roughness: 0.75, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.08 }));
  letters.position.set(B.x, B.y, z0 + 0.056);
  g.add(letters);
  return g;
}

// ---------------------------------------------------------------------------
// Notice board by the door: linen in limewashed oak
// ---------------------------------------------------------------------------

function noticeBoard(M, A) {
  const g = new THREE.Group();
  const { x, y, z, w, h } = L.NOTICE_BOARD;
  g.add(place(box(w, h, 0.025, M.linen, { cast: false }), x, y, z));
  const f = 0.045;
  for (const [fw, fh, fx, fy] of [[w + f * 2, f, x, y + h / 2 + f / 2], [w + f * 2, f, x, y - h / 2 - f / 2], [f, h, x - w / 2 - f / 2, y], [f, h, x + w / 2 + f / 2, y]]) {
    g.add(place(box(fw, fh, 0.045, M.wood), fx, fy, z - 0.005));
  }
  A.board = { x, y, z: z - 0.014, w, h };
  const ledge = box(1.5, 0.03, 0.14, M.wood);
  ledge.position.set(x, y - h / 2 - 0.2, z - 0.06);
  g.add(ledge);
  const ly = y - h / 2 - 0.185;
  g.add(place(lathe([[0, 0], [0.04, 0], [0.042, 0.1], [0.038, 0.1], [0.036, 0.008], [0, 0.008]], M.ceramicDark), x - 0.5, ly, z - 0.07));
  const pencil = new THREE.MeshStandardMaterial({ color: 0x3a2c22, roughness: 0.6 });
  for (let i = 0; i < 4; i++) {
    const p = cyl(0.004, 0.004, 0.17, pencil, { segments: 6 });
    p.position.set(x - 0.5 + (i - 1.5) * 0.012, ly + 0.1, z - 0.07 + (i % 2) * 0.01);
    p.rotation.z = (i - 1.5) * 0.12;
    g.add(p);
  }
  for (let k = 0; k < 8; k++) g.add(place(box(0.09, 0.003, 0.055, M.paper, { cast: false }), x + 0.35, ly + 0.0015 + k * 0.003, z - 0.07, 0.1));
  return g;
}

// ---------------------------------------------------------------------------
// The island: a long honed slab on two rough-hewn blocks, set with lookbooks
// ---------------------------------------------------------------------------

function island(M, A) {
  const g = new THREE.Group();
  const { x, z, len, w } = L.ISLAND;
  const topY = 0.76;
  g.add(place(box(len, 0.07, w, M.slabWarm, { r: 0.03, seg: 3 }), x, topY - 0.035, z));
  // A fluted plinth runs the length of the island, reeded like the café counters.
  const plinth = mesh(flutedGeometry(len - 0.5, w - 0.36, topY - 0.07, { reed: 0.055 }), M.slab);
  plinth.position.set(x, 0, z);
  g.add(plinth);
  // Evergreen bistro chairs: a table to sit at, not just a plinth to look at.
  [[-0.62, 1], [0.58, 1], [-0.58, -1], [0.62, -1]].forEach(([dx, side]) => {
    const ch = bistroChair(M);
    ch.position.set(x + dx, 0, z + side * (w / 2 + 0.3));
    ch.rotation.y = side > 0 ? Math.PI + (dx > 0 ? -0.12 : 0.1) : (dx > 0 ? 0.1 : -0.12);
    g.add(ch);
  });
  g.add(place(contactShadow(len, w, { opacity: 0.4 }), x, 0, z));
  const stack = [[0.3, 0.03, 0.38, 0xe9e0d1], [0.28, 0.025, 0.36, 0x8a7560], [0.26, 0.02, 0.34, 0xd2c4ad]];
  let yy = topY;
  stack.forEach(([bw, bh, bd, c], i) => {
    const b = book(M, bw, bh, bd, c);
    b.position.set(x - 0.55, yy + bh / 2, z + 0.05);
    b.rotation.y = 0.12 * (i - 1);
    g.add(b);
    yy += bh;
  });
  const v = vase(M, M.noce, 1.1, 6);
  v.position.set(x + 0.45, topY, z - 0.1);
  g.add(v);
  return g;
}

// ---------------------------------------------------------------------------
// Light sources that no one sees: the cove does the showing.
// ---------------------------------------------------------------------------

function roomLights(A) {
  const g = new THREE.Group();
  for (const [lx, ly, lz, intensity, dist] of [[L.COUNTER.x, 2.9, L.COUNTER.z + 1.1, 2.6, 7.5], [5.5, 2.6, 0.1, 2.4, 6.5], [L.NOTICE_BOARD.x, 2.6, L.NOTICE_BOARD.z - 1.6, 1.5, 4.5]]) {
    const pl = new THREE.PointLight(0xffcf9e, intensity, dist, 2);
    pl.position.set(lx, ly, lz);
    g.add(pl);
    A.lights.push(pl);
  }
  return g;
}

// ---------------------------------------------------------------------------
// A fiddle-leaf fig in the front corner by the lounge
// ---------------------------------------------------------------------------

function plants(M) {
  const g = new THREE.Group();
  const fx = L.ROOM.x1 - 0.8, fz = L.ROOM.z1 - 0.85, scale = 0.95;
  const pot = lathe([[0, 0], [0.3, 0], [0.34, 0.04], [0.37, 0.5], [0.35, 0.52], [0.33, 0.49], [0, 0.47]].map(([r, y]) => [r * scale, y * scale]), M.slab, { segments: 36 });
  pot.position.set(fx, 0, fz);
  const soil = new THREE.Mesh(new THREE.CircleGeometry(0.33 * scale, 24), M.soil);
  soil.rotation.x = -Math.PI / 2;
  soil.position.set(fx, 0.48 * scale, fz);
  g.add(pot, soil, place(contactShadow(0.7, 0.7, { round: true, opacity: 0.5 }), fx, 0, fz));
  const stem = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(fx, 0.45, fz), new THREE.Vector3(fx - 0.05, 1.2, fz + 0.03), new THREE.Vector3(fx + 0.02, 2.0, fz - 0.02)]), 16, 0.02, 6), M.trunk);
  g.add(stem);
  const leafShape = new THREE.Shape();
  leafShape.moveTo(0, 0);
  leafShape.bezierCurveTo(0.12, 0.05, 0.14, 0.22, 0, 0.3);
  leafShape.bezierCurveTo(-0.14, 0.22, -0.12, 0.05, 0, 0);
  const fig = new THREE.MeshStandardMaterial({ color: 0x4d6546, roughness: 0.55, side: THREE.DoubleSide });
  const n = 34;
  const figLeaves = new THREE.InstancedMesh(new THREE.ShapeGeometry(leafShape, 8), fig, n);
  const dummy = new THREE.Object3D();
  for (let i = 0; i < n; i++) {
    const t = 0.25 + (i / n) * 0.75, a = i * 2.4;
    dummy.position.set(fx + Math.cos(a) * 0.08, 0.45 + t * 1.6, fz + Math.sin(a) * 0.08);
    dummy.rotation.set(-0.6 - Math.random() * 0.5, a, 0);
    const s = 0.8 + Math.random() * 0.5;
    dummy.scale.set(s, s, s);
    dummy.updateMatrix();
    figLeaves.setMatrixAt(i, dummy.matrix);
  }
  figLeaves.castShadow = true;
  g.add(figLeaves);
  return g;
}


/**
 * A block whose two long faces are reeded (half-round flutes), extruded upward.
 * `len` along x, `depth` along z, `height` up; origin at the bottom centre.
 */
function flutedGeometry(len, depth, height, { reed = 0.05 } = {}) {
  const n = Math.max(2, Math.round(len / reed)), step = len / n, rr = step / 2;
  const s = new THREE.Shape();
  const hz = depth / 2;
  s.moveTo(-len / 2, -hz);
  for (let i = 0; i < n; i++) s.absarc(-len / 2 + rr + i * step, -hz, rr, Math.PI, 0, true);
  s.lineTo(len / 2, hz);
  for (let i = n - 1; i >= 0; i--) s.absarc(-len / 2 + rr + i * step, hz, rr, 0, Math.PI, false);
  s.lineTo(-len / 2, -hz);
  const geo = new THREE.ExtrudeGeometry(s, { depth: height, bevelEnabled: false, curveSegments: 6 });
  geo.rotateX(-Math.PI / 2);     // shape's y → -z, extrusion → +y
  geo.computeVertexNormals();
  return geo;
}

// ---------------------------------------------------------------------------
// Fabric waves under the ceiling
// ---------------------------------------------------------------------------

function sails(M) {
  const S = L.SAILS;
  const g = new THREE.Group();
  g.name = 'sails';
  const r = seeded(314);
  const len = S.x1 - S.x0, segU = 96, segV = 6;
  for (let i = 0; i < S.count; i++) {
    const zc = S.z0 + (i + 0.5) * ((S.z1 - S.z0) / S.count);
    const width = 0.42 + r() * 0.12, period = 1.9 + r() * 0.9, phase = r() * Math.PI * 2;
    const sag = 0.22 + r() * 0.16, twist = 0.35 + r() * 0.3;
    const geo = new THREE.PlaneGeometry(len, width, segU, segV);
    const pos = geo.attributes.position;
    const colors = new Float32Array(pos.count * 3);
    for (let k = 0; k < pos.count; k++) {
      const u = pos.getX(k) / len + 0.5, t = pos.getY(k) / width;        // t in −0.5..0.5 across
      const wave = 0.5 - 0.5 * Math.cos((u * len / period) * Math.PI * 2 + phase);
      const ends = Math.sin(Math.min(1, u * 5) * Math.PI / 2) * Math.sin(Math.min(1, (1 - u) * 5) * Math.PI / 2);
      const drop = sag * wave * ends;
      const tilt = Math.sin(u * len / period * Math.PI + phase * 0.7) * twist;
      const y = S.top - drop - t * width * Math.sin(tilt) * 0.8 - (1 - ends) * 0.02;
      const zz = zc + t * width * Math.cos(tilt);
      pos.setXYZ(k, S.x0 + u * len, y, zz);
      // Brighter where the fabric rises toward the cove, a touch warmer in the troughs.
      const lit = 1 - drop / (sag + 0.001) * 0.22;
      colors[k * 3] = lit; colors[k * 3 + 1] = lit * 0.985; colors[k * 3 + 2] = lit * 0.955;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, M.sail);
    g.add(m);
  }
  return g;
}

// ---------------------------------------------------------------------------
// Sheer drapes, gathered to the sides of every arched window
// ---------------------------------------------------------------------------

function drapePanel(M, height, width) {
  const geo = new THREE.PlaneGeometry(width, height, 36, 10);
  const pos = geo.attributes.position;
  for (let k = 0; k < pos.count; k++) {
    const u = pos.getX(k) / width + 0.5, v = pos.getY(k) / height + 0.5;
    pos.setZ(k, 0.035 * Math.sin(u * Math.PI * 9) + 0.012 * Math.sin(u * Math.PI * 23) * (1 - v));
    pos.setX(k, pos.getX(k) * (1 + 0.18 * (1 - v)));
  }
  geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, M.sheer);
  m.renderOrder = 3;
  m.castShadow = true;
  return m;
}

function drapes(M) {
  const g = new THREE.Group();
  const rodY = 3.6, h = rodY - 0.03;
  const hang = (cx, cz, alongX, w) => {
    // Rod across the opening, one gathered panel each side, hanging over the wall.
    const rod = cyl(0.008, 0.008, w + 1.1, M.brass, { segments: 8 });
    rod.rotation.z = Math.PI / 2;
    if (!alongX) rod.rotation.y = Math.PI / 2;
    rod.position.set(cx, rodY, cz);
    g.add(rod);
    for (const s of [-1, 1]) {
      const p = drapePanel(M, h, 0.4);
      const off = s * (w / 2 + 0.24);
      if (alongX) p.position.set(cx + off, rodY - h / 2, cz);
      else { p.position.set(cx, rodY - h / 2, cz + off); p.rotation.y = Math.PI / 2; }
      g.add(p);
    }
  };
  for (const win of L.WINDOWS) hang(L.ROOM.x0 + 0.1, win.z, false, win.w);
  hang(L.FRONT_WINDOW.x, L.ROOM.z1 - 0.1, true, L.FRONT_WINDOW.w);
  return g;
}

// ---------------------------------------------------------------------------
// Words in light
// ---------------------------------------------------------------------------

function wordsInLight(M, A) {
  const g = new THREE.Group();
  // Over the notice board, the brand's own line in warm neon script.
  const B = L.NOTICE_BOARD;
  const neon = neonText('small steps, big accomplishments.', { w: 2.3, h: 0.28, glows: A.glows });
  neon.position.set(B.x, B.y + B.h / 2 + 0.44, B.z - 0.012);
  neon.rotation.y = Math.PI;
  g.add(neon);
  // By the fitting rooms, a pill lightbox.
  const pill = pillSign(['TAKE', 'YOUR', 'TIME'], { w: 0.3, h: 0.84, M, glows: A.glows });
  pill.position.set(-3.06, 1.58, L.ROOM.z0 + 0.006);
  g.add(pill);
  return g;
}

// ---------------------------------------------------------------------------
// A cream-and-evergreen checker inlaid inside the door
// ---------------------------------------------------------------------------

function entryInlay(M, A) {
  const I = L.INLAY;
  const cols = Math.round(I.w / I.tile), rows = Math.round(I.d / I.tile);
  const px = 64;
  const map = canvasTexture(cols * px + 32, rows * px + 32, (ctx, w, h) => {
    const r = seeded(12);
    ctx.fillStyle = '#e3d4bd'; ctx.fillRect(0, 0, w, h);                  // travertine border
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
      const green = (i + j) % 2 === 0;
      const base = green ? [44, 66, 52] : [236, 227, 212];
      const jit = (r() - 0.5) * 10;
      ctx.fillStyle = `rgb(${base[0] + jit},${base[1] + jit},${base[2] + jit})`;
      ctx.fillRect(16 + i * px + 1, 16 + j * px + 1, px - 2, px - 2);
      for (let k = 0; k < 14; k++) {
        ctx.fillStyle = green ? 'rgba(255,255,255,0.03)' : 'rgba(120,100,70,0.05)';
        ctx.fillRect(16 + i * px + r() * px, 16 + j * px + r() * px, 2 + r() * 8, 1);
      }
    }
    ctx.strokeStyle = 'rgba(90,72,52,0.35)'; ctx.lineWidth = 1;
    for (let j = 0; j <= rows; j++) { ctx.beginPath(); ctx.moveTo(16, 16 + j * px); ctx.lineTo(16 + cols * px, 16 + j * px); ctx.stroke(); }
    for (let i = 0; i <= cols; i++) { ctx.beginPath(); ctx.moveTo(16 + i * px, 16); ctx.lineTo(16 + i * px, 16 + rows * px); ctx.stroke(); }
  });
  const mat = new THREE.MeshStandardMaterial({ map, roughness: 0.55, envMapIntensity: 0.6 });
  const geo = new THREE.PlaneGeometry(I.w + 0.1, I.d + 0.1);
  geo.rotateX(-Math.PI / 2);
  geo.translate(I.x, 0.0025, I.z);
  const m = new THREE.Mesh(geo, mat);
  m.receiveShadow = true;
  m.name = 'inlay';
  A.floorDecals.push(m);
  return m;
}
