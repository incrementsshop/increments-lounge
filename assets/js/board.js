import { CONFIG } from './config.js';

// The shared notice board. Visitors' notes go to a small Supabase table (Postgres behind a
// REST API) as "pending"; the Increments team approves them in the Supabase dashboard,
// and only approved notes are ever served back. Row-level security enforces that on the
// server — the key in config.js is the public "anon" key and can do nothing else.
//
// Not configured? The board still works on each visitor's own device (their notes only).
// Add ?boardDemo to the URL to preview the board filled with clearly-labelled sample notes.
// Setup: docs/BOARD.md.

const SENT_KEY = 'increments-lounge:shared';
const DAILY_LIMIT = 3;
const LINKISH = /(https?:\/\/|www\.|\b[a-z0-9-]+\.(com|ca|net|org|io|co|app|me|ly|gg|xyz)\b|@|\bdot\s?com\b)/i;
const PHONEISH = /(\d[\s.-]?){7,}/;

export const NOTE_LIMITS = { text: [3, 80], name: 24, city: 32 };

const SAMPLES = [
  ['Run my first 10K before the leaves turn', 'Sample', 'Toronto'],
  ['Read ten pages every night, no phone', 'Sample', 'Montréal'],
  ['Call my grandmother every Sunday', 'Sample', ''],
  ['Finally sign up for the pottery class', 'Sample', 'Vancouver'],
  ['Stretch for five minutes when I wake up', 'Sample', 'Calgary'],
  ['Save $25 a week for the trip', 'Sample', ''],
  ['Say yes to the new role', 'Sample', 'Ottawa'],
].map(([text, name, city], i) => ({ id: `sample-${i}`, text, name, city, at: Date.now() - i * 36e5 * 7, sample: true }));

export class Board {
  constructor(config = CONFIG.board || {}) {
    this.config = config;
    this.demo = new URLSearchParams(location.search).has('boardDemo');
    this.notes = null;
  }

  /** True when notes can be shared beyond this device. */
  get shared() { return !!(this.config.supabaseUrl && this.config.anonKey) || this.demo; }

  #endpoint(query = '') {
    return `${this.config.supabaseUrl.replace(/\/$/, '')}/rest/v1/${this.config.table || 'increments'}${query}`;
  }

  #headers(extra = {}) {
    const key = this.config.anonKey;
    // Legacy anon keys are JWTs and also go in Authorization; the newer publishable keys
    // (sb_publishable_…) belong in `apikey` alone.
    return { apikey: key, ...(key.startsWith('eyJ') ? { Authorization: `Bearer ${key}` } : {}), ...extra };
  }

  /** Approved notes, newest first. Never throws: a quiet empty board beats an error. */
  async list({ limit = 24 } = {}) {
    if (this.notes) return this.notes;
    if (this.demo) return (this.notes = SAMPLES);
    if (!this.shared) return (this.notes = []);
    try {
      const res = await timeout(fetch(this.#endpoint(`?select=id,text,name,city,created_at&status=eq.approved&order=created_at.desc&limit=${limit}`), { headers: this.#headers() }), 6000);
      if (!res.ok) throw new Error(`board ${res.status}`);
      const rows = await res.json();
      this.notes = rows.map(r => ({ id: r.id, text: clean(r.text), name: clean(r.name || ''), city: clean(r.city || ''), at: Date.parse(r.created_at) || Date.now() }));
    } catch (err) {
      console.warn('[lounge] board', err);
      this.notes = [];
    }
    return this.notes;
  }

  /** How many more notes this device may send today. */
  get remainingToday() {
    const day = new Date().toISOString().slice(0, 10);
    const log = readSent().filter(d => d === day);
    return Math.max(0, DAILY_LIMIT - log.length);
  }

  /**
   * Sends a note for review. Resolves { ok: true } or { ok: false, error } with a message
   * that's safe to show the visitor.
   */
  async submit(note) {
    const problem = validateNote(note);
    if (problem) return { ok: false, error: problem };
    if (!this.remainingToday) return { ok: false, error: 'That’s three notes today — come back tomorrow for another.' };
    const body = { text: clean(note.text), name: clean(note.name || '') || null, city: clean(note.city || '') || null };
    if (this.demo) { markSent(); return { ok: true, demo: true }; }
    if (!this.shared) return { ok: false, error: 'The shared board isn’t switched on yet.' };
    try {
      const res = await timeout(fetch(this.#endpoint(), {
        method: 'POST',
        headers: this.#headers({ 'Content-Type': 'application/json', Prefer: 'return=minimal' }),
        body: JSON.stringify(body),
      }), 8000);
      if (!res.ok) {
        const detail = await res.json().catch(() => ({}));
        // The database's own guard (rate limit, board full) raises a friendly message.
        if (detail?.code === 'P0001' && detail.message) return { ok: false, error: detail.message };
        throw new Error(`board ${res.status} ${detail?.message || ''}`);
      }
      markSent();
      return { ok: true };
    } catch (err) {
      console.warn('[lounge] board submit', err);
      return { ok: false, error: 'We couldn’t reach the board just now. Your note is still pinned on your screen.' };
    }
  }
}

/** Client-side checks; the database repeats the important ones. */
export function validateNote({ text = '', name = '', city = '' }) {
  const t = clean(text);
  if (t.length < NOTE_LIMITS.text[0]) return 'Write a few words first.';
  if (t.length > NOTE_LIMITS.text[1]) return `Keep it under ${NOTE_LIMITS.text[1]} characters.`;
  for (const v of [t, name, city]) {
    if (LINKISH.test(v)) return 'No links, emails or handles, please — just the step.';
    if (PHONEISH.test(v)) return 'No phone numbers, please.';
  }
  if (/(.)\1{5,}/.test(t)) return 'That looks like a typo — try again?';
  if (clean(name).length > NOTE_LIMITS.name) return 'First name only, please.';
  if (clean(city).length > NOTE_LIMITS.city) return 'Just the city, please.';
  return null;
}

function clean(s) {
  return String(s).replace(/[\u0000-\u001f\u007f​-‏‪-‮]/g, '').replace(/\s+/g, ' ').trim();
}

function readSent() {
  try { return JSON.parse(localStorage.getItem(SENT_KEY)) || []; } catch { return []; }
}

function markSent() {
  const day = new Date().toISOString().slice(0, 10);
  const log = readSent().filter(d => d === day);
  log.push(day);
  try { localStorage.setItem(SENT_KEY, JSON.stringify(log)); } catch { /* ignore */ }
}

function timeout(promise, ms) {
  return Promise.race([promise, new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms))]);
}
