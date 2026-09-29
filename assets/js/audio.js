// Café ambience, synthesised live with Web Audio — no audio files to download.
// Room tone, a low murmur, the odd cup on a saucer, and the steam wand when you
// reach the counter. Off by default; the visitor turns it on.

const KEY = 'increments-lounge:sound';

export class Ambience {
  constructor() {
    this.ctx = null;
    this.enabled = false;
    this.wanted = (() => { try { return localStorage.getItem(KEY) === 'on'; } catch { return false; } })();
    this._clinkTimer = null;
  }

  async setEnabled(on) {
    this.enabled = on;
    try { localStorage.setItem(KEY, on ? 'on' : 'off'); } catch { /* ignore */ }
    if (on) {
      if (!this.ctx) this.#build();
      await this.ctx.resume();
      this.master.gain.cancelScheduledValues(this.ctx.currentTime);
      this.master.gain.setTargetAtTime(0.9, this.ctx.currentTime, 0.6);
      this.#scheduleClink();
    } else if (this.ctx) {
      this.master.gain.setTargetAtTime(0, this.ctx.currentTime, 0.25);
      clearTimeout(this._clinkTimer);
    }
  }

  /** Called on every station arrival. */
  cue(stationId) {
    if (!this.enabled || !this.ctx) return;
    if (stationId === 'counter') this.#steam();
    if (stationId === 'archive') this.#page();
  }

  #build() {
    const ctx = this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.master = ctx.createGain();
    this.master.gain.value = 0;
    // Gentle bus compression keeps clinks from poking out on phone speakers.
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -24; comp.ratio.value = 3;
    this.master.connect(comp).connect(ctx.destination);

    this.noise = this.#noiseBuffer(4);

    // Room tone: brown-ish noise, low-passed.
    const room = this.#loop(this.noise);
    const roomLp = ctx.createBiquadFilter(); roomLp.type = 'lowpass'; roomLp.frequency.value = 420;
    const roomGain = ctx.createGain(); roomGain.gain.value = 0.22;
    room.connect(roomLp).connect(roomGain).connect(this.master);

    // Murmur: band-passed noise with a slow, uneven swell — reads as distant voices.
    const mur = this.#loop(this.noise, 1.3);
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 520; bp.Q.value = 0.9;
    const murGain = ctx.createGain(); murGain.gain.value = 0.05;
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.13;
    const lfoGain = ctx.createGain(); lfoGain.gain.value = 0.035;
    lfo.connect(lfoGain).connect(murGain.gain);
    const lfo2 = ctx.createOscillator(); lfo2.frequency.value = 0.41;
    const lfo2Gain = ctx.createGain(); lfo2Gain.gain.value = 180;
    lfo2.connect(lfo2Gain).connect(bp.frequency);
    mur.connect(bp).connect(murGain).connect(this.master);
    lfo.start(); lfo2.start();
  }

  #noiseBuffer(seconds) {
    const ctx = this.ctx;
    const buf = ctx.createBuffer(2, ctx.sampleRate * seconds, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      let last = 0;
      for (let i = 0; i < d.length; i++) {
        const white = Math.random() * 2 - 1;
        last = (last + 0.02 * white) / 1.02; // leaky integrator → brown noise
        d[i] = last * 3.2;
      }
    }
    return buf;
  }

  #loop(buffer, rate = 1) {
    const src = this.ctx.createBufferSource();
    src.buffer = buffer; src.loop = true; src.playbackRate.value = rate;
    src.start(0, Math.random() * buffer.duration);
    return src;
  }

  #scheduleClink() {
    clearTimeout(this._clinkTimer);
    this._clinkTimer = setTimeout(() => {
      if (!this.enabled) return;
      this.#clink();
      this.#scheduleClink();
    }, 3500 + Math.random() * 8000);
  }

  // Ceramic cup on a saucer: a few inharmonic partials with a fast decay.
  #clink() {
    const ctx = this.ctx, t = ctx.currentTime;
    const pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    const out = ctx.createGain(); out.gain.value = 0.05 + Math.random() * 0.04;
    if (pan) { pan.pan.value = Math.random() * 1.6 - 0.8; out.connect(pan).connect(this.master); }
    else out.connect(this.master);
    const base = 1800 + Math.random() * 900;
    [1, 1.62, 2.41, 3.37].forEach((mult, k) => {
      const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = base * mult;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.5 / (k + 1), t + 0.004);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.25 + Math.random() * 0.25);
      o.connect(g).connect(out);
      o.start(t); o.stop(t + 0.6);
    });
    if (Math.random() < 0.35) setTimeout(() => this.enabled && this.#clink(), 140 + Math.random() * 120);
  }

  // Steam wand: filtered noise swelling in and tailing off.
  #steam() {
    const ctx = this.ctx, t = ctx.currentTime;
    const src = ctx.createBufferSource(); src.buffer = this.noise; src.playbackRate.value = 4;
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 2400;
    const pk = ctx.createBiquadFilter(); pk.type = 'peaking'; pk.frequency.value = 5200; pk.gain.value = 8;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.12, t + 0.35);
    g.gain.setValueAtTime(0.12, t + 1.2);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 2.2);
    src.connect(hp).connect(pk).connect(g).connect(this.master);
    src.start(t); src.stop(t + 2.3);
  }

  // A page turning, for the archive.
  #page() {
    const ctx = this.ctx, t = ctx.currentTime;
    const src = ctx.createBufferSource(); src.buffer = this.noise; src.playbackRate.value = 2.5;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 3000; bp.Q.value = 0.6;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.07, t + 0.06);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.38);
    src.connect(bp).connect(g).connect(this.master);
    src.start(t); src.stop(t + 0.4);
  }
}
