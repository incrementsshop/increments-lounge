import { h, STAMP_SVG } from './dom.js';
import { openDialog } from './dialogs.js';
import { openProduct } from './product.js';
import { shopifyImage } from '../scene/cutout.js';
import { formatMoney, formatShort } from '../catalog.js';
import { STAMPS } from '../stamps.js';
import { CONFIG } from '../config.js';
import { track } from '../analytics.js';

// ---------------------------------------------------------------------------
// The tray — a café receipt
// ---------------------------------------------------------------------------

export function openTray(app) {
  track('tray_open', { items: app.tray.count, value: app.tray.subtotal });
  openDialog({
    variant: 'sheet',
    title: 'Your <em>tray</em>',
    kicker: 'Order',
    className: 'tray',
    build(body, api) {
      const render = () => {
        const { items } = app.tray;
        const order = String(Math.abs(hash(items.map(i => i.variantId).join())) % 9000 + 1000);
        const receipt = h('div', { class: 'receipt' },
          h('div', { class: 'receipt__head' },
            h('div', { class: 'receipt__brand' }, 'Increments'),
            h('div', { class: 'receipt__meta' }, `THE LOUNGE · ORDER #${order}`),
            h('div', { class: 'receipt__meta' }, new Date().toLocaleString(CONFIG.store.locale, { dateStyle: 'medium', timeStyle: 'short' })),
          ));
        if (!items.length) {
          receipt.append(h('div', { class: 'receipt__empty' },
            h('p', {}, 'Nothing on your tray yet. The menu’s a good place to start.'),
            h('button', { class: 'button button--small', type: 'button', onclick: () => { api.close(); app.openMenu(); } }, 'Open the menu')));
        } else {
          for (const it of items) {
            const variant = [it.colour, it.size, it.style].filter(Boolean).join(' · ');
            receipt.append(h('div', { class: 'line' },
              h('img', { src: shopifyImage(it.image, 160), alt: '', loading: 'lazy' }),
              h('div', {},
                h('div', { class: 'line__name' }, it.title),
                variant ? h('div', { class: 'line__variant' }, variant) : null,
                h('div', { class: 'line__qty' },
                  h('button', { type: 'button', 'aria-label': `One fewer ${it.title}`, onclick: () => app.tray.setQty(it.variantId, it.qty - 1) }, '−'),
                  h('output', { 'aria-live': 'polite' }, it.qty),
                  h('button', { type: 'button', 'aria-label': `One more ${it.title}`, onclick: () => app.tray.setQty(it.variantId, it.qty + 1) }, '+'),
                  h('button', { class: 'line__remove', type: 'button', onclick: () => app.tray.remove(it.variantId) }, 'Remove'))),
              h('div', { class: 'line__price' }, formatMoney(it.price * it.qty))));
          }
          const reward = app.stamps.complete && CONFIG.reward.code;
          receipt.append(h('div', { class: 'receipt__totals' },
            h('div', {}, h('span', {}, 'Subtotal'), h('span', {}, formatMoney(app.tray.subtotal))),
            reward ? h('div', {}, h('span', {}, 'Stamp card'), h('span', {}, CONFIG.reward.code)) : null,
            h('div', {}, h('span', {}, 'Shipping & tax'), h('span', {}, 'at checkout')),
            h('div', { class: 'is-total' }, h('span', {}, 'Total (CAD)'), h('span', {}, formatMoney(app.tray.subtotal)))));
        }
        receipt.append(h('div', { class: 'receipt__foot' },
          h('div', { class: 'barcode', 'aria-hidden': 'true' }),
          'LIFE UNFOLDS IN INCREMENTS', h('br'), 'THANK YOU FOR STOPPING BY'));
        body.replaceChildren(receipt);
        api.foot.replaceChildren(...footer());
      };

      const footer = () => {
        if (!app.tray.count) return [h('a', { class: 'button button--block', href: `https://${CONFIG.store.domain}` }, 'Visit increments.ca')];
        const discount = app.stamps.complete ? CONFIG.reward.code : '';
        const pay = h('a', {
          class: 'button button--primary button--block',
          href: app.tray.checkoutUrl({ discount }),
          onclick: () => track('checkout_click', { items: app.tray.count, value: app.tray.subtotal, discount: !!discount }),
        }, `Pay at the counter — ${formatMoney(app.tray.subtotal)}`);
        const cont = h('a', {
          class: 'button button--ghost button--block',
          href: app.tray.checkoutUrl({ discount, storefront: true }),
          style: { marginTop: '8px' },
          onclick: () => track('checkout_click', { items: app.tray.count, value: app.tray.subtotal, storefront: true }),
        }, 'Keep shopping on increments.ca');
        return [pay, cont, h('p', { class: 'product__note' }, 'You’ll finish up in the Increments checkout, with your tray already in the cart.')];
      };

      const onChange = () => { if (api.dlg.open) render(); };
      app.tray.addEventListener('change', onChange);
      api.closed.then(() => app.tray.removeEventListener('change', onChange));
      render();
    },
    foot() {},
  });
}

// ---------------------------------------------------------------------------
// The menu — full list view; also the whole shop when WebGL isn't available
// ---------------------------------------------------------------------------

export function openMenu(app, { zone } = {}) {
  track('menu_open', { zone });
  const api = openDialog({
    variant: 'full',
    title: 'The Menu',
    kicker: 'Increments Lounge',
    className: 'menu',
    build(body, api) {
      const inner = h('div', { class: 'menu__inner' });
      inner.append(h('div', { class: 'menu__masthead' },
        h('h2', { html: 'The <em>Menu</em>' }),
        h('p', {}, `Now serving: ${app.catalog.featured.name || 'the new chapter'}. ${app.catalog.featured.line || ''}`)));
      for (const section of app.catalog.menu()) {
        const list = h('ul', { class: 'menu__list' });
        for (const p of section.products) {
          const img = p.colours[0]?.image || p.images[0]?.src;
          list.append(h('li', {}, h('button', {
            class: `menu-item${p.available ? '' : ' is-out'}`, type: 'button',
            onclick: () => openProduct(app, p.handle, { from: 'menu' }),
          },
          h('img', { src: shopifyImage(img, 160), alt: '', loading: 'lazy', decoding: 'async' }),
          h('div', {},
            h('div', { class: 'menu-item__row' },
              h('span', { class: 'menu-item__name' }, p.title),
              h('span', { class: 'menu-item__leader', 'aria-hidden': 'true' }),
              h('span', { class: 'menu-item__price' }, p.available ? `$${formatShort(p.price)}` : 'Sold out')),
            h('div', { class: 'menu-item__sub' },
              p.colours.length ? h('span', { class: 'dots', 'aria-hidden': 'true' }, p.colours.slice(0, 5).map(c => h('i', { style: { '--sw': c.hex || '#ccc' } }))) : null,
              p.colours.length ? h('span', {}, p.colours.map(c => c.name).join(', ')) : null)))));
        }
        inner.append(h('section', { class: 'menu__section', id: `menu-${section.zone}`, 'aria-label': section.name },
          h('h3', {}, section.name), h('p', {}, section.blurb), list));
      }
      const archiveCount = app.catalog.zone('archive').length;
      inner.append(h('div', { class: 'menu__foot' },
        archiveCount ? h('p', {}, h('button', { class: 'pill', type: 'button', onclick: () => openArchive(app) }, `Browse the archive — ${archiveCount} pieces from past chapters`)) : null,
        h('p', {}, 'Prefer the regular shop? ', h('a', { href: `https://${CONFIG.store.domain}` }, `Everything is on ${CONFIG.store.domain}`), '.'),
        h('p', { style: { fontSize: '12px' } }, `Menu updated ${new Date(app.catalog.generatedAt).toLocaleDateString(CONFIG.store.locale, { dateStyle: 'long' })}.`)));
      body.append(inner);
      if (zone) requestAnimationFrame(() => body.querySelector(`#menu-${zone}`)?.scrollIntoView({ block: 'start' }));
    },
  });
  return api;
}

// ---------------------------------------------------------------------------
// Stamp card
// ---------------------------------------------------------------------------

export function openStamps(app) {
  const seenKey = 'increments-lounge:stamps-seen';
  let seen = [];
  try { seen = JSON.parse(localStorage.getItem(seenKey)) || []; } catch { /* ignore */ }
  openDialog({
    variant: 'center',
    title: 'Stamp <em>card</em>',
    kicker: 'Eight increments',
    build(body) {
      const n = app.stamps.count;
      const grid = h('ol', { class: 'stampcard__grid' });
      STAMPS.forEach((s, i) => {
        const stamped = app.stamps.has(s.id);
        const li = h('li', { class: `stamp${stamped ? ' is-stamped' : ''}${stamped && !seen.includes(s.id) ? ' is-new' : ''}`, style: { '--rot': `${[-8, 6, -3, 10, -12, 4, -6, 8][i]}deg` } },
          h('div', { class: 'stamp__ring', html: STAMP_SVG }, h('span', { class: 'stamp__n', 'aria-hidden': 'true' }, i + 1)),
          h('span', { class: 'stamp__label' }, s.label, h('span', { class: 'sr-only' }, stamped ? ' — stamped' : ' — not yet')));
        li.querySelector('.stamp__ring').style.animationDelay = `${i * 80}ms`;
        grid.append(li);
      });
      const complete = app.stamps.complete;
      body.append(h('div', { class: 'stampcard' },
        h('div', { class: 'stampcard__head' },
          h('span', { class: 'stampcard__brand' }, 'Increments'),
          h('span', { class: 'stampcard__count' }, `${n} / ${app.stamps.total}`)),
        h('p', { class: 'stampcard__line' }, complete ? CONFIG.reward.fullMessage : 'Small steps, big accomplishments. Collect all eight.'),
        grid,
        complete && CONFIG.reward.code
          ? h('div', { class: 'stampcard__reward' }, CONFIG.reward.rewardMessage, h('br'), h('code', {}, CONFIG.reward.code))
          : null),
        h('p', { class: 'product__note', style: { marginTop: '16px' } }, 'Stamps are saved on this device.'));
      try { localStorage.setItem(seenKey, JSON.stringify([...app.stamps.earned])); } catch { /* ignore */ }
    },
  });
}

// ---------------------------------------------------------------------------
// Station list (tap the dock)
// ---------------------------------------------------------------------------

export function openStations(app) {
  openDialog({
    variant: 'sheet',
    title: 'Stations',
    kicker: 'Where to next',
    build(body, api) {
      const list = h('ol', { class: 'stations' });
      app.stations.forEach((s, i) => {
        list.append(h('li', {}, h('button', {
          type: 'button',
          'aria-current': String(i === app.rig.index),
          onclick: () => { api.close(); app.goTo(i); },
        },
        h('span', { class: 'st-i' }, String(i + 1).padStart(2, '0')),
        h('span', {}, h('span', { class: 'st-name' }, s.name), h('span', { class: 'st-sub' }, s.eyebrow)),
        s.stamp ? h('span', { class: `st-stamp${app.stamps.has(s.stamp) ? ' is-stamped' : ''}`, 'aria-label': app.stamps.has(s.stamp) ? 'Stamped' : 'Not stamped yet' }) : h('span'))));
      });
      body.append(list);
    },
  });
}

// ---------------------------------------------------------------------------
// Archive
// ---------------------------------------------------------------------------

export function openArchive(app, { chapter } = {}) {
  track('archive_open', { chapter });
  app.stamps.earn('archive');
  openDialog({
    variant: 'sheet',
    title: 'The <em>Archive</em>',
    kicker: 'Past chapters',
    build(body) {
      body.append(h('p', { class: 'archive__intro' }, 'Every chapter we’ve closed. Most are gone for good — the ones marked “last few” can still be ordered.'));
      for (const ch of app.catalog.archiveChapters()) {
        const grid = h('div', { class: 'archive__grid' });
        for (const p of ch.products) {
          grid.append(h('button', {
            class: `archive__item${p.available ? ' is-available' : ''}`, type: 'button',
            onclick: () => openProduct(app, p.handle, { from: 'archive' }),
          },
          h('figure', {}, h('img', { src: shopifyImage(p.images[0]?.src, 360), alt: '', loading: 'lazy', decoding: 'async' })),
          h('span', {}, p.title),
          h('small', {}, p.available ? `Last few · $${formatShort(p.price)}` : 'Sold out')));
        }
        const section = h('section', { class: 'menu__section', id: `archive-${slug(ch.name)}` },
          h('h3', {}, `${ch.name}${ch.year ? ` · ${ch.year}` : ''}`), grid);
        body.append(section);
      }
      if (chapter) requestAnimationFrame(() => body.querySelector(`#archive-${slug(chapter)}`)?.scrollIntoView({ block: 'start' }));
    },
  });
}

const slug = s => s.toLowerCase().replace(/[^a-z0-9]+/g, '-');
function hash(s) { let x = 0; for (let i = 0; i < s.length; i++) x = (x * 31 + s.charCodeAt(i)) | 0; return x; }
