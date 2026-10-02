import * as THREE from 'three';
import { h } from './dom.js';

// HTML buttons pinned to 3D positions. They're the accessible way into the room:
// focusable, labelled, announced — the canvas itself is aria-hidden.

export class Hotspots {
  constructor(container, camera, onActivate) {
    this.container = container;
    this.camera = camera;
    this.onActivate = onActivate;
    this.items = [];
    this.active = [];
    this.visible = false;
    this.v = new THREE.Vector3();
    this.c = new THREE.Vector3();
    this.coarse = matchMedia('(pointer: coarse)').matches;
  }

  setAll(items) { this.items = items; }

  show(stationId) {
    this.hide(true);
    const list = this.items.filter(i => i.station === stationId);
    // Labels always show for wayfinding and small groups; dense displays show dots until hovered/focused.
    const dense = list.length > 5;
    this.container.classList.toggle('show-labels', stationId === 'entrance' || (!dense && (this.coarse || list.length <= 3)));
    this.active = list.map((item, i) => {
      const btn = h('button', {
        class: `hotspot${item.flip ? ' hotspot--flip' : ''}${item.soldOut ? ' hotspot--soldout' : ''}`,
        type: 'button',
        'aria-label': [item.label, item.sub].filter(Boolean).join(', '),
        style: { '--delay': `${(i * 0.35) % 2.8}s` },
        onclick: () => this.onActivate(item.action, item),
      },
      h('span', { class: 'hotspot__dot', 'aria-hidden': 'true' }),
      h('span', { class: 'hotspot__label', 'aria-hidden': 'true' }, item.label, item.sub ? h('small', {}, item.sub) : null));
      this.container.append(btn);
      setTimeout(() => btn.classList.add('is-visible'), 120 + i * 70);
      return { item, btn, label: btn.lastElementChild, labelW: 0, flipped: !!item.flip, edge: null };
    });
    this.visible = true;
    this.update();
  }

  hide(immediate = false) {
    this.visible = false;
    const old = this.active;
    this.active = [];
    for (const { btn } of old) {
      btn.classList.remove('is-visible');
      btn.tabIndex = -1;
      if (immediate) btn.remove();
      else setTimeout(() => btn.remove(), 450);
    }
  }

  update() {
    if (!this.visible) return;
    const w = innerWidth, hgt = innerHeight;
    const edges = { left: [], right: [] };
    for (const a of this.active) {
      const { item, btn } = a;
      this.v.copy(item.position).project(this.camera);
      const off = this.v.z > 1 || Math.abs(this.v.x) > 1.05 || Math.abs(this.v.y) > 1.05;
      if (off && item.edge) {
        // Out of view, but it's a way to go: wait at the nearer side of the screen, pointing.
        this.c.copy(item.position).applyMatrix4(this.camera.matrixWorldInverse);
        edges[this.c.x < 0 ? 'left' : 'right'].push({ a, turn: Math.abs(Math.atan2(this.c.x, -this.c.z)) });
        continue;
      }
      this.#setEdge(a, null);
      if (off) { btn.hidden = true; continue; }
      btn.hidden = false;
      const x = (this.v.x * 0.5 + 0.5) * w;
      const y = (-this.v.y * 0.5 + 0.5) * hgt - 22;
      // Open the label on whichever side of the dot has room for it, so it never runs off the
      // screen (on a phone, a label near the edge used to be cut in half).
      a.labelW ||= a.label.offsetWidth;
      const room = { right: w - x - 16, left: x - 16 };
      let flip = !!item.flip;
      if ((flip ? room.left : room.right) < a.labelW && (flip ? room.right : room.left) > (flip ? room.left : room.right)) flip = !flip;
      this.#setFlip(a, flip);
      btn.style.setProperty('--x', `${x.toFixed(1)}px`);
      btn.style.setProperty('--y', `${y.toFixed(1)}px`);
    }
    // Edge markers take the first free row down their side, nearest turn first, below the top
    // bar — clear of the labels in view and of each other (on a phone both sides meet).
    const all = [...edges.left.map(e => ({ ...e, side: 'left' })), ...edges.right.map(e => ({ ...e, side: 'right' }))];
    if (!all.length) return;
    const taken = this.active.filter(a => !a.btn.hidden && !a.edge && a.btn.classList.contains('is-visible'))
      .map(a => a.label.getBoundingClientRect()).map(r => ({ x0: r.left, x1: r.right, y0: r.top, y1: r.bottom }));
    const top = Math.max(84, hgt * 0.2), step = 8, bottom = hgt * 0.64;
    for (const { a, side } of all.sort((p, q) => p.turn - q.turn)) {
      a.btn.hidden = false;
      this.#setEdge(a, side);
      this.#setFlip(a, side === 'right');
      a.labelW ||= a.label.offsetWidth;
      // The label starts 16 px past the arrow, which sits 34 px in from the edge.
      const lh = a.label.offsetHeight || 44;
      const x0 = side === 'left' ? 50 : w - 50 - a.labelW, x1 = x0 + a.labelW;
      let y = top;
      const clash = yy => taken.some(t => x0 - 6 < t.x1 && t.x0 < x1 + 6 && yy < t.y1 + 6 && t.y0 < yy + lh + 6);
      while (y < bottom && clash(y)) y += step;
      taken.push({ x0, x1, y0: y, y1: y + lh });
      a.btn.style.setProperty('--x', `${side === 'left' ? 34 : w - 34}px`);
      a.btn.style.setProperty('--y', `${(y + lh / 2 - 22).toFixed(1)}px`);
    }
  }

  #setFlip(a, flip) {
    if (flip !== a.flipped) { a.btn.classList.toggle('hotspot--flip', flip); a.flipped = flip; }
  }

  #setEdge(a, side) {
    if (side === a.edge) return;
    a.btn.classList.toggle('hotspot--edge', !!side);
    a.btn.classList.toggle('hotspot--edge-left', side === 'left');
    a.btn.classList.toggle('hotspot--edge-right', side === 'right');
    a.edge = side;
  }
}
