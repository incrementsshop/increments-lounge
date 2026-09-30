import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

// Renderer, camera, quality tiers and the frame loop.

export function detectQuality() {
  const q = new URLSearchParams(location.search).get('quality');
  const coarse = matchMedia('(pointer: coarse)').matches;
  const small = Math.min(screen.width, screen.height) < 700;
  const cores = navigator.hardwareConcurrency || 4;
  const mem = navigator.deviceMemory || 4;
  const saveData = navigator.connection?.saveData;
  let tier = q || (saveData ? 'low' : coarse || small ? (cores <= 4 || mem <= 3 ? 'low' : 'mid') : 'high');
  if (!['low', 'mid', 'high'].includes(tier)) tier = 'mid';
  const presets = {
    low:  { tier: 'low',  maxDpr: 1.25, shadow: 1024, textures: 1024, leaves: 260, dust: 90,  antialias: false },
    mid:  { tier: 'mid',  maxDpr: 1.6,  shadow: 1024, textures: 1024, leaves: 420, dust: 150, antialias: true },
    high: { tier: 'high', maxDpr: 2,    shadow: 2048, textures: 2048, leaves: 620, dust: 240, antialias: true },
  };
  return presets[tier];
}

export function webglAvailable() {
  try {
    const c = document.createElement('canvas');
    return !!(window.WebGL2RenderingContext && c.getContext('webgl2'));
  } catch { return false; }
}

export class World extends EventTarget {
  constructor(canvas, quality) {
    super();
    this.quality = quality;
    this.dprScale = 1;
    this.paused = false;

    const renderer = this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: quality.antialias,
      powerPreference: 'high-performance',
      alpha: false,
      // ?capture keeps the last frame around so tooling (and screenshots of a hidden tab) can read it.
      preserveDrawingBuffer: new URLSearchParams(location.search).has('capture'),
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.NeutralToneMapping;
    renderer.toneMappingExposure = 1.02;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const scene = this.scene = new THREE.Scene();
    scene.background = new THREE.Color(0xe9dfd0);
    scene.fog = new THREE.Fog(0xe9dfd0, 16, 34);

    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environmentIntensity = 0.45;
    pmrem.dispose();

    this.camera = new THREE.PerspectiveCamera(45, 1, 0.05, 60);
    this.camera.position.set(0, 1.7, 5);

    this.clock = new THREE.Clock();
    this.frameTimes = [];
    this.onFrame = [];

    this.resize = this.resize.bind(this);
    addEventListener('resize', this.resize);
    visualViewport?.addEventListener('resize', this.resize);
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) this.clock.getDelta();
    });
    this.resize();
  }

  get aspect() { return innerWidth / innerHeight; }
  get portrait() { return innerHeight > innerWidth; }

  resize() {
    const w = innerWidth, h = innerHeight;
    const dpr = Math.min(devicePixelRatio || 1, this.quality.maxDpr) * this.dprScale;
    this.renderer.setPixelRatio(Math.max(0.75, dpr));
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.dispatchEvent(new Event('resize'));
  }

  start() {
    this.renderer.setAnimationLoop(() => {
      if (document.hidden || this.paused) return;
      // `frameSkip` 2 draws every other frame (used behind the intro, where nothing moves much).
      this.frameCount = (this.frameCount || 0) + 1;
      if (this.frameSkip > 1 && this.frameCount % this.frameSkip) return;
      const dt = Math.min(this.clock.getDelta(), 0.1);
      const t = this.clock.elapsedTime;
      for (const fn of this.onFrame) fn(dt, t);
      this.renderer.render(this.scene, this.camera);
      if (!(this.frameSkip > 1)) this.#govern(dt); // skipped frames aren't slow frames
    });
  }

  // Keep phones smooth: if frames run long for a couple of seconds, render fewer pixels.
  #govern(dt) {
    this.frameTimes.push(dt);
    if (this.frameTimes.length < 90) return;
    const avg = this.frameTimes.reduce((a, b) => a + b, 0) / this.frameTimes.length;
    this.frameTimes.length = 0;
    if (avg > 1 / 32 && this.dprScale > 0.55) {
      this.dprScale = Math.max(0.55, this.dprScale - 0.15);
      this.resize();
      this.dispatchEvent(new CustomEvent('quality', { detail: { dprScale: this.dprScale, fps: Math.round(1 / avg) } }));
    } else if (avg < 1 / 55 && this.dprScale < 1) {
      this.dprScale = Math.min(1, this.dprScale + 0.05);
      this.resize();
    }
  }
}
