# Launch plan — The Increments Lounge

A one-off experience that runs alongside the store for a set window (suggested: **four weeks** around a drop). This is the plan from "built" to "closed".

## 1. Before launch (week −2 → −1)

**Client sign-off**
- [ ] Walk the client through all seven stations on their own phone (send the preview link).
- [ ] Confirm copy for each station caption (`assets/js/scene/stations.js`) and the notice-board quotes (`scene/displays.js → TEAM_QUOTES`).
- [ ] Confirm what's merchandised where (`data/merch.json`). Today: Still Becoming → the Steps, Worn → the Lounge niche, activewear → Movement, socks & caps → the till, FC/First Chapter → the Archive.
- [ ] Decide on the stamp-card reward. If yes: create a Shopify discount (e.g. `SMALLSTEPS`, 10%, one use per customer, active only for the run), put it in `config.js → reward.code`.
- [ ] Set `opensOn` / `closesOn` in `config.js`.
- [ ] Replace the draft **starter notes** in `config.js → board.starterNotes` with the team's real next steps.
- [ ] Check Lounge traffic arrives in Google Analytics (Realtime → filter hostname `incrementsshop.github.io`). Lounge events are named `lounge_*`.
- [ ] Decide on the **shared notice board**: switch it on (visitors' notes go up after approval) or keep notes on each visitor's device. If on, decide who moderates and how often (daily is plenty), then follow [BOARD.md](BOARD.md). Preview it with `?boardDemo`.

**Store-side**
- [ ] Shopify admin → Settings → Checkout: nothing to change; cart permalinks work on every plan.
- [ ] (Optional) Make "Found in" visible on order printouts/notifications — it's a cart attribute on every Lounge order.
- [ ] Check the product photography: open `tools/contact-sheet.html` locally. Any new product whose main image is shot flat on a plain background will stand in the room as a cut-out; on-model photos become prints.
- [ ] Newsletter link for sold-out/archive items: `config.js → newsletterUrl`.

**Hosting**
- [ ] Create the GitHub repo, push, enable Pages (Source: GitHub Actions) — see README.
- [ ] Custom domain `lounge.increments.ca` (DNS CNAME → `<user>.github.io`), enforce HTTPS.
- [ ] Run *Refresh catalog* once from the Actions tab to confirm the schedule works.
- [ ] Link previews use `assets/og.jpg` (the storefront render). If you move to `lounge.increments.ca`, update the two absolute `og:image` / `twitter:image` URLs in `index.html`.

## 2. QA checklist

**Devices** (real hardware beats emulators for WebGL):
- [ ] iPhone (recent) — Safari
- [ ] iPhone (3–4 years old) — Safari — watch for the resolution stepping down; should stay smooth
- [ ] Mid-range Android — Chrome
- [ ] iPad — landscape and portrait
- [ ] Desktop — Chrome, Safari, Firefox
- [ ] Instagram and TikTok in-app browsers (where most campaign traffic lands)

**Flows**
- [ ] Intro → the storefront appears behind the title → Step inside: the doors open and you walk in to the entrance. Press → mid-walk: control comes straight back.
- [ ] Deep link (`/#lounge`) skips the street and opens at that station.
- [ ] All seven stations via arrows, swipe, dock list, keyboard (desktop).
- [ ] Drag to look around at a few stations; let go and it settles back; keep pulling past the edge → next station. First visit shows the "Drag to look around" hint once.
- [ ] *Take the walk* from the entrance: glides through every station, lingers, eases in; the bar's Stop, any tap, key or scroll hands control back.
- [ ] Tap a garment in the room → you step up to it and the sheet opens with that colourway selected; on a phone the piece stays visible above the shorter sheet. Close → you step back.
- [ ] Pick a sold-out size → disabled. Pick an in-stock size → Add to bag → toast + bag count.
- [ ] Bag → quantity ±, remove, "Pay at the counter" lands in Shopify checkout with the right items. Do one real test order, then refund it.
- [ ] "Keep shopping on increments.ca" lands on the store cart with the items.
- [ ] Shop (top bar) opens the Collection list; each row opens the sheet. Tapping a line on the carved plaque opens that piece.
- [ ] Archive: sold-out pieces show "Chapter closed"; the FC Forest Green shorts show "Last few".
- [ ] Notice board: write an increment → Pin → appears on the board; Share (phone) / Save (desktop) produces the 1080×1920 card.
- [ ] Shared board (if on): pin with sharing ticked → the note appears in Supabase as `pending` → approve it → it shows on the board and in *Read the board*. A note with a link is refused with a friendly message.
- [ ] Stamp card fills; with a reward code set, the code is applied at checkout.
- [ ] Atmosphere (sun/moon chip): each time of day fades in; *Follow my clock* matches the device time; sound on/off; both remembered. In the evening the storefront sign, sconces, neon, pill sign and arch lines glow; at noon they're faint.
- [ ] Deep links: `/#counter`, `/counter` (via 404 redirect).
- [ ] Reduced motion (OS setting): cuts instead of glides.
- [ ] VoiceOver / TalkBack: skip link, hotspots announced with name + price, dialogs labelled.
- [ ] Airplane-mode mid-visit: bag and stamps persist on reload.
- [ ] Set `closesOn` to yesterday → closed card shows; set it back.

## 3. Launch (week 0)

- Soft-launch to the newsletter list 24 h before socials ("You're first in the Lounge").
- Social: 15–20 s screen-recorded walkthrough (the Steps → the Collection → the Lounge) for Reels/TikTok; carousel of the station renders in `docs/shots/`.
- Seed the notice board: post three team "next increments" cards from the composer as stories to show the mechanic. If the shared board is on, have a few friends of the brand pin real notes before launch so it isn't empty on day one.
- Store: homepage banner + announcement bar "Step into the Lounge →".

## 4. During the run

- Watch weekly: visitors → entered → product opens → add-to-bag → checkout clicks → Lounge orders (cart attribute in Shopify).
- Re-merchandise without code: edit `data/merch.json` (e.g. swap which product stands on the Steps).
- Moderate the shared board once or twice a day (Supabase → Table Editor → `increments`, filter `status = pending`).
- If a colourway sells out, the room updates within the hour (catalog refresh) — sold-out sizes disable, sold-out products drop off the Movement rack.

## 5. Closing

- Set `closesOn`. After that date visitors see "The Lounge has closed — thanks for stopping by" with a link to the store; keep the site up so shared links don't 404.
- Disable the *Refresh catalog* schedule (Actions → workflow → Disable) once closed.
- Shared board: export the notes if wanted, then delete them (`delete from increments;`) or pause the Supabase project, and blank the keys in `config.js`.
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
