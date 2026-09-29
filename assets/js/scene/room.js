import * as THREE from 'three';
import { ROOM, WINDOWS, DOOR, SUN } from './layout.js';
import { mesh, box, cyl, place, group, aoStrip } from './helpers.js';

// The shell: floor, walls with real arched openings (so the sun throws arch-shaped
// patches across the travertine), ceiling, window steel, the street outside, and light.

export function buildRoom(scene, M, quality) {
  const root = new THREE.Group();
  root.name = 'room';
  scene.add(root);

  const W = ROOM.x1 - ROOM.x0, D = ROOM.z1 - ROOM.z0, H = ROOM.h;

  // --- Floor & ceiling -----------------------------------------------------
  const floorGeo = new THREE.PlaneGeometry(W, D);
  floorGeo.rotateX(-Math.PI / 2);
  const floor = mesh(floorGeo, M.floor, { cast: false });
  floor.name = 'floor';
  root.add(floor);

  const ceil = box(W + 0.4, 0.2, D + 0.4, M.ceiling, { receive: true });
  ceil.position.y = H + 0.1;
  root.add(ceil);

  // --- Walls ---------------------------------------------------------------
  root.add(place(box(W + 0.4, H, 0.2, M.plaster), 0, H / 2, ROOM.z0 - 0.1));   // back
  root.add(place(box(0.2, H, D + 0.4, M.plaster), ROOM.x1 + 0.1, H / 2, 0));   // right (lounge)

  // Front wall, with the street door.
  const leftW = DOOR.x - DOOR.w / 2 - ROOM.x0, rightW = ROOM.x1 - (DOOR.x + DOOR.w / 2);
  root.add(place(box(leftW, H, 0.2, M.plaster), ROOM.x0 + leftW / 2, H / 2, ROOM.z1 + 0.1));
  root.add(place(box(rightW, H, 0.2, M.plaster), ROOM.x1 - rightW / 2, H / 2, ROOM.z1 + 0.1));
  root.add(place(box(DOOR.w, H - DOOR.h, 0.2, M.plaster), DOOR.x, DOOR.h + (H - DOOR.h) / 2, ROOM.z1 + 0.1));

  // Window wall: an extruded shape with arched holes. Shape u = world z, v = world y.
  const shape = new THREE.Shape();
  shape.moveTo(ROOM.z0 - 0.2, 0);
  shape.lineTo(ROOM.z1 + 0.2, 0);
  shape.lineTo(ROOM.z1 + 0.2, H);
  shape.lineTo(ROOM.z0 - 0.2, H);
  shape.lineTo(ROOM.z0 - 0.2, 0);
  for (const win of WINDOWS) shape.holes.push(archPath(win));
  const wallGeo = new THREE.ExtrudeGeometry(shape, { depth: 0.36, bevelEnabled: false, curveSegments: 28 });
  const windowWall = mesh(wallGeo, M.plaster);
  windowWall.rotation.y = -Math.PI / 2;   // local x → world z, extrusion → world -x
  windowWall.position.x = ROOM.x0;
  root.add(windowWall);

  for (const win of WINDOWS) root.add(windowAssembly(win, M));

  // Skirting in travertine.
  const sk = 0.11;
  root.add(place(box(W, sk, 0.025, M.slabWarm, { cast: false }), 0, sk / 2, ROOM.z0 + 0.0125));
  root.add(place(box(0.025, sk, D, M.slabWarm, { cast: false }), ROOM.x1 - 0.0125, sk / 2, 0));
  root.add(place(box(leftW, sk, 0.025, M.slabWarm, { cast: false }), ROOM.x0 + leftW / 2, sk / 2, ROOM.z1 - 0.0125));
  root.add(place(box(rightW, sk, 0.025, M.slabWarm, { cast: false }), ROOM.x1 - rightW / 2, sk / 2, ROOM.z1 - 0.0125));

  // --- The street outside --------------------------------------------------
  const outside = streetBackdrop();
  const west = new THREE.Mesh(new THREE.PlaneGeometry(40, 16), outside);
  west.position.set(ROOM.x0 - 5, 4, 0);
  west.rotation.y = Math.PI / 2;
  root.add(west);
  const south = new THREE.Mesh(new THREE.PlaneGeometry(24, 14), outside);
  south.position.set(0, 4, ROOM.z1 + 5);
  south.rotation.y = Math.PI;
  root.add(south);

  // Street door: steel-framed glass.
  root.add(door(M));

  // --- Corner occlusion ----------------------------------------------------
  const strips = new THREE.Group();
  const floorStrip = (len, x, z, ry, width = 0.55, opacity = 0.3) => {
    const s = aoStrip(len, width, opacity);
    s.rotation.x = -Math.PI / 2;
    const g = new THREE.Group(); g.add(s);
    g.position.set(x, 0.003, z); g.rotation.y = ry;
    strips.add(g);
  };
  floorStrip(W, 0, ROOM.z0, 0);
  floorStrip(D, ROOM.x1, 0, -Math.PI / 2);
  floorStrip(W, 0, ROOM.z1, Math.PI);
  floorStrip(D, ROOM.x0, 0, Math.PI / 2, 0.4, 0.2);
  const wallStrip = (len, x, z, ry, atCeiling, width, opacity) => {
    const s = aoStrip(len, width, opacity);
    if (!atCeiling) s.rotation.z = Math.PI;
    const g = new THREE.Group(); g.add(s);
    g.position.set(x, atCeiling ? H : 0, z); g.rotation.y = ry;
    strips.add(g);
  };
  const walls = [[W, 0, ROOM.z0 + 0.004, 0], [D, ROOM.x1 - 0.004, 0, -Math.PI / 2], [W, 0, ROOM.z1 - 0.004, Math.PI], [D, ROOM.x0 + 0.004, 0, Math.PI / 2]];
  for (const [len, x, z, ry] of walls) {
    wallStrip(len, x, z, ry, false, 0.45, 0.22);
    wallStrip(len, x, z, ry, true, 0.9, 0.2);
  }
  root.add(strips);

  // --- Light ---------------------------------------------------------------
  const sun = new THREE.DirectionalLight(SUN.color, 4.6);
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

  // Sky bounce from the windows and a warm fill that stands in for light off the travertine.
  const hemi = new THREE.HemisphereLight(0xfff0db, 0xdcc4a0, 0.74);
  root.add(hemi);
  const fill = new THREE.DirectionalLight(0xffe8d0, 0.28);
  fill.position.set(6, 5, 7);
  root.add(fill);
  const back = new THREE.DirectionalLight(0xfff0dd, 0.2);
  back.position.set(2, 6, -8);
  root.add(back);

  return { root, sun, windowWall };
}

function archPath({ z, w, sill }) {
  const r = w / 2, spring = sill + 1.9;
  const p = new THREE.Path();
  p.moveTo(z - r, sill);
  p.lineTo(z + r, sill);
  p.lineTo(z + r, spring);
  p.absarc(z, spring, r, 0, Math.PI, false);
  p.lineTo(z - r, sill);
  return p;
}

/** Steel frame, glazing bars, glass and a travertine sill for one arched window. */
function windowAssembly(win, M) {
  const { z, w, sill } = win;
  const r = w / 2, spring = sill + 1.9;
  const g = new THREE.Group();
  const bar = 0.035, xMid = ROOM.x0 - 0.2;

  // Arched outer frame: a thin extruded ring.
  const outer = new THREE.Shape();
  outer.moveTo(-r, 0); outer.lineTo(r, 0); outer.lineTo(r, spring - sill);
  outer.absarc(0, spring - sill, r, 0, Math.PI, false); outer.lineTo(-r, 0);
  const inner = new THREE.Path();
  const ri = r - 0.05;
  inner.moveTo(-ri, 0.05); inner.lineTo(ri, 0.05); inner.lineTo(ri, spring - sill);
  inner.absarc(0, spring - sill, ri, 0, Math.PI, false); inner.lineTo(-ri, 0.05);
  outer.holes.push(inner);
  const frame = mesh(new THREE.ExtrudeGeometry(outer, { depth: 0.05, bevelEnabled: false, curveSegments: 28 }), M.blackSteel, { uv: false });
  frame.rotation.y = -Math.PI / 2;
  frame.position.set(xMid + 0.025, sill, z);
  g.add(frame);

  // Glazing bars.
  const vbar = box(bar, spring - sill + r - 0.06, bar, M.blackSteel);
  vbar.position.set(xMid, sill + (spring - sill + r) / 2, z);
  g.add(vbar);
  for (const dz of [-r / 2, r / 2]) {
    const v = box(bar * 0.8, spring - sill - 0.08, bar * 0.8, M.blackSteel);
    v.position.set(xMid, sill + (spring - sill) / 2, z + dz);
    g.add(v);
  }
  for (const y of [spring, sill + (spring - sill) * 0.52]) {
    const h = box(bar, bar, w - 0.08, M.blackSteel);
    h.position.set(xMid, y, z);
    g.add(h);
  }
  // Radial bars in the fanlight.
  for (const a of [Math.PI / 4, (3 * Math.PI) / 4]) {
    const len = r - 0.06;
    const rb = box(bar * 0.8, len, bar * 0.8, M.blackSteel);
    rb.position.set(xMid, spring + Math.sin(a) * len / 2, z + Math.cos(a) * len / 2);
    rb.rotation.x = Math.PI / 2 - a;
    g.add(rb);
  }

  // Glass (doesn't block the sun).
  const glassShape = new THREE.Shape();
  glassShape.moveTo(-r, 0); glassShape.lineTo(r, 0); glassShape.lineTo(r, spring - sill);
  glassShape.absarc(0, spring - sill, r, 0, Math.PI, false); glassShape.lineTo(-r, 0);
  const glass = new THREE.Mesh(new THREE.ShapeGeometry(glassShape, 24), M.glass);
  glass.rotation.y = Math.PI / 2;
  glass.position.set(xMid - 0.03, sill, z);
  glass.renderOrder = 2;
  g.add(glass);

  // Deep travertine sill.
  const sillSlab = box(0.46, 0.05, w + 0.16, M.slabWarm);
  sillSlab.position.set(ROOM.x0 - 0.1, sill - 0.025, z);
  g.add(sillSlab);
  return g;
}

function door(M) {
  const g = new THREE.Group();
  const { x, w, h } = DOOR;
  const z = ROOM.z1 + 0.05;
  const t = 0.05;
  const frame = [
    [w, t, x, h - t / 2], [w, t, x, t / 2], [w, t, x, 1.05],
  ];
  for (const [fw, fh, fx, fy] of frame) g.add(place(box(fw, fh, t, M.blackSteel), fx, fy, z));
  for (const fx of [x - w / 2 + t / 2, x + w / 2 - t / 2, x]) g.add(place(box(t, h, t, M.blackSteel), fx, h / 2, z));
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(w, h), M.glass);
  glass.position.set(x, h / 2, z + 0.01);
  glass.rotation.y = Math.PI;
  g.add(glass);
  const handle = box(0.03, 0.5, 0.03, M.brass);
  handle.position.set(x + 0.12, 1.1, z - 0.06);
  g.add(handle);
  const mat = box(1.2, 0.012, 0.7, new THREE.MeshStandardMaterial({ color: 0x3b2f27, roughness: 1 }), { cast: false });
  mat.position.set(x, 0.006, ROOM.z1 - 0.45);
  g.add(mat);
  return g;
}

/** Soft morning street: haze, a limestone façade across the road, trees. Unlit and a touch overexposed. */
function streetBackdrop() {
  const c = document.createElement('canvas');
  c.width = 1024; c.height = 512;
  const ctx = c.getContext('2d');
  const sky = ctx.createLinearGradient(0, 0, 0, 512);
  sky.addColorStop(0, '#fbf6ee');
  sky.addColorStop(0.55, '#f7ecdc');
  sky.addColorStop(1, '#efe0c9');
  ctx.fillStyle = sky; ctx.fillRect(0, 0, 1024, 512);
  // Building across the street.
  ctx.fillStyle = 'rgba(232,218,196,0.9)';
  ctx.fillRect(0, 150, 1024, 362);
  ctx.fillStyle = 'rgba(214,196,168,0.55)';
  for (let x = 30; x < 1024; x += 150) {
    ctx.fillRect(x, 200, 60, 90);
    ctx.fillRect(x, 330, 60, 90);
  }
  // Trees, very soft.
  const blob = (x, y, r, a) => {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(150,160,128,${a})`);
    g.addColorStop(1, 'rgba(150,160,128,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  };
  for (let i = 0; i < 40; i++) blob(Math.random() * 1024, 120 + Math.random() * 160, 40 + Math.random() * 90, 0.18 + Math.random() * 0.2);
  // Haze.
  const haze = ctx.createLinearGradient(0, 0, 0, 512);
  haze.addColorStop(0, 'rgba(255,250,242,0.2)');
  haze.addColorStop(0.7, 'rgba(255,248,236,0.55)');
  haze.addColorStop(1, 'rgba(255,248,236,0.3)');
  ctx.fillStyle = haze; ctx.fillRect(0, 0, 1024, 512);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return new THREE.MeshBasicMaterial({ map: t, toneMapped: false, fog: false });
}

export { archPath };
