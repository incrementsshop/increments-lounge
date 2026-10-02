import { h } from './dom.js';
import { openDialog } from './dialogs.js';
import { shopifyImage } from '../scene/cutout.js';
import { formatMoney, ZONES } from '../catalog.js';
import { CONFIG } from '../config.js';
import { track } from '../analytics.js';

// The product sheet: gallery, colour, size, add to bag. Variant availability comes
// straight from the catalog, so sold-out sizes are shown but can't be picked.

export function openProduct(app, handle, { colour, from, lean = false } = {}) {
  const p = app.catalog.get(handle);
  if (!p) return;
  const zone = ZONES[p.zone];
  const flat = p.zone === 'window' || p.zone === 'lounge' || p.zone === 'archive';

  const firstAvailableColour = p.colours.find(c => c.available)?.name || p.colours[0]?.name || null;
  const state = {
    colour: colour && p.colours.some(c => c.name === colour) ? colour : firstAvailableColour,
    size: null,
    style: p.styles.length ? (p.styles.find(s => p.isAvailable({ style: s })) || p.styles[0]) : null,
  };
  if (p.sizes.length === 1) state.size = p.sizes[0];
  track('product_open', { handle, colour: state.colour, from: from || app.rig?.station.id });

  const kicker = p.zone === 'archive' ? `${p.chapter?.name || 'Archive'} · ${p.chapter?.year || ''}` : zone?.name;

  return openDialog({
    variant: 'sheet',
    title: escapeHtml(p.title),
    kicker,
    className: `product${lean ? ' is-lean' : ''}`, // is-lean: a shorter sheet, the piece stays in view above it
    build(body) {
      const gallery = h('div', { class: 'product__gallery', role: 'group', 'aria-label': `${p.title} photos` });
      const renderGallery = () => {
        gallery.replaceChildren(...p.galleryFor(state.colour).slice(0, 6).map((src, i) =>
          h('figure', { class: flat && i === 0 ? 'is-flat' : '' },
            h('img', { src: shopifyImage(src, 720), alt: i === 0 ? `${p.title}${state.colour ? ` in ${state.colour}` : ''}` : '', loading: i ? 'lazy' : 'eager', decoding: 'async' }))));
        gallery.scrollLeft = 0;
      };
      renderGallery();

      const priceEl = h('span', { class: 'product__price' }, formatMoney(p.price));
      // Options can cost different amounts (socks: single pairs and bundles); show the one chosen.
      const prices = [...new Set(p.variants.map(v => v.price))];
      const showPrice = () => {
        const v = p.findVariant(state);
        priceEl.textContent = v && (state.size || p.sizes.length <= 1) ? formatMoney(v.price)
          : prices.length > 1 ? `From ${formatMoney(Math.min(...prices))}` : formatMoney(p.price);
      };
      body.addEventListener('selection', showPrice);
      showPrice();
      body.append(...[
        gallery,
        !p.available ? h('span', { class: 'product__badge' }, p.zone === 'archive' ? 'Chapter closed' : 'Sold out') : null,
        p.zone === 'archive' && p.available ? h('span', { class: 'product__badge', style: { background: 'var(--chestnut)' } }, 'Last few from the archive') : null,
        h('div', { class: 'product__meta' },
          p.tagline ? h('p', { class: 'product__tagline' }, `“${p.tagline}”`) : h('span'),
          priceEl),
        p.body ? h('p', { class: 'product__desc' }, p.body) : null,
        p.details.length ? h('ul', { class: 'product__details' }, p.details.map(d => h('li', {}, d))) : null,
      ].filter(Boolean));

      // Colour.
      if (p.colours.length > 1 || (p.colours.length === 1 && p.options.includes('colour'))) {
        const legendValue = h('b', {}, state.colour || '');
        const group = h('div', { class: 'options', role: 'radiogroup', 'aria-label': 'Colour' });
        const swatches = p.colours.map(c => {
          const out = !p.isAvailable({ colour: c.name });
          return h('button', {
            class: `swatch${out ? ' is-out' : ''}`, type: 'button', role: 'radio',
            'aria-checked': String(c.name === state.colour),
            'aria-label': `${c.name}${out ? ' (sold out)' : ''}`,
            title: c.name,
            style: { '--sw': c.hex || '#ccc' },
            onclick: () => {
              state.colour = c.name;
              legendValue.textContent = c.name;
              swatches.forEach(s => s.setAttribute('aria-checked', String(s === swatchFor(c.name))));
              if (state.size && !p.isAvailable({ colour: state.colour, size: state.size, style: state.style })) state.size = null;
              renderGallery(); renderSizes(); sync();
              track('colour_select', { handle, colour: c.name });
            },
          }, h('span'));
        });
        const swatchFor = name => swatches[p.colours.findIndex(c => c.name === name)];
        radioKeys(group);
        group.append(...swatches);
        body.append(h('fieldset', { class: 'field' }, h('legend', {}, 'Colour', legendValue), group));
      }

      // Style (e.g. socks bundles).
      if (p.styles.length > 1) {
        const group = h('div', { class: 'options', role: 'radiogroup', 'aria-label': 'Style' });
        const btns = p.styles.map(s => h('button', {
          class: 'size', type: 'button', role: 'radio', 'aria-checked': String(s === state.style),
          disabled: !p.isAvailable({ style: s }) || null,
          style: { fontFamily: 'var(--font-ui)', fontSize: '13px' },
          onclick: () => { state.style = s; btns.forEach(b => b.setAttribute('aria-checked', String(b.textContent === s))); sync(); },
        }, s));
        radioKeys(group);
        group.append(...btns);
        body.append(h('fieldset', { class: 'field' }, h('legend', {}, 'Style'), group));
      }

      // Size.
      const sizeGroup = h('div', { class: 'options', role: 'radiogroup', 'aria-label': 'Size' });
      radioKeys(sizeGroup);
      const renderSizes = () => {
        sizeGroup.replaceChildren(...p.sizes.map(s => {
          const ok = p.isAvailable({ colour: state.colour, size: s, style: state.style });
          return h('button', {
            class: 'size', type: 'button', role: 'radio',
            'aria-checked': String(s === state.size),
            'aria-label': `${s}${ok ? '' : ' (sold out)'}`,
            disabled: !ok || null,
            onclick: () => { state.size = s; renderSizes(); sync(); track('size_select', { handle, size: s }); },
          }, s);
        }));
      };
      if (p.sizes.length > 1) {
        renderSizes();
        body.append(h('fieldset', { class: 'field' }, h('legend', {}, 'Size'), sizeGroup));
      }

      function sync() { body.dispatchEvent(new Event('selection')); }
    },

    foot(foot, api) {
      const addBtn = h('button', { class: 'button button--primary button--block', type: 'button' });
      const note = h('p', { class: 'product__note' },
        'Checkout is on ', h('a', { href: p.url, target: '_blank', rel: 'noopener' }, CONFIG.store.domain), ' — secure, with all the usual shipping options.');
      const refresh = () => {
        const needsSize = p.sizes.length > 1 && !state.size;
        const variant = p.findVariant(state);
        if (!p.available) {
          addBtn.disabled = false;
          addBtn.textContent = p.zone === 'archive' ? 'Hear when a chapter returns' : 'Sold out — join the newsletter';
          addBtn.onclick = () => { track('newsletter_click', { handle }); window.open(CONFIG.newsletterUrl, '_blank', 'noopener'); };
          return;
        }
        addBtn.onclick = add;
        if (needsSize) { addBtn.disabled = true; addBtn.textContent = 'Choose a size'; return; }
        if (!variant || !variant.available) { addBtn.disabled = true; addBtn.textContent = 'Sold out in this option'; return; }
        addBtn.disabled = false;
        addBtn.textContent = `Add to bag — ${formatMoney(variant.price)}`;
      };
      const add = () => {
        const variant = p.findVariant(state);
        if (!variant?.available) return;
        app.tray.add(p, variant);
        track('add_to_tray', { handle, variant: variant.id, price: variant.price, colour: variant.colour, size: variant.size });
        app.hud.toast(`${p.title}${variant.size ? ` (${variant.size})` : ''} is in your bag`);
        app.stamps.earn('tray');
        addBtn.replaceChildren('Added — view your bag');
        addBtn.onclick = () => { api.close(); app.openTray(); };
        setTimeout(() => { if (api.dlg.open) refresh(); }, 2600);
      };
      api.body.addEventListener('selection', refresh);
      refresh();
      foot.append(h('div', { class: 'product__actions' }, addBtn), note);
    },
  });
}

/** Arrow keys move between options inside a radiogroup. */
function radioKeys(group) {
  group.addEventListener('keydown', e => {
    if (!['ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp'].includes(e.key)) return;
    const opts = [...group.querySelectorAll('[role="radio"]:not([disabled])')];
    const i = opts.indexOf(document.activeElement);
    if (i < 0) return;
    e.preventDefault();
    const next = opts[(i + (e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : -1) + opts.length) % opts.length];
    next.focus();
    next.click();
  });
}

export function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
