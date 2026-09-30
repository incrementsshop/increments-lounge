import * as THREE from 'three';
import { ROOM } from './layout.js';

// Pre-calculated lighting for the room's shell (floor, walls, corners, ceiling).
//
// tools/bake.html renders the light — sun, sky through the windows and skylight, the cove,
// the interior lights, and every shadow the furniture casts — into one lightmap per surface,
// per time of day, and saves them to assets/lightmaps/<time>/<surface>.webp. Here those
// maps replace the live lighting on the shell: richer light for less work on the phone.
// Furniture and garments stay lit live so they can move and sway.
//
// Both the baker and the site use bakeUVs() below, so the maps always line up.

export const SCALE = 4; // lightmaps store linear light ÷ SCALE, sRGB-encoded

/** Every shell surface that gets a lightmap, keyed by the file name it bakes to. */
export function bakeSurfaces(receivers) {
  const out = [
    { name: 'floor', mesh: receivers.floor, kind: 'floor', w: 1024, h: 1024 },
    { name: 'ceiling', mesh: receivers.slab, kind: 'floor', w: 512, h: 512 },
  ];
  for (const [side, mesh] of Object.entries(receivers.walls)) out.push({ name: `wall-${side}`, mesh, kind: 'wall', w: 1024, h: 512 });
  receivers.corners.forEach((mesh, i) => out.push({ name: `corner-${i}`, mesh, kind: 'corner', w: 128, h: 256 }));
  return out;
}

/** Lightmap coordinates (0–1, no overlaps) for one surface, written to the `uv1` attribute. */
export function bakeUVs(surface) {
  const g = surface.mesh.geometry;
  if (g.attributes.uv1) return g.attributes.uv1;
  const pos = g.attributes.position, nrm = g.attributes.normal;
  const uv1 = new Float32Array(pos.count * 2);
  const W = ROOM.x1 - ROOM.x0, D = ROOM.z1 - ROOM.z0, T = ROOM.t, H = ROOM.h;

  if (surface.kind === 'floor') {
    // Floor plane and ceiling slab: straight down the room's plan.
    // Only faces that look down (ceiling) or up (floor) own texels; the slab's hidden top
    // collapses to a point, and its edges are vertical so they take the texels beside them.
    const seen = surface.name === 'ceiling' ? -1 : 1;
    for (let i = 0; i < pos.count; i++) {
      const hidden = nrm.getY(i) * seen < -0.5;
      uv1[i * 2] = hidden ? 0 : (pos.getX(i) - ROOM.x0) / W;
      uv1[i * 2 + 1] = hidden ? 0 : (pos.getZ(i) - ROOM.z0) / D;
    }
  } else if (surface.kind === 'corner') {
    // Curved corners: around the arc, then up. (Their `uv` is the plaster's world-scale
    // projection, so the unwrap is rebuilt from the cylinder's own angles.)
    const { thetaStart, thetaLength, height } = g.parameters;
    for (let i = 0; i < pos.count; i++) {
      let a = Math.atan2(pos.getX(i), pos.getZ(i)) - thetaStart;
      a = ((a % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
      if (a > thetaLength + 0.5) a = 0; // the seam vertex that wraps to 2π
      uv1[i * 2] = THREE.MathUtils.clamp(a / thetaLength, 0, 1);
      uv1[i * 2 + 1] = pos.getY(i) / height + 0.5;
    }
  } else {
    // Extruded walls, in their own frame: x along the wall, y up, z through the wall.
    g.computeBoundingBox();
    const u0 = g.boundingBox.min.x, u1 = g.boundingBox.max.x;
    const v0 = -0.05, v1 = H + 0.02;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
      const nx = nrm.getX(i), ny = nrm.getY(i), nz = nrm.getZ(i);
      let u = x, v = y;
      if (nz > 0.5) { u = u0; v = v0; }            // outside face: never seen
      else if (Math.abs(nz) <= 0.5) {             // reveals: fold into the opening they line
        u = x + nx * z * 0.9;
        v = y + ny * z * 0.9;
      }
      uv1[i * 2] = THREE.MathUtils.clamp((u - u0) / (u1 - u0), 0, 1);
      uv1[i * 2 + 1] = THREE.MathUtils.clamp((v - v0) / (v1 - v0), 0, 1);
    }
  }
  const attr = new THREE.BufferAttribute(uv1, 2);
  g.setAttribute('uv1', attr);
  return attr;
}

/**
 * The live material, lit by its lightmap instead of the room's lights. It keeps its own
 * texture, bump and the neutral room reflections (image-based light), which is what keeps
 * travertine reading as pale stone rather than caramel. Everything the lightmap already
 * holds — sun, sky, cove, lamps, the hemisphere fill, the bounce — is switched off here so
 * nothing is counted twice.
 */
const BAKED_LIGHTS = THREE.ShaderChunk.lights_fragment_begin
  .replace(/NUM_(POINT|SPOT|DIR|RECT_AREA|HEMI)_LIGHTS > 0/g, '0 > 0');

const BAKED_REF = 2.4; // baked irradiance at which room reflections are left at full strength

function bakedMaterial(live, lightMap, intensity) {
  const mat = live.clone();
  mat.lightMap = lightMap;
  mat.lightMapIntensity = intensity;
  if (mat.emissive) mat.emissiveIntensity = 0; // the live ceiling's glow stood in for bounce light
  mat.onBeforeCompile = shader => {
    shader.uniforms.uBakedRef = { value: BAKED_REF };
    shader.fragmentShader = 'uniform float uBakedRef;\n' + shader.fragmentShader
      .replace('#include <lights_fragment_begin>', BAKED_LIGHTS)
      // Room reflections don't know about shadows, so let the baked light shade them too:
      // corners, the floor under the island and the shade of the steps dim their reflections.
      .replace('#include <lights_fragment_maps>', `#include <lights_fragment_maps>
      #ifdef USE_LIGHTMAP
        float bakedShade = clamp(dot(lightMapIrradiance, vec3(0.2126, 0.7152, 0.0722)) / uBakedRef, 0.25, 1.0);
        iblIrradiance *= bakedShade;
        radiance *= mix(1.0, bakedShade, 0.7);
      #endif`);
  };
  mat.customProgramCacheKey = () => 'lounge-baked';
  return mat;
}

/**
 * Swaps the shell to baked light when a set exists for the requested time.
 * Silently keeps live lighting if the maps aren't there (e.g. before the first bake).
 */
export class Lightmaps {
  constructor(receivers, scene) {
    this.surfaces = bakeSurfaces(receivers);
    this.scene = scene;
    this.loader = new THREE.TextureLoader();
    this.cache = new Map();
    this.manifest = null;
    this.active = null;
    this.live = new Map(this.surfaces.map(s => [s, s.mesh.material]));
  }

  async init() {
    try {
      const res = await fetch('assets/lightmaps/manifest.json', { cache: 'no-cache' });
      if (res.ok) this.manifest = await res.json();
    } catch { /* no bake yet */ }
    return !!this.manifest;
  }

  async use(time) {
    if (!this.manifest?.sets?.includes(time)) { this.#live(); return false; }
    this.want = time;
    try {
      const maps = await Promise.all(this.surfaces.map(s => this.#texture(`assets/lightmaps/${time}/${s.name}.webp?v=${this.manifest.version}`)));
      if (this.want !== time) return false;
      this.surfaces.forEach((s, i) => {
        bakeUVs(s);
        s.mesh.material = bakedMaterial(this.live.get(s), maps[i], SCALE * Math.PI * (this.manifest.gain ?? 1));
      });
      this.#fakes(false);
      this.active = time;
      return true;
    } catch (err) {
      console.warn('[lounge] lightmaps', err);
      this.#live();
      return false;
    }
  }

  #texture(url) {
    if (!this.cache.has(url)) {
      this.cache.set(url, new Promise((resolve, reject) => this.loader.load(url, t => {
        t.colorSpace = THREE.SRGBColorSpace;
        t.channel = 1;
        t.flipY = false;
        resolve(t);
      }, undefined, reject)));
    }
    return this.cache.get(url);
  }

  #live() {
    for (const s of this.surfaces) s.mesh.material = this.live.get(s);
    this.#fakes(true);
    this.active = null;
  }

  /** The hand-made stand-ins for baked light: floor/wall occlusion strips, contact shadows, cove washes. */
  #fakes(show) {
    this.scene.traverse(o => { if (o.userData.fake) o.visible = show; });
  }
}
