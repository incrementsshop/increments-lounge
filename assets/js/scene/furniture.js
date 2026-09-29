import * as THREE from 'three';
import { mesh, box, cyl, lathe, place, group, contactShadow, canvasTexture } from './helpers.js';
import { applyBoxUV } from './materials.js';
import * as L from './layout.js';

// Everything that stands in the room. Products go on/in these pieces later
// (displays.js) via the `anchors` each builder records.

export function buildFurniture(scene, M, quality) {
  const root = new THREE.Group();
  root.name = 'furniture';
  scene.add(root);
  const A = { steam: [], lights: [] };

  root.add(counter(M, A));
  root.add(backbar(M, A));
  root.add(windowDisplay(M, A));
  root.add(movement(M, A));
  root.add(lounge(M, A));
  root.add(archive(M, A));
  root.add(noticeBoard(M, A));
  root.add(communalTable(M, A));
  root.add(pendants(M, A));
  root.add(plants(M, quality));
  return { root, anchors: A };
}
export default buildFurniture;

// ---------------------------------------------------------------------------
// Small objects
// ---------------------------------------------------------------------------

const CUP = [[0, 0], [0.032, 0], [0.036, 0.004], [0.042, 0.055], [0.044, 0.068], [0.041, 0.068], [0.038, 0.012], [0, 0.012]];
const SAUCER = [[0, 0], [0.058, 0], [0.068, 0.008], [0.072, 0.013], [0.066, 0.014], [0.05, 0.006], [0, 0.007]];
const ESPRESSO_CUP = [[0, 0], [0.022, 0], [0.026, 0.004], [0.03, 0.04], [0.031, 0.05], [0.028, 0.05], [0.026, 0.01], [0, 0.01]];

function cup(M, { coffee = true, saucer = true, small = false } = {}) {
  const g = new THREE.Group();
  const c = lathe(small ? ESPRESSO_CUP : CUP, M.ceramic, { segments: 24 });
  c.position.y = saucer ? 0.012 : 0;
  g.add(c);
  const handle = new THREE.Mesh(new THREE.TorusGeometry(small ? 0.012 : 0.017, 0.004, 6, 12, Math.PI), M.ceramic);
  handle.rotation.z = -Math.PI / 2;
  handle.position.set(small ? 0.03 : 0.044, (saucer ? 0.012 : 0) + (small ? 0.028 : 0.038), 0);
  g.add(handle);
  if (coffee) {
    const top = new THREE.Mesh(new THREE.CircleGeometry(small ? 0.026 : 0.039, 20), M.crema);
    top.rotation.x = -Math.PI / 2;
    top.position.y = (saucer ? 0.012 : 0) + (small ? 0.042 : 0.058);
    g.add(top);
  }
  if (saucer) g.add(lathe(SAUCER, M.ceramic, { segments: 24 }));
  g.traverse(o => { o.castShadow = true; });
  return g;
}

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
  for (let i = 0; i < stems; i++) {
    const a = (i / stems) * Math.PI * 2, lean = 0.12 + Math.random() * 0.15, len = (0.5 + Math.random() * 0.35) * scale;
    const pts = [new THREE.Vector3(0, 0.2 * scale, 0), new THREE.Vector3(Math.cos(a) * lean * 0.4, 0.2 * scale + len * 0.5, Math.sin(a) * lean * 0.4), new THREE.Vector3(Math.cos(a) * lean, 0.2 * scale + len, Math.sin(a) * lean)];
    const t = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 8, 0.004, 5), twig);
    t.castShadow = true;
    g.add(t);
    for (let k = 0; k < 6; k++) {
      const p = new THREE.CatmullRomCurve3(pts).getPoint(0.45 + k * 0.09);
      const bud = new THREE.Mesh(new THREE.SphereGeometry(0.012 * scale, 6, 5), new THREE.MeshStandardMaterial({ color: 0xd9c7a4, roughness: 1 }));
      bud.position.copy(p).add(new THREE.Vector3((Math.random() - 0.5) * 0.03, 0, (Math.random() - 0.5) * 0.03));
      bud.scale.set(1, 1.8, 1);
      g.add(bud);
    }
  }
  return g;
}

function coffeeBag(M, label = true) {
  const tex = canvasTexture(256, 400, (ctx, w, h) => {
    ctx.fillStyle = '#e9dfcd'; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#2a1d16';
    ctx.font = '500 26px "Bodoni Moda", serif';
    ctx.textAlign = 'center';
    ctx.letterSpacing = '6px';
    ctx.fillText('INCREMENTS', w / 2, 150);
    ctx.font = 'italic 22px "Bodoni Moda", serif';
    ctx.letterSpacing = '0px';
    ctx.fillText('House blend', w / 2, 196);
    ctx.font = '14px "Azeret Mono", monospace';
    ctx.fillText('ONE SMALL STEP · 340 G', w / 2, 240);
    ctx.fillStyle = '#8c2027'; ctx.fillRect(w / 2 - 30, 262, 60, 3);
  });
  const face = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85 });
  const plain = new THREE.MeshStandardMaterial({ color: 0xe9dfcd, roughness: 0.85 });
  const g = new THREE.BoxGeometry(0.12, 0.19, 0.07);
  const b = new THREE.Mesh(g, label ? [plain, plain, plain, plain, face, plain] : plain);
  b.castShadow = b.receiveShadow = true;
  const fold = box(0.12, 0.03, 0.02, plain);
  fold.position.y = 0.105;
  return group(b, fold);
}

// ---------------------------------------------------------------------------
// The counter
// ---------------------------------------------------------------------------

function counter(M, A) {
  const { x, z, w, d, h } = L.COUNTER;
  const g = new THREE.Group();
  g.name = 'counter';

  const core = box(w - 0.04, h - 0.1, d - 0.08, M.slab);
  core.position.set(x, 0.1 + (h - 0.1) / 2, z - 0.02);
  g.add(core);
  g.add(place(box(w - 0.1, 0.1, d - 0.16, M.blackSteel, { cast: false }), x, 0.05, z - 0.04));

  // Fluted travertine front — the signature piece.
  const fr = 0.036, pitch = 0.075, fh = h - 0.115;
  const fluteGeo = new THREE.CylinderGeometry(fr, fr, fh, 12, 1, true, -Math.PI / 2, Math.PI);
  applyBoxUV(fluteGeo, M.slab.userData.uv, [0.3, 0.2]);
  const n = Math.floor((w - 0.08) / pitch);
  const flutes = new THREE.InstancedMesh(fluteGeo, M.slab, n);
  const m4 = new THREE.Matrix4();
  const frontZ = z - 0.02 + (d - 0.08) / 2;
  for (let i = 0; i < n; i++) {
    m4.makeTranslation(x - ((n - 1) * pitch) / 2 + i * pitch, 0.1 + fh / 2 + 0.005, frontZ);
    flutes.setMatrixAt(i, m4);
  }
  flutes.castShadow = flutes.receiveShadow = true;
  g.add(flutes);

  const top = box(w + 0.1, 0.05, d + 0.12, M.slabWarm, { r: 0.012, seg: 2 });
  top.position.set(x, h + 0.025, z);
  g.add(top);
  g.add(place(contactShadow(w, d + 0.1, { opacity: 0.55 }), x, 0, z));

  const topY = h + 0.05;
  A.counter = { x, z, topY, frontZ };

  // Espresso machine.
  const em = espressoMachine(M);
  em.position.set(x - 1.35, topY, z - 0.08);
  g.add(em);
  A.steam.push(new THREE.Vector3(x - 1.35 - 0.18, topY + 0.16, z + 0.17), new THREE.Vector3(x - 1.35 + 0.18, topY + 0.16, z + 0.17));

  // Grinder.
  const gr = new THREE.Group();
  gr.add(place(box(0.2, 0.34, 0.26, M.steel, { r: 0.03 }), 0, 0.17, 0));
  gr.add(place(lathe([[0.012, 0], [0.09, 0.18], [0.1, 0.22], [0.095, 0.22], [0.01, 0.01]], M.glass, { cast: false }), 0, 0.34, 0));
  gr.add(place(lathe([[0.012, 0], [0.078, 0.14], [0, 0.14]], M.beans), 0, 0.35, 0));
  gr.add(place(cyl(0.1, 0.1, 0.02, M.ceramicDark), 0, 0.57, 0));
  gr.position.set(x - 0.62, topY, z - 0.12);
  g.add(gr);

  // Cup stacks.
  for (let s = 0; s < 3; s++) {
    for (let k = 0; k < 3 + s % 2; k++) {
      const c = cup(M, { coffee: false, saucer: k === 0 });
      c.position.set(x - 2.25 + s * 0.13, topY + k * 0.058, z - 0.18 + (s % 2) * 0.05);
      g.add(c);
    }
  }
  // A flat white waiting on the pass.
  const fw = cup(M);
  fw.position.set(x - 0.2, topY, z + 0.18);
  g.add(fw);
  A.steam.push(new THREE.Vector3(x - 0.2, topY + 0.08, z + 0.18));

  // "At the till": glass case for socks and caps.
  const tillX = x + 1.45, tillZ = z - 0.02;
  const tc = new THREE.Group();
  tc.add(place(box(1.02, 0.045, 0.52, M.steel), 0, 0.0225, 0));
  tc.add(place(box(0.98, 0.02, 0.46, M.slabWarm), 0, 0.215, -0.01));
  const glassBox = box(1.0, 0.38, 0.5, M.glass, { cast: false, receive: false });
  glassBox.position.y = 0.235;
  glassBox.renderOrder = 3;
  tc.add(glassBox);
  for (const [ex, ez] of [[-0.5, -0.25], [0.5, -0.25], [-0.5, 0.25], [0.5, 0.25]]) tc.add(place(box(0.012, 0.38, 0.012, M.steel), ex, 0.235, ez));
  tc.add(place(box(1.0, 0.012, 0.5, M.steel), 0, 0.43, 0));
  tc.position.set(tillX, topY, tillZ);
  g.add(tc);
  A.till = { x: tillX, z: tillZ, shelves: [topY + 0.045, topY + 0.225], width: 0.9 };

  // Register, bell and a stack of stamp cards.
  const reg = new THREE.Group();
  const screen = box(0.25, 0.17, 0.014, M.blackSteel, { r: 0.006, seg: 2 });
  screen.position.set(0, 0.2, 0);
  screen.rotation.x = -0.35;
  reg.add(screen, place(cyl(0.012, 0.012, 0.16, M.steel), 0, 0.08, -0.03), place(cyl(0.06, 0.07, 0.012, M.steel), 0, 0.006, -0.03));
  reg.position.set(x + 2.3, topY, z - 0.1);
  reg.rotation.y = -0.4;
  g.add(reg);
  const bell = lathe([[0, 0], [0.045, 0], [0.045, 0.006], [0.036, 0.018], [0.03, 0.045], [0.012, 0.055], [0, 0.056]], M.brass);
  bell.position.set(x + 2.05, topY, z + 0.2);
  g.add(bell);
  for (let k = 0; k < 6; k++) {
    const card = box(0.09, 0.003, 0.055, M.paper, { cast: k === 5 });
    card.position.set(x + 1.92 + (Math.random() - 0.5) * 0.004, topY + 0.0015 + k * 0.003, z + 0.06);
    card.rotation.y = 0.2 + (Math.random() - 0.5) * 0.08;
    g.add(card);
  }
  return g;
}

function espressoMachine(M) {
  const g = new THREE.Group();
  g.add(place(box(0.78, 0.42, 0.46, M.steel, { r: 0.035 }), 0, 0.3, -0.04));
  for (const sx of [-1, 1]) g.add(place(box(0.014, 0.4, 0.43, M.enamel, { r: 0.006, seg: 2 }), sx * 0.392, 0.3, -0.04));
  for (const [fx, fz] of [[-0.33, -0.2], [0.33, -0.2], [-0.33, 0.14], [0.33, 0.14]]) g.add(place(cyl(0.018, 0.022, 0.08, M.blackSteel), fx, 0.04, fz));
  g.add(place(box(0.72, 0.025, 0.16, M.steel), 0, 0.1, 0.18));

  for (const sx of [-0.18, 0.18]) {
    g.add(place(box(0.13, 0.08, 0.08, M.steel, { r: 0.015 }), sx, 0.36, 0.21));
    g.add(place(cyl(0.05, 0.05, 0.05, M.steel), sx, 0.3, 0.23));
    g.add(place(cyl(0.046, 0.04, 0.03, M.steel), sx, 0.262, 0.23));
    const handle = cyl(0.012, 0.015, 0.14, M.walnut);
    handle.rotation.x = Math.PI / 2 - 0.25;
    handle.position.set(sx, 0.245, 0.32);
    g.add(handle);
    const c = cup(M, { saucer: false, small: true, coffee: true });
    c.position.set(sx, 0.113, 0.23);
    g.add(c);
  }
  // Gauges.
  for (const gx of [-0.09, 0.09]) {
    const bezel = cyl(0.036, 0.036, 0.012, M.brass);
    bezel.rotation.x = Math.PI / 2;
    bezel.position.set(gx, 0.44, 0.195);
    const face = new THREE.Mesh(new THREE.CircleGeometry(0.03, 24), M.ceramic);
    face.position.set(gx, 0.44, 0.202);
    g.add(bezel, face);
  }
  // Steam wands.
  for (const sx of [-1, 1]) {
    const pts = [[0.34, 0.4, 0.12], [0.43, 0.36, 0.18], [0.46, 0.25, 0.22], [0.47, 0.12, 0.23]].map(([a, b, c]) => new THREE.Vector3(a * sx, b, c));
    const t = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 16, 0.008, 6), M.steel);
    t.castShadow = true;
    g.add(t);
  }
  // Cups warming on top.
  for (let i = 0; i < 6; i++) {
    const c = lathe(ESPRESSO_CUP, M.ceramic, { segments: 16 });
    c.rotation.x = Math.PI;
    c.position.set(-0.25 + (i % 3) * 0.1, 0.58, -0.12 + Math.floor(i / 3) * 0.1);
    g.add(c);
  }
  g.add(place(box(0.7, 0.02, 0.3, M.steel), 0, 0.52, -0.08));
  g.add(place(box(0.16, 0.035, 0.004, M.brass), 0, 0.2, 0.19));
  return g;
}

// ---------------------------------------------------------------------------
// Backbar, cladding and the menu board frame
// ---------------------------------------------------------------------------

function backbar(M, A) {
  const g = new THREE.Group();
  const z0 = L.ROOM.z0;
  const cx = L.COUNTER.x;

  const clad = box(6.3, 3.62, 0.05, M.cladding, { cast: false });
  clad.position.set(cx, 1.81, z0 + 0.025);
  g.add(clad);

  const cab = box(5.9, 0.86, 0.56, M.walnut);
  cab.position.set(cx, 0.43 + 0.02, L.BACKBAR.z - 0.02);
  g.add(cab);
  // Door reveals.
  for (let i = 1; i < 8; i++) {
    const rev = box(0.006, 0.8, 0.004, M.blackSteel, { cast: false });
    rev.position.set(cx - 2.95 + i * (5.9 / 8), 0.46, L.BACKBAR.z + 0.262);
    g.add(rev);
  }
  g.add(place(box(6.0, 0.04, 0.62, M.slabWarm), cx, 0.9, L.BACKBAR.z));
  const topY = 0.92;

  // Pour-over station and kettle.
  const stand = box(0.34, 0.2, 0.14, M.walnut);
  stand.position.set(cx - 1.6, topY + 0.1, L.BACKBAR.z - 0.05);
  g.add(stand);
  for (const dx of [-0.08, 0.08]) {
    g.add(place(lathe([[0.012, 0], [0.055, 0.07], [0.06, 0.08], [0.056, 0.08], [0.01, 0.006]], M.ceramic), cx - 1.6 + dx, topY + 0.2, L.BACKBAR.z - 0.05));
    g.add(place(lathe([[0, 0], [0.045, 0], [0.05, 0.05], [0.04, 0.12], [0.035, 0.13], [0, 0.13]], M.glass, { cast: false }), cx - 1.6 + dx, topY, L.BACKBAR.z + 0.08));
  }
  const kettle = new THREE.Group();
  kettle.add(lathe([[0, 0], [0.07, 0], [0.075, 0.1], [0.05, 0.13], [0.02, 0.14], [0.02, 0.155], [0, 0.155]], M.steel));
  const spout = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(0.06, 0.03, 0), new THREE.Vector3(0.12, 0.08, 0), new THREE.Vector3(0.17, 0.15, 0), new THREE.Vector3(0.2, 0.16, 0)]), 12, 0.006, 6), M.steel);
  const kh = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.008, 6, 16, Math.PI), M.walnut);
  kh.position.set(-0.07, 0.09, 0);
  kh.rotation.z = Math.PI / 2;
  kettle.add(spout, kh);
  kettle.position.set(cx - 1.05, topY, L.BACKBAR.z);
  kettle.rotation.y = 0.5;
  g.add(kettle);

  for (let i = 0; i < 4; i++) {
    const bag = coffeeBag(M);
    bag.position.set(cx + 1.25 + i * 0.15, topY + 0.095, L.BACKBAR.z + 0.05);
    bag.rotation.y = (Math.random() - 0.5) * 0.12;
    g.add(bag);
  }
  // A few glass jars of beans.
  for (let i = 0; i < 3; i++) {
    const jx = cx - 2.6 + i * 0.16;
    g.add(place(cyl(0.06, 0.06, 0.2, M.glass, { cast: false }), jx, topY + 0.1, L.BACKBAR.z));
    g.add(place(cyl(0.055, 0.055, 0.14 - i * 0.03, M.beans), jx, topY + 0.07 - i * 0.015, L.BACKBAR.z));
    g.add(place(cyl(0.064, 0.064, 0.02, M.walnut), jx, topY + 0.21, L.BACKBAR.z));
  }

  // Floating walnut shelves either side of the menu board.
  const shelfZ = z0 + 0.17;
  const shelves = [];
  for (const sx of [cx - 2.35, cx + 2.3]) {
    for (const sy of [1.48, 1.9]) {
      g.add(place(box(1.1, 0.035, 0.26, M.walnut), sx, sy, shelfZ));
      shelves.push({ x: sx, y: sy + 0.0175, z: shelfZ });
    }
  }
  // Shelf dressing: cups, a small plant, stacked saucers.
  const dress = [
    s => { for (let i = 0; i < 4; i++) { const c = cup(M, { coffee: false, saucer: false }); c.position.set(s.x - 0.4 + i * 0.1, s.y, s.z); c.rotation.y = 1.4; g.add(c); } },
    s => { const v = vase(M, M.ceramicDark, 0.8, 5); v.position.set(s.x + 0.3, s.y, s.z); g.add(v); for (let k = 0; k < 5; k++) g.add(place(lathe(SAUCER, M.ceramic, { segments: 20 }), s.x - 0.25, s.y + k * 0.014, s.z)); },
    s => { const b = coffeeBag(M); b.position.set(s.x - 0.3, s.y + 0.095, s.z); g.add(b); const b2 = coffeeBag(M); b2.position.set(s.x - 0.15, s.y + 0.095, s.z); g.add(b2); const v = vase(M, M.slab, 0.7); v.position.set(s.x + 0.3, s.y, s.z); g.add(v); },
    s => { for (let i = 0; i < 3; i++) { const c = cup(M, { coffee: false, saucer: true }); c.position.set(s.x - 0.3 + i * 0.16, s.y, s.z); g.add(c); } },
  ];
  shelves.forEach((s, i) => dress[i % dress.length](s));
  A.backbarShelves = shelves;

  // Menu board: walnut frame; the board face is painted by displays.js.
  const { x, y, z, w, h } = L.MENU_BOARD;
  const frameT = 0.05;
  for (const [fw, fh, fx, fy] of [[w + frameT * 2, frameT, x, y + h / 2 + frameT / 2], [w + frameT * 2, frameT, x, y - h / 2 - frameT / 2], [frameT, h, x - w / 2 - frameT / 2, y], [frameT, h, x + w / 2 + frameT / 2, y]]) {
    g.add(place(box(fw, fh, 0.05, M.walnut), fx, fy, z + 0.02));
  }
  const boardMat = new THREE.MeshStandardMaterial({ color: 0x2b1f18, roughness: 0.7 });
  const board = new THREE.Mesh(new THREE.PlaneGeometry(w, h), boardMat);
  board.position.set(x, y, z + 0.012);
  board.receiveShadow = true;
  board.name = 'menuBoard';
  g.add(board);
  A.menuBoard = board;

  // Picture light.
  const bar = cyl(0.016, 0.016, 1.6, M.brass);
  bar.rotation.z = Math.PI / 2;
  bar.position.set(x, y + h / 2 + 0.16, z + 0.2);
  const glow = box(1.5, 0.006, 0.02, new THREE.MeshBasicMaterial({ color: 0xfff0d6 }), { cast: false });
  glow.position.set(x, y + h / 2 + 0.143, z + 0.2);
  g.add(bar, glow);
  for (const ax of [-0.5, 0.5]) {
    const arm = cyl(0.006, 0.006, 0.2, M.brass);
    arm.rotation.x = Math.PI / 2;
    arm.position.set(x + ax, y + h / 2 + 0.16, z + 0.1);
    g.add(arm);
  }
  return g;
}

// ---------------------------------------------------------------------------
// The Window: stepped travertine plinths in the sun
// ---------------------------------------------------------------------------

function windowDisplay(M, A) {
  const g = new THREE.Group();
  const { x, z } = L.WINDOW_DISPLAY;
  const blocks = [
    { dz: -0.95, w: 0.66, d: 0.66, h: 0.34, mat: M.slab },
    { dz: 0.0, w: 0.95, d: 0.95, h: 0.14, mat: M.noce },
    { dz: 1.0, w: 0.62, d: 0.62, h: 0.52, mat: M.slab },
  ];
  A.outfits = [];
  for (const b of blocks) {
    const blk = box(b.w, b.h, b.d, b.mat, { r: 0.006, seg: 1 });
    blk.position.set(x, b.h / 2, z + b.dz);
    g.add(blk);
    g.add(place(contactShadow(b.w, b.d, { opacity: 0.45 }), x, 0, z + b.dz));
    A.outfits.push(new THREE.Vector3(x, b.h, z + b.dz));
  }
  // Engraved wordmark on the tall block.
  const tall = blocks[2];
  const engr = canvasTexture(1024, 860, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    ctx.textAlign = 'center';
    ctx.font = '500 92px "Bodoni Moda", serif';
    ctx.letterSpacing = '26px';
    ctx.fillStyle = 'rgba(255,250,240,0.55)';
    ctx.fillText('INCREMENTS', w / 2 + 13, 372);
    ctx.fillStyle = 'rgba(96,72,48,0.72)';
    ctx.fillText('INCREMENTS', w / 2 + 13, 368);
    ctx.font = 'italic 54px "Bodoni Moda", serif';
    ctx.letterSpacing = '2px';
    ctx.fillText('Still Becoming', w / 2, 470);
    ctx.font = '30px "Azeret Mono", monospace';
    ctx.letterSpacing = '10px';
    ctx.fillText('CHAPTER · MMXXVI', w / 2 + 5, 560);
  });
  const plate = new THREE.Mesh(new THREE.PlaneGeometry(tall.d, tall.h * 0.9), new THREE.MeshStandardMaterial({ map: engr, transparent: true, roughness: 0.7, polygonOffset: true, polygonOffsetFactor: -2 }));
  plate.rotation.y = Math.PI / 2;
  plate.position.set(x + tall.w / 2 + 0.002, tall.h * 0.5, z + tall.dz);
  g.add(plate);

  // A leaning campaign print between the windows.
  A.campaignPrint = { position: new THREE.Vector3(L.ROOM.x0 + 0.12, 0, 0.6), ry: Math.PI / 2 };

  // Dried stems on the far sill.
  const v = vase(M, M.noce, 1.2, 7);
  v.position.set(L.ROOM.x0 - 0.08, L.WINDOWS[1].sill, L.WINDOWS[1].z + 0.55);
  g.add(v);
  return g;
}

// ---------------------------------------------------------------------------
// Movement bar: steel rack, water & matcha ledge, round mirror
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

  // Water & matcha bar.
  const wb = L.WATER_BAR;
  const base = box(wb.w - 0.06, 0.98, 0.32, M.slab);
  base.position.set(wb.x, 0.49, wb.z);
  g.add(base);
  g.add(place(box(wb.w, 0.05, 0.38, M.slabWarm, { r: 0.01, seg: 2 }), wb.x, 1.005, wb.z + 0.02));
  g.add(place(contactShadow(wb.w, 0.36, { opacity: 0.5 }), wb.x, 0, wb.z));
  const top = 1.03;
  for (const dx of [-0.95, -0.72]) {
    g.add(place(lathe([[0, 0], [0.06, 0], [0.065, 0.12], [0.03, 0.2], [0.028, 0.26], [0.034, 0.27], [0, 0.27]], M.glass, { cast: false }), wb.x + dx, top, wb.z));
    g.add(place(lathe([[0, 0], [0.056, 0], [0.06, 0.1], [0, 0.1]], M.water, { cast: false }), wb.x + dx, top + 0.005, wb.z));
  }
  for (let i = 0; i < 4; i++) g.add(place(cyl(0.032, 0.028, 0.1, M.glass, { cast: false }), wb.x - 0.45 + i * 0.09, top + 0.05, wb.z + 0.08));
  for (const dx of [0.1, 0.32]) {
    g.add(place(lathe([[0, 0], [0.04, 0], [0.065, 0.03], [0.07, 0.07], [0.066, 0.07], [0.06, 0.035], [0, 0.012]], M.ceramic), wb.x + dx, top, wb.z + 0.02));
    const m = new THREE.Mesh(new THREE.CircleGeometry(0.058, 20), M.matcha);
    m.rotation.x = -Math.PI / 2;
    m.position.set(wb.x + dx, top + 0.055, wb.z + 0.02);
    g.add(m);
  }
  // Lemons in a travertine bowl.
  g.add(place(lathe([[0, 0], [0.08, 0], [0.13, 0.05], [0.14, 0.08], [0.13, 0.08], [0.07, 0.03], [0, 0.03]], M.slab), wb.x + 0.75, top, wb.z));
  const lemon = new THREE.MeshStandardMaterial({ color: 0xe6c350, roughness: 0.55 });
  for (let i = 0; i < 5; i++) {
    const l = new THREE.Mesh(new THREE.SphereGeometry(0.036, 12, 10), lemon);
    l.scale.set(1, 0.85, 1.25);
    l.position.set(wb.x + 0.75 + Math.cos(i * 1.3) * 0.05, top + 0.07 + (i > 3 ? 0.04 : 0), wb.z + Math.sin(i * 1.3) * 0.05);
    l.rotation.y = i;
    l.castShadow = true;
    g.add(l);
  }
  // Rolled mats leaning on the bar.
  const matCols = [0x3c2a21, 0xd9d3c8, 0x6d1524];
  matCols.forEach((c, i) => {
    const mt = cyl(0.065, 0.065, 0.64, new THREE.MeshStandardMaterial({ color: c, roughness: 0.9 }));
    mt.position.set(wb.x + wb.w / 2 + 0.12 + i * 0.13, 0.33, wb.z + 0.16);
    mt.rotation.z = -0.12;
    g.add(mt);
  });

  // Round mirror.
  // A "reflection" painted from the room's own tones — reads as a mirror without a second render pass.
  const reflection = canvasTexture(256, 256, (ctx, w, h) => {
    const gr = ctx.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, '#f3ebdf'); gr.addColorStop(0.45, '#e6d9c6'); gr.addColorStop(0.62, '#cdb89b'); gr.addColorStop(1, '#bfa887');
    ctx.fillStyle = gr; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(255,248,236,0.55)'; ctx.fillRect(w * 0.62, h * 0.12, w * 0.16, h * 0.4);
    ctx.fillStyle = 'rgba(60,40,28,0.35)'; ctx.fillRect(0, h * 0.58, w, h * 0.04);
    const v = ctx.createRadialGradient(w / 2, h / 2, w * 0.2, w / 2, h / 2, w * 0.55);
    v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(40,28,20,0.25)');
    ctx.fillStyle = v; ctx.fillRect(0, 0, w, h);
  });
  const mirror = new THREE.Mesh(new THREE.CircleGeometry(0.5, 48), new THREE.MeshStandardMaterial({ color: 0x9a978f, emissive: 0xffffff, emissiveMap: reflection, emissiveIntensity: 0.62, metalness: 0.6, roughness: 0.12, envMapIntensity: 0.6 }));
  mirror.position.set(wb.x, 1.9, L.ROOM.z0 + 0.03);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.505, 0.018, 10, 64), M.brass);
  ring.position.copy(mirror.position);
  g.add(mirror, ring);
  return g;
}

// ---------------------------------------------------------------------------
// Lounge: leather banquette, travertine tables, bouclé chairs, the Worn rail
// ---------------------------------------------------------------------------

function lounge(M, A) {
  const g = new THREE.Group();
  const { x, z, len } = L.BANQUETTE;

  g.add(place(box(0.66, 0.2, len, M.walnut), x, 0.1, z));
  g.add(place(box(0.64, 0.17, len - 0.04, M.leather, { r: 0.05, seg: 3 }), x - 0.01, 0.285, z));
  const n = Math.floor(len / 0.31);
  const pitch = len / n;
  for (let i = 0; i < n; i++) {
    const ch = box(0.13, 0.6, pitch - 0.018, M.leather, { r: 0.05, seg: 3 });
    ch.position.set(x + 0.26, 0.7, z - len / 2 + pitch / 2 + i * pitch);
    ch.rotation.z = -0.12;
    g.add(ch);
  }
  g.add(place(box(0.16, 0.04, len, M.slabWarm), L.ROOM.x1 - 0.08, 1.04, z));
  g.add(place(contactShadow(0.7, len, { opacity: 0.5 }), x, 0, z));

  // Rug.
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

    // Chair across the table, facing the banquette.
    const ch = new THREE.Group();
    ch.add(place(box(0.66, 0.06, 0.66, M.walnut), 0, 0.03, 0));
    ch.add(place(box(0.74, 0.24, 0.76, M.boucle, { r: 0.1, seg: 4 }), 0, 0.26, 0));
    ch.add(place(box(0.2, 0.5, 0.76, M.boucle, { r: 0.09, seg: 4 }), -0.28, 0.58, 0));
    for (const sz of [-1, 1]) ch.add(place(box(0.64, 0.3, 0.16, M.boucle, { r: 0.075, seg: 4 }), 0.02, 0.48, sz * 0.31));
    ch.position.set(tx - 1.2, 0, tz);
    ch.rotation.y = tz < 0 ? 0.18 : -0.18;
    g.add(ch);
    g.add(place(contactShadow(0.8, 0.8, { opacity: 0.4 }), tx - 1.2, 0, tz));
  }
  // Table dressing.
  const [t1, t2] = A.loungeTables;
  const c1 = cup(M); c1.position.copy(t1).add(new THREE.Vector3(-0.12, 0, 0.1)); g.add(c1);
  A.steam.push(c1.position.clone().add(new THREE.Vector3(0, 0.1, 0)));
  const c2 = cup(M); c2.position.copy(t2).add(new THREE.Vector3(-0.15, 0, -0.08)); c2.rotation.y = 2; g.add(c2);
  A.steam.push(c2.position.clone().add(new THREE.Vector3(0, 0.1, 0)));
  const b1 = book(M, 0.16, 0.025, 0.23, 0x8c2027); b1.position.copy(t2).add(new THREE.Vector3(0.1, 0.0125, 0.12)); b1.rotation.y = 0.4; g.add(b1);
  const b2 = book(M, 0.15, 0.02, 0.21, 0xd9d3c8); b2.position.copy(t2).add(new THREE.Vector3(0.1, 0.037, 0.12)); b2.rotation.y = 0.2; g.add(b2);
  const v = vase(M, M.ceramic, 0.6, 3); v.position.copy(t1).add(new THREE.Vector3(0.12, 0, -0.1)); g.add(v);

  // Rail for the Worn pieces, on the wall above the banquette.
  const railX = L.ROOM.x1 - 0.14, railY = 2.95;
  const rail = cyl(0.014, 0.014, len - 0.3, M.steel);
  rail.rotation.x = Math.PI / 2;
  rail.position.set(railX, railY, z);
  g.add(rail);
  for (const bz of [-len / 2 + 0.3, 0, len / 2 - 0.3]) g.add(place(box(0.14, 0.03, 0.03, M.steel), railX + 0.06, railY, z + bz));
  A.loungeRail = { x: railX, y: railY, z0: z - len / 2 + 0.4, z1: z + len / 2 - 0.4 };
  return g;
}

// ---------------------------------------------------------------------------
// Archive: walnut bookshelf and a reading lamp
// ---------------------------------------------------------------------------

function archive(M, A) {
  const g = new THREE.Group();
  const { x, z, w, h } = L.ARCHIVE_SHELF;
  const d = 0.38;
  // Travertine back panel keeps the shelf from reading as a dark hole, and frames the spines.
  g.add(place(box(w, h, 0.02, M.slabWarm, { cast: false }), x, h / 2, z - d / 2 + 0.01));
  for (const sx of [-1, 1]) g.add(place(box(0.04, h, d, M.walnut), x + sx * (w / 2 - 0.02), h / 2, z));
  const levels = [0.06, 0.56, 1.06, 1.56, 2.06, h - 0.02];
  for (const ly of levels) g.add(place(box(w - 0.08, 0.03, d - 0.02, M.walnut), x, ly, z));
  g.add(place(box(w, 0.06, d, M.walnut), x, 0.03, z));
  // Warm strip light under each shelf.
  const strip = new THREE.MeshBasicMaterial({ color: 0xffe2b8 });
  for (const ly of levels.slice(1)) g.add(place(box(w - 0.12, 0.004, 0.012, strip, { cast: false, receive: false }), x, ly - 0.017, z + d / 2 - 0.05));
  const shelfLight = new THREE.PointLight(0xffd3a0, 1.4, 2.6, 2);
  shelfLight.position.set(x, 1.5, z + 0.45);
  g.add(shelfLight);
  A.lights.push(shelfLight);
  A.archiveShelves = levels.slice(0, -1).map(ly => ({ y: ly + 0.015, x0: x - w / 2 + 0.06, x1: x + w / 2 - 0.06, z: z + 0.02 }));
  g.add(place(contactShadow(w, d, { opacity: 0.45 }), x, 0, z));

  // Reading lamp.
  const lx = x + w / 2 + 0.45, lz = z + 0.55;
  g.add(place(cyl(0.15, 0.16, 0.025, M.noce), lx, 0.0125, lz));
  g.add(place(cyl(0.011, 0.011, 1.55, M.brass), lx, 0.8, lz));
  const shade = cyl(0.17, 0.23, 0.28, M.linenShade, { open: true, segments: 28, cast: false });
  shade.position.set(lx, 1.66, lz);
  g.add(shade);
  const bulb = new THREE.PointLight(0xffc98c, 1.1, 3.2, 2);
  bulb.position.set(lx, 1.6, lz);
  g.add(bulb);
  A.lights.push(bulb);
  return g;
}

// ---------------------------------------------------------------------------
// Notice board by the door
// ---------------------------------------------------------------------------

function noticeBoard(M, A) {
  const g = new THREE.Group();
  const { x, y, z, w, h } = L.NOTICE_BOARD;
  g.add(place(box(w, h, 0.025, M.cork, { cast: false }), x, y, z));
  const f = 0.045;
  for (const [fw, fh, fx, fy] of [[w + f * 2, f, x, y + h / 2 + f / 2], [w + f * 2, f, x, y - h / 2 - f / 2], [f, h, x - w / 2 - f / 2, y], [f, h, x + w / 2 + f / 2, y]]) {
    g.add(place(box(fw, fh, 0.045, M.walnut), fx, fy, z - 0.005));
  }
  A.board = { x, y, z: z - 0.014, w, h };

  const ledge = box(1.5, 0.03, 0.14, M.walnut);
  ledge.position.set(x, y - h / 2 - 0.2, z - 0.06);
  g.add(ledge);
  const ly = y - h / 2 - 0.185;
  g.add(place(lathe([[0, 0], [0.04, 0], [0.042, 0.1], [0.038, 0.1], [0.036, 0.008], [0, 0.008]], M.ceramicDark), x - 0.5, ly, z - 0.07));
  const pencil = new THREE.MeshStandardMaterial({ color: 0x2a1d16, roughness: 0.6 });
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
// Communal table: a long travertine slab on two plinths, drum stools, the day's papers
// ---------------------------------------------------------------------------

function communalTable(M, A) {
  const g = new THREE.Group();
  const { x, z, len, w } = L.COMMUNAL;
  const topY = 0.76;
  g.add(place(box(len, 0.06, w, M.slab, { r: 0.008, seg: 2 }), x, topY - 0.03, z));
  for (const sx of [-1, 1]) g.add(place(box(0.2, topY - 0.06, w - 0.22, M.slab), x + sx * (len / 2 - 0.45), (topY - 0.06) / 2, z));
  g.add(place(contactShadow(len, w, { opacity: 0.4 }), x, 0, z));
  const stool = new THREE.Group();
  stool.add(place(cyl(0.19, 0.2, 0.44, M.noce, { segments: 32 }), 0, 0.22, 0));
  stool.add(place(cyl(0.2, 0.2, 0.035, M.leather, { segments: 32 }), 0, 0.455, 0));
  const seats = [-0.8, 0, 0.8];
  for (const sx of seats) {
    for (const sz of [-1, 1]) {
      if (sz > 0 && sx === 0) continue; // a gap to walk through
      const s = stool.clone();
      s.position.set(x + sx, 0, z + sz * (w / 2 + 0.3));
      g.add(s, place(contactShadow(0.4, 0.4, { round: true, opacity: 0.4 }), x + sx, 0, z + sz * (w / 2 + 0.3)));
    }
  }
  const c1 = cup(M); c1.position.set(x - 0.75, topY, z - 0.15); g.add(c1);
  const c2 = cup(M); c2.position.set(x + 0.55, topY, z + 0.2); c2.rotation.y = 2.4; g.add(c2);
  A.steam.push(new THREE.Vector3(x - 0.75, topY + 0.09, z - 0.15));
  const b1 = book(M, 0.24, 0.02, 0.32, 0xefe6d6); b1.position.set(x + 0.1, topY + 0.01, z - 0.05); b1.rotation.y = 0.15; g.add(b1);
  const b2 = book(M, 0.22, 0.018, 0.29, 0x2a1d16); b2.position.set(x + 0.12, topY + 0.03, z - 0.04); b2.rotation.y = -0.1; g.add(b2);
  const v = vase(M, M.ceramic, 0.75, 4); v.position.set(x - 0.2, topY, z + 0.1); g.add(v);
  return g;
}

// ---------------------------------------------------------------------------
// Pendants (and the only point lights in the room)
// ---------------------------------------------------------------------------

function pendants(M, A) {
  const g = new THREE.Group();
  const H = L.ROOM.h;
  const spots = [
    [L.COUNTER.x - 2.0, 3.3, L.COUNTER.z + 0.1, 0.14],
    [L.COUNTER.x, 3.3, L.COUNTER.z + 0.1, 0.14],
    [L.COUNTER.x + 2.0, 3.3, L.COUNTER.z + 0.1, 0.14],
    ...L.LOUNGE_TABLES.map(([tx, tz]) => [tx, 1.7, tz, 0.15]),
    [-0.4, 3.3, 0.9, 0.22],
  ];
  const cord = new THREE.MeshStandardMaterial({ color: 0x1a1512, roughness: 0.6 });
  for (const [px, py, pz, r] of spots) {
    g.add(place(cyl(0.004, 0.004, H - py - r, cord, { segments: 6, cast: false }), px, (H + py + r) / 2, pz));
    g.add(place(cyl(0.05, 0.05, 0.02, M.brass, { cast: false }), px, H - 0.01, pz));
    g.add(place(cyl(0.02, 0.02, 0.04, M.brass, { cast: false }), px, py + r + 0.01, pz));
    const globe = new THREE.Mesh(new THREE.SphereGeometry(r, 32, 24), M.globe);
    globe.position.set(px, py, pz);
    g.add(globe);
  }
  const lights = [
    [L.COUNTER.x, 2.5, L.COUNTER.z + 0.4, 3.2, 7],
    [5.6, 1.55, 0.1, 2.4, 6],
    [-0.4, 3.0, 0.9, 1.6, 7],
  ];
  for (const [lx, ly, lz, intensity, dist] of lights) {
    const pl = new THREE.PointLight(0xffc995, intensity, dist, 2);
    pl.position.set(lx, ly, lz);
    g.add(pl);
    A.lights.push(pl);
  }
  return g;
}

// ---------------------------------------------------------------------------
// Plants: an olive in the corner, a fiddle-leaf by the lounge
// ---------------------------------------------------------------------------

function plants(M, quality) {
  const g = new THREE.Group();

  const pot = (x, z, scale, mat) => {
    const p = lathe([[0, 0], [0.3, 0], [0.34, 0.04], [0.37, 0.5], [0.35, 0.52], [0.33, 0.49], [0, 0.47]].map(([r, y]) => [r * scale, y * scale]), mat, { segments: 36 });
    p.position.set(x, 0, z);
    const soil = new THREE.Mesh(new THREE.CircleGeometry(0.33 * scale, 24), M.soil);
    soil.rotation.x = -Math.PI / 2;
    soil.position.set(x, 0.48 * scale, z);
    g.add(p, soil, place(contactShadow(0.7 * scale, 0.7 * scale, { round: true, opacity: 0.5 }), x, 0, z));
  };

  // Olive tree.
  const ox = L.ROOM.x0 + 0.85, oz = L.ROOM.z1 - 0.9;
  pot(ox, oz, 1.05, M.noce);
  const trunkPts = [[0, 0.45, 0], [0.04, 0.9, 0.02], [-0.03, 1.3, -0.02], [0.02, 1.7, 0.03]];
  const trunk = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(trunkPts.map(([a, b, c]) => new THREE.Vector3(ox + a, b, oz + c))), 20, 0.035, 8), M.trunk);
  trunk.castShadow = true;
  g.add(trunk);
  const tips = [];
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + 0.3;
    const start = new THREE.Vector3(ox, 1.25 + (i % 3) * 0.15, oz);
    const tip = new THREE.Vector3(ox + Math.cos(a) * 0.55, 1.75 + (i % 2) * 0.35, oz + Math.sin(a) * 0.5);
    const mid = start.clone().lerp(tip, 0.5).add(new THREE.Vector3(0, 0.12, 0));
    const br = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([start, mid, tip]), 10, 0.014, 5), M.trunk);
    br.castShadow = true;
    g.add(br);
    tips.push(tip, mid);
  }
  // Olive leaves: narrow lanceolate blades, slightly cupped.
  const blade = new THREE.Shape();
  blade.moveTo(0, 0);
  blade.quadraticCurveTo(0.014, 0.03, 0.002, 0.085);
  blade.quadraticCurveTo(-0.012, 0.03, 0, 0);
  const leafGeo = new THREE.ShapeGeometry(blade, 4);
  const leaves = new THREE.InstancedMesh(leafGeo, M.leaf, quality.leaves);
  const dummy = new THREE.Object3D();
  const silver = new THREE.Color(0xb6bea6), green = new THREE.Color(0x76866a);
  for (let i = 0; i < quality.leaves; i++) {
    const c = tips[i % tips.length];
    dummy.position.set(c.x + (Math.random() - 0.5) * 0.5, c.y + (Math.random() - 0.4) * 0.38, c.z + (Math.random() - 0.5) * 0.5);
    dummy.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI * 2, Math.random() * Math.PI);
    dummy.updateMatrix();
    leaves.setMatrixAt(i, dummy.matrix);
    leaves.setColorAt(i, Math.random() < 0.35 ? silver : green);
  }
  leaves.castShadow = true;
  g.add(leaves);

  // Fiddle-leaf fig by the lounge.
  const fx = L.ROOM.x1 - 0.7, fz = L.ROOM.z1 - 0.75;
  pot(fx, fz, 0.95, M.slab);
  const stem = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(fx, 0.45, fz), new THREE.Vector3(fx - 0.05, 1.2, fz + 0.03), new THREE.Vector3(fx + 0.02, 2.0, fz - 0.02)]), 16, 0.02, 6), M.trunk);
  g.add(stem);
  const leafShape = new THREE.Shape();
  leafShape.moveTo(0, 0);
  leafShape.bezierCurveTo(0.12, 0.05, 0.14, 0.22, 0, 0.3);
  leafShape.bezierCurveTo(-0.14, 0.22, -0.12, 0.05, 0, 0);
  const bigLeafGeo = new THREE.ShapeGeometry(leafShape, 8);
  const fig = new THREE.MeshStandardMaterial({ color: 0x3f5a39, roughness: 0.55, side: THREE.DoubleSide });
  const n = 34;
  const figLeaves = new THREE.InstancedMesh(bigLeafGeo, fig, n);
  for (let i = 0; i < n; i++) {
    const t = 0.25 + (i / n) * 0.75;
    const a = i * 2.4;
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
