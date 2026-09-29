// Tiny DOM helpers. Catalog text always goes in as text nodes (never innerHTML);
// `html:` is reserved for strings authored in this codebase (icons, station titles).

export function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'html') el.innerHTML = v;
    else if (k === 'style' && typeof v === 'object') {
      for (const [prop, val] of Object.entries(v)) {
        if (prop.startsWith('--')) el.style.setProperty(prop, val); // custom properties need setProperty
        else el.style[prop] = val;
      }
    }
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (v === true) el.setAttribute(k, '');
    else el.setAttribute(k, String(v));
  }
  for (const c of children.flat(Infinity)) {
    if (c == null || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

export const ICONS = {
  close: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  arrow: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
  share: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 15V4M8 8l4-4 4 4M5 13v6h14v-6"/></svg>',
  download: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v11M8 11l4 4 4-4M5 19h14"/></svg>',
  pin: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21v-7M8 3h8l-1 6 3 3H6l3-3z"/></svg>',
  check: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
};

export function iconEl(name) {
  const span = document.createElement('span');
  span.innerHTML = ICONS[name];
  return span.firstElementChild;
}

/** Scarlet ink stamp used on the stamp card and the station list. */
export const STAMP_SVG = `<svg viewBox="0 0 100 100" aria-hidden="true">
  <defs><path id="stamp-arc" d="M50 50 m-34 0 a34 34 0 1 1 68 0 a34 34 0 1 1 -68 0"/></defs>
  <circle cx="50" cy="50" r="45" fill="none" stroke="#a3262e" stroke-width="3"/>
  <circle cx="50" cy="50" r="24" fill="none" stroke="#a3262e" stroke-width="1.5"/>
  <text font-family="Azeret Mono, monospace" font-size="9.5" letter-spacing="2.2" fill="#a3262e"><textPath href="#stamp-arc">INCREMENTS · ONE SMALL STEP ·</textPath></text>
  <text x="50" y="57" text-anchor="middle" font-family="Bodoni Moda, serif" font-style="italic" font-size="22" fill="#a3262e">i</text>
</svg>`;
