// Emberfall — every tuning number and colour in one place.
//
// The playfield is a fixed 1280x720 logical area; the renderer scales it to the
// window, so no rule below depends on the screen size. A night lasts
// WAVE_SECONDS seconds; survive all WAVES nights and dawn breaks: you win.
// Your lantern is your life: fuel drains every second, embers refill it, and a
// flare spends fuel to drive the shadow wisps back.

/** The playfield, in logical pixels. */
export const FIELD = { width: 1280, height: 720 };

/** The simulation's fixed step, in seconds: 60 updates a second. */
export const STEP = 1 / 60;

/** Nights to survive before dawn. */
export const WAVES = 10;
/** Seconds in one night. */
export const WAVE_SECONDS = 30;

/** The Lantern Keeper. */
export const PLAYER = {
  radius: 16,
  speed: 305,
  accel: 2600,
  friction: 5.5,
  /** Radius of the pool of light around the keeper. */
  lightRadius: 195,
  /** Fuel a flare costs. */
  flareCost: 12,
  /** How far a flare reaches. */
  flareRadius: 185,
  /** Seconds between flares. */
  flareCooldown: 0.8,
  /** Seconds of safety after a wisp hits you. */
  invulnerableSeconds: 1.6,
};

/** Lantern fuel. */
export const FUEL = {
  max: 100,
  start: 100,
  /** Drained every second, before the per-wave extra. */
  drainPerSecond: 1.05,
  /** Extra drain per second for each night already survived. */
  drainPerWave: 0.1,
  /** Fuel an ember gives back. */
  emberGain: 8,
};

/** Hearts. A wisp's touch costs one; a heart power-up gives one back. */
export const LIVES = 3;

/** Embers (fireflies): the points and the fuel. */
export const EMBER = {
  radius: 9,
  /** Base points for one ember, before the combo multiplier. */
  value: 10,
  /** Seconds between spawns. */
  spawnInterval: 0.85,
  /** Most embers alive at once. */
  maxAlive: 14,
  /** Seconds before an ember fades away. */
  lifetime: 14,
};

/** Picking embers quickly builds a combo multiplier. */
export const COMBO = {
  /** Seconds a combo survives without a pickup. */
  windowSeconds: 3,
  /** Highest multiplier. */
  max: 8,
};

/** Shadow wisps. */
export const WISP = {
  drifter: { radius: 15, speed: 58, score: 0 },
  darter: { radius: 13, speed: 74, lungeSpeed: 330, telegraphSeconds: 0.55, recoverSeconds: 0.9 },
  splitter: { radius: 19, speed: 46, children: 2, childRadius: 10 },
  /** First night a darter may appear. */
  darterFromWave: 3,
  /** First night a splitter may appear. */
  splitterFromWave: 5,
  /** Chance a spawn is a darter, once they are in the mix. */
  darterChance: 0.26,
  /** Chance a spawn is a splitter, once they are in the mix. */
  splitterChance: 0.2,
  /** Seconds between spawns on night one; shrinks each night. */
  spawnIntervalStart: 2.3,
  spawnIntervalPerWave: 0.17,
  spawnIntervalMin: 0.55,
  /** Most wisps alive at once on night one, plus this many per night. */
  maxAliveStart: 4,
  maxAlivePerWave: 2,
  maxAliveCap: 22,
};

/** Power-ups: rare gifts the valley leaves for the keeper. */
export const POWERUP = {
  /** Seconds between power-up drops, from night two on. */
  spawnInterval: 22,
  /** Seconds a power-up stays on the ground. */
  lifetime: 12,
  radius: 14,
  magnetSeconds: 8,
  wideSeconds: 12,
  slowSeconds: 8,
};

/** Points for clearing a night, times the night number. */
export const WAVE_BONUS = 50;

/** Colours: a dark indigo valley against warm lantern gold. */
export const PALETTE = {
  skyTop: '#0a0d24',
  skyBottom: '#141a38',
  ground: '#10142a',
  star: '#cdd7ff',
  grass: '#1d3a2a',
  stone: '#2a2f45',
  mushroomCap: '#c96a5a',
  mushroomStem: '#e8dcc8',
  ember: '#ffb347',
  emberCore: '#fff3c4',
  wispBody: '#0b0b16',
  wispEdge: '#4b3a78',
  wispEye: '#b388ff',
  darterEye: '#ff5d7a',
  keeperCloak: '#2e4a7a',
  keeperHood: '#3b5b8f',
  lanternGlow: '#ffbe55',
  lanternCore: '#fff6d8',
  fuelFull: '#ffb347',
  fuelLow: '#ff5d5d',
  heart: '#ff5d7a',
  heartEmpty: '#3a3f5c',
  text: '#f2ead8',
  textDim: '#9aa3c7',
  panel: 'rgba(10, 13, 36, 0.88)',
  panelEdge: '#ffbe55',
};

/** Canvas font stacks: system fonts only, nothing loaded over the network. */
export const FONT = {
  title: '700 84px Georgia, "Times New Roman", serif',
  heading: '700 44px Georgia, "Times New Roman", serif',
  body: '16px system-ui, -apple-system, "Segoe UI", sans-serif',
  bodyBold: '700 16px system-ui, -apple-system, "Segoe UI", sans-serif',
  big: '700 26px system-ui, -apple-system, "Segoe UI", sans-serif',
  hud: '700 22px system-ui, -apple-system, "Segoe UI", sans-serif',
  small: '14px system-ui, -apple-system, "Segoe UI", sans-serif',
};

/** localStorage key for the best score. */
export const BEST_KEY = 'emberfall-best';
