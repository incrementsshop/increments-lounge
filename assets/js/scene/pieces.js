import * as THREE from 'three';
import { box, cyl, lathe, place, canvasTexture } from './helpers.js';
import { seeded } from './stone.js';

// Small pieces used in more than one place: olives and potted plants, bistro chairs, café
// cups, the espresso machine and grinder, and dried pampas.

/** A gnarled, multi-stemmed olive. `scale` 1 is the 2.2 m tree under the skylight. */
export function olive(M, x, y0, z, quality, { scale = 1, seed = 77, density = 2.6, turn = 0 } = {}) {
  const g = new THREE.Group();
  const r = seeded(seed);
  const tips = [];
  const stems = [
    [[0, 0, 0], [0.12, 0.7, 0.05], [0.02, 1.45, 0.12], [0.2, 2.15, 0.02]],
    [[0.05, 0, -0.04], [-0.14, 0.65, -0.1], [-0.05, 1.4, -0.28], [-0.3, 2.2, -0.22]],
    [[-0.04, 0, 0.05], [-0.12, 0.6, 0.18], [0.02, 1.3, 0.3], [-0.06, 2.0, 0.42]],
  ];
  const cs = Math.cos(turn), sn = Math.sin(turn);
  const at = (a, b, c) => new THREE.Vector3(x + (a * cs - c * sn) * scale, y0 + b * scale, z + (a * sn + c * cs) * scale);
  stems.forEach((pts, si) => {
    const curve = new THREE.CatmullRomCurve3(pts.map(([a, b, c]) => at(a, b, c)));
    const t = new THREE.Mesh(new THREE.TubeGeometry(curve, 24, (0.055 - si * 0.01) * scale, 8), M.trunk);
    t.castShadow = true;
    g.add(t);
    const top = curve.getPoint(1);
    for (let b = 0; b < 4; b++) {
      const a = r() * Math.PI * 2;
      const start = curve.getPoint(0.65 + r() * 0.3);
      const tip = top.clone().add(new THREE.Vector3(Math.cos(a) * (0.45 + r() * 0.45), 0.3 + r() * 0.6, Math.sin(a) * (0.45 + r() * 0.45)).multiplyScalar(scale));
      const mid = start.clone().lerp(tip, 0.5).add(new THREE.Vector3(0, 0.12 * scale, 0));
      const br = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([start, mid, tip]), 10, 0.018 * scale, 5), M.trunk);
      br.castShadow = true;
      g.add(br);
      tips.push(tip, mid);
    }
  });
  const blade = new THREE.Shape();
  blade.moveTo(0, 0);
  blade.quadraticCurveTo(0.014, 0.03, 0.002, 0.085);
  blade.quadraticCurveTo(-0.012, 0.03, 0, 0);
  const count = Math.round(quality.leaves * density);
  const leaves = new THREE.InstancedMesh(new THREE.ShapeGeometry(blade, 4), M.leaf, count);
  const dummy = new THREE.Object3D();
  const silver = new THREE.Color(0xb6bea6), green = new THREE.Color(0x76866a);
  for (let i = 0; i < count; i++) {
    const c = tips[i % tips.length];
    const rr = Math.cbrt(r()) * 0.36 * scale, th = r() * Math.PI * 2, ph = Math.acos(2 * r() - 1);
    dummy.position.set(c.x + rr * Math.sin(ph) * Math.cos(th), c.y + rr * 0.8 * Math.cos(ph), c.z + rr * Math.sin(ph) * Math.sin(th));
    dummy.rotation.set(r() * Math.PI, r() * Math.PI * 2, r() * Math.PI);
    dummy.scale.setScalar((1.35 + r() * 0.6) * Math.max(0.8, scale));
    dummy.updateMatrix();
    leaves.setMatrixAt(i, dummy.matrix);
    leaves.setColorAt(i, r() < 0.35 ? silver : green);
  }
  leaves.castShadow = true;
  g.add(leaves);
  return g;
}

/** A café bistro chair: a thin hoop-backed frame and a round cream cushion. Faces +z. */
export function bistroChair(M, { frame = M.oak, seat = M.boucle } = {}) {
  const g = new THREE.Group();
  const tube = 0.011, sy = 0.45;
  const legs = [[-0.17, 0.15], [0.17, 0.15], [-0.16, -0.14], [0.16, -0.14]];
  for (const [lx, lz] of legs) {
    const leg = new THREE.Mesh(new THREE.TubeGeometry(new THREE.LineCurve3(new THREE.Vector3(lx * 1.12, 0, lz * 1.12), new THREE.Vector3(lx, sy, lz)), 1, tube, 6), frame);
    leg.castShadow = true;
    g.add(leg);
  }
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.2, tube, 6, 32), frame);
  ring.rotation.x = Math.PI / 2;
  ring.position.y = sy;
  g.add(ring);
  const cushion = cyl(0.205, 0.2, 0.055, seat, { segments: 32 });
  cushion.position.y = sy + 0.03;
  g.add(cushion);
  const hoop = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.17, sy, -0.1), new THREE.Vector3(-0.2, sy + 0.2, -0.17), new THREE.Vector3(-0.14, sy + 0.36, -0.22),
    new THREE.Vector3(0, sy + 0.4, -0.24), new THREE.Vector3(0.14, sy + 0.36, -0.22), new THREE.Vector3(0.2, sy + 0.2, -0.17), new THREE.Vector3(0.17, sy, -0.1),
  ]);
  const back = new THREE.Mesh(new THREE.TubeGeometry(hoop, 40, tube, 6), frame);
  back.castShadow = true;
  g.add(back);
  const band = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.19, sy + 0.24, -0.18), new THREE.Vector3(0, sy + 0.27, -0.235), new THREE.Vector3(0.19, sy + 0.24, -0.18),
  ]), 16, 0.02, 6), seat);
  g.add(band);
  return g;
}

/** A ceramic café cup on a saucer. */
export function coffeeCup(M, { material = M.ceramic } = {}) {
  const g = new THREE.Group();
  g.add(place(cyl(0.062, 0.055, 0.008, material, { segments: 24 }), 0, 0.004, 0));
  const cup = lathe([[0, 0], [0.028, 0], [0.034, 0.012], [0.042, 0.06], [0.04, 0.062], [0.036, 0.02], [0, 0.016]], material, { segments: 24 });
  cup.position.y = 0.008;
  g.add(cup);
  const coffee = new THREE.Mesh(new THREE.CircleGeometry(0.037, 20), new THREE.MeshStandardMaterial({ color: 0x5a3a24, roughness: 0.3 }));
  coffee.rotation.x = -Math.PI / 2;
  coffee.position.y = 0.058;
  g.add(coffee);
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.014, 0.004, 6, 12, Math.PI * 1.2), material);
  handle.position.set(0.045, 0.04, 0);
  handle.rotation.z = -Math.PI * 0.6;
  g.add(handle);
  return g;
}

/** A burr grinder: a black steel body under a hopper of beans. Faces +z. */
export function coffeeGrinder(M) {
  const g = new THREE.Group();
  g.add(place(box(0.15, 0.27, 0.2, M.blackSteel, { r: 0.02, seg: 2 }), 0, 0.135, 0));
  g.add(place(box(0.13, 0.015, 0.1, M.steel), 0, 0.0075, 0.13));                        // dosing tray
  g.add(place(cyl(0.022, 0.022, 0.05, M.steel, { segments: 12 }), 0, 0.12, 0.11));     // chute
  const hopper = lathe([[0.025, 0], [0.07, 0.13], [0.068, 0.135], [0.02, 0.008]], M.glass, { segments: 24, cast: false });
  hopper.position.y = 0.27;
  hopper.renderOrder = 3;
  g.add(hopper);
  g.add(place(lathe([[0, 0], [0.025, 0], [0.058, 0.09], [0, 0.1]], new THREE.MeshStandardMaterial({ color: 0x4a2f1f, roughness: 0.7 }), { segments: 20 }), 0, 0.272, 0));
  g.add(place(cyl(0.072, 0.072, 0.014, M.blackSteel, { segments: 24 }), 0, 0.41, 0)); // lid
  return g;
}

/** A compact two-group espresso machine in brushed steel, for the counter. Faces +z. */
export function espressoMachine(M) {
  const g = new THREE.Group();
  const body = box(0.46, 0.32, 0.4, M.steel, { r: 0.03, seg: 3 });
  body.position.set(0, 0.2, 0);
  g.add(body);
  g.add(place(box(0.44, 0.04, 0.3, M.steel, { r: 0.01, seg: 2 }), 0, 0.02, 0.08));   // drip tray
  g.add(place(box(0.44, 0.02, 0.36, M.steel), 0, 0.37, -0.01));                          // cup rail
  g.add(place(box(0.44, 0.06, 0.012, M.steel), 0, 0.3, 0.2));                            // badge strip
  for (const gx of [-0.11, 0.11]) {
    g.add(place(cyl(0.035, 0.035, 0.05, M.steel, { segments: 18 }), gx, 0.235, 0.21));
    const pf = new THREE.Group();
    pf.add(place(cyl(0.034, 0.03, 0.03, M.steel, { segments: 18 }), 0, 0, 0));
    const handle = cyl(0.012, 0.012, 0.14, M.oak, { segments: 10 });
    handle.rotation.x = Math.PI / 2 - 0.25;
    handle.position.set(0, 0.01, 0.08);
    pf.add(handle);
    pf.position.set(gx, 0.2, 0.21);
    g.add(pf);
  }
  const wand = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.21, 0.3, 0.17), new THREE.Vector3(0.24, 0.26, 0.24), new THREE.Vector3(0.25, 0.12, 0.26),
  ]), 12, 0.006, 6), M.steel);
  g.add(wand);
  for (let i = 0; i < 3; i++) {
    const cup = lathe([[0, 0], [0.028, 0], [0.036, 0.05], [0.034, 0.052], [0, 0.012]], M.ceramic, { segments: 18 });
    cup.position.set(-0.13 + i * 0.07, 0.38, -0.05);
    cup.rotation.x = Math.PI;
    cup.position.y += 0.052;
    g.add(cup);
  }
  return g;
}

let plumeTex = null;
function plumeTexture() {
  if (plumeTex) return plumeTex;
  plumeTex = canvasTexture(128, 512, (ctx, W, H) => {
    const r = seeded(91);
    ctx.clearRect(0, 0, W, H);
    for (let i = 0; i < 900; i++) {
      const t = r();                       // along the plume, 0 = tip
      const spread = Math.sin(Math.min(1, t * 1.25) * Math.PI) * W * 0.42 * (0.4 + r() * 0.6);
      const x = W / 2 + (r() - 0.5) * 2 * spread, y = 8 + t * (H - 60);
      const len = 14 + r() * 26;
      ctx.strokeStyle = `rgba(${226 + r() * 20},${208 + r() * 20},${178 + r() * 20},${0.22 + r() * 0.3})`;
      ctx.lineWidth = 1 + r() * 1.6;
      ctx.beginPath(); ctx.moveTo(W / 2, y); ctx.quadraticCurveTo((W / 2 + x) / 2, y - 6, x, y - len * 0.4); ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(170,146,110,0.9)'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(W / 2, 20); ctx.lineTo(W / 2, H); ctx.stroke();
  });
  return plumeTex;
}

/** Dried pampas in a tall travertine floor vase. */
export function pampasVase(M, { height = 0.62, plumes = 5, seed = 5 } = {}) {
  const g = new THREE.Group();
  const r = seeded(seed);
  g.add(lathe([[0, 0], [0.15, 0], [0.19, 0.08], [0.2, height * 0.55], [0.13, height * 0.92], [0.11, height], [0.1, height - 0.01], [0, height - 0.05]], M.slab, { segments: 36 }));
  const mat = new THREE.MeshStandardMaterial({ map: plumeTexture(), transparent: true, alphaTest: 0.08, side: THREE.DoubleSide, roughness: 1, color: 0xfff6e8 });
  const stemMat = new THREE.MeshStandardMaterial({ color: 0xb09a78, roughness: 1 });
  for (let i = 0; i < plumes; i++) {
    const a = (i / plumes) * Math.PI * 2 + r() * 0.6, lean = 0.08 + r() * 0.16;
    const len = 0.9 + r() * 0.5;
    const tip = new THREE.Vector3(Math.cos(a) * lean * len, height + len, Math.sin(a) * lean * len);
    const stem = new THREE.Mesh(new THREE.TubeGeometry(new THREE.LineCurve3(new THREE.Vector3(0, height - 0.05, 0), tip), 1, 0.005, 4), stemMat);
    g.add(stem);
    const pl = new THREE.Group();
    for (const rot of [0, Math.PI / 2]) {
      const q = new THREE.Mesh(new THREE.PlaneGeometry(0.24, 0.62), mat);
      q.rotation.y = rot;
      q.castShadow = true;
      pl.add(q);
    }
    const base = new THREE.Vector3(0, height - 0.05, 0);
    const dir = tip.clone().sub(base).normalize();
    pl.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    pl.rotateY(r() * Math.PI);
    pl.position.copy(tip).addScaledVector(dir, -0.26);
    g.add(pl);
  }
  return g;
}

// ---------------------------------------------------------------------------
// Plants
// ---------------------------------------------------------------------------

const plantMats = new WeakMap();
function greens(M) {
  if (!plantMats.has(M)) {
    plantMats.set(M, {
      fig: new THREE.MeshStandardMaterial({ color: 0x4d6546, roughness: 0.55, side: THREE.DoubleSide }),
      paddle: new THREE.MeshStandardMaterial({ color: 0x5a7450, roughness: 0.6, side: THREE.DoubleSide }),
      stalk: new THREE.MeshStandardMaterial({ color: 0x75825a, roughness: 0.85 }),
      vine: new THREE.MeshStandardMaterial({ color: 0x5f6e4c, roughness: 0.9 }),
    });
  }
  return plantMats.get(M);
}

/** A tall travertine floor planter with a rolled lip, soil just below the rim. */
function floorPot(M, { r = 0.3, h = 0.5, material = M.slab } = {}) {
  const g = new THREE.Group();
  g.add(lathe([[0, 0], [r * 0.84, 0], [r * 0.92, 0.04], [r, h * 0.95], [r * 0.97, h], [r * 0.9, h * 0.97], [0, h * 0.94]], material, { segments: 36 }));
  const soil = new THREE.Mesh(new THREE.CircleGeometry(r * 0.9, 24), M.soil);
  soil.rotation.x = -Math.PI / 2;
  soil.position.y = h * 0.94 + 0.002;
  g.add(soil);
  return g;
}

/** A fiddle-leaf fig: three stems of broad, glossy, violin-shaped leaves. Origin at the pot's foot. */
export function fiddleLeafFig(M, { seed = 21, height = 2.0, pot = M.slab, potR = 0.3, potH = 0.5 } = {}) {
  const g = new THREE.Group();
  const r = seeded(seed);
  const mats = greens(M);
  g.add(floorPot(M, { r: potR, h: potH, material: pot }));
  const leafShape = new THREE.Shape();
  leafShape.moveTo(0, 0);
  leafShape.bezierCurveTo(0.09, 0.03, 0.05, 0.12, 0.12, 0.22);
  leafShape.quadraticCurveTo(0.12, 0.31, 0, 0.32);
  leafShape.quadraticCurveTo(-0.12, 0.31, -0.12, 0.22);
  leafShape.bezierCurveTo(-0.05, 0.12, -0.09, 0.03, 0, 0);
  const stems = 3, perStem = 20;
  const leaves = new THREE.InstancedMesh(new THREE.ShapeGeometry(leafShape, 8), mats.fig, stems * perStem);
  const d = new THREE.Object3D();
  const deep = new THREE.Color(0xd8e0cf), fresh = new THREE.Color(0xffffff);
  let k = 0;
  for (let s = 0; s < stems; s++) {
    const a = (s / stems) * Math.PI * 2 + r() * 0.8;
    const top = height * (0.74 + r() * 0.26), lean = 0.1 + r() * 0.14;
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(Math.cos(a) * 0.04, potH * 0.92, Math.sin(a) * 0.04),
      new THREE.Vector3(Math.cos(a) * lean * 0.5, potH + (top - potH) * 0.45, Math.sin(a) * lean * 0.5),
      new THREE.Vector3(Math.cos(a) * lean, top, Math.sin(a) * lean),
    ]);
    const stem = new THREE.Mesh(new THREE.TubeGeometry(curve, 12, 0.016, 6), M.trunk);
    stem.castShadow = true;
    g.add(stem);
    for (let i = 0; i < perStem; i++) {
      const t = 0.32 + (i / perStem) * 0.68;
      const p = curve.getPoint(t);
      const ang = i * 2.4 + s * 1.3;
      const elevation = 0.35 + r() * 0.5 + t * 0.25;            // younger leaves stand up more
      d.position.set(p.x + Math.cos(ang) * 0.025, p.y, p.z + Math.sin(ang) * 0.025);
      d.rotation.set(Math.PI / 2 - elevation, Math.PI / 2 - ang, (r() - 0.5) * 0.5, 'YXZ');
      d.scale.setScalar((1.25 - t * 0.45) * (0.85 + r() * 0.3));
      d.updateMatrix();
      leaves.setMatrixAt(k, d.matrix);
      leaves.setColorAt(k, t > 0.8 ? fresh : deep);
      k++;
    }
  }
  leaves.castShadow = true;
  g.add(leaves);
  return g;
}

/** One bird-of-paradise leaf: a long paddle, folded along the midrib, its tip arching out. */
function paddleLeaf(L, W) {
  const geo = new THREE.PlaneGeometry(W, L, 6, 16);
  geo.translate(0, L / 2, 0);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), v = y / L;
    const taper = Math.pow(Math.sin(Math.PI * THREE.MathUtils.clamp(v, 0.02, 0.985)), 0.7);
    const nx = x * taper;
    p.setXYZ(i, nx, y, -Math.abs(nx) * 0.32 + v * v * L * 0.2);
  }
  geo.computeVertexNormals();
  return geo;
}

/** A bird of paradise: tall stalks fanning out of the pot, each ending in a big paddle leaf. */
export function birdOfParadise(M, { seed = 8, height = 1.9, pot = M.slab, potR = 0.3, potH = 0.55, count = 11 } = {}) {
  const g = new THREE.Group();
  const r = seeded(seed);
  const mats = greens(M);
  g.add(floorPot(M, { r: potR, h: potH, material: pot }));
  const up = new THREE.Vector3(0, 1, 0), basis = new THREE.Matrix4();
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2 + (r() - 0.5) * 0.6;
    const out = new THREE.Vector3(Math.cos(a), 0, Math.sin(a));
    const reach = height - potH;
    const L = (0.5 + r() * 0.22) * (reach / 1.35), W = L * (0.31 + r() * 0.06);
    const stalkLen = Math.max(0.25, reach - L * (0.8 + r() * 0.25)) * (0.75 + r() * 0.25);
    const lean = 0.1 + r() * 0.32;                                  // stalk, radians from upright
    const dir = up.clone().multiplyScalar(Math.cos(lean)).addScaledVector(out, Math.sin(lean));
    const base = new THREE.Vector3(out.x * 0.05, potH * 0.94, out.z * 0.05);
    const top = base.clone().addScaledVector(dir, stalkLen);
    const mid = base.clone().lerp(top, 0.5).addScaledVector(out, 0.025);
    const stalk = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([base, mid, top]), 8, 0.009, 5), mats.stalk);
    stalk.castShadow = true;
    g.add(stalk);
    const leaf = new THREE.Mesh(paddleLeaf(L, W), mats.paddle);
    const yAxis = up.clone().multiplyScalar(Math.cos(lean * 1.4)).addScaledVector(out, Math.sin(lean * 1.4)).normalize();
    const zAxis = out.clone().addScaledVector(yAxis, -out.dot(yAxis)).normalize();   // the leaf faces outward
    const xAxis = new THREE.Vector3().crossVectors(yAxis, zAxis);
    leaf.quaternion.setFromRotationMatrix(basis.makeBasis(xAxis, yAxis, zAxis));
    leaf.rotateY((r() - 0.5) * 1.0);
    leaf.position.copy(top);
    leaf.castShadow = true;
    g.add(leaf);
  }
  return g;
}

/**
 * A small trailing plant (pothos) whose vines spill over an edge. The pot sits on a surface
 * at y = 0; `toward` is the direction (radians, from +x toward +z) of the edge it spills over,
 * `edge` how far away that edge is, `drop` how far the longest vines fall past it. With
 * `bowl`, it's a low bowl whose vines spread round it on the table.
 */
export function trailingPlant(M, { seed = 3, strands = 11, drop = 0.6, toward = Math.PI / 2, edge = 0.2, bowl = false, pot = M.ceramic } = {}) {
  const g = new THREE.Group();
  const r = seeded(seed);
  const mats = greens(M);
  const potR = bowl ? 0.15 : 0.085, potH = bowl ? 0.075 : 0.13;
  g.add(bowl
    ? lathe([[0, 0], [potR * 0.55, 0], [potR * 0.9, potH * 0.5], [potR, potH], [potR * 0.94, potH], [0, potH * 0.85]], pot, { segments: 32 })
    : lathe([[0, 0], [potR * 0.85, 0], [potR, potH], [potR * 0.93, potH], [0, potH * 0.9]], pot, { segments: 28 }));
  const soil = new THREE.Mesh(new THREE.CircleGeometry(potR * 0.9, 20), M.soil);
  soil.rotation.x = -Math.PI / 2;
  soil.position.y = potH * 0.88;
  g.add(soil);

  const heart = new THREE.Shape();
  heart.moveTo(0, 0);
  heart.bezierCurveTo(0.03, 0.005, 0.034, 0.04, 0, 0.062);
  heart.bezierCurveTo(-0.034, 0.04, -0.03, 0.005, 0, 0);
  const perStrand = 13;
  const leaves = new THREE.InstancedMesh(new THREE.ShapeGeometry(heart, 4), M.leaf, strands * perStrand);
  const d = new THREE.Object3D();
  const dark = new THREE.Color(0x5d7150), light = new THREE.Color(0x93a67a);
  let k = 0;
  for (let i = 0; i < strands; i++) {
    const a = bowl ? (i / strands) * Math.PI * 2 + r() * 0.5 : toward + (r() - 0.5) * 2.2;
    const out = new THREE.Vector3(Math.cos(a), 0, Math.sin(a));
    const off = Math.cos(a - toward);                                // 1 = straight at the edge
    const rim = out.clone().multiplyScalar(potR * 0.8).setY(potH);
    const pts = [rim, out.clone().multiplyScalar(potR + 0.05).setY(potH + 0.03)];
    if (bowl) {
      const len = 0.12 + r() * 0.16;
      pts.push(out.clone().multiplyScalar(potR + len * 0.5).setY(0.02), out.clone().multiplyScalar(potR + len).add(new THREE.Vector3((r() - 0.5) * 0.06, 0.008, (r() - 0.5) * 0.06)));
    } else if (off > 0.55) {
      // Over the edge and down.
      const reach = edge / Math.max(off, 0.6) + 0.03, fall = drop * (0.35 + r() * 0.65);
      pts.push(out.clone().multiplyScalar(reach).setY(0.01), out.clone().multiplyScalar(reach + 0.04).setY(-fall * 0.5), out.clone().multiplyScalar(reach + 0.03 + r() * 0.04).setY(-fall));
    } else {
      // Along the surface.
      const len = 0.12 + r() * 0.14;
      pts.push(out.clone().multiplyScalar(potR + len).setY(0.008));
    }
    const curve = new THREE.CatmullRomCurve3(pts);
    g.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 10, 0.0025, 3), mats.vine));
    for (let j = 0; j < perStrand; j++) {
      const p = curve.getPoint(j / perStrand);
      d.position.set(p.x + (r() - 0.5) * 0.025, p.y + 0.004, p.z + (r() - 0.5) * 0.025);
      d.rotation.set(-0.6 - r() * 1.4, r() * Math.PI * 2, r() * 0.6);
      d.scale.setScalar(0.75 + r() * 0.6 - j * 0.015);
      d.updateMatrix();
      leaves.setMatrixAt(k, d.matrix);
      leaves.setColorAt(k, r() < 0.45 ? dark : light);
      k++;
    }
  }
  leaves.castShadow = true;
  g.add(leaves);
  return g;
}
