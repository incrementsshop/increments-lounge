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
      return { item, btn, label: btn.lastElementChild, labelW: 0, flipped: !!item.flip };
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
    for (const a of this.active) {
      const { item, btn } = a;
      this.v.copy(item.position).project(this.camera);
      const off = this.v.z > 1 || Math.abs(this.v.x) > 1.05 || Math.abs(this.v.y) > 1.05;
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
      if (flip !== a.flipped) { btn.classList.toggle('hotspot--flip', flip); a.flipped = flip; }
      btn.style.setProperty('--x', `${x.toFixed(1)}px`);
      btn.style.setProperty('--y', `${y.toFixed(1)}px`);
    }
  }
}
