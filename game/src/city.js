// The city itself: a road grid, the blocks between the roads, the park, and
// the harbor along the south edge. Everything is generated from the seeded
// random, so the same seed always builds the same Neon Harbor.

import { AVENUES, PALETTE, ROAD_W, STREETS, WORLD } from './config.js';
import { pick, range } from './random.js';

/** The block between avenues i and i+1 and streets j and j+1 is the park. */
const PARK_BLOCK = { ai: 1, sj: 1 };

/** The strip south of the last street is the beach and the harbor water. */
const BEACH_TOP = STREETS[STREETS.length - 1] + ROAD_W / 2 + 26;

function blockRect(ai, sj) {
  const x0 = AVENUES[ai] + ROAD_W / 2;
  const x1 = AVENUES[ai + 1] - ROAD_W / 2;
  const y0 = STREETS[sj] + ROAD_W / 2;
  const y1 = STREETS[sj + 1] - ROAD_W / 2;
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

export function createCity(random) {
  const buildings = [];
  const trees = [];
  const neons = [];

  for (let ai = 0; ai < AVENUES.length - 1; ai += 1) {
    for (let sj = 0; sj < STREETS.length - 1; sj += 1) {
      if (ai === PARK_BLOCK.ai && sj === PARK_BLOCK.sj) continue;
      const block = blockRect(ai, sj);
      if (block.y + block.h > BEACH_TOP) continue;
      const count = 2 + Math.floor(random() * 2);
      const cols = count === 2 ? 2 : 2;
      const rows = count === 2 ? 1 : 2;
      const cellW = block.w / cols;
      const cellH = block.h / rows;
      for (let c = 0; c < cols; c += 1) {
        for (let r = 0; r < rows; r += 1) {
          if (count === 3 && c === 1 && r === 1) continue;
          const margin = 26 + random() * 18;
          const bw = cellW - margin * 2;
          const bh = cellH - margin * 2;
          const bx = block.x + c * cellW + margin + random() * 10;
          const by = block.y + r * cellH + margin + random() * 10;
          buildings.push({
            x: bx,
            y: by,
            w: Math.max(90, bw),
            h: Math.max(70, bh),
            color: pick(random, PALETTE.building),
            roof: pick(random, PALETTE.roof),
            neon: random() < 0.4 ? pick(random, PALETTE.neon) : null,
          });
        }
      }
    }
  }

  // Park trees and a pond.
  const park = blockRect(PARK_BLOCK.ai, PARK_BLOCK.sj);
  for (let i = 0; i < 26; i += 1) {
    trees.push({
      x: park.x + 30 + random() * (park.w - 60),
      y: park.y + 30 + random() * (park.h - 60),
      r: 9 + random() * 7,
    });
  }
  const pond = { x: park.x + park.w * 0.62, y: park.y + park.h * 0.3, rx: 62, ry: 40 };

  // Neon signs along the main avenue, and lamps at every intersection.
  for (let i = 0; i < 10; i += 1) {
    neons.push({
      x: AVENUES[2] + (random() < 0.5 ? -1 : 1) * (ROAD_W / 2 + 8),
      y: 200 + i * 210 + random() * 60,
      color: pick(random, PALETTE.neon),
      vertical: random() < 0.5,
    });
  }

  // Piers reaching into the water.
  const piers = [
    { x: 1500, y: BEACH_TOP + 60, w: 26, h: 150 },
    { x: 2200, y: BEACH_TOP + 60, w: 26, h: 190 },
    { x: 2900, y: BEACH_TOP + 60, w: 26, h: 130 },
  ];

  const intersections = [];
  for (const ax of AVENUES) {
    for (const sy of STREETS) {
      intersections.push({ x: ax, y: sy });
    }
  }

  return {
    buildings,
    trees,
    neons,
    park,
    pond,
    piers,
    intersections,
    beachTop: BEACH_TOP,
    waterTop: BEACH_TOP + 96,
  };
}

/** True when the point is on a road (inside the road band, plus a margin). */
export function onRoad(x, y, margin = 0) {
  const half = ROAD_W / 2 + margin;
  for (const ax of AVENUES) if (Math.abs(x - ax) <= half) return true;
  for (const sy of STREETS) if (Math.abs(y - sy) <= half) return true;
  return false;
}

/** True when the point is inside any building. */
export function inBuilding(city, x, y) {
  for (const b of city.buildings) {
    if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return b;
  }
  return null;
}

/** The nearest point on the road network to (x, y). */
export function nearestRoadPoint(x, y) {
  let best = null;
  let bestD = Infinity;
  for (const ax of AVENUES) {
    const cx = ax;
    const cy = Math.min(Math.max(y, STREETS[0]), STREETS[STREETS.length - 1]);
    const d = (x - cx) * (x - cx) + (y - cy) * (y - cy);
    if (d < bestD) { bestD = d; best = { x: cx, y: cy }; }
  }
  for (const sy of STREETS) {
    const cx = Math.min(Math.max(x, AVENUES[0]), AVENUES[AVENUES.length - 1]);
    const cy = sy;
    const d = (x - cx) * (x - cx) + (y - cy) * (y - cy);
    if (d < bestD) { bestD = d; best = { x: cx, y: cy }; }
  }
  return best;
}

/** A random intersection, using `random`. */
export function randomIntersection(random) {
  const ax = AVENUES[Math.floor(random() * AVENUES.length)];
  const sy = STREETS[Math.floor(random() * STREETS.length)];
  return { x: ax, y: sy };
}

/** Clamp a point into the walkable city (roads, sidewalks, park, beach). */
export function clampToCity(x, y) {
  return {
    x: Math.min(Math.max(x, 60), WORLD.width - 60),
    y: Math.min(Math.max(y, 60), WORLD.height - 60),
  };
}

export { range };
