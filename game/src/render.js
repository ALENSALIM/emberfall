// Drawing only: the world's state and the current screen in, pixels out.
// The 1280x720 playfield is scaled to fit the window and centred. The valley
// is drawn first, then a darkness layer with holes of light cut around the
// keeper and the embers, then the things that shine in the dark (wisp eyes,
// ember cores, the lantern's glow), then the HUD and the screens.

import { FIELD, PLAYER, FUEL, LIVES, WAVES, PALETTE, FONT } from './config.js';
import { KIND_DARTER, KIND_SPLITTER, KIND_CHILD } from './world.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';
export const SCREEN_WIN = 'win';

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function roundRect(context, x, y, width, height, radius) {
  context.beginPath();
  context.moveTo(x + radius, y);
  context.arcTo(x + width, y, x + width, y + height, radius);
  context.arcTo(x + width, y + height, x, y + height, radius);
  context.arcTo(x, y + height, x, y, radius);
  context.arcTo(x, y, x + width, y, radius);
  context.closePath();
}

function drawHeart(context, x, y, size, filled) {
  context.save();
  context.translate(x, y);
  context.scale(size / 16, size / 16);
  context.beginPath();
  context.moveTo(0, 5);
  context.bezierCurveTo(-9, -3, -5, -9, 0, -4);
  context.bezierCurveTo(5, -9, 9, -3, 0, 5);
  context.closePath();
  context.fillStyle = filled ? PALETTE.heart : PALETTE.heartEmpty;
  context.fill();
  context.restore();
}

function drawFlame(context, x, y, size, color) {
  context.save();
  context.translate(x, y);
  context.scale(size / 16, size / 16);
  context.beginPath();
  context.moveTo(0, -8);
  context.bezierCurveTo(5, -2, 7, 2, 5, 6);
  context.bezierCurveTo(3, 9, -3, 9, -5, 6);
  context.bezierCurveTo(-7, 2, -5, -2, 0, -8);
  context.closePath();
  context.fillStyle = color;
  context.fill();
  context.restore();
}

export function createRenderer(canvas) {
  const context = canvas.getContext('2d');
  const dark = document.createElement('canvas');
  dark.width = FIELD.width;
  dark.height = FIELD.height;
  const darkContext = dark.getContext('2d');
  let buttons = [];

  function resize() {
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.max(320, canvas.clientWidth || FIELD.width);
    const height = Math.max(240, canvas.clientHeight || FIELD.height);
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
  }

  function view() {
    const scale = Math.min(canvas.width / FIELD.width, canvas.height / FIELD.height);
    return {
      scale,
      ox: (canvas.width - FIELD.width * scale) / 2,
      oy: (canvas.height - FIELD.height * scale) / 2,
    };
  }

  function drawBackground(state, decor, time) {
    const gradient = context.createLinearGradient(0, 0, 0, FIELD.height);
    gradient.addColorStop(0, PALETTE.skyTop);
    gradient.addColorStop(0.55, PALETTE.skyBottom);
    gradient.addColorStop(1, PALETTE.ground);
    context.fillStyle = gradient;
    context.fillRect(0, 0, FIELD.width, FIELD.height);
    for (const star of decor.stars) {
      const twinkle = 0.35 + 0.65 * Math.abs(Math.sin(time * 0.9 + star.twinkle));
      context.globalAlpha = twinkle * 0.8;
      context.fillStyle = PALETTE.star;
      context.fillRect(star.x, star.y, star.size, star.size);
    }
    context.globalAlpha = 1;
    context.strokeStyle = PALETTE.grass;
    context.lineWidth = 2;
    context.lineCap = 'round';
    for (const tuft of decor.grass) {
      context.beginPath();
      context.moveTo(tuft.x, tuft.y);
      context.quadraticCurveTo(tuft.x + tuft.lean, tuft.y - tuft.size, tuft.x + tuft.lean * 2, tuft.y - tuft.size * 1.4);
      context.stroke();
    }
    context.fillStyle = PALETTE.stone;
    for (const stone of decor.stones) {
      context.beginPath();
      context.ellipse(stone.x, stone.y, stone.rx, stone.ry, 0, 0, Math.PI * 2);
      context.fill();
    }
    for (const mushroom of decor.mushrooms) {
      context.fillStyle = PALETTE.mushroomStem;
      context.fillRect(mushroom.x - 1.5, mushroom.y - 4, 3, 6);
      context.fillStyle = PALETTE.mushroomCap;
      context.beginPath();
      context.arc(mushroom.x, mushroom.y - 4, mushroom.size, Math.PI, 0);
      context.fill();
    }
  }

  function drawEmbers(state, time) {
    for (const ember of state.embers) {
      const fade = ember.ttl < 2 ? ember.ttl / 2 : 1;
      const pulse = 0.75 + 0.25 * Math.sin(time * 4 + ember.phase);
      const drift = Math.sin(time * 1.7 + ember.phase) * 2;
      context.save();
      context.globalAlpha = fade * pulse;
      context.fillStyle = PALETTE.ember;
      context.beginPath();
      context.arc(ember.x + drift, ember.y, ember.radius, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = PALETTE.emberCore;
      context.beginPath();
      context.arc(ember.x + drift, ember.y, ember.radius * 0.45, 0, Math.PI * 2);
      context.fill();
      context.restore();
    }
  }

  function drawPowerups(state, time) {
    for (const powerup of state.powerups) {
      const bob = Math.sin(time * 3 + powerup.phase) * 3;
      const y = powerup.y + bob;
      context.save();
      context.globalAlpha = powerup.ttl < 3 ? 0.4 + 0.6 * Math.abs(Math.sin(time * 6)) : 1;
      context.fillStyle = PALETTE.panel;
      context.strokeStyle = PALETTE.panelEdge;
      context.lineWidth = 2;
      context.beginPath();
      context.arc(powerup.x, y, 16, 0, Math.PI * 2);
      context.fill();
      context.stroke();
      context.fillStyle = PALETTE.text;
      context.font = FONT.bodyBold;
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      const glyph = powerup.kind === 'heart' ? '♥' : powerup.kind === 'magnet' ? '◉' : powerup.kind === 'wide' ? '☀' : '◷';
      context.fillText(glyph, powerup.x, y + 1);
      context.restore();
    }
  }

  function drawWisps(state, time) {
    for (const wisp of state.wisps) {
      const telegraph = wisp.kind === KIND_DARTER && wisp.mode === 'telegraph';
      const flash = telegraph ? 0.5 + 0.5 * Math.sin(time * 30) : 0;
      context.save();
      context.globalAlpha = wisp.stun > 0 ? 0.55 : 0.92;
      context.fillStyle = PALETTE.wispBody;
      context.strokeStyle = telegraph ? `rgba(255, 93, 122, ${0.5 + flash * 0.5})` : PALETTE.wispEdge;
      context.lineWidth = 2;
      context.beginPath();
      const wobble = Math.sin(time * 3 + wisp.wobble) * 2;
      context.arc(wisp.x, wisp.y + wobble, wisp.radius, 0, Math.PI * 2);
      context.fill();
      context.stroke();
      // A ragged tail of smoke behind the wisp.
      context.globalAlpha = 0.5;
      context.beginPath();
      context.arc(wisp.x - wisp.vx * 0.04, wisp.y - wisp.vy * 0.04 + wobble, wisp.radius * 0.55, 0, Math.PI * 2);
      context.fill();
      context.restore();
      // Eyes shine through the dark: drawn after the darkness layer.
    }
  }

  function drawWispEyes(state) {
    for (const wisp of state.wisps) {
      const eyeColor = wisp.kind === KIND_DARTER ? PALETTE.darterEye : PALETTE.wispEye;
      const spread = wisp.radius * 0.38;
      const forward = Math.atan2(state.player.y - wisp.y, state.player.x - wisp.x);
      const ex = Math.cos(forward) * 2;
      const ey = Math.sin(forward) * 2;
      context.save();
      context.fillStyle = eyeColor;
      context.beginPath();
      context.arc(wisp.x - spread + ex, wisp.y - 2 + ey, 2.6, 0, Math.PI * 2);
      context.arc(wisp.x + spread + ex, wisp.y - 2 + ey, 2.6, 0, Math.PI * 2);
      context.fill();
      context.restore();
    }
  }

  function drawPlayer(state, time) {
    const player = state.player;
    const blink = player.invuln > 0 && Math.floor(time * 12) % 2 === 0;
    context.save();
    if (blink) context.globalAlpha = 0.35;
    // Cloak: a hooded keeper, drawn as a rounded triangle with a hood.
    context.fillStyle = PALETTE.keeperCloak;
    context.beginPath();
    context.moveTo(player.x, player.y - PLAYER.radius - 4);
    context.quadraticCurveTo(player.x + PLAYER.radius + 3, player.y - 2, player.x + PLAYER.radius - 2, player.y + PLAYER.radius);
    context.quadraticCurveTo(player.x, player.y + PLAYER.radius + 3, player.x - PLAYER.radius + 2, player.y + PLAYER.radius);
    context.quadraticCurveTo(player.x - PLAYER.radius - 3, player.y - 2, player.x, player.y - PLAYER.radius - 4);
    context.fill();
    context.fillStyle = PALETTE.keeperHood;
    context.beginPath();
    context.arc(player.x, player.y - 4, 9, 0, Math.PI * 2);
    context.fill();
    // The lantern, held out to one side, swaying as the keeper walks.
    const sway = Math.sin(time * 2.2) * 2 + clamp(player.vx * 0.012, -4, 4);
    const lx = player.x + 16 + sway;
    const ly = player.y + 8;
    context.strokeStyle = '#8a6a2f';
    context.lineWidth = 2;
    context.beginPath();
    context.moveTo(player.x + 8, player.y + 2);
    context.lineTo(lx, ly - 6);
    context.stroke();
    context.fillStyle = PALETTE.lanternCore;
    context.beginPath();
    context.arc(lx, ly, 6, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = '#8a6a2f';
    context.lineWidth = 1.5;
    context.beginPath();
    context.arc(lx, ly, 7.5, 0, Math.PI * 2);
    context.stroke();
    context.restore();
  }

  function drawDarkness(state, lightRadius) {
    darkContext.clearRect(0, 0, FIELD.width, FIELD.height);
    darkContext.fillStyle = 'rgba(4, 6, 18, 0.86)';
    darkContext.fillRect(0, 0, FIELD.width, FIELD.height);
    darkContext.globalCompositeOperation = 'destination-out';
    function hole(x, y, radius, strength) {
      const gradient = darkContext.createRadialGradient(x, y, radius * 0.15, x, y, radius);
      gradient.addColorStop(0, `rgba(0, 0, 0, ${strength})`);
      gradient.addColorStop(0.7, `rgba(0, 0, 0, ${strength * 0.55})`);
      gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
      darkContext.fillStyle = gradient;
      darkContext.beginPath();
      darkContext.arc(x, y, radius, 0, Math.PI * 2);
      darkContext.fill();
    }
    hole(state.player.x, state.player.y, lightRadius, 1);
    for (const ember of state.embers) hole(ember.x, ember.y, 62, 0.75);
    for (const powerup of state.powerups) hole(powerup.x, powerup.y, 52, 0.7);
    darkContext.globalCompositeOperation = 'source-over';
    context.drawImage(dark, 0, 0);
  }

  function drawLanternGlow(state, lightRadius) {
    const player = state.player;
    context.save();
    context.globalCompositeOperation = 'lighter';
    const gradient = context.createRadialGradient(player.x, player.y, 8, player.x, player.y, lightRadius);
    gradient.addColorStop(0, 'rgba(255, 214, 120, 0.20)');
    gradient.addColorStop(0.55, 'rgba(255, 170, 60, 0.10)');
    gradient.addColorStop(1, 'rgba(255, 170, 60, 0)');
    context.fillStyle = gradient;
    context.beginPath();
    context.arc(player.x, player.y, lightRadius, 0, Math.PI * 2);
    context.fill();
    context.restore();
  }

  function drawHearts(state) {
    for (let index = 0; index < LIVES; index += 1) {
      drawHeart(context, 34 + index * 34, 34, 26, index < state.lives);
    }
  }

  function drawFuel(state) {
    const width = 220;
    const height = 14;
    const x = 20;
    const y = 56;
    const ratio = state.fuel / FUEL.max;
    context.save();
    context.fillStyle = 'rgba(10, 13, 36, 0.7)';
    roundRect(context, x - 4, y - 4, width + 8, height + 8, 6);
    context.fill();
    context.fillStyle = ratio < 0.25 ? PALETTE.fuelLow : PALETTE.fuelFull;
    const pulse = ratio < 0.25 ? 0.7 + 0.3 * Math.sin(state.time * 8) : 1;
    context.globalAlpha = pulse;
    if (ratio > 0) {
      roundRect(context, x, y, width * ratio, height, 5);
      context.fill();
    }
    context.globalAlpha = 1;
    drawFlame(context, x + width + 16, y + height / 2, 18, ratio < 0.25 ? PALETTE.fuelLow : PALETTE.fuelFull);
    context.fillStyle = PALETTE.textDim;
    context.font = FONT.small;
    context.textAlign = 'left';
    context.textBaseline = 'middle';
    context.fillText('FUEL', x, y + height + 14);
    // Flare readiness, a thin bar under the fuel.
    const cooldown = 1 - clamp(state.player.flareCooldown / PLAYER.flareCooldown, 0, 1);
    context.fillStyle = 'rgba(10, 13, 36, 0.7)';
    context.fillRect(x, y + height + 22, width, 5);
    context.fillStyle = cooldown >= 1 ? PALETTE.lanternGlow : '#6a5a2e';
    context.fillRect(x, y + height + 22, width * cooldown, 5);
    context.fillStyle = PALETTE.textDim;
    context.fillText(cooldown >= 1 ? 'FLARE READY — SPACE / CLICK' : 'FLARE …', x, y + height + 38);
    context.restore();
  }

  function drawScore(state, best) {
    context.save();
    context.textAlign = 'right';
    context.textBaseline = 'alphabetic';
    context.fillStyle = PALETTE.text;
    context.font = FONT.hud;
    context.fillText(`SCORE ${state.score.toLocaleString('en-US')}`, FIELD.width - 20, 38);
    context.fillStyle = PALETTE.textDim;
    context.font = FONT.small;
    context.fillText(`BEST ${Math.max(best, state.score).toLocaleString('en-US')}`, FIELD.width - 20, 60);
    if (state.combo > 1) {
      const pulse = 1 + 0.12 * Math.sin(state.time * 10);
      context.save();
      context.translate(FIELD.width - 20, 92);
      context.scale(pulse, pulse);
      context.fillStyle = PALETTE.lanternGlow;
      context.font = FONT.big;
      context.fillText(`x${state.combo} COMBO`, 0, 0);
      context.restore();
    }
    context.restore();
  }

  function drawWave(state) {
    context.save();
    context.textAlign = 'center';
    context.fillStyle = PALETTE.text;
    context.font = FONT.bodyBold;
    context.fillText(`Night ${Math.min(state.wave, WAVES)} of ${WAVES}`, FIELD.width / 2, 34);
    const dots = 12;
    const spacing = 22;
    const startX = FIELD.width / 2 - (WAVES - 1) * spacing / 2;
    for (let index = 0; index < WAVES; index += 1) {
      const x = startX + index * spacing;
      context.beginPath();
      context.arc(x, 52, 5, 0, Math.PI * 2);
      if (index < state.wave - 1 || state.won) {
        context.fillStyle = PALETTE.lanternGlow;
      } else if (index === state.wave - 1) {
        context.fillStyle = PALETTE.text;
      } else {
        context.fillStyle = PALETTE.heartEmpty;
      }
      context.fill();
    }
    context.fillStyle = PALETTE.textDim;
    context.font = FONT.small;
    const left = state.won ? 'Dawn has broken' : `Dawn in ${WAVES - state.wave + 1} night${WAVES - state.wave + 1 === 1 ? '' : 's'}`;
    context.fillText(left, FIELD.width / 2, 72);
    context.restore();
  }

  function drawBanner(state) {
    if (!state.banner) return;
    const alpha = state.banner.t > 2.1 ? Math.max(0, 1 - (state.banner.t - 2.1) / 0.5) : 1;
    context.save();
    context.globalAlpha = alpha;
    context.textAlign = 'center';
    context.fillStyle = PALETTE.lanternGlow;
    context.font = FONT.big;
    context.fillText(state.banner.text, FIELD.width / 2, 130);
    context.fillStyle = PALETTE.text;
    context.font = FONT.body;
    context.fillText(state.banner.sub, FIELD.width / 2, 158);
    context.restore();
  }

  function drawHints() {
    context.save();
    context.textAlign = 'left';
    context.fillStyle = PALETTE.textDim;
    context.font = FONT.small;
    context.fillText('WASD / arrows — walk      Space / click — flare      P — pause      M — mute', 20, FIELD.height - 16);
    context.restore();
  }

  function drawButton(id, cx, cy, width, height, label, primary) {
    const x = cx - width / 2;
    const y = cy - height / 2;
    context.save();
    context.fillStyle = primary ? PALETTE.lanternGlow : 'rgba(20, 26, 56, 0.9)';
    context.strokeStyle = PALETTE.panelEdge;
    context.lineWidth = 2;
    roundRect(context, x, y, width, height, 10);
    context.fill();
    context.stroke();
    context.fillStyle = primary ? '#241a05' : PALETTE.text;
    context.font = FONT.bodyBold;
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(label, cx, cy + 1);
    context.restore();
    const viewBox = view();
    buttons.push({
      id,
      x: viewBox.ox + x * viewBox.scale,
      y: viewBox.oy + y * viewBox.scale,
      width: width * viewBox.scale,
      height: height * viewBox.scale,
    });
  }

  function drawPanel(title, lines, buttonList) {
    context.save();
    context.fillStyle = 'rgba(4, 6, 18, 0.55)';
    context.fillRect(0, 0, FIELD.width, FIELD.height);
    context.fillStyle = PALETTE.panel;
    context.strokeStyle = PALETTE.panelEdge;
    context.lineWidth = 2;
    const panelWidth = 640;
    const panelHeight = 150 + lines.length * 30 + buttonList.length * 64;
    const px = FIELD.width / 2 - panelWidth / 2;
    const py = FIELD.height / 2 - panelHeight / 2;
    roundRect(context, px, py, panelWidth, panelHeight, 16);
    context.fill();
    context.stroke();
    context.textAlign = 'center';
    context.fillStyle = PALETTE.lanternGlow;
    context.font = FONT.heading;
    context.fillText(title, FIELD.width / 2, py + 62);
    context.fillStyle = PALETTE.text;
    context.font = FONT.body;
    lines.forEach((line, index) => {
      context.fillText(line, FIELD.width / 2, py + 108 + index * 30);
    });
    let buttonY = py + 118 + lines.length * 30 + 26;
    for (const button of buttonList) {
      drawButton(button.id, FIELD.width / 2, buttonY, 280, 48, button.label, button.primary);
      buttonY += 64;
    }
    context.restore();
    return { x: px, y: py, width: panelWidth, height: panelHeight };
  }

  return {
    resize,
    /** Buttons drawn by the last draw(), in canvas pixels, for hit-testing. */
    getButtons() {
      return buttons;
    },
    draw(state, decor, screen, ui, particles, lightRadius) {
      buttons = [];
      resize();
      const viewBox = view();
      const shakeX = state.shake > 0 ? Math.sin(state.time * 91) * state.shake * 9 : 0;
      const shakeY = state.shake > 0 ? Math.cos(state.time * 83) * state.shake * 9 : 0;
      context.setTransform(viewBox.scale, 0, 0, viewBox.scale, viewBox.ox + shakeX, viewBox.oy + shakeY);
      context.fillStyle = PALETTE.skyTop;
      context.fillRect(-viewBox.ox / viewBox.scale, -viewBox.oy / viewBox.scale, canvas.width / viewBox.scale, canvas.height / viewBox.scale);
      drawBackground(state, decor, state.time);
      drawPowerups(state, state.time);
      drawEmbers(state, state.time);
      drawWisps(state, state.time);
      if (screen !== SCREEN_TITLE) drawPlayer(state, state.time);
      else {
        // On the title screen the keeper stands in the valley, lamp lit.
        const saved = state.player.invuln;
        state.player.invuln = 0;
        drawPlayer(state, state.time);
        state.player.invuln = saved;
      }
      drawDarkness(state, lightRadius);
      drawWispEyes(state);
      drawLanternGlow(state, lightRadius);
      if (particles) particles.draw(context);
      if (screen === SCREEN_PLAY || screen === SCREEN_PAUSED) {
        drawHearts(state);
        drawFuel(state);
        drawScore(state, ui.best);
        drawWave(state);
        drawBanner(state);
        drawHints();
      }
      if (screen === SCREEN_TITLE) {
        drawPanel('EMBERFALL', [
          'Keeper of the Last Light',
          'Gather embers to feed your lantern. Shun the shadow wisps.',
          `Survive ${WAVES} nights — at dawn, the valley is yours.`,
          'A flare costs fuel but drives the wisps back. Spend it well.',
        ], [
          { id: 'start', label: 'Begin the night', primary: true },
        ]);
        context.save();
        context.textAlign = 'center';
        context.fillStyle = PALETTE.textDim;
        context.font = FONT.small;
        context.fillText(`Best score: ${ui.best.toLocaleString('en-US')}      WASD / arrows to walk · Space or click to flare`, FIELD.width / 2, FIELD.height - 52);
        context.restore();
      }
      if (screen === SCREEN_PAUSED) {
        drawPanel('Paused', [
          'The valley waits for you.',
          'WASD / arrows — walk · Space / click — flare · M — mute',
        ], [
          { id: 'resume', label: 'Resume', primary: true },
          { id: 'restart', label: 'Restart the night', primary: false },
        ]);
      }
      if (screen === SCREEN_OVER) {
        const cause = state.fuel <= 0 ? 'Your lantern ran dry.' : 'The shadows took you.';
        const isBest = ui.newBest && state.score > 0;
        drawPanel('The light has gone out', [
          cause,
          `Score ${state.score.toLocaleString('en-US')}  ·  Best ${Math.max(ui.best, state.score).toLocaleString('en-US')}${isBest ? '  ·  NEW BEST!' : ''}`,
          `Embers gathered ${state.stats.embers}  ·  Nights survived ${Math.min(state.wave, WAVES)}  ·  Flares ${state.stats.flares}`,
        ], [
          { id: 'restart', label: 'Light the lantern again', primary: true },
        ]);
      }
      if (screen === SCREEN_WIN) {
        const isBest = ui.newBest && state.score > 0;
        drawPanel('Dawn breaks over the valley', [
          'Ten nights, and the light never died. The valley is yours.',
          `Score ${state.score.toLocaleString('en-US')}  ·  Best ${Math.max(ui.best, state.score).toLocaleString('en-US')}${isBest ? '  ·  NEW BEST!' : ''}`,
          `Embers gathered ${state.stats.embers}  ·  Flares ${state.stats.flares}`,
        ], [
          { id: 'restart', label: 'Keep another night', primary: true },
        ]);
      }
      // Vignette: darken the frame's edges so the lantern's pool reads.
      context.setTransform(1, 0, 0, 1, 0, 0);
      const vignette = context.createRadialGradient(
        canvas.width / 2, canvas.height / 2, Math.min(canvas.width, canvas.height) * 0.42,
        canvas.width / 2, canvas.height / 2, Math.max(canvas.width, canvas.height) * 0.75,
      );
      vignette.addColorStop(0, 'rgba(0, 0, 0, 0)');
      vignette.addColorStop(1, 'rgba(0, 0, 0, 0.4)');
      context.fillStyle = vignette;
      context.fillRect(0, 0, canvas.width, canvas.height);
      if (ui.muted) {
        context.save();
        context.fillStyle = PALETTE.textDim;
        context.font = FONT.small;
        context.textAlign = 'right';
        context.fillText('MUTED (M)', canvas.width - 16, canvas.height - 14);
        context.restore();
      }
    },
  };
}
