// The stamp card: eight increments. It's the brand name made literal — every small
// step through the Lounge earns one.

const KEY = 'increments-lounge:stamps:v1';

export const STAMPS = [
  { id: 'enter',     label: 'Step inside' },
  { id: 'window',    label: 'The Steps' },
  { id: 'movement',  label: 'Movement' },
  { id: 'counter',   label: 'The Collection' },
  { id: 'archive',   label: 'The Archive' },
  { id: 'lounge',    label: 'The Lounge' },
  { id: 'tray',      label: 'Order something' },
  { id: 'increment', label: 'Pin your increment' },
];

export class StampCard extends EventTarget {
  constructor() {
    super();
    try { this.earned = new Set(JSON.parse(localStorage.getItem(KEY)) || []); }
    catch { this.earned = new Set(); }
  }

  get count() { return this.earned.size; }
  get total() { return STAMPS.length; }
  get complete() { return this.count >= this.total; }
  has(id) { return this.earned.has(id); }

  earn(id) {
    if (!STAMPS.some(s => s.id === id) || this.earned.has(id)) return false;
    this.earned.add(id);
    try { localStorage.setItem(KEY, JSON.stringify([...this.earned])); } catch { /* memory only */ }
    this.dispatchEvent(new CustomEvent('earn', { detail: { id, count: this.count, complete: this.complete } }));
    return true;
  }
}
