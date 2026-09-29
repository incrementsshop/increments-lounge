import { CONFIG } from './config.js';

// "The tray": a local cart that hands off to Shopify's own checkout through a cart
// permalink (https://shop/cart/<variant>:<qty>,…). No API token, no backend — the
// shopper lands in the real Increments checkout with everything already in it.

const KEY = 'increments-lounge:tray:v1';

function read() {
  try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch { return []; }
}
function write(items) {
  try { localStorage.setItem(KEY, JSON.stringify(items)); } catch { /* private mode: tray lives in memory */ }
}

export class Tray extends EventTarget {
  constructor() {
    super();
    this.items = read();
  }

  get count() { return this.items.reduce((n, i) => n + i.qty, 0); }
  get subtotal() { return this.items.reduce((n, i) => n + i.qty * i.price, 0); }

  add(product, variant, qty = 1) {
    const existing = this.items.find(i => i.variantId === variant.id);
    if (existing) existing.qty = Math.min(existing.qty + qty, 10);
    else {
      this.items.push({
        variantId: variant.id,
        handle: product.handle,
        title: product.title,
        colour: variant.colour || null,
        size: variant.size || null,
        style: variant.style || null,
        price: variant.price,
        image: product.imageFor(variant.colour),
        qty,
      });
    }
    this.#changed('add', { handle: product.handle, variantId: variant.id });
  }

  setQty(variantId, qty) {
    const item = this.items.find(i => i.variantId === variantId);
    if (!item) return;
    if (qty <= 0) this.items = this.items.filter(i => i !== item);
    else item.qty = Math.min(qty, 10);
    this.#changed('qty', { variantId });
  }

  remove(variantId) { this.setQty(variantId, 0); }

  clear() { this.items = []; this.#changed('clear'); }

  /**
   * @param {{discount?: string, storefront?: boolean}} opts
   *   storefront: land on the store's cart page instead of going straight to checkout.
   */
  checkoutUrl({ discount = '', storefront = false } = {}) {
    const lines = this.items.map(i => `${i.variantId}:${i.qty}`).join(',');
    const params = new URLSearchParams();
    const { utm_source, utm_medium, utm_campaign, cartAttribute } = CONFIG.attribution;
    if (discount) params.set('discount', discount);
    if (storefront) params.set('storefront', 'true');
    if (cartAttribute) params.set(`attributes[${cartAttribute[0]}]`, cartAttribute[1]);
    params.set('ref', utm_source);
    params.set('utm_source', utm_source);
    params.set('utm_medium', utm_medium);
    params.set('utm_campaign', utm_campaign);
    return `https://${CONFIG.store.domain}/cart/${lines}?${params}`;
  }

  #changed(type, detail = {}) {
    write(this.items);
    this.dispatchEvent(new CustomEvent('change', { detail: { type, ...detail } }));
  }
}
