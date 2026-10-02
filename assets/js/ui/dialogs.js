import { h, ICONS } from './dom.js';

// Native <dialog> + showModal(): focus is trapped, Esc closes, the page behind is inert.
// Variants: 'sheet' (bottom sheet on phones, side panel on desktop), 'center', 'full'.

const open = new Set();
export const openDialogs = () => open;

export function openDialog({ variant = 'sheet', title, kicker, className = '', build, foot, onClose, label }) {
  const titleId = `dlg-${Math.random().toString(36).slice(2, 8)}`;
  const dlg = h('dialog', { class: `dialog--${variant} ${className}`, 'aria-labelledby': title ? titleId : null, 'aria-label': title ? null : label });
  const panel = h('div', { class: 'panel' });
  if (variant === 'sheet') panel.append(h('button', { class: 'sheet-grip', type: 'button', 'aria-label': 'Close', tabindex: '-1' }));
  if (title) {
    panel.append(h('header', { class: 'panel__head' },
      h('div', {}, kicker ? h('p', { class: 'panel__kicker' }, kicker) : null, h('h2', { class: 'panel__title', id: titleId, html: title })),
      h('button', { class: 'close', type: 'button', 'aria-label': 'Close', html: ICONS.close }),
    ));
  }
  const body = h('div', { class: 'panel__body' });
  panel.append(body);
  let footEl = null;
  if (foot) { footEl = h('footer', { class: 'panel__foot' }); panel.append(footEl); }
  dlg.append(panel);

  let resolveClosed;
  const closed = new Promise(r => { resolveClosed = r; });
  let finished = false;
  const done = () => {
    if (finished) return;
    finished = true;
    if (dlg.open) dlg.close();
    dlg.remove();
    open.delete(api);
    onClose?.();
    resolveClosed();
    document.dispatchEvent(new CustomEvent('lounge:dialogs'));
  };
  const close = () => {
    if (dlg.classList.contains('is-closing') || !dlg.open) return;
    dlg.classList.add('is-closing');
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) done();
    else { dlg.addEventListener('animationend', done, { once: true }); setTimeout(done, 420); }
  };

  dlg.addEventListener('cancel', e => { e.preventDefault(); close(); });
  // Browsers sometimes close a dialog themselves (Chrome lets a second Esc through without a
  // cancel event); tidy up all the same, or the room stays paused and the keys stay dead.
  dlg.addEventListener('close', done);
  const openedAt = performance.now();
  dlg.addEventListener('click', e => {
    if (e.target === dlg && performance.now() - openedAt > 400) close(); // not the 2nd click of the tap that opened it
    if (e.target.closest('.close')) close();
  });
  if (variant === 'sheet') enableDrag(dlg, panel.querySelector('.sheet-grip'), close);

  const api = { dlg, body, foot: footEl, close, closed, variant };
  build?.(body, api);
  foot?.(footEl, api);
  document.getElementById('layer').append(dlg);
  dlg.showModal();
  open.add(api);
  document.dispatchEvent(new CustomEvent('lounge:dialogs'));
  // Don't auto-focus the close button on touch devices — it pops the focus ring for no reason.
  if (matchMedia('(pointer: coarse)').matches) dlg.querySelector('.panel__body')?.focus?.();
  return api;
}

export function closeAll() {
  for (const d of [...open]) d.close();
}

function enableDrag(dlg, grip, close) {
  if (!grip) return;
  let startY = 0, dy = 0, dragging = false;
  grip.addEventListener('pointerdown', e => {
    dragging = true; startY = e.clientY; dy = 0;
    grip.setPointerCapture(e.pointerId);
    dlg.style.transition = 'none';
  });
  grip.addEventListener('pointermove', e => {
    if (!dragging) return;
    dy = Math.max(0, e.clientY - startY);
    dlg.style.transform = `translateY(${dy}px)`;
  });
  const end = () => {
    if (!dragging) return;
    dragging = false;
    dlg.style.transition = 'transform 0.3s cubic-bezier(0.22, 1, 0.36, 1)';
    if (dy > 110) { dlg.style.transform = 'translateY(100%)'; setTimeout(close, 180); }
    else if (dy < 6) { dlg.style.transform = ''; close(); }
    else dlg.style.transform = '';
  };
  grip.addEventListener('pointerup', end);
  grip.addEventListener('pointercancel', end);
}
