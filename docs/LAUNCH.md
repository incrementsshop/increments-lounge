# Launch plan — The Increments Lounge

A one-off experience that runs alongside the store for a set window (suggested: **four weeks** around a drop). This is the plan from "built" to "closed".

## 1. Before launch (week −2 → −1)

**Client sign-off**
- [ ] Walk the client through all seven stations on their own phone (send the preview link).
- [ ] Confirm copy for each station caption (`assets/js/scene/stations.js`) and the notice-board quotes (`scene/displays.js → TEAM_QUOTES`).
- [ ] Confirm what's merchandised where (`data/merch.json`). Today: Still Becoming → the Steps, Worn → the Lounge niche, activewear → Movement, socks & caps → the till, FC/First Chapter → the Archive.
- [ ] Decide on the stamp-card reward. If yes: create a Shopify discount (e.g. `SMALLSTEPS`, 10%, one use per customer, active only for the run), put it in `config.js → reward.code`.
- [ ] Set `opensOn` / `closesOn` in `config.js`.

**Store-side**
- [ ] Shopify admin → Settings → Checkout: nothing to change; cart permalinks work on every plan.
- [ ] (Optional) Make "Found in" visible on order printouts/notifications — it's a cart attribute on every Lounge order.
- [ ] Check the product photography: open `tools/contact-sheet.html` locally. Any new product whose main image is shot flat on a plain background will stand in the room as a cut-out; on-model photos become prints.
- [ ] Newsletter link for sold-out/archive items: `config.js → newsletterUrl`.

**Hosting**
- [ ] Create the GitHub repo, push, enable Pages (Source: GitHub Actions) — see README.
- [ ] Custom domain `lounge.increments.ca` (DNS CNAME → `<user>.github.io`), enforce HTTPS.
- [ ] Run *Refresh catalog* once from the Actions tab to confirm the schedule works.
- [ ] Swap `og:image` in `index.html` for a Lounge render hosted on the final domain (e.g. copy `docs/shots/desktop-01-entrance.jpg` to `assets/og.jpg`, reference it with the absolute URL).

## 2. QA checklist

**Devices** (real hardware beats emulators for WebGL):
- [ ] iPhone (recent) — Safari
- [ ] iPhone (3–4 years old) — Safari — watch for the resolution stepping down; should stay smooth
- [ ] Mid-range Android — Chrome
- [ ] iPad — landscape and portrait
- [ ] Desktop — Chrome, Safari, Firefox
- [ ] Instagram and TikTok in-app browsers (where most campaign traffic lands)

**Flows**
- [ ] Intro → Step inside → all seven stations via arrows, swipe, dock list, keyboard (desktop).
- [ ] Tap a garment in the room → sheet opens with that colourway selected.
- [ ] Pick a sold-out size → disabled. Pick an in-stock size → Add to bag → toast + bag count.
- [ ] Bag → quantity ±, remove, "Pay at the counter" lands in Shopify checkout with the right items. Do one real test order, then refund it.
- [ ] "Keep shopping on increments.ca" lands on the store cart with the items.
- [ ] Shop (top bar) opens the Collection list; each row opens the sheet. Tapping a line on the carved plaque opens that piece.
- [ ] Archive: sold-out pieces show "Chapter closed"; the FC Forest Green shorts show "Last few".
- [ ] Notice board: write an increment → Pin → appears on the board; Share (phone) / Save (desktop) produces the 1080×1920 card.
- [ ] Stamp card fills; with a reward code set, the code is applied at checkout.
- [ ] Sound toggle on/off; state remembered.
- [ ] Deep links: `/#counter`, `/counter` (via 404 redirect).
- [ ] Reduced motion (OS setting): cuts instead of glides.
- [ ] VoiceOver / TalkBack: skip link, hotspots announced with name + price, dialogs labelled.
- [ ] Airplane-mode mid-visit: bag and stamps persist on reload.
- [ ] Set `closesOn` to yesterday → closed card shows; set it back.

## 3. Launch (week 0)

- Soft-launch to the newsletter list 24 h before socials ("You're first in the Lounge").
- Social: 15–20 s screen-recorded walkthrough (the Steps → the Collection → the Lounge) for Reels/TikTok; carousel of the station renders in `docs/shots/`.
- Seed the notice board: post three team "next increments" cards from the composer as stories to show the mechanic.
- Store: homepage banner + announcement bar "Step into the Lounge →".

## 4. During the run

- Watch weekly: visitors → entered → product opens → add-to-bag → checkout clicks → Lounge orders (cart attribute in Shopify).
- Re-merchandise without code: edit `data/merch.json` (e.g. swap which product stands on the Steps).
- If a colourway sells out, the room updates within the hour (catalog refresh) — sold-out sizes disable, sold-out products drop off the Movement rack.

## 5. Closing

- Set `closesOn`. After that date visitors see "The Lounge has closed — thanks for stopping by" with a link to the store; keep the site up so shared links don't 404.
- Disable the *Refresh catalog* schedule (Actions → workflow → Disable) once closed.
- Recap for the client: the numbers below, plus a collage of shared increment cards (if people tag the brand).

## What to measure

| Metric | Where | Healthy looks like* |
|---|---|---|
| Enter rate (enter / open) | `lounge_enter` ÷ `lounge_open` | 70%+ |
| Stations per visit | `lounge_station_view` per session | 4+ |
| Product opens per visit | `lounge_product_open` | 1.5+ |
| Add-to-bag rate | sessions with `lounge_add_to_tray` | benchmark against the store's add-to-cart rate |
| Checkout click-through | `lounge_checkout_click` ÷ sessions with a bag | 40%+ |
| Lounge orders & revenue | Shopify orders with *Found in: The Increments Lounge* / `utm_source=increments-lounge` | — |
| Increments created / shared | `lounge_increment_created`, `lounge_increment_shared` | the UGC signal |
| Collection-list use | `lounge_menu_open` early in session | if very high, people want the list — surface it more |
| Quality drops | `lounge_quality_change` | should be rare on recent phones |

\* Starting assumptions for a campaign microsite, not guarantees — set real targets after the first week.
