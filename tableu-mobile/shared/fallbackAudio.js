// Shared fallback audio waveform generator.
// Creates a short, calming sine-wave clip encoded as a WAV data URI
// so both the Cloudflare worker and the browser can provide audible
// feedback when real TTS is unavailable.

export function generateFallbackWaveform(text = '') {
  const sampleRate = 22050;
  const words = typeof text === 'string'
    ? text.trim().split(/\s+/).filter(Boolean).length || 1
    : 1;
  const durationSeconds = Math.max(1.5, Math.min(12, words * 0.8));
  const totalSamples = Math.floor(sampleRate * durationSeconds);
  const baseFrequency = 200 + Math.min(300, words * 40);
  const sweepFrequency = baseFrequency + Math.min(260, text.length || 0);
  const amplitude = 0.4;

  const buffer = new ArrayBuffer(44 + totalSamples * 2);
  const view = new DataView(buffer);

  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + totalSamples * 2, true);
  writeString(view, 8, 'WAVE');

  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true); // Subchunk1Size
  view.setUint16(20, 1, true); // Audio format (PCM)
  view.setUint16(22, 1, true); // Number of channels (mono)
  view.setUint32(24, sampleRate, true); // Sample rate
  view.setUint32(28, sampleRate * 2, true); // Byte rate (SampleRate * NumChannels * BitsPerSample/8)
  view.setUint16(32, 2, true); // Block align
  view.setUint16(34, 16, true); // Bits per sample

  writeString(view, 36, 'data');
  view.setUint32(40, totalSamples * 2, true);

  const dataView = new DataView(buffer, 44);
  for (let i = 0; i < totalSamples; i += 1) {
    const time = i / sampleRate;
    const sweep = baseFrequency + (sweepFrequency - baseFrequency) * (i / totalSamples);
    const envelope = Math.sin(Math.PI * Math.min(1, time / durationSeconds));
    const sample = Math.sin(2 * Math.PI * sweep * time) * amplitude * envelope;
    dataView.setInt16(i * 2, sample * 0x7fff, true);
  }

  const wavBytes = new Uint8Array(buffer);
  const base64Audio = uint8ToBase64(wavBytes);
  return `data:audio/wav;base64,${base64Audio}`;
}

function writeString(view, offset, string) {
  for (let i = 0; i < string.length; i += 1) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}

function uint8ToBase64(uint8Array) {
  // Node.js / Cloudflare Workers environment
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(uint8Array).toString('base64');
  }

  // Browser environment - build binary string in chunks to avoid stack overflow
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < uint8Array.length; i += chunkSize) {
    const chunk = uint8Array.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  if (typeof btoa === 'function') {
    return btoa(binary);
  }

  throw new Error('No base64 encoder available in this environment.');
}
