// The screenshot scenes behind ?shot=start|play|chase|end. Each one stages a
// real game state from a fresh world with a fixed seed, then plays it forward
// with scripted inputs, so the frame is what a short game really looks like
// and the same seed always gives the same frame.

import { STEP } from './config.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE } from './render.js';

const IDLE_SECONDS = 4;
const PLAY_SECONDS = 3;
const CHASE_SECONDS = 3.5;

/** Put the player behind the wheel on the main avenue, heading south. */
function stageDriving(world, speed) {
  const state = world.state;
  state.playerCar = {
    x: 1600,
    y: 350,
    angle: Math.PI / 2,
    speed,
    color: '#2ee6a8',
    health: 100,
  };
  state.player.onFoot = false;
  state.player.x = 1600;
  state.player.y = 350;
  state.player.angle = Math.PI / 2;
  state.camera.x = 1600;
  state.camera.y = 350;
}

function driveInput() {
  // Dead straight down the avenue: any steering drifts the car off the road.
  return { ax: 0, ay: -1, actions: 0, mouseDown: false, mouseX: 0, mouseY: 0 };
}

const IDLE_INPUT = { ax: 0, ay: 0, actions: 0, mouseDown: false, mouseX: 0, mouseY: 0 };

/**
 * Set `world` to the named scene (start, play, chase or end; any other name is
 * start) and return the screen to draw over it.
 */
export function stageShot(name, world) {
  const state = world.state;
  world.reset();
  if (name !== 'play' && name !== 'chase' && name !== 'end') {
    for (let i = 0; i < IDLE_SECONDS / STEP; i += 1) world.step(STEP, IDLE_INPUT, true);
    return { screen: SCREEN_TITLE };
  }
  if (name === 'end') {
    // The payoff: every job done, the city is yours, cash in the bank.
    state.allDone = true;
    state.missionIndex = 5;
    state.cash = 3200;
    state.bestCash = 3200;
    state.player.x = 1300;
    state.player.y = 1025;
    state.player.angle = -Math.PI / 2;
    state.camera.x = 1300;
    state.camera.y = 1025;
    state.message = 'NEON KING — you run this city now. Free roam!';
    state.messageT = 6;
    for (let i = 0; i < 2 / STEP; i += 1) world.step(STEP, IDLE_INPUT, true);
    return { screen: SCREEN_PLAY };
  }
  if (name === 'chase') {
    stageDriving(world, 340);
    world.addWanted(3);
    // Two cruisers already on the tail, close enough to stay in frame,
    // staggered so they do not stack on one another.
    state.police.push(
      { x: 1510, y: 90, angle: Math.PI / 2, speed: 380, health: 60, ramT: 0, disabled: false, disabledT: 0 },
      { x: 1700, y: -350, angle: Math.PI / 2, speed: 340, health: 60, ramT: 0, disabled: false, disabledT: 0 },
    );
    for (let i = 0; i < CHASE_SECONDS / STEP; i += 1) {
      world.step(STEP, driveInput(), false);
    }
    return { screen: SCREEN_PLAY };
  }
  stageDriving(world, 300);
  for (let i = 0; i < PLAY_SECONDS / STEP; i += 1) {
    world.step(STEP, driveInput(), false);
  }
  return { screen: SCREEN_PLAY };
}
