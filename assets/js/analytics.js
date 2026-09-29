import { CONFIG } from './config.js';

// One function, one naming scheme. Every event is pushed to window.dataLayer as
// `lounge_<name>` so GTM / GA4 / Meta pixel setups can pick it up without code changes.
//
// Events: open, enter, station_view, product_open, colour_select, size_select,
// add_to_tray, tray_open, checkout_click, menu_open, stamp_earned, card_complete,
// archive_open, increment_created, increment_shared, sound_toggle, quality_change,
// webgl_unavailable, closed_view

window.dataLayer = window.dataLayer || [];

if (CONFIG.analytics.ga4) {
  const s = document.createElement('script');
  s.async = true;
  s.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(CONFIG.analytics.ga4)}`;
  document.head.append(s);
  window.gtag = function gtag() { window.dataLayer.push(arguments); };
  window.gtag('js', new Date());
  window.gtag('config', CONFIG.analytics.ga4);
}

const started = performance.now();

export function track(name, props = {}) {
  const payload = { event: `lounge_${name}`, t: Math.round(performance.now() - started), ...props };
  window.dataLayer.push(payload);
  if (window.gtag && CONFIG.analytics.ga4) window.gtag('event', `lounge_${name}`, props);
  if (CONFIG.analytics.debug) console.debug('[lounge]', payload);
}
