// The screenshot scenes behind ?shot=start|play|win|end. Each one plays the
// real rules forward from a fresh world for a fixed number of steps, steered
// by a simple autopilot (chase the nearest ember, flare when a wisp closes
// in), so the frame is what a short game really looks like and the same seed
// always gives the same frame.

import { FIELD, STEP, WAVES, WAVE_SECONDS, PLAYER } from './config.js';
import { EVENT_OVER, EVENT_WIN } from './world.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN } from './render.js';

const START_SECONDS = 5;
const PLAY_SECONDS = 26;
const END_LIMIT_SECONDS = 600;
const FULL_GAME_SECONDS = WAVES * WAVE_SECONDS + 5;

/**
 * Where to walk and whether to flare, from the state alone. A steady pilot
 * chases embers and flares when a wisp closes in; a timid one never flares
 * and walks at half pace, so it is caught out as a hurried player is.
 */
export function autopilot(state, timid = false) {
  const player = state.player;
  // Nearest ember, not the lowest: the shortest walk is the cheapest fuel.
  let ember = null;
  let emberDist = Infinity;
  for (const candidate of state.embers) {
    const dist = Math.hypot(candidate.x - player.x, candidate.y - player.y);
    if (dist < emberDist) { ember = candidate; emberDist = dist; }
  }
  // The nearest wisp, and how close it is.
  let wisp = null;
  let wispDist = Infinity;
  for (const candidate of state.wisps) {
    const dist = Math.hypot(candidate.x - player.x, candidate.y - player.y);
    if (dist < wispDist) { wisp = candidate; wispDist = dist; }
  }
  const pace = timid ? 0.55 : 1;
  let targetX = ember === null ? FIELD.width / 2 : ember.x;
  let targetY = ember === null ? FIELD.height / 2 : ember.y;
  // A wisp on top of the keeper is worth running from, even at the cost of
  // the ember: a heart costs more than a detour.
  if (!timid && wisp && wispDist < 95) {
    const away = Math.hypot(player.x - wisp.x, player.y - wisp.y) || 1;
    targetX = player.x + (player.x - wisp.x) / away * 200;
    targetY = player.y + (player.y - wisp.y) / away * 200;
  }
  const dx = targetX - player.x;
  const dy = targetY - player.y;
  const length = Math.hypot(dx, dy) || 1;
  // A flare is for a wisp that is already on top of the keeper, not for one
  // still far away: every flare costs fuel, and fuel is life.
  let flare = false;
  if (!timid && player.flareCooldown <= 0 && wisp && wispDist < 100 && !wisp.stun) {
    const desperate = wispDist < 70;
    if (state.fuel > 30 || desperate) flare = true;
  }
  return { move: { x: (dx / length) * pace, y: (dy / length) * pace }, flare };
}

function runSteps(world, seconds, timid) {
  const steps = Math.floor(seconds / STEP);
  let events = 0;
  for (let index = 0; index < steps; index += 1) {
    const pilot = autopilot(world.state, timid);
    events |= world.step(STEP, pilot.move, pilot.flare);
    if (world.state.over || world.state.won) break;
  }
  return events;
}

/**
 * Set `world` to the named scene (start, play, win or end; any other name is
 * start) and return the screen to draw over it and the best score to show.
 */
export function stageShot(name, world) {
  world.reset();
  if (name !== 'play' && name !== 'win' && name !== 'end') {
    // The title valley, alive for a few seconds: embers drifting in, wisps
    // wandering, the keeper standing with the lamp lit.
    for (let index = 0; index < START_SECONDS / STEP; index += 1) {
      world.step(STEP, { x: 0, y: 0 }, false);
    }
    return { screen: SCREEN_TITLE, best: 0 };
  }
  if (name === 'play') {
    world.start();
    runSteps(world, PLAY_SECONDS, false);
    const over = world.state.over;
    return { screen: over ? SCREEN_OVER : SCREEN_PLAY, best: world.state.score };
  }
  if (name === 'win') {
    world.start();
    runSteps(world, FULL_GAME_SECONDS, false);
    if (!world.state.won) {
      // The steady pilot did not make it: stage the dawn over the score it
      // earned, the way a win really looks.
      world.state.over = false;
      world.winNow();
    }
    return { screen: SCREEN_WIN, best: world.state.score };
  }
  // end: a timid pilot, no flares, until the dark takes it.
  world.start();
  runSteps(world, END_LIMIT_SECONDS, true);
  let guard = 0;
  while (!world.state.over && guard < 3) {
    world.hurtNow();
    guard += 1;
  }
  return { screen: SCREEN_OVER, best: world.state.score };
}
