// The floor plan, in metres. Origin at the room's centre on the floor; +z toward the
// street door, -z toward the counter, -x toward the arched windows, +x the lounge wall.
// The corners are rounded (radius ROOM.corner) and a floating ceiling hides a light cove.
//
//                             back wall (z = -5.5)
//      ╭────────────────────────────────────────────────────────────╮
//      │ ∩ ∩ fitting │ ▓▓▓ black stone wall ▓▓▓ │ archive · brand line │
//      │    rooms    │    [raw stone counter]    │   (lit travertine)   │
//   W  │ [movement   │                          │                      │  lounge
//   I  │   rack]     │         [island]         │      banquette +     │  wall
//   N  │  ⌒ window   │                          │   lit niche (Worn)   │ (x = 7)
//   D  │  ((steps))  │                          │                      │
//   O  │ ( olive )   │   ◯ skylight above       │                      │
//   W  │  ⌒ window   │                          │                      │
//   S  ╰──────── ∩ shop window ── door ──── notice board ─────────────╯
//  (x = -7)                   front wall (z = 5.5)
//              ┄┄┄┄┄┄┄┄┄┄┄┄ facade · pavement · the street ┄┄┄┄┄┄┄┄┄┄┄┄

export const ROOM = { x0: -7, x1: 7, z0: -5.5, z1: 5.5, h: 4.0, corner: 1.2, t: 0.22 };

export const WINDOWS = [
  { z: 2.7, w: 2.0, sill: 0.5 },
  { z: -1.5, w: 2.0, sill: 0.5 },
];

export const DOOR = { x: 0, w: 1.3, h: 2.55 };

// The storefront, seen from the street before you step in (street at +z).
// A real arched shop window left of the door looks into the Steps; the arched vitrine to the
// right is a shallow display box in the facade (the notice board is behind it, inside).
export const FRONT_WINDOW = { x: -2.4, w: 1.8, sill: 0.45, spring: 2.35 };
export const VITRINE = { x: 2.4, w: 1.8, sill: 0.45, spring: 2.35, depth: 0.14 };
export const FACADE = { x0: -10.5, x1: 10.5, h: 7.4, t: 0.2, plinth: 0.42 };
export const PAVEMENT = { z1: 14.5 };
// Where the visit starts: across the pavement, looking at the door.
export const STREET = {
  pos: [0.35, 1.6, 12.4], target: [0.1, 2.2, 5.8], fit: 8.2,
  portrait: { pos: [0.2, 1.6, 11.2], target: [0.05, 2.35, 5.8], fit: 3.5 },
};

// Sun comes in low through the arched windows, from the street side.
export const SUN = { position: [-15, 8.2, 6.5], target: [0, 0, -0.5], color: 0xffe0b8 };

// Floating ceiling, inset from the walls; the gap is the light cove.
export const CEILING = { drop: 3.72, inset: 0.42 };

// The Steps: nine travertine steps curving round an olive under a round skylight.
// Angles in degrees, measured from +x toward +z; the steps rise from `from` to `to`.
export const STEPS = { x: -4.35, z: 2.1, rIn: 1.0, rOut: 2.15, count: 9, rise: 0.14, from: 125, to: 305 };
export const PLANTER = { r: 0.82, h: 0.46 };
export const SKYLIGHT = { x: -4.35, z: 2.1, r: 0.95 };

export const COUNTER = { x: -0.25, z: -3.2, w: 3.3, d: 0.85, h: 1.0 };
export const FEATURE_WALL = { x: -0.25, w: 5.2 };
export const PLAQUE = { x: -0.25, y: 2.5, w: 2.9, h: 1.4 };

// Arched fitting rooms set into the back wall, behind the Movement rack.
export const FITTING_ROOMS = [{ x: -5.0, w: 1.0 }, { x: -3.75, w: 1.0 }];
export const FITTING = { spring: 2.0, depth: 1.0 };
export const MOVEMENT_RACK = { x: -4.4, z: -3.2, w: 2.1 };

export const ARCHIVE_SHELF = { x: 4.25, z: -5.28, w: 2.8, h: 2.5 };
export const BRAND_LINE = { x: 4.25, y: 3.18, w: 2.9 };

// Rounded niche in the lounge wall, lit from within, where Worn hangs.
export const LOUNGE_NICHE = { z0: -2.5, z1: 2.7, y0: 1.22, y1: 3.5, depth: 0.5, radius: 0.55 };
export const BANQUETTE = { x: 6.62, z: 0.1, len: 5.6 };
export const LOUNGE_TABLES = [[5.72, -1.25], [5.72, 1.45]];

export const ISLAND = { x: 1.55, z: -0.35, len: 2.6, w: 0.95 };

// Soft fabric waves hung under the floating ceiling, over the middle of the room.
export const SAILS = { x0: -1.7, x1: 5.5, z0: -2.35, z1: 3.25, count: 9, top: 3.66 };
// Cream-and-evergreen checker inlaid just inside the door.
export const INLAY = { x: 0, z: 4.62, w: 2.3, d: 1.66, tile: 0.2 };
export const NOTICE_BOARD = { x: 3.5, y: 1.64, z: 5.46, w: 3.3, h: 1.76 };
export const CAMPAIGN_PRINT = { z: -3.45 };
