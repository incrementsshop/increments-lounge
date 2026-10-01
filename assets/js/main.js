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
import { Lighting, resolveTime, savedTimePreference } from './scene/lighting.js';
import { Lightmaps } from './scene/lightmaps.js';
import { stoneDataUrl } from './scene/stone.js';
import { Hud } from './ui/hud.js';
import { Hotspots } from './ui/hotspots.js';
import { openDialogs } from './ui/dialogs.js';
import { openProduct } from './ui/product.js';
import { openTray, openMenu, openStamps, openStations, openArchive } from './ui/panels.js';
import { openComposer, savedIncrements } from './ui/composer.js';
import { openAtmosphere } from './ui/atmosphere.js';
import { maybeAskConsent } from './ui/consent.js';
import { openBoardPanel } from './ui/boardpanel.js';
import { Board } from './board.js';
import { batchStatic, objectsIn } from './scene/batch.js';

const $ = sel => document.querySelector(sel);
const intro = $('#intro');
const status = $('[data-intro-status]');
const enterBtn = $('[data-enter]');

const app = {
  stations: STATIONS,
  tray: new Tray(),
  stamps: new StampCard(),
  audio: new Ambience(),
  board: new Board(),
  hud: new Hud(STATIONS),
  catalog: null,
  world: null,
  rig: null,
  displays: null,
  hotspots: null,
  lighting: null,
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
  bindChrome(); // the collection and bag work even while the room is still building

  if (state !== 'open') return showClosed(state);
  if (!webglAvailable()) return showMenuOnly();

  progress(0.3, 'Dimming the lights…');
  await frame();
  const quality = detectQuality();
  const world = app.world = new World($('#scene'), quality);
  const M = createMaterials(world.renderer, quality);
  const room = buildRoom(world.scene, M, quality);
  progress(0.45, 'Laying the travertine…');
  await frame();
  const { root: furnitureRoot, anchors } = buildFurniture(world.scene, M, quality);
  const fx = createFX(world.scene, { ...anchors, ...room.anchors }, quality);
  const rig = app.rig = new CameraRig(world);

  // Time of day, with the room's pre-calculated light where a bake exists.
  progress(0.52, 'Opening the blinds…');
  const lightmaps = new Lightmaps(room.receivers, world.scene);
  const lighting = app.lighting = new Lighting({ world, room, anchors, fx, lightmaps, glows: [...room.glows, ...anchors.glows] });
  app.door = anchors.door;
  app.street = anchors.street;

  // Fold every static piece that shares a material into one mesh: far fewer draw calls.
  const receivers = [room.receivers.floor, room.receivers.slab, ...Object.values(room.receivers.walls), ...room.receivers.corners];
  const batched = batchStatic([room.root, furnitureRoot], { exclude: [...receivers, ...objectsIn(anchors)] });
  world.scene.add(batched.group);
  app.occluders = [...batched.group.children, ...receivers];
  if (CONFIG.analytics.debug) console.info('[lounge] static batching', batched.stats);
  await lightmaps.init();
  await lighting.apply(resolveTime(), { instant: true });

  progress(0.6, 'Carving the collection…');
  await frame();
  const displays = app.displays = new Displays(world.scene, M, anchors, catalog);
  const stationCams = Object.fromEntries(STATIONS.map(s => [s.id, s.pos]));
  let imagesDone = 0;
  const imagesReady = displays.build({
    stationCams,
    onProgress: p => { imagesDone = p; progress(0.6 + p * 0.35, p < 1 ? 'Hanging the new chapter…' : 'Ready when you are.'); },
  });
  savedIncrements().forEach(it => displays.pinIncrement(it.text));
  app.board.list().then(notes => displays.setCommunity(notes, { shared: app.board.shared }));

  const hotspots = app.hotspots = new Hotspots($('#hotspots'), world.camera, onHotspot);
  // Deep links go straight to their station; everyone else arrives on the street outside.
  const start = STATIONS.findIndex(s => `#${s.id}` === location.hash);
  if (start > 0) rig.jump(start);
  else { rig.street(); intro.classList.add('is-street'); }

  // The sun and the room never move, so the shadow map is only re-rendered while pieces
  // are still arriving. Roughly halves the draw calls per frame on phones.
  world.renderer.shadowMap.autoUpdate = false;
  world.renderer.shadowMap.needsUpdate = true;
  world.onFrame.push((dt, t) => {
    walkFrame();
    rig.update(dt, t);
    displays.update(t, dt);
    fx.update(t);
    lighting.update(dt);
    hotspots.update();
    if (displays.fadeIns.length || t < 3 || rig.tween?.path) world.renderer.shadowMap.needsUpdate = true;
  });
  // Following the visitor's clock: if the hour tips over while they're here, so does the room.
  setInterval(() => {
    if (savedTimePreference() !== 'auto') return;
    const t = resolveTime();
    if (t !== lighting.current) lighting.apply(t);
  }, 60_000);
  const syncPixelRatio = () => fx.setPixelRatio(world.renderer.getPixelRatio());
  world.addEventListener('resize', syncPixelRatio);
  world.addEventListener('quality', e => track('quality_change', e.detail));
  syncPixelRatio();

  world.renderer.compile(world.scene, world.camera);
  world.frameSkip = 2; // half rate behind the intro; full rate from "Step inside"
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

async function enter() {
  app.entered = true;
  app.world.frameSkip = 1;
  document.body.classList.remove('is-loading');
  document.body.classList.add('is-entered');
  track('enter', { quality: app.world.quality.tier, station: app.rig.station.id, from: app.rig.outside ? 'street' : 'link' });
  app.stamps.earn('enter');
  if (app.audio.wanted) setSound(true);
  // Move focus into the experience for keyboard users.
  requestAnimationFrame(() => $('.dock__current').focus({ preventScroll: true }));
  if (app.rig.outside) {
    await app.rig.walkIn({ via: app.street, onProgress: swingDoor });
    swingDoor(1);
    if (app.rig.index !== 0 || app.rig.moving) { lookHint(); maybeAskConsent(); return; } // they moved on mid-walk
  }
  arrive();
  lookHint();
  maybeAskConsent();
}

/** The door opens as you reach it and closes once you're in. */
function swingDoor(t) {
  const d = app.door;
  if (!d) return;
  const s = x => x * x * (3 - 2 * x);
  const open = t < 0.14 ? 0 : t < 0.42 ? s((t - 0.14) / 0.28) : t < 0.7 ? 1 : t < 0.96 ? 1 - s((t - 0.7) / 0.26) : 0;
  d.set(open);
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
  progress(1, 'This browser can’t open the 3D lounge — the collection has everything.');
  intro.classList.add('is-ready');
  enterBtn.disabled = false;
  enterBtn.textContent = 'See the collection';
  enterBtn.onclick = () => openMenu(app);
  $('.intro__alt').hidden = true;
}

// ---------------------------------------------------------------------------
// Stations
// ---------------------------------------------------------------------------

async function goTo(index, opts) {
  const n = STATIONS.length;
  index = ((index % n) + n) % n;
  if (!app.rig || (index === app.rig.index && !app.rig.moving && !app.rig.focused)) return;
  app.hotspots.hide();
  app.hud.caption.classList.remove('is-shown');
  const target = index;
  await app.rig.goTo(index, opts);
  if (app.rig.index === target && !app.rig.moving) arrive();
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
    case 'entrance': return [{ label: 'Take the walk', primary: true, onClick: () => startWalk() }, { label: 'Shop the collection', onClick: () => openMenu(app) }, { label: 'Stamp card', onClick: () => openStamps(app) }];
    case 'window': return productPills('window');
    case 'counter': return [{ label: 'Shop the collection', primary: true, onClick: () => openMenu(app) }, { label: 'At the till', onClick: () => openMenu(app, { zone: 'till' }) }];
    case 'lounge': return productPills('lounge');
    case 'movement': return [{ label: 'See all Movement', primary: true, onClick: () => openMenu(app, { zone: 'movement' }) }];
    case 'archive': return [{ label: 'Browse the archive', primary: true, onClick: () => openArchive(app) }];
    case 'board': return [{ label: 'Pin your increment', primary: true, onClick: () => openComposer(app) }, { label: 'Read the board', onClick: () => openBoardPanel(app, { openComposer }) }];
    default: return [];
  }
}

// ---------------------------------------------------------------------------
// Actions from hotspots and 3D picks
// ---------------------------------------------------------------------------

function onHotspot(action, item) {
  stopWalk('hotspot');
  runAction(action, null, item?.target ? { object: item.target } : item ? { point: item.position } : null);
}

/** `from` is what was touched: { object, normal } from a 3D pick, or a hotspot's target. */
function runAction(action, pickStation, from) {
  if (!action) return;
  const here = app.rig.station.id;
  const go = id => { const i = STATIONS.findIndex(s => s.id === id); if (i >= 0) goTo(i); };
  switch (action.type || action.kind) {
    case 'product':
      if (pickStation && pickStation !== here) { go(pickStation); return; }
      leanIn(from, lean => openProduct(app, action.handle, { colour: action.colour, lean }));
      break;
    case 'menu': case 'menuBoard': openMenu(app); break;
    case 'archive':
      if (pickStation && pickStation !== here) { go(pickStation); return; }
      if (action.handle) leanIn(from, lean => openProduct(app, action.handle, { from: 'archive', lean }));
      else openArchive(app, { chapter: action.chapter });
      break;
    case 'compose':
      if (pickStation && pickStation !== here) { go(pickStation); return; }
      openComposer(app);
      break;
    case 'board':
      if (pickStation && pickStation !== here) { go(pickStation); return; }
      openBoardPanel(app, { openComposer });
      break;
    case 'station': go(action.id); break;
    default: break;
  }
}

// ---------------------------------------------------------------------------
// Lean in: step up to a piece, then open its details beside it
// ---------------------------------------------------------------------------

const _box = new THREE.Box3();

async function leanIn(from, open) {
  const rig = app.rig;
  if (!from || !rig || rig.moving) { open(); return; }
  let point, dims;
  if (from.object) {
    _box.setFromObject(from.object);
    point = _box.getCenter(new THREE.Vector3());
    dims = _box.getSize(new THREE.Vector3()).clampScalar(0.2, 1.6);
  } else if (from.point) point = from.point.clone();
  if (!point) { open(); return; }
  const normal = from.normal || new THREE.Vector3(...rig.station.pos).sub(point);

  app.hotspots.hide();
  document.body.classList.add('is-leaning');
  const arrived = rig.focusOn(point, normal, { dims });
  await Promise.race([arrived, new Promise(r => setTimeout(r, 520))]);
  const dlg = open(true);
  track('lean_in', { station: rig.station.id });
  if (!dlg) { stepBack(); return; }
  await dlg.closed;
  stepBack();
}

async function stepBack() {
  const rig = app.rig;
  document.body.classList.remove('is-leaning');
  if (!rig.focused) return;
  const station = rig.station;
  await rig.unfocus();
  if (!rig.focused && !rig.moving && rig.station === station && !openDialogs().size) app.hotspots.show(station.id);
}

// ---------------------------------------------------------------------------
// The walk: a slow, guided loop through every station
// ---------------------------------------------------------------------------

const walk = { active: false, token: 0, leg: 0, legs: STATIONS.length - 1, dwellStart: 0, dwellMs: 0, wake: null };
const WALK_DWELL = 6800;
const WALK_PUSH = 0.42;

async function startWalk() {
  if (walk.active || !app.rig) return;
  const token = ++walk.token;
  walk.active = true;
  document.body.classList.add('is-walking');
  const bar = $('[data-walkbar]');
  bar.hidden = false;
  requestAnimationFrame(() => bar.classList.add('is-shown'));
  track('walk_start', { from: app.rig.station.id });
  app.hud.announce('The walk has started. Press Stop, or any key, to look around on your own.');

  const start = app.rig.index;
  for (let leg = 1; leg <= walk.legs; leg++) {
    walk.leg = leg;
    walk.dwellStart = 0;
    $('[data-walk-step]').textContent = `${String(leg).padStart(2, '0')} / ${String(walk.legs).padStart(2, '0')}`;
    await goTo(start + leg, { slow: 1.7 });
    if (token !== walk.token) return;
    walk.dwellMs = WALK_DWELL + (leg === walk.legs ? 1200 : 0);
    walk.dwellStart = performance.now();
    await new Promise(r => { walk.wake = r; setTimeout(r, walk.dwellMs); });
    if (token !== walk.token) return;
  }
  endWalk('complete');
}

function stopWalk(reason) { if (walk.active) endWalk(reason); }

function endWalk(reason) {
  walk.token++;
  walk.active = false;
  walk.dwellStart = 0;
  walk.wake?.();
  document.body.classList.remove('is-walking');
  const bar = $('[data-walkbar]');
  bar.classList.remove('is-shown');
  setTimeout(() => { if (!walk.active) bar.hidden = true; }, 500);
  track('walk_end', { reason, leg: walk.leg });
  if (reason === 'complete') app.hud.toast('That’s the walk. Take your time — everything stays where it is.', 3600);
}

/** Runs every frame: the slow push-in while the walk lingers, and the progress line. */
function walkFrame() {
  if (!walk.active) return;
  let f = 0;
  if (walk.dwellStart) {
    f = Math.min(1, (performance.now() - walk.dwellStart) / walk.dwellMs);
    if (!reduceMotion()) app.rig.push = WALK_PUSH * (f * f * (3 - 2 * f));
  }
  $('[data-walk-progress]').style.setProperty('--p', ((walk.leg - 1 + f) / walk.legs).toFixed(3));
}

const reduceMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

// ---------------------------------------------------------------------------
// Atmosphere & sound
// ---------------------------------------------------------------------------

function setTime(name) {
  if (!app.lighting || name === app.lighting.current) return;
  app.lighting.apply(name);
}

function setSound(on) {
  app.audio.setEnabled(on);
  document.body.classList.toggle('has-sound', on);
}

// ---------------------------------------------------------------------------
// Input
// ---------------------------------------------------------------------------

const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();

/** Raycasts don't care whether something is hidden; the visitor does. */
function isShown(o) {
  for (let n = o; n; n = n.parent) if (!n.visible) return false;
  return true;
}

function pickAt(clientX, clientY, { occlusion = true } = {}) {
  ndc.set((clientX / innerWidth) * 2 - 1, -(clientY / innerHeight) * 2 + 1);
  raycaster.setFromCamera(ndc, app.world.camera);
  raycaster.far = Infinity;
  // Everything tappable lives in the displays; test those first (cheap)…
  let found = null;
  for (const hit of raycaster.intersectObject(app.displays.root, true)) {
    const o = hit.object;
    if (o.isPoints || !isShown(o)) continue;
    const m = Array.isArray(o.material) ? o.material[hit.face?.materialIndex ?? 0] : o.material;
    if (m && m.visible === false) continue;
    if (!o.userData.pick && m && m.transparent && m.opacity < 0.5) continue; // glass
    if (!o.userData.pick) return null; // a solid display piece is in the way
    let piece = o;
    while (piece.parent && piece.parent.userData.pick === o.userData.pick) piece = piece.parent;
    if (piece.parent?.userData.outfit) piece = piece.parent; // lean in on the whole outfit
    const normal = hit.face ? hit.face.normal.clone().transformDirection(o.matrixWorld) : null;
    found = { pick: o.userData.pick, hit, from: { object: piece, normal } };
    break;
  }
  if (!found || !occlusion) return found;
  // …then make sure no wall or piece of furniture stands between you and it.
  raycaster.far = Math.max(0, found.hit.distance - 0.03);
  const blocked = raycaster.intersectObjects(app.occluders || [], false).some(h => {
    const m = h.object.material;
    return isShown(h.object) && !(m.transparent && m.opacity < 0.5);
  });
  raycaster.far = Infinity;
  return blocked ? null : found;
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
    if (what === 'atmosphere') openAtmosphere(app, { setTime, setSound });
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

function bindInput() {
  const canvas = $('#scene');

  document.querySelectorAll('[data-step]').forEach(b => b.addEventListener('click', () => { stopWalk('dock'); step(Number(b.dataset.step)); }));
  $('[data-walk-stop]').addEventListener('click', () => stopWalk('stop'));

  // Keyboard.
  document.addEventListener('keydown', e => {
    if (!app.entered || openDialogs().size) return;
    if (e.target instanceof Element && e.target.closest('input, textarea, select, [contenteditable]')) return;
    if (walk.active && !['Tab', 'Shift', 'Meta', 'Control', 'Alt'].includes(e.key)) {
      stopWalk('key');
      if (e.key === 'Escape') return;
    }
    if (e.key === 'ArrowRight' || e.key === 'PageDown') { e.preventDefault(); step(1); }
    else if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); step(-1); }
    else if (/^[1-7]$/.test(e.key)) goTo(Number(e.key) - 1);
    else if (e.key.toLowerCase() === 'm') openMenu(app);
  });

  // Pointer: drag to look around (pull past the edge to move on), flick to step, tap to pick.
  const touches = new Set();
  let g = null;
  const cancel = () => {
    if (g?.drag) app.rig.dragEnd();
    g = null;
    document.body.classList.remove('is-dragging');
  };
  canvas.addEventListener('pointerdown', e => {
    if (!app.entered || (e.pointerType === 'mouse' && e.button !== 0)) return;
    touches.add(e.pointerId);
    if (touches.size > 1) { cancel(); return; } // two fingers: not ours
    stopWalk('pointer');
    g = { id: e.pointerId, x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY, t0: performance.now(), drag: false, blocked: false };
    try { canvas.setPointerCapture(e.pointerId); } catch { /* synthetic events */ }
  });
  canvas.addEventListener('pointermove', e => {
    if (!g || g.id !== e.pointerId) return;
    if (!g.drag && !g.blocked && Math.hypot(e.clientX - g.x0, e.clientY - g.y0) > 8) {
      g.drag = app.rig.dragStart();
      g.blocked = !g.drag;
      if (g.drag) { document.body.classList.add('is-dragging'); document.body.classList.remove('is-pointer'); hideLookHint(true); }
    }
    if (g.drag) app.rig.dragBy(e.clientX - g.x, e.clientY - g.y);
    g.x = e.clientX; g.y = e.clientY;
  });
  const release = (e, cancelled) => {
    touches.delete(e.pointerId);
    if (!g || g.id !== e.pointerId) return;
    const { drag, blocked, x0, y0, t0 } = g;
    g = null;
    document.body.classList.remove('is-dragging');
    const dx = e.clientX - x0, dy = e.clientY - y0, dt = performance.now() - t0;
    if (drag) {
      const pulled = app.rig.dragEnd();
      // A quick, deliberate swipe still means "next station"; anything slower is looking around.
      const flick = dt < 220 && Math.abs(dx) > 90 && Math.abs(dx) / dt > 0.55 && Math.abs(dx) > Math.abs(dy) * 1.6;
      if (!cancelled && (pulled || flick)) step(pulled || (dx < 0 ? 1 : -1));
      else lookedAround();
      return;
    }
    if (cancelled || blocked || Math.hypot(dx, dy) >= 10 || dt >= 600) return;
    const res = pickAt(e.clientX, e.clientY);
    if (!res) return;
    const { pick, hit, from } = res;
    if (pick.kind === 'menuBoard' && app.rig.station.id === 'counter') {
      const handle = app.displays.menuRowAt(hit.uv);
      if (handle) { openProduct(app, handle, { from: 'menuBoard' }); return; }
    }
    runAction(pick, pick.station, from);
  };
  canvas.addEventListener('pointerup', e => release(e, false));
  canvas.addEventListener('pointercancel', e => release(e, true));

  // Wheel / trackpad: one notch = one station.
  let acc = 0, lock = 0;
  canvas.addEventListener('wheel', e => {
    if (!app.entered) return;
    e.preventDefault();
    stopWalk('wheel');
    const now = performance.now();
    if (now < lock) return;
    acc += Math.abs(e.deltaY) > Math.abs(e.deltaX) ? e.deltaY : e.deltaX;
    if (Math.abs(acc) > 70) { step(acc > 0 ? 1 : -1); acc = 0; lock = now + 1100; }
  }, { passive: false });

  // Hover cursor.
  let lastHover = 0;
  canvas.addEventListener('pointermove', e => {
    if (e.pointerType !== 'mouse' || !app.entered || g?.drag) return;
    const now = performance.now();
    if (now - lastHover < 70) return;
    lastHover = now;
    document.body.classList.toggle('is-pointer', !!pickAt(e.clientX, e.clientY, { occlusion: false }));
  });

  // Anything that opens a panel ends the walk.
  document.addEventListener('lounge:dialogs', () => { if (openDialogs().size) stopWalk('dialog'); });

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

// ---------------------------------------------------------------------------
// First-visit hint: you can look around
// ---------------------------------------------------------------------------

const HINT_KEY = 'increments-lounge:looked';
let hintTimer = 0;
function lookHint() {
  try { if (localStorage.getItem(HINT_KEY)) return; } catch { return; }
  const el = $('[data-lookhint]');
  el.querySelector('span').textContent = matchMedia('(pointer: coarse)').matches
    ? 'Drag to look around · keep pulling for the next station'
    : 'Drag to look around · arrow keys to move on';
  hintTimer = setTimeout(() => {
    if (walk.active || openDialogs().size) return;
    el.classList.add('is-shown');
    hintTimer = setTimeout(() => hideLookHint(), 5200);
  }, 1600);
}
function hideLookHint(learned = false) {
  clearTimeout(hintTimer);
  $('[data-lookhint]').classList.remove('is-shown');
  if (learned) lookedAround();
}
let looked = false;
function lookedAround() {
  if (looked) return;
  looked = true;
  try { localStorage.setItem(HINT_KEY, '1'); } catch { /* ignore */ }
  track('look_around', { station: app.rig?.station.id });
}

boot().catch(err => {
  console.error(err);
  track('boot_error', { message: String(err?.message || err) });
  progress(1, 'Something went wrong opening the Lounge — the collection still works.');
  enterBtn.disabled = false;
  enterBtn.textContent = 'See the collection';
  enterBtn.onclick = () => (app.catalog ? openMenu(app) : (location.href = `https://${CONFIG.store.domain}`));
  bindChrome();
});
