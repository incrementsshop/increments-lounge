import { h } from './dom.js';
import { openDialog } from './dialogs.js';
import { TIMES, TIME_ORDER, timeForClock, savedTimePreference, saveTimePreference, resolveTime } from '../scene/lighting.js';
import { track } from '../analytics.js';

// Atmosphere: when you visit (the Lounge follows your clock unless you pick a time) and
// whether the room's sound is on. Lives behind the sun/moon chip in the top bar.

const BLURB = {
  morning: 'Sun through the arched windows, long shadows on the travertine.',
  golden: 'Low, amber light across the steps and the stone.',
  evening: 'The sun’s gone. The cove, the lamps and the shelves carry the room.',
};

export function openAtmosphere(app, { setTime, setSound }) {
  const pref = savedTimePreference();
  return openDialog({
    variant: 'sheet',
    title: '<em>Atmosphere</em>',
    kicker: 'The room, your way',
    className: 'atmosphere',
    build(body) {
      const group = h('div', { class: 'atmos__times', role: 'radiogroup', 'aria-label': 'Time of day' });
      const options = [['auto', 'Follow my clock', `Now: ${TIMES[timeForClock()].label}`], ...TIME_ORDER.map(t => [t, TIMES[t].label, BLURB[t]])];
      const buttons = options.map(([value, label, sub]) => h('button', {
        class: `atmos__time atmos__time--${value}`, type: 'button', role: 'radio',
        'aria-checked': String(value === pref),
        onclick: e => {
          buttons.forEach(b => b.setAttribute('aria-checked', String(b === e.currentTarget)));
          saveTimePreference(value);
          setTime(value === 'auto' ? resolveTime('auto') : value);
          track('time_select', { value });
        },
      },
      h('span', { class: 'atmos__swatch', 'aria-hidden': 'true' }),
      h('span', { class: 'atmos__text' }, h('span', { class: 'atmos__label' }, label), h('span', { class: 'atmos__sub' }, sub))));
      group.addEventListener('keydown', e => {
        const d = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[e.key];
        if (!d) return;
        e.preventDefault();
        const i = buttons.indexOf(document.activeElement);
        const next = buttons[(Math.max(0, i) + d + buttons.length) % buttons.length];
        next.focus(); next.click();
      });
      group.append(...buttons);

      const sound = h('button', {
        class: 'atmos__switch', type: 'button', role: 'switch',
        'aria-checked': String(app.audio.enabled),
        onclick: () => {
          const on = !app.audio.enabled;
          setSound(on);
          sound.setAttribute('aria-checked', String(on));
          track('sound_toggle', { on });
        },
      },
      h('span', { class: 'atmos__text' }, h('span', { class: 'atmos__label' }, 'Lounge sound'), h('span', { class: 'atmos__sub' }, 'Warm room tone, a far-off murmur and a slow chord — made live in your browser.')),
      h('span', { class: 'atmos__toggle', 'aria-hidden': 'true' }));

      body.append(
        h('h3', { class: 'atmos__heading' }, 'Time of day'), group,
        h('h3', { class: 'atmos__heading' }, 'Sound'), sound,
      );
    },
  });
}
