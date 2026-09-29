import { h, iconEl } from './dom.js';
import { openDialog } from './dialogs.js';
import { travertineTiles } from '../scene/stone.js';
import { wrap } from '../scene/displays.js';
import { CONFIG } from '../config.js';
import { track } from '../analytics.js';

// "Pin your next increment": the visitor writes the next small step they're taking.
// It's pinned to the notice board in the room and rendered as a 1080×1920 story card
// they can share or save. Everything happens on-device; nothing is uploaded.

const KEY = 'increments-lounge:increments';
const MAX = 80;
const PROMPTS = ['Run my first 5K', 'Read ten pages a day', 'Launch the side project', 'Call home on Sundays', 'Save $20 a week', 'Stretch every morning'];

export function savedIncrements() {
  try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch { return []; }
}

export function openComposer(app) {
  let text = '';
  let lastBlob = null;
  openDialog({
    variant: 'center',
    title: 'Your next <em>increment</em>',
    kicker: 'Notice board',
    className: 'composer',
    build(body) {
      const id = 'increment-text';
      const area = h('textarea', { id, maxlength: MAX, rows: 3, placeholder: 'The next small step I’m taking is…', 'aria-describedby': 'increment-count' });
      const count = h('span', { class: 'composer__count', id: 'increment-count' }, `0 / ${MAX}`);
      const canvas = h('canvas', { width: 540, height: 960, 'aria-label': 'Preview of your card', role: 'img' });
      const preview = h('div', { class: 'composer__preview' }, canvas);
      const chips = h('div', { class: 'composer__prompts' }, PROMPTS.map(p => h('button', { class: 'pill', type: 'button', onclick: () => { area.value = p; update(); area.focus(); } }, p)));
      let bgCache = null;
      const update = () => {
        text = area.value.trim().slice(0, MAX);
        count.textContent = `${area.value.length} / ${MAX}`;
        bgCache = bgCache || renderBackground(540, 960);
        drawCard(canvas, text || 'The next small step I’m taking is…', { bg: bgCache, placeholder: !text });
        body.dispatchEvent(new Event('text'));
      };
      area.addEventListener('input', update);
      body.append(h('label', { for: id, class: 'sr-only' }, 'Your next increment'), area, count, chips, preview);
      requestAnimationFrame(update);
    },
    foot(foot, api) {
      const pinBtn = h('button', { class: 'button button--primary button--block', type: 'button', disabled: true }, iconEl('pin'), 'Pin it to the board');
      const shareBtn = h('button', { class: 'button button--block', type: 'button', disabled: true, style: { marginTop: '8px' } }, iconEl('share'), 'Share your card');
      const canShareFiles = !!(navigator.canShare && navigator.share);
      if (!canShareFiles) shareBtn.replaceChildren(iconEl('download'), 'Save your card');
      api.body.addEventListener('text', () => { pinBtn.disabled = !text; shareBtn.disabled = !text; });

      pinBtn.onclick = () => {
        const list = savedIncrements();
        list.push({ text, at: Date.now() });
        try { localStorage.setItem(KEY, JSON.stringify(list.slice(-4))); } catch { /* ignore */ }
        app.displays?.pinIncrement(text, list.length - 1);
        app.stamps.earn('increment');
        track('increment_created', { length: text.length });
        app.hud.toast('Pinned to the board. Small steps.');
        pinBtn.disabled = true;
        pinBtn.replaceChildren(iconEl('check'), 'Pinned');
      };

      shareBtn.onclick = async () => {
        const blob = lastBlob && lastBlob.text === text ? lastBlob.blob : await renderFull(text);
        lastBlob = { text, blob };
        const file = new File([blob], 'my-next-increment.png', { type: 'image/png' });
        if (canShareFiles && navigator.canShare({ files: [file] })) {
          try {
            await navigator.share({ files: [file], title: 'My next increment', text: `My next increment: ${text} — ${CONFIG.store.domain}` });
            track('increment_shared', { method: 'share' });
            app.stamps.earn('increment');
            return;
          } catch (e) { if (e.name === 'AbortError') return; }
        }
        const a = h('a', { href: URL.createObjectURL(blob), download: 'my-next-increment.png' });
        document.body.append(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(a.href), 4000);
        track('increment_shared', { method: 'download' });
        app.stamps.earn('increment');
      };
      foot.append(pinBtn, shareBtn, h('p', { class: 'product__note' }, 'Your card is made on this device — nothing is uploaded.'));
    },
  });
}

function renderBackground(w, hgt) {
  const { map } = travertineTiles({ width: w, height: hgt, cols: 1, rows: 3, bond: 0, grout: Math.max(1.5, w / 540), seed: 27, pits: 1.2 });
  return map;
}

async function renderFull(text) {
  const c = document.createElement('canvas');
  c.width = 1080; c.height = 1920;
  drawCard(c, text, { bg: renderBackground(1080, 1920) });
  return new Promise(res => c.toBlob(res, 'image/png'));
}

/** Draws the story card at any size (layout is authored at 1080×1920 and scaled). */
export function drawCard(canvas, text, { bg, placeholder = false } = {}) {
  const ctx = canvas.getContext('2d');
  const s = canvas.width / 1080;
  ctx.save();
  ctx.scale(s, s);
  const W = 1080, H = 1920;
  ctx.drawImage(bg, 0, 0, W, H);
  const glow = ctx.createRadialGradient(W * 0.3, 0, 100, W * 0.3, 0, H);
  glow.addColorStop(0, 'rgba(255,244,222,0.55)'); glow.addColorStop(1, 'rgba(255,244,222,0)');
  ctx.fillStyle = glow; ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = '#2a1d16';
  ctx.textAlign = 'center';
  ctx.font = '500 58px "Bodoni Moda", serif';
  ctx.letterSpacing = '24px';
  ctx.fillText('INCREMENTS', W / 2 + 12, 220);
  ctx.font = '500 24px "Azeret Mono", monospace';
  ctx.letterSpacing = '8px';
  ctx.fillStyle = '#6c5746';
  ctx.fillText('THE LOUNGE · NOTICE BOARD', W / 2 + 4, 280);
  ctx.letterSpacing = '0px';

  // The note.
  ctx.save();
  ctx.translate(W / 2, 900);
  ctx.rotate(-0.025);
  ctx.shadowColor = 'rgba(42,29,22,0.28)';
  ctx.shadowBlur = 50; ctx.shadowOffsetY = 24;
  ctx.fillStyle = '#fbf7ee';
  ctx.fillRect(-410, -420, 820, 840);
  ctx.shadowColor = 'transparent';
  ctx.fillStyle = '#8c2027';
  ctx.beginPath(); ctx.arc(0, -392, 16, 0, Math.PI * 2); ctx.fill();
  ctx.textAlign = 'left';
  ctx.fillStyle = '#8c2027';
  ctx.font = '500 26px "Azeret Mono", monospace';
  ctx.letterSpacing = '7px';
  ctx.fillText('MY NEXT INCREMENT', -340, -290);
  ctx.letterSpacing = '0px';
  ctx.fillStyle = placeholder ? 'rgba(42,29,22,0.35)' : '#2a1d16';
  const size = text.length > 50 ? 64 : text.length > 28 ? 76 : 92;
  ctx.font = `italic 400 ${size}px "Bodoni Moda", serif`;
  wrap(ctx, text, -340, -170, 680, size * 1.18, 'left');
  ctx.fillStyle = '#7a6656';
  ctx.font = '24px "Azeret Mono", monospace';
  ctx.fillText(new Date().toLocaleDateString(CONFIG.store.locale, { dateStyle: 'long' }).toUpperCase(), -340, 350);
  stamp(ctx, 260, 280, 92);
  ctx.restore();

  ctx.fillStyle = '#2a1d16';
  ctx.textAlign = 'center';
  ctx.font = 'italic 400 60px "Bodoni Moda", serif';
  ctx.fillText('Life unfolds in increments.', W / 2, 1540);
  ctx.fillText('You define your story.', W / 2, 1616);
  ctx.font = '500 28px "Azeret Mono", monospace';
  ctx.letterSpacing = '6px';
  ctx.fillStyle = '#6c5746';
  ctx.fillText(CONFIG.store.domain.toUpperCase(), W / 2 + 3, 1760);
  ctx.letterSpacing = '0px';
  ctx.restore();
}

function stamp(ctx, x, y, r) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-0.2);
  ctx.strokeStyle = 'rgba(163,38,46,0.85)';
  ctx.fillStyle = 'rgba(163,38,46,0.85)';
  ctx.lineWidth = 4;
  ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.stroke();
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(0, 0, r * 0.52, 0, Math.PI * 2); ctx.stroke();
  ctx.font = '500 17px "Azeret Mono", monospace';
  const label = 'INCREMENTS · ONE SMALL STEP · ';
  const step = (Math.PI * 2) / label.length;
  for (let i = 0; i < label.length; i++) {
    ctx.save();
    ctx.rotate(i * step);
    ctx.translate(0, -r * 0.74);
    ctx.textAlign = 'center';
    ctx.fillText(label[i], 0, 6);
    ctx.restore();
  }
  ctx.font = 'italic 52px "Bodoni Moda", serif';
  ctx.textAlign = 'center';
  ctx.fillText('i', 0, 18);
  ctx.restore();
}
