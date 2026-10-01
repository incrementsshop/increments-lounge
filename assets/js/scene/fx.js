import * as THREE from 'three';
import { ROOM, WINDOWS, SUN } from './layout.js';

// Atmosphere: god-rays through the arches and the skylight, and dust turning in them.
// All animated in shaders — the CPU only updates a time uniform.

const sunDir = () => new THREE.Vector3(...SUN.target).sub(new THREE.Vector3(...SUN.position)).normalize();

function archOutline({ z, w, sill, spring }, n = 28) {
  const r = w / 2, pts = [];
  pts.push([z - r, sill], [z + r, sill], [z + r, spring]);
  for (let i = 1; i < n; i++) {
    const a = (i / n) * Math.PI;
    pts.push([z + Math.cos(a) * r, spring + Math.sin(a) * r]);
  }
  pts.push([z - r, spring]);
  return pts.map(([pz, py]) => new THREE.Vector3(ROOM.x0 + 0.02, py, pz));
}

export function createFX(scene, anchors, quality) {
  const dir = sunDir();
  const group = new THREE.Group();
  group.name = 'fx';
  scene.add(group);
  const uniforms = { uTime: { value: 0 }, uPixelRatio: { value: 1 } };

  // --- Light shafts --------------------------------------------------------
  const shaftMat = new THREE.ShaderMaterial({
    uniforms: { ...uniforms, uColor: { value: new THREE.Color(0xffdcae) }, uOpacity: { value: 0.07 } },
    vertexShader: /* glsl */`
      attribute float aT;
      varying float vT;
      varying vec3 vWorld;
      void main() {
        vT = aT;
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorld = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }`,
    fragmentShader: /* glsl */`
      uniform vec3 uColor;
      uniform float uOpacity;
      uniform float uTime;
      varying float vT;
      varying vec3 vWorld;
      void main() {
        float along = pow(1.0 - vT, 1.6) * smoothstep(0.0, 0.05, vT);
        float nearFloor = smoothstep(0.0, 0.5, vWorld.y);
        float shimmer = 0.82 + 0.18 * sin(vWorld.z * 2.3 + vWorld.y * 1.7 + uTime * 0.25);
        gl_FragColor = vec4(uColor * uOpacity * along * nearFloor * shimmer, 1.0);
      }`,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });

  const LEN = 8.5;
  const shaftMeshes = WINDOWS.map(() => {
    const m = new THREE.Mesh(new THREE.BufferGeometry(), shaftMat);
    m.renderOrder = 5;
    m.frustumCulled = false;
    group.add(m);
    return m;
  });
  const buildShafts = d => {
    WINDOWS.forEach((win, wi) => {
      const ring = archOutline(win);
      const pos = [], t = [];
      for (let i = 0; i < ring.length; i++) {
        const a = ring[i], b = ring[(i + 1) % ring.length];
        const a2 = a.clone().addScaledVector(d, LEN), b2 = b.clone().addScaledVector(d, LEN);
        pos.push(...a.toArray(), ...b.toArray(), ...a2.toArray(), ...b.toArray(), ...b2.toArray(), ...a2.toArray());
        t.push(0, 0, 1, 0, 1, 1);
      }
      const g = shaftMeshes[wi].geometry;
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setAttribute('aT', new THREE.Float32BufferAttribute(t, 1));
    });
  };
  buildShafts(dir);

  // --- Dust in the sun -------------------------------------------------------
  const dustCount = quality.dust;
  const dPos = new Float32Array(dustCount * 3), dSeed = new Float32Array(dustCount);
  const dustGeo = new THREE.BufferGeometry();
  dustGeo.setAttribute('position', new THREE.BufferAttribute(dPos, 3));
  dustGeo.setAttribute('aSeed', new THREE.BufferAttribute(dSeed, 1));
  const placeDust = d => {
    for (let i = 0; i < dustCount; i++) {
      const win = WINDOWS[i % WINDOWS.length];
      const r = win.w / 2 * Math.sqrt(Math.random());
      const a = Math.random() * Math.PI * 2;
      const start = new THREE.Vector3(ROOM.x0, win.sill + (win.spring - win.sill) * 0.6 + Math.sin(a) * r * 1.1, win.z + Math.cos(a) * r);
      start.addScaledVector(d, 0.3 + Math.random() * LEN * 0.6);
      if (start.y < 0.2) start.y = 0.2 + Math.random() * 0.5;
      dPos.set(start.toArray(), i * 3);
      dSeed[i] = Math.random();
    }
    dustGeo.attributes.position.needsUpdate = true;
  };
  placeDust(dir);
  uniforms.uDust = { value: 1 };
  const dustMat = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: /* glsl */`
      uniform float uTime;
      uniform float uPixelRatio;
      attribute float aSeed;
      varying float vA;
      void main() {
        vec3 p = position;
        float s = aSeed * 6.2831;
        p.x += sin(uTime * 0.09 + s) * 0.18;
        p.y += sin(uTime * 0.07 + s * 1.7) * 0.22;
        p.z += cos(uTime * 0.11 + s * 1.3) * 0.18;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = (2.0 + aSeed * 3.0) * uPixelRatio * (3.0 / -mv.z);
        vA = 0.35 + 0.65 * (0.5 + 0.5 * sin(uTime * (0.6 + aSeed) + s * 3.0));
      }`,
    fragmentShader: /* glsl */`
      uniform float uDust;
      varying float vA;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        float a = smoothstep(0.5, 0.0, d) * vA * 0.55 * uDust;
        gl_FragColor = vec4(vec3(1.0, 0.92, 0.78) * a, 1.0);
      }`,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const dust = new THREE.Points(dustGeo, dustMat);
  dust.frustumCulled = false;
  group.add(dust);

  // --- Skylight: a soft column of daylight onto the olive, with its own dust -----------
  let column = null;
  if (anchors.skylight) {
    const { x, z, r, y } = anchors.skylight;
    column = new THREE.Mesh(
      new THREE.CylinderGeometry(r * 0.98, r * 1.3, y, 48, 1, true),
      new THREE.ShaderMaterial({
        uniforms: { ...uniforms, uColor: { value: new THREE.Color(0xfff2dc) }, uOpacity: { value: 0.085 } },
        vertexShader: /* glsl */`
          varying vec2 vUv;
          varying vec3 vWorld;
          void main() {
            vUv = uv;
            vec4 wp = modelMatrix * vec4(position, 1.0);
            vWorld = wp.xyz;
            gl_Position = projectionMatrix * viewMatrix * wp;
          }`,
        fragmentShader: /* glsl */`
          uniform vec3 uColor;
          uniform float uOpacity;
          uniform float uTime;
          varying vec2 vUv;
          varying vec3 vWorld;
          void main() {
            float t = 1.0 - vUv.y;                       // 0 at the skylight, 1 at the floor
            float along = pow(1.0 - t, 1.3) * smoothstep(0.0, 0.06, t);
            float shimmer = 0.85 + 0.15 * sin(vWorld.x * 3.1 + vWorld.z * 2.3 + uTime * 0.2);
            gl_FragColor = vec4(uColor * uOpacity * along * shimmer, 1.0);
          }`,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
      }));
    column.position.set(x, y / 2, z);
    column.renderOrder = 5;
    column.frustumCulled = false;
    group.add(column);

    const n = Math.round(quality.dust * 0.6);
    const pos = new Float32Array(n * 3), seed = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, rr = r * 1.05 * Math.sqrt(Math.random());
      pos.set([x + Math.cos(a) * rr, 0.6 + Math.random() * (y - 0.9), z + Math.sin(a) * rr], i * 3);
      seed[i] = Math.random();
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
    const skyDust = new THREE.Points(g, dustMat);
    skyDust.frustumCulled = false;
    group.add(skyDust);
  }

  // --- Steam ------------------------------------------------------------------
  const per = 16;
  const sources = anchors.steam || [];
  const sPos = new Float32Array(sources.length * per * 3), sSeed = new Float32Array(sources.length * per);
  sources.forEach((src, si) => {
    for (let k = 0; k < per; k++) {
      const i = si * per + k;
      sPos.set(src.toArray(), i * 3);
      sSeed[i] = k / per + Math.random() * 0.05;
    }
  });
  const steamGeo = new THREE.BufferGeometry();
  steamGeo.setAttribute('position', new THREE.BufferAttribute(sPos, 3));
  steamGeo.setAttribute('aSeed', new THREE.BufferAttribute(sSeed, 1));
  const steam = new THREE.Points(steamGeo, new THREE.ShaderMaterial({
    uniforms,
    vertexShader: /* glsl */`
      uniform float uTime;
      uniform float uPixelRatio;
      attribute float aSeed;
      varying float vA;
      void main() {
        float life = fract(uTime * 0.16 + aSeed);
        vec3 p = position;
        float s = aSeed * 37.0;
        p.y += life * 0.32;
        p.x += sin(life * 5.0 + s) * 0.028 * life;
        p.z += cos(life * 4.0 + s * 1.3) * 0.028 * life;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = (14.0 + life * 46.0) * uPixelRatio * (1.0 / -mv.z);
        vA = sin(life * 3.14159) * 0.22;
      }`,
    fragmentShader: /* glsl */`
      varying float vA;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        float a = smoothstep(0.5, 0.05, d) * vA;
        gl_FragColor = vec4(vec3(1.0, 0.98, 0.95), a);
      }`,
    transparent: true,
    depthWrite: false,
  }));
  steam.frustumCulled = false;
  group.add(steam);

  const state = { shaftOpacity: 0.07, shaftColor: shaftMat.uniforms.uColor.value.clone(), dustLevel: 1 };
  return {
    group,
    get shaftOpacity() { return state.shaftOpacity; },
    get shaftColor() { return state.shaftColor; },
    get dustLevel() { return state.dustLevel; },
    update(t) { uniforms.uTime.value = t; },
    setPixelRatio(pr) { uniforms.uPixelRatio.value = pr; },
    /** Point the window shafts (and their dust) along a new sun direction. */
    setSun(position, target) {
      const d = target.clone().sub(position).normalize();
      buildShafts(d);
      placeDust(d);
    },
    setAtmosphere({ shafts, shaftColor, dust }) {
      state.shaftOpacity = shafts; state.dustLevel = dust; state.shaftColor.copy(shaftColor);
      shaftMat.uniforms.uOpacity.value = shafts;
      shaftMat.uniforms.uColor.value.copy(shaftColor);
      shaftMeshes.forEach(m => { m.visible = shafts > 0.002; });
      uniforms.uDust.value = dust;
      if (column) column.material.uniforms.uOpacity.value = 0.085 * Math.min(1, dust);
    },
  };
}
