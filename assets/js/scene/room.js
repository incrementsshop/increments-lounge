import * as THREE from 'three';
import { ROOM, WINDOWS, DOOR, SUN, CEILING, SKYLIGHT, FITTING_ROOMS, FITTING, LOUNGE_NICHE } from './layout.js';
import { mesh, box, place, aoStrip } from './helpers.js';
import { applyBoxUV } from './materials.js';

// The shell: floor; plaster walls with real openings (arched windows, arched fitting
// rooms, a rounded niche) and curved corners; a floating ceiling whose hidden cove washes
// every wall with light; a round skylight; the street outside; and the daylight.

const { x0, x1, z0, z1, h: H, corner: R, t: T } = ROOM;

export function buildRoom(scene, M, quality) {
  const root = new THREE.Group();
  root.name = 'room';
  scene.add(root);

  const plasterBack = M.plaster.clone(); plasterBack.side = THREE.BackSide;
  const plasterDouble = M.plaster.clone(); plasterDouble.side = THREE.DoubleSide;
  const mats = { ...M, plasterBack, plasterDouble };

  // --- Floor & ceiling -----------------------------------------------------
  const floorGeo = new THREE.PlaneGeometry(x1 - x0, z1 - z0);
  floorGeo.rotateX(-Math.PI / 2);
  const floor = mesh(floorGeo, M.floor, { cast: false });
  floor.name = 'floor';
  root.add(floor);

  const ceil = box(x1 - x0 + 0.6, 0.2, z1 - z0 + 0.6, M.ceiling);
  ceil.position.y = H + 0.1;
  root.add(ceil);

  // Floating ceiling with the skylight cut through it.
  const ins = CEILING.inset;
  const slabShape = roundedRect(x0 + ins, z0 + ins, x1 - ins, z1 - ins, Math.max(0.15, R - ins));
  const hole = new THREE.Path();
  hole.absarc(SKYLIGHT.x, SKYLIGHT.z, SKYLIGHT.r, 0, Math.PI * 2, true);
  slabShape.holes.push(hole);
  const slabGeo = new THREE.ExtrudeGeometry(slabShape, { depth: 0.06, bevelEnabled: false, curveSegments: 24 });
  slabGeo.rotateX(Math.PI / 2);
  const slab = mesh(slabGeo, M.ceiling, { cast: false });
  slab.position.y = CEILING.drop + 0.06;
  root.add(slab);

  // The cove: the band of ceiling between the floating slab and the walls, lit from above.
  const coveShape = roundedRect(x0 + 0.01, z0 + 0.01, x1 - 0.01, z1 - 0.01, R);
  coveShape.holes.push(roundedRectPath(x0 + ins, z0 + ins, x1 - ins, z1 - ins, Math.max(0.15, R - ins)));
  const coveGeo = new THREE.ShapeGeometry(coveShape, 24);
  coveGeo.rotateX(Math.PI / 2);
  const cove = new THREE.Mesh(coveGeo, new THREE.MeshBasicMaterial({ color: 0xffeccf, side: THREE.DoubleSide, toneMapped: false }));
  cove.position.y = H - 0.004;
  root.add(cove);

  // --- Walls ---------------------------------------------------------------
  // Each wall is built in its own frame: interior face at local z = 0, +z outward,
  // u runs along the wall, v is up. Openings are drawn in (u, v).
  const L = frame('left'), B = frame('back'), Rt = frame('right'), F = frame('front');
  root.add(L, B, Rt, F);

  // Window wall (u = +z).
  solidWall(L, z0 + R, z1 - R, WINDOWS.map(w => archPath(w.z, w.w, w.sill, w.sill + 1.9)), mats);

  // Back wall (u = -x): two arched fitting rooms, recessed.
  const fitPaths = FITTING_ROOMS.map(f => archPath(-f.x, f.w, 0, FITTING.spring));
  solidWall(B, -(x1 - R), -(x0 + R), fitPaths, mats);
  fitPaths.forEach(p => recess(B, p, FITTING.depth, mats));

  // Lounge wall (u = -z): the rounded niche Worn hangs in.
  const n = LOUNGE_NICHE;
  const nichePath = roundedRectPath(-n.z1, n.y0, -n.z0, n.y1, n.radius);
  solidWall(Rt, -(z1 - R), -(z0 + R), [nichePath], mats);
  recess(Rt, nichePath, n.depth, mats);

  // Street wall (u = +x), with the door.
  const doorPath = new THREE.Path();
  doorPath.moveTo(DOOR.x - DOOR.w / 2, 0); doorPath.lineTo(DOOR.x + DOOR.w / 2, 0);
  doorPath.lineTo(DOOR.x + DOOR.w / 2, DOOR.h); doorPath.lineTo(DOOR.x - DOOR.w / 2, DOOR.h);
  doorPath.lineTo(DOOR.x - DOOR.w / 2, 0);
  solidWall(F, x0 + R, x1 - R, [doorPath], mats);

  // Curved corners.
  const corners = [
    [x0 + R, z0 + R, Math.PI], [x1 - R, z0 + R, Math.PI / 2],
    [x1 - R, z1 - R, 0], [x0 + R, z1 - R, Math.PI * 1.5],
  ];
  for (const [cx, cz, a] of corners) {
    const g = new THREE.CylinderGeometry(R, R, H + 0.02, 28, 1, true, a, Math.PI / 2);
    applyBoxUV(g, M.plaster.userData.uv);
    const c = new THREE.Mesh(g, plasterBack);
    c.position.set(cx, H / 2, cz);
    c.castShadow = c.receiveShadow = true;
    root.add(c);
  }

  for (const win of WINDOWS) root.add(windowAssembly(win, M));
  root.add(door(M));

  // Travertine skirting on the straight runs.
  const sk = 0.1;
  const skirt = (len, x, z, ry) => root.add(place(box(len, sk, 0.02, M.slabWarm, { cast: false }), x, sk / 2, z, ry));
  skirt(x1 - x0 - 2 * R, 0, z0 + 0.01, 0);
  skirt(z1 - z0 - 2 * R, x1 - 0.01, 0, Math.PI / 2);
  skirt(DOOR.x - DOOR.w / 2 - (x0 + R), (x0 + R + DOOR.x - DOOR.w / 2) / 2, z1 - 0.01, 0);
  skirt(x1 - R - (DOOR.x + DOOR.w / 2), (x1 - R + DOOR.x + DOOR.w / 2) / 2, z1 - 0.01, 0);

  // --- Light from the cove ------------------------------------------------
  // Every wall carries a soft wash from the hidden LED line above it.
  const washMat = M.wash(0xffcf96, 0.44);
  const washH = 1.9;
  const straightWash = (fr, u0, u1) => {
    const g = new THREE.PlaneGeometry(u1 - u0, washH);
    g.translate((u0 + u1) / 2, H - washH / 2, -0.012);
    const m = new THREE.Mesh(g, washMat);
    m.renderOrder = 4;
    fr.add(m);
  };
  straightWash(L, z0 + R, z1 - R);
  straightWash(B, -(x1 - R), -(x0 + R));
  straightWash(Rt, -(z1 - R), -(z0 + R));
  straightWash(F, x0 + R, x1 - R);
  for (const [cx, cz, a] of corners) {
    const g = new THREE.CylinderGeometry(R - 0.012, R - 0.012, washH, 20, 1, true, a, Math.PI / 2);
    const m = new THREE.Mesh(g, washMat);
    m.position.set(cx, H - washH / 2, cz);
    m.renderOrder = 4;
    root.add(m);
  }

  // --- Skylight -------------------------------------------------------------
  const sky = new THREE.Group();
  const throat = new THREE.Mesh(new THREE.CylinderGeometry(SKYLIGHT.r, SKYLIGHT.r, H - CEILING.drop, 48, 1, true), plasterBack);
  throat.position.set(SKYLIGHT.x, (H + CEILING.drop) / 2, SKYLIGHT.z);
  const pane = new THREE.Mesh(new THREE.CircleGeometry(SKYLIGHT.r, 48), new THREE.MeshBasicMaterial({ color: 0xfffaf1, toneMapped: false }));
  pane.rotation.x = Math.PI / 2;
  pane.position.set(SKYLIGHT.x, H - 0.02, SKYLIGHT.z);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(SKYLIGHT.r, 0.012, 8, 64), M.led);
  rim.rotation.x = Math.PI / 2;
  rim.position.set(SKYLIGHT.x, CEILING.drop - 0.005, SKYLIGHT.z);
  const skyLight = new THREE.SpotLight(0xfff3e4, 34, 9, 0.62, 0.9, 1.6);
  skyLight.position.set(SKYLIGHT.x, CEILING.drop - 0.05, SKYLIGHT.z);
  skyLight.target.position.set(SKYLIGHT.x, 0, SKYLIGHT.z);
  sky.add(throat, pane, rim, skyLight, skyLight.target);
  root.add(sky);

  // --- The street outside --------------------------------------------------
  const outside = streetBackdrop();
  const west = new THREE.Mesh(new THREE.PlaneGeometry(40, 16), outside);
  west.position.set(x0 - 5, 4, 0);
  west.rotation.y = Math.PI / 2;
  root.add(west);
  const south = new THREE.Mesh(new THREE.PlaneGeometry(24, 14), outside);
  south.position.set(0, 4, z1 + 5);
  south.rotation.y = Math.PI;
  root.add(south);

  // --- Ambient occlusion at the floor --------------------------------------
  const strips = new THREE.Group();
  const floorStrip = (len, x, z, ry, width = 0.5, opacity = 0.28) => {
    const s = aoStrip(len, width, opacity);
    s.rotation.x = -Math.PI / 2;
    const g = new THREE.Group(); g.add(s);
    g.position.set(x, 0.003, z); g.rotation.y = ry;
    strips.add(g);
  };
  floorStrip(x1 - x0 - 2 * R, 0, z0, 0);
  floorStrip(z1 - z0 - 2 * R, x1, 0, -Math.PI / 2);
  floorStrip(x1 - x0 - 2 * R, 0, z1, Math.PI);
  floorStrip(z1 - z0 - 2 * R, x0, 0, Math.PI / 2, 0.35, 0.18);
  for (const [cx, cz, a] of corners) {
    for (let k = 0; k < 6; k++) {
      const ang = a + (k + 0.5) * (Math.PI / 12);
      floorStrip(R * (Math.PI / 12) * 1.08, cx + R * Math.sin(ang), cz + R * Math.cos(ang), ang + Math.PI);
    }
  }
  const wallStrip = (fr, u0, u1) => {
    const s = aoStrip(u1 - u0, 0.4, 0.2);
    s.rotation.z = Math.PI;
    s.position.set((u0 + u1) / 2, 0, -0.006);
    fr.add(s);
  };
  wallStrip(B, -(x1 - R), -(x0 + R));
  wallStrip(Rt, -(z1 - R), -(z0 + R));
  wallStrip(F, x0 + R, x1 - R);
  root.add(strips);

  // --- Daylight -------------------------------------------------------------
  const sun = new THREE.DirectionalLight(SUN.color, 4.4);
  sun.position.set(...SUN.position);
  sun.target.position.set(...SUN.target);
  sun.castShadow = true;
  sun.shadow.mapSize.set(quality.shadow, quality.shadow);
  const sc = sun.shadow.camera;
  sc.left = -11; sc.right = 11; sc.top = 9.5; sc.bottom = -9.5; sc.near = 4; sc.far = 36;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.025;
  sun.shadow.radius = 3;
  root.add(sun, sun.target);

  root.add(new THREE.HemisphereLight(0xfff0db, 0xdcc4a0, 0.7));
  const fill = new THREE.DirectionalLight(0xffe8d0, 0.26);
  fill.position.set(6, 5, 7);
  root.add(fill);

  return { root, sun, anchors: { skylight: { ...SKYLIGHT, y: CEILING.drop } } };
}

// ---------------------------------------------------------------------------

function frame(which) {
  const g = new THREE.Group();
  if (which === 'left') { g.position.set(x0, 0, 0); g.rotation.y = -Math.PI / 2; }        // u = +z
  if (which === 'back') { g.position.set(0, 0, z0); g.rotation.y = Math.PI; }             // u = -x
  if (which === 'right') { g.position.set(x1, 0, 0); g.rotation.y = Math.PI / 2; }        // u = -z
  if (which === 'front') { g.position.set(0, 0, z1); g.rotation.y = 0; }                  // u = +x
  return g;
}

/** A plaster wall from u0 to u1 with openings; starts just below the floor so openings can sit on it. */
function solidWall(fr, u0, u1, holes, M) {
  const s = new THREE.Shape();
  s.moveTo(u0, -0.05); s.lineTo(u1, -0.05); s.lineTo(u1, H + 0.02); s.lineTo(u0, H + 0.02); s.lineTo(u0, -0.05);
  s.holes.push(...holes);
  const w = mesh(new THREE.ExtrudeGeometry(s, { depth: T, bevelEnabled: false, curveSegments: 32 }), M.plaster);
  fr.add(w);
  return w;
}

/** The inside of a recess behind an opening: plaster sides and a back, `depth` beyond the wall. */
function recess(fr, path, depth, M) {
  const shape = new THREE.Shape(path.getPoints(64));
  const tubeGeo = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 32 });
  applyBoxUV(tubeGeo, M.plaster.userData.uv);
  const tube = new THREE.Mesh(tubeGeo, [new THREE.MeshBasicMaterial({ visible: false }), M.plasterBack]);
  tube.position.z = T;
  tube.receiveShadow = true;
  fr.add(tube);
  const capGeo = new THREE.ShapeGeometry(shape, 32);
  applyBoxUV(capGeo, M.plaster.userData.uv);
  const cap = new THREE.Mesh(capGeo, M.plasterDouble);
  cap.position.z = T + depth;
  cap.receiveShadow = true;
  fr.add(cap);
}

export function roundedRect(ax, ay, bx, by, r, S = THREE.Shape) {
  const s = new S();
  s.moveTo(ax + r, ay);
  s.lineTo(bx - r, ay); s.absarc(bx - r, ay + r, r, -Math.PI / 2, 0, false);
  s.lineTo(bx, by - r); s.absarc(bx - r, by - r, r, 0, Math.PI / 2, false);
  s.lineTo(ax + r, by); s.absarc(ax + r, by - r, r, Math.PI / 2, Math.PI, false);
  s.lineTo(ax, ay + r); s.absarc(ax + r, ay + r, r, Math.PI, Math.PI * 1.5, false);
  return s;
}
const roundedRectPath = (ax, ay, bx, by, r) => roundedRect(ax, ay, bx, by, r, THREE.Path);

function archPath(u, w, v0, spring) {
  const r = w / 2;
  const p = new THREE.Path();
  p.moveTo(u - r, v0);
  p.lineTo(u + r, v0);
  p.lineTo(u + r, spring);
  p.absarc(u, spring, r, 0, Math.PI, false);
  p.lineTo(u - r, v0);
  return p;
}

/** Steel frame, glazing bars, glass and a travertine sill for one arched window. */
function windowAssembly(win, M) {
  const { z, w, sill } = win;
  const r = w / 2, spring = sill + 1.9;
  const g = new THREE.Group();
  const bar = 0.035, xMid = x0 - T / 2;

  const outer = new THREE.Shape();
  outer.moveTo(-r, 0); outer.lineTo(r, 0); outer.lineTo(r, spring - sill);
  outer.absarc(0, spring - sill, r, 0, Math.PI, false); outer.lineTo(-r, 0);
  const inner = new THREE.Path();
  const ri = r - 0.05;
  inner.moveTo(-ri, 0.05); inner.lineTo(ri, 0.05); inner.lineTo(ri, spring - sill);
  inner.absarc(0, spring - sill, ri, 0, Math.PI, false); inner.lineTo(-ri, 0.05);
  outer.holes.push(inner);
  const fr = mesh(new THREE.ExtrudeGeometry(outer, { depth: 0.05, bevelEnabled: false, curveSegments: 28 }), M.blackSteel, { uv: false });
  fr.rotation.y = -Math.PI / 2;
  fr.position.set(xMid + 0.025, sill, z);
  g.add(fr);

  const vbar = box(bar, spring - sill + r - 0.06, bar, M.blackSteel);
  vbar.position.set(xMid, sill + (spring - sill + r) / 2, z);
  g.add(vbar);
  for (const dz of [-r / 2, r / 2]) {
    const v = box(bar * 0.8, spring - sill - 0.08, bar * 0.8, M.blackSteel);
    v.position.set(xMid, sill + (spring - sill) / 2, z + dz);
    g.add(v);
  }
  for (const y of [spring, sill + (spring - sill) * 0.52]) {
    const hb = box(bar, bar, w - 0.08, M.blackSteel);
    hb.position.set(xMid, y, z);
    g.add(hb);
  }
  for (const a of [Math.PI / 4, (3 * Math.PI) / 4]) {
    const len = r - 0.06;
    const rb = box(bar * 0.8, len, bar * 0.8, M.blackSteel);
    rb.position.set(xMid, spring + Math.sin(a) * len / 2, z + Math.cos(a) * len / 2);
    rb.rotation.x = Math.PI / 2 - a;
    g.add(rb);
  }

  const glassShape = new THREE.Shape();
  glassShape.moveTo(-r, 0); glassShape.lineTo(r, 0); glassShape.lineTo(r, spring - sill);
  glassShape.absarc(0, spring - sill, r, 0, Math.PI, false); glassShape.lineTo(-r, 0);
  const glass = new THREE.Mesh(new THREE.ShapeGeometry(glassShape, 24), M.glass);
  glass.rotation.y = Math.PI / 2;
  glass.position.set(xMid - 0.03, sill, z);
  glass.renderOrder = 2;
  g.add(glass);

  const sillSlab = box(0.4, 0.05, w + 0.16, M.slabWarm);
  sillSlab.position.set(x0 - 0.06, sill - 0.025, z);
  g.add(sillSlab);
  return g;
}

function door(M) {
  const g = new THREE.Group();
  const { x, w, h } = DOOR;
  const z = z1 + T / 2;
  const t = 0.05;
  for (const [fw, fh, fx, fy] of [[w, t, x, h - t / 2], [w, t, x, t / 2], [w, t, x, 1.05]]) g.add(place(box(fw, fh, t, M.blackSteel), fx, fy, z));
  for (const fx of [x - w / 2 + t / 2, x + w / 2 - t / 2, x]) g.add(place(box(t, h, t, M.blackSteel), fx, h / 2, z));
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(w, h), M.glass);
  glass.position.set(x, h / 2, z + 0.01);
  glass.rotation.y = Math.PI;
  g.add(glass);
  g.add(place(box(0.03, 0.5, 0.03, M.brass), x + 0.12, 1.1, z - 0.06));
  // Travertine threshold across the wall's depth, and a mat.
  g.add(place(box(w, 0.012, T + 0.02, M.slabWarm, { cast: false }), x, 0.006, z1 + T / 2));
  g.add(place(box(1.2, 0.012, 0.7, new THREE.MeshStandardMaterial({ color: 0x9a8a74, roughness: 1 }), { cast: false }), x, 0.006, z1 - 0.45));
  return g;
}

/** Soft morning street: haze, a limestone façade across the road, trees. Unlit and a touch overexposed. */
function streetBackdrop() {
  const c = document.createElement('canvas');
  c.width = 1024; c.height = 512;
  const ctx = c.getContext('2d');
  const sky = ctx.createLinearGradient(0, 0, 0, 512);
  sky.addColorStop(0, '#fbf6ee'); sky.addColorStop(0.55, '#f7ecdc'); sky.addColorStop(1, '#efe0c9');
  ctx.fillStyle = sky; ctx.fillRect(0, 0, 1024, 512);
  ctx.fillStyle = 'rgba(232,218,196,0.9)'; ctx.fillRect(0, 150, 1024, 362);
  ctx.fillStyle = 'rgba(214,196,168,0.55)';
  for (let px = 30; px < 1024; px += 150) { ctx.fillRect(px, 200, 60, 90); ctx.fillRect(px, 330, 60, 90); }
  const blob = (bx, by, br, a) => {
    const gr = ctx.createRadialGradient(bx, by, 0, bx, by, br);
    gr.addColorStop(0, `rgba(150,160,128,${a})`); gr.addColorStop(1, 'rgba(150,160,128,0)');
    ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(bx, by, br, 0, Math.PI * 2); ctx.fill();
  };
  for (let i = 0; i < 40; i++) blob(Math.random() * 1024, 120 + Math.random() * 160, 40 + Math.random() * 90, 0.18 + Math.random() * 0.2);
  const haze = ctx.createLinearGradient(0, 0, 0, 512);
  haze.addColorStop(0, 'rgba(255,250,242,0.2)'); haze.addColorStop(0.7, 'rgba(255,248,236,0.55)'); haze.addColorStop(1, 'rgba(255,248,236,0.3)');
  ctx.fillStyle = haze; ctx.fillRect(0, 0, 1024, 512);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return new THREE.MeshBasicMaterial({ map: t, toneMapped: false, fog: false });
}
