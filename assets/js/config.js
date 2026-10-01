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

  // Analytics. Events always go to window.dataLayer (for GTM). `googleTag` is the store's
  // own Google tag (Shopify → Google & YouTube app), so Lounge traffic shows up in the same
  // Google Analytics property as increments.ca — filter by hostname to see it on its own.
  // Visitors are asked once before any analytics cookies are set. Empty it to switch off.
  analytics: {
    googleTag: 'GT-TB7DHKM',
    debug: new URLSearchParams(location.search).has('debug'),
  },

  // The shared notice board (optional). Fill these in from Supabase → Project Settings →
  // API to let visitors' notes go up for everyone once the team approves them; leave them
  // empty and each visitor only sees their own notes. The anon key is meant to be public:
  // the database only lets it add notes for review and read approved ones. See docs/BOARD.md.
  board: {
    supabaseUrl: '',
    anonKey: '',
    table: 'increments',
    // So the board isn't empty on day one: the team's own next steps, signed as the team.
    // They fill the spaces visitors' notes haven't taken yet and step aside as notes arrive.
    // DRAFTS — swap in the team's real ones before launch.
    starterNotes: [
      'Walk to the studio twice a week instead of driving',
      'Finish the sketchbook I started in March',
      'Learn to pull a proper espresso',
      'Read before bed — phone in the other room',
      'Run the spring 5K with my sister',
      'Ten minutes of stretching, every morning',
    ],
    starterSignature: 'the Increments team',
  },

  newsletterUrl: 'https://increments.ca/#shopify-section-footer',
};
