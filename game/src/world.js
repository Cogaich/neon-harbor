// Neon Harbor's simulation: the player on foot or in a car, traffic and
// pedestrians on the road grid, police that chase a wanted level, five story
// missions, shooting, pickups, and a camera that follows the action.

import {
  AVENUES, CAR, GARAGE, GUN, HOSPITAL, MISSIONS, PALETTE, PICKUPS, PIER,
  PLAYER, POLICE, ROAD_W, SAVE_KEY, STREETS, TRAFFIC_COUNT,
  TRAFFIC_SPEED, PED_COUNT, PED_SPEED, WANTED, WORLD,
} from './config.js';
import { createCity, inBuilding, nearestRoadPoint, randomIntersection } from './city.js';
import { pick, range } from './random.js';

export const EVENT_MISSION = 1;
export const EVENT_WASTED = 2;
export const EVENT_CRASH = 4;
export const EVENT_SHOT = 8;
export const EVENT_PICKUP = 16;
export const EVENT_WANTED = 32;
export const EVENT_DENIED = 64;

const TURN_CHANCE_TRAFFIC = 0.22;
const TURN_CHANCE_PED = 0.3;

/** True when a circle of radius r at (x, y) overlaps any building. */
function hitsBuilding(city, x, y, r) {
  for (const b of city.buildings) {
    if (x - r < b.x + b.w && x + r > b.x && y - r < b.y + b.h && y + r > b.y) return true;
  }
  return false;
}

function angleTo(x1, y1, x2, y2) {
  return Math.atan2(y2 - y1, x2 - x1);
}

function angleDiff(a, b) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

/** A road user: drives/walks along one road, turns at intersections. */
function spawnRoadUser(random, axis, line, speed, offset) {
  const cross = axis === 'y' ? STREETS : AVENUES;
  const pos = cross[Math.floor(random() * cross.length)] + range(random, -60, 60);
  return {
    axis,
    line,
    pos,
    dir: random() < 0.5 ? 1 : -1,
    offset,
    speed,
    color: null,
  };
}

function roadXY(v) {
  return v.axis === 'y'
    ? { x: v.line + v.offset, y: v.pos }
    : { x: v.pos, y: v.line + v.offset };
}

function advanceRoadUser(v, dt, random, turnChance) {
  const cross = v.axis === 'y' ? STREETS : AVENUES;
  const span = v.axis === 'y'
    ? [STREETS[0] - 80, STREETS[STREETS.length - 1] + 80]
    : [AVENUES[0] - 80, AVENUES[AVENUES.length - 1] + 80];
  let next = v.pos + v.dir * v.speed * dt;
  for (const line of cross) {
    const crossing = v.dir > 0 ? (v.pos < line && next >= line) : (v.pos > line && next <= line);
    if (!crossing) continue;
    if (random() < turnChance) {
      const old = roadXY(v);
      v.axis = v.axis === 'y' ? 'x' : 'y';
      v.line = line;
      v.pos = v.axis === 'y' ? old.y : old.x;
      v.dir = random() < 0.5 ? 1 : -1;
      v.offset = (random() < 0.5 ? -1 : 1) * Math.abs(v.offset);
      return;
    }
    break;
  }
  if (next < span[0]) { next = span[0]; v.dir = 1; }
  if (next > span[1]) { next = span[1]; v.dir = -1; }
  v.pos = next;
}

export function createWorld(random) {
  const city = createCity(random);
  const state = {
    time: 0,
    city,
    player: null,
    playerCar: null,
    traffic: [],
    peds: [],
    police: [],
    bullets: [],
    pickups: [],
    wanted: 0,
    lastCrimeT: -999,
    lastDecayT: 0,
    lastDeniedT: -999,
    cash: 0,
    bestCash: 0,
    health: PLAYER.health,
    ammo: GUN.magSize,
    reloadT: 0,
    fireT: 0,
    missionIndex: 0,
    stepIndex: 0,
    allDone: false,
    wasted: false,
    camera: { x: 1200, y: 700 },
    message: '',
    messageT: 0,
    policeSpawnT: 0,
    shakeT: 0,
    shakeMag: 0,
    muzzleT: 0,
  };

  function save() {
    try {
      window.localStorage.setItem(SAVE_KEY, JSON.stringify({
        cash: state.cash,
        missionIndex: state.missionIndex,
        bestCash: state.bestCash,
      }));
    } catch { /* storage off: progress lasts this visit only */ }
  }

  function load() {
    try {
      const raw = window.localStorage.getItem(SAVE_KEY);
      if (!raw) return;
      const data = JSON.parse(raw);
      state.cash = data.cash || 0;
      state.missionIndex = Math.min(data.missionIndex || 0, MISSIONS.length - 1);
      state.bestCash = data.bestCash || 0;
      if (state.missionIndex >= MISSIONS.length) state.allDone = true;
    } catch { /* corrupt save: start fresh */ }
  }

  function showMessage(text, seconds = 3) {
    state.message = text;
    state.messageT = seconds;
  }

  function addWanted(stars) {
    if (state.wanted >= WANTED.max) return 0;
    state.wanted = Math.min(WANTED.max, state.wanted + stars);
    state.lastCrimeT = state.time;
    return EVENT_WANTED;
  }

  function spawnPlayer() {
    state.player = {
      x: GARAGE.x + 60,
      y: GARAGE.y + 110,
      angle: -Math.PI / 2,
      onFoot: true,
      health: PLAYER.health,
      invulnT: 0,
      walkT: 0,
    };
    state.health = PLAYER.health;
  }

  function spawnTraffic() {
    state.traffic = [];
    for (let i = 0; i < TRAFFIC_COUNT; i += 1) {
      const vertical = random() < 0.5;
      const line = vertical
        ? AVENUES[Math.floor(random() * AVENUES.length)]
        : STREETS[Math.floor(random() * STREETS.length)];
      const car = spawnRoadUser(random, vertical ? 'y' : 'x', line, range(random, TRAFFIC_SPEED.min, TRAFFIC_SPEED.max), (random() < 0.5 ? -1 : 1) * 16);
      car.color = pick(random, PALETTE.trafficCar);
      car.parked = false;
      state.traffic.push(car);
    }
  }

  function spawnPeds() {
    state.peds = [];
    for (let i = 0; i < PED_COUNT; i += 1) {
      const vertical = random() < 0.5;
      const line = vertical
        ? AVENUES[Math.floor(random() * AVENUES.length)]
        : STREETS[Math.floor(random() * STREETS.length)];
      const offset = (random() < 0.5 ? -1 : 1) * (ROAD_W / 2 + 13);
      const ped = spawnRoadUser(random, vertical ? 'y' : 'x', line, range(random, PED_SPEED.min, PED_SPEED.max), offset);
      ped.color = pick(random, PALETTE.ped);
      ped.down = false;
      ped.downT = 0;
      state.peds.push(ped);
    }
  }

  function spawnPickups() {
    state.pickups = [];
    const spots = [
      { x: 1000, y: 520, kind: 'cash' },
      { x: 1600, y: 1500, kind: 'cash' },
      { x: 2200, y: 950, kind: 'cash' },
      { x: 400, y: 1250, kind: 'cash' },
      { x: 2800, y: 1700, kind: 'cash' },
      { x: 1300, y: 1250, kind: 'cash' },
      { x: 1600, y: 350, kind: 'cash' },
      { x: 2200, y: 1900, kind: 'cash' },
      { x: HOSPITAL.x, y: HOSPITAL.y + 40, kind: 'medkit' },
      { x: 1600, y: 2150, kind: 'medkit' },
      { x: 400, y: 800, kind: 'medkit' },
      { x: PIER.x, y: PIER.y - 60, kind: 'medkit' },
    ];
    for (const spot of spots) {
      state.pickups.push({ ...spot, active: true, respawnT: 0 });
    }
  }

  function currentMission() {
    return state.allDone ? null : MISSIONS[state.missionIndex];
  }

  function activateMission() {
    const mission = currentMission();
    if (!mission) return;
    if (mission.wantedOnStart) {
      state.wanted = mission.wantedOnStart;
      state.lastCrimeT = state.time;
    }
    showMessage(`${mission.title} — ${mission.giver}`, 4);
  }

  function completeStep() {
    const mission = currentMission();
    if (!mission) return 0;
    state.stepIndex += 1;
    if (state.stepIndex < mission.steps.length) {
      showMessage(mission.steps[state.stepIndex].label, 3);
      return 0;
    }
    state.cash += mission.reward;
    state.bestCash = Math.max(state.bestCash, state.cash);
    showMessage(`${mission.title} complete! +$${mission.reward}`, 4);
    state.missionIndex += 1;
    state.stepIndex = 0;
    if (state.missionIndex >= MISSIONS.length) {
      state.allDone = true;
      showMessage('NEON KING — you run this city now. Free roam!', 6);
    } else {
      activateMission();
    }
    save();
    return EVENT_MISSION;
  }

  function damagePlayer(amount) {
    if (state.player.invulnT > 0 || state.wasted) return 0;
    state.health -= amount;
    state.player.health = state.health;
    state.player.invulnT = 0.6;
    if (state.health <= 0) {
      state.health = 0;
      state.wasted = true;
      return EVENT_WASTED;
    }
    return 0;
  }

  function fireBullet(targetX, targetY) {
    if (state.reloadT > 0 || state.fireT > 0) return 0;
    if (!state.player.onFoot) return 0;
    if (state.ammo <= 0) {
      state.reloadT = GUN.reloadTime;
      return EVENT_DENIED;
    }
    const angle = angleTo(state.player.x, state.player.y, targetX, targetY);
    state.bullets.push({
      x: state.player.x + Math.cos(angle) * 20,
      y: state.player.y + Math.sin(angle) * 20,
      vx: Math.cos(angle) * GUN.bulletSpeed,
      vy: Math.sin(angle) * GUN.bulletSpeed,
      life: GUN.range / GUN.bulletSpeed,
    });
    state.ammo -= 1;
    state.fireT = GUN.fireInterval;
    state.player.angle = angle;
    state.muzzleT = 0.06;
    return EVENT_SHOT;
  }

  function nearestCar(maxDist) {
    let best = null;
    let bestD = maxDist;
    const px = state.player.x;
    const py = state.player.y;
    for (const car of state.traffic) {
      const p = roadXY(car);
      const d = Math.hypot(p.x - px, p.y - py);
      if (d < bestD) { bestD = d; best = car; }
    }
    return best;
  }

  function enterCar() {
    if (!state.player.onFoot) {
      // Get out: leave the car parked where it is.
      const car = state.playerCar;
      const px = car.x + Math.cos(car.angle + Math.PI / 2) * 34;
      const py = car.y + Math.sin(car.angle + Math.PI / 2) * 34;
      state.player.x = px;
      state.player.y = py;
      state.player.onFoot = true;
      state.playerCar = null;
      state.traffic.push({
        axis: 'x', line: Math.round(car.y), pos: Math.round(car.x),
        dir: 1, offset: 0, speed: 0, color: car.color, parked: true, angle: car.angle,
      });
      return 0;
    }
    const car = nearestCar(PLAYER.enterRange);
    if (!car) return EVENT_DENIED;
    const p = roadXY(car);
    state.traffic.splice(state.traffic.indexOf(car), 1);
    state.playerCar = {
      x: p.x, y: p.y,
      angle: car.axis === 'y' ? (car.dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (car.dir > 0 ? 0 : Math.PI),
      speed: 0, color: car.color, health: 100,
    };
    state.player.onFoot = false;
    state.player.x = p.x;
    state.player.y = p.y;
    // The driver climbs out onto the sidewalk and walks away, annoyed.
    state.peds.push({
      axis: car.axis, line: car.line, pos: car.pos, dir: car.dir,
      offset: (car.offset >= 0 ? 1 : -1) * (ROAD_W / 2 + 13),
      speed: 60, color: pick(random, PALETTE.ped), down: false, downT: 0,
    });
    return addWanted(WANTED.stealStars);
  }

  function spawnPolice() {
    const target = Math.min(state.wanted, POLICE.maxActive);
    if (state.police.length >= target) return;
    const spot = nearestRoadPoint(
      state.player.x + (random() < 0.5 ? -1 : 1) * range(random, 650, 900),
      state.player.y + (random() < 0.5 ? -1 : 1) * range(random, 650, 900),
    );
    state.police.push({
      x: spot.x, y: spot.y, angle: 0, speed: 0,
      health: POLICE.health, ramT: 0, disabled: false, disabledT: 0,
    });
  }

  function stepPlayer(dt, input) {
    const p = state.player;
    if (p.invulnT > 0) p.invulnT -= dt;
    if (state.wasted) return 0;
    let events = 0;

    if (p.onFoot) {
      const ax = input.ax;
      const ay = input.ay;
      const len = Math.hypot(ax, ay);
      if (len > 0) {
        const stepX = (ax / len) * PLAYER.walkSpeed * dt;
        const stepY = (ay / len) * PLAYER.walkSpeed * dt;
        p.angle = Math.atan2(ay, ax);
        p.walkT += dt;
        const nx = p.x + stepX;
        const ny = p.y + stepY;
        if (!hitsBuilding(state.city, nx, p.y, PLAYER.radius)) p.x = nx;
        if (!hitsBuilding(state.city, p.x, ny, PLAYER.radius)) p.y = ny;
        if (p.y > state.city.waterTop - 12) p.y = state.city.waterTop - 12;
        p.x = Math.min(Math.max(p.x, 40), WORLD.width - 40);
        p.y = Math.min(Math.max(p.y, 40), WORLD.height - 40);
      }
      if (input.mouseDown) events |= fireBullet(input.mouseX, input.mouseY);
    } else {
      const car = state.playerCar;
      const steer = input.ax;
      const throttle = -input.ay;
      if (throttle > 0) car.speed += CAR.accel * dt;
      else if (throttle < 0) {
        if (car.speed > 10) car.speed -= CAR.brake * dt;
        else car.speed -= CAR.reverseAccel * dt;
      } else {
        car.speed -= car.speed * 0.5 * dt;
      }
      car.speed = Math.min(Math.max(car.speed, -CAR.maxReverse), CAR.maxSpeed);
      const speedFactor = Math.min(Math.abs(car.speed) / 220, 1) * Math.sign(car.speed || 1);
      car.angle += steer * CAR.turnRate * speedFactor * dt;
      const nx = car.x + Math.cos(car.angle) * car.speed * dt;
      const ny = car.y + Math.sin(car.angle) * car.speed * dt;
      if (!hitsBuilding(state.city, nx, car.y, 22)) car.x = nx;
      if (!hitsBuilding(state.city, car.x, ny, 22)) car.y = ny;
      if (car.y > state.city.waterTop - 16) { car.y = state.city.waterTop - 16; car.speed *= 0.5; }
      car.x = Math.min(Math.max(car.x, 40), WORLD.width - 40);
      car.y = Math.min(Math.max(car.y, 40), WORLD.height - 40);
      if (Math.abs(car.speed) < 8 && throttle === 0) car.speed = 0;
      p.x = car.x;
      p.y = car.y;
    }
    return events;
  }

  function stepTraffic(dt) {
    for (const car of state.traffic) {
      if (car.parked) continue;
      advanceRoadUser(car, dt, random, TURN_CHANCE_TRAFFIC);
    }
    // Gentle separation so cars do not stack on one lane.
    for (let i = 0; i < state.traffic.length; i += 1) {
      for (let j = i + 1; j < state.traffic.length; j += 1) {
        const a = state.traffic[i];
        const b = state.traffic[j];
        if (a.parked || b.parked) continue;
        const pa = roadXY(a);
        const pb = roadXY(b);
        const dx = pb.x - pa.x;
        const dy = pb.y - pa.y;
        const d = Math.hypot(dx, dy);
        if (d > 0.01 && d < 44) {
          const push = (44 - d) / 4;
          const ux = dx / d;
          a.offset = Math.min(Math.max(a.offset - ux * push * 0.4, -40), 40);
          b.offset = Math.min(Math.max(b.offset + ux * push * 0.4, -40), 40);
        }
      }
    }
  }

  function stepPeds(dt) {
    for (const ped of state.peds) {
      if (ped.down) {
        ped.downT -= dt;
        continue;
      }
      advanceRoadUser(ped, dt, random, TURN_CHANCE_PED);
    }
    state.peds = state.peds.filter((ped) => !ped.down || ped.downT > -6);
  }

  function stepPolice(dt) {
    let events = 0;
    const p = state.player;
    for (const cop of state.police) {
      if (cop.disabled) {
        cop.disabledT -= dt;
        continue;
      }
      if (cop.ramT > 0) cop.ramT -= dt;
      const target = angleTo(cop.x, cop.y, p.x, p.y);
      const diff = angleDiff(cop.angle, target);
      cop.angle += Math.max(-POLICE.turnRate * dt, Math.min(POLICE.turnRate * dt, diff));
      const dist = Math.hypot(p.x - cop.x, p.y - cop.y);
      cop.speed = Math.min(cop.speed + POLICE.accel * dt, POLICE.maxSpeed);
      if (dist < 120) cop.speed = Math.min(cop.speed, 300);
      const nx = cop.x + Math.cos(cop.angle) * cop.speed * dt;
      const ny = cop.y + Math.sin(cop.angle) * cop.speed * dt;
      if (!hitsBuilding(state.city, nx, cop.y, 22)) cop.x = nx;
      if (!hitsBuilding(state.city, cop.x, ny, 22)) cop.y = ny;
      if (cop.y > state.city.waterTop - 16) cop.y = state.city.waterTop - 16;
      if (dist < 46 && cop.ramT <= 0) {
        cop.ramT = POLICE.ramCooldown;
        cop.speed *= -0.3;
        events |= damagePlayer(state.player.onFoot ? POLICE.ramDamage : Math.round(POLICE.ramDamage * 0.6));
        if (Math.abs(cop.speed) > 200) events |= EVENT_CRASH;
      }
    }
    state.police = state.police.filter((cop) => {
      if (cop.disabled && cop.disabledT <= 0) return false;
      if (state.wanted === 0) {
        const d = Math.hypot(cop.x - p.x, cop.y - p.y);
        if (d > 1100) return false;
      }
      return true;
    });
    return events;
  }

  function stepBullets(dt) {
    let events = 0;
    for (const b of state.bullets) {
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
      if (b.life <= 0) continue;
      if (inBuilding(state.city, b.x, b.y)) { b.life = 0; continue; }
      for (const ped of state.peds) {
        if (ped.down) continue;
        const pos = roadXY(ped);
        if (Math.hypot(pos.x - b.x, pos.y - b.y) < 13) {
          ped.down = true;
          ped.downT = 6;
          b.life = 0;
          events |= addWanted(WANTED.hitPedStars);
          break;
        }
      }
      if (b.life <= 0) continue;
      for (const cop of state.police) {
        if (cop.disabled) continue;
        if (Math.hypot(cop.x - b.x, cop.y - b.y) < 26) {
          cop.health -= GUN.damage;
          b.life = 0;
          if (cop.health <= 0) {
            cop.disabled = true;
            cop.disabledT = 6;
            events |= addWanted(WANTED.killCopStars);
          }
          break;
        }
      }
    }
    state.bullets = state.bullets.filter((b) => b.life > 0);
    return events;
  }

  function stepPickups(dt) {
    let events = 0;
    for (const item of state.pickups) {
      if (!item.active) {
        item.respawnT -= dt;
        if (item.respawnT <= 0) item.active = true;
        continue;
      }
      const d = Math.hypot(item.x - state.player.x, item.y - state.player.y);
      if (d < 34) {
        item.active = false;
        item.respawnT = 25;
        if (item.kind === 'cash') {
          state.cash += PICKUPS.cashValue;
          state.bestCash = Math.max(state.bestCash, state.cash);
          showMessage(`+$${PICKUPS.cashValue} cash`, 1.5);
        } else {
          state.health = Math.min(PLAYER.health, state.health + PICKUPS.medkitHeal);
          state.player.health = state.health;
          showMessage(`+${PICKUPS.medkitHeal} health`, 1.5);
        }
        save();
        events |= EVENT_PICKUP;
      }
    }
    return events;
  }

  function stepMissions() {
    const mission = currentMission();
    if (!mission) return 0;
    const step = mission.steps[state.stepIndex];
    if (!step) return 0;
    if (step.kind === 'lose-cops') {
      if (state.wanted === 0) return completeStep();
      return 0;
    }
    const d = Math.hypot(step.x - state.player.x, step.y - state.player.y);
    if (d > step.r) return 0;
    if (step.mode === 'car' && state.player.onFoot) {
      if (state.time - state.lastDeniedT > 2) {
        state.lastDeniedT = state.time;
        showMessage('You need a car for this.', 1.5);
        return EVENT_DENIED;
      }
      return 0;
    }
    if (step.mode === 'foot' && !state.player.onFoot) {
      if (state.time - state.lastDeniedT > 2) {
        state.lastDeniedT = state.time;
        showMessage('On foot for this one — park the car.', 1.5);
        return EVENT_DENIED;
      }
      return 0;
    }
    return completeStep();
  }

  function stepCarVsWorld() {
    // Player car running over pedestrians, and bumping traffic.
    let events = 0;
    const car = state.playerCar;
    if (!car) return 0;
    for (const ped of state.peds) {
      if (ped.down) continue;
      const pos = roadXY(ped);
      if (Math.hypot(pos.x - car.x, pos.y - car.y) < 26 && Math.abs(car.speed) > 120) {
        ped.down = true;
        ped.downT = 6;
        events |= addWanted(WANTED.hitPedStars);
        events |= EVENT_CRASH;
      }
    }
    for (const other of state.traffic) {
      if (other.parked) continue;
      const pos = roadXY(other);
      const d = Math.hypot(pos.x - car.x, pos.y - car.y);
      if (d < 44 && d > 0.01) {
        const push = (44 - d) / 2;
        const ux = (car.x - pos.x) / d;
        const uy = (car.y - pos.y) / d;
        car.x += ux * push;
        car.y += uy * push;
        if (Math.abs(car.speed) > 260) events |= EVENT_CRASH;
        car.speed *= 0.92;
      }
    }
    return events;
  }

  function reset() {
    state.time = 0;
    state.wanted = 0;
    state.lastCrimeT = -999;
    state.cash = 0;
    state.bestCash = 0;
    state.health = PLAYER.health;
    state.ammo = GUN.magSize;
    state.reloadT = 0;
    state.fireT = 0;
    state.missionIndex = 0;
    state.stepIndex = 0;
    state.allDone = false;
    state.wasted = false;
    state.bullets = [];
    state.police = [];
    state.playerCar = null;
    state.message = '';
    state.messageT = 0;
    spawnPlayer();
    spawnTraffic();
    spawnPeds();
    spawnPickups();
    state.camera.x = state.player.x;
    state.camera.y = state.player.y;
  }

  function respawnAfterWasted() {
    state.wasted = false;
    state.health = PLAYER.health;
    state.player.health = PLAYER.health;
    state.cash = Math.floor(state.cash * 0.8);
    state.wanted = 0;
    state.police = [];
    state.playerCar = null;
    state.player.onFoot = true;
    state.player.x = HOSPITAL.x;
    state.player.y = HOSPITAL.y;
    state.player.angle = -Math.PI / 2;
    showMessage('You woke up at the hospital. 20% of your cash is gone.', 4);
    save();
  }

  function step(dt, input, demo) {
    let events = 0;
    state.time += dt;
    if (state.reloadT > 0) state.reloadT -= dt;
    if (state.fireT > 0) state.fireT -= dt;
    if (state.messageT > 0) state.messageT -= dt;
    if (state.shakeT > 0) state.shakeT -= dt;
    if (state.muzzleT > 0) state.muzzleT -= dt;
    if (state.reloadT <= 0 && state.ammo === 0) {
      state.ammo = GUN.magSize;
    }

    if (!demo) {
      if (input.actions & 4) events |= enterCar();
      events |= stepPlayer(dt, input);
      events |= stepCarVsWorld();
    } else {
      // Title-screen idle: the city lives, the player waits.
      state.player.walkT += dt;
    }

    stepTraffic(dt);
    stepPeds(dt);
    events |= stepPolice(dt);
    events |= stepBullets(dt);
    events |= stepPickups(dt);

    // Wanted level: police arrive, and the heat cools off when quiet.
    if (state.wanted > 0) {
      state.policeSpawnT -= dt;
      if (state.policeSpawnT <= 0) {
        spawnPolice();
        state.policeSpawnT = POLICE.spawnInterval;
      }
      if (state.time - state.lastCrimeT > WANTED.decayDelay) {
        if (state.time - state.lastDecayT > WANTED.decayInterval) {
          state.lastDecayT = state.time;
          state.wanted = Math.max(0, state.wanted - 1);
        }
      }
    }

    if (!demo) events |= stepMissions();

    // Juice: a short, diminishing shake on hard impacts, sparingly.
    if (events & EVENT_CRASH) {
      state.shakeT = 0.15;
      state.shakeMag = 7;
    }

    // What the renderer shows as the current objective and marker.
    const mission = currentMission();
    state._mission = mission
      ? { title: mission.title, step: mission.steps[state.stepIndex] || null }
      : null;

    // Camera follows the player with a little look-ahead toward where the
    // player is heading, clamped inside the city.
    const cam = state.camera;
    let lookX = 0;
    let lookY = 0;
    if (state.playerCar) {
      const ahead = Math.min(Math.abs(state.playerCar.speed) * 0.14, 90);
      lookX = Math.cos(state.playerCar.angle) * ahead;
      lookY = Math.sin(state.playerCar.angle) * ahead;
    } else {
      lookX = Math.cos(state.player.angle) * 26;
      lookY = Math.sin(state.player.angle) * 26;
    }
    cam.x += (state.player.x + lookX - cam.x) * Math.min(1, dt * 5);
    cam.y += (state.player.y + lookY - cam.y) * Math.min(1, dt * 5);
    cam.x = Math.min(Math.max(cam.x, 640), WORLD.width - 640);
    cam.y = Math.min(Math.max(cam.y, 360), WORLD.height - 360);

    return events;
  }

  reset();
  load();
  activateMission();

  return {
    state,
    step,
    reset,
    respawnAfterWasted,
    save,
    load,
    currentMission,
    activateMission,
    addWanted,
    fireBullet,
    roadXY,
  };
}
