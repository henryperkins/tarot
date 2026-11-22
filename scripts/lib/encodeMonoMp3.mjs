import fs from 'node:fs';
import { createRequire } from 'node:module';

// Both table assets use mono 44.1 kHz audio at 128 kbps.
const SAMPLE_RATE = 44100;
const BITRATE_KBPS = 128;
const FRAME_SAMPLES = 1152;

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
// makes the decoded audio match the source sample count.
function withGaplessInfo(frames, sampleCount) {
  const ENCODER_DELAY = 576; // LAME 3.98, which lamejs ports
  const DECODER_DELAY = 529;
  const frameBytes = Math.floor(144000 * BITRATE_KBPS / SAMPLE_RATE);
  if (frames[0] !== 0xFF || frames[1] !== 0xFB) throw new Error('Expected MPEG-1 Layer III frames');
  let frameCount = 0;
  for (let offset = 0; offset < frames.length; frameCount++) {
    if (frames[offset] !== 0xFF) throw new Error(`Lost frame sync at byte ${offset}`);
    offset += frameBytes + ((frames[offset + 2] >> 1) & 1);
  }
  const padding = frameCount * FRAME_SAMPLES - ENCODER_DELAY - sampleCount;
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

export function encodeMonoMp3(samples, gain = 1) {
  return withGaplessInfo(encodeFrames(samples, gain), samples.length);
}
