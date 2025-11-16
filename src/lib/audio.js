import { normalizeReadingText, prepareForTTS } from './formatting.js';
import { generateFallbackWaveform } from '../../shared/fallbackAudio.js';

let flipAudio = null;
let ambienceAudio = null;
let ttsAudio = null;
let currentTTSState = {
  status: 'idle',
  provider: null,
  source: null,
  cached: false,
  error: null,
  message: null,
  reason: null,
  context: null
};
const ttsListeners = new Set();
let currentNarrationRequestId = 0;
let activeNarrationId = null;
let cancelledUpToRequestId = 0;
let audioUnlocked = false;
let audioUnlockPromise = null;
let unlockListenersRegistered = false;

/**
 * Unlock audio playback by creating and playing a silent audio element.
 * Must be called from a user interaction event (click, touch, keydown, etc.)
 * to satisfy browser autoplay policies.
 */
export async function unlockAudio() {
  if (audioUnlocked) return true;
  if (typeof Audio === 'undefined' || typeof window === 'undefined') return false;

  if (audioUnlockPromise) {
    return audioUnlockPromise;
  }

  let silentAudio;
  try {
    silentAudio = new Audio('data:audio/mp3;base64,//MkxAAHiAICWABElBeKPL/RANb2w+yiT1g/gTok//lP/W/l3h8QO/OCdCqCW2Cw//MkxAQHkAIWUAhEmAQXWUOFW2dxPu//9mr60ElY5sseQ+xxesmHKtZr7bsqqX2L//MkxAgFwAYiQAhEAC2hq22d3///9FTV6tA36JdgBJoOGgc+7qvqej5Zu7/7uI9l//MkxBQHAAYi8AhEAO193vt9KGOq+6qcT7hhfN5FTInmwk8RkqKImTM55pRQHQSq//MkxBsGkgoIAABHhTACIJLf99nVI///yuW1uBqWfEu7CgNPWGpUadBmZ////4sL//MkxCMHMAH9iABEmAsKioqKigsLCwtVTEFNRTMuOTkuNVVVVVVVVVVVVVVVVVVV//MkxCkECAUYCAAAAFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV');
    silentAudio.volume = 0.01; // Nearly silent
  } catch (err) {
    console.warn('[Audio] Error creating unlock audio element:', err);
    return false;
  }

  audioUnlockPromise = (async () => {
    try {
      const playPromise = silentAudio.play();
      if (playPromise && typeof playPromise.then === 'function') {
        await playPromise;
      }
      audioUnlocked = true;
      console.log('[Audio] Audio context unlocked');
      return true;
    } catch (err) {
      console.warn('[Audio] Audio unlock failed - user interaction needed', err);
      audioUnlocked = false;
      return false;
    } finally {
      try {
        silentAudio.pause();
        silentAudio.currentTime = 0;
      } catch {
        // no-op
      }
      audioUnlockPromise = null;
    }
  })();

  return audioUnlockPromise;
}

export function initAudio() {
  if (typeof Audio === 'undefined') {
    return {
      flipAudio: null,
      ambienceAudio: null
    };
  }

  // Set up unlock listeners on first init
  if (typeof window !== 'undefined' && !unlockListenersRegistered) {
    unlockListenersRegistered = true;
    const unlockEvents = ['click', 'touchstart', 'keydown'];
    const unlockHandler = () => {
      void unlockAudio().then(success => {
        if (success) {
          unlockEvents.forEach(event => {
            window.removeEventListener(event, unlockHandler);
          });
        }
      });
    };
    unlockEvents.forEach(event => {
      window.addEventListener(event, unlockHandler, { passive: true });
    });
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
 * @param {string} [options.voice='verse'] - Voice selection (alloy, ash, ballad, coral, echo, fable, nova, onyx, sage, shimmer, verse)
 * @param {number} [options.speed] - Playback speed (0.25-4.0, default 1.1 for engaging pace)
 * @param {boolean} [options.stream=false] - Use streaming mode for progressive audio playback
 */
export async function speakText({ text, enabled, context = 'default', voice = 'verse', speed, stream = false }) {
  if (!enabled) {
    emitTTSState({ status: 'idle', reason: 'disabled', message: null });
    return;
  }
  if (!text || !text.trim()) {
    emitTTSState({ status: 'idle', reason: 'no-text', message: null });
    return;
  }
  if (typeof window === 'undefined' || typeof Audio === 'undefined') {
    emitTTSState({ status: 'error', error: 'Audio playback not supported in this environment.' });
    return;
  }

  const narrationContext = context || 'default';
  const normalizedText = normalizeReadingText(text);
  const ttsText = prepareForTTS(normalizedText);

  const requestId = ++currentNarrationRequestId;
  activeNarrationId = requestId;

  try {
    // Stop any currently playing TTS
    if (ttsAudio) {
      ttsAudio.pause();
      emitTTSState({ status: 'stopped', reason: 'replaced' });
      ttsAudio = null;
    }

    // Check cache first (using normalized text for consistent keys)
    // Include speed in cache key to cache different speeds separately
    const cacheKey = generateCacheKey(ttsText, context, voice, speed);
    const cachedAudio = getCachedAudio(cacheKey);

    let audioDataUri;
    let provider = cachedAudio?.provider || null;
    let source = cachedAudio ? 'cache' : 'network';

    emitTTSState({
      status: 'loading',
      provider,
      source,
      cached: !!cachedAudio,
      error: null,
      message: cachedAudio ? 'Loading narration from cache.' : 'Preparing narration...',
      context: narrationContext
    });

    if (cachedAudio && !stream) {
      // Use cached audio (streaming responses are not cached)
      audioDataUri = cachedAudio.audio;
    } else {
      // Fetch from API with normalized TTS text
      const url = stream ? '/api/tts?stream=true' : '/api/tts';
      const requestBody = { text: ttsText, context, voice };

      // Add speed parameter if specified
      if (speed !== undefined) {
        requestBody.speed = speed;
      }

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        console.error('TTS error:', response.status);
        emitTTSState({
          status: 'error',
          provider,
          source,
          error: `TTS service returned ${response.status}.`,
          context: narrationContext,
          message: response.status === 429
            ? 'Too many requests. Please wait a moment before trying again.'
            : 'Unable to generate audio right now.'
        });
        return;
      }

      if (stream) {
        // Streaming mode: response body is a ReadableStream of audio chunks
        // Convert stream to blob for audio playback
        const audioBlob = await response.blob();
        audioDataUri = URL.createObjectURL(audioBlob);
        provider = 'azure-gpt-4o-mini-tts'; // Streaming only works with Azure
        source = 'stream';
      } else {
        // Non-streaming mode: response is JSON with base64 data URI
        const data = await response.json();
        if (!data?.audio) {
          console.error('No audio field in TTS response');
          emitTTSState({
            status: 'error',
            provider: data?.provider || null,
            source,
            error: 'No audio field in response.',
            context: narrationContext,
            message: 'Unable to prepare audio for this reading.'
          });
          return;
        }

        audioDataUri = data.audio;
        provider = data?.provider || null;

        // Cache the audio for future use, but never cache fallback provider
        if (provider && provider !== 'fallback') {
          cacheAudio(cacheKey, audioDataUri, provider);
        }
      }

      emitTTSState({
        status: 'loading',
        provider,
        source: stream ? 'stream' : source,
        cached: false,
        error: null,
        context: narrationContext,
        message: getPreparingMessage(provider, narrationContext)
      });
    }

    if (requestId <= cancelledUpToRequestId) {
      emitTTSState({
        status: 'stopped',
        reason: 'user',
        context: narrationContext,
        message: 'Narration stopped.'
      });
      activeNarrationId = null;
      return;
    }

    // Ensure audio is unlocked before attempting playback
    if (!audioUnlocked) {
      const unlocked = await unlockAudio();
      if (!unlocked) {
        emitTTSState({
          status: 'error',
          provider,
          source,
          context: narrationContext,
          error: 'Audio not unlocked',
          message: 'Tap anywhere on the page to enable audio, then try again.'
        });
        activeNarrationId = null;
        return;
      }
    }

    // Play the audio
    const audio = new Audio(audioDataUri);
    ttsAudio = audio;
    wireTTSEvents(audio, provider, source, requestId, narrationContext);

    try {
      await audio.play();
      emitTTSState({
        status: 'playing',
        provider,
        source,
        context: narrationContext,
        message: getPlayMessage(provider, narrationContext)
      });
    } catch (err) {
      console.error('Error playing TTS audio:', err);
      const isAutoplayError = err.name === 'NotAllowedError' ||
                             err.message?.toLowerCase().includes('autoplay') ||
                             err.message?.toLowerCase().includes('user interaction');

      emitTTSState({
        status: 'error',
        provider,
        source,
        context: narrationContext,
        error: err?.message || String(err),
        message: isAutoplayError
          ? 'Tap anywhere on the page to enable audio, then try again.'
          : 'Unable to play audio. Please try again.'
      });
      activeNarrationId = null;
    }
  } catch (err) {
    console.error('Error playing TTS audio:', err);
    const fallbackPlayed = await tryPlayLocalFallback({
      requestId,
      context: narrationContext,
      fallbackText: normalizedText || text
    });

    if (fallbackPlayed) {
      return;
    }

    emitTTSState({
      status: 'error',
      context: narrationContext,
      error: err?.message || String(err),
      message: 'Unable to play audio right now.'
    });
    activeNarrationId = null;
  }
}

async function tryPlayLocalFallback({ requestId, context, fallbackText }) {
  try {
    const safeText = fallbackText && fallbackText.length
      ? fallbackText
      : 'The cards rest quietly; here is a gentle chime instead.';
    const audioDataUri = generateFallbackWaveform(safeText);

    emitTTSState({
      status: 'loading',
      provider: 'fallback',
      source: 'local',
      cached: false,
      error: null,
      context,
      message: getPreparingMessage('fallback', context)
    });

    if (requestId <= cancelledUpToRequestId) {
      emitTTSState({
        status: 'stopped',
        reason: 'user',
        context,
        message: 'Narration stopped.'
      });
      activeNarrationId = null;
      return true;
    }

    if (!audioUnlocked) {
      const unlocked = await unlockAudio();
      if (!unlocked) {
        emitTTSState({
          status: 'error',
          provider: 'fallback',
          source: 'local',
          context,
          error: 'Audio not unlocked',
          message: 'Tap anywhere on the page to enable audio, then try again.'
        });
        activeNarrationId = null;
        return true;
      }
    }

    const fallbackAudio = new Audio(audioDataUri);
    ttsAudio = fallbackAudio;
    wireTTSEvents(fallbackAudio, 'fallback', 'local', requestId, context);
    await fallbackAudio.play();

    emitTTSState({
      status: 'playing',
      provider: 'fallback',
      source: 'local',
      context,
      message: getPlayMessage('fallback', context)
    });

    return true;
  } catch (fallbackErr) {
    console.error('Local fallback audio failed:', fallbackErr);
    return false;
  }
}

/**
 * Generate a cache key from text, context, voice, and speed.
 * Uses simple hash to keep localStorage keys reasonable.
 */
function generateCacheKey(text, context, voice, speed) {
  const speedKey = speed !== undefined ? speed : 'default';
  const content = `${text}|${context}|${voice}|${speedKey}`;
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

    return data;
  } catch (err) {
    console.warn('Error reading TTS cache:', err);
    return null;
  }
}

/**
 * Cache audio data URI in localStorage.
 * Implements size limit and eviction strategy.
 */
function cacheAudio(key, audioDataUri, provider = null) {
  try {
    if (typeof localStorage === 'undefined') return;

    const data = {
      audio: audioDataUri,
      timestamp: Date.now(),
      provider
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

/**
 * Stop any currently playing TTS audio.
 * This is called when the user toggles voice off in SettingsToggles.
 */
export function stopTTS() {
  try {
    const targetId = activeNarrationId ?? currentNarrationRequestId;
    if (targetId) {
      cancelledUpToRequestId = Math.max(cancelledUpToRequestId, targetId);
    }
    activeNarrationId = null;

    if (ttsAudio) {
      ttsAudio.pause();
      ttsAudio.currentTime = 0;
      ttsAudio = null;
      emitTTSState({
        status: 'stopped',
        reason: 'user',
        message: 'Narration stopped.'
      });
    } else {
      emitTTSState({
        status: 'stopped',
        reason: 'user',
        message: 'Narration stopped.'
      });
    }
  } catch {
    // ignore errors
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

  emitTTSState({
    status: 'idle',
    provider: null,
    source: null,
    cached: false,
    error: null,
    message: null,
    context: null
  });
}

export function pauseTTS() {
  if (!ttsAudio) return;
  try {
    if (!ttsAudio.paused) {
      ttsAudio.pause();
      emitTTSState({
        status: 'paused',
        reason: 'user',
        message: currentTTSState.provider === 'fallback'
          ? 'Fallback chime paused.'
          : 'Narration paused.'
      });
    }
  } catch {
    // ignore pause errors
  }
}

export async function resumeTTS() {
  if (!ttsAudio) return;
  try {
    await ttsAudio.play();
    emitTTSState({
      status: 'playing',
      reason: 'resume',
      message: currentTTSState.provider === 'fallback'
        ? 'Resuming fallback chime.'
        : 'Resuming narration.'
    });
  } catch (err) {
    emitTTSState({
      status: 'error',
      error: err?.message || String(err),
      message: 'Unable to resume audio. Tap the page, then try again.'
    });
  }
}

export function subscribeToTTS(listener) {
  if (typeof listener !== 'function') return () => {};
  ttsListeners.add(listener);
  listener(currentTTSState);
  return () => {
    ttsListeners.delete(listener);
  };
}

export function getCurrentTTSState() {
  return currentTTSState;
}

function emitTTSState(update) {
  const nextStatus = update.status ?? currentTTSState.status;
  const isResetState = nextStatus === 'loading' || nextStatus === 'idle';

  currentTTSState = {
    status: nextStatus,
    provider: update.provider ?? (isResetState ? null : currentTTSState.provider) ?? null,
    source: update.source ?? (isResetState ? null : currentTTSState.source) ?? null,
    cached: update.cached ?? (isResetState ? false : currentTTSState.cached) ?? false,
    error: nextStatus === 'error'
      ? (update.error ?? currentTTSState.error ?? null)
      : null,
    message: update.message ??
      (nextStatus === 'error'
        ? (currentTTSState.message ?? null)
        : (isResetState ? null : currentTTSState.message ?? null)),
    reason: update.reason ?? (isResetState ? null : currentTTSState.reason) ?? null,
    context: update.context ?? (isResetState ? null : currentTTSState.context) ?? null
  };

  for (const listener of ttsListeners) {
    try {
      listener(currentTTSState);
    } catch (err) {
      console.warn('TTS listener error:', err);
    }
  }
}

function wireTTSEvents(audio, provider, source, requestId, context) {
  audio.addEventListener('ended', () => {
    emitTTSState({
      status: 'completed',
      provider,
      source,
      context,
      message: getEndedMessage(provider, context)
    });
    if (ttsAudio === audio) {
      ttsAudio = null;
    }
    if (activeNarrationId === requestId) {
      activeNarrationId = null;
    }
  });

  audio.addEventListener('pause', () => {
    if (!audio.ended) {
      emitTTSState({
        status: 'paused',
        provider,
        source,
        context,
        message: getPauseMessage(provider, context)
      });
    }
  });

  audio.addEventListener('error', () => {
    emitTTSState({
      status: 'error',
      provider,
      source,
      context,
      error: 'Audio playback error.',
      message: 'Something went wrong while playing audio.'
    });
    if (activeNarrationId === requestId) {
      activeNarrationId = null;
    }
  });
}

function getPlayMessage(provider, context) {
  if (provider === 'fallback') {
    return 'Voice service unavailable; playing a gentle chime instead of narration.';
  }
  if (context === 'card-reveal') {
    return 'Speaking this card reveal.';
  }
  if (context === 'full-reading') {
    return 'Playing your personal reading narration.';
  }
  return 'Playing narration.';
}

function getPreparingMessage(provider, context) {
  if (provider === 'fallback') {
    return 'Preparing fallback chime.';
  }
  if (context === 'card-reveal') {
    return 'Preparing card reveal narration.';
  }
  if (context === 'full-reading') {
    return 'Preparing personal reading narration.';
  }
  return 'Preparing narration...';
}

function getEndedMessage(provider, context) {
  if (provider === 'fallback') {
    return 'Fallback chime finished.';
  }
  if (context === 'card-reveal') {
    return 'Card narration finished.';
  }
  if (context === 'full-reading') {
    return 'Personal reading narration finished.';
  }
  return 'Narration finished.';
}

function getPauseMessage(provider, context) {
  if (provider === 'fallback') {
    return 'Fallback chime paused.';
  }
  if (context === 'card-reveal') {
    return 'Card narration paused.';
  }
  if (context === 'full-reading') {
    return 'Personal reading narration paused.';
  }
  return 'Narration paused.';
}
