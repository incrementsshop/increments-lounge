import { CONFIG } from './config.js';

// Loads the catalog snapshot (data/catalog.json, refreshed by tools/refresh_catalog.py)
// and gives the rest of the app a small, forgiving API over it.

const money = new Intl.NumberFormat(CONFIG.store.locale, { style: 'currency', currency: CONFIG.store.currency });
export const formatMoney = n => money.format(n);
export const formatShort = n => (Number.isInteger(n) ? String(n) : n.toFixed(2));

export const ZONES = {
  window:   { name: 'Still Becoming', blurb: 'Now serving. Three colours, one chapter.' },
  lounge:   { name: 'Worn',           blurb: 'Worn in, not worn out. Garment-washed and faded.' },
  movement: { name: 'Movement',       blurb: 'For the next step.' },
  till:     { name: 'At the till',    blurb: 'Small things, easy adds.' },
  archive:  { name: 'From the archive', blurb: 'Past chapters. Mostly closed.' },
};

export class Catalog {
  constructor(data) {
    this.raw = data;
    this.generatedAt = data.generatedAt;
    this.featured = data.featured || {};
    this.lifestyle = data.lifestyle || [];
    this.products = data.products.map(enrich);
    this.byHandle = new Map(this.products.map(p => [p.handle, p]));
  }

  static async load(url = CONFIG.catalogUrl) {
    const res = await fetch(url, { cache: 'no-cache' });
    if (!res.ok) throw new Error(`catalog ${res.status}`);
    return new Catalog(await res.json());
  }

  get(handle) { return this.byHandle.get(handle); }

  zone(zone) { return this.products.filter(p => p.zone === zone); }

  /** Products that belong on the menu (anything not in the archive), in menu order. */
  menu() {
    const order = ['window', 'lounge', 'movement', 'till'];
    return order.map(z => ({ zone: z, ...ZONES[z], products: this.zone(z) })).filter(s => s.products.length);
  }

  archiveChapters() {
    const chapters = new Map();
    for (const p of this.zone('archive')) {
      const key = p.chapter?.name || 'Earlier';
      if (!chapters.has(key)) chapters.set(key, { name: key, year: p.chapter?.year, products: [] });
      chapters.get(key).products.push(p);
    }
    return [...chapters.values()].sort((a, b) => (a.year || 0) - (b.year || 0));
  }
}

function enrich(p) {
  const parsed = parseDescription(p);
  return {
    ...p,
    tagline: parsed.tagline,
    body: parsed.body,
    details: parsed.details,
    /** Primary image for a colour (falls back to the product's first image). */
    imageFor(colour) {
      return p.colours.find(c => c.name === colour)?.image || p.images[0]?.src;
    },
    /** All images, with the selected colour's image first. */
    galleryFor(colour) {
      const first = this.imageFor(colour);
      const rest = p.images.map(i => i.src).filter(s => s !== first);
      return [first, ...rest].filter(Boolean);
    },
    findVariant({ colour, size, style } = {}) {
      return p.variants.find(v =>
        (colour == null || v.colour == null || v.colour === colour) &&
        (size == null || v.size == null || v.size === size) &&
        (style == null || v.style == null || v.style === style));
    },
    isAvailable(sel = {}) {
      return p.variants.some(v =>
        v.available &&
        (sel.colour == null || v.colour == null || v.colour === sel.colour) &&
        (sel.size == null || v.size == null || v.size === sel.size) &&
        (sel.style == null || v.style == null || v.style === sel.style));
    },
  };
}

// Shopify descriptions on this store follow a loose pattern:
//   line 1: "Worn Sweat (Faded) Charcoal / Cloudstone / Chestnut"   ← admin label, skip
//   line 2: "\"worn in. not worn out.\""                            ← tagline
//   then prose, then short spec lines ("52% Cotton", "Puff Print Logo").
function parseDescription(p) {
  const lines = (p.description || '').split('\n').map(s => s.trim()).filter(Boolean);
  let tagline = '';
  const body = [];
  const details = [];
  const titleWord = p.title.split(' ')[0].toLowerCase();
  lines.forEach((line, i) => {
    if (i === 0 && line.toLowerCase().startsWith(titleWord) && /[/(]/.test(line)) return;
    const quoted = line.match(/^["“](.+?)["”]$/);
    if (quoted && !tagline) { tagline = quoted[1]; return; }
    if (line.length <= 32 && !/[.!?]$/.test(line)) { details.push(line); return; }
    body.push(line);
  });
  return { tagline, body: body.join(' '), details: details.slice(0, 6) };
}
