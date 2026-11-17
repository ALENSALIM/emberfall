// Keyboard and mouse, and nothing else: the game is played with WASD or the
// arrow keys to walk, Space or a mouse click for a flare, P or Escape to pause,
// M to mute, R to restart, Enter to confirm a menu button.

export const ACTION_CONFIRM = 'confirm';
export const ACTION_PAUSE = 'pause';
export const ACTION_MUTE = 'mute';
export const ACTION_RESTART = 'restart';
export const ACTION_FLARE = 'flare';

const KEY_ACTIONS = {
  Enter: ACTION_CONFIRM,
  ' ': ACTION_FLARE,
  p: ACTION_PAUSE,
  P: ACTION_PAUSE,
  Escape: ACTION_PAUSE,
  m: ACTION_MUTE,
  M: ACTION_MUTE,
  r: ACTION_RESTART,
  R: ACTION_RESTART,
};

const MOVE_KEYS = {
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
  a: [-1, 0],
  A: [-1, 0],
  d: [1, 0],
  D: [1, 0],
  w: [0, -1],
  W: [0, -1],
  s: [0, 1],
  S: [0, 1],
};

/**
 * Listen on the window and the canvas. Actions are edge-triggered: takeAction
 * answers true once per key press or click, then forgets it. The movement
 * vector is live: read it every frame.
 */
export function createInput(canvas) {
  const held = new Set();
  const queued = [];
  let mouseX = 0;
  let mouseY = 0;
  let mouseDown = false;

  function onKeyDown(event) {
    if (event.key === ' ' || event.key.startsWith('Arrow')) event.preventDefault();
    held.add(event.key);
    const action = KEY_ACTIONS[event.key];
    if (action && !event.repeat) queued.push(action);
  }

  function onKeyUp(event) {
    held.delete(event.key);
  }

  function onBlur() {
    held.clear();
  }

  function toCanvas(event) {
    const rect = canvas.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  function onMouseMove(event) {
    const point = toCanvas(event);
    mouseX = point.x;
    mouseY = point.y;
  }

  function onMouseDown(event) {
    const point = toCanvas(event);
    mouseX = point.x;
    mouseY = point.y;
    mouseDown = true;
    queued.push(ACTION_FLARE);
  }

  function onMouseUp() {
    mouseDown = false;
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onBlur);
  canvas.addEventListener('mousemove', onMouseMove);
  canvas.addEventListener('mousedown', onMouseDown);
  window.addEventListener('mouseup', onMouseUp);

  return {
    /** The movement direction right now, normalised, or {x: 0, y: 0}. */
    move() {
      let x = 0;
      let y = 0;
      for (const key of held) {
        const step = MOVE_KEYS[key];
        if (step) {
          x += step[0];
          y += step[1];
        }
      }
      if (x === 0 && y === 0) return { x: 0, y: 0 };
      const length = Math.hypot(x, y);
      return { x: x / length, y: y / length };
    },
    /** True once for each press of the action since the last call. */
    takeAction(action) {
      const index = queued.indexOf(action);
      if (index === -1) return false;
      queued.splice(index, 1);
      return true;
    },
    /** True while any flare key or the mouse button is held. */
    flareHeld() {
      return mouseDown || held.has(' ');
    },
    /** The mouse position in canvas pixels. */
    mouse() {
      return { x: mouseX, y: mouseY };
    },
  };
}
