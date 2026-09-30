import { h } from './dom.js';

// The always-on layer: station caption, dock, counters, toast and screen-reader announcements.

export class Hud {
  constructor(stations) {
    this.stations = stations;
    this.caption = document.getElementById('caption');
    this.eyebrow = this.caption.querySelector('[data-caption-eyebrow]');
    this.title = this.caption.querySelector('[data-caption-title]');
    this.body = this.caption.querySelector('[data-caption-body]');
    this.actions = this.caption.querySelector('[data-caption-actions]');
    this.dockIndex = document.querySelector('[data-dock-index]');
    this.dockName = document.querySelector('[data-dock-name]');
    this.dots = document.querySelector('[data-dock-dots]');
    this.trayCount = document.querySelector('[data-tray-count]');
    this.stampCount = document.querySelector('[data-stamp-count]');
    this.trayButton = document.querySelector('[data-open="tray"]');
    this.toastEl = document.getElementById('toast');
    this.announcer = document.getElementById('announcer');
    this.dots.append(...stations.map(() => h('i')));
  }

  setStation(station, index, actions = [], stamped = new Set()) {
    this.caption.classList.remove('is-shown');
    clearTimeout(this._capT);
    this._capT = setTimeout(() => {
      this.eyebrow.textContent = station.eyebrow;
      this.title.innerHTML = station.title; // authored copy (stations.js), not catalog data
      this.body.textContent = station.body;
      this.actions.replaceChildren(...actions.map(a => a.href
        ? h('a', { class: `pill ${a.primary ? 'pill--dark' : ''}`, href: a.href }, a.label)
        : h('button', { class: `pill ${a.primary ? 'pill--dark' : ''}`, type: 'button', onclick: a.onClick }, a.label)));
      this.caption.classList.add('is-shown');
    }, 260);
    this.dockIndex.textContent = String(index + 1).padStart(2, '0');
    this.dockName.textContent = station.name;
    [...this.dots.children].forEach((d, i) => {
      d.classList.toggle('is-active', i === index);
      d.classList.toggle('is-stamped', i !== index && stamped.has(this.stations[i].stamp));
    });
    this.announce(`${station.name}. ${station.body}`);
  }

  setCounts({ tray, stamps }) {
    if (tray != null) this.#count(this.trayCount, tray, `Your bag, ${tray} ${tray === 1 ? 'item' : 'items'}`, this.trayButton);
    if (stamps != null) this.#count(this.stampCount, stamps);
  }

  #count(el, n, label, button) {
    const prev = Number(el.textContent) || 0;
    el.textContent = n;
    el.classList.toggle('has-count', n > 0);
    if (n > prev) { el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump'); }
    if (button && label) button.setAttribute('aria-label', label);
  }

  toast(message, ms = 2600) {
    this.toastEl.textContent = message;
    this.toastEl.classList.add('is-shown');
    clearTimeout(this._toastT);
    this._toastT = setTimeout(() => this.toastEl.classList.remove('is-shown'), ms);
  }

  announce(message) {
    this.announcer.textContent = '';
    requestAnimationFrame(() => { this.announcer.textContent = message; });
  }
}
