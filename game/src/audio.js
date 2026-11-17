// Every sound is synthesised live with WebAudio: no audio files, no network.
// The context is created on the first user gesture (browsers block sound
// before one), and an ambient pad hums quietly under the game once it runs.

/** A short envelope on a gain node: attack, then decay to silence. */
function blip(context, destination, { type, from, to, seconds, gain, when = 0 }) {
  const oscillator = context.createOscillator();
  const envelope = context.createGain();
  oscillator.type = type;
  const start = context.currentTime + when;
  oscillator.frequency.setValueAtTime(from, start);
  if (to !== from) oscillator.frequency.exponentialRampToValueAtTime(Math.max(1, to), start + seconds);
  envelope.gain.setValueAtTime(0.0001, start);
  envelope.gain.exponentialRampToValueAtTime(gain, start + 0.012);
  envelope.gain.exponentialRampToValueAtTime(0.0001, start + seconds);
  oscillator.connect(envelope);
  envelope.connect(destination);
  oscillator.start(start);
  oscillator.stop(start + seconds + 0.05);
}

/** A burst of filtered noise, for the flare's whoosh and the hit's thud. */
function noise(context, destination, { seconds, gain, frequency, type = 'bandpass', when = 0 }) {
  const length = Math.max(1, Math.floor(context.sampleRate * seconds));
  const buffer = context.createBuffer(1, length, context.sampleRate);
  const data = buffer.getChannelData(0);
  for (let index = 0; index < length; index += 1) data[index] = Math.random() * 2 - 1;
  const source = context.createBufferSource();
  source.buffer = buffer;
  const filter = context.createBiquadFilter();
  filter.type = type;
  filter.frequency.value = frequency;
  const envelope = context.createGain();
  const start = context.currentTime + when;
  envelope.gain.setValueAtTime(gain, start);
  envelope.gain.exponentialRampToValueAtTime(0.0001, start + seconds);
  source.connect(filter);
  filter.connect(envelope);
  envelope.connect(destination);
  source.start(start);
  source.stop(start + seconds + 0.05);
}

export function createAudio() {
  let context = null;
  let master = null;
  let pad = null;
  let muted = false;

  function ensure() {
    if (context) {
      if (context.state === 'suspended') void context.resume();
      return true;
    }
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return false;
      context = new AudioContext();
      master = context.createGain();
      master.gain.value = muted ? 0 : 0.5;
      master.connect(context.destination);
    } catch {
      return false;
    }
    return true;
  }

  /** Start the low ambient pad (two detuned sines a fifth apart). */
  function startPad() {
    if (!context || pad) return;
    const gain = context.createGain();
    gain.gain.value = 0.035;
    gain.connect(master);
    const first = context.createOscillator();
    first.type = 'sine';
    first.frequency.value = 55;
    const second = context.createOscillator();
    second.type = 'sine';
    second.frequency.value = 82.5;
    const wobble = context.createOscillator();
    wobble.type = 'sine';
    wobble.frequency.value = 0.07;
    const wobbleGain = context.createGain();
    wobbleGain.gain.value = 0.015;
    wobble.connect(wobbleGain);
    wobbleGain.connect(gain.gain);
    first.connect(gain);
    second.connect(gain);
    first.start();
    second.start();
    wobble.start();
    pad = { first, second, wobble };
  }

  function play(run) {
    if (!ensure()) return;
    run();
  }

  return {
    get muted() {
      return muted;
    },
    /** Create the context (call from a user gesture) and start the pad. */
    ensure() {
      if (ensure()) startPad();
    },
    setMuted(value) {
      muted = value;
      if (master) master.gain.value = value ? 0 : 0.5;
    },
    /** An ember pickup: a bright chime that climbs with the combo. */
    pickup(combo) {
      play(() => {
        const base = 620 * Math.pow(1.059, Math.min(combo, 8));
        blip(context, master, { type: 'sine', from: base, to: base * 1.5, seconds: 0.16, gain: 0.22 });
        blip(context, master, { type: 'triangle', from: base * 2, to: base * 2, seconds: 0.1, gain: 0.08 });
      });
    },
    /** A flare: a warm whoosh with a low thump under it. */
    flare() {
      play(() => {
        noise(context, master, { seconds: 0.35, gain: 0.25, frequency: 900 });
        blip(context, master, { type: 'sine', from: 180, to: 60, seconds: 0.3, gain: 0.18 });
      });
    },
    /** A wisp's touch: a dull thud and a sour note. */
    hit() {
      play(() => {
        noise(context, master, { seconds: 0.25, gain: 0.3, frequency: 220, type: 'lowpass' });
        blip(context, master, { type: 'sawtooth', from: 160, to: 70, seconds: 0.35, gain: 0.14 });
      });
    },
    /** A night cleared: a small bell arpeggio. */
    wave() {
      play(() => {
        [523.25, 659.25, 783.99].forEach((frequency, index) => {
          blip(context, master, { type: 'sine', from: frequency, to: frequency, seconds: 0.5, gain: 0.14, when: index * 0.09 });
        });
      });
    },
    /** A power-up collected: a rising fifth. */
    powerup() {
      play(() => {
        blip(context, master, { type: 'triangle', from: 440, to: 660, seconds: 0.18, gain: 0.16 });
        blip(context, master, { type: 'sine', from: 660, to: 880, seconds: 0.22, gain: 0.12, when: 0.08 });
      });
    },
    /** Dawn breaks: a major arpeggio, the win. */
    win() {
      play(() => {
        [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((frequency, index) => {
          blip(context, master, { type: 'sine', from: frequency, to: frequency, seconds: 0.7, gain: 0.14, when: index * 0.12 });
        });
      });
    },
    /** The light goes out: three falling notes. */
    lose() {
      play(() => {
        [392, 311.13, 233.08].forEach((frequency, index) => {
          blip(context, master, { type: 'triangle', from: frequency, to: frequency * 0.94, seconds: 0.6, gain: 0.14, when: index * 0.22 });
        });
      });
    },
    /** A menu click: a soft tick. */
    click() {
      play(() => {
        blip(context, master, { type: 'sine', from: 880, to: 880, seconds: 0.06, gain: 0.1 });
      });
    },
  };
}
