import * as THREE from 'three';
import { CONFIG } from './config.js';
import { Catalog } from './catalog.js';
import { Tray } from './cart.js';
import { StampCard, STAMPS } from './stamps.js';
import { Ambience } from './audio.js';
import { track } from './analytics.js';
import { World, detectQuality, webglAvailable } from './scene/world.js';
import { createMaterials } from './scene/materials.js';
import { buildRoom } from './scene/room.js';
import { buildFurniture } from './scene/furniture.js';
import { Displays } from './scene/displays.js';
import { createFX } from './scene/fx.js';
import { STATIONS, CameraRig } from './scene/stations.js';
import { stoneDataUrl } from './scene/stone.js';
import { Hud } from './ui/hud.js';
import { Hotspots } from './ui/hotspots.js';
import { openDialogs } from './ui/dialogs.js';
import { openProduct } from './ui/product.js';
import { openTray, openMenu, openStamps, openStations, openArchive } from './ui/panels.js';
import { openComposer, savedIncrements } from './ui/composer.js';

const $ = sel => document.querySelector(sel);
const intro = $('#intro');
const status = $('[data-intro-status]');
const enterBtn = $('[data-enter]');

const app = {
  stations: STATIONS,
  tray: new Tray(),
  stamps: new StampCard(),
  audio: new Ambience(),
  hud: new Hud(STATIONS),
  catalog: null,
  world: null,
  rig: null,
  displays: null,
  hotspots: null,
  entered: false,
  openMenu: opts => openMenu(app, opts),
  openTray: () => openTray(app),
  goTo: i => goTo(i),
};
window.__lounge = app; // handy in the console; harmless in production

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------

function progress(p, message) {
  intro.style.setProperty('--progress', p.toFixed(2));
  if (message) status.textContent = message;
}

function windowState() {
  const today = new Date().toISOString().slice(0, 10);
  if (CONFIG.opensOn && today < CONFIG.opensOn) return 'soon';
  if (CONFIG.closesOn && today > CONFIG.closesOn) return 'closed';
  return 'open';
}

async function loadFonts() {
  const faces = ['400 40px "Bodoni Moda"', 'italic 400 40px "Bodoni Moda"', '500 40px "Bodoni Moda"', '26px "Azeret Mono"', '500 26px "Azeret Mono"', '500 40px "Caveat"', '26px "Hanken Grotesk"'];
  const all = Promise.all(faces.map(f => document.fonts.load(f).catch(() => null)));
  await Promise.race([all, new Promise(r => setTimeout(r, 3500))]);
}

async function boot() {
  track('open', { referrer: document.referrer || null });
  try {
    intro.style.setProperty('--stone', `url(${stoneDataUrl(560)})`);
    intro.classList.add('has-stone');
  } catch { /* decorative */ }
  app.hud.setCounts({ tray: app.tray.count, stamps: app.stamps.count });

  const state = windowState();
  progress(0.08, 'Warming the room…');
  const [catalog] = await Promise.all([Catalog.load(), loadFonts()]);
  app.catalog = catalog;
  bindChrome(); // the menu and tray work even while the room is still building

  if (state !== 'open') return showClosed(state);
  if (!webglAvailable()) return showMenuOnly();

  progress(0.3, 'Setting out the cups…');
  await frame();
  const quality = detectQuality();
  const world = app.world = new World($('#scene'), quality);
  const M = createMaterials(world.renderer, quality);
  buildRoom(world.scene, M, quality);
  progress(0.45, 'Laying the travertine…');
  await frame();
  const { anchors } = buildFurniture(world.scene, M, quality);
  const fx = createFX(world.scene, anchors, quality);
  const rig = app.rig = new CameraRig(world);

  progress(0.6, 'Writing up the menu…');
  await frame();
  const displays = app.displays = new Displays(world.scene, M, anchors, catalog);
  const stationCams = Object.fromEntries(STATIONS.map(s => [s.id, s.pos]));
  let imagesDone = 0;
  const imagesReady = displays.build({
    stationCams,
    onProgress: p => { imagesDone = p; progress(0.6 + p * 0.35, p < 1 ? 'Hanging the new chapter…' : 'Ready when you are.'); },
  });
  savedIncrements().forEach((it, i) => displays.pinIncrement(it.text, i));

  const hotspots = app.hotspots = new Hotspots($('#hotspots'), world.camera, onHotspot);
  const start = STATIONS.findIndex(s => `#${s.id}` === location.hash);
  rig.jump(start > 0 ? start : 0);

  // The sun and the room never move, so the shadow map is only re-rendered while pieces
  // are still arriving. Roughly halves the draw calls per frame on phones.
  world.renderer.shadowMap.autoUpdate = false;
  world.renderer.shadowMap.needsUpdate = true;
  world.onFrame.push((dt, t) => {
    rig.update(dt, t);
    displays.update(t, dt);
    fx.update(t);
    hotspots.update();
    if (displays.fadeIns.length || t < 3) world.renderer.shadowMap.needsUpdate = true;
  });
  const syncPixelRatio = () => fx.setPixelRatio(world.renderer.getPixelRatio());
  world.addEventListener('resize', syncPixelRatio);
  world.addEventListener('quality', e => track('quality_change', e.detail));
  syncPixelRatio();

  world.renderer.compile(world.scene, world.camera);
  world.start();
  document.body.classList.add('is-ready');

  // Let people in once the hero pieces are up (or after a few seconds regardless).
  await Promise.race([imagesReady, new Promise(r => setTimeout(r, 4500))]);
  hotspots.setAll(displays.hotspots);
  imagesReady.then(() => hotspots.setAll(displays.hotspots));
  if (imagesDone < 1) progress(0.95, 'Ready when you are.');
  progress(1, 'Ready when you are.');
  intro.classList.add('is-ready');
  enterBtn.disabled = false;
  enterBtn.addEventListener('click', enter, { once: true });
  bindInput();
}

// Yield a frame so the progress UI can paint — with a timeout, because background tabs don't run rAF.
const frame = () => new Promise(r => { const t = setTimeout(r, 60); requestAnimationFrame(() => { clearTimeout(t); r(); }); });

function enter() {
  app.entered = true;
  document.body.classList.remove('is-loading');
  document.body.classList.add('is-entered');
  track('enter', { quality: app.world.quality.tier, station: app.rig.station.id });
  app.stamps.earn('enter');
  if (app.audio.wanted) setSound(true);
  arrive();
  // Move focus into the experience for keyboard users.
  requestAnimationFrame(() => $('.dock__current').focus({ preventScroll: true }));
}

function showClosed(state) {
  track('closed_view', { state });
  const date = state === 'soon' ? CONFIG.opensOn : CONFIG.closesOn;
  const nice = new Date(`${date}T12:00:00`).toLocaleDateString(CONFIG.store.locale, { dateStyle: 'long' });
  $('.intro__title').innerHTML = state === 'soon' ? 'Opening <em>soon</em>' : 'The Lounge has <em>closed</em>';
  $('.intro__line').textContent = state === 'soon'
    ? `The Increments Lounge opens ${nice}. Until then, everything’s at ${CONFIG.store.domain}.`
    : `The Lounge closed on ${nice}. Thanks for stopping by — every chapter is still at ${CONFIG.store.domain}.`;
  progress(1, '');
  intro.classList.add('is-ready');
  enterBtn.disabled = false;
  enterBtn.textContent = `Shop ${CONFIG.store.domain}`;
  enterBtn.onclick = () => { location.href = `https://${CONFIG.store.domain}`; };
}

function showMenuOnly() {
  track('webgl_unavailable');
  progress(1, 'This browser can’t open the 3D lounge — the menu has everything.');
  intro.classList.add('is-ready');
  enterBtn.disabled = false;
  enterBtn.textContent = 'Open the menu';
  enterBtn.onclick = () => openMenu(app);
  $('.intro__alt').hidden = true;
}

// ---------------------------------------------------------------------------
// Stations
// ---------------------------------------------------------------------------

async function goTo(index) {
  const n = STATIONS.length;
  index = ((index % n) + n) % n;
  if (!app.rig || (index === app.rig.index && !app.rig.moving)) return;
  app.hotspots.hide();
  app.hud.caption.classList.remove('is-shown');
  const target = index;
  await app.rig.goTo(index);
  if (app.rig.index === target) arrive();
}

function step(dir) { goTo(app.rig.index + dir); }

function arrive() {
  const s = app.rig.station;
  if (s.stamp) app.stamps.earn(s.stamp);
  app.hud.setStation(s, app.rig.index, captionActions(s), app.stamps.earned);
  setTimeout(() => { if (!app.rig.moving && app.rig.station === s) app.hotspots.show(s.id); }, 350);
  app.audio.cue(s.id);
  track('station_view', { station: s.id });
  history.replaceState(null, '', app.rig.index === 0 ? location.pathname + location.search : `#${s.id}`);
}

function productPills(zone) {
  return app.catalog.zone(zone).filter(p => p.available).slice(0, 3).map((p, i) => ({
    label: `${p.title.replace(/^(Still Becoming|Worn)\s*/, '')} · $${Number.isInteger(p.price) ? p.price : p.price.toFixed(2)}`,
    primary: i === 0,
    onClick: () => openProduct(app, p.handle, { from: 'caption' }),
  }));
}

function captionActions(s) {
  switch (s.id) {
    case 'entrance': return [{ label: 'Open the menu', primary: true, onClick: () => openMenu(app) }, { label: 'Stamp card', onClick: () => openStamps(app) }];
    case 'window': return productPills('window');
    case 'counter': return [{ label: 'Open the menu', primary: true, onClick: () => openMenu(app) }, { label: 'At the till', onClick: () => openMenu(app, { zone: 'till' }) }];
    case 'lounge': return productPills('lounge');
    case 'movement': return [{ label: 'See all Movement', primary: true, onClick: () => openMenu(app, { zone: 'movement' }) }];
    case 'archive': return [{ label: 'Browse the archive', primary: true, onClick: () => openArchive(app) }];
    case 'board': return [{ label: 'Pin your increment', primary: true, onClick: () => openComposer(app) }];
    default: return [];
  }
}

// ---------------------------------------------------------------------------
// Actions from hotspots and 3D picks
// ---------------------------------------------------------------------------

function onHotspot(action) { runAction(action); }

function runAction(action, pickStation) {
  if (!action) return;
  const here = app.rig.station.id;
  const go = id => { const i = STATIONS.findIndex(s => s.id === id); if (i >= 0) goTo(i); };
  switch (action.type || action.kind) {
    case 'product':
      if (pickStation && pickStation !== here) { go(pickStation); return; }
      openProduct(app, action.handle, { colour: action.colour });
      break;
    case 'menu': case 'menuBoard': openMenu(app); break;
    case 'archive':
      if (pickStation && pickStation !== here) { go(pickStation); return; }
      if (action.handle) openProduct(app, action.handle, { from: 'archive' });
      else openArchive(app, { chapter: action.chapter });
      break;
    case 'compose':
      if (pickStation && pickStation !== here) { go(pickStation); return; }
      openComposer(app);
      break;
    case 'station': go(action.id); break;
    default: break;
  }
}

// ---------------------------------------------------------------------------
// Input
// ---------------------------------------------------------------------------

const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();

function pickAt(clientX, clientY) {
  ndc.set((clientX / innerWidth) * 2 - 1, -(clientY / innerHeight) * 2 + 1);
  raycaster.setFromCamera(ndc, app.world.camera);
  const hits = raycaster.intersectObjects(app.world.scene.children, true);
  for (const hit of hits) {
    const o = hit.object;
    if (o.isPoints || o.parent?.name === 'fx') continue;
    const m = Array.isArray(o.material) ? o.material[0] : o.material;
    if (!o.userData.pick && m && m.transparent && m.opacity < 0.5) continue; // glass
    if (!o.userData.pick) return null; // something solid is in the way
    return { pick: o.userData.pick, hit };
  }
  return null;
}

let chromeBound = false;
function bindChrome() {
  if (chromeBound) return;
  chromeBound = true;
  document.addEventListener('click', e => {
    const opener = e.target.closest('[data-open]');
    if (!opener) return;
    e.preventDefault();
    const what = opener.dataset.open;
    if (what === 'menu') openMenu(app);
    if (what === 'tray') openTray(app);
    if (what === 'stamps') openStamps(app);
    if (what === 'stations' && app.rig) openStations(app);
  });
  app.tray.addEventListener('change', () => app.hud.setCounts({ tray: app.tray.count }));
  app.stamps.addEventListener('earn', e => {
    const { id, count, complete } = e.detail;
    app.hud.setCounts({ stamps: count });
    const label = STAMPS.find(s => s.id === id)?.label;
    track('stamp_earned', { id, count });
    if (complete) { track('card_complete'); app.hud.toast(`Card full — ${CONFIG.reward.code ? 'your reward is on the card' : 'small steps, big accomplishments'}.`, 3800); }
    // 'tray' and 'increment' already have their own confirmation toast; the counter bump is enough there.
    else if (!['enter', 'tray', 'increment'].includes(id)) app.hud.toast(`Stamped: ${label} · ${count}/${STAMPS.length}`);
    if (app.rig) {
      [...app.hud.dots.children].forEach((d, i) => d.classList.toggle('is-stamped', i !== app.rig.index && app.stamps.has(STATIONS[i].stamp)));
    }
  });
}

function setSound(on) {
  app.audio.setEnabled(on);
  const btn = $('[data-sound]');
  btn.setAttribute('aria-pressed', String(on));
  btn.setAttribute('aria-label', on ? 'Café sound on' : 'Café sound off');
}

function bindInput() {
  const canvas = $('#scene');

  document.querySelectorAll('[data-step]').forEach(b => b.addEventListener('click', () => step(Number(b.dataset.step))));
  $('[data-sound]').addEventListener('click', () => {
    const on = !app.audio.enabled;
    setSound(on);
    track('sound_toggle', { on });
  });

  // Keyboard.
  document.addEventListener('keydown', e => {
    if (!app.entered || openDialogs().size) return;
    if (e.target instanceof Element && e.target.closest('input, textarea, select, [contenteditable]')) return;
    if (e.key === 'ArrowRight' || e.key === 'PageDown') { e.preventDefault(); step(1); }
    else if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); step(-1); }
    else if (/^[1-7]$/.test(e.key)) goTo(Number(e.key) - 1);
    else if (e.key.toLowerCase() === 'm') openMenu(app);
  });

  // Swipe and tap.
  let down = null;
  canvas.addEventListener('pointerdown', e => { down = { x: e.clientX, y: e.clientY, t: performance.now(), id: e.pointerId }; });
  canvas.addEventListener('pointerup', e => {
    if (!down || down.id !== e.pointerId || !app.entered) { down = null; return; }
    const dx = e.clientX - down.x, dy = e.clientY - down.y, dt = performance.now() - down.t;
    down = null;
    if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy) * 1.3 && dt < 700) { step(dx < 0 ? 1 : -1); return; }
    if (Math.hypot(dx, dy) < 10 && dt < 600) {
      const res = pickAt(e.clientX, e.clientY);
      if (!res) return;
      const { pick, hit } = res;
      if (pick.kind === 'menuBoard' && app.rig.station.id === 'counter') {
        const handle = app.displays.menuRowAt(hit.uv);
        if (handle) { openProduct(app, handle, { from: 'menuBoard' }); return; }
      }
      runAction(pick, pick.station);
    }
  });
  canvas.addEventListener('pointercancel', () => { down = null; });

  // Wheel / trackpad: one notch = one station.
  let acc = 0, lock = 0;
  canvas.addEventListener('wheel', e => {
    if (!app.entered) return;
    e.preventDefault();
    const now = performance.now();
    if (now < lock) return;
    acc += Math.abs(e.deltaY) > Math.abs(e.deltaX) ? e.deltaY : e.deltaX;
    if (Math.abs(acc) > 70) { step(acc > 0 ? 1 : -1); acc = 0; lock = now + 1100; }
  }, { passive: false });

  // Hover cursor.
  let lastHover = 0;
  canvas.addEventListener('pointermove', e => {
    if (e.pointerType !== 'mouse' || !app.entered) return;
    const now = performance.now();
    if (now - lastHover < 70) return;
    lastHover = now;
    document.body.classList.toggle('is-pointer', !!pickAt(e.clientX, e.clientY));
  });

  // Don't burn battery rendering behind a full-screen menu; hush audio in background tabs.
  document.addEventListener('lounge:dialogs', () => {
    app.world.paused = [...openDialogs()].some(d => d.variant === 'full');
  });
  document.addEventListener('visibilitychange', () => {
    if (!app.audio.ctx) return;
    if (document.hidden) app.audio.ctx.suspend();
    else if (app.audio.enabled) app.audio.ctx.resume();
  });
  addEventListener('hashchange', () => {
    const i = STATIONS.findIndex(s => `#${s.id}` === location.hash);
    if (i >= 0 && i !== app.rig.index) goTo(i);
  });
}

boot().catch(err => {
  console.error(err);
  track('boot_error', { message: String(err?.message || err) });
  progress(1, 'Something went wrong opening the Lounge — the menu still works.');
  enterBtn.disabled = false;
  enterBtn.textContent = 'Open the menu';
  enterBtn.onclick = () => (app.catalog ? openMenu(app) : (location.href = `https://${CONFIG.store.domain}`));
  bindChrome();
});
