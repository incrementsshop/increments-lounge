// Everything the client might reasonably want to change without touching the scene code.

export const CONFIG = {
  store: {
    domain: 'increments.ca',
    name: 'Increments',
    currency: 'CAD',
    locale: 'en-CA',
  },

  catalogUrl: './data/catalog.json',

  // Added to the checkout hand-off so Lounge orders are attributable in Shopify
  // (Analytics → Sessions by UTM, and the cart attribute below shows on each order).
  attribution: {
    utm_source: 'increments-lounge',
    utm_medium: 'experience',
    utm_campaign: 'still-becoming',
    cartAttribute: ['Found in', 'The Increments Lounge'],
  },

  // One-off experience window. Outside it the Lounge shows a friendly "closed" card
  // that points to the store. Use ISO dates (inclusive), or null for no limit.
  opensOn: null,
  closesOn: null,

  // Stamp card reward. Leave `code` empty for a purely visual card. If you set a
  // Shopify discount code here, it's revealed when the card is full and applied
  // automatically at checkout via the cart permalink.
  reward: {
    code: '',
    fullMessage: 'Card full. Small steps, big accomplishments.',
    rewardMessage: 'Your card is full — this one’s on us at checkout.',
  },

  // Optional analytics. Events always go to window.dataLayer (for GTM) — set a GA4
  // measurement ID to also load gtag directly.
  analytics: {
    ga4: '',
    debug: new URLSearchParams(location.search).has('debug'),
  },

  newsletterUrl: 'https://increments.ca/#shopify-section-footer',
};
