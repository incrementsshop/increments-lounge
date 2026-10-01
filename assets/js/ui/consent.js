import { h } from './dom.js';
import { analyticsEnabled, storedConsent, setAnalyticsConsent, track } from '../analytics.js';

// A one-time, low-key question once the visitor is inside: may the Lounge use analytics
// cookies? Until they answer (or if they say no), Google only gets cookieless pings.

export function maybeAskConsent({ delay = 6000 } = {}) {
  if (!analyticsEnabled() || storedConsent()) return;
  setTimeout(() => {
    if (document.querySelector('.consent')) return;
    const close = granted => {
      setAnalyticsConsent(granted);
      track('analytics_consent', { granted });
      card.classList.remove('is-shown');
      setTimeout(() => card.remove(), 500);
    };
    const card = h('section', { class: 'consent', role: 'region', 'aria-label': 'Cookies' },
      h('p', {}, 'The Lounge uses a few analytics cookies to learn which pieces people love. Nothing is sold or shared.'),
      h('div', { class: 'consent__actions' },
        h('button', { class: 'pill pill--dark', type: 'button', onclick: () => close(true) }, 'That’s fine'),
        h('button', { class: 'pill', type: 'button', onclick: () => close(false) }, 'No thanks')));
    document.body.append(card);
    requestAnimationFrame(() => card.classList.add('is-shown'));
  }, delay);
}
