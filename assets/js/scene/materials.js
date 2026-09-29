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

  // --- Wood, leather, fabric ----------------------------------------------
  const walnutC = S.woodGrain({ width: half, height: half });
  const walnut = std({ map: tex(walnutC.map, { rotate: Math.PI / 2 }), bumpMap: tex(walnutC.bump, { srgb: false, rotate: Math.PI / 2 }), bumpScale: 0.6, roughness: 0.55 }, [1.2, 1.2]);

  const oakC = S.woodGrain({ width: half / 2, height: half / 2, seed: 8, base: '#b08a60', dark: '120,84,50', light: '214,180,138' });
  const oak = std({ map: tex(oakC.map, { rotate: Math.PI / 2 }), roughness: 0.6 }, [0.8, 0.8]);

  const leatherC = S.leather({ width: half, height: half });
  const leather = std({ map: tex(leatherC.map), bumpMap: tex(leatherC.bump, { srgb: false }), bumpScale: 0.8, roughness: 0.42, envMapIntensity: 0.9 }, [0.9, 0.9]);

  const boucleC = S.boucle({ width: half / 2, height: half / 2 });
  const boucle = std({ map: tex(boucleC.map), bumpMap: tex(boucleC.bump, { srgb: false }), bumpScale: 2, roughness: 1 }, [0.35, 0.35]);

  const rugC = S.rug({ width: half, height: Math.round(half * 0.8) });
  const rugMap = tex(rugC.map); rugMap.wrapS = rugMap.wrapT = THREE.ClampToEdgeWrapping;
  const rug = new THREE.MeshStandardMaterial({ map: rugMap, bumpMap: tex(rugC.bump, { srgb: false }), bumpScale: 1, roughness: 1 });

  const corkC = S.speckle({ width: half / 2, height: half / 2 });
  const cork = std({ map: tex(corkC.map), bumpMap: tex(corkC.bump, { srgb: false }), bumpScale: 1, roughness: 1 }, [0.6, 0.6]);

  const steelC = S.brushedMetal({ width: 256, height: 256 });
  const steel = std({ map: tex(steelC.map), color: 0xd8d6d0, metalness: 1, roughness: 0.3, envMapIntensity: 1.1 }, [0.5, 0.5]);

  const paperMap = tex(S.paper({ width: 256, height: 256 }));

  return {
    tex,
    floor, cladding, slab, slabWarm, noce,
    plaster: plasterMat, ceiling,
    walnut, oak, leather, boucle, rug, cork, steel,
    paperMap,
    paper: std({ map: paperMap, roughness: 0.92 }, [0.4, 0.4]),
    brass: new THREE.MeshStandardMaterial({ color: 0xb48f55, metalness: 1, roughness: 0.28, envMapIntensity: 1.2 }),
    blackSteel: new THREE.MeshStandardMaterial({ color: 0x1f1c19, metalness: 0.7, roughness: 0.45 }),
    enamel: new THREE.MeshStandardMaterial({ color: 0x7e1f25, metalness: 0.1, roughness: 0.28, envMapIntensity: 1 }),
    ceramic: new THREE.MeshStandardMaterial({ color: 0xf3eee5, roughness: 0.22, envMapIntensity: 0.9 }),
    ceramicDark: new THREE.MeshStandardMaterial({ color: 0x3a2c24, roughness: 0.3 }),
    coffee: new THREE.MeshStandardMaterial({ color: 0x4a2a18, roughness: 0.15 }),
    crema: new THREE.MeshStandardMaterial({ color: 0xb98a5c, roughness: 0.35 }),
    matcha: new THREE.MeshStandardMaterial({ color: 0x8aa35e, roughness: 0.4 }),
    beans: new THREE.MeshStandardMaterial({ color: 0x3b2417, roughness: 0.6 }),
    glass: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.04, metalness: 0, transparent: true, opacity: 0.16, depthWrite: false, envMapIntensity: 1.4 }),
    water: new THREE.MeshStandardMaterial({ color: 0xd9e6e2, roughness: 0.05, transparent: true, opacity: 0.35, depthWrite: false }),
    leaf: new THREE.MeshStandardMaterial({ color: 0x7c8b68, roughness: 0.75, side: THREE.DoubleSide }),
    leafLight: new THREE.MeshStandardMaterial({ color: 0xa3ad8f, roughness: 0.75, side: THREE.DoubleSide }),
    trunk: new THREE.MeshStandardMaterial({ color: 0x6b5c4b, roughness: 0.9 }),
    soil: new THREE.MeshStandardMaterial({ color: 0x3a2b20, roughness: 1 }),
    linenShade: new THREE.MeshStandardMaterial({ color: 0xf1e6d2, roughness: 1, emissive: 0xffd9a0, emissiveIntensity: 0.55, side: THREE.DoubleSide }),
    globe: new THREE.MeshStandardMaterial({ color: 0xfff4e2, emissive: 0xffdcae, emissiveIntensity: 1.6, roughness: 0.3 }),
    shadowBlob: null, // set by room.js
  };
}
