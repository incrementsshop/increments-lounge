import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { applyBoxUV } from './materials.js';

// Small building blocks shared by the room, furniture and displays.

export function mesh(geometry, material, { cast = true, receive = true, uv = true } = {}) {
  if (uv && material?.userData?.uv) applyBoxUV(geometry, material.userData.uv);
  const m = new THREE.Mesh(geometry, material);
  m.castShadow = cast;
  m.receiveShadow = receive;
  return m;
}

export function box(w, h, d, material, opts = {}) {
  const g = opts.r ? new RoundedBoxGeometry(w, h, d, opts.seg ?? 3, opts.r) : new THREE.BoxGeometry(w, h, d);
  return mesh(g, material, opts);
}

export function cyl(rTop, rBottom, h, material, opts = {}) {
  const g = new THREE.CylinderGeometry(rTop, rBottom, h, opts.segments ?? 32, 1, opts.open ?? false, opts.thetaStart ?? 0, opts.thetaLength ?? Math.PI * 2);
  return mesh(g, material, opts);
}

/** Lathe from a list of [radius, y] pairs. */
export function lathe(points, material, opts = {}) {
  const g = new THREE.LatheGeometry(points.map(([r, y]) => new THREE.Vector2(r, y)), opts.segments ?? 32);
  return mesh(g, material, { uv: false, ...opts });
}

export function place(obj, x, y, z, ry = 0) {
  obj.position.set(x, y, z);
  obj.rotation.y = ry;
  return obj;
}

export function group(...children) {
  const g = new THREE.Group();
  children.forEach(c => c && g.add(c));
  return g;
}

// --- Soft contact shadows -------------------------------------------------
// Real-time shadows only come from the sun; these fake the ambient occlusion
// under furniture and in corners, which is most of what makes a room feel grounded.

let blobTex = null, rectTex = null, stripTex = null;

function softTexture(kind) {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d');
  if (kind === 'blob') {
    const g = ctx.createRadialGradient(64, 64, 4, 64, 64, 64);
    g.addColorStop(0, 'rgba(46,30,18,0.9)');
    g.addColorStop(0.5, 'rgba(46,30,18,0.4)');
    g.addColorStop(1, 'rgba(46,30,18,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 128, 128);
  } else if (kind === 'rect') {
    ctx.shadowColor = 'rgba(46,30,18,0.95)';
    ctx.shadowBlur = 22;
    ctx.shadowOffsetX = 1000;
    ctx.fillStyle = '#000';
    ctx.fillRect(28 - 1000, 28, 72, 72);
  } else {
    const g = ctx.createLinearGradient(0, 0, 0, 128);
    g.addColorStop(0, 'rgba(46,30,18,0.8)');
    g.addColorStop(0.35, 'rgba(46,30,18,0.25)');
    g.addColorStop(1, 'rgba(46,30,18,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 128, 128);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function shadowMaterial(map, opacity) {
  return new THREE.MeshBasicMaterial({
    map, transparent: true, depthWrite: false, opacity,
    polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4,
    toneMapped: false, fog: false,
  });
}

/** A soft shadow on the floor under something. `round` for tables and plants. */
export function contactShadow(w, d, { round = false, opacity = 0.5, y = 0.002 } = {}) {
  if (!blobTex) { blobTex = softTexture('blob'); rectTex = softTexture('rect'); }
  const g = new THREE.PlaneGeometry(1, 1);
  g.rotateX(-Math.PI / 2);
  const m = new THREE.Mesh(g, shadowMaterial(round ? blobTex : rectTex, opacity));
  m.scale.set(w * (round ? 1.5 : 1.75), 1, d * (round ? 1.5 : 1.75));
  m.position.y = y;
  m.renderOrder = -1;
  return m;
}

/** Darkening that fades away from a corner: `length` along the corner, `width` into the surface. */
export function aoStrip(length, width, opacity = 0.32) {
  if (!stripTex) stripTex = softTexture('strip');
  const g = new THREE.PlaneGeometry(length, width);
  g.translate(0, -width / 2, 0); // top edge at the origin, fading downward (local -y)
  const m = new THREE.Mesh(g, shadowMaterial(stripTex, opacity));
  m.renderOrder = -1;
  return m;
}

/** A canvas-backed texture for text, labels and signage. */
export function canvasTexture(width, height, draw, { srgb = true } = {}) {
  const c = document.createElement('canvas');
  c.width = width; c.height = height;
  draw(c.getContext('2d'), width, height);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.anisotropy = 8;
  return t;
}

export function pickable(obj, pick) {
  obj.traverse(o => { o.userData.pick = pick; });
  return obj;
}
