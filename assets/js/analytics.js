import { CONFIG } from './config.js';

// One function, one naming scheme. Every event is pushed to window.dataLayer as
// `lounge_<name>`, and — when a Google tag is configured — sent to Google Analytics too.
//
// The tag is the store's own (the one Shopify's Google & YouTube app installs), so Lounge
// visits and events land in the same Analytics property as increments.ca. Google Consent
// Mode is on: nothing is stored on the visitor's device and no ad signals are sent until
// they say yes (see consent.js); before that, Google only receives cookieless pings.
//
// Events: open, enter, station_view, product_open, colour_select, size_select,
// add_to_tray, tray_open, checkout_click, menu_open, stamp_earned, card_complete,
// archive_open, increment_created, increment_shared, increment_submitted, board_open,
// look_around, lean_in, walk_start, walk_end, time_select, sound_toggle, quality_change,
// webgl_unavailable, closed_view, boot_error

window.dataLayer = window.dataLayer || [];
const TAG = CONFIG.analytics.googleTag;
const CHOICE_KEY = 'increments-lounge:analytics-consent';

export function storedConsent() {
  try { return localStorage.getItem(CHOICE_KEY); } catch { return null; } // 'granted' | 'denied' | null
}

if (TAG) {
  window.gtag = function gtag() { window.dataLayer.push(arguments); };
  const granted = storedConsent() === 'granted';
  window.gtag('consent', 'default', {
    analytics_storage: granted ? 'granted' : 'denied',
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
  });
  const s = document.createElement('script');
  s.async = true;
  s.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(TAG)}`;
  document.head.append(s);
  window.gtag('js', new Date());
  window.gtag('config', TAG, { page_title: 'The Increments Lounge' });
}

/** Records the visitor's answer and tells Google. */
export function setAnalyticsConsent(granted) {
  try { localStorage.setItem(CHOICE_KEY, granted ? 'granted' : 'denied'); } catch { /* ignore */ }
  if (window.gtag && TAG) window.gtag('consent', 'update', { analytics_storage: granted ? 'granted' : 'denied' });
}

export const analyticsEnabled = () => !!TAG;

const started = performance.now();

export function track(name, props = {}) {
  const payload = { event: `lounge_${name}`, t: Math.round(performance.now() - started), ...props };
  window.dataLayer.push(payload);
  if (window.gtag && TAG) window.gtag('event', `lounge_${name}`, props);
  if (CONFIG.analytics.debug) console.debug('[lounge]', payload);
}
