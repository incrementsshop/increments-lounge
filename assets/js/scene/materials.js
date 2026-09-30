import * as THREE from 'three';
import * as S from './stone.js';

// Three.js materials built from the procedural canvases in stone.js.
//
// Every material carries userData.uv = [metresU, metresV]: how many metres one texture
// repeat covers. applyBoxUV() then projects UVs from geometry positions so texel density
// is the same on a 5 m counter and a 20 cm cup, and nothing stretches.

export function applyBoxUV(geometry, [mu, mv] = [1, 1], offset = [Math.random(), Math.random()]) {
  const pos = geometry.attributes.position;
  let nrm = geometry.attributes.normal;
  if (!nrm) { geometry.computeVertexNormals(); nrm = geometry.attributes.normal; }
  const uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    const nx = Math.abs(nrm.getX(i)), ny = Math.abs(nrm.getY(i)), nz = Math.abs(nrm.getZ(i));
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    let u, v;
    if (ny >= nx && ny >= nz) { u = x; v = z; }      // tops: veins run along x
    else if (nx >= nz) { u = z; v = y; }             // side faces
    else { u = x; v = y; }                           // front/back faces
    uv[i * 2] = u / mu + offset[0];
    uv[i * 2 + 1] = v / mv + offset[1];
  }
  geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return geometry;
}

export function createMaterials(renderer, quality) {
  const aniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const hi = quality.textures; // 2048 on capable devices, 1024 otherwise
  const half = hi / 2;

  const tex = (canvas, { srgb = true, rotate = 0 } = {}) => {
    const t = new THREE.CanvasTexture(canvas);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = aniso;
    t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    if (rotate) { t.center.set(0.5, 0.5); t.rotation = rotate; }
    return t;
  };

  const std = (opts, uv) => {
    const m = new THREE.MeshStandardMaterial(opts);
    m.userData.uv = uv;
    return m;
  };

  // --- Travertine ---------------------------------------------------------
  // Floor: 1200×600 mm tiles in a half bond; the canvas covers 2.4 × 2.4 m (8 unique tiles).
  const floorC = S.travertineTiles({ width: hi, height: hi, cols: 2, rows: 4, grout: Math.max(2, hi / 700), seed: 7 });
  const floor = std({ map: tex(floorC.map), bumpMap: tex(floorC.bump, { srgb: false }), bumpScale: 1.4, roughness: 0.58, envMapIntensity: 0.7 }, [2.4, 2.4]);

  // Feature wall: big 1200×600 slabs, warmer lot.
  const cladC = S.travertineTiles({ width: hi, height: hi, cols: 2, rows: 4, bond: 0, grout: Math.max(2, hi / 900), seed: 31, palette: S.TRAVERTINE.warm });
  const cladding = std({ map: tex(cladC.map), bumpMap: tex(cladC.bump, { srgb: false }), bumpScale: 1.2, roughness: 0.6 }, [2.4, 2.4]);

  // Solid slab (counter, plinths, tables): one continuous piece, no joints.
  const slabC = S.travertineTiles({ width: hi, height: half, cols: 1, rows: 1, grout: 0, seed: 9, palette: S.TRAVERTINE.classic, pits: 1.3 });
  const slab = std({ map: tex(slabC.map), bumpMap: tex(slabC.bump, { srgb: false }), bumpScale: 1.6, roughness: 0.5 }, [3, 1.5]);

  const slabWarmC = S.travertineTiles({ width: half, height: half / 2, cols: 1, rows: 1, grout: 0, seed: 21, palette: S.TRAVERTINE.warm });
  const slabWarm = std({ map: tex(slabWarmC.map), bumpMap: tex(slabWarmC.bump, { srgb: false }), bumpScale: 1.2, roughness: 0.42 }, [2, 1]);

  const noceC = S.travertineTiles({ width: half, height: half / 2, cols: 1, rows: 1, grout: 0, seed: 4, palette: S.TRAVERTINE.noce });
  const noce = std({ map: tex(noceC.map), bumpMap: tex(noceC.bump, { srgb: false }), bumpScale: 1.2, roughness: 0.5 }, [1.6, 0.8]);

  // --- Walls & ceiling ----------------------------------------------------
  const plasterC = S.plaster({ width: half, height: half });
  const plasterMap = tex(plasterC.map), plasterBump = tex(plasterC.bump, { srgb: false });
  const plasterMat = std({ map: plasterMap, color: 0xfff3e2, bumpMap: plasterBump, bumpScale: 0.6, roughness: 0.95, envMapIntensity: 0.4 }, [3.2, 3.2]);
  const ceiling = std({ map: plasterMap, color: 0xf7efe3, emissive: 0x6b5641, emissiveIntensity: 0.45, roughness: 1, envMapIntensity: 0.5 }, [4, 4]);

  // Rough-cut travertine for the lettered wall: more voids, deeper relief.
  const roughC = S.travertineTiles({ width: half, height: half, cols: 1, rows: 3, bond: 0, grout: Math.max(1.5, half / 700), seed: 57, palette: S.TRAVERTINE.warm, pits: 2.4 });
  const claddingRough = std({ map: tex(roughC.map), bumpMap: tex(roughC.bump, { srgb: false }), bumpScale: 3.2, roughness: 0.75 }, [1.8, 1.8]);

  // Black split-face stone for the one dark wall. One repeat covers the full 4 m height.
  const blackC = S.blackRelief({ width: hi, height: hi });
  const blackStone = std({ map: tex(blackC.map), bumpMap: tex(blackC.bump, { srgb: false }), bumpScale: 9, roughness: 0.78, envMapIntensity: 0.6 }, [3, 4]);

  // --- Wood, leather, fabric ----------------------------------------------
  // Limewashed oak replaces the walnut: pale, matte, grain just visible.
  const woodC = S.woodGrain({ width: half, height: half, seed: 12, base: '#cdb99c', dark: '150,126,96', light: '240,230,212', density: 0.8 });
  const wood = std({ map: tex(woodC.map, { rotate: Math.PI / 2 }), bumpMap: tex(woodC.bump, { srgb: false, rotate: Math.PI / 2 }), bumpScale: 0.5, roughness: 0.7 }, [1.2, 1.2]);

  const oakC = S.woodGrain({ width: half / 2, height: half / 2, seed: 8, base: '#b89a74', dark: '120,96,66', light: '222,202,170' });
  const oak = std({ map: tex(oakC.map, { rotate: Math.PI / 2 }), roughness: 0.6 }, [0.8, 0.8]);

  // Sand leather for the banquette; the single scarlet from the Still Becoming campaign.
  const leatherC = S.leather({ width: half, height: half, base: '#b69876' });
  const leather = std({ map: tex(leatherC.map), bumpMap: tex(leatherC.bump, { srgb: false }), bumpScale: 0.7, roughness: 0.48, envMapIntensity: 0.8 }, [0.9, 0.9]);
  const scarletC = S.leather({ width: half / 2, height: half / 2, seed: 14, base: '#7c1c23' });
  const leatherScarlet = std({ map: tex(scarletC.map), bumpMap: tex(scarletC.bump, { srgb: false }), bumpScale: 0.7, roughness: 0.4, envMapIntensity: 0.9 }, [0.6, 0.6]);

  const boucleC = S.boucle({ width: half / 2, height: half / 2 });
  const boucle = std({ map: tex(boucleC.map), bumpMap: tex(boucleC.bump, { srgb: false }), bumpScale: 2, roughness: 1 }, [0.35, 0.35]);

  const rugC = S.rug({ width: half, height: Math.round(half * 0.8), base: '#e9e0d1', border: '#b9a282' });
  const rugMap = tex(rugC.map); rugMap.wrapS = rugMap.wrapT = THREE.ClampToEdgeWrapping;
  const rug = new THREE.MeshStandardMaterial({ map: rugMap, bumpMap: tex(rugC.bump, { srgb: false }), bumpScale: 1, roughness: 1 });

  const linenC = S.linen({ width: half / 2, height: half / 2 });
  const linen = std({ map: tex(linenC.map), bumpMap: tex(linenC.bump, { srgb: false }), bumpScale: 0.8, roughness: 1 }, [0.5, 0.5]);
  const curtain = new THREE.MeshStandardMaterial({ map: tex(linenC.map), color: 0xf4ede2, roughness: 1, side: THREE.DoubleSide, emissive: 0xfff0dc, emissiveIntensity: 0.08 });
  curtain.map.repeat.set(2, 4);

  const steelC = S.brushedMetal({ width: 256, height: 256 });
  const steel = std({ map: tex(steelC.map), color: 0xd8d6d0, metalness: 1, roughness: 0.3, envMapIntensity: 1.1 }, [0.5, 0.5]);

  // --- Storefront & the second accent ---------------------------------------
  // Evergreen: powder-coated steel for the door, shop window, bistro chairs and espresso machine
  // (the colourway of the same name). Scarlet stays the drop's colour; green lives with the plants.
  const evergreen = new THREE.MeshStandardMaterial({ color: 0x2b4535, metalness: 0.45, roughness: 0.42, envMapIntensity: 0.9 });
  const evergreenPaint = new THREE.MeshStandardMaterial({ color: 0x264030, roughness: 0.78 });
  const facade = std({ map: plasterMap, color: 0xfaf0e2, bumpMap: plasterBump, bumpScale: 0.8, roughness: 0.96, envMapIntensity: 0.5 }, [2.6, 2.6]);
  // Pavement: the floor's stone, greyed and laid at a larger scale (no extra texture to generate).
  const pavement = std({ map: floor.map, color: 0xcbc2b4, bumpMap: floor.bumpMap, bumpScale: 1.4, roughness: 0.92, envMapIntensity: 0.3 }, [3.6, 3.6]);
  // Sheer linen at the windows, and the fabric waves under the ceiling.
  const sheer = new THREE.MeshStandardMaterial({ map: tex(linenC.map), color: 0xfbf7f0, transparent: true, opacity: 0.62, roughness: 1, side: THREE.DoubleSide, emissive: 0xfff3e2, emissiveIntensity: 0.2, depthWrite: false });
  sheer.map.repeat.set(3, 6);
  sheer.forceSinglePass = true; // see-through both ways, drawn once
  const sail = new THREE.MeshStandardMaterial({ color: 0xf8f1e6, roughness: 1, side: THREE.DoubleSide, vertexColors: true, emissive: 0xffe4c2, emissiveIntensity: 0.16 });

  const paperMap = tex(S.paper({ width: 256, height: 256 }));
  const glowMap = new THREE.CanvasTexture(S.glowGradient());
  glowMap.colorSpace = THREE.SRGBColorSpace;

  return {
    tex,
    floor, cladding, claddingRough, blackStone, slab, slabWarm, noce,
    plaster: plasterMat, ceiling,
    wood, oak, leather, leatherScarlet, boucle, rug, linen, curtain, steel,
    evergreen, evergreenPaint, facade, pavement, sheer, sail,
    paperMap, glowMap,
    // Hidden-light pieces: the LED line itself, and the soft spill it throws on walls.
    led: new THREE.MeshBasicMaterial({ color: 0xfff1d8 }),
    wash: (color = 0xffd7a6, opacity = 0.3) => new THREE.MeshBasicMaterial({
      map: glowMap, color, transparent: true, opacity, blending: THREE.AdditiveBlending,
      depthWrite: false, side: THREE.DoubleSide, fog: false, forceSinglePass: true,
    }),
    paper: std({ map: paperMap, roughness: 0.92 }, [0.4, 0.4]),
    brass: new THREE.MeshStandardMaterial({ color: 0xb48f55, metalness: 1, roughness: 0.28, envMapIntensity: 1.2 }),
    blackSteel: new THREE.MeshStandardMaterial({ color: 0x1f1c19, metalness: 0.7, roughness: 0.45 }),
    ceramic: new THREE.MeshStandardMaterial({ color: 0xf3eee5, roughness: 0.22, envMapIntensity: 0.9 }),
    ceramicDark: new THREE.MeshStandardMaterial({ color: 0x8a7560, roughness: 0.5 }),
    glass: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.04, metalness: 0, transparent: true, opacity: 0.16, depthWrite: false, envMapIntensity: 1.4 }),
    leaf: new THREE.MeshStandardMaterial({ color: 0x7c8b68, roughness: 0.75, side: THREE.DoubleSide }),
    leafLight: new THREE.MeshStandardMaterial({ color: 0xa3ad8f, roughness: 0.75, side: THREE.DoubleSide }),
    trunk: new THREE.MeshStandardMaterial({ color: 0x6b5c4b, roughness: 0.9 }),
    soil: new THREE.MeshStandardMaterial({ color: 0x3a2b20, roughness: 1 }),
    linenShade: new THREE.MeshStandardMaterial({ color: 0xf1e6d2, roughness: 1, emissive: 0xffd9a0, emissiveIntensity: 0.55, side: THREE.DoubleSide }),
  };
}
