import { normalizeReadingText, prepareForTTS } from './formatting.js';

let flipAudio = null;
let ambienceAudio = null;
let ttsAudio = null;

export function initAudio() {
  if (typeof Audio === 'undefined') {
    return {
      flipAudio: null,
      ambienceAudio: null
    };
  }

  if (!flipAudio) {
    try {
      flipAudio = new Audio('/sounds/flip.mp3');
      flipAudio.preload = 'auto';
    } catch {
      flipAudio = null;
    }
  }

  if (!ambienceAudio) {
    try {
      ambienceAudio = new Audio('/sounds/ambience.mp3');
      ambienceAudio.loop = true;
      ambienceAudio.volume = 0.2;
    } catch {
      ambienceAudio = null;
    }
  }

  return {
    flipAudio,
    ambienceAudio
  };
}

export function playFlip() {
  if (!flipAudio) return;
  try {
    flipAudio.currentTime = 0;
    void flipAudio.play();
  } catch {
    // ignore autoplay / interruption errors
  }
}

export function toggleAmbience(on) {
  if (!ambienceAudio) return;
  try {
    if (on) {
      void ambienceAudio.play();
    } else {
      ambienceAudio.pause();
    }
  } catch {
    // ignore autoplay / interruption errors
  }
}

/**
 * Enhanced text-to-speech with intelligent caching and context-aware narration.
 *
 * Normalizes Markdown text before speaking to avoid "asterisk asterisk" narration
 * and create a natural, human storyteller voice.
 *
 * @param {Object} options
 * @param {string} options.text - Text to speak (can be Markdown)
 * @param {boolean} options.enabled - Whether TTS is enabled
 * @param {string} [options.context='default'] - Reading context (card-reveal, full-reading, synthesis, etc.)
 * @param {string} [options.voice='nova'] - Voice selection (nova, shimmer, alloy, echo, fable, onyx)
 */
export async function speakText({ text, enabled, context = 'default', voice = 'nova' }) {
  if (!enabled) return;
  if (!text || !text.trim()) return;
  if (typeof window === 'undefined' || typeof Audio === 'undefined') return;

  try {
    // Stop any currently playing TTS
    if (ttsAudio) {
      ttsAudio.pause();
      ttsAudio = null;
    }

    // Normalize and prepare text for TTS
    // This removes Markdown markers and adds natural pauses
    const normalizedText = normalizeReadingText(text);
    const ttsText = prepareForTTS(normalizedText);

    // Check cache first (using normalized text for consistent keys)
    const cacheKey = generateCacheKey(ttsText, context, voice);
    const cachedAudio = getCachedAudio(cacheKey);

    let audioDataUri;

    if (cachedAudio) {
      // Use cached audio
      audioDataUri = cachedAudio;
    } else {
      // Fetch from API with normalized TTS text
      const response = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: ttsText, context, voice })
      });

      if (!response.ok) {
        console.error('TTS error:', response.status);
        return;
      }

      const data = await response.json();
      if (!data?.audio) {
        console.error('No audio field in TTS response');
        return;
      }

      audioDataUri = data.audio;

      // Cache the audio for future use
      cacheAudio(cacheKey, audioDataUri);
    }

    // Play the audio
    const audio = new Audio(audioDataUri);
    ttsAudio = audio;
    await audio.play();
  } catch (err) {
    console.error('Error playing TTS audio:', err);
  }
}

/**
 * Generate a cache key from text, context, and voice.
 * Uses simple hash to keep localStorage keys reasonable.
 */
function generateCacheKey(text, context, voice) {
  const content = `${text}|${context}|${voice}`;
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return `tts_cache_${Math.abs(hash).toString(36)}`;
}

/**
 * Get cached audio from localStorage.
 * Returns null if not found or cache is stale.
 */
function getCachedAudio(key) {
  try {
    if (typeof localStorage === 'undefined') return null;

    const cached = localStorage.getItem(key);
    if (!cached) return null;

    const data = JSON.parse(cached);
    const now = Date.now();
    const cacheAge = now - data.timestamp;
    const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days

    // Invalidate stale cache
    if (cacheAge > maxAge) {
      localStorage.removeItem(key);
      return null;
    }

    return data.audio;
  } catch (err) {
    console.warn('Error reading TTS cache:', err);
    return null;
  }
}

/**
 * Cache audio data URI in localStorage.
 * Implements size limit and eviction strategy.
 */
function cacheAudio(key, audioDataUri) {
  try {
    if (typeof localStorage === 'undefined') return;

    const data = {
      audio: audioDataUri,
      timestamp: Date.now()
    };

    // Check cache size and evict if needed
    const cacheKeys = Object.keys(localStorage).filter(k => k.startsWith('tts_cache_'));

    // If we have too many cached items, remove oldest
    if (cacheKeys.length >= 50) {
      const entries = cacheKeys.map(k => {
        try {
          const item = JSON.parse(localStorage.getItem(k));
          return { key: k, timestamp: item.timestamp };
        } catch {
          return { key: k, timestamp: 0 };
        }
      });

      // Sort by timestamp (oldest first)
      entries.sort((a, b) => a.timestamp - b.timestamp);

      // Remove oldest 10
      for (let i = 0; i < 10; i++) {
        localStorage.removeItem(entries[i].key);
      }
    }

    // Store new cache entry
    localStorage.setItem(key, JSON.stringify(data));
  } catch (err) {
    // localStorage full or unavailable - just continue without caching
    console.warn('Unable to cache TTS audio:', err);
  }
}

export function cleanupAudio() {
  try {
    if (flipAudio) {
      flipAudio.pause();
      flipAudio = null;
    }
    if (ambienceAudio) {
      ambienceAudio.pause();
      ambienceAudio = null;
    }
    if (ttsAudio) {
      ttsAudio.pause();
      ttsAudio = null;
    }
  } catch {
    // ignore cleanup errors
  }
}