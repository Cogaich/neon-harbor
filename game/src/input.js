// Keyboard and mouse input. Held keys steer; one-shot presses (enter a car,
// pause, reload, start) are queued as bit flags and taken once by the loop,
// so a press between two frames is never lost and never counted twice.

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_ENTER = 4;
export const ACTION_RELOAD = 8;
export const ACTION_NEWGAME = 16;

const UP = new Set(['KeyW', 'ArrowUp']);
const DOWN = new Set(['KeyS', 'ArrowDown']);
const LEFT = new Set(['KeyA', 'ArrowLeft']);
const RIGHT = new Set(['KeyD', 'ArrowRight']);
const CONFIRM = new Set(['Space', 'Enter']);
const PAUSE = new Set(['KeyP', 'Escape']);
const ENTER = new Set(['KeyE']);
const RELOAD = new Set(['KeyR']);
const NEWGAME = new Set(['KeyN']);
const MUTE = new Set(['KeyM']);

export function createInput(canvas) {
  const keys = new Set();
  let actions = 0;
  let mouseX = 0;
  let mouseY = 0;
  let mouseDown = false;
  let mutePressed = false;

  window.addEventListener('keydown', (event) => {
    if (MUTE.has(event.code)) {
      if (!event.repeat) mutePressed = true;
      return;
    }
    keys.add(event.code);
    if (CONFIRM.has(event.code) && !event.repeat) actions |= ACTION_CONFIRM;
    else if (PAUSE.has(event.code) && !event.repeat) actions |= ACTION_PAUSE;
    else if (ENTER.has(event.code) && !event.repeat) actions |= ACTION_ENTER;
    else if (RELOAD.has(event.code) && !event.repeat) actions |= ACTION_RELOAD;
    else if (NEWGAME.has(event.code) && !event.repeat) actions |= ACTION_NEWGAME;
    if (UP.has(event.code) || DOWN.has(event.code) || LEFT.has(event.code) || RIGHT.has(event.code)
      || CONFIRM.has(event.code) || PAUSE.has(event.code)) {
      event.preventDefault();
    }
  });
  window.addEventListener('keyup', (event) => {
    keys.delete(event.code);
  });
  window.addEventListener('blur', () => {
    keys.clear();
    mouseDown = false;
  });
  canvas.addEventListener('pointermove', (event) => {
    const rect = canvas.getBoundingClientRect();
    mouseX = event.clientX - rect.left;
    mouseY = event.clientY - rect.top;
  });
  canvas.addEventListener('pointerdown', (event) => {
    const rect = canvas.getBoundingClientRect();
    mouseX = event.clientX - rect.left;
    mouseY = event.clientY - rect.top;
    mouseDown = true;
    actions |= ACTION_CONFIRM;
  });
  window.addEventListener('pointerup', () => {
    mouseDown = false;
  });

  const has = (...codes) => codes.some((c) => keys.has(c));

  return {
    /** Steering: -1/0/1 on each axis, from WASD or the arrow keys. */
    axisX() { return (has('KeyD', 'ArrowRight') ? 1 : 0) - (has('KeyA', 'ArrowLeft') ? 1 : 0); },
    axisY() { return (has('KeyS', 'ArrowDown') ? 1 : 0) - (has('KeyW', 'ArrowUp') ? 1 : 0); },
    /** The one-shot presses since the last call, as ACTION_* flags. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
    /** True once when M was pressed since the last call. */
    takeMute() {
      const taken = mutePressed;
      mutePressed = false;
      return taken;
    },
    mouseDown: () => mouseDown,
    mouse() { return { x: mouseX, y: mouseY }; },
  };
}
