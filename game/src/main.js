// Boot and the one loop: input is read every frame, the world advances in
// fixed 1/60 s steps (several in a slow frame, none in a fast one), and the
// renderer paints what is there. The game moves between four screens: title,
// play, paused and game over.
//
// ?seed=N fixes the city. ?shot=start|play|chase|end (with &seed=N) stages
// that scene instead of running the loop, paints it twice and sets
// window.__shotReady for a screenshot.
import { SAVE_KEY, STEP } from './config.js';
import { createRandom } from './random.js';
import { createWorld, EVENT_CRASH, EVENT_DENIED, EVENT_MISSION, EVENT_PICKUP, EVENT_SHOT, EVENT_WANTED, EVENT_WASTED } from './world.js';
import { ACTION_CONFIRM, ACTION_ENTER, ACTION_NEWGAME, ACTION_PAUSE, ACTION_RELOAD, createInput } from './input.js';
import { createRenderer, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE } from './render.js';
import { createAudio } from './audio.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped, not replayed. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(createRandom(seed));
const renderer = createRenderer(canvas);
const audio = createAudio();

function readSaveMeta() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return { hasSave: false, cash: 0, missionIndex: 0, bestCash: 0 };
    const data = JSON.parse(raw);
    return {
      hasSave: true,
      cash: data.cash || 0,
      missionIndex: data.missionIndex || 0,
      bestCash: data.bestCash || 0,
    };
  } catch {
    return { hasSave: false, cash: 0, missionIndex: 0, bestCash: 0 };
  }
}

function runShot(name) {
  const scene = stageShot(name, world);
  const meta = { roadXY: world.roadXY, ...readSaveMeta() };
  let painted = 0;
  function paint() {
    renderer.draw(world.state, scene.screen, meta);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  const meta = { roadXY: world.roadXY, ...readSaveMeta() };
  let accumulator = 0;
  let last = performance.now();

  // Screen readers (and anyone watching the page's text) hear the screen changes.
  function announce(message) {
    status.textContent = message;
  }

  function refreshMeta() {
    const saved = readSaveMeta();
    meta.hasSave = saved.hasSave;
    meta.cash = saved.cash;
    meta.missionIndex = saved.missionIndex;
    meta.bestCash = saved.bestCash;
  }

  function startGame() {
    audio.unlock();
    world.reset();
    world.save();
    world.activateMission();
    refreshMeta();
    accumulator = 0;
    screen = SCREEN_PLAY;
    announce('Playing. Neon Harbor is yours.');
  }

  function continueGame() {
    audio.unlock();
    world.load();
    world.activateMission();
    refreshMeta();
    accumulator = 0;
    screen = SCREEN_PLAY;
    announce('Playing. Welcome back to Neon Harbor.');
  }

  function endGame() {
    screen = SCREEN_OVER;
    refreshMeta();
    announce(`Wasted. Cash kept $${world.state.cash}.`);
  }

  function handleEvents(events) {
    if (events & EVENT_CRASH) audio.crash();
    if (events & EVENT_SHOT) audio.shoot();
    if (events & EVENT_PICKUP) audio.pickup();
    if (events & EVENT_WANTED) audio.wanted();
    if (events & EVENT_MISSION) audio.mission();
    if (events & EVENT_DENIED) audio.denied();
    if (events & EVENT_WASTED) endGame();
  }

  function handleActions(actions) {
    if (input.takeMute()) {
      audio.setMuted(!audio.isMuted());
      announce(audio.isMuted() ? 'Muted.' : 'Sound on.');
    }
    if (screen === SCREEN_TITLE) {
      if (actions & ACTION_NEWGAME) startGame();
      else if (actions & ACTION_CONFIRM) {
        // Space plays: continue a save when one exists, else start fresh.
        if (meta.hasSave) continueGame();
        else startGame();
      }
      return;
    }
    if (screen === SCREEN_OVER) {
      if (actions & ACTION_CONFIRM) {
        world.respawnAfterWasted();
        refreshMeta();
        screen = SCREEN_PLAY;
        announce('Playing. Back on the streets.');
      }
      return;
    }
    if (actions & ACTION_PAUSE && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    } else if (actions & (ACTION_PAUSE | ACTION_CONFIRM) && screen === SCREEN_PAUSED) {
      screen = SCREEN_PLAY;
      announce('Playing.');
    }
  }

  function stepInput() {
    const mouse = input.mouse();
    const target = renderer.screenToWorld(mouse.x, mouse.y);
    return {
      ax: input.axisX(),
      ay: input.axisY(),
      actions: 0,
      mouseDown: input.mouseDown(),
      mouseX: target.x,
      mouseY: target.y,
    };
  }

  function step(actions) {
    if (screen === SCREEN_TITLE) {
      world.step(STEP, { ax: 0, ay: 0, actions: 0, mouseDown: false, mouseX: 0, mouseY: 0 }, true);
      return;
    }
    const stepData = stepInput();
    // One-shot presses are read by the world as flags on the input.
    stepData.actions = actions & (ACTION_ENTER | ACTION_RELOAD);
    const events = world.step(STEP, stepData, false);
    handleEvents(events);
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    const actions = input.takeActions();
    handleActions(actions);
    if (screen === SCREEN_TITLE || screen === SCREEN_PLAY) {
      while (accumulator >= STEP && (screen === SCREEN_TITLE || screen === SCREEN_PLAY)) {
        step(actions);
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    // Continuous sounds follow the world.
    const state = world.state;
    if (screen === SCREEN_PLAY) {
      audio.engine(state.playerCar ? Math.abs(state.playerCar.speed) / 565 : 0);
      let copNear = false;
      for (const cop of state.police) {
        if (!cop.disabled && Math.hypot(cop.x - state.player.x, cop.y - state.player.y) < 750) copNear = true;
      }
      audio.siren(copNear, state.time);
    } else {
      audio.engine(0);
      audio.siren(false, state.time);
    }
    renderer.draw(state, screen, meta);
  }

  // Leaving the tab pauses a running game rather than letting the city move unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  announce('Neon Harbor. Press Space to play, N for a new game.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
