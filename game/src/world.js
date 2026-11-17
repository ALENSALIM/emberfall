// Emberfall's world: the Lantern Keeper, the embers, the shadow wisps, the
// nights. Pure logic, no drawing and no sound: it takes a fixed step, a
// movement direction and a flare press, and answers with events. It reads
// only its seeded random source, so the same seed and the same inputs always
// play the same game — the screenshots depend on that.

import {
  FIELD, STEP, WAVES, WAVE_SECONDS, PLAYER, FUEL, LIVES, EMBER, COMBO,
  WISP, POWERUP, WAVE_BONUS, PALETTE,
} from './config.js';

export const EVENT_NONE = 0;
export const EVENT_PICKUP = 1;
export const EVENT_HIT = 2;
export const EVENT_OVER = 4;
export const EVENT_WIN = 8;
export const EVENT_WAVE = 16;
export const EVENT_FLARE = 32;
export const EVENT_POWERUP = 64;

export const KIND_DRIFTER = 'drifter';
export const KIND_DARTER = 'darter';
export const KIND_SPLITTER = 'splitter';
export const KIND_CHILD = 'child';

const TAU = Math.PI * 2;

function distance(ax, ay, bx, by) {
  return Math.hypot(ax - bx, ay - by);
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

/** A random point inside the field, at least `clear` from the player. */
function spawnPoint(random, state, clear) {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const x = random.range(50, FIELD.width - 50);
    const y = random.range(50, FIELD.height - 50);
    if (distance(x, y, state.player.x, state.player.y) >= clear) return { x, y };
  }
  return { x: random.range(50, FIELD.width - 50), y: random.range(50, FIELD.height - 50) };
}

/** A random point on one of the field's edges, far from the player. */
function edgePoint(random, state) {
  const side = random.int(0, 3);
  let x = 0;
  let y = 0;
  if (side === 0) { x = random.range(30, FIELD.width - 30); y = 24; }
  if (side === 1) { x = random.range(30, FIELD.width - 30); y = FIELD.height - 24; }
  if (side === 2) { x = 24; y = random.range(30, FIELD.height - 30); }
  if (side === 3) { x = FIELD.width - 24; y = random.range(30, FIELD.height - 30); }
  if (distance(x, y, state.player.x, state.player.y) < 240) {
    x = FIELD.width - x;
    y = FIELD.height - y;
  }
  return { x, y };
}

export function createWorld(random) {
  // Scenery, drawn once from the seed: stars above, grass, stones and
  // mushrooms below. It never changes, so the same seed always looks alike.
  const decor = { stars: [], grass: [], stones: [], mushrooms: [] };
  for (let index = 0; index < 90; index += 1) {
    decor.stars.push({ x: random.range(0, FIELD.width), y: random.range(0, FIELD.height * 0.55), size: random.range(0.6, 1.8), twinkle: random.range(0, TAU) });
  }
  for (let index = 0; index < 70; index += 1) {
    decor.grass.push({ x: random.range(0, FIELD.width), y: random.range(0, FIELD.height), lean: random.range(-0.4, 0.4), size: random.range(5, 11) });
  }
  for (let index = 0; index < 16; index += 1) {
    decor.stones.push({ x: random.range(0, FIELD.width), y: random.range(0, FIELD.height), rx: random.range(6, 16), ry: random.range(4, 9) });
  }
  for (let index = 0; index < 10; index += 1) {
    decor.mushrooms.push({ x: random.range(0, FIELD.width), y: random.range(0, FIELD.height), size: random.range(5, 9) });
  }

  const state = {
    time: 0,
    wave: 1,
    waveTime: 0,
    score: 0,
    combo: 0,
    comboTimer: 0,
    fuel: FUEL.start,
    lives: LIVES,
    over: false,
    won: false,
    started: false,
    attract: true,
    shake: 0,
    banner: null,
    stats: { embers: 0, flares: 0, wisps: 0 },
    player: { x: FIELD.width / 2, y: FIELD.height / 2, vx: 0, vy: 0, invuln: 0, flareCooldown: 0, magnetTimer: 0, wideTimer: 0, slowTimer: 0 },
    embers: [],
    wisps: [],
    powerups: [],
    lastPickup: null,
    lastHit: null,
    lastPowerup: null,
  };

  let emberTimer = 0;
  let wispTimer = 1.2;
  let powerupTimer = POWERUP.spawnInterval;

  function reset() {
    state.time = 0;
    state.wave = 1;
    state.waveTime = 0;
    state.score = 0;
    state.combo = 0;
    state.comboTimer = 0;
    state.fuel = FUEL.start;
    state.lives = LIVES;
    state.over = false;
    state.won = false;
    state.started = false;
    state.attract = true;
    state.shake = 0;
    state.banner = null;
    state.stats = { embers: 0, flares: 0, wisps: 0 };
    state.player.x = FIELD.width / 2;
    state.player.y = FIELD.height / 2;
    state.player.vx = 0;
    state.player.vy = 0;
    state.player.invuln = 0;
    state.player.flareCooldown = 0;
    state.player.magnetTimer = 0;
    state.player.wideTimer = 0;
    state.player.slowTimer = 0;
    state.embers = [];
    state.wisps = [];
    state.powerups = [];
    state.lastPickup = null;
    state.lastHit = null;
    state.lastPowerup = null;
    emberTimer = 0;
    wispTimer = 1.2;
    powerupTimer = POWERUP.spawnInterval;
  }

  function spawnEmber() {
    const point = spawnPoint(random, state, 130);
    state.embers.push({
      x: point.x, y: point.y,
      vx: random.range(-8, 8), vy: random.range(-8, 8),
      radius: EMBER.radius, ttl: EMBER.lifetime, phase: random.range(0, TAU),
    });
  }

  function spawnWisp() {
    const maxAlive = Math.min(WISP.maxAliveCap, WISP.maxAliveStart + WISP.maxAlivePerWave * (state.wave - 1));
    if (state.wisps.length >= maxAlive) return;
    const point = edgePoint(random, state);
    let kind = KIND_DRIFTER;
    const roll = random.next();
    if (state.wave >= WISP.splitterFromWave && roll < WISP.splitterChance) kind = KIND_SPLITTER;
    else if (state.wave >= WISP.darterFromWave && roll < WISP.splitterChance + WISP.darterChance) kind = KIND_DARTER;
    const def = WISP[kind === KIND_DRIFTER ? 'drifter' : kind];
    state.wisps.push({
      kind, x: point.x, y: point.y, vx: 0, vy: 0,
      radius: def.radius, wobble: random.range(0, TAU),
      mode: 'stalk', modeTime: 0, tx: 0, ty: 0, stun: 0,
    });
  }

  function spawnPowerup() {
    const kinds = state.lives < LIVES
      ? ['heart', 'magnet', 'wide', 'slow']
      : ['magnet', 'wide', 'slow'];
    const point = spawnPoint(random, state, 150);
    state.powerups.push({ kind: random.pick(kinds), x: point.x, y: point.y, ttl: POWERUP.lifetime, phase: random.range(0, TAU) });
  }

  /** One wisp's touch: lose a heart, scatter, and brief safety. */
  function hurtPlayer(wisp) {
    const player = state.player;
    state.lives -= 1;
    player.invuln = PLAYER.invulnerableSeconds;
    state.shake = 1;
    state.combo = 0;
    state.comboTimer = 0;
    const angle = Math.atan2(player.y - wisp.y, player.x - wisp.x);
    player.vx += Math.cos(angle) * 320;
    player.vy += Math.sin(angle) * 320;
    state.lastHit = { x: player.x, y: player.y };
    state.stats.wisps += 1;
    if (state.lives <= 0) {
      state.over = true;
      return EVENT_HIT | EVENT_OVER;
    }
    return EVENT_HIT;
  }

  /** A flare: spend fuel, shove the wisps back, burst the little ones. */
  function flare() {
    const player = state.player;
    if (player.flareCooldown > 0 || state.fuel < PLAYER.flareCost) return EVENT_NONE;
    state.fuel -= PLAYER.flareCost;
    player.flareCooldown = PLAYER.flareCooldown;
    state.stats.flares += 1;
    for (let index = state.wisps.length - 1; index >= 0; index -= 1) {
      const wisp = state.wisps[index];
      const dist = distance(wisp.x, wisp.y, player.x, player.y);
      if (dist > PLAYER.flareRadius + wisp.radius) continue;
      if (wisp.radius <= WISP.splitter.childRadius + 1) {
        state.wisps.splice(index, 1);
        continue;
      }
      const angle = Math.atan2(wisp.y - player.y, wisp.x - player.x);
      wisp.vx += Math.cos(angle) * 430;
      wisp.vy += Math.sin(angle) * 430;
      wisp.stun = 1.2;
      wisp.mode = 'stalk';
      wisp.modeTime = 0;
    }
    return EVENT_FLARE;
  }

  /** Move one wisp toward the player, with its own habits. */
  function moveWisp(wisp, dt) {
    const player = state.player;
    const slow = player.slowTimer > 0 ? 0.5 : 1;
    if (wisp.stun > 0) {
      wisp.stun -= dt;
      wisp.x += wisp.vx * dt;
      wisp.y += wisp.vy * dt;
      wisp.vx *= 1 - 3 * dt;
      wisp.vy *= 1 - 3 * dt;
      return;
    }
    wisp.wobble += dt * 2.2;
    const dx = player.x - wisp.x;
    const dy = player.y - wisp.y;
    const dist = Math.hypot(dx, dy) || 1;
    if (wisp.kind === KIND_DARTER) {
      wisp.modeTime += dt;
      if (wisp.mode === 'stalk') {
        const speed = WISP.darter.speed * slow;
        wisp.vx += (dx / dist * speed - wisp.vx) * Math.min(1, 3 * dt);
        wisp.vy += (dy / dist * speed - wisp.vy) * Math.min(1, 3 * dt);
        if (dist < 190 && wisp.modeTime > 0.8) {
          wisp.mode = 'telegraph';
          wisp.modeTime = 0;
          wisp.tx = dx / dist;
          wisp.ty = dy / dist;
        }
      } else if (wisp.mode === 'telegraph') {
        wisp.vx *= 1 - 4 * dt;
        wisp.vy *= 1 - 4 * dt;
        if (wisp.modeTime >= WISP.darter.telegraphSeconds) {
          wisp.mode = 'lunge';
          wisp.modeTime = 0;
          wisp.vx = wisp.tx * WISP.darter.lungeSpeed * slow;
          wisp.vy = wisp.ty * WISP.darter.lungeSpeed * slow;
        }
      } else if (wisp.mode === 'lunge') {
        if (wisp.modeTime >= 0.45) {
          wisp.mode = 'recover';
          wisp.modeTime = 0;
        }
      } else {
        wisp.vx *= 1 - 2 * dt;
        wisp.vy *= 1 - 2 * dt;
        if (wisp.modeTime >= WISP.darter.recoverSeconds) {
          wisp.mode = 'stalk';
          wisp.modeTime = 0;
        }
      }
    } else {
      const def = wisp.kind === KIND_SPLITTER ? WISP.splitter : WISP.drifter;
      const speed = (wisp.kind === KIND_CHILD ? 95 : def.speed) * slow;
      const wobbleX = Math.cos(wisp.wobble) * 26;
      const wobbleY = Math.sin(wisp.wobble * 1.3) * 26;
      const tx = dx / dist * speed + wobbleX;
      const ty = dy / dist * speed + wobbleY;
      wisp.vx += (tx - wisp.vx) * Math.min(1, 2.5 * dt);
      wisp.vy += (ty - wisp.vy) * Math.min(1, 2.5 * dt);
    }
    wisp.x += wisp.vx * dt;
    wisp.y += wisp.vy * dt;
    wisp.x = clamp(wisp.x, wisp.radius, FIELD.width - wisp.radius);
    wisp.y = clamp(wisp.y, wisp.radius, FIELD.height - wisp.radius);
  }

  /** Split a splitter into two small drifters where it stood. */
  function splitWisp(wisp) {
    for (let index = 0; index < WISP.splitter.children; index += 1) {
      state.wisps.push({
        kind: KIND_CHILD, x: wisp.x + random.range(-14, 14), y: wisp.y + random.range(-14, 14),
        vx: random.range(-60, 60), vy: random.range(-60, 60),
        radius: WISP.splitter.childRadius, wobble: random.range(0, TAU),
        mode: 'stalk', modeTime: 0, tx: 0, ty: 0, stun: 0,
      });
    }
  }

  function step(dt, move, flarePressed) {
    let events = EVENT_NONE;
    state.time += dt;
    state.shake = Math.max(0, state.shake - dt * 1.8);
    if (state.banner) {
      state.banner.t += dt;
      if (state.banner.t > 2.6) state.banner = null;
    }
    const player = state.player;
    if (player.invuln > 0) player.invuln -= dt;
    if (player.flareCooldown > 0) player.flareCooldown -= dt;
    if (player.magnetTimer > 0) player.magnetTimer -= dt;
    if (player.wideTimer > 0) player.wideTimer -= dt;
    if (player.slowTimer > 0) player.slowTimer -= dt;
    if (state.comboTimer > 0) {
      state.comboTimer -= dt;
      if (state.comboTimer <= 0) state.combo = 0;
    }

    if (state.attract) {
      // The title screen's living valley: embers drift in, wisps wander, and
      // nothing can hurt the keeper.
      emberTimer -= dt;
      if (emberTimer <= 0 && state.embers.length < 8) {
        spawnEmber();
        emberTimer = EMBER.spawnInterval * 1.6;
      }
      for (const ember of state.embers) {
        ember.x += ember.vx * dt;
        ember.y += ember.vy * dt;
        ember.ttl -= dt;
        if (ember.x < 20 || ember.x > FIELD.width - 20) ember.vx *= -1;
        if (ember.y < 20 || ember.y > FIELD.height - 20) ember.vy *= -1;
      }
      state.embers = state.embers.filter((ember) => ember.ttl > 0);
      if (state.wisps.length < 3) {
        const point = edgePoint(random, state);
        state.wisps.push({
          kind: KIND_DRIFTER, x: point.x, y: point.y, vx: 0, vy: 0,
          radius: WISP.drifter.radius, wobble: random.range(0, TAU),
          mode: 'stalk', modeTime: 0, tx: 0, ty: 0, stun: 0,
        });
      }
      for (const wisp of state.wisps) {
        wisp.wobble += dt;
        wisp.x += Math.cos(wisp.wobble) * 22 * dt;
        wisp.y += Math.sin(wisp.wobble * 1.2) * 22 * dt;
      }
      return EVENT_NONE;
    }

    if (state.over || state.won) return EVENT_NONE;

    // The keeper walks: accelerate toward the input, ease off without it.
    player.vx += move.x * PLAYER.accel * dt;
    player.vy += move.y * PLAYER.accel * dt;
    const damp = Math.exp(-PLAYER.friction * dt);
    if (move.x === 0) player.vx *= damp;
    if (move.y === 0) player.vy *= damp;
    const speed = Math.hypot(player.vx, player.vy);
    if (speed > PLAYER.speed) {
      player.vx = player.vx / speed * PLAYER.speed;
      player.vy = player.vy / speed * PLAYER.speed;
    }
    player.x = clamp(player.x + player.vx * dt, PLAYER.radius, FIELD.width - PLAYER.radius);
    player.y = clamp(player.y + player.vy * dt, PLAYER.radius, FIELD.height - PLAYER.radius);

    // The lantern burns: fuel drains a little faster every night.
    const drain = (FUEL.drainPerSecond + FUEL.drainPerWave * (state.wave - 1)) * (player.wideTimer > 0 ? 0.7 : 1);
    state.fuel -= drain * dt;
    if (state.fuel <= 0) {
      state.fuel = 0;
      state.over = true;
      return EVENT_OVER;
    }

    if (flarePressed) events |= flare();

    // Embers: spawn, drift, fade, and fly to the keeper while magnetised.
    emberTimer -= dt;
    if (emberTimer <= 0 && state.embers.length < EMBER.maxAlive) {
      spawnEmber();
      emberTimer = EMBER.spawnInterval;
    }
    for (let index = state.embers.length - 1; index >= 0; index -= 1) {
      const ember = state.embers[index];
      ember.ttl -= dt;
      if (player.magnetTimer > 0) {
        const dist = distance(ember.x, ember.y, player.x, player.y);
        if (dist < 240 && dist > 1) {
          ember.vx += (player.x - ember.x) / dist * 420 * dt;
          ember.vy += (player.y - ember.y) / dist * 420 * dt;
        }
      }
      ember.x += ember.vx * dt;
      ember.y += ember.vy * dt;
      ember.vx *= 1 - 0.6 * dt;
      ember.vy *= 1 - 0.6 * dt;
      if (ember.x < 16 || ember.x > FIELD.width - 16) ember.vx *= -1;
      if (ember.y < 16 || ember.y > FIELD.height - 16) ember.vy *= -1;
      if (ember.ttl <= 0) {
        state.embers.splice(index, 1);
        continue;
      }
      if (distance(ember.x, ember.y, player.x, player.y) < ember.radius + PLAYER.radius) {
        state.embers.splice(index, 1);
        state.combo = state.comboTimer > 0 ? Math.min(state.combo + 1, COMBO.max) : 1;
        state.comboTimer = COMBO.windowSeconds;
        const gained = EMBER.value * state.combo;
        state.score += gained;
        state.fuel = Math.min(FUEL.max, state.fuel + FUEL.emberGain);
        state.stats.embers += 1;
        state.lastPickup = { x: ember.x, y: ember.y, value: gained, combo: state.combo };
        events |= EVENT_PICKUP;
      }
    }

    // Wisps: spawn on a timer, chase, and cost a heart on a touch.
    wispTimer -= dt;
    if (wispTimer <= 0) {
      spawnWisp();
      const interval = Math.max(WISP.spawnIntervalMin, WISP.spawnIntervalStart - WISP.spawnIntervalPerWave * (state.wave - 1));
      wispTimer = interval * random.range(0.8, 1.2);
    }
    for (let index = state.wisps.length - 1; index >= 0; index -= 1) {
      const wisp = state.wisps[index];
      moveWisp(wisp, dt);
      if (distance(wisp.x, wisp.y, player.x, player.y) < wisp.radius + PLAYER.radius - 2) {
        if (player.invuln <= 0) {
          const wasSplitter = wisp.kind === KIND_SPLITTER;
          state.wisps.splice(index, 1);
          if (wasSplitter) splitWisp(wisp);
          events |= hurtPlayer(wisp);
          if (state.over) return events | EVENT_OVER;
        }
      }
    }

    // Power-ups: one drops now and then from the second night on.
    if (state.wave >= 2) {
      powerupTimer -= dt;
      if (powerupTimer <= 0) {
        spawnPowerup();
        powerupTimer = POWERUP.spawnInterval * random.range(0.9, 1.1);
      }
    }
    for (let index = state.powerups.length - 1; index >= 0; index -= 1) {
      const powerup = state.powerups[index];
      powerup.ttl -= dt;
      if (powerup.ttl <= 0) {
        state.powerups.splice(index, 1);
        continue;
      }
      if (distance(powerup.x, powerup.y, player.x, player.y) < POWERUP.radius + PLAYER.radius) {
        state.powerups.splice(index, 1);
        if (powerup.kind === 'heart') state.lives = Math.min(LIVES, state.lives + 1);
        if (powerup.kind === 'magnet') player.magnetTimer = POWERUP.magnetSeconds;
        if (powerup.kind === 'wide') player.wideTimer = POWERUP.wideSeconds;
        if (powerup.kind === 'slow') player.slowTimer = POWERUP.slowSeconds;
        state.lastPowerup = { kind: powerup.kind, x: powerup.x, y: powerup.y };
        events |= EVENT_POWERUP;
      }
    }

    // The night ends: a bonus, a banner, and either dawn or a harder night.
    state.waveTime += dt;
    if (state.waveTime >= WAVE_SECONDS) {
      const cleared = state.wave;
      const bonus = WAVE_BONUS * cleared;
      state.score += bonus;
      state.wave += 1;
      state.waveTime = 0;
      if (state.wave > WAVES) {
        state.won = true;
        state.banner = { text: 'Dawn breaks', sub: `You kept the light alive — ${state.score} points`, t: 0 };
        return events | EVENT_WIN;
      }
      state.banner = {
        text: `Night ${cleared} clear`,
        sub: `+${bonus} — dawn in ${WAVES - state.wave + 1} night${WAVES - state.wave + 1 === 1 ? '' : 's'}`,
        t: 0,
      };
      for (let index = 0; index < 3; index += 1) spawnEmber();
      events |= EVENT_WAVE;
    }

    return events;
  }

  return {
    state,
    decor,
    reset,
    step,
    /** Begin a night: leave the title valley and start burning fuel. */
    start() {
      state.attract = false;
      state.started = true;
    },
    /** How wide the keeper's light shines right now. */
    lightRadius() {
      const wide = state.player.wideTimer > 0 ? 1.5 : 1;
      const flicker = 1 + 0.02 * Math.sin(state.time * 7) + 0.012 * Math.sin(state.time * 13);
      return PLAYER.lightRadius * wide * flicker * (0.55 + 0.45 * (state.fuel / FUEL.max));
    },
    /** Nights left before dawn, for the HUD. */
    nightsLeft() {
      return Math.max(0, WAVES - state.wave + 1);
    },
    /** Force a win (used by the screenshot staging, never by play). */
    winNow() {
      state.won = true;
      state.banner = { text: 'Dawn breaks', sub: `You kept the light alive — ${state.score} points`, t: 0 };
    },
    /** Force a loss (used by the screenshot staging, never by play). */
    endNow() {
      state.lives = 0;
      state.over = true;
    },
    /** One hit, ignoring invulnerability (used by the screenshot staging). */
    hurtNow() {
      state.player.invuln = 0;
      hurtPlayer({ x: state.player.x + 30, y: state.player.y });
    },
  };
}
