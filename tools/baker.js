import * as THREE from 'three';
import { World } from '../assets/js/scene/world.js';
import { createMaterials } from '../assets/js/scene/materials.js';
import { buildRoom, roundedRect } from '../assets/js/scene/room.js';
import { buildFurniture } from '../assets/js/scene/furniture.js';
import { TIMES } from '../assets/js/scene/lighting.js';
import { bakeSurfaces, bakeUVs, SCALE } from '../assets/js/scene/lightmaps.js';
import * as L from '../assets/js/scene/layout.js';

// Progressive lightmap baker. For each time of day it renders every shell surface in
// its lightmap (UV) space, again and again, each time with the lights nudged to a new
// random sample — a soft sun, sky light from a random direction, a random point along
// the hidden cove, daylight through the skylight — and keeps a running average. Every
// piece of furniture casts shadows into it. The averages are the baked light.

const BAKE_LAYER = 7;

function halton(i, b) {
  let f = 1, r = 0;
  while (i > 0) { f /= b; r += f * (i % b); i = Math.floor(i / b); }
  return r;
}

function bakeMaterial() {
  const mat = new THREE.MeshLambertMaterial({ color: 0xffffff, side: THREE.DoubleSide });
  const uniforms = { uPrev: { value: null }, uBlend: { value: 1 }, uRes: { value: new THREE.Vector2(1, 1) }, uFlip: { value: 1 } };
  mat.userData.uniforms = uniforms;
  mat.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, uniforms);
    // Draw each triangle where it lives in the lightmap, but light it where it lives in the room.
    // Winding in UV space says nothing about which way a surface faces, so light by the
    // geometry's own normal (flipped for surfaces seen from inside, like the curved corners).
    shader.vertexShader = 'attribute vec2 bakeUV;\nuniform float uFlip;\n' + shader.vertexShader
      .replace('#include <beginnormal_vertex>', '#include <beginnormal_vertex>\n  objectNormal *= uFlip;')
      .replace(/}\s*$/, '  gl_Position = vec4(bakeUV * 2.0 - 1.0, 0.0, 1.0);\n}\n');
    shader.fragmentShader = 'uniform sampler2D uPrev;\nuniform float uBlend;\nuniform vec2 uRes;\n' + shader.fragmentShader
      .replace('#include <normal_fragment_begin>', THREE.ShaderChunk.normal_fragment_begin.replace('gl_FrontFacing ? 1.0 : - 1.0', '1.0'))
      .replace(/}\s*$/, '  vec3 prevC = texture2D(uPrev, gl_FragCoord.xy / uRes).rgb;\n  gl_FragColor = vec4(mix(prevC, gl_FragColor.rgb, uBlend), 1.0);\n}\n');
  };
  mat.customProgramCacheKey = () => 'lounge-bake';
  return mat;
}

function directional(size) {
  const l = new THREE.DirectionalLight(0xffffff, 0);
  l.castShadow = true;
  l.shadow.mapSize.set(size, size);
  const c = l.shadow.camera;
  c.left = -15; c.right = 15; c.top = 15; c.bottom = -15; c.near = 1; c.far = 60;
  l.shadow.bias = -0.0005;
  l.shadow.normalBias = 0.03;
  l.layers.enable(BAKE_LAYER);
  l.target.position.set(0, 0, 0);
  return l;
}

/** Points along the cove: a rounded rectangle just inside the walls, under the ceiling band. */
function covePath() {
  const R = L.ROOM, ins = 0.16;
  const shape = roundedRect(R.x0 + ins, R.z0 + ins, R.x1 - ins, R.z1 - ins, R.corner - ins);
  return { points: shape.getSpacedPoints(400), length: shape.getLength() };
}

export async function bake({ canvas, times = ['morning', 'golden', 'evening'], samples = 320, onProgress = () => {}, save }) {
  const quality = { tier: 'bake', maxDpr: 1, shadow: 2048, textures: 2048, leaves: 620, dust: 0, antialias: false };
  const world = new World(canvas, quality);
  const renderer = world.renderer;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.shadowMap.autoUpdate = false;
  const scene = world.scene;
  scene.fog = null;
  // No background: each pass would paint every texel the surface doesn't cover with it, so the
  // edge-filling below (dilate) found nothing to fill and edges bled toward beige.
  scene.background = null;
  const M = createMaterials(renderer, quality);
  const room = buildRoom(scene, M, quality);
  const { anchors } = buildFurniture(scene, M, quality);

  // Occluders for light from above: the floating slab (with the skylight cut through it) and
  // the cove band — not the flat ceiling box, which would also cover the skylight.
  room.receivers.slab.castShadow = true;
  room.cove.castShadow = true;
  scene.traverse(o => { if (o.isMesh && o.geometry?.type === 'BoxGeometry' && o.position.y > L.ROOM.h) o.castShadow = false; });

  // Switch off the live rig; the bake brings its own lights.
  for (const l of [room.sun, room.hemi, room.fill, room.skyLight]) { l.intensity = 0; l.castShadow = false; }
  // …except the soft fill: the live room's hemisphere and fill light are part of its look
  // (the airy, creamy base), so the bake carries them too, unshadowed, exactly as live.
  room.hemi.layers.enable(BAKE_LAYER);
  room.fill.layers.enable(BAKE_LAYER);
  const interior = anchors.lights.map(l => ({ l, base: l.intensity }));
  interior.forEach(({ l }) => { l.castShadow = false; l.layers.enable(BAKE_LAYER); });

  const sun = directional(4096), sky = directional(1024), skylight = directional(1024);
  // The cove LED line, as a handful of spots spread along it (re-scattered every pass).
  const COVE_SPOTS = 6;
  const coves = Array.from({ length: COVE_SPOTS }, () => {
    const c = new THREE.SpotLight(0xffffff, 0, 0, 1.2, 1, 2);
    c.castShadow = true;
    c.shadow.mapSize.set(256, 256);
    c.shadow.bias = -0.001;
    c.shadow.camera.near = 0.05;
    c.layers.enable(BAKE_LAYER);
    return c;
  });
  scene.add(sun, sun.target, sky, sky.target, skylight, skylight.target);
  coves.forEach(c => scene.add(c, c.target));
  // Soft light from the ceiling over the middle of the room (the glow above the fabric waves):
  // a few wide downlights re-scattered under the floating slab every pass, so the floor
  // under the ceiling is lit and everything on it casts a soft shadow straight down.
  const CEIL_SPOTS = 4;
  const ceils = Array.from({ length: CEIL_SPOTS }, () => {
    const c = new THREE.SpotLight(0xffffff, 0, 0, Math.PI / 2.4, 1, 2);
    c.castShadow = true;
    c.shadow.mapSize.set(256, 256);
    c.shadow.bias = -0.001;
    c.shadow.camera.near = 0.05;
    c.layers.enable(BAKE_LAYER);
    scene.add(c, c.target);
    return c;
  });
  const ceilX0 = L.ROOM.x0 + 0.9, ceilX1 = L.ROOM.x1 - 0.9, ceilZ0 = L.ROOM.z0 + 0.9, ceilZ1 = L.ROOM.z1 - 0.9;
  const { points: coveLine, length: coveLength } = covePath();
  const center = new THREE.Vector3(0, 0, 0);

  // Light bounced round the room, standing in for global illumination: the ceiling and upper
  // walls glow with the bright floor's colour (ground), and the floor gets some of it back
  // from the walls and ceiling (sky) — which keeps the middle of the room from going dark.
  const bounce = new THREE.HemisphereLight(0x000000, 0xffffff, 0);
  const WALL_BOUNCE = 0.6;
  bounce.layers.enable(BAKE_LAYER);
  scene.add(bounce);

  const surfaces = bakeSurfaces(room.receivers);
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  cam.layers.set(BAKE_LAYER);
  // three.js only draws shadow casters the *rendering* camera can see (by layer). The bake
  // camera sees one surface at a time, so shadow maps are drawn first with a camera that
  // sees every layer — pointed away from the room so its own pass draws next to nothing.
  const shadowCam = new THREE.PerspectiveCamera(10, 1, 1, 2);
  shadowCam.layers.enableAll();
  shadowCam.position.set(0, -500, 0);
  shadowCam.lookAt(0, -1000, 0);
  shadowCam.updateMatrixWorld();
  const dummy = new THREE.WebGLRenderTarget(1, 1);
  const mat = bakeMaterial();
  for (const s of surfaces) {
    const uv = bakeUVs(s);
    s.mesh.geometry.setAttribute('bakeUV', uv);
    s.mesh.frustumCulled = false;
    s.mesh.receiveShadow = true;
    if (s.kind !== 'floor') s.mesh.castShadow = true; // walls frame the window light
    s.live = s.mesh.material;
  }
  const floorSurface = surfaces.find(s => s.name === 'floor');
  const floorTint = new THREE.Color(0xeee2cf).convertSRGBToLinear(); // travertine, as light sees it

  const results = {};
  const totalSteps = times.length * samples;
  let stepCount = 0;

  for (const time of times) {
    const P = TIMES[time];
    interior.forEach(({ l, base }) => { l.intensity = base * P.interior; });
    room.hemi.color.set(P.hemi.sky); room.hemi.groundColor.set(P.hemi.ground);
    room.hemi.intensity = P.hemi.intensity * (P.bake.ambient ?? 1);
    room.fill.intensity = P.fill * (P.bake.ambient ?? 1);
    sun.intensity = P.sun ? P.sun.intensity : 0;
    sun.castShadow = !!P.sun;
    if (P.sun) sun.color.set(P.sun.color);
    sky.color.set(P.bake.skyColor);
    skylight.color.set(P.bake.skyColor);
    coves.forEach(c => c.color.set(P.bake.coveColor));
    ceils.forEach(c => c.color.set(P.bake.ceilingColor ?? 0xffe6c8));
    // Points toward the sun, exactly as the room's sun is aimed (at SUN.target, not the origin).
    const sunDir = P.sun ? new THREE.Vector3(...P.sun.position).sub(new THREE.Vector3(...L.SUN.target)).normalize() : null;

    const makeTargets = list => list.map(s => {
      const opts = { type: THREE.FloatType, format: THREE.RGBAFormat, depthBuffer: false, magFilter: THREE.NearestFilter, minFilter: THREE.NearestFilter };
      const a = new THREE.WebGLRenderTarget(s.w, s.h, opts), b = new THREE.WebGLRenderTarget(s.w, s.h, opts);
      for (const rt of [a, b]) { renderer.setRenderTarget(rt); renderer.setClearColor(0x000000, 0); renderer.clear(); }
      return { s, a, b };
    });

    const pass = (k, targets) => {
      // Soft sun: jitter within ~0.9°.
      if (sunDir) {
        const j = new THREE.Vector3(halton(k, 2) - 0.5, halton(k, 3) - 0.5, halton(k, 5) - 0.5).multiplyScalar(0.03);
        sun.position.copy(sunDir).add(j).normalize().multiplyScalar(30);
      }
      // Sky: cosine-weighted direction over the upper hemisphere.
      const u1 = halton(k, 7), u2 = halton(k, 11);
      const r = Math.sqrt(u1), phi = u2 * Math.PI * 2;
      sky.position.set(r * Math.cos(phi), Math.sqrt(1 - u1), r * Math.sin(phi)).multiplyScalar(30);
      sky.intensity = P.bake.sky;
      // Skylight: within ~22° of straight down, through the oculus.
      const u3 = halton(k, 13), u4 = halton(k, 17);
      const cr = Math.sqrt(u3) * Math.sin(THREE.MathUtils.degToRad(22)), cphi = u4 * Math.PI * 2;
      skylight.position.set(L.SKYLIGHT.x + cr * Math.cos(cphi) * 30, 30, L.SKYLIGHT.z + cr * Math.sin(cphi) * 30);
      skylight.target.position.set(L.SKYLIGHT.x, 0, L.SKYLIGHT.z);
      skylight.intensity = P.bake.skylight;
      // Cove: points spread evenly along the hidden LED line, just outside the slab's edge,
      // washing the wall from its top down.
      const off = halton(k, 19);
      coves.forEach((c, j) => {
        const cp = coveLine[Math.floor(((off + j / COVE_SPOTS) % 1) * coveLine.length)];
        const toWall = new THREE.Vector3(cp.x, 0, cp.y).sub(center).setY(0).normalize();
        c.position.set(cp.x - toWall.x * 0.2, L.CEILING.drop + 0.1, cp.y - toWall.z * 0.2);
        c.target.position.set(cp.x + toWall.x * 0.3, 1.6, cp.y + toWall.z * 0.3);
        c.intensity = P.bake.cove * coveLength / COVE_SPOTS;
      });
      ceils.forEach((c, j) => {
        let x, z, tries = 0;
        do {
          const u = (halton(k * CEIL_SPOTS + j + tries * 97, 23)), v = (halton(k * CEIL_SPOTS + j + tries * 97, 29));
          x = ceilX0 + u * (ceilX1 - ceilX0); z = ceilZ0 + v * (ceilZ1 - ceilZ0);
          tries++;
        } while (Math.hypot(x - L.SKYLIGHT.x, z - L.SKYLIGHT.z) < L.SKYLIGHT.r + 0.3 && tries < 8);
        c.position.set(x, L.CEILING.drop - 0.05, z);
        c.target.position.set(x, 0, z);
        c.intensity = (P.bake.ceiling ?? 0) / CEIL_SPOTS;
      });
      for (const l of [sun, sky, skylight, sun.target, sky.target, skylight.target, ...coves, ...coves.map(c => c.target), ...ceils, ...ceils.map(c => c.target)]) l.updateMatrixWorld();

      renderer.shadowMap.needsUpdate = true;
      renderer.setRenderTarget(dummy);
      renderer.render(scene, shadowCam);
      renderer.shadowMap.needsUpdate = false;
      for (const t of targets) {
        const { s } = t;
        s.mesh.layers.enable(BAKE_LAYER);
        s.mesh.material = mat;
        mat.userData.uniforms.uPrev.value = t.a.texture;
        mat.userData.uniforms.uBlend.value = 1 / k;
        mat.userData.uniforms.uRes.value.set(s.w, s.h);
        mat.userData.uniforms.uFlip.value = s.kind === 'corner' ? -1 : 1;
        renderer.setRenderTarget(t.b);
        renderer.render(scene, cam);
        s.mesh.layers.disable(BAKE_LAYER);
        s.mesh.material = s.live;
        [t.a, t.b] = [t.b, t.a];
      }
    };

    // Pre-pass: how much light lands on the floor sets how much it bounces back up.
    bounce.intensity = 0;
    const [probe] = makeTargets([floorSurface]);
    const probeSamples = Math.min(48, samples);
    for (let k = 1; k <= probeSamples; k++) pass(k, [probe]);
    const fpx = new Float32Array(probe.s.w * probe.s.h * 4);
    renderer.readRenderTargetPixels(probe.a, 0, 0, probe.s.w, probe.s.h, fpx);
    probe.a.dispose(); probe.b.dispose();
    let sum = 0;
    for (let i = 0; i < fpx.length; i += 4) sum += (fpx[i] + fpx[i + 1] + fpx[i + 2]) / 3;
    const floorIrradiance = (sum / (fpx.length / 4)) * Math.PI; // the bake writes E/π for a white surface
    bounce.groundColor.copy(floorTint);
    bounce.color.copy(floorTint).multiplyScalar(WALL_BOUNCE);
    bounce.intensity = floorIrradiance * P.bake.bounce;
    console.info(`[bake] ${time}: floor irradiance ${floorIrradiance.toFixed(2)}, bounce ${bounce.intensity.toFixed(2)}`);

    const targets = makeTargets(surfaces);
    for (let k = 1; k <= samples; k++) {
      pass(k, targets);
      stepCount++;
      if (k % 16 === 0) { onProgress(stepCount / totalSteps, `${time}: ${k}/${samples}`); await new Promise(r => setTimeout(r, 0)); }
    }

    results[time] = {};
    for (const t of targets) {
      const { s } = t;
      const px = new Float32Array(s.w * s.h * 4);
      renderer.readRenderTargetPixels(t.a, 0, 0, s.w, s.h, px);
      dilate(px, s.w, s.h, 10);
      const canvasOut = encode(px, s.w, s.h);
      results[time][s.name] = canvasOut;
      if (save) await save(time, s.name, canvasOut);
      t.a.dispose(); t.b.dispose();
    }
  }
  renderer.setRenderTarget(null);
  dummy.dispose();
  onProgress(1, 'done');
  return { results, surfaces: surfaces.map(s => s.name) };
}

/** Grow written texels into their empty neighbours so seams never sample black. */
function dilate(px, w, h, passes) {
  for (let p = 0; p < passes; p++) {
    const src = px.slice();
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        if (src[i + 3] > 0.5) continue;
        let r = 0, g = 0, b = 0, n = 0;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]) {
          const xx = x + dx, yy = y + dy;
          if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
          const j = (yy * w + xx) * 4;
          if (src[j + 3] > 0.5) { r += src[j]; g += src[j + 1]; b += src[j + 2]; n++; }
        }
        if (n) { px[i] = r / n; px[i + 1] = g / n; px[i + 2] = b / n; px[i + 3] = 1; }
      }
    }
  }
}

/** Linear light ÷ SCALE → sRGB bytes. Row 0 of the image is v = 0 (textures load with flipY off). */
function encode(px, w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(w, h);
  const srgb = v => (v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055);
  for (let i = 0; i < w * h; i++) {
    for (let ch = 0; ch < 3; ch++) img.data[i * 4 + ch] = Math.round(255 * srgb(Math.min(1, Math.max(0, px[i * 4 + ch] / SCALE))));
    img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return c;
}
