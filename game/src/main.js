// Emberfall — boot and the one loop: input is read every frame, the world
// advances in fixed 1/60 s steps, and the renderer paints what is there. The
// game moves between five screens: title, play, paused, game over and dawn.
//
// ?seed=N fixes the night's pattern. ?shot=start|play|win|end (with &seed=N)
// stages that scene instead of running the loop, paints it twice and sets
// window.__shotReady for a screenshot. ?selftest=1 runs the rules headlessly
// for a few thousand steps and writes the results into the status line.

import { BEST_KEY, STEP, WAVES } from './config.js';
import { createRandom } from './random.js';
import { createWorld, EVENT_FLARE, EVENT_HIT, EVENT_OVER, EVENT_PICKUP, EVENT_POWERUP, EVENT_WAVE, EVENT_WIN } from './world.js';
import { ACTION_CONFIRM, ACTION_FLARE, ACTION_MUTE, ACTION_PAUSE, ACTION_RESTART, createInput } from './input.js';
import { createAudio } from './audio.js';
import { createParticles } from './particles.js';
import { createRenderer, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN } from './render.js';
import { autopilot, stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall is dropped. */
const MAX_FRAME = 0.25;
/** How often the status line (for screen readers) is refreshed. */
const STATUS_EVERY_FRAMES = 30;

// The query string picks the mode: ?selftest=1 (headless rule checks) or
// ?shot=start|play|win|end (a staged still for the dossier). A harness may
// also hand the query in through window.__emberfallQuery when it injects the
// page instead of navigating to it; served normally, location.search rules.
const params = new URLSearchParams(window.location.search || window.__emberfallQuery || '');
const shot = params.get('shot');
const selftest = params.get('selftest') === '1';
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(createRandom(seed));
const renderer = createRenderer(canvas);
const audio = createAudio();
const particles = createParticles();

let best = readBest();
let newBest = false;
let muted = false;

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off (private windows): the best then lasts this visit.
  }
}

function bankScore() {
  if (world.state.score > best) {
    best = world.state.score;
    newBest = true;
    saveBest(best);
  }
}

function draw() {
  renderer.draw(world.state, world.decor, screen, { best, muted, newBest }, particles, world.lightRadius());
}

function startGame() {
  world.reset();
  world.start();
  newBest = false;
  particles.burst(world.state.player.x, world.state.player.y, '#ffbe55', 18, 200);
  screen = SCREEN_PLAY;
  status.textContent = 'Night 1 — keep your lantern burning.';
}

/** Feed the world's events to sound and sparks. */
function handleEvents(events) {
  const state = world.state;
  if (events & EVENT_PICKUP && state.lastPickup) {
    audio.pickup(state.lastPickup.combo);
    particles.burst(state.lastPickup.x, state.lastPickup.y, '#ffb347', 12, 150);
    particles.floater(state.lastPickup.x, state.lastPickup.y - 14, `+${state.lastPickup.value}`, '#ffd98a');
  }
  if (events & EVENT_FLARE) {
    audio.flare();
    particles.ring(state.player.x, state.player.y, '#ffbe55', 185);
  }
  if (events & EVENT_HIT && state.lastHit) {
    audio.hit();
    particles.burst(state.lastHit.x, state.lastHit.y, '#b388ff', 18, 200);
  }
  if (events & EVENT_POWERUP && state.lastPowerup) {
    audio.powerup();
    const names = { heart: 'Heart!', magnet: 'Ember magnet!', wide: 'Wide wick!', slow: 'The dark slows!' };
    particles.floater(state.lastPowerup.x, state.lastPowerup.y - 18, names[state.lastPowerup.kind] ?? 'Power!', '#cdd7ff');
  }
  if (events & EVENT_WAVE && state.banner) {
    audio.wave();
    particles.burst(state.player.x, state.player.y, '#ffbe55', 20, 180);
  }
  if (events & EVENT_WIN) {
    audio.win();
    bankScore();
    screen = SCREEN_WIN;
  }
  if (events & EVENT_OVER) {
    audio.lose();
    bankScore();
    screen = SCREEN_OVER;
  }
}

function buttonAt(point) {
  for (const button of renderer.getButtons()) {
    if (point.x >= button.x && point.x <= button.x + button.width && point.y >= button.y && point.y <= button.y + button.height) {
      return button.id;
    }
  }
  return null;
}

function runShot(name) {
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.draw(world.state, world.decor, scene.screen, { best: scene.best, muted: false, newBest: false }, particles, world.lightRadius());
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

/** Headless checks of the rules: play, flare, collect, win the long way. */
function runSelfTest() {
  const results = {};
  // A steady pilot plays half a minute: embers should be gathered, and the
  // keeper should still be standing.
  world.reset();
  world.start();
  for (let index = 0; index < 30 * 60; index += 1) {
    const pilot = autopilot(world.state, false);
    world.step(STEP, pilot.move, pilot.flare);
    if (world.state.over || world.state.won) break;
  }
  results.play30 = {
    score: world.state.score,
    embers: world.state.stats.embers,
    wave: world.state.wave,
    fuel: Math.round(world.state.fuel),
    lives: world.state.lives,
    over: world.state.over,
  };
  // A flare spends fuel and stuns a wisp that stands too close.
  world.reset();
  world.start();
  const fuelBefore = world.state.fuel;
  world.state.wisps.push({
    kind: 'drifter', x: world.state.player.x + 80, y: world.state.player.y, vx: 0, vy: 0,
    radius: 15, wobble: 0, mode: 'stalk', modeTime: 0, tx: 0, ty: 0, stun: 0,
  });
  world.step(STEP, { x: 0, y: 0 }, true);
  const wisp = world.state.wisps[0];
  results.flare = {
    fuelSpent: Math.round((fuelBefore - world.state.fuel) * 10) / 10,
    wispStunned: wisp ? wisp.stun > 0 : 'gone',
  };
  // An ember on the keeper's head is collected at once.
  world.reset();
  world.start();
  world.state.embers.push({ x: world.state.player.x, y: world.state.player.y, vx: 0, vy: 0, radius: 9, ttl: 14, phase: 0 });
  world.step(STEP, { x: 0, y: 0 }, false);
  results.collect = { score: world.state.score, embers: world.state.stats.embers };
  // The long way: a steady pilot plays every night to the end.
  world.reset();
  world.start();
  let steps = 0;
  for (; steps < (WAVES * 30 + 10) * 60; steps += 1) {
    const pilot = autopilot(world.state, false);
    world.step(STEP, pilot.move, pilot.flare);
    if (world.state.over || world.state.won) break;
  }
  results.fullGame = {
    steps,
    won: world.state.won,
    over: world.state.over,
    score: world.state.score,
    wave: world.state.wave,
  };
  status.textContent = `SELFTEST ${JSON.stringify(results)}`;
  document.title = 'SELFTEST DONE';
  window.__shotReady = true;
}

let screen = SCREEN_TITLE;

function runGame() {
  const input = createInput(canvas);
  let accumulator = 0;
  let last = performance.now();
  let frame = 0;

  function describe() {
    const state = world.state;
    if (screen === SCREEN_TITLE) return 'Emberfall — press Enter or click to begin the night.';
    if (screen === SCREEN_PAUSED) return 'Paused.';
    if (screen === SCREEN_OVER) return `Game over. Score ${state.score}. Press R to light the lantern again.`;
    if (screen === SCREEN_WIN) return `Dawn breaks! Score ${state.score}. Press R to keep another night.`;
    return `Night ${state.wave} of ${WAVES}. Score ${state.score}. Fuel ${Math.round(state.fuel)}. Lives ${state.lives}.`;
  }

  function frameLoop(now) {
    requestAnimationFrame(frameLoop);
    const elapsed = Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    frame += 1;

    if (screen === SCREEN_TITLE) {
      audio.ensure();
      if (input.takeAction(ACTION_CONFIRM) || input.takeAction(ACTION_FLARE)) {
        audio.click();
        startGame();
      }
      world.step(STEP, { x: 0, y: 0 }, false);
    } else if (screen === SCREEN_PLAY) {
      if (input.takeAction(ACTION_PAUSE)) {
        screen = SCREEN_PAUSED;
        audio.click();
      } else if (input.takeAction(ACTION_RESTART)) {
        audio.click();
        startGame();
      } else {
        accumulator += elapsed;
        while (accumulator >= STEP) {
          accumulator -= STEP;
          const move = input.move();
          const flare = input.takeAction(ACTION_FLARE) || input.flareHeld();
          const events = world.step(STEP, move, flare);
          handleEvents(events);
          if (screen !== SCREEN_PLAY) {
            accumulator = 0;
            break;
          }
        }
      }
    } else if (screen === SCREEN_PAUSED) {
      if (input.takeAction(ACTION_PAUSE) || input.takeAction(ACTION_CONFIRM)) {
        screen = SCREEN_PLAY;
        audio.click();
      } else if (input.takeAction(ACTION_RESTART)) {
        audio.click();
        startGame();
      }
    } else if (screen === SCREEN_OVER || screen === SCREEN_WIN) {
      if (input.takeAction(ACTION_RESTART) || input.takeAction(ACTION_CONFIRM)) {
        audio.click();
        startGame();
      }
    }

    if (input.takeAction(ACTION_MUTE)) {
      muted = !muted;
      audio.setMuted(muted);
    }

    // A click on a menu button: the button decides, not the flare.
    const mouse = input.mouse();
    if (screen !== SCREEN_PLAY) {
      // Reuse the queued click as a menu press: a mouse press is a flare
      // action in the input queue, so a click while a panel shows is read
      // here first and never reaches the play screen.
      if (input.takeAction(ACTION_FLARE)) {
        const hit = buttonAt(mouse);
        if (hit === 'start' || hit === 'restart') {
          audio.ensure();
          audio.click();
          startGame();
        } else if (hit === 'resume') {
          audio.click();
          screen = SCREEN_PLAY;
        }
      }
    }

    particles.update(Math.min(elapsed, STEP * 3));
    if (frame % STATUS_EVERY_FRAMES === 0) status.textContent = describe();
    draw();
  }

  window.addEventListener('resize', () => renderer.resize());
  renderer.resize();
  requestAnimationFrame(frameLoop);
}

if (selftest) {
  runSelfTest();
} else if (shot) {
  runShot(shot);
} else {
  runGame();
}

// A handle for the headless checks: the screen, the score, the seed.
window.__game = {
  get screen() {
    return screen;
  },
  get state() {
    return world.state;
  },
  seed,
};
