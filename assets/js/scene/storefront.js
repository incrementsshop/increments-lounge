import * as THREE from 'three';
import { mesh, box, cyl, place, contactShadow, canvasTexture } from './helpers.js';
import { applyBoxUV } from './materials.js';
import { olive, bistroChair, coffeeCup } from './pieces.js';
import { haloLetters, glowDisc, ledLine, archPoints } from './signs.js';
import * as L from './layout.js';

// The storefront: where the visit begins. A limewashed facade on a quiet street — an
// arched glass door in evergreen steel, a shop window looking in on the Steps, an arched
// vitrine showing the campaign, the name in halo-lit letters, olives in planters and a
// café table under the window. "Step inside" swings the door open and walks you in.

const { z1, t: T } = L.ROOM;
const WALL_OUT = z1 + T;             // outer face of the front wall
const F = L.FACADE;
const FZ = WALL_OUT + F.t;           // street face of the facade

function archShape(u, w, v0, spring, S = THREE.Path) {
  const r = w / 2, p = new S();
  p.moveTo(u - r, v0); p.lineTo(u + r, v0); p.lineTo(u + r, spring);
  p.absarc(u, spring, r, 0, Math.PI, false); p.lineTo(u - r, v0);
  return p;
}

/** A ring following an arch (frame seen from the street). */
function archFrame(u, w, v0, spring, width, depth, material) {
  const outer = archShape(u, w + width * 2, v0 - width, spring, THREE.Shape);
  outer.holes.push(archShape(u, w, v0, spring));
  const m = new THREE.Mesh(new THREE.ExtrudeGeometry(outer, { depth, bevelEnabled: false, curveSegments: 32 }), material);
  m.castShadow = true;
  return m;
}

function outsideShadow(...args) {
  const s = contactShadow(...args);
  delete s.userData.fake; // the pavement isn't baked, so this one stays in every lighting mode
  return s;
}

export function storefront(M, A, quality) {
  const g = new THREE.Group();
  g.name = 'storefront';
  A.glows = A.glows || [];
  const glows = A.glows;
  const D = L.DOOR, W = L.FRONT_WINDOW, V = L.VITRINE;

  // --- The facade shell --------------------------------------------------------
  const shape = new THREE.Shape();
  shape.moveTo(F.x0, 0); shape.lineTo(F.x1, 0); shape.lineTo(F.x1, F.h); shape.lineTo(F.x0, F.h); shape.lineTo(F.x0, 0);
  const door = new THREE.Path();
  door.moveTo(D.x - D.w / 2, 0); door.lineTo(D.x + D.w / 2, 0); door.lineTo(D.x + D.w / 2, D.h); door.lineTo(D.x - D.w / 2, D.h); door.lineTo(D.x - D.w / 2, 0);
  shape.holes.push(door, archShape(W.x, W.w, W.sill, W.spring), archShape(V.x, V.w, V.sill, V.spring));
  const shell = mesh(new THREE.ExtrudeGeometry(shape, { depth: F.t, bevelEnabled: false, curveSegments: 36 }), M.facade);
  shell.position.z = WALL_OUT;
  g.add(shell);

  // Travertine plinth, sills, a string course at ceiling height and a cornice.
  const band = (x0, x1, y, h, d, mat = M.slabWarm) => g.add(place(box(x1 - x0, h, d, mat), (x0 + x1) / 2, y + h / 2, FZ + d / 2));
  band(F.x0, D.x - D.w / 2, 0, F.plinth, 0.04, M.slab);
  band(D.x + D.w / 2, F.x1, 0, F.plinth, 0.04, M.slab);
  band(F.x0, F.x1, 4.28, 0.1, 0.06);
  band(F.x0 - 0.1, F.x1 + 0.1, F.h - 0.2, 0.2, 0.22);
  for (const o of [W, V]) g.add(place(box(o.w + 0.2, 0.05, 0.16, M.slabWarm), o.x, o.sill - 0.025, FZ + 0.06));

  // --- Doors: a pair of glass leaves in evergreen steel that part in the middle ------------
  const leafW = D.w / 2 - 0.015, leafH = D.h - 0.01, st = 0.06;
  const leaves = [];
  for (const side of [-1, 1]) {
    const hinge = new THREE.Group();
    hinge.position.set(D.x + side * (D.w / 2 - 0.008), 0, z1 + T / 2);
    const leaf = new THREE.Group();
    // Built from the hinge toward the middle: local x runs 0 → leafW toward the centre.
    const dir = -side;
    for (const [w, h, x, y] of [[st, leafH, st / 2, leafH / 2], [st, leafH, leafW - st / 2, leafH / 2], [leafW, st, leafW / 2, leafH - st / 2], [leafW, 0.14, leafW / 2, 0.07], [leafW, 0.04, leafW / 2, 1.05]]) {
      leaf.add(place(box(w, h, 0.05, M.evergreen), dir * x, y, 0));
    }
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(leafW - st * 2, leafH - 0.2), M.glass);
    glass.position.set(dir * leafW / 2, 0.14 + (leafH - 0.2) / 2, 0);
    glass.renderOrder = 2;
    leaf.add(glass);
    for (const face of [-1, 1]) leaf.add(place(box(0.022, 0.62, 0.022, M.brass), dir * (leafW - 0.13), 1.12, face * 0.05));
    hinge.add(leaf);
    g.add(hinge);
    leaves.push({ hinge, side });
  }
  // Both leaves swing inward (toward -z).
  A.door = {
    openAngle: 1.45,
    set(open) { for (const { hinge, side } of leaves) hinge.rotation.y = -side * this.openAngle * open; },
  };
  // Casing on the facade and a travertine threshold through both walls.
  const cas = 0.07;
  for (const [w, h, x, y] of [[cas, D.h + cas, D.x - D.w / 2 - cas / 2, (D.h + cas) / 2], [cas, D.h + cas, D.x + D.w / 2 + cas / 2, (D.h + cas) / 2]]) {
    g.add(place(box(w, h, 0.04, M.evergreen), x, y, FZ + 0.02));
  }
  g.add(place(box(D.w, 0.014, T + F.t + 0.12, M.slabWarm, { cast: false }), D.x, 0.007, z1 + (T + F.t + 0.12) / 2));

  // Fanlight: a half-round of dark glass and radial bars in evergreen.
  const fanR = D.w / 2 + cas;
  const fanFrameShape = new THREE.Shape();
  fanFrameShape.absarc(0, 0, fanR + 0.04, 0, Math.PI, false);
  fanFrameShape.lineTo(-fanR + 0.02, 0);
  fanFrameShape.absarc(0, 0, fanR - 0.03, Math.PI, 0, true);
  fanFrameShape.lineTo(fanR + 0.04, 0);
  const fanFrame = new THREE.Mesh(new THREE.ExtrudeGeometry(fanFrameShape, { depth: 0.04, bevelEnabled: false, curveSegments: 32 }), M.evergreen);
  fanFrame.position.set(D.x, D.h + cas, FZ);
  g.add(fanFrame);
  const darkGlass = new THREE.MeshStandardMaterial({ color: 0x3b3d3a, roughness: 0.08, metalness: 0.4, emissive: 0xffb36b, emissiveIntensity: 0.12, envMapIntensity: 1.5 });
  darkGlass.userData.glowEmissive = 0.12;
  glows.push(darkGlass);
  const fan = new THREE.Mesh(new THREE.CircleGeometry(fanR - 0.03, 32, 0, Math.PI), darkGlass);
  fan.position.set(D.x, D.h + cas, FZ + 0.005);
  g.add(fan);
  for (const a of [Math.PI / 4, Math.PI / 2, (3 * Math.PI) / 4]) {
    const bar = box(0.022, fanR - 0.06, 0.03, M.evergreen);
    bar.position.set(D.x + Math.cos(a) * (fanR - 0.03) / 2, D.h + cas + Math.sin(a) * (fanR - 0.03) / 2, FZ + 0.02);
    bar.rotation.z = a - Math.PI / 2;
    g.add(bar);
  }
  g.add(place(box(D.w + cas * 2, 0.05, 0.05, M.evergreen), D.x, D.h + cas / 2, FZ + 0.025));

  // --- Shop window and vitrine: evergreen surrounds on the street face -------------------
  g.add(place(archFrame(W.x, W.w, W.sill, W.spring, 0.07, 0.035, M.evergreen), 0, 0, FZ));
  g.add(place(archFrame(V.x, V.w, V.sill, V.spring, 0.07, 0.035, M.evergreen), 0, 0, FZ));

  // The vitrine: a shallow lit box set into the facade. displays.js hangs the campaign in it.
  const vBack = WALL_OUT + 0.012;
  const vH = V.spring - V.sill + V.w / 2;
  const backShape = archShape(V.x, V.w, V.sill, V.spring, THREE.Shape);
  const backGeo = new THREE.ShapeGeometry(backShape, 32);
  applyBoxUV(backGeo, M.linen.userData.uv);
  const back = new THREE.Mesh(backGeo, M.linen);
  back.position.z = vBack;
  back.receiveShadow = true;
  g.add(back);
  const wash = new THREE.Mesh(new THREE.PlaneGeometry(V.w * 0.95, vH * 0.9), M.wash(0xffd49e, 0.34));
  wash.position.set(V.x, V.sill + vH * 0.5, vBack + 0.004);
  g.add(wash);
  const vLed = ledLine(archPoints(V.x, V.w, V.sill + 0.02, V.spring, { inset: 0.02 }).slice(1, -1), { radius: 0.006, glows });
  vLed.position.z = FZ - 0.03;
  g.add(vLed);
  const vGlass = new THREE.Mesh(new THREE.ShapeGeometry(archShape(V.x, V.w, V.sill, V.spring, THREE.Shape), 32), M.glass);
  vGlass.position.z = FZ - 0.012;
  vGlass.renderOrder = 2;
  g.add(vGlass);
  // A travertine block to stand the campaign on.
  g.add(place(box(1.0, 0.34, 0.12, M.slab), V.x, V.sill + 0.17, vBack + 0.07));
  A.vitrine = { x: V.x, y: V.sill + 0.34, z: vBack + 0.03, w: V.w - 0.34, h: vH - 0.6 };
  const plate = canvasTexture(512, 64, (ctx, w, h) => {
    ctx.fillStyle = '#b48f55'; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#2a1d16'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = '500 24px "Azeret Mono", monospace'; ctx.letterSpacing = '6px';
    ctx.fillText('STILL BECOMING · NOW SHOWING', w / 2 + 3, h / 2 + 1);
  });
  const plateM = new THREE.Mesh(new THREE.PlaneGeometry(0.64, 0.08), new THREE.MeshStandardMaterial({ map: plate, metalness: 0.7, roughness: 0.35 }));
  plateM.position.set(V.x, V.sill - 0.16, FZ + 0.003);
  g.add(plateM);

  // --- The name, sconces and the upstairs windows ---------------------------------------------
  const sign = haloLetters('INCREMENTS', { w: 2.5, h: 0.3, sub: 'THE LOUNGE', glows });
  sign.position.set(D.x, 3.86, FZ);
  g.add(sign);
  const opal = new THREE.MeshStandardMaterial({ color: 0xfff4e2, emissive: 0xffd9a0, emissiveIntensity: 1.1, roughness: 0.4 });
  opal.userData.glowEmissive = 1.1;
  glows.push(opal);
  for (const sx of [-1, 1]) {
    const x = D.x + sx * (D.w / 2 + 0.34), y = 2.74; // above the olive canopies
    const plateB = cyl(0.055, 0.055, 0.02, M.brass, { segments: 24 });
    plateB.rotation.x = Math.PI / 2;
    plateB.position.set(x, y, FZ + 0.01);
    const arm = cyl(0.008, 0.008, 0.12, M.brass, { segments: 8 });
    arm.rotation.x = Math.PI / 2;
    arm.position.set(x, y, FZ + 0.07);
    const globe = new THREE.Mesh(new THREE.SphereGeometry(0.075, 24, 16), opal);
    globe.position.set(x, y + 0.02, FZ + 0.15);
    const halo = glowDisc(1.1, { glows, opacity: 0.55 });
    halo.position.set(x, y + 0.02, FZ + 0.012);
    g.add(plateB, arm, globe, halo);
  }
  const upGlass = darkGlass.clone();
  upGlass.emissiveIntensity = 0.3;
  upGlass.userData.glowEmissive = 0.3;
  glows.push(upGlass);
  for (const ux of [-3.6, 0, 3.6]) {
    const uw = 1.05, uh = 1.75, uy = 4.72;
    g.add(place(new THREE.Mesh(new THREE.PlaneGeometry(uw, uh), upGlass), ux, uy + uh / 2, FZ + 0.004));
    for (const [w, h, x, y] of [[uw + 0.1, 0.06, ux, uy], [uw + 0.1, 0.06, ux, uy + uh], [0.06, uh, ux - uw / 2, uy + uh / 2], [0.06, uh, ux + uw / 2, uy + uh / 2], [0.035, uh, ux, uy + uh / 2], [uw, 0.035, ux, uy + uh * 0.62]]) {
      g.add(place(box(w, h, 0.05, M.evergreen), x, y, FZ + 0.025));
    }
    g.add(place(box(uw + 0.24, 0.05, 0.14, M.slabWarm), ux, uy - 0.05, FZ + 0.07));
  }

  // --- On the pavement ------------------------------------------------------------------------------
  const pw = 28, pd = L.PAVEMENT.z1 - FZ;
  const paveGeo = new THREE.PlaneGeometry(pw, pd);
  paveGeo.rotateX(-Math.PI / 2);
  paveGeo.translate(0, 0, FZ + pd / 2);
  const pave = mesh(paveGeo, M.pavement, { cast: false });
  g.add(pave);
  g.add(place(box(pw, 0.14, 0.3, M.slab, { cast: false }), 0, 0.02, L.PAVEMENT.z1 - 0.15));

  // Olive standards in travertine planters either side of the door.
  [-1, 1].forEach((sx, i) => {
    const px = D.x + sx * (D.w / 2 + 0.44), pz = FZ + 0.42;
    g.add(place(cyl(0.3, 0.26, 0.62, M.slab, { segments: 40 }), px, 0.31, pz));
    const soil = new THREE.Mesh(new THREE.CircleGeometry(0.27, 24), M.soil);
    soil.rotation.x = -Math.PI / 2;
    soil.position.set(px, 0.6, pz);
    g.add(soil, outsideShadow(0.7, 0.7, { round: true, opacity: 0.45 }));
    g.children[g.children.length - 1].position.set(px, 0.003, pz);
    g.add(olive(M, px, 0.6, pz, quality, { scale: 0.62, seed: 31 + i * 7, density: 2.3, turn: i * 2.1 }));
  });

  // A café table under the shop window.
  const tx = W.x, tz = FZ + 0.95;
  const table = new THREE.Group();
  table.add(place(cyl(0.2, 0.22, 0.03, M.evergreen, { segments: 28 }), 0, 0.015, 0));
  table.add(place(cyl(0.025, 0.025, 0.7, M.evergreen, { segments: 12 }), 0, 0.37, 0));
  table.add(place(cyl(0.32, 0.32, 0.03, M.slabWarm, { segments: 40 }), 0, 0.735, 0));
  const c1 = coffeeCup(M); c1.position.set(-0.1, 0.75, 0.05); table.add(c1);
  const c2 = coffeeCup(M); c2.position.set(0.12, 0.75, -0.06); c2.rotation.y = 2.2; table.add(c2);
  table.position.set(tx, 0, tz);
  g.add(table, outsideShadow(0.7, 0.7, { round: true, opacity: 0.4 }));
  g.children[g.children.length - 1].position.set(tx, 0.003, tz);
  for (const sx of [-1, 1]) {
    const ch = bistroChair(M);
    ch.position.set(tx + sx * 0.6, 0, tz + 0.05);
    ch.rotation.y = -sx * Math.PI / 2 + sx * 0.25;
    g.add(ch);
  }

  // The A-frame on the pavement.
  g.add(aFrame(M, D.x + 3.3, FZ + 1.45, -0.28));

  // So the camera knows where the door is.
  A.street = { doorOut: new THREE.Vector3(D.x, 1.62, FZ + 1.4), doorIn: new THREE.Vector3(D.x, 1.66, z1 - 1.0) };
  return g;
}

function aFrame(M, x, z, ry) {
  const g = new THREE.Group();
  const bw = 0.62, bh = 0.98, lean = 0.2;
  const face = canvasTexture(620, 980, (ctx, w, h) => {
    ctx.fillStyle = '#264030'; ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(244,236,222,0.55)'; ctx.lineWidth = 3; ctx.strokeRect(24, 24, w - 48, h - 48);
    ctx.fillStyle = '#f4ecde'; ctx.textAlign = 'center';
    ctx.font = '500 30px "Azeret Mono", monospace'; ctx.letterSpacing = '9px';
    ctx.fillText('INCREMENTS', w / 2 + 4, 120);
    ctx.letterSpacing = '0px';
    ctx.font = 'italic 400 104px "Bodoni Moda", serif';
    ctx.fillText('The', w / 2, 300);
    ctx.fillText('Lounge', w / 2, 400);
    ctx.fillStyle = 'rgba(244,236,222,0.55)'; ctx.fillRect(w / 2 - 60, 460, 120, 2);
    ctx.fillStyle = '#f4ecde';
    ctx.font = '400 34px "Hanken Grotesk", sans-serif';
    ctx.fillText('Still Becoming', w / 2, 560);
    ctx.fillText('now showing', w / 2, 606);
    ctx.fillStyle = '#c44a52';
    ctx.beginPath(); ctx.arc(w / 2, 700, 7, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#f4ecde';
    ctx.font = 'italic 400 44px "Bodoni Moda", serif';
    ctx.fillText('Step inside →', w / 2, 830);
  });
  const faceMat = new THREE.MeshStandardMaterial({ map: face, roughness: 0.8 });
  // Two boards hinged at the top: each foot sits out by `a`, the tops meet over the middle.
  const a = Math.sin(lean) * bh;
  for (const side of [1, -1]) {
    const board = new THREE.Group();
    const b = box(bw, bh, 0.025, [M.evergreenPaint, M.evergreenPaint, M.evergreenPaint, M.evergreenPaint, faceMat, M.evergreenPaint]);
    b.position.y = bh / 2;
    b.castShadow = true;
    board.add(b);
    if (side > 0) { board.rotation.x = -lean; board.position.z = a; }
    else { board.rotation.set(lean, Math.PI, 0); board.position.z = -a; }
    g.add(board);
  }
  g.position.set(x, 0, z);
  g.rotation.y = ry;
  const s = outsideShadow(0.8, 0.6, { opacity: 0.35 });
  g.add(s);
  return g;
}
