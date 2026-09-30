import * as THREE from 'three';
import { canvasTexture } from './helpers.js';

// Words in light: warm neon script, a backlit pill sign, halo-lit letters for the
// storefront, and LED lines that trace arches. Every glow registers itself in `glows`
// so Lighting can let it barely show at noon and bloom in the evening.

const WARM = '#ffcf94';

/** Additive glow layer whose strength follows the time of day. */
function glowMaterial(map, opacity, glows, color = 0xffc98c) {
  const m = new THREE.MeshBasicMaterial({ map, color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, fog: false });
  m.userData.glowBase = opacity;
  glows?.push(m);
  return m;
}

function textCanvasSize(w, h, pxPerM) {
  return [Math.min(4096, Math.round(w * pxPerM)), Math.min(1024, Math.round(h * pxPerM))];
}

/**
 * Neon script on a wall: a bright tube core with its own soft falloff, plus a wider
 * additive bloom behind it. `w`/`h` in metres; the text is fitted to the width.
 */
export function neonText(text, { w = 2.4, h = 0.36, font = 'italic 400 {px}px "Bodoni Moda", serif', glows } = {}) {
  const [cw, ch] = textCanvasSize(w, h, 900);
  // Fit the text to the width once, then draw the core and the bloom at the same scale.
  const probe = document.createElement('canvas').getContext('2d');
  let px = Math.round(ch * 0.5);
  probe.font = font.replace('{px}', px);
  const tw = probe.measureText(text).width;
  if (tw > cw * 0.92) px = Math.floor(px * cw * 0.92 / tw);
  const core = canvasTexture(cw, ch, (ctx, W, H) => {
    ctx.font = font.replace('{px}', px);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(255,170,90,0.9)';
    for (const [blur, alpha] of [[H * 0.1, 0.5], [H * 0.04, 0.8]]) {
      ctx.shadowBlur = blur; ctx.fillStyle = `rgba(255,214,160,${alpha})`;
      ctx.fillText(text, W / 2, H * 0.52);
    }
    ctx.shadowBlur = H * 0.015; ctx.fillStyle = '#fff7ea';
    ctx.fillText(text, W / 2, H * 0.52);
  });
  // The bloom is drawn small and blurred, with room all round so it fades out before its edges.
  const S = 4, bw = Math.round(cw / S), bh = Math.round(ch / S), padX = Math.round(bh * 0.9), padY = Math.round(bh * 1.1);
  const bloom = canvasTexture(bw + padX * 2, bh + padY * 2, (ctx, W, H) => {
    ctx.font = font.replace('{px}', Math.round(px / S));
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.filter = `blur(${Math.max(3, Math.round(bh * 0.16))}px)`;
    ctx.fillStyle = WARM;
    ctx.fillText(text, W / 2, padY + bh * 0.52);
    ctx.fillText(text, W / 2, padY + bh * 0.52);
  });
  const g = new THREE.Group();
  const coreMesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: core, transparent: true, depthWrite: false, toneMapped: false, fog: false }));
  const bloomMesh = new THREE.Mesh(new THREE.PlaneGeometry(w * (bw + padX * 2) / bw, h * (bh + padY * 2) / bh), glowMaterial(bloom, 0.8, glows));
  bloomMesh.position.z = -0.002;
  coreMesh.position.z = 0.004;
  coreMesh.renderOrder = bloomMesh.renderOrder = 5;
  g.add(bloomMesh, coreMesh);
  return g;
}

function stadium(w, h, S = THREE.Shape) {
  const r = Math.min(w, h) / 2, s = new S();
  if (h >= w) {
    s.moveTo(-r, -h / 2 + r); s.lineTo(-r, h / 2 - r);
    s.absarc(0, h / 2 - r, r, Math.PI, 0, true);
    s.lineTo(r, -h / 2 + r);
    s.absarc(0, -h / 2 + r, r, 0, Math.PI, true);
  } else {
    s.moveTo(-w / 2 + r, -r); s.lineTo(w / 2 - r, -r);
    s.absarc(w / 2 - r, 0, r, -Math.PI / 2, Math.PI / 2, false);
    s.lineTo(-w / 2 + r, r);
    s.absarc(-w / 2 + r, 0, r, Math.PI / 2, Math.PI * 1.5, false);
  }
  return s;
}

/** A pill-shaped lightbox with stacked words, glowing from within. */
export function pillSign(lines, { w = 0.3, h = 0.86, depth = 0.04, M, glows } = {}) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.ExtrudeGeometry(stadium(w, h), { depth, bevelEnabled: true, bevelSize: 0.006, bevelThickness: 0.006, bevelSegments: 2, curveSegments: 32 }), M.ceramic);
  body.castShadow = true;
  g.add(body);
  const face = canvasTexture(Math.round(w * 1400), Math.round(h * 1400), (ctx, W, H) => {
    const grd = ctx.createRadialGradient(W / 2, H / 2, W * 0.1, W / 2, H / 2, H * 0.6);
    grd.addColorStop(0, '#fffaf1'); grd.addColorStop(1, '#f3e6d2');
    ctx.fillStyle = grd; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#2a1d16';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const px = Math.round(W * 0.15);
    ctx.font = `500 ${px}px "Azeret Mono", monospace`;
    ctx.letterSpacing = `${Math.round(px * 0.28)}px`;
    const step = H * 0.62 / Math.max(1, lines.length - 1);
    lines.forEach((ln, i) => ctx.fillText(ln, W / 2 + px * 0.14, H * 0.19 + i * step));
  });
  const faceMesh = new THREE.Mesh(new THREE.ShapeGeometry(stadium(w - 0.02, h - 0.02), 32), new THREE.MeshBasicMaterial({ map: face, toneMapped: false, color: 0xf2ebe0 }));
  // ShapeGeometry UVs are the shape's coordinates; remap them to 0–1 for the face canvas.
  const uv = faceMesh.geometry.attributes.uv, p = faceMesh.geometry.attributes.position;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, p.getX(i) / (w - 0.02) + 0.5, p.getY(i) / (h - 0.02) + 0.5);
  faceMesh.position.z = depth + 0.0075;
  g.add(faceMesh);
  const halo = new THREE.Mesh(new THREE.PlaneGeometry(w * 3.2, h * 1.9), glowMaterial(haloTexture(), 0.55, glows));
  halo.position.z = 0.003;
  g.add(halo);
  return g;
}

let haloTex = null;
function haloTexture() {
  if (haloTex) return haloTex;
  haloTex = canvasTexture(128, 256, (ctx, W, H) => {
    const grd = ctx.createRadialGradient(W / 2, H / 2, 4, W / 2, H / 2, H / 2);
    grd.addColorStop(0, 'rgba(255,214,160,0.9)'); grd.addColorStop(0.35, 'rgba(255,200,140,0.35)'); grd.addColorStop(1, 'rgba(255,200,140,0)');
    ctx.fillStyle = grd; ctx.fillRect(0, 0, W, H);
  });
  return haloTex;
}

/** A soft round glow (sconces, lamps): an additive disc. */
export function glowDisc(size, { glows, opacity = 0.7, color = 0xffc98c } = {}) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size), glowMaterial(haloTexture(), opacity, glows, color));
  m.renderOrder = 5;
  return m;
}

/**
 * Letters in brass by day with a warm halo on the wall behind them at night — like
 * halo-lit channel letters. Returns a group centred on the origin, facing +z.
 */
export function haloLetters(text, { w = 2.6, h = 0.34, sub = '', glows } = {}) {
  const [cw, ch] = textCanvasSize(w, h * (sub ? 1.55 : 1), 900);
  const draw = (ctx, W, H, halo) => {
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const mainH = sub ? H / 1.55 : H;
    let px = Math.round(mainH * 0.72);
    ctx.font = `500 ${px}px "Bodoni Moda", serif`;
    const spacing = () => Math.round(px * 0.34);
    ctx.letterSpacing = `${spacing()}px`;
    const tw = ctx.measureText(text).width;
    if (tw > W * 0.96) { px = Math.floor(px * W * 0.96 / tw); ctx.font = `500 ${px}px "Bodoni Moda", serif`; ctx.letterSpacing = `${spacing()}px`; }
    if (halo) { ctx.filter = `blur(${Math.round(mainH * 0.09)}px)`; ctx.fillStyle = WARM; }
    else ctx.fillStyle = '#6a4b2e';
    ctx.fillText(text, W / 2 + spacing() / 2, mainH * 0.54);
    if (sub) {
      const sp = Math.round(mainH * 0.2);
      ctx.font = `500 ${sp}px "Azeret Mono", monospace`;
      ctx.letterSpacing = `${Math.round(sp * 0.6)}px`;
      ctx.fillText(sub, W / 2 + sp * 0.3, mainH + (H - mainH) * 0.55);
    }
  };
  const g = new THREE.Group();
  const hh = h * (sub ? 1.55 : 1);
  const letters = new THREE.Mesh(new THREE.PlaneGeometry(w, hh), new THREE.MeshStandardMaterial({ map: canvasTexture(cw, ch, (c, W, H) => draw(c, W, H, false)), transparent: true, metalness: 0.6, roughness: 0.35, depthWrite: false }));
  letters.position.z = 0.02;
  const haloMesh = new THREE.Mesh(new THREE.PlaneGeometry(w * 1.08, hh * 1.5), glowMaterial(canvasTexture(Math.round(cw / 3), Math.round(ch / 3), (c, W, H) => draw(c, W, H, true)), 0.9, glows));
  haloMesh.position.z = 0.004;
  letters.renderOrder = haloMesh.renderOrder = 5;
  g.add(haloMesh, letters);
  return g;
}

/** An LED line along a path (world or local points): bright core that glows more at night. */
export function ledLine(points, { radius = 0.007, glows, closed = false } = {}) {
  const curve = new THREE.CatmullRomCurve3(points, closed, 'centripetal');
  const m = new THREE.MeshBasicMaterial({ color: 0xffe7c4, toneMapped: false });
  m.userData.glowColor = true;
  const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, Math.max(24, points.length * 6), radius, 6, closed), m);
  glows?.push(m);
  return tube;
}

/** Points tracing an arch (jambs + half-circle), in the plane z = 0: u across, v up. */
export function archPoints(u, w, v0, spring, { inset = 0, steps = 28 } = {}) {
  const r = w / 2 - inset, pts = [];
  pts.push(new THREE.Vector3(u - r, v0, 0), new THREE.Vector3(u - r, spring, 0));
  for (let i = 1; i < steps; i++) {
    const a = Math.PI - (i / steps) * Math.PI;
    pts.push(new THREE.Vector3(u + Math.cos(a) * r, spring + Math.sin(a) * r, 0));
  }
  pts.push(new THREE.Vector3(u + r, spring, 0), new THREE.Vector3(u + r, v0, 0));
  return pts;
}
