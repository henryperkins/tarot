#!/usr/bin/env node
// Renders the Table Ambience loop: a quiet room tone with occasional card
// handling and candle crackle. The synthesis is seeded, so a rerun reproduces
// the mix; change the constants below and rerun to revise it.
//
//   node scripts/audio/generateAmbience.mjs [output.mp3]
//
// The loop is mixed for the level a listener gets, not for the file's peak:
// the player runs it at a 0.2 base volume and swells to at most 0.36 under a
// reading (src/lib/audio.js, src/hooks/useAudioController.js).
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { decodeMp3, measureLoop } from '../lib/audioLevels.mjs';

const SAMPLE_RATE = 44100;
const LOOP_SECONDS = 30;
const LOOP_SAMPLES = SAMPLE_RATE * LOOP_SECONDS;
const BITRATE_KBPS = 128;
const FRAME_SAMPLES = 1152;
const PLAYER_BASE_VOLUME = 0.2;
const PLAYER_PEAK_SWELL_VOLUME = 0.36;

// Level of the decoded file's 20 Hz-20 kHz content. At the 0.2 base volume
// this plays at -44 dBFS RMS.
const TARGET_AUDIBLE_DBFS = -30;

// Mix balance, in dBFS before the final trim to the target above.
const BED_LEVEL_DB = -30.8;
const CRACKLE_PEAK_DB = -11;
const CARD_EVENTS = [
  { type: 'riffle', at: 6.6, levelDb: -24 },
  { type: 'overhand', at: 16.9, levelDb: -26 },
  { type: 'deal', at: 24.6, levelDb: -25 }
];
// Nothing but room tone within this many seconds of the loop point, so the
// join never cuts through a card or a crackle (or its room tail).
const QUIET_EDGE_SECONDS = 1.5;
const BED_CROSSFADE_SECONDS = 2;
const SUBSONIC_CUTOFF_HZ = 38;

const TAU = Math.PI * 2;
const dbToGain = db => 10 ** (db / 20);

function mulberry32(seed) {
  let value = seed >>> 0;
  return () => {
    value += 0x6D2B79F5;
    let t = value;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// One random stream per layer: retuning the candle leaves the cards alone.
const SEEDS = { bed: 0x7AB1E001, cards: 0x7AB1E002, candle: 0x7AB1E003 };

function rmsOf(samples, from = 0, to = samples.length) {
  let sum = 0;
  for (let i = from; i < to; i++) sum += samples[i] * samples[i];
  return Math.sqrt(sum / Math.max(1, to - from));
}

function peakOf(samples) {
  let peak = 0;
  for (let i = 0; i < samples.length; i++) peak = Math.max(peak, Math.abs(samples[i]));
  return peak;
}

function scale(samples, gain) {
  for (let i = 0; i < samples.length; i++) samples[i] *= gain;
  return samples;
}

function loudestWindowRms(samples, seconds = 0.125) {
  const size = Math.round(seconds * SAMPLE_RATE);
  let loudest = 0;
  for (let start = 0; start + size <= samples.length; start += size >> 2) loudest = Math.max(loudest, rmsOf(samples, start, start + size));
  return loudest;
}

// Second-order filter, in place. `wrap` runs the loop twice and keeps the
// second pass, so the filter enters sample 0 in the state it leaves the last
// sample and the loop point stays continuous.
function filter(samples, type, frequency, q = Math.SQRT1_2, { wrap = false } = {}) {
  const w0 = TAU * frequency / SAMPLE_RATE, cos = Math.cos(w0), alpha = Math.sin(w0) / (2 * q);
  const a0 = 1 + alpha, a1 = -2 * cos / a0, a2 = (1 - alpha) / a0;
  let b0, b1, b2;
  if (type === 'highpass') { b0 = (1 + cos) / 2 / a0; b1 = -(1 + cos) / a0; b2 = b0; }
  else if (type === 'lowpass') { b0 = (1 - cos) / 2 / a0; b1 = (1 - cos) / a0; b2 = b0; }
  else { b0 = alpha / a0; b1 = 0; b2 = -b0; } // bandpass, unity gain at its centre
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let pass = wrap ? 0 : 1; pass < 2; pass++) {
    for (let i = 0; i < samples.length; i++) {
      const x = samples[i];
      const y = b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
      x2 = x1; x1 = x; y2 = y1; y1 = y;
      if (pass === 1) samples[i] = y;
    }
  }
  return samples;
}

function pinkNoise(length, random) {
  // Paul Kellett's filter: white noise to -3 dB per octave.
  const out = new Float64Array(length);
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
  for (let i = 0; i < length; i++) {
    const white = random() * 2 - 1;
    b0 = 0.99886 * b0 + white * 0.0555179;
    b1 = 0.99332 * b1 + white * 0.0750759;
    b2 = 0.96900 * b2 + white * 0.1538520;
    b3 = 0.86650 * b3 + white * 0.3104856;
    b4 = 0.55000 * b4 + white * 0.5329522;
    b5 = -0.7616 * b5 - white * 0.0168980;
    out[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
    b6 = white * 0.115926;
  }
  return out;
}

// --- Room tone -------------------------------------------------------------

function renderRoomTone() {
  const random = mulberry32(SEEDS.bed);
  const warmUp = SAMPLE_RATE, fade = BED_CROSSFADE_SECONDS * SAMPLE_RATE;
  const length = warmUp + LOOP_SAMPLES + fade;
  // The body of the room: low-mid air that small speakers can still carry.
  const body = pinkNoise(length, random);
  filter(body, 'highpass', 150);
  filter(body, 'lowpass', 900, 0.6);
  filter(body, 'lowpass', 1980);
  // A little open air above it, and warmth below for headphones.
  const air = pinkNoise(length, random);
  filter(air, 'highpass', 1800);
  filter(air, 'lowpass', 6500);
  const warmth = pinkNoise(length, random);
  filter(warmth, 'highpass', 60);
  filter(warmth, 'lowpass', 160);
  const bodyGain = 1 / rmsOf(body, warmUp);
  const airGain = dbToGain(-15) / rmsOf(air, warmUp);
  const warmthGain = dbToGain(-9) / rmsOf(warmth, warmUp);

  const out = new Float64Array(LOOP_SAMPLES);
  for (let i = 0; i < LOOP_SAMPLES; i++) {
    const turn = TAU * i / LOOP_SAMPLES;
    // Every slow movement completes whole cycles per loop.
    const airDrift = 1 + 0.22 * (Math.sin(turn + 5.1) + 0.6 * Math.sin(4 * turn + 1.3));
    const at = index => body[index] * bodyGain + air[index] * airGain * airDrift + warmth[index] * warmthGain;
    let value = at(warmUp + i);
    if (i < fade) {
      // Blend the take's own continuation into its head with equal power:
      // the last sample is followed by the sample that really came next.
      const theta = (Math.PI / 2) * (i / fade);
      value = value * Math.sin(theta) + at(warmUp + LOOP_SAMPLES + i) * Math.cos(theta);
    }
    const breath = 1 + 0.08 * Math.sin(2 * turn + 0.7) + 0.055 * Math.sin(3 * turn + 2.1) + 0.035 * Math.sin(7 * turn + 4.4);
    out[i] = value * breath;
  }
  return scale(out, dbToGain(BED_LEVEL_DB) / rmsOf(out));
}

// --- Small sounds ----------------------------------------------------------

// A burst of noise with a fast attack and an exponential tail, shaped by a
// wide band-pass. The low Q keeps it papery; a ringing resonator reads as glass.
function addTick(buffer, at, { amp, frequency, decay, q = 1.3, attack = 0.00025 }, random) {
  const start = Math.round(at * SAMPLE_RATE);
  const tick = new Float64Array(Math.round((attack + decay * 7) * SAMPLE_RATE) + 64);
  for (let i = 0; i < tick.length; i++) {
    const t = i / SAMPLE_RATE;
    tick[i] = (random() * 2 - 1) * (1 - Math.exp(-t / attack)) * Math.exp(-t / decay);
  }
  filter(tick, 'bandpass', frequency, q);
  const gain = amp / (peakOf(tick) || 1);
  for (let i = 0; i < tick.length && start + i < buffer.length; i++) buffer[start + i] += tick[i] * gain;
}

// Paper against paper: noise through a swept band-pass, with an uneven
// stick-slip grain so it reads as friction rather than hiss.
function addFriction(buffer, at, { seconds, amp, sweep, q = 0.9, attack = 0.03, release = 0.08, grainHz = 70, grainDepth = 0.4 }, random) {
  const start = Math.round(at * SAMPLE_RATE), length = Math.round(seconds * SAMPLE_RATE);
  const slide = new Float64Array(length);
  const [from, middle, to] = sweep;
  const grainRate = 1 - Math.exp(-TAU * grainHz / SAMPLE_RATE);
  let low = 0, band = 0, grain = 0;
  for (let i = 0; i < length; i++) {
    const progress = i / length;
    const centre = progress < 0.5 ? from + (middle - from) * progress * 2 : middle + (to - middle) * (progress - 0.5) * 2;
    const f = 2 * Math.sin(Math.PI * centre / SAMPLE_RATE);
    low += f * band;
    band += f * ((random() * 2 - 1) - low - band / q);
    grain += grainRate * ((random() * 2 - 1) - grain);
    const envelope = Math.min(1, i / SAMPLE_RATE / attack) ** 1.5 * Math.min(1, (length - i) / SAMPLE_RATE / release) ** 1.5;
    slide[i] = band * envelope * (1 - grainDepth + grainDepth * Math.min(1, Math.abs(grain) * 9));
  }
  const gain = amp / (peakOf(slide) || 1);
  for (let i = 0; i < length && start + i < buffer.length; i++) buffer[start + i] += slide[i] * gain;
}

// A soft pat on the cloth: a quick falling thump with a little felt on top.
function addPat(buffer, at, { amp, from = 185, to = 105, decay = 0.03 }, random) {
  const start = Math.round(at * SAMPLE_RATE), length = Math.round(decay * 6 * SAMPLE_RATE);
  let phase = 0;
  for (let i = 0; i < length && start + i < buffer.length; i++) {
    const t = i / SAMPLE_RATE;
    phase += TAU * (from + (to - from) * Math.min(1, 2.5 * i / length)) / SAMPLE_RATE;
    buffer[start + i] += Math.sin(phase) * Math.min(1, t / 0.002) * Math.exp(-t / decay) * amp;
  }
  addTick(buffer, at, { amp: amp * 0.5, frequency: 900 + random() * 500, decay: 0.004, q: 1 }, random);
}

// --- Card handling ---------------------------------------------------------

const CARD_SOUNDS = {
  // Two halves of the deck falling together, the bridge, then squaring up.
  riffle(random) {
    const clip = new Float64Array(Math.round(1.6 * SAMPLE_RATE));
    let t = 0.02;
    const cards = 30;
    for (let k = 0; k < cards; k++) {
      const progress = k / (cards - 1);
      const swell = Math.sin(Math.PI * Math.min(1, 0.12 + progress * 0.95)) ** 0.7;
      addTick(clip, t, { amp: (0.45 + random() * 0.55) * swell, frequency: 2300 + random() * 1900, decay: 0.0022 + random() * 0.0016, q: 1.1 }, random);
      addTick(clip, t + 0.0006, { amp: (0.2 + random() * 0.2) * swell, frequency: 650 + random() * 350, decay: 0.004, q: 1 }, random);
      // The cards fall faster through the middle of the deck.
      t += (0.021 - 0.011 * Math.sin(Math.PI * progress)) * (0.8 + random() * 0.4);
    }
    addFriction(clip, 0.01, { seconds: t, amp: 0.16, sweep: [2400, 3600, 2800], q: 0.7, attack: 0.08, release: 0.06, grainHz: 110, grainDepth: 0.5 }, random);
    const bridgeAt = t + 0.13;
    let b = bridgeAt;
    for (let k = 0; k < 34; k++) {
      const progress = k / 33;
      addTick(clip, b, { amp: (0.25 + random() * 0.3) * Math.sin(Math.PI * (0.1 + 0.85 * progress)), frequency: 2600 + random() * 2200, decay: 0.0016 + random() * 0.001, q: 1 }, random);
      b += (0.0105 - 0.004 * Math.sin(Math.PI * progress)) * (0.8 + random() * 0.4);
    }
    addFriction(clip, bridgeAt - 0.01, { seconds: b - bridgeAt + 0.05, amp: 0.3, sweep: [2600, 4200, 3000], q: 0.7, attack: 0.05, release: 0.1, grainHz: 140, grainDepth: 0.45 }, random);
    addPat(clip, b + 0.16, { amp: 0.34 }, random);
    addPat(clip, b + 0.29, { amp: 0.22, from: 170 }, random);
    return clip;
  },
  // Small packets dropping from one hand into the other.
  overhand(random) {
    const clip = new Float64Array(Math.round(1.5 * SAMPLE_RATE));
    let t = 0.02;
    for (let k = 0; k < 5; k++) {
      const amp = 0.6 + random() * 0.4;
      addFriction(clip, t, { seconds: 0.075 + random() * 0.03, amp: 0.8 * amp, sweep: [1900 + random() * 500, 3300 + random() * 700, 2500], q: 0.8, attack: 0.012, release: 0.045, grainHz: 90, grainDepth: 0.5 }, random);
      addTick(clip, t + 0.07, { amp: 0.5 * amp, frequency: 1500 + random() * 900, decay: 0.003, q: 1.1 }, random);
      addPat(clip, t + 0.075, { amp: 0.16 * amp, from: 210, to: 130, decay: 0.02 }, random);
      t += 0.19 + random() * 0.05 - k * 0.008;
    }
    return clip;
  },
  // Two cards drawn off the deck and laid down.
  deal(random) {
    const clip = new Float64Array(Math.round(1.4 * SAMPLE_RATE));
    let t = 0.02;
    for (let k = 0; k < 2; k++) {
      const seconds = 0.2 + random() * 0.06;
      addFriction(clip, t, { seconds, amp: 0.85, sweep: [1700, 3900, 2900], q: 0.85, attack: 0.05, release: 0.05, grainHz: 60, grainDepth: 0.35 }, random);
      addTick(clip, t + seconds - 0.012, { amp: 0.6, frequency: 2300 + random() * 600, decay: 0.003, q: 1.1 }, random);
      addPat(clip, t + seconds + 0.11 + random() * 0.04, { amp: 0.2, from: 200, to: 120, decay: 0.022 }, random);
      t += seconds + 0.42 + random() * 0.08;
    }
    return clip;
  }
};

function renderCards() {
  const random = mulberry32(SEEDS.cards);
  const out = new Float64Array(LOOP_SAMPLES);
  const spans = [];
  for (const { type, at, levelDb } of CARD_EVENTS) {
    const clip = CARD_SOUNDS[type](random);
    filter(clip, 'highpass', 240);
    filter(clip, 'lowpass', 7000);
    scale(clip, dbToGain(levelDb) / loudestWindowRms(clip));
    const start = Math.round(at * SAMPLE_RATE);
    let last = 0;
    for (let i = 0; i < clip.length; i++) {
      out[start + i] += clip[i];
      if (Math.abs(clip[i]) > 1e-4) last = i;
    }
    spans.push([at, at + last / SAMPLE_RATE]);
  }
  return { samples: out, spans };
}

// --- Candle ----------------------------------------------------------------

// Crackles come in small irregular clusters, as a wick does, and stay clear
// of the card sounds so each texture can be told apart.
function renderCandle(cardSpans) {
  const random = mulberry32(SEEDS.candle);
  const exponential = mean => -Math.log(1 - random()) * mean;
  const out = new Float64Array(LOOP_SAMPLES);
  for (let at = 1.3; at < LOOP_SECONDS - QUIET_EDGE_SECONDS - 0.6; at += 0.9 + exponential(1.5)) {
    if (cardSpans.some(([from, to]) => at > from - 0.35 && at < to + 0.35)) continue;
    const pops = Math.min(7, 2 + Math.floor(exponential(2.4)));
    const strength = 0.5 + 0.5 * random() ** 1.4;
    let offset = 0;
    for (let k = 0; k < pops; k++) {
      if (random() < 0.14) {
        // A bigger pop: a low body, a bright snap, and a sputter of wax.
        addTick(out, at + offset, { amp: strength, frequency: 520 + random() * 420, decay: 0.008 + random() * 0.006, q: 2.2 }, random);
        addTick(out, at + offset, { amp: strength * 0.55, frequency: 2800 + random() * 1800, decay: 0.0016, q: 1 }, random);
        const sputter = new Float64Array(Math.round(0.09 * SAMPLE_RATE));
        for (let i = 0; i < sputter.length; i++) sputter[i] = (random() * 2 - 1) * Math.exp(-i / (0.022 * SAMPLE_RATE));
        filter(sputter, 'highpass', 3200);
        const start = Math.round((at + offset + 0.004) * SAMPLE_RATE);
        for (let i = 0; i < sputter.length; i++) out[start + i] += sputter[i] * strength * 0.16;
      } else {
        addTick(out, at + offset, { amp: strength * (0.35 + 0.55 * random() ** 1.5), frequency: 1300 * 3.6 ** random(), decay: 0.002 + random() * 0.005, q: 1.2 + random() * 1.4 }, random);
      }
      offset += 0.018 + exponential(0.055);
    }
  }
  filter(out, 'highpass', 350);
  filter(out, 'lowpass', 8000);
  return scale(out, dbToGain(CRACKLE_PEAK_DB) / peakOf(out));
}

// --- Room ------------------------------------------------------------------

// A small, soft room around the table sounds (Schroeder combs and all-passes).
function smallRoom(dry) {
  const out = new Float64Array(dry.length);
  const combs = [1116, 1188, 1277, 1356, 1422, 1491, 1557, 1617];
  for (const delay of combs) {
    const line = new Float64Array(delay);
    let index = 0, damped = 0;
    for (let i = 0; i < dry.length; i++) {
      const echo = line[index];
      damped = echo * 0.55 + damped * 0.45;
      line[index] = dry[i] + damped * 0.6;
      index = index + 1 === delay ? 0 : index + 1;
      out[i] += echo;
    }
  }
  for (const delay of [556, 441, 341, 225]) {
    const line = new Float64Array(delay);
    let index = 0;
    for (let i = 0; i < out.length; i++) {
      const echo = line[index];
      line[index] = out[i] + echo * 0.5;
      out[i] = echo - out[i] * 0.5;
      index = index + 1 === delay ? 0 : index + 1;
    }
  }
  filter(out, 'lowpass', 4200);
  filter(out, 'highpass', 250);
  return out;
}

export function renderAmbience() {
  const roomTone = renderRoomTone();
  const cards = renderCards();
  const candle = renderCandle(cards.spans);
  const table = new Float64Array(LOOP_SAMPLES);
  for (let i = 0; i < LOOP_SAMPLES; i++) table[i] = cards.samples[i] + candle[i];
  const room = smallRoom(table);
  const roomGain = dbToGain(-13) * rmsOf(table) / rmsOf(room);
  for (let i = 0; i < LOOP_SAMPLES; i++) table[i] += room[i] * roomGain;

  const edge = Math.round(QUIET_EDGE_SECONDS * SAMPLE_RATE / 2);
  if (Math.max(peakOf(table.subarray(0, edge)), peakOf(table.subarray(LOOP_SAMPLES - edge))) > dbToGain(-80)) {
    throw new Error('A table sound reaches the loop point; move it or widen QUIET_EDGE_SECONDS.');
  }

  const mix = new Float64Array(LOOP_SAMPLES);
  for (let i = 0; i < LOOP_SAMPLES; i++) mix[i] = roomTone[i] + table[i];
  // Fourth-order high-pass: no DC and nothing below hearing.
  filter(mix, 'highpass', SUBSONIC_CUTOFF_HZ, Math.SQRT1_2, { wrap: true });
  filter(mix, 'highpass', SUBSONIC_CUTOFF_HZ, Math.SQRT1_2, { wrap: true });
  return mix;
}

// --- MP3 -------------------------------------------------------------------

// lamejs 1.2.1's CommonJS entry reads undeclared globals and throws in Node;
// its single-file bundle is intact.
function loadEncoder() {
  const bundle = createRequire(import.meta.url).resolve('lamejs/lame.all.js');
  return new Function(`${fs.readFileSync(bundle, 'utf8')}; return lamejs;`)().Mp3Encoder;
}

function encodeFrames(samples, gain) {
  const Mp3Encoder = loadEncoder();
  const pcm = new Int16Array(samples.length);
  for (let i = 0; i < samples.length; i++) pcm[i] = Math.round(Math.max(-1, Math.min(1, samples[i] * gain)) * 32767);
  const encoder = new Mp3Encoder(1, SAMPLE_RATE, BITRATE_KBPS);
  const chunks = [];
  for (let offset = 0; offset < pcm.length; offset += FRAME_SAMPLES) {
    const encoded = encoder.encodeBuffer(pcm.subarray(offset, offset + FRAME_SAMPLES));
    if (encoded.length) chunks.push(Buffer.from(encoded));
  }
  const flushed = encoder.flush();
  if (flushed.length) chunks.push(Buffer.from(flushed));
  return Buffer.concat(chunks);
}

function crc16(bytes) {
  let crc = 0;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = crc & 1 ? (crc >>> 1) ^ 0xA001 : crc >>> 1;
  }
  return crc;
}

// An MP3 stream starts with the encoder's delay and ends with padding. Left
// alone, a looping player renders both as about 40 ms of silence at every
// repeat. This leading Info frame tells the decoder how much to trim, which
// makes the decoded loop exactly LOOP_SAMPLES long.
function withGaplessInfo(frames) {
  const ENCODER_DELAY = 576; // LAME 3.98, which lamejs ports
  const DECODER_DELAY = 529;
  const frameBytes = Math.floor(144000 * BITRATE_KBPS / SAMPLE_RATE);
  if (frames[0] !== 0xFF || frames[1] !== 0xFB) throw new Error('Expected MPEG-1 Layer III frames');
  let frameCount = 0;
  for (let offset = 0; offset < frames.length; frameCount++) {
    if (frames[offset] !== 0xFF) throw new Error(`Lost frame sync at byte ${offset}`);
    offset += frameBytes + ((frames[offset + 2] >> 1) & 1);
  }
  const padding = frameCount * FRAME_SAMPLES - ENCODER_DELAY - LOOP_SAMPLES;
  if (padding < DECODER_DELAY || padding > 0xFFF) throw new Error(`Encoder padding ${padding} cannot be declared`);

  const info = Buffer.alloc(frameBytes);
  info.set([frames[0], frames[1], frames[2] & 0xFD, frames[3]]);
  let at = 4 + 17; // frame header, then mono side information
  at += info.write('Info', at, 'latin1');
  at = info.writeUInt32BE(0x0F, at); // frames, bytes, seek table and quality follow
  at = info.writeUInt32BE(frameCount, at);
  at = info.writeUInt32BE(frames.length + frameBytes, at);
  for (let i = 0; i < 100; i++) info[at++] = Math.floor(i * 256 / 100);
  at = info.writeUInt32BE(0, at);
  at += info.write('LAME3.98r', at, 'latin1');
  info[at++] = 0x01; // constant bitrate
  at += 9; // lowpass and replay gain: not stated
  info[at++] = 0; // encoding flags
  info[at++] = BITRATE_KBPS;
  info[at++] = ENCODER_DELAY >> 4;
  info[at++] = ((ENCODER_DELAY & 0x0F) << 4) | (padding >> 8);
  info[at++] = padding & 0xFF;
  info[at++] = 0x40; // 44.1 kHz source, mono
  at += 3; // gain, preset
  at = info.writeUInt32BE(frames.length + frameBytes, at);
  at += 2; // music CRC: not stated
  info.writeUInt16BE(crc16(info.subarray(0, at)), at);
  return Buffer.concat([info, frames]);
}

// Encode, decode, and trim the gain until the decoded file sits on the target:
// the encoder attenuates its input slightly, and the level that matters is
// the one a decoder produces.
export async function encodeAmbience(samples) {
  let gain = dbToGain(TARGET_AUDIBLE_DBFS) / rmsOf(samples);
  for (let attempt = 0; ; attempt++) {
    const mp3 = withGaplessInfo(encodeFrames(samples, gain));
    const decoded = await decodeMp3(mp3);
    const levels = measureLoop(decoded.samples, decoded.sampleRate);
    const error = TARGET_AUDIBLE_DBFS - levels.audibleDbfs;
    if (Math.abs(error) <= 0.02 || attempt === 3) return { mp3, decoded, levels };
    gain *= dbToGain(error);
  }
}

async function main() {
  const defaultPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../public/sounds/ambience.mp3');
  const outputPath = process.argv[2] ? path.resolve(process.cwd(), process.argv[2]) : defaultPath;
  const { mp3, decoded, levels } = await encodeAmbience(renderAmbience());
  if (decoded.samples.length !== LOOP_SAMPLES) throw new Error(`Decoded ${decoded.samples.length} samples, expected ${LOOP_SAMPLES}`);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, mp3);

  const played = volume => (levels.audibleDbfs + 20 * Math.log10(volume)).toFixed(2);
  console.log(`Wrote ${outputPath} (${mp3.length} bytes, ${levels.seconds.toFixed(3)} s, ${BITRATE_KBPS} kbps mono)`);
  console.log(`Audible band (20 Hz-20 kHz): ${levels.audibleDbfs.toFixed(2)} dBFS RMS in the file`);
  console.log(`  at the ${PLAYER_BASE_VOLUME} base volume: ${played(PLAYER_BASE_VOLUME)} dBFS`);
  console.log(`  at the ${PLAYER_PEAK_SWELL_VOLUME} loudest swell: ${played(PLAYER_PEAK_SWELL_VOLUME)} dBFS`);
  console.log(`Energy below 20 Hz: ${(levels.subsonicShare * 100).toFixed(4)}% of the total`);
  console.log(`DC offset: ${levels.dcOffset.toExponential(2)}; peak: ${levels.peakDbfs.toFixed(2)} dBFS`);
  console.log(`Loop point: head ${levels.headDbfs.toFixed(1)} dBFS, tail ${levels.tailDbfs.toFixed(1)} dBFS, join step ${levels.joinStep.toExponential(2)} (typical step ${levels.typicalStep.toExponential(2)})`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
