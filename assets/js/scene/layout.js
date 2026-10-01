// The floor plan, in metres. Origin at the room's centre on the floor; +z toward the
// street door, -z toward the counter, -x toward the arched windows, +x the lounge wall.
// The corners are rounded (radius ROOM.corner) and a floating ceiling hides a light cove.
// 18 × 12 m under a 4.4 m ceiling: every zone keeps its place, with room to breathe round it.
//
//                             back wall (z = -6)
//      ╭────────────────────────────────────────────────────────────╮
//      │ ∩ ∩ fitting │ ▓▓▓ black stone wall ▓▓▓ │ archive · brand line │
//      │    rooms    │    [raw stone counter]    │   (lit travertine)   │
//   W  │ [movement   │                          │                      │  lounge
//   I  │   rack]     │                [island]  │      banquette +     │  wall
//   N  │  ⌒ window   │                          │   lit niche (Worn)   │ (x = 9)
//   D  │  ((steps))  │                          │                      │
//   O  │ ( olive )   │   ◯ skylight above       │                      │
//   W  │  ⌒ window   │                          │                      │
//   S  ╰──────── ∩ shop window ── door ── vitrine · notice board ──────╯
//  (x = -9)                   front wall (z = 6)
//              ┄┄┄┄┄┄┄┄┄┄┄┄ facade · pavement · the street ┄┄┄┄┄┄┄┄┄┄┄┄

export const ROOM = { x0: -9, x1: 9, z0: -6, z1: 6, h: 4.4, corner: 1.4, t: 0.22 };

// Arched windows down the window wall; `spring` is where the arch starts.
export const WINDOWS = [
  { z: 3.0, w: 2.2, sill: 0.5, spring: 2.6 },
  { z: -1.5, w: 2.2, sill: 0.5, spring: 2.6 },
];

export const DOOR = { x: 0, w: 1.3, h: 2.55 };

// The storefront, seen from the street before you step in (street at +z).
// A real arched shop window left of the door looks into the Steps; the arched vitrine to the
// right is a shallow display box in the facade (the notice board is behind it, inside).
export const FRONT_WINDOW = { x: -3.2, w: 1.9, sill: 0.45, spring: 2.45 };
export const VITRINE = { x: 3.2, w: 1.9, sill: 0.45, spring: 2.45, depth: 0.14 };
export const FACADE = { x0: -12.5, x1: 12.5, h: 7.8, t: 0.2, plinth: 0.42 };
export const PAVEMENT = { z1: 15 };
// Where the visit starts: across the pavement, looking at the door.
export const STREET = {
  pos: [0.35, 1.6, 13.1], target: [0.1, 2.3, 6.4], fit: 10,
  portrait: { pos: [0.2, 1.6, 11.9], target: [0.05, 2.45, 6.4], fit: 3.5 },
};

// Sun comes in low through the arched windows, from the street side.
export const SUN = { position: [-15, 12.4, 6.5], target: [0, 0, -0.5], color: 0xffe0b8 };

// Floating ceiling, inset from the walls; the gap is the light cove.
export const CEILING = { drop: 4.12, inset: 0.45 };

// The Steps: nine travertine steps curving round an olive under a round skylight.
// Angles in degrees, measured from +x toward +z; the steps rise from `from` to `to`.
export const STEPS = { x: -5.6, z: 2.3, rIn: 1.0, rOut: 2.15, count: 9, rise: 0.14, from: 125, to: 305 };
export const PLANTER = { r: 0.82, h: 0.46 };
export const SKYLIGHT = { x: -5.6, z: 2.3, r: 1.0 };

export const COUNTER = { x: 0, z: -3.7, w: 3.4, d: 0.85, h: 1.0 };
export const FEATURE_WALL = { x: 0, w: 5.6 };
export const PLAQUE = { x: 0, y: 2.55, w: 2.9, h: 1.4 };

// Arched fitting rooms set into the back wall, behind the Movement rack.
export const FITTING_ROOMS = [{ x: -6.4, w: 1.0 }, { x: -5.15, w: 1.0 }];
export const FITTING = { spring: 2.0, depth: 1.0 };
export const MOVEMENT_RACK = { x: -5.78, z: -3.7, w: 2.1 };

export const ARCHIVE_SHELF = { x: 5.3, z: -5.78, w: 2.8, h: 2.5 };
export const BRAND_LINE = { x: 5.3, y: 3.36, w: 2.9 };

// Rounded niche in the lounge wall, lit from within, where Worn hangs.
export const LOUNGE_NICHE = { z0: -2.6, z1: 2.6, y0: 1.22, y1: 3.5, depth: 0.5, radius: 0.55 };
export const BANQUETTE = { x: 8.62, z: 0, len: 5.6 };
export const LOUNGE_TABLES = [[7.72, -1.35], [7.72, 1.35]];

export const ISLAND = { x: 2.5, z: -0.4, len: 2.6, w: 0.95 };

// Soft fabric waves hung under the floating ceiling, over the middle of the room.
export const SAILS = { x0: -2.2, x1: 6.9, z0: -2.7, z1: 3.5, count: 11, top: 4.06 };
export const NOTICE_BOARD = { x: 4.3, y: 1.64, z: 5.96, w: 3.3, h: 1.76 };
export const CAMPAIGN_PRINT = { z: -3.75 };
