import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { CONFIG } from '../config.js';
import { prepareProductImage, loadImage, shopifyImage } from './cutout.js';
import { box, cyl, place, canvasTexture, pickable } from './helpers.js';
import { drawTravertine, seeded, TRAVERTINE } from './stone.js';
import * as L from './layout.js';
import { formatShort } from '../catalog.js';

// Puts the catalog into the room. Everything here is data-driven: change the
// catalog (or data/merch.json) and the room re-merchandises itself.

const CARD = { paper: '#f7f2e8', ink: '#2a1d16', muted: '#7a6656', scarlet: '#8c2027' };
const TEAM_QUOTES = [
  'Use your obstacles as lessons, and your lessons as motivation.',
  'It is the incremental journey that will help you succeed.',
  'Life is a series. The direction it takes is up to you.',
];

export class Displays {
  constructor(scene, M, anchors, catalog) {
    this.scene = scene;
    this.M = M;
    this.A = anchors;
    this.catalog = catalog;
    this.root = new THREE.Group();
    this.root.name = 'displays';
    scene.add(this.root);
    this.hotspots = [];
    this.swayers = [];
    this.fadeIns = [];
    this.menuRows = [];
    this.pinned = new THREE.Group();
    this.root.add(this.pinned);
  }

  /** Synchronous parts first (the room looks furnished immediately), then images stream in. */
  async build({ onProgress = () => {}, stationCams = {} } = {}) {
    this.stationCams = stationCams;
    this.plaque();
    this.archive();
    this.noticeBoard();
    this.stationSigns();
    const jobs = [
      () => this.windowDisplay(),
      () => this.loungeRail(),
      () => this.movementRack(),
      () => this.till(),
      () => this.campaignPrint(),
      () => this.vitrine(),
      () => this.polaroids(),
      () => this.shelfFrames(),
    ];
    let done = 0;
    await Promise.all(jobs.map(job => job().catch(err => console.warn('[lounge] display', err)).finally(() => onProgress(++done / jobs.length))));
  }

  update(t, dt) {
    for (const s of this.swayers) s.obj.rotation[s.axis] = s.base + Math.sin(t * s.speed + s.phase) * s.amp;
    for (let i = this.fadeIns.length - 1; i >= 0; i--) {
      const f = this.fadeIns[i];
      f.t = Math.min(1, f.t + dt * 1.6);
      const e = 1 - Math.pow(1 - f.t, 3);
      f.obj.scale.setScalar(0.94 + 0.06 * e);
      f.mats.forEach(m => { m.opacity = e; });
      if (f.t >= 1) {
        f.mats.forEach(m => { m.transparent = m.userData.wasTransparent; m.opacity = 1; m.needsUpdate = true; });
        this.fadeIns.splice(i, 1);
      }
    }
  }

  // --- helpers ------------------------------------------------------------

  hotspot(station, position, label, sub, action, opts = {}) {
    this.hotspots.push({ station, position: position.clone(), label, sub, action, ...opts });
  }

  appear(obj) {
    const mats = [];
    obj.traverse(o => {
      if (!o.material) return;
      for (const m of [].concat(o.material)) {
        if (mats.includes(m)) continue;
        m.userData.wasTransparent = m.transparent;
        m.transparent = true;
        m.opacity = 0;
        mats.push(m);
      }
    });
    this.fadeIns.push({ obj, mats, t: 0 });
  }

  facing(from, stationId) {
    const cam = this.stationCams[stationId];
    if (!cam) return 0;
    return Math.atan2(cam[0] - from.x, cam[2] - from.z);
  }

  garmentMaterial(canvas) {
    const map = new THREE.CanvasTexture(canvas);
    map.colorSpace = THREE.SRGBColorSpace;
    map.anisotropy = 8;
    return new THREE.MeshStandardMaterial({
      map, alphaTest: 0.55, side: THREE.DoubleSide, roughness: 0.95,
      emissive: 0xffffff, emissiveMap: map, emissiveIntensity: 0.14,
    });
  }

  photoMaterial(image, { width = 512, square = false } = {}) {
    const c = document.createElement('canvas');
    const aspect = square ? 1 : image.naturalWidth / image.naturalHeight;
    c.width = width; c.height = Math.round(width / aspect);
    const ctx = c.getContext('2d');
    // Cover-crop.
    const s = Math.max(c.width / image.naturalWidth, c.height / image.naturalHeight);
    const dw = image.naturalWidth * s, dh = image.naturalHeight * s;
    ctx.drawImage(image, (c.width - dw) / 2, (c.height - dh) / 2, dw, dh);
    const map = new THREE.CanvasTexture(c);
    map.colorSpace = THREE.SRGBColorSpace;
    map.anisotropy = 8;
    return { material: new THREE.MeshStandardMaterial({ map, roughness: 0.6, emissive: 0xffffff, emissiveMap: map, emissiveIntensity: 0.12 }), aspect };
  }

  bentPlane(w, h, bend = 0.03, seg = 12) {
    const g = new THREE.PlaneGeometry(w, h, seg, 1);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const u = (2 * p.getX(i)) / w;
      p.setZ(i, bend * (1 - u * u));
    }
    g.computeVertexNormals();
    return g;
  }

  /** Best cut-out for a colourway: the colour's own image, or any other image whose garment colour matches. */
  async cutoutFor(product, colourName) {
    const colour = product.colours.find(c => c.name === colourName);
    if (colour?.image) {
      const r = await prepareProductImage(colour.image).catch(() => null);
      if (r?.kind === 'cutout') return r;
    }
    if (!colour?.hex) return null;
    const target = hexRgb(colour.hex);
    const claimed = new Set(product.colours.filter(c => c.name !== colourName).map(c => c.image));
    let best = null, bestD = Infinity;
    for (const img of product.images) {
      if (claimed.has(img.src)) continue;
      const r = await prepareProductImage(img.src).catch(() => null);
      if (r?.kind !== 'cutout' || !r.avg) continue;
      const d = Math.hypot(r.avg[0] - target[0], r.avg[1] - target[1], r.avg[2] - target[2]);
      if (d < bestD) { best = r; bestD = d; }
    }
    return bestD < 70 ? best : null;
  }

  // --- The Window: ghost-mannequin outfits on the plinths -----------------

  async windowDisplay() {
    const products = this.catalog.zone('window');
    const top = products.find(p => /hoodie/i.test(p.title)) || products[0];
    const bottom = products.find(p => /sweat|jogger|pant/i.test(p.title) && p !== top);
    if (!top) return;
    const colours = ['Midnight', 'Evergreen', 'Scarlet'].filter(c => top.colours.some(x => x.name === c));
    const order = colours.length ? colours : top.colours.map(c => c.name).slice(0, 3);

    await Promise.all(this.A.outfits.slice(0, order.length).map(async (anchor, i) => {
      const colour = order[i];
      const g = new THREE.Group();
      g.userData.outfit = true; // tapping either piece leans in on the whole outfit
      g.position.copy(anchor);
      g.rotation.y = this.facing(anchor, 'window');
      this.root.add(g);
      g.updateMatrixWorld(true);

      const [hoodie, sweat] = await Promise.all([this.cutoutFor(top, colour), bottom ? this.cutoutFor(bottom, colour) : null]);
      const sh = 0.98;
      let waist = 0;
      if (sweat) {
        const sw = sh * sweat.aspect;
        const m = new THREE.Mesh(this.bentPlane(sw, sh, 0.025), this.garmentMaterial(sweat.canvas));
        m.position.y = sh / 2 + 0.01;
        m.castShadow = true;
        pickable(m, { kind: 'product', handle: bottom.handle, colour, station: 'window' });
        g.add(m);
        waist = sh - 0.13;
        if (i === 2) this.hotspot('window', g.localToWorld(new THREE.Vector3(0, sh * 0.35, 0.05)), bottom.title, `$${formatShort(bottom.price)}`, { type: 'product', handle: bottom.handle, colour }, { flip: true, target: g });
      }
      if (hoodie) {
        const hw = 0.68;
        const hh = hw / hoodie.aspect;
        const m = new THREE.Mesh(this.bentPlane(hw, hh, 0.05), this.garmentMaterial(hoodie.canvas));
        m.position.set(0, waist + hh / 2, 0.025);
        m.castShadow = true;
        pickable(m, { kind: 'product', handle: top.handle, colour, station: 'window' });
        g.add(m);
        if (i === 1) this.hotspot('window', g.localToWorld(new THREE.Vector3(0, waist + hh * 0.55, 0.08)), top.title, `$${formatShort(top.price)}`, { type: 'product', handle: top.handle, colour }, { flip: true, target: g });
      } else {
        // No clean shot for this colourway: lean its campaign photo against the plinth instead.
        const src = top.imageFor(colour);
        if (src) {
          const img = await loadImage(shopifyImage(src, 600));
          const frame = this.framedPrint(img, 0.42, { mat: this.M.wood });
          frame.position.set(0.1, 0, 0.35);
          frame.rotation.x = -0.12;
          pickable(frame, { kind: 'product', handle: top.handle, colour, station: 'window' });
          const lean = new THREE.Group();
          lean.add(frame);
          lean.position.set(0, -anchor.y, 0);
          g.add(lean);
          if (i === 1) this.hotspot('window', g.localToWorld(new THREE.Vector3(0.1, 0.35 - anchor.y, 0.4)), top.title, `$${formatShort(top.price)}`, { type: 'product', handle: top.handle, colour }, { target: frame });
        }
      }
      this.appear(g);
      this.swayers.push({ obj: g, axis: 'y', base: g.rotation.y, amp: 0.012, speed: 0.35 + i * 0.07, phase: i * 1.7 });
    }));
  }

  // --- The Lounge: Worn pieces on hangers in the lit niche ------------------

  async loungeRail() {
    const products = this.catalog.zone('lounge');
    const top = products.find(p => /hoodie/i.test(p.title));
    const bottom = products.find(p => /sweat|jogger|pant/i.test(p.title));
    const colourNames = (top || bottom)?.colours.map(c => c.name) || [];
    const items = [];
    for (const c of colourNames) {
      if (top) items.push({ p: top, c, kind: 'top' });
      if (bottom) items.push({ p: bottom, c, kind: 'bottom' });
    }
    const { x, y, z0, z1 } = this.A.loungeRail;
    const step = items.length > 1 ? (z1 - z0) / (items.length - 1) : 0;
    const hanger = this.M.wood;

    await Promise.all(items.map(async (it, i) => {
      const cut = await this.cutoutFor(it.p, it.c);
      if (!cut) return;
      const g = new THREE.Group();
      g.position.set(x - 0.02, y, z0 + i * step);
      g.rotation.y = -Math.PI / 2;
      this.root.add(g);
      g.updateMatrixWorld(true);

      // Hook + hanger.
      const hook = new THREE.Mesh(new THREE.TorusGeometry(0.022, 0.003, 6, 16, Math.PI * 1.3), this.M.steel);
      hook.position.set(0, 0.01, 0.02);
      hook.rotation.y = Math.PI / 2;
      g.add(hook);
      if (it.kind === 'top') {
        for (const s of [-1, 1]) {
          const arm = box(0.3, 0.02, 0.014, hanger);
          arm.position.set(s * 0.145, -0.055, 0.01);
          arm.rotation.z = s * -0.32;
          g.add(arm);
        }
      } else {
        g.add(place(box(0.46, 0.02, 0.014, hanger), 0, -0.035, 0.01));
        for (const s of [-1, 1]) g.add(place(box(0.03, 0.05, 0.02, this.M.steel), s * 0.19, -0.06, 0.012));
      }
      g.add(place(cyl(0.003, 0.003, 0.04, this.M.steel, { segments: 6 }), 0, -0.012, 0.01));

      let w, h;
      if (it.kind === 'top') { w = 0.92; h = w / cut.aspect; }
      else { h = 1.28; w = h * cut.aspect; }
      const m = new THREE.Mesh(this.bentPlane(w, h, 0.035), this.garmentMaterial(cut.canvas));
      m.position.set(0, -0.06 - h / 2 + (it.kind === 'top' ? 0.04 : 0), 0.03);
      m.castShadow = true;
      pickable(m, { kind: 'product', handle: it.p.handle, colour: it.c, station: 'lounge' });
      g.add(m);
      this.appear(g);
      this.swayers.push({ obj: g, axis: 'y', base: g.rotation.y, amp: 0.035, speed: 0.5 + (i % 3) * 0.13, phase: i * 1.1 });
      if (i === 2 || i === 3) {
        this.hotspot('lounge', g.localToWorld(new THREE.Vector3(0, -0.06 - h * 0.45, 0.08)), it.p.title, `$${formatShort(it.p.price)} · ${it.c}`, { type: 'product', handle: it.p.handle, colour: it.c }, { flip: i === 2, target: m });
      }
    }));
  }

  // --- Movement: photos pegged to the steel rack ------------------------------

  async movementRack() {
    const products = this.catalog.zone('movement').filter(p => p.available);
    const bars = this.A.rackBars;
    const perRow = Math.ceil(products.length / bars.length);
    await Promise.all(products.map(async (p, i) => {
      const row = Math.floor(i / perRow);
      const col = i % perRow;
      const count = Math.min(perRow, products.length - row * perRow);
      const bar = bars[row];
      if (!bar) return;
      const span = bar.x1 - bar.x0;
      const px = bar.x0 + (count === 1 ? span / 2 : (col / (count - 1)) * span);

      const src = p.colours[0]?.image || p.images[0]?.src;
      if (!src) return;
      const prep = await prepareProductImage(src, { maxSize: 560, width: 700 }).catch(() => null);
      if (!prep) return;

      const g = new THREE.Group();
      g.position.set(px, bar.y - 0.02, bar.z + 0.02);
      this.root.add(g);
      const w = 0.3;
      let h;
      if (prep.kind === 'cutout') {
        h = Math.min(0.62, w / prep.aspect);
        const m = new THREE.Mesh(this.bentPlane(h * prep.aspect, h, 0.02), this.garmentMaterial(prep.canvas));
        m.position.y = -0.05 - h / 2;
        m.castShadow = true;
        pickable(m, { kind: 'product', handle: p.handle, station: 'movement' });
        g.add(m);
      } else {
        const { material, aspect } = this.photoMaterial(prep.image, { width: 420 });
        h = Math.min(0.5, w / aspect);
        const card = box(w + 0.018, h + 0.018, 0.003, this.M.paper);
        card.position.y = -0.06 - h / 2;
        const photo = new THREE.Mesh(this.bentPlane(w, h, 0.004, 4), material);
        photo.position.set(0, -0.06 - h / 2, 0.0025);
        const holder = new THREE.Group();
        holder.add(card, photo);
        holder.rotation.z = (Math.random() - 0.5) * 0.05;
        pickable(holder, { kind: 'product', handle: p.handle, station: 'movement' });
        g.add(holder);
      }
      // Wooden clip and a short wire from the bar.
      g.add(place(box(0.028, 0.055, 0.014, this.M.oak), 0, -0.055, 0.004));
      g.add(place(cyl(0.0015, 0.0015, 0.04, this.M.steel, { segments: 4, cast: false }), 0, -0.01, 0));
      this.appear(g);
      this.swayers.push({ obj: g, axis: 'x', base: 0, amp: 0.025, speed: 0.6 + (i % 4) * 0.1, phase: i * 0.9 });
      this.hotspot('movement', new THREE.Vector3(px, bar.y - 0.06 - h * 0.5, bar.z + 0.06), p.title, `$${formatShort(p.price)}`, { type: 'product', handle: p.handle }, { flip: px > (bar.x0 + bar.x1) / 2, compact: true, target: g });
    }));
  }

  // --- At the till: socks & caps in the glass case ---------------------------

  async till() {
    const products = this.catalog.zone('till').filter(p => p.available);
    const t = this.A.till;
    const slots = [[-0.24, 0], [0.22, 0], [-0.22, 1], [0.2, 1]];
    const entries = [];
    for (const p of products) entries.push({ p, colour: p.colours[0]?.name });
    const cap = products.find(p => /cap/i.test(p.title));
    if (cap) cap.colours.slice(1, 3).forEach(c => entries.push({ p: cap, colour: c.name }));

    await Promise.all(entries.slice(0, slots.length).map(async ({ p, colour }, i) => {
      const [sx, level] = slots[i];
      const src = (colour && p.imageFor(colour)) || p.images[0]?.src;
      if (!src) return;
      const img = await loadImage(shopifyImage(src, 360)).catch(() => null);
      if (!img) return;
      const { material } = this.photoMaterial(img, { width: 256, square: true });
      const size = level === 0 ? 0.15 : 0.12;
      const g = new THREE.Group();
      const card = box(size + 0.014, size + 0.03, 0.003, this.M.paper);
      card.position.y = (size + 0.03) / 2;
      const photo = new THREE.Mesh(new THREE.PlaneGeometry(size, size), material);
      photo.position.set(0, size / 2 + 0.022, 0.002);
      g.add(card, photo);
      g.rotation.x = -0.18;
      const holder = new THREE.Group();
      holder.add(g);
      holder.position.set(t.x + sx, t.shelves[level] + 0.002, t.z - 0.06);
      pickable(holder, { kind: 'product', handle: p.handle, colour, station: 'counter' });
      this.root.add(holder);
      // Price tent.
      if (level === 0) {
        const label = /cap/i.test(p.title) ? 'Cap' : p.title;
        const tent = this.priceTent(label, formatShort(p.price));
        tent.position.set(t.x + sx, t.shelves[0] + 0.002, t.z + 0.12);
        pickable(tent, { kind: 'product', handle: p.handle, colour, station: 'counter' });
        this.root.add(tent);
        this.hotspot('counter', new THREE.Vector3(t.x + sx, t.shelves[0] + 0.12, t.z + 0.1), p.title, `$${formatShort(p.price)} · at the till`, { type: 'product', handle: p.handle, colour }, { flip: sx > 0, target: holder });
      }
      this.appear(holder);
    }));
  }

  priceTent(name, price) {
    const tex = canvasTexture(256, 128, (ctx, w, h) => {
      ctx.fillStyle = CARD.paper; ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = CARD.ink; ctx.textAlign = 'center';
      ctx.font = 'italic 34px "Bodoni Moda", serif';
      ctx.fillText(name, w / 2, 56);
      ctx.font = '26px "Azeret Mono", monospace';
      ctx.fillText(price, w / 2, 98);
    });
    const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9 });
    const g = new THREE.Group();
    for (const s of [-1, 1]) {
      const face = new THREE.Mesh(new THREE.PlaneGeometry(0.1, 0.05), s > 0 ? mat : this.M.paper);
      face.position.set(0, 0.024, s * 0.008);
      face.rotation.x = s * -0.32;
      if (s < 0) face.rotation.y = Math.PI;
      g.add(face);
    }
    return g;
  }

  // --- The collection plaque ----------------------------------------------------
  // Every piece and price, carved into a honed travertine slab on the black stone wall.

  plaque() {
    const face = this.A.plaque;
    const P = L.PLAQUE;
    const W = 2048, H = Math.round(W * (P.h / P.w));
    const rows = [];
    const sections = this.catalog.menu();
    const tex = canvasTexture(W, H, (ctx) => {
      drawTravertine(ctx, null, 0, 0, W, H, seeded(33), { palette: TRAVERTINE.classic, s: 1.1, pits: 0.8 });
      ctx.fillStyle = 'rgba(250,245,236,0.55)'; ctx.fillRect(0, 0, W, H);

      // Carved text: a dark cut with a lit lower lip.
      const carve = (text, x, y) => {
        const fill = ctx.fillStyle;
        ctx.fillStyle = 'rgba(255,251,244,0.75)';
        ctx.fillText(text, x + 1.5, y + 2);
        ctx.fillStyle = fill;
        ctx.fillText(text, x, y);
      };
      const ink = '#2a1d15', muted = '#5f4c3d', accent = '#8c2027';
      const pad = 96;
      ctx.fillStyle = muted;
      ctx.font = '500 26px "Azeret Mono", monospace';
      ctx.letterSpacing = '9px';
      ctx.textAlign = 'left';
      carve('THE COLLECTION', pad, 92);
      ctx.textAlign = 'right';
      carve('CHAPTER MMXXVI · CAD', W - pad, 92);
      ctx.letterSpacing = '0px';
      ctx.textAlign = 'left';
      ctx.fillStyle = ink;
      ctx.font = 'italic 400 88px "Bodoni Moda", serif';
      carve(`Now showing — ${this.catalog.featured.name || 'the new chapter'}`, pad, 190);
      ctx.fillStyle = 'rgba(61,46,34,0.35)';
      ctx.fillRect(pad, 222, W - pad * 2, 2);

      const colW = (W - pad * 3) / 2;
      const cols = [sections.filter(sec => sec.zone !== 'movement'), sections.filter(sec => sec.zone === 'movement')];
      cols.forEach((secs, ci) => {
        const x0 = pad + ci * (colW + pad);
        let y = 290;
        for (const sec of secs) {
          ctx.fillStyle = sec.zone === 'window' ? accent : muted;
          ctx.font = '500 25px "Azeret Mono", monospace';
          ctx.letterSpacing = '7px';
          carve(sec.name.toUpperCase(), x0, y);
          ctx.letterSpacing = '0px';
          y += 22;
          const compact = sec.products.length > 4;
          for (const prod of sec.products) {
            const rowH = compact ? 62 : 82;
            const baseY = y + 48;
            ctx.fillStyle = prod.available ? ink : 'rgba(61,46,34,0.45)';
            ctx.font = `500 ${compact ? 40 : 42}px "Bodoni Moda", serif`;
            const name = sec.zone === 'window' || sec.zone === 'lounge' ? prod.title.replace(/^(Still Becoming|Worn)\s*/, '') : prod.title;
            carve(name, x0, baseY);
            const nameW = ctx.measureText(name).width;
            ctx.font = `${compact ? 32 : 36}px "Azeret Mono", monospace`;
            ctx.textAlign = 'right';
            const price = prod.available ? formatShort(prod.price) : 'sold out';
            carve(price, x0 + colW, baseY);
            const priceW = ctx.measureText(price).width;
            ctx.textAlign = 'left';
            ctx.fillStyle = 'rgba(61,46,34,0.35)';
            let dotX = x0 + nameW + 20;
            const dotsEnd = x0 + colW - priceW - 20;
            if (compact && prod.colours.length) dotX += prod.colours.length * 24 + 10;
            for (; dotX < dotsEnd; dotX += 14) ctx.fillRect(dotX, baseY - 6, 3, 3);
            if (compact) {
              prod.colours.slice(0, 4).forEach((c, k) => {
                ctx.fillStyle = c.hex || '#999';
                ctx.beginPath(); ctx.arc(x0 + nameW + 26 + k * 24, baseY - 13, 8, 0, Math.PI * 2); ctx.fill();
                ctx.strokeStyle = 'rgba(61,46,34,0.35)'; ctx.lineWidth = 1.5; ctx.stroke();
              });
            } else if (prod.colours.length) {
              ctx.fillStyle = muted;
              ctx.font = '23px "Hanken Grotesk", sans-serif';
              carve(prod.colours.map(c => c.name).join(' · '), x0, baseY + 29);
            }
            rows.push({ handle: prod.handle, x: x0 - 10, y, w: colW + 20, h: rowH });
            y += rowH;
          }
          y += 26;
        }
      });

      ctx.fillStyle = muted;
      ctx.font = 'italic 32px "Bodoni Moda", serif';
      ctx.textAlign = 'left';
      carve('Past chapters are on the shelf — see the archive.', pad, H - 44);
      ctx.textAlign = 'right';
      ctx.font = '24px "Azeret Mono", monospace';
      ctx.letterSpacing = '4px';
      carve('TAP A LINE TO SEE IT', W - pad, H - 48);
      ctx.letterSpacing = '0px';
    });
    face.material = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.16 });
    face.userData.pick = { kind: 'menuBoard', station: 'counter' };
    this.menuRows = rows.map(r => ({ ...r, W, H }));
    this.hotspot('counter', new THREE.Vector3(P.x - P.w / 2 + 0.12, P.y - P.h / 2 + 0.1, face.position.z + 0.04), 'The collection', 'Every piece, every price', { type: 'menu' });
  }

  /** Which product row on the board a UV coordinate falls on. */
  menuRowAt(uv) {
    if (!uv || !this.menuRows.length) return null;
    const { W, H } = this.menuRows[0];
    const px = uv.x * W, py = (1 - uv.y) * H;
    return this.menuRows.find(r => px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h)?.handle || null;
  }

  // --- The Archive: past chapters as books ------------------------------------

  archive() {
    const shelves = this.A.archiveShelves;
    const chapters = this.catalog.archiveChapters();
    const M = this.M;
    const rng = mulberry(11);

    // Sixty-odd books make this the busiest corner of the room, so they're cheap to draw:
    // every plain book is folded into one mesh, coloured per vertex, and each chapter's book
    // is two parts — a body sharing that one material, and its own printed spine.
    // (As six-sided boxes with a material per side they cost ~400 draw calls, from the street too.)
    const bodyMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 });
    const PAGES = new THREE.Color(0xefe6d4);
    const plain = [];
    // BoxGeometry builds its faces in the order +x, -x, +y, -y, +z, -z, four vertices each.
    // Standing books show page edges top and bottom; books lying flat show them on three sides.
    const bookGeometry = (w, h, d, cover, { flat = false } = {}) => {
      const g = new THREE.BoxGeometry(w, h, d);
      const col = new THREE.Color(cover), rgb = new Float32Array(g.attributes.position.count * 3);
      for (let i = 0; i < g.attributes.position.count; i++) {
        const face = Math.floor(i / 4);
        const pages = flat ? face === 0 || face === 1 || face === 5 : face === 2 || face === 3;
        (pages ? PAGES : col).toArray(rgb, i * 3);
      }
      g.setAttribute('color', new THREE.BufferAttribute(rgb, 3));
      return g;
    };

    const placeRow = (shelf, items, startX) => {
      let x = startX;
      for (const it of items) {
        const w = it.w, h = it.h, d = 0.22;
        const g = bookGeometry(w, h, d, it.colour);
        if (it.face) {
          // Move the spine (+z) to the end of the index so the body is one draw and the spine another.
          const idx = Array.from(g.index.array);
          g.setIndex([...idx.slice(0, 24), ...idx.slice(30, 36), ...idx.slice(24, 30)]);
          g.clearGroups(); g.addGroup(0, 30, 0); g.addGroup(30, 6, 1);
          const b = new THREE.Mesh(g, [bodyMat, it.face]);
          b.position.set(x + w / 2, shelf.y + h / 2, shelf.z + 0.03);
          b.castShadow = b.receiveShadow = true;
          if (it.pick) pickable(b, it.pick);
          this.root.add(b);
        } else {
          g.translate(x + w / 2, shelf.y + h / 2, shelf.z + 0.03);
          plain.push(g);
        }
        x += w + 0.004;
      }
      return x;
    };

    const spineFor = (p, chapter) => {
      const colour = p.colours[0]?.hex || '#6e5a4a';
      const lum = luminance(colour);
      const ink = lum > 0.6 ? '#2a1d16' : '#d9c28e';
      const tex = canvasTexture(96, 420, (ctx, w, h) => {
        ctx.fillStyle = colour; ctx.fillRect(0, 0, w, h);
        for (let i = 0; i < 900; i++) {
          ctx.fillStyle = `rgba(${rng() < 0.5 ? '255,255,255' : '0,0,0'},${rng() * 0.06})`;
          ctx.fillRect(rng() * w, rng() * h, 1, 2 + rng() * 4);
        }
        ctx.fillStyle = ink;
        ctx.fillRect(10, 18, w - 20, 2); ctx.fillRect(10, 24, w - 20, 1);
        ctx.fillRect(10, h - 26, w - 20, 1); ctx.fillRect(10, h - 20, w - 20, 2);
        ctx.save();
        ctx.translate(w / 2 + 11, h / 2);
        ctx.rotate(-Math.PI / 2);
        ctx.textAlign = 'center';
        ctx.font = '500 30px "Bodoni Moda", serif';
        ctx.letterSpacing = '3px';
        const label = p.title.replace(/^The First Chapter\s*/i, '').replace(/\s*-\s*/, ' · ').toUpperCase();
        ctx.fillText(label.length > 22 ? label.slice(0, 21) + '…' : label, 0, 0);
        ctx.restore();
        ctx.textAlign = 'center';
        ctx.font = '18px "Azeret Mono", monospace';
        ctx.fillText(String(chapter.year || ''), w / 2, h - 36);
        if (p.available) {
          ctx.fillStyle = '#8c2027';
          ctx.fillRect(w / 2 - 12, 34, 24, 40);
          ctx.beginPath(); ctx.moveTo(w / 2 - 12, 74); ctx.lineTo(w / 2, 64); ctx.lineTo(w / 2 + 12, 74); ctx.fillStyle = colour; ctx.fill();
        }
      });
      return { colour, face: new THREE.MeshStandardMaterial({ map: tex, roughness: 0.75 }) };
    };

    const fillers = (n, palette) => Array.from({ length: n }, () => {
      const colour = palette[(rng() * palette.length) | 0];
      return { w: 0.03 + rng() * 0.03, h: 0.24 + rng() * 0.08, colour };
    });

    const plaque = (text, sub) => canvasTexture(320, 110, (ctx, w, h) => {
      const g = ctx.createLinearGradient(0, 0, w, h);
      g.addColorStop(0, '#c9a56a'); g.addColorStop(0.5, '#e3c690'); g.addColorStop(1, '#b08d57');
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = 'rgba(60,40,20,0.5)'; ctx.lineWidth = 3; ctx.strokeRect(8, 8, w - 16, h - 16);
      ctx.fillStyle = '#3a2a1a'; ctx.textAlign = 'center';
      ctx.font = 'italic 34px "Bodoni Moda", serif';
      ctx.fillText(text, w / 2, 56);
      ctx.font = '18px "Azeret Mono", monospace';
      ctx.fillText(sub, w / 2, 86);
    });
    const standPlaque = (tex, x, shelf, pick) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.075), new THREE.MeshStandardMaterial({ map: tex, metalness: 0.6, roughness: 0.35 }));
      m.position.set(x, shelf.y + 0.045, shelf.z + 0.17);
      m.rotation.x = -0.3;
      if (pick) pickable(m, pick);
      this.root.add(m);
      return m;
    };

    // Eye level: the chapters, in order.
    const eye = shelves[3], below = shelves[2];
    const first = chapters[0], second = chapters[1];
    if (first) {
      const items = first.products.map(p => ({ w: 0.05 + rng() * 0.012, h: 0.3 + rng() * 0.03, ...spineFor(p, first), pick: { kind: 'archive', handle: p.handle, station: 'archive' } }));
      const endX = placeRow(eye, items, eye.x0 + 0.12);
      standPlaque(plaque(first.name, String(first.year || '')), eye.x0 + 0.12 + (endX - eye.x0 - 0.12) / 2, eye, { kind: 'archive', chapter: first.name, station: 'archive' });
      this.hotspot('archive', new THREE.Vector3((eye.x0 + endX) / 2 + 0.06, eye.y + 0.2, eye.z + 0.16), first.name, `${first.year} · ${first.products.length} pieces`, { type: 'archive', chapter: first.name });
      const afterFill = placeRow(eye, fillers(5, [0xd8cdbb, 0x3a2c24, 0xbfae95]), endX + 0.12);
      const nextStart = second ? eye.x1 - Math.ceil(second.products.length / 2) * 0.058 - 0.1 : eye.x1;
      this.shelfVase(eye, (afterFill + nextStart) / 2, M.ceramic, 0.9, 4, this.shelfRoom(3));
    }
    if (second) {
      const half = Math.ceil(second.products.length / 2);
      const mk = arr => arr.map(p => ({ w: 0.045 + rng() * 0.012, h: 0.28 + rng() * 0.04, ...spineFor(p, second), pick: { kind: 'archive', handle: p.handle, station: 'archive' } }));
      const startEye = eye.x1 - half * 0.058 - 0.1;
      placeRow(eye, mk(second.products.slice(0, half)), startEye);
      const endBelow = placeRow(below, mk(second.products.slice(half)), below.x0 + 0.1);
      standPlaque(plaque(second.name, String(second.year || '')), (endBelow + below.x0 + 0.1) / 2, below, { kind: 'archive', chapter: second.name, station: 'archive' });
      this.hotspot('archive', new THREE.Vector3(startEye + half * 0.03, eye.y + 0.18, eye.z + 0.16), second.name, `${second.year} · ${second.products.length} pieces`, { type: 'archive', chapter: second.name }, { flip: true });
      // A couple of stacked books lying flat, and a vase.
      const stack = fillers(4, [0xe9e1d3, 0x6e4330, 0x2a1d16]);
      let top = below.y;
      stack.forEach((it, k) => {
        const t = it.w * 0.8, bw = 0.22 - k * 0.012;     // a little smaller as the pile rises
        const g = bookGeometry(bw, t, 0.25 - k * 0.01, it.colour, { flat: true });
        g.rotateY((rng() - 0.5) * 0.25);
        g.translate(below.x1 - 0.3, top + t / 2, below.z + 0.01);
        plain.push(g);
        top += t;
      });
    }

    // Top shelf: the chapter being written — an open book and a pen.
    const topShelf = shelves[4];
    const open = new THREE.Group();
    const pageTex = canvasTexture(512, 320, (ctx, w, h) => {
      ctx.fillStyle = '#f5eee0'; ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = 'rgba(0,0,0,0.1)'; ctx.fillRect(w / 2 - 2, 0, 4, h);
      ctx.fillStyle = '#2a1d16'; ctx.textAlign = 'center';
      ctx.font = 'italic 34px "Bodoni Moda", serif';
      ctx.fillText('Still Becoming', w * 0.25, 90);
      ctx.font = '16px "Azeret Mono", monospace';
      ctx.fillText('CHAPTER · 2026', w * 0.25, 124);
      ctx.font = '28px "Caveat", cursive';
      ctx.fillStyle = '#4a3326';
      ['Life unfolds in', 'increments.', 'You define', 'your story —'].forEach((line, i) => ctx.fillText(line, w * 0.75, 80 + i * 44));
    });
    const pagesMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.25), new THREE.MeshStandardMaterial({ map: pageTex, roughness: 0.9 }));
    pagesMesh.rotation.x = -Math.PI / 2;
    pagesMesh.position.y = 0.022;
    const cover = box(0.42, 0.02, 0.27, new THREE.MeshStandardMaterial({ color: 0x8c2027, roughness: 0.8 }));
    cover.position.y = 0.01;
    open.add(cover, pagesMesh);
    const pen = cyl(0.005, 0.005, 0.15, this.M.brass, { segments: 8 });
    pen.rotation.z = Math.PI / 2; pen.rotation.y = 0.5;
    pen.position.set(0.12, 0.03, 0.08);
    open.add(pen);
    open.position.set((topShelf.x0 + topShelf.x1) / 2 - 0.3, topShelf.y, topShelf.z + 0.04);
    open.rotation.y = 0.08;
    pickable(open, { kind: 'station', id: 'window' });
    this.root.add(open);
    this.hotspot('archive', new THREE.Vector3(open.position.x, topShelf.y + 0.1, topShelf.z + 0.16), 'Still Becoming', 'The chapter being written', { type: 'station', id: 'window' });
    placeRow(topShelf, fillers(7, [0xd9d3c8, 0x8c2027, 0x6e4330, 0x1d2335]), topShelf.x1 - 0.6);
    this.shelfVase(topShelf, topShelf.x0 + 0.3, M.noce, 0.8, 5, this.shelfRoom(4));
    placeRow(topShelf, fillers(4, [0xe9e1d3, 0x6e4330]), topShelf.x0 + 0.55);
    this.archiveShelf = below;

    // Low shelves: linen boxes and fillers.
    shelves.slice(0, 2).forEach((shelf, i) => {
      const books = fillers(12, [0xd8cdbb, 0xc9b89c, 0x3a2c24, 0x6e4330, 0xe9e1d3]);
      const run = books.reduce((sum, it) => sum + it.w + 0.004, 0);
      placeRow(shelf, books, i === 0 ? shelf.x0 + 0.08 : shelf.x1 - 0.08 - run);
      for (let k = 0; k < 2; k++) {
        const bx = box(0.42, 0.28, 0.3, new THREE.MeshStandardMaterial({ color: 0xe6dccb, roughness: 1 }));
        bx.position.set(i === 0 ? shelf.x1 - 0.3 - k * 0.48 : shelf.x0 + 0.3 + k * 0.48, shelf.y + 0.14, shelf.z);
        this.root.add(bx);
      }
    });

    if (plain.length) {
      const books = new THREE.Mesh(mergeGeometries(plain), bodyMat);
      books.name = 'archive-books';
      books.castShadow = books.receiveShadow = true;
      this.root.add(books);
      plain.forEach(g => g.dispose());
    }
  }

  /** Clear height above archive shelf `i`, up to the underside of the board (or the top) above it. */
  shelfRoom(i) {
    const shelves = this.A.archiveShelves, next = shelves[i + 1];
    const ceiling = next ? next.y - 0.05 : L.ARCHIVE_SHELF.h - 0.055;
    return ceiling - shelves[i].y;
  }

  shelfVase(shelf, x, mat, scale, stems, room = 0.44) {
    const g = new THREE.Group();
    const pts = [[0, 0], [0.05, 0], [0.075, 0.06], [0.07, 0.16], [0.035, 0.22], [0.03, 0.26], [0.036, 0.27], [0, 0.26]];
    const v = new THREE.Mesh(new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r * scale, y * scale)), 28), mat);
    v.castShadow = true;
    g.add(v);
    const twig = new THREE.MeshStandardMaterial({ color: 0x8a6a4a, roughness: 1 });
    for (let i = 0; i < stems; i++) {
      const a = (i / stems) * Math.PI * 2, lean = 0.08 + (i % 3) * 0.04;
      const tip = new THREE.Vector3(Math.cos(a) * lean, Math.min(0.2 * scale + 0.3 + (i % 2) * 0.08, room - 0.04), Math.sin(a) * lean * 0.4);
      const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0.2 * scale, 0), tip.clone().multiplyScalar(0.5).setY(0.2 * scale + (tip.y - 0.2 * scale) * 0.55), tip]);
      g.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 6, 0.0035, 4), twig));
    }
    g.position.set(x, shelf.y, shelf.z + 0.02);
    this.root.add(g);
  }

  // --- Notice board -----------------------------------------------------------------

  noticeBoard() {
    const b = this.A.board;
    this.boardAnchor = b;
    // Positions are (u, v) in metres from the board's centre, as you face it: +u is to your right.
    const put = (mesh, u, v, rot = 0, z = 0) => {
      // Board faces -z (you look at it facing the street door): viewer's right is -x.
      mesh.position.set(b.x - u, b.y + v, b.z - 0.004 - z);
      mesh.rotation.set(0, Math.PI, rot);
      this.root.add(mesh);
      return mesh;
    };
    const pin = (u, v, color = 0x8c2027) => {
      const p = new THREE.Mesh(new THREE.SphereGeometry(0.012, 10, 8), new THREE.MeshStandardMaterial({ color, roughness: 0.3 }));
      p.position.set(b.x - u, b.y + v, b.z - 0.02);
      p.castShadow = true;
      this.root.add(p);
    };
    const note = (w, h, draw) => {
      const tex = canvasTexture(Math.round(w * 1400), Math.round(h * 1400), draw);
      return new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.92, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.12 }));
    };
    this.boardNote = { put, pin, note };

    // --- Left: the brand's own corner — mission, team notes, photos -------------------
    const mission = note(0.54, 0.37, (ctx, w, h) => {
      paperFill(ctx, w, h, '#fbf8f1');
      ctx.fillStyle = CARD.ink; ctx.textAlign = 'left';
      ctx.font = '500 38px "Bodoni Moda", serif'; ctx.letterSpacing = '12px';
      ctx.fillText('INCREMENTS', 56, 96);
      ctx.letterSpacing = '0px';
      ctx.font = '27px "Azeret Mono", monospace';
      wrap(ctx, 'Small steps, big accomplishments. We believe success is built through small, intentional actions — one step at a time.', 56, 170, w - 112, 42, 'left');
    });
    put(mission, -1.1, 0.46, 0.025);
    pin(-1.1, 0.62, 0xb48f55);

    const quotes = [[-0.46, 0.5, -0.04], [-0.86, -0.22, 0.05], [-0.62, -0.62, 0.035]];
    quotes.forEach(([u, v, rot], i) => {
      const q = note(0.46, 0.31, (ctx, w, h) => {
        paperFill(ctx, w, h, i === 1 ? '#f1e6cf' : '#fbf6ea');
        ctx.fillStyle = '#3a2a20';
        ctx.font = '500 56px "Caveat", cursive';
        ctx.textAlign = 'left';
        wrap(ctx, TEAM_QUOTES[i], 50, 100, w - 100, 58, 'left');
        ctx.font = '500 40px "Caveat", cursive';
        ctx.fillStyle = CARD.muted;
        ctx.fillText('— Increments Team', 44, h - 36);
      });
      put(q, u, v, rot);
      pin(u, v + 0.14, [0x8c2027, 0x2a1d16, 0xb48f55][i]);
    });
    this.polaroidSlots = [[-1.32, -0.34, -0.06], [-0.32, -0.12, 0.07]];

    // --- Middle: the invitation -----------------------------------------------------------
    const prompt = note(0.56, 0.43, (ctx, w, h) => {
      paperFill(ctx, w, h);
      ctx.fillStyle = CARD.scarlet; ctx.fillRect(0, 0, w, 110);
      ctx.fillStyle = CARD.paper; ctx.textAlign = 'center';
      ctx.font = '500 32px "Azeret Mono", monospace'; ctx.letterSpacing = '8px';
      ctx.fillText('YOUR NEXT INCREMENT', w / 2, 68);
      ctx.letterSpacing = '0px';
      ctx.fillStyle = CARD.ink;
      ctx.font = 'italic 58px "Bodoni Moda", serif';
      wrap(ctx, 'What’s the next small step you’re taking?', w / 2, 220, w - 110, 70);
      ctx.font = '32px "Hanken Grotesk", sans-serif';
      ctx.fillStyle = CARD.muted;
      ctx.fillText('Pin it here — tap to write yours →', w / 2, h - 50);
    });
    put(prompt, 0.14, 0.38, -0.03);
    pin(0.14, 0.58);
    pickable(prompt, { kind: 'compose', station: 'board' });
    this.hotspot('board', new THREE.Vector3(b.x - 0.14, b.y + 0.32, b.z - 0.05), 'Pin your next increment', 'Make a card to keep or share', { type: 'compose' }, { flip: true, target: prompt });

    // --- Right: notes from visitors -------------------------------------------------------
    const header = note(0.9, 0.085, (ctx, w, h) => {
      ctx.fillStyle = '#f4ecde'; ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = CARD.ink; ctx.textAlign = 'center';
      ctx.font = '500 44px "Azeret Mono", monospace'; ctx.letterSpacing = '14px';
      ctx.fillText('NOTES FROM THE LOUNGE', w / 2 + 7, h / 2 + 15);
    });
    put(header, 1.0, 0.71, 0.004);
    pin(0.6, 0.71, 0x2a1d16); pin(1.4, 0.71, 0x2a1d16);
    pickable(header, { kind: 'board', station: 'board' });
    this.boardHotspot = { type: 'board' };
    this.hotspot('board', new THREE.Vector3(b.x - 1.0, b.y + 0.66, b.z - 0.05), 'Read the board', 'Notes from visitors', this.boardHotspot, { target: header });
    this.boardHotspotItem = this.hotspots[this.hotspots.length - 1];

    this.noteSlots = [
      [0.76, 0.42, -0.04], [1.24, 0.4, 0.03], [0.74, 0.06, 0.05], [1.22, 0.04, -0.03], [0.18, -0.08, 0.04],
      [0.76, -0.3, -0.02], [1.25, -0.32, 0.045], [0.2, -0.44, -0.05], [0.74, -0.64, 0.03], [1.24, -0.66, -0.035],
    ];
    this.ownNotes = [];
    this.communityNotes = [];
    this.renderNotes();
  }

  /** The visitor pinned a note (or we're restoring the ones they pinned before). */
  pinIncrement(text) {
    this.ownNotes.push(text);
    this.ownNotes = this.ownNotes.slice(-3);
    this.renderNotes({ fresh: true });
  }

  /** Approved notes from the shared board. */
  setCommunity(notes, { shared = true } = {}) {
    this.communityNotes = notes;
    const n = notes.length;
    this.boardHotspotItem.sub = !shared ? 'Notes from the team — add yours'
      : n ? `${n} note${n === 1 ? '' : 's'} from visitors` : 'Be the first to pin one';
    this.renderNotes();
  }

  renderNotes({ fresh = false } = {}) {
    if (!this.noteSlots) return;
    for (const m of [...this.pinned.children]) {
      this.pinned.remove(m);
      m.traverse(o => { o.geometry?.dispose(); if (o.material) { o.material.map?.dispose(); o.material.dispose(); } });
    }
    const own = [...this.ownNotes].reverse().map(text => ({ text, own: true }));
    // The team's starter notes fill whatever visitors haven't, leaving room for two blanks.
    const starters = (CONFIG.board?.starterNotes || []).map(text => ({ text, name: CONFIG.board.starterSignature || 'the Increments team', starter: true }));
    const room = Math.max(0, this.noteSlots.length - 2 - own.length - this.communityNotes.length);
    const cards = [...own, ...this.communityNotes, ...starters.slice(0, room)].slice(0, this.noteSlots.length);
    // Blank cards invite the next note.
    const blanks = Math.min(2, this.noteSlots.length - cards.length);
    cards.forEach((c, i) => this.#noteCard(c, i, fresh && i === 0));
    for (let i = 0; i < blanks; i++) this.#noteCard(null, cards.length + i, false);
  }

  #noteCard(card, index, fresh) {
    const b = this.boardAnchor;
    const [u, v, rot] = this.noteSlots[index];
    const papers = ['#fff9ec', '#fbf3e3', '#f3ead8', '#fdf7ef'];
    const tex = canvasTexture(440, 300, (ctx, w, h) => {
      paperFill(ctx, w, h, card ? papers[index % papers.length] : '#fbf8f2');
      ctx.textAlign = 'left';
      if (!card) {
        ctx.strokeStyle = 'rgba(122,102,86,0.22)'; ctx.lineWidth = 2;
        for (let y = 120; y < h - 40; y += 52) { ctx.beginPath(); ctx.moveTo(32, y); ctx.lineTo(w - 32, y); ctx.stroke(); }
        ctx.fillStyle = 'rgba(122,102,86,0.55)'; ctx.font = '500 40px "Caveat", cursive';
        ctx.fillText('your next step?', 36, 104);
        return;
      }
      ctx.fillStyle = card.own ? CARD.scarlet : CARD.muted;
      ctx.font = '500 17px "Azeret Mono", monospace'; ctx.letterSpacing = '4px';
      ctx.fillText(card.own ? 'MY NEXT INCREMENT' : 'NEXT INCREMENT', 30, 42);
      ctx.letterSpacing = '0px';
      ctx.fillStyle = '#2a1d16';
      const size = card.text.length > 56 ? 34 : card.text.length > 34 ? 38 : 44;
      ctx.font = `500 ${size}px "Caveat", cursive`;
      wrap(ctx, card.text, 30, 92, w - 60, size * 1.02, 'left');
      const sig = card.own ? '— you' : `— ${[card.name, card.city].filter(Boolean).join(', ') || 'a visitor'}`;
      ctx.fillStyle = CARD.muted; ctx.font = '500 30px "Caveat", cursive';
      ctx.fillText(sig, 30, h - 26);
    });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(0.36, 0.245), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.14 }));
    m.position.set(b.x - u, b.y + v, b.z - 0.008 - index * 0.0006);
    m.rotation.set(0, Math.PI, rot);
    pickable(m, card ? { kind: 'board', station: 'board' } : { kind: 'compose', station: 'board' });
    const pinM = new THREE.Mesh(new THREE.SphereGeometry(0.011, 10, 8), new THREE.MeshStandardMaterial({ color: card?.own ? 0x8c2027 : [0x2a1d16, 0xb48f55, 0xefe6d8][index % 3], roughness: 0.3 }));
    pinM.position.set(0, 0.1, 0.012); // local +z faces the room (the card is turned to face you)
    m.add(pinM);
    this.pinned.add(m);
    if (fresh) this.appear(m);
  }

  async polaroids() {
    const b = this.boardAnchor;
    const images = this.catalog.lifestyle.slice(0, this.polaroidSlots.length);
    const captions = ['Still becoming.', 'Worn in, not worn out.'];
    await Promise.all(images.map(async (li, i) => {
      const img = await loadImage(shopifyImage(li.src, 500)).catch(() => null);
      if (!img) return;
      const [u, v, rot] = this.polaroidSlots[i];
      const tex = canvasTexture(440, 530, (ctx, w, h) => {
        ctx.fillStyle = '#fbfaf6'; ctx.fillRect(0, 0, w, h);
        const s = Math.max(400 / img.naturalWidth, 400 / img.naturalHeight);
        ctx.save(); ctx.beginPath(); ctx.rect(20, 20, 400, 400); ctx.clip();
        ctx.drawImage(img, 20 + (400 - img.naturalWidth * s) / 2, 20 + (400 - img.naturalHeight * s) / 2, img.naturalWidth * s, img.naturalHeight * s);
        ctx.restore();
        ctx.fillStyle = '#3a2a20'; ctx.font = '500 40px "Caveat", cursive'; ctx.textAlign = 'center';
        ctx.fillText(captions[i] || '', w / 2, 486);
      });
      const m = new THREE.Mesh(new THREE.PlaneGeometry(0.29, 0.35), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.12 }));
      m.position.set(b.x - u, b.y + v, b.z - 0.006);
      m.rotation.set(0, Math.PI, rot);
      this.root.add(m);
      const pin = new THREE.Mesh(new THREE.SphereGeometry(0.012, 10, 8), new THREE.MeshStandardMaterial({ color: 0xefe6d8, roughness: 0.3 }));
      pin.position.set(b.x - u, b.y + v + 0.15, b.z - 0.02);
      this.root.add(pin);
      this.appear(m);
    }));
  }

  // --- Supporting prints ----------------------------------------------------------------

  framedPrint(image, width, { mat = this.M.wood, mount = true } = {}) {
    const { material, aspect } = this.photoMaterial(image, { width: 640 });
    const w = width, h = width / aspect;
    const g = new THREE.Group();
    const f = 0.035, m = mount ? 0.06 : 0;
    const fh = h + f * 2 + m, cy = fh / 2;           // the frame's foot sits at y = 0
    const frame = box(w + f * 2 + m, fh, 0.03, mat);
    frame.position.set(0, cy, 0);
    g.add(frame);
    if (mount) {
      const mnt = new THREE.Mesh(new THREE.PlaneGeometry(w + 0.06, h + 0.06), this.M.paper);
      mnt.position.set(0, cy, 0.016);
      g.add(mnt);
    }
    const photo = new THREE.Mesh(new THREE.PlaneGeometry(w, h), material);
    photo.position.set(0, cy, 0.018);
    g.add(photo);
    g.traverse(o => { if (o.isMesh) o.castShadow = true; });
    return g;
  }

  /** The street vitrine: the campaign, lit, for passers-by. */
  async vitrine() {
    const V = this.A.vitrine;
    const src = this.catalog.featured.campaignImage || this.catalog.lifestyle[0]?.src;
    if (!V || !src) return;
    const img = await loadImage(shopifyImage(src, 1000)).catch(() => null);
    if (!img) return;
    const aspect = img.naturalWidth / img.naturalHeight;
    const width = Math.min(V.w, (V.h - 0.1) * aspect);
    const print = this.framedPrint(img, width, { mat: this.M.oak });
    print.rotation.x = -0.06;
    print.position.set(V.x, V.y, V.z + 0.06);
    this.root.add(print);
  }

  async campaignPrint() {
    // The Still Becoming campaign (the red leather seats) — framed, leaning on the window wall.
    const src = this.catalog.featured.campaignImage || this.catalog.lifestyle[0]?.src;
    if (!src) return;
    const img = await loadImage(shopifyImage(src, 900)).catch(() => null);
    if (!img) return;
    const print = this.framedPrint(img, 0.8);
    print.rotation.x = -0.1;
    const g = new THREE.Group();
    g.add(print);
    g.position.set(L.ROOM.x0 + 0.12, 0, L.CAMPAIGN_PRINT.z);
    g.rotation.y = Math.PI / 2;
    pickable(g, { kind: 'station', id: 'window' });
    this.root.add(g);
    this.appear(g);
  }

  async shelfFrames() {
    const extra = this.catalog.lifestyle[4];
    if (!extra || !this.archiveShelf) return;
    const img = await loadImage(shopifyImage(extra.src, 400)).catch(() => null);
    if (!img) return;
    const f = this.framedPrint(img, 0.2, { mat: this.M.wood });
    f.position.set((this.archiveShelf.x0 + this.archiveShelf.x1) / 2 + 0.25, this.archiveShelf.y, this.archiveShelf.z - 0.04);
    f.rotation.x = -0.08;
    this.root.add(f);
    this.appear(f);
  }

  // Wayfinding hotspots from the entrance.
  stationSigns() {
    const signs = [
      ['window', [L.STEPS.x + 0.9, 2.5, L.STEPS.z], 'The Steps', 'Still Becoming'],
      ['counter', [L.COUNTER.x - 0.9, 1.45, L.COUNTER.z + 0.45], 'The Collection', 'Every piece & the till'],
      ['lounge', [L.BANQUETTE.x - 0.3, 2.3, L.BANQUETTE.z + 1.2], 'The Lounge', 'Worn'],
      ['movement', [L.MOVEMENT_RACK.x, 2.15, L.MOVEMENT_RACK.z], 'Movement', 'By the fitting rooms'],
      ['archive', [L.ARCHIVE_SHELF.x - 0.4, 2.1, L.ROOM.z0 + 0.5], 'The Archive', 'Past chapters'],
    ];
    for (const [id, pos, label, sub] of signs) {
      this.hotspot('entrance', new THREE.Vector3(...pos), label, sub, { type: 'station', id }, { flip: pos[0] > 1 });
    }
  }
}

// --- small utilities -----------------------------------------------------------------

function hexRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function luminance(hex) {
  const [r, g, b] = hexRgb(hex).map(v => v / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function mulberry(seed) {
  let a = seed;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function paperFill(ctx, w, h, base = CARD.paper) {
  ctx.fillStyle = base; ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < 260; i++) {
    ctx.fillStyle = `rgba(150,130,100,${Math.random() * 0.06})`;
    ctx.fillRect(Math.random() * w, Math.random() * h, 1 + Math.random() * 3, 1);
  }
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, 'rgba(255,255,255,0.15)'); g.addColorStop(1, 'rgba(120,100,70,0.08)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
}

function wrap(ctx, text, x, y, maxW, lineH, align = 'center') {
  ctx.textAlign = align;
  const words = text.split(/\s+/);
  let line = '', yy = y;
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxW && line) {
      ctx.fillText(line, x, yy);
      line = word; yy += lineH;
    } else line = test;
  }
  if (line) ctx.fillText(line, x, yy);
  return yy;
}

export { wrap, paperFill };
