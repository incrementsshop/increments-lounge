import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// Static batching. The room is built from hundreds of small pieces — chair legs, vines,
// books, mullions — and each one would be its own draw call. Anything that never moves
// and shares a material (and shadow settings) is folded into one mesh once the room is
// built, which takes a phone from well over a thousand draw calls to a couple of hundred.
//
// Left alone: anything flagged `userData.dynamic` (the doors), anything tappable
// (`userData.pick`), the hand-made light fakes (`userData.fake`, toggled by lighting mode),
// transparent/additive pieces (they need sorting), instanced meshes, multi-material meshes,
// meshes with children, and whatever is passed in `exclude` (lightmap receivers, anchors).

function eligible(o) {
  if (!o.isMesh || o.isInstancedMesh || o.isSkinnedMesh) return false;
  if (Array.isArray(o.material) || !o.material || o.material.transparent || o.material.visible === false) return false;
  if (o.userData.fake || o.userData.pick || !o.visible || o.children.length) return false;
  return !!o.geometry?.attributes?.position;
}

export function batchStatic(roots, { exclude = [] } = {}) {
  const skip = new Set(exclude);
  const buckets = new Map();
  let seen = 0;
  const visit = o => {
    if (skip.has(o) || o.userData.dynamic) return;
    if (eligible(o)) {
      seen++;
      const g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
      g.applyMatrix4(o.matrixWorld);
      g.clearGroups();
      for (const name of Object.keys(g.attributes)) if (!['position', 'normal', 'uv', 'color'].includes(name)) g.deleteAttribute(name);
      const key = [o.material.uuid, o.castShadow, o.receiveShadow, o.renderOrder, Object.keys(g.attributes).sort().join(',')].join('|');
      if (!buckets.has(key)) buckets.set(key, { material: o.material, cast: o.castShadow, receive: o.receiveShadow, renderOrder: o.renderOrder, items: [] });
      buckets.get(key).items.push({ mesh: o, geo: g });
    }
    for (const c of [...o.children]) visit(c);
  };
  for (const r of roots) { r.updateMatrixWorld(true); visit(r); }

  const group = new THREE.Group();
  group.name = 'static';
  let merged = 0, batches = 0;
  for (const b of buckets.values()) {
    if (b.items.length < 2) continue;
    const geo = mergeGeometries(b.items.map(i => i.geo), false);
    if (!geo) continue;
    geo.computeBoundingSphere();
    const m = new THREE.Mesh(geo, b.material);
    m.castShadow = b.cast;
    m.receiveShadow = b.receive;
    m.renderOrder = b.renderOrder;
    m.matrixAutoUpdate = false;
    group.add(m);
    for (const { mesh } of b.items) mesh.parent?.remove(mesh);
    merged += b.items.length;
    batches++;
  }
  return { group, stats: { eligible: seen, merged, batches } };
}

/** Every Object3D reachable from an anchors object (so batching can leave them alone). */
export function objectsIn(anchors) {
  const out = [];
  const walk = v => {
    if (!v || typeof v !== 'object') return;
    if (v.isObject3D) { out.push(v); return; }
    if (Array.isArray(v)) v.forEach(walk);
    else if (v.constructor === Object) Object.values(v).forEach(walk);
  };
  walk(anchors);
  return out;
}
