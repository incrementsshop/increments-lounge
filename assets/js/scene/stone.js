// Procedural surfaces drawn with Canvas 2D. No image downloads: every stone, wood
// and fabric in the Lounge is generated on the visitor's device in a few hundred
// milliseconds. Pure canvas — no Three.js — so the share card and intro can use it too.
//
// Each generator returns { map, bump } canvases (bump: mid-grey = flat, darker = lower).

export function seeded(seed = 1) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

const rgb = hex => {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

/** Soft value-noise: a tiny random canvas scaled up with smoothing. */
function mottle(ctx, x, y, w, h, r, { cols, rows, color, alpha, pow = 2 }) {
  const n = makeCanvas(cols + 2, rows + 2);
  const nx = n.getContext('2d');
  const id = nx.createImageData(cols + 2, rows + 2);
  const [cr, cg, cb] = rgb(color);
  for (let i = 0; i < id.data.length; i += 4) {
    id.data[i] = cr; id.data[i + 1] = cg; id.data[i + 2] = cb;
    id.data[i + 3] = Math.pow(r(), pow) * 255 * alpha;
  }
  nx.putImageData(id, 0, 0);
  ctx.save();
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  const cw = w / cols, ch = h / rows;
  ctx.drawImage(n, x - cw, y - ch, w + 2 * cw, h + 2 * ch);
  ctx.restore();
}

function wavyLine(ctx, x0, x1, yAt, step) {
  ctx.beginPath();
  for (let x = x0; x <= x1; x += step) {
    const y = yAt(x);
    if (x === x0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.stroke();
}

// --------------------------------------------------------------------------
// Travertine
// --------------------------------------------------------------------------

export const TRAVERTINE = {
  classic: { bases: ['#ebe1d1', '#e4d6c0', '#eee5d6', '#e0d1ba', '#e8dbc8', '#e6d9c3'], vein: '178,140,96', pit: '146,116,84', light: '255,251,243' },
  warm:    { bases: ['#e2d1b6', '#dfccb0', '#e5d6bd'], vein: '160,124,86', pit: '132,100,68', light: '252,244,230' },
  noce:    { bases: ['#b89a78', '#b29270', '#bd9f7e'], vein: '104,74,48', pit: '84,58,36', light: '226,206,178' },
};

/** Draws one piece of vein-cut travertine (veins run along x) into a region. */
export function drawTravertine(ctx, hctx, x, y, w, h, r, { palette = TRAVERTINE.classic, s = 1, pits = 1 } = {}) {
  ctx.save(); hctx?.save();
  ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
  if (hctx) { hctx.beginPath(); hctx.rect(x, y, w, h); hctx.clip(); }

  ctx.fillStyle = palette.bases[(r() * palette.bases.length) | 0];
  ctx.fillRect(x, y, w, h);

  // Tonal cloudiness, stretched along the bedding.
  const [vr, vg, vb] = palette.vein.split(',').map(Number);
  const veinHex = '#' + [vr, vg, vb].map(v => v.toString(16).padStart(2, '0')).join('');
  mottle(ctx, x, y, w, h, r, { cols: 3, rows: 7, color: veinHex, alpha: 0.16 });
  mottle(ctx, x, y, w, h, r, { cols: 6, rows: 18, color: '#fffaf1', alpha: 0.22 });
  mottle(ctx, x, y, w, h, r, { cols: 12, rows: 44, color: veinHex, alpha: 0.09 });

  // Broad soft bands.
  const bands = 4 + ((r() * 6) | 0);
  for (let i = 0; i < bands; i++) {
    const y0 = y + r() * h;
    ctx.lineWidth = (8 + r() * 30) * s;
    ctx.strokeStyle = r() < 0.55 ? `rgba(${palette.vein},${0.025 + r() * 0.05})` : `rgba(${palette.light},${0.05 + r() * 0.08})`;
    const a1 = (2 + r() * 6) * s, f1 = (0.6 + r() * 1.6) * Math.PI * 2 / w, p1 = r() * 7;
    wavyLine(ctx, x - 10, x + w + 10, xx => y0 + a1 * Math.sin((xx - x) * f1 + p1), 8 * s);
  }

  // Vein bundles: groups of near-parallel lines sharing one wave — the signature of vein-cut travertine.
  const bundles = Math.round((h / s) / 60 * (0.8 + r() * 0.8));
  const beds = [];
  for (let b = 0; b < bundles; b++) {
    const yc = y + r() * h;
    const spread = (6 + r() * r() * 70) * s;
    const a1 = (0.6 + r() * 4) * s, f1 = (0.6 + r() * 2.2) * Math.PI * 2 / w, p1 = r() * 7;
    const a2 = (0.2 + r() * 1.4) * s, f2 = (4 + r() * 10) * Math.PI * 2 / w, p2 = r() * 7;
    const wave = xx => a1 * Math.sin((xx - x) * f1 + p1) + a2 * Math.sin((xx - x) * f2 + p2);
    const honey = r() < 0.7;
    beds.push({ yc, spread, wave });
    // Tonal body of the bundle.
    ctx.lineWidth = spread * (0.8 + r() * 0.6);
    ctx.strokeStyle = honey ? `rgba(${palette.vein},${0.05 + r() * 0.09})` : `rgba(${palette.light},${0.08 + r() * 0.12})`;
    wavyLine(ctx, x - 6, x + w + 6, xx => yc + wave(xx), 6 * s);
    const n = 3 + ((r() * 14) | 0);
    for (let i = 0; i < n; i++) {
      const dy = (r() - 0.5) * spread;
      const heavy = r() < 0.15;
      ctx.lineWidth = (heavy ? 1.4 + r() * 2.6 : 0.35 + r() * 1.0) * s;
      ctx.strokeStyle = r() < (honey ? 0.75 : 0.35)
        ? `rgba(${palette.vein},${(heavy ? 0.16 : 0.1) + r() * 0.26})`
        : `rgba(${palette.light},${0.18 + r() * 0.35})`;
      const xs = x + (r() < 0.5 ? -4 : r() * w * 0.6);
      const xe = Math.min(x + w + 4, xs + w * (0.3 + r() * 1.1));
      const jitter = (0.2 + r() * 0.8) * s, jf = (10 + r() * 20) * Math.PI * 2 / w, jp = r() * 7;
      wavyLine(ctx, xs, xe, xx => yc + dy + wave(xx) + jitter * Math.sin((xx - x) * jf + jp), 3 * s);
    }
  }

  // Loose strata between the bundles.
  const lines = Math.round((h / s) * 0.18 * (0.7 + r() * 0.6));
  for (let i = 0; i < lines; i++) {
    const y0 = y + r() * h;
    const dark = r() < 0.55;
    ctx.lineWidth = (0.3 + r() * 0.9) * s;
    ctx.strokeStyle = dark ? `rgba(${palette.vein},${0.05 + r() * 0.16})` : `rgba(${palette.light},${0.12 + r() * 0.26})`;
    const a1 = (0.4 + r() * 2.6) * s, f1 = (0.8 + r() * 2.4) * Math.PI * 2 / w, p1 = r() * 7;
    const xs = x + (r() < 0.45 ? -4 : r() * w * 0.7);
    const xe = Math.min(x + w + 4, xs + w * (0.2 + r() * 0.9));
    wavyLine(ctx, xs, xe, xx => y0 + a1 * Math.sin((xx - x) * f1 + p1), 3 * s);
  }

  // Pits and filled voids, clustered along a few beds, elongated with the grain.
  const clusters = Math.round((w * h) / (s * s) / 6000 * pits);
  for (let c = 0; c < clusters; c++) {
    const bed = beds.length && r() < 0.7 ? beds[(r() * beds.length) | 0] : null;
    const yb = bed ? bed.yc + (r() - 0.5) * bed.spread : y + r() * h;
    const xb = x + r() * w, spread = w * (0.05 + r() * 0.45);
    const n = 1 + ((r() * r() * 16) | 0);
    for (let k = 0; k < n; k++) {
      const px = xb + (r() - 0.5) * spread;
      const py = yb + (bed ? bed.wave(px) : 0) + (r() - 0.5) * 3 * s;
      const rw = (0.8 + r() * r() * r() * 22) * s;
      const rh = Math.min(rw * 0.5, (0.45 + r() * 2.2) * s);
      ctx.fillStyle = `rgba(${palette.pit},${0.28 + r() * 0.42})`;
      ctx.beginPath(); ctx.ellipse(px, py, rw, rh, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = `rgba(${palette.light},0.4)`;
      ctx.beginPath(); ctx.ellipse(px, py + rh * 0.9, rw * 0.8, Math.max(0.3, rh * 0.3), 0, 0, Math.PI * 2); ctx.fill();
      if (hctx) {
        hctx.fillStyle = `rgba(20,20,20,${0.5 + r() * 0.4})`;
        hctx.beginPath(); hctx.ellipse(px, py, rw, rh, 0, 0, Math.PI * 2); hctx.fill();
      }
    }
  }

  // A hint of honed sheen variation.
  const g = ctx.createLinearGradient(x, y, x + w, y + h);
  g.addColorStop(0, 'rgba(255,255,255,0.05)');
  g.addColorStop(1, 'rgba(0,0,0,0.03)');
  ctx.fillStyle = g; ctx.fillRect(x, y, w, h);

  ctx.restore(); hctx?.restore();
}

/**
 * A field of travertine tiles/slabs with grout joints. Tiles run the full canvas so the
 * texture repeats seamlessly (every repeat boundary is a joint).
 */
export function travertineTiles({
  width = 2048, height = 1024, cols = 4, rows = 2, bond = 0.5, grout = 3, seed = 7,
  palette = TRAVERTINE.classic, pits = 1, bevel = true,
} = {}) {
  const r = seeded(seed);
  const map = makeCanvas(width, height), bump = makeCanvas(width, height);
  const ctx = map.getContext('2d'), hctx = bump.getContext('2d');
  hctx.fillStyle = '#808080'; hctx.fillRect(0, 0, width, height);
  const tw = width / cols, th = height / rows;
  const s = Math.max(0.5, width / 2048);

  for (let row = 0; row < rows; row++) {
    const off = (row % 2) * bond * tw;
    for (let col = -1; col < cols; col++) {
      const x = col * tw + off;
      if (x >= width || x + tw <= 0) continue;
      const tileSeed = (r() * 1e9) | 0;
      const draw = dx => drawTravertine(ctx, hctx, x + dx, row * th, tw, th, seeded(tileSeed), { palette, s, pits });
      draw(0);
      if (x < 0) draw(width);
      if (x + tw > width) draw(-width);
    }
  }

  if (grout > 0) {
    const joint = (x, y, w, h) => {
      ctx.fillStyle = 'rgba(150,126,98,0.55)'; ctx.fillRect(x, y, w, h);
      hctx.fillStyle = '#2a2a2a'; hctx.fillRect(x, y, w, h);
    };
    for (let row = 0; row < rows; row++) {
      const y = row * th;
      joint(0, y - grout / 2, width, grout);
      if (row === 0) joint(0, height - grout / 2, width, grout);
      const off = (row % 2) * bond * tw;
      for (let col = 0; col <= cols; col++) {
        let x = (col * tw + off) % width;
        joint(x - grout / 2, y, grout, th);
        if (x < grout) joint(x - grout / 2 + width, y, grout, th);
      }
    }
    if (bevel) {
      // Eased edges catch a sliver of light.
      hctx.globalAlpha = 0.35;
      for (let row = 0; row < rows; row++) {
        hctx.fillStyle = '#b8b8b8';
        hctx.fillRect(0, row * th + grout / 2, width, grout);
      }
      hctx.globalAlpha = 1;
    }
  }
  return { map, bump };
}

// --------------------------------------------------------------------------
// Everything else
// --------------------------------------------------------------------------

export function woodGrain({ width = 1024, height = 1024, seed = 3, base = '#6c4630', dark = '44,26,16', light = '138,94,62', density = 1 } = {}) {
  const r = seeded(seed);
  const map = makeCanvas(width, height), bump = makeCanvas(width, height);
  const ctx = map.getContext('2d'), hctx = bump.getContext('2d');
  ctx.fillStyle = base; ctx.fillRect(0, 0, width, height);
  hctx.fillStyle = '#808080'; hctx.fillRect(0, 0, width, height);
  mottle(ctx, 0, 0, width, height, r, { cols: 18, rows: 3, color: '#2c1a10', alpha: 0.25 });
  mottle(ctx, 0, 0, width, height, r, { cols: 40, rows: 5, color: '#a36e44', alpha: 0.12 });
  const n = Math.round(width * 0.55 * density);
  for (let i = 0; i < n; i++) {
    const x0 = r() * width;
    const isDark = r() < 0.7;
    ctx.strokeStyle = isDark ? `rgba(${dark},${0.08 + r() * 0.3})` : `rgba(${light},${0.06 + r() * 0.18})`;
    ctx.lineWidth = 0.4 + r() * (r() < 0.1 ? 3 : 1.2);
    const a = 1 + r() * 6, f = (0.5 + r() * 2) * Math.PI * 2 / height, p = r() * 7;
    ctx.beginPath();
    for (let y = -4; y <= height + 4; y += 6) {
      const x = x0 + a * Math.sin(y * f + p) + (y / height) * (r() - 0.5) * 0.6;
      if (y < 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
    if (isDark && r() < 0.3) {
      hctx.strokeStyle = 'rgba(40,40,40,0.35)'; hctx.lineWidth = ctx.lineWidth;
      hctx.beginPath();
      for (let y = -4; y <= height + 4; y += 6) {
        const x = x0 + a * Math.sin(y * f + p);
        if (y < 0) hctx.moveTo(x, y); else hctx.lineTo(x, y);
      }
      hctx.stroke();
    }
  }
  return { map, bump };
}

export function leather({ width = 1024, height = 1024, seed = 11, base = '#6a1c21' } = {}) {
  const r = seeded(seed);
  const map = makeCanvas(width, height), bump = makeCanvas(width, height);
  const ctx = map.getContext('2d'), hctx = bump.getContext('2d');
  ctx.fillStyle = base; ctx.fillRect(0, 0, width, height);
  hctx.fillStyle = '#808080'; hctx.fillRect(0, 0, width, height);
  mottle(ctx, 0, 0, width, height, r, { cols: 6, rows: 6, color: '#2a070a', alpha: 0.35 });
  mottle(ctx, 0, 0, width, height, r, { cols: 14, rows: 14, color: '#a8434a', alpha: 0.16 });
  mottle(ctx, 0, 0, width, height, r, { cols: 60, rows: 60, color: '#1c0507', alpha: 0.12 });
  // Pebble grain.
  const dots = width * height / 70;
  for (let i = 0; i < dots; i++) {
    const x = r() * width, y = r() * height, rad = 0.6 + r() * 1.6;
    hctx.fillStyle = r() < 0.5 ? 'rgba(255,255,255,0.22)' : 'rgba(0,0,0,0.22)';
    hctx.beginPath(); hctx.arc(x, y, rad, 0, Math.PI * 2); hctx.fill();
  }
  // Soft creases.
  for (let i = 0; i < 26; i++) {
    const x = r() * width, y = r() * height, len = 20 + r() * 90, ang = r() * Math.PI;
    ctx.strokeStyle = 'rgba(30,6,8,0.08)'; ctx.lineWidth = 1 + r() * 2.5;
    ctx.beginPath(); ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + Math.cos(ang) * len * 0.5 + (r() - 0.5) * 20, y + Math.sin(ang) * len * 0.5 + (r() - 0.5) * 20, x + Math.cos(ang) * len, y + Math.sin(ang) * len);
    ctx.stroke();
    hctx.strokeStyle = 'rgba(0,0,0,0.3)'; hctx.lineWidth = ctx.lineWidth; hctx.stroke();
  }
  return { map, bump };
}

export function brushedMetal({ width = 512, height = 512, seed = 5, base = '#b7b5ae' } = {}) {
  const r = seeded(seed);
  const map = makeCanvas(width, height);
  const ctx = map.getContext('2d');
  ctx.fillStyle = base; ctx.fillRect(0, 0, width, height);
  for (let i = 0; i < height * 3; i++) {
    const y = r() * height;
    ctx.fillStyle = r() < 0.5 ? `rgba(255,255,255,${r() * 0.12})` : `rgba(40,40,40,${r() * 0.1})`;
    ctx.fillRect(0, y, width, 0.6 + r());
  }
  mottle(ctx, 0, 0, width, height, r, { cols: 4, rows: 4, color: '#ffffff', alpha: 0.1 });
  return { map, bump: null };
}

export function plaster({ width = 1024, height = 1024, seed = 13, base = '#efe7da' } = {}) {
  const r = seeded(seed);
  const map = makeCanvas(width, height), bump = makeCanvas(width, height);
  const ctx = map.getContext('2d'), hctx = bump.getContext('2d');
  ctx.fillStyle = base; ctx.fillRect(0, 0, width, height);
  hctx.fillStyle = '#808080'; hctx.fillRect(0, 0, width, height);
  mottle(ctx, 0, 0, width, height, r, { cols: 4, rows: 4, color: '#d9ccb8', alpha: 0.5 });
  mottle(ctx, 0, 0, width, height, r, { cols: 9, rows: 9, color: '#fffbf4', alpha: 0.5 });
  mottle(ctx, 0, 0, width, height, r, { cols: 26, rows: 26, color: '#cbbba3', alpha: 0.18 });
  // Limewash brush arcs.
  for (let i = 0; i < 90; i++) {
    const x = r() * width, y = r() * height, rad = 60 + r() * 220;
    ctx.strokeStyle = r() < 0.5 ? 'rgba(255,252,246,0.05)' : 'rgba(190,170,140,0.03)';
    ctx.lineWidth = 20 + r() * 50;
    ctx.beginPath(); ctx.arc(x, y, rad, r() * 6, r() * 6 + 0.6 + r()); ctx.stroke();
  }
  mottle(hctx, 0, 0, width, height, r, { cols: 80, rows: 80, color: '#000000', alpha: 0.18 });
  mottle(hctx, 0, 0, width, height, r, { cols: 80, rows: 80, color: '#ffffff', alpha: 0.18 });
  return { map, bump };
}

export function speckle({ width = 512, height = 512, seed = 17, base = '#b98d5f', dark = '#7d5530', light = '#dcb888', density = 1, size = 1.6 } = {}) {
  const r = seeded(seed);
  const map = makeCanvas(width, height), bump = makeCanvas(width, height);
  const ctx = map.getContext('2d'), hctx = bump.getContext('2d');
  ctx.fillStyle = base; ctx.fillRect(0, 0, width, height);
  hctx.fillStyle = '#808080'; hctx.fillRect(0, 0, width, height);
  mottle(ctx, 0, 0, width, height, r, { cols: 8, rows: 8, color: dark, alpha: 0.3 });
  const n = width * height / 18 * density;
  for (let i = 0; i < n; i++) {
    const x = r() * width, y = r() * height, rad = 0.4 + r() * size;
    const d = r() < 0.55;
    ctx.fillStyle = d ? dark : light;
    ctx.globalAlpha = 0.3 + r() * 0.5;
    ctx.beginPath(); ctx.arc(x, y, rad, 0, Math.PI * 2); ctx.fill();
    hctx.fillStyle = d ? '#303030' : '#d0d0d0';
    hctx.beginPath(); hctx.arc(x, y, rad, 0, Math.PI * 2); hctx.fill();
  }
  ctx.globalAlpha = 1;
  return { map, bump };
}

export function boucle({ width = 512, height = 512, seed = 19, base = '#eee7db' } = {}) {
  const r = seeded(seed);
  const map = makeCanvas(width, height), bump = makeCanvas(width, height);
  const ctx = map.getContext('2d'), hctx = bump.getContext('2d');
  ctx.fillStyle = base; ctx.fillRect(0, 0, width, height);
  hctx.fillStyle = '#707070'; hctx.fillRect(0, 0, width, height);
  const n = width * height / 26;
  for (let i = 0; i < n; i++) {
    const x = r() * width, y = r() * height, rad = 1.5 + r() * 3.2;
    ctx.strokeStyle = r() < 0.5 ? 'rgba(255,255,255,0.5)' : 'rgba(150,130,105,0.25)';
    ctx.lineWidth = 0.8 + r();
    ctx.beginPath(); ctx.arc(x, y, rad, 0, Math.PI * 2); ctx.stroke();
    hctx.strokeStyle = 'rgba(255,255,255,0.5)'; hctx.lineWidth = 1.2;
    hctx.beginPath(); hctx.arc(x, y, rad, 0, Math.PI * 2); hctx.stroke();
  }
  return { map, bump };
}

export function rug({ width = 1024, height = 700, seed = 23, base = '#e7ddcc', border = '#7c2027' } = {}) {
  const r = seeded(seed);
  const map = makeCanvas(width, height), bump = makeCanvas(width, height);
  const ctx = map.getContext('2d'), hctx = bump.getContext('2d');
  ctx.fillStyle = base; ctx.fillRect(0, 0, width, height);
  hctx.fillStyle = '#808080'; hctx.fillRect(0, 0, width, height);
  mottle(ctx, 0, 0, width, height, r, { cols: 10, rows: 7, color: '#c9b89b', alpha: 0.25 });
  for (let y = 0; y < height; y += 3) {
    ctx.fillStyle = `rgba(160,140,110,${0.04 + r() * 0.05})`; ctx.fillRect(0, y, width, 1);
    hctx.fillStyle = y % 6 ? '#909090' : '#707070'; hctx.fillRect(0, y, width, 1.5);
  }
  const b = Math.round(height * 0.06);
  ctx.strokeStyle = border; ctx.lineWidth = b * 0.35;
  ctx.strokeRect(b, b, width - 2 * b, height - 2 * b);
  ctx.lineWidth = 2; ctx.strokeRect(b * 1.6, b * 1.6, width - 3.2 * b, height - 3.2 * b);
  return { map, bump };
}

export function paper({ width = 512, height = 512, seed = 29, base = '#f6f1e6' } = {}) {
  const r = seeded(seed);
  const map = makeCanvas(width, height);
  const ctx = map.getContext('2d');
  ctx.fillStyle = base; ctx.fillRect(0, 0, width, height);
  mottle(ctx, 0, 0, width, height, r, { cols: 6, rows: 6, color: '#e2d6c0', alpha: 0.35 });
  for (let i = 0; i < 400; i++) {
    ctx.strokeStyle = `rgba(160,140,110,${r() * 0.12})`; ctx.lineWidth = 0.5;
    const x = r() * width, y = r() * height, a = r() * 6.28, l = 3 + r() * 10;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); ctx.stroke();
  }
  return map;
}

/**
 * Black stacked-stone relief: irregular split-face blocks in courses, chisel-marked.
 * Tiles horizontally; one repeat covers the wall's full height.
 */
export function blackRelief({ width = 1024, height = 1024, seed = 51 } = {}) {
  const r = seeded(seed);
  const map = makeCanvas(width, height), bump = makeCanvas(width, height);
  const ctx = map.getContext('2d'), hctx = bump.getContext('2d');
  const s = width / 1024;
  ctx.fillStyle = '#121110'; ctx.fillRect(0, 0, width, height);
  hctx.fillStyle = '#202020'; hctx.fillRect(0, 0, width, height);

  const block = (x, y, w, h) => {
    const tone = 24 + r() * 18;
    const hv = 120 + r() * 110;
    const draw = dx => {
      ctx.fillStyle = `rgb(${tone + 3},${tone + 1},${tone - 1})`;
      ctx.fillRect(x + dx + 1.5 * s, y + 1.5 * s, w - 3 * s, h - 3 * s);
      // Split face: a lighter ridge along one edge, a darker hollow along another.
      const g = hctx.createLinearGradient(0, y, 0, y + h);
      g.addColorStop(0, `rgb(${hv + 25},${hv + 25},${hv + 25})`);
      g.addColorStop(0.5 + (r() - 0.5) * 0.5, `rgb(${hv},${hv},${hv})`);
      g.addColorStop(1, `rgb(${hv - 45},${hv - 45},${hv - 45})`);
      hctx.fillStyle = g;
      hctx.fillRect(x + dx + 2 * s, y + 2 * s, w - 4 * s, h - 4 * s);
    };
    draw(0);
    if (x < 0) draw(width);
    if (x + w > width) draw(-width);
    // Chisel marks.
    const marks = (w * h) / (260 * s * s);
    for (let k = 0; k < marks; k++) {
      let mx = x + r() * w, my = y + r() * h;
      if (mx < 0) mx += width; if (mx > width) mx -= width;
      const len = (3 + r() * 9) * s, a = -0.6 + (r() - 0.5) * 0.5;
      const light = r() < 0.5;
      ctx.strokeStyle = light ? 'rgba(90,86,80,0.35)' : 'rgba(0,0,0,0.45)';
      ctx.lineWidth = (0.6 + r() * 1.2) * s;
      ctx.beginPath(); ctx.moveTo(mx, my); ctx.lineTo(mx + Math.cos(a) * len, my + Math.sin(a) * len); ctx.stroke();
      hctx.strokeStyle = light ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.45)';
      hctx.lineWidth = ctx.lineWidth;
      hctx.beginPath(); hctx.moveTo(mx, my); hctx.lineTo(mx + Math.cos(a) * len, my + Math.sin(a) * len); hctx.stroke();
    }
  };

  let y = 0;
  while (y < height) {
    const rowH = Math.min(height - y, (16 + r() * 46) * s);
    let x = -r() * 140 * s;
    while (x < width) {
      const w = (70 + r() * 230) * s;
      block(x, y, w, rowH);
      x += w;
    }
    y += rowH;
  }
  mottle(ctx, 0, 0, width, height, r, { cols: 6, rows: 6, color: '#3a342d', alpha: 0.18 });
  return { map, bump };
}

/** Natural linen: fine slub weave in oat. */
export function linen({ width = 512, height = 512, seed = 61, base = '#ebdcc4' } = {}) {
  const r = seeded(seed);
  const map = makeCanvas(width, height), bump = makeCanvas(width, height);
  const ctx = map.getContext('2d'), hctx = bump.getContext('2d');
  ctx.fillStyle = base; ctx.fillRect(0, 0, width, height);
  hctx.fillStyle = '#808080'; hctx.fillRect(0, 0, width, height);
  mottle(ctx, 0, 0, width, height, r, { cols: 8, rows: 8, color: '#cdbfa8', alpha: 0.3 });
  for (let y = 0; y < height; y += 2) {
    ctx.fillStyle = `rgba(${r() < 0.5 ? '255,252,245' : '150,132,106'},${0.05 + r() * 0.1})`;
    ctx.fillRect(0, y, width, 1);
    hctx.fillStyle = y % 4 ? '#8c8c8c' : '#747474'; hctx.fillRect(0, y, width, 1);
  }
  for (let x = 0; x < width; x += 2) {
    ctx.fillStyle = `rgba(${r() < 0.5 ? '255,252,245' : '150,132,106'},${0.04 + r() * 0.08})`;
    ctx.fillRect(x, 0, 1, height);
  }
  // Slubs.
  for (let i = 0; i < width * height / 900; i++) {
    ctx.fillStyle = `rgba(120,104,82,${0.1 + r() * 0.15})`;
    ctx.fillRect(r() * width, r() * height, 3 + r() * 10, 1);
  }
  return { map, bump };
}

/** Soft vertical glow (bright at the top) — the light spilling from a hidden cove. */
export function glowGradient({ height = 256, stops = [[0, 1], [0.25, 0.55], [1, 0]] } = {}) {
  const c = makeCanvas(4, height);
  const ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 0, height);
  for (const [at, a] of stops) g.addColorStop(at, `rgba(255,255,255,${a})`);
  ctx.fillStyle = g; ctx.fillRect(0, 0, 4, height);
  return c;
}

/** A small travertine swatch as a data URL — used as the intro backdrop while the room builds. */
export function stoneDataUrl(size = 640) {
  const { map } = travertineTiles({ width: size, height: size, cols: 1, rows: 2, bond: 0, grout: 0, seed: 42, pits: 1.2 });
  return map.toDataURL('image/jpeg', 0.82);
}
