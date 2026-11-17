// The screenshot scenes behind ?shot=start|play|chase|harbor|end. Each one
// stages a real game state from a fresh world with a fixed seed, then plays
// it forward with scripted inputs, so the frame is what a short game really
// looks like and the same seed always gives the same frame.

import { STEP } from './config.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE } from './render.js';

const IDLE_SECONDS = 4;
const PLAY_SECONDS = 3;
const CHASE_SECONDS = 3;
const HARBOR_SECONDS = 2.5;
const END_SECONDS = 2;

/** Put the player behind the wheel at (x, y), facing `angle`, at `speed`. */
function stageDriving(world, x, y, angle, speed) {
  const state = world.state;
  state.playerCar = {
    x,
    y,
    angle,
    speed,
    color: '#2ee6a8',
    health: 100,
  };
  state.player.onFoot = false;
  state.player.x = x;
  state.player.y = y;
  state.player.angle = angle;
  state.camera.x = x;
  state.camera.y = y;
}

/** Full throttle, no steering: the staged car holds its line down the road. */
function driveInput() {
  return { ax: 0, ay: -1, actions: 0, mouseDown: false, mouseX: 0, mouseY: 0 };
}

const IDLE_INPUT = { ax: 0, ay: 0, actions: 0, mouseDown: false, mouseX: 0, mouseY: 0 };

/**
 * Set `world` to the named scene (start, play, chase, harbor or end; any
 * other name is start) and return the screen to draw over it.
 */
export function stageShot(name, world) {
  const state = world.state;
  world.reset();
  if (name !== 'play' && name !== 'chase' && name !== 'harbor' && name !== 'end') {
    for (let i = 0; i < IDLE_SECONDS / STEP; i += 1) world.step(STEP, IDLE_INPUT, true);
    return { screen: SCREEN_TITLE };
  }
  if (name === 'end') {
    // The payoff: every job done, the city is yours, cash in the bank.
    state.allDone = true;
    state.missionIndex = 7;
    state.cash = 5300;
    state.bestCash = 5300;
    // Parked on the avenue beside the park, engine idling, king of the city.
    stageDriving(world, 1600, 1000, Math.PI / 2, 0);
    state.message = 'NEON KING — you run this city now. Free roam!';
    state.messageT = 6;
    for (let i = 0; i < END_SECONDS / STEP; i += 1) world.step(STEP, IDLE_INPUT, true);
    return { screen: SCREEN_PLAY };
  }
  if (name === 'chase') {
    // The cover: four stars, six cruisers on the tail, a roadblock looming
    // ahead, and the penthouse marker far off-screen so the arrow shows.
    stageDriving(world, 1600, 350, Math.PI / 2, 340);
    state.missionIndex = 6;
    state.stepIndex = 0;
    state.message = 'Job 7 — The Last Getaway — Marlo';
    state.messageT = 4;
    world.addWanted(4);
    // Six cruisers already on the tail, close in and spread by speed and
    // lane so they read as a swarm behind the player instead of one car:
    // the fastest stay on the bumper, the slower ones trail further back,
    // and each one holds its own sideways lane.
    state.police.push(
      { x: 1550, y: 300, angle: Math.PI / 2, speed: 545, health: 60, ramT: 0, disabled: false, disabledT: 0, lane: -50 },
      { x: 1650, y: 320, angle: Math.PI / 2, speed: 530, health: 60, ramT: 0, disabled: false, disabledT: 0, lane: -25 },
      { x: 1480, y: 290, angle: Math.PI / 2, speed: 515, health: 60, ramT: 0, disabled: false, disabledT: 0, lane: 0 },
      { x: 1720, y: 310, angle: Math.PI / 2, speed: 500, health: 60, ramT: 0, disabled: false, disabledT: 0, lane: 25 },
      { x: 1420, y: 330, angle: Math.PI / 2, speed: 545, health: 60, ramT: 0, disabled: false, disabledT: 0, lane: 50 },
      { x: 1780, y: 300, angle: Math.PI / 2, speed: 520, health: 60, ramT: 0, disabled: false, disabledT: 0, lane: -40 },
    );
    for (let i = 0; i < CHASE_SECONDS / STEP; i += 1) {
      world.step(STEP, driveInput(), false);
    }
    return { screen: SCREEN_PLAY };
  }
  if (name === 'harbor') {
    // The coast: driving east on the sand past the piers, the sea below,
    // the clock-run timer ticking and the east pier marker ahead.
    stageDriving(world, 1500, 2280, 0, 200);
    state.missionIndex = 5;
    state.stepIndex = 1;
    state.message = '';
    state.messageT = 0;
    for (let i = 0; i < HARBOR_SECONDS / STEP; i += 1) {
      world.step(STEP, driveInput(), false);
    }
    // The timed step posts its own banner while the drive runs; clear it so
    // the frame shows the countdown pill instead of a second banner.
    state.message = '';
    state.messageT = 0;
    return { screen: SCREEN_PLAY };
  }
  stageDriving(world, 1600, 350, Math.PI / 2, 300);
  for (let i = 0; i < PLAY_SECONDS / STEP; i += 1) {
    world.step(STEP, driveInput(), false);
  }
  return { screen: SCREEN_PLAY };
}
