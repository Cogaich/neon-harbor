// Neon Harbor — every tuning number and colour in one place.
// The city is 3200x2400 world units; the camera shows a 1280x720 slice of it,
// scaled to the window, so no rule below depends on the screen size.

export const WORLD = { width: 3200, height: 2400 };

/** The simulation's fixed step, in seconds: 60 updates a second. */
export const STEP = 1 / 60;

/** The camera's logical view size. */
export const VIEW = { width: 1280, height: 720 };

/** Roads: five avenues run north-south, five streets east-west. */
export const AVENUES = [400, 1000, 1600, 2200, 2800];
export const STREETS = [350, 800, 1250, 1700, 2150];
export const ROAD_W = 132;
export const WALK_W = 26;

export const PLAYER = {
  walkSpeed: 235,
  radius: 13,
  health: 100,
  enterRange: 52,
};

export const CAR = {
  length: 48,
  width: 26,
  accel: 540,
  brake: 900,
  reverseAccel: 320,
  maxSpeed: 565,
  maxReverse: 185,
  turnRate: 2.7,
  grip: 0.94,
};

export const TRAFFIC_COUNT = 14;
export const TRAFFIC_SPEED = { min: 140, max: 205 };

export const PED_COUNT = 26;
export const PED_SPEED = { min: 42, max: 78 };

export const POLICE = {
  maxSpeed: 545,
  accel: 560,
  turnRate: 2.9,
  health: 60,
  ramDamage: 10,
  ramCooldown: 0.9,
  spawnInterval: 2.4,
  maxActive: 4,
};

export const WANTED = {
  max: 5,
  decayDelay: 12,
  decayInterval: 8,
  stealStars: 1,
  hitPedStars: 1,
  killCopStars: 1,
};

export const GUN = {
  damage: 26,
  bulletSpeed: 920,
  range: 430,
  magSize: 12,
  reloadTime: 1.15,
  fireInterval: 0.22,
};

export const PICKUPS = {
  cashValue: 60,
  medkitHeal: 45,
};

/** Where progress is kept between visits (this browser only). */
export const SAVE_KEY = 'neon-harbor.save.v1';

export const PALETTE = {
  grass: '#7fb069',
  grassDark: '#6b9e58',
  park: '#8fce7a',
  road: '#3c414d',
  roadEdge: '#2c303a',
  sidewalk: '#b9bec7',
  lane: '#e8c33c',
  crosswalk: '#e8e6df',
  water: '#2f8fc4',
  waterDeep: '#1f6da3',
  sand: '#ecd9a0',
  pier: '#8a6a4b',
  building: ['#e07856', '#f2a541', '#5fb8ad', '#8a7fd6', '#e07a9b', '#6fa8dc', '#9ccc65', '#f27059'],
  roof: ['#5d4037', '#37474f', '#4e342e', '#263238'],
  neon: ['#ff5ea8', '#38e1ff', '#ffe14d', '#7dff5e'],
  player: '#2ee6a8',
  playerCar: '#2ee6a8',
  trafficCar: ['#c62828', '#1565c0', '#f9a825', '#eceff1', '#6a1b9a', '#00897b', '#ef6c00'],
  policeCar: '#1e88e5',
  policeLight: ['#ff1744', '#2979ff'],
  ped: ['#ffd54f', '#ff8a65', '#ba68c8', '#4dd0e1', '#aed581', '#f06292'],
  text: '#f4f6f8',
  muted: '#9aa3ad',
  gold: '#ffd54f',
  danger: '#ff5252',
  hudBg: 'rgba(12, 16, 24, 0.72)',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/**
 * The story, in five jobs. Each job has steps; a step is done by reaching its
 * marker (on foot or in a car, per `mode`), except the getaway job, which is
 * done by shaking the wanted level back to zero.
 */
export const MISSIONS = [
  {
    id: 'wheels',
    title: 'Job 1 — First Wheels',
    giver: 'Rosa, the garage boss',
    text: 'No wheels, no work. Borrow any car on the street and bring it to my garage.',
    reward: 250,
    steps: [
      { kind: 'reach', mode: 'car', x: 1000, y: 350, r: 90, label: 'Bring a car to Rosa’s garage' },
    ],
  },
  {
    id: 'harbor',
    title: 'Job 2 — Harbor Run',
    giver: 'Rosa',
    text: 'A crate washed up at the pier. Pick it up, then drop it at the garage. Cops are nosy tonight.',
    reward: 400,
    steps: [
      { kind: 'reach', mode: 'any', x: 2200, y: 2290, r: 90, label: 'Pick up the crate at the pier' },
      { kind: 'reach', mode: 'car', x: 1000, y: 350, r: 90, label: 'Deliver the crate to the garage' },
    ],
  },
  {
    id: 'getaway',
    title: 'Job 3 — Getaway',
    giver: 'Rosa',
    text: 'You lifted the wrong crate. Two stars on your head — lose the cops and meet me at the park.',
    reward: 500,
    wantedOnStart: 2,
    steps: [
      { kind: 'lose-cops', label: 'Lose the cops — get your wanted level to zero' },
      { kind: 'reach', mode: 'any', x: 1300, y: 1025, r: 100, label: 'Meet Rosa at the park' },
    ],
  },
  {
    id: 'drop',
    title: 'Job 4 — The Drop',
    giver: 'Marlo, the fixer',
    text: 'Cash is waiting at the plaza. On foot, quiet, no heat. Walk in, walk out rich.',
    reward: 650,
    steps: [
      { kind: 'reach', mode: 'foot', x: 1300, y: 1025, r: 90, label: 'Pick up the cash at the plaza — on foot' },
    ],
  },
  {
    id: 'king',
    title: 'Job 5 — Neon King',
    giver: 'Marlo',
    text: 'Last one. The whole city is watching: three stars, one penthouse, no brakes. Deliver the ledger.',
    reward: 1200,
    wantedOnStart: 3,
    steps: [
      { kind: 'reach', mode: 'any', x: 2800, y: 350, r: 100, label: 'Reach the penthouse with the ledger' },
    ],
  },
];

export const STORY_INTRO =
  'Neon Harbor — a sunny port city where everyone is one bad decision from rich. ' +
  'You are new in town, broke, and Rosa needs a driver.';

export const HOSPITAL = { x: 400, y: 1700 };
export const GARAGE = { x: 1000, y: 350 };
export const PIER = { x: 2200, y: 2290 };
export const PLAZA = { x: 1300, y: 1025 };
export const PENTHOUSE = { x: 2800, y: 350 };
