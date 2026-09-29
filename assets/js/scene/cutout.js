// Turns a product photo into something that can stand in the room.
//
// Flat product shots on a plain studio background become transparent cut-outs
// (flood-filled from the edges, so white inside a garment survives). Anything
// else — on-model photos, lifestyle shots — is reported as a "photo" and gets
// framed or pegged instead. The decision is made per image, so the scene adapts
// to whatever photography the store has.

const cache = new Map();

export function shopifyImage(src, width = 800) {
  if (!src) return src;
  const sep = src.includes('?') ? '&' : '?';
  return `${src}${sep}width=${width}`;
}

export function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.decoding = 'async';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`image failed: ${src}`));
    img.src = src;
  });
}

const dist2 = (d, i, r, g, b) => {
  const dr = d[i] - r, dg = d[i + 1] - g, db = d[i + 2] - b;
  return dr * dr + dg * dg + db * db;
};

/**
 * @returns {Promise<{kind:'cutout'|'photo', canvas:HTMLCanvasElement, aspect:number, image:HTMLImageElement}>}
 */
export function prepareProductImage(src, { maxSize = 640, width = 800 } = {}) {
  const key = `${src}|${maxSize}`;
  if (!cache.has(key)) cache.set(key, build(src, maxSize, width));
  return cache.get(key);
}

async function build(src, maxSize, width) {
  const img = await loadImage(shopifyImage(src, width));
  const scale = Math.min(1, maxSize / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.max(1, Math.round(img.naturalWidth * scale));
  const h = Math.max(1, Math.round(img.naturalHeight * scale));

  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0, w, h);

  const photo = () => ({ kind: 'photo', canvas, aspect: w / h, image: img });

  let data;
  try {
    data = ctx.getImageData(0, 0, w, h);
  } catch {
    return photo(); // tainted canvas (no CORS) — show it as a print
  }
  const d = data.data;

  // 1. Background estimate: median of the border ring.
  const ring = [];
  const pushPx = (x, y) => ring.push((y * w + x) * 4);
  for (let x = 0; x < w; x += 2) { pushPx(x, 0); pushPx(x, h - 1); }
  for (let y = 0; y < h; y += 2) { pushPx(0, y); pushPx(w - 1, y); }
  const channel = c => {
    const v = ring.map(i => d[i + c]).sort((a, b) => a - b);
    return v[v.length >> 1];
  };
  const br = channel(0), bgc = channel(1), bb = channel(2);

  const T_EDGE = 26 * 26;   // border pixels this close count as background
  const T_FILL = 34 * 34;   // flood-fill tolerance
  const T_SOFT = 22 * 22;   // below this a pixel is fully transparent
  const T_HOLE = 10 * 10;   // enclosed holes must be this close to the background

  const uniform = ring.filter(i => dist2(d, i, br, bgc, bb) < T_EDGE).length / ring.length;
  if (uniform < 0.9) return photo();

  // 2. Flood fill from every background-like border pixel.
  const bg = new Uint8Array(w * h);
  const stack = [];
  const seed = (x, y) => {
    const p = y * w + x;
    if (!bg[p] && dist2(d, p * 4, br, bgc, bb) < T_FILL) { bg[p] = 1; stack.push(p); }
  };
  for (let x = 0; x < w; x++) { seed(x, 0); seed(x, h - 1); }
  for (let y = 0; y < h; y++) { seed(0, y); seed(w - 1, y); }
  while (stack.length) {
    const p = stack.pop();
    const x = p % w, y = (p / w) | 0;
    if (x > 0) seed(x - 1, y);
    if (x < w - 1) seed(x + 1, y);
    if (y > 0) seed(x, y - 1);
    if (y < h - 1) seed(x, y + 1);
  }

  // 3. Enclosed holes (between an arm and the body) that are *exactly* background.
  const seen = new Uint8Array(w * h);
  const minHole = Math.max(40, (w * h) * 0.0015);
  for (let p = 0; p < w * h; p++) {
    if (bg[p] || seen[p] || dist2(d, p * 4, br, bgc, bb) >= T_HOLE) continue;
    const comp = [p]; seen[p] = 1;
    for (let k = 0; k < comp.length; k++) {
      const q = comp[k], x = q % w, y = (q / w) | 0;
      const nb = [x > 0 && q - 1, x < w - 1 && q + 1, y > 0 && q - w, y < h - 1 && q + w];
      for (const n of nb) {
        if (n === false || seen[n] || bg[n]) continue;
        if (dist2(d, n * 4, br, bgc, bb) < T_HOLE) { seen[n] = 1; comp.push(n); }
      }
    }
    if (comp.length >= minHole) for (const q of comp) bg[q] = 1;
  }

  // 4. Alpha with a soft, colour-decontaminated edge.
  let removed = 0, minX = w, minY = h, maxX = 0, maxY = 0;
  for (let p = 0; p < w * h; p++) {
    const i = p * 4, x = p % w, y = (p / w) | 0;
    if (bg[p]) {
      // Background pixels touching the garment keep a little alpha for anti-aliasing.
      const nearFg = (x > 0 && !bg[p - 1]) || (x < w - 1 && !bg[p + 1]) || (y > 0 && !bg[p - w]) || (y < h - 1 && !bg[p + w]);
      const a = nearFg ? Math.max(0, Math.min(1, (dist2(d, i, br, bgc, bb) - T_SOFT) / (T_FILL - T_SOFT))) : 0;
      if (a <= 0.02) { d[i + 3] = 0; removed++; continue; }
      const bgv = [br, bgc, bb];
      for (let c = 0; c < 3; c++) d[i + c] = Math.max(0, Math.min(255, (d[i + c] - bgv[c] * (1 - a)) / a));
      d[i + 3] = Math.round(a * 255);
    }
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }

  const frac = removed / (w * h);
  if (frac < 0.12 || frac > 0.97 || maxX <= minX || maxY <= minY) return photo();

  // Average garment colour — used to match an unlabelled image to a colourway.
  let ar = 0, ag = 0, ab = 0, an = 0;
  for (let i = 0; i < d.length; i += 16) {
    if (d[i + 3] > 220) { ar += d[i]; ag += d[i + 1]; ab += d[i + 2]; an++; }
  }
  const avg = an ? [ar / an, ag / an, ab / an] : null;

  ctx.putImageData(data, 0, 0);

  // 5. Trim to the garment with a hair of padding so edges never touch the plane border.
  const pad = 4;
  minX = Math.max(0, minX - pad); minY = Math.max(0, minY - pad);
  maxX = Math.min(w - 1, maxX + pad); maxY = Math.min(h - 1, maxY + pad);
  const tw = maxX - minX + 1, th = maxY - minY + 1;
  const out = document.createElement('canvas');
  out.width = tw; out.height = th;
  out.getContext('2d').drawImage(canvas, minX, minY, tw, th, 0, 0, tw, th);

  return { kind: 'cutout', canvas: out, aspect: tw / th, image: img, avg };
}

