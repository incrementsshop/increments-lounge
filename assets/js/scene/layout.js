// The floor plan, in metres. Origin at the room's centre on the floor; +z toward the
// street door, -z toward the counter, -x toward the arched windows, +x the lounge wall.
//
//                        back wall (z = -5.5)
//     ┌──────────────────────────────────────────────────────────┐
//     │ water bar · mirror │   menu board · backbar   │  archive  │
//     │  [movement rack]   │ ═══ fluted counter ═════ │  shelf    │
//  W  │                    │                          │           │  lounge
//  I  │   ⌒ window          │                          │   banquette│  wall
//  N  │  [plinths: Still   │                          │  + tables  │ (x = 7)
//  D  │   Becoming]         │                          │   Worn rail│
//  O  │   ⌒ window   olive  │                          │           │
//  W  └───────────────── door ───── notice board ─────────────────┘
//  S                         front wall (z = 5.5)
// (x = -7)

export const ROOM = { x0: -7, x1: 7, z0: -5.5, z1: 5.5, h: 4.0 };

export const WINDOWS = [
  { z: 2.7, w: 2.0, sill: 0.5 },
  { z: -1.5, w: 2.0, sill: 0.5 },
];

export const DOOR = { x: 0, w: 1.3, h: 2.55 };

// Sun comes in low through the arched windows, from the street side.
export const SUN = { position: [-15, 8.2, 6.5], target: [0, 0, -0.5], color: 0xffe0b8 };

export const COUNTER = { x: -0.25, z: -3.25, w: 5.4, d: 0.7, h: 1.0 };
export const BACKBAR = { z: -5.1 };
export const MENU_BOARD = { x: -0.25, y: 2.52, z: -5.4, w: 3.0, h: 1.45 };

export const WINDOW_DISPLAY = { x: -5.55, z: 2.55 };
export const MOVEMENT_RACK = { x: -4.6, z: -3.55, w: 2.1 };
export const WATER_BAR = { x: -5.35, z: -5.22, w: 2.7 };
export const ARCHIVE_SHELF = { x: 5.1, z: -5.28, w: 2.9, h: 2.5 };
export const BANQUETTE = { x: 6.62, z: 0.1, len: 5.6 };
export const LOUNGE_TABLES = [[5.72, -1.25], [5.72, 1.45]];
export const COMMUNAL = { x: 1.55, z: -0.35, len: 2.6, w: 0.9 };
export const NOTICE_BOARD = { x: 3.55, y: 1.62, z: 5.46, w: 2.4, h: 1.4 };
