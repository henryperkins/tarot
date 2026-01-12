/**
 * Azure Cognitive Services Speech SDK Provider
 *
 * Provides client-side TTS with real-time word boundaries for text highlighting.
 * Uses secure token-based authentication (tokens issued by server).
 *
 * Key benefits over REST API:
 * - Real-time word boundary events (text highlighting)
 * - Viseme data for avatar/lip-sync
 * - Direct browser → Azure (no server round-trip after token fetch)
 * - Full SSML style control with express-as
 *
 * Based on official Microsoft documentation patterns:
 * https://learn.microsoft.com/en-us/javascript/api/microsoft-cognitiveservices-speech-sdk/
 */

// ============================================================================
// SDK STATE
// ============================================================================

let sdk = null;
let speechConfig = null;
let activeSynthesizer = null;
let tokenRefreshTimer = null;
let currentVoice = 'en-US-AriaNeural';

// ============================================================================
// VOICE MAPPING
// Maps existing voice names to Azure Neural TTS voices
// ============================================================================

const VOICE_MAP = {
  // Map gpt-4o-mini-tts voices to closest Azure Neural equivalents
  verse: 'en-US-AriaNeural', // Expressive, warm (default)
  nova: 'en-US-JennyNeural', // Clear, friendly
  shimmer: 'en-US-SaraNeural', // Soft, gentle
  alloy: 'en-US-GuyNeural', // Calm, neutral
  echo: 'en-US-DavisNeural', // Deep, resonant
  fable: 'en-GB-SoniaNeural', // British, storytelling
  onyx: 'en-US-TonyNeural', // Warm, mature
  coral: 'en-US-JaneNeural', // Conversational
  sage: 'en-US-NancyNeural', // Wise, measured
  ash: 'en-US-JasonNeural', // Thoughtful
  ballad: 'en-US-MichelleNeural', // Emotive
  // Direct Azure voice names also work
  default: 'en-US-AriaNeural'
};

// ============================================================================
// STYLE MAPPING (matches INSTRUCTION_TEMPLATES in tts.js)
// ============================================================================

const STYLE_MAP = {
  'card-reveal': {
    style: 'gentle',
    rate: '0.9',
    pitch: '-2%',
    styledegree: '1.3'
  },
  'full-reading': {
    style: 'empathetic',
    rate: '0.85',
    pitch: '-3%',
    styledegree: '1.5'
  },
  synthesis: {
    style: 'hopeful',
    rate: '0.9',
    pitch: '0%',
    styledegree: '1.2'
  },
  question: {
    style: 'friendly',
    rate: '1.0',
    pitch: '0%',
    styledegree: '1.0'
  },
  reflection: {
    style: 'calm',
    rate: '0.85',
    pitch: '-2%',
    styledegree: '1.2'
  },
  default: {
    style: 'general',
    rate: '0.95',
    pitch: '0%',
    styledegree: '1.0'
  }
};

// Voices that support mstts:express-as styles
const STYLE_ENABLED_VOICES = new Set([
  'en-US-AriaNeural',
  'en-US-JennyNeural',
  'en-US-GuyNeural',
  'en-US-SaraNeural',
  'en-US-DavisNeural',
  'en-US-JaneNeural',
  'en-US-NancyNeural',
  'en-US-TonyNeural',
  'en-US-JasonNeural',
  'en-US-MichelleNeural'
]);

// ============================================================================
// INITIALIZATION
// ============================================================================

/**
 * Lazy load Speech SDK to avoid bundle bloat.
 * Only loaded when actually needed.
 * @returns {Promise<Object|null>} SDK module or null if failed
 */
async function loadSDK() {
  if (sdk) return sdk;

  try {
    sdk = await import('microsoft-cognitiveservices-speech-sdk');
    return sdk;
  } catch (err) {
    console.error('[SpeechSDK] Failed to load:', err);
    return null;
  }
}

/**
 * Fetch authorization token from server (secure approach).
 * Tokens are valid for 10 minutes; server returns 9-minute expiry.
 * @returns {Promise<{token: string, region: string, expiresIn: number}>}
 */
async function fetchAuthToken() {
  const response = await fetch('/api/speech-token');
  if (!response.ok) {
    throw new Error(`Token fetch failed: ${response.status}`);
  }
  return response.json();
}

/**
 * Initialize Speech SDK with secure token authentication.
 *
 * @param {Object} options
 * @param {string} [options.voice='verse'] - Default voice name
 * @param {boolean} [options.enableSentenceBoundary=true] - Enable sentence-level word boundaries
 * @returns {Promise<boolean>} Success status
 */
export async function initSpeechSDK(options = {}) {
  if (typeof window === 'undefined') {
    console.warn('[SpeechSDK] Not available in non-browser environment');
    return false;
  }

  const { voice = 'verse', enableSentenceBoundary = true } = options;

  try {
    const loadedSdk = await loadSDK();
    if (!loadedSdk) return false;

    const { token, region, expiresIn } = await fetchAuthToken();

    // Cleanup existing resources
    await cleanup();

    // Create config from authorization token (secure!)
    speechConfig = loadedSdk.SpeechConfig.fromAuthorizationToken(token, region);

    // Set default voice
    currentVoice = VOICE_MAP[voice] || VOICE_MAP.default;
    speechConfig.speechSynthesisVoiceName = currentVoice;

    // Use MP3 for broad browser compatibility
    speechConfig.speechSynthesisOutputFormat =
      loadedSdk.SpeechSynthesisOutputFormat.Audio24Khz48KBitRateMonoMp3;

    // Enable sentence-level word boundaries (per official docs)
    if (enableSentenceBoundary) {
      speechConfig.setProperty(
        loadedSdk.PropertyId.SpeechServiceResponse_RequestSentenceBoundary,
        'true'
      );
    }

    // Schedule token refresh before expiry (tokens last 10 min, refresh at ~9)
    scheduleTokenRefresh((expiresIn - 60) * 1000);

    console.log('[SpeechSDK] Initialized with voice:', currentVoice);
    return true;
  } catch (err) {
    console.error('[SpeechSDK] Initialization failed:', err);
    return false;
  }
}

/**
 * Schedule automatic token refresh before expiry.
 * @param {number} delayMs - Delay in milliseconds before refresh
 */
function scheduleTokenRefresh(delayMs) {
  if (tokenRefreshTimer) {
    clearTimeout(tokenRefreshTimer);
  }

  tokenRefreshTimer = setTimeout(async () => {
    try {
      const { token } = await fetchAuthToken();
      if (speechConfig) {
        speechConfig.authorizationToken = token;
        console.log('[SpeechSDK] Token refreshed');
      }
      // Schedule next refresh
      scheduleTokenRefresh(9 * 60 * 1000); // 9 minutes
    } catch (err) {
      console.warn('[SpeechSDK] Token refresh failed:', err);
    }
  }, delayMs);
}

/**
 * Check if Speech SDK is initialized and ready.
 * @returns {boolean}
 */
export function isSpeechSDKReady() {
  return !!(speechConfig && sdk);
}

// ============================================================================
// SSML BUILDING
// ============================================================================

/**
 * Build SSML with style and prosody for context-aware speech.
 * Follows official Microsoft SSML documentation patterns.
 *
 * @param {string} text - Plain text to speak
 * @param {Object} options
 * @param {string} options.voice - Voice name key
 * @param {string} options.context - Speaking context
 * @param {number} [options.speed] - Speed multiplier
 * @param {boolean} [options.enableViseme=false] - Enable lip-sync viseme data
 * @returns {string} Complete SSML document
 */
function buildSSML(text, { voice, context, speed, enableViseme = false }) {
  const voiceName = VOICE_MAP[voice] || VOICE_MAP.default;
  const styleConfig = STYLE_MAP[context] || STYLE_MAP.default;
  const supportsStyle = STYLE_ENABLED_VOICES.has(voiceName);

  // Calculate rate with speed multiplier
  let rate = styleConfig.rate;
  if (speed !== undefined) {
    const baseRate = parseFloat(styleConfig.rate);
    const adjustedRate = baseRate * speed;
    rate = Math.max(0.5, Math.min(2.0, adjustedRate)).toFixed(2);
  }

  // Escape XML entities
  const escapedText = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

  // Build SSML following official Microsoft structure
  let ssml = `<speak version='1.0' xml:lang='en-US' xmlns='http://www.w3.org/2001/10/synthesis' xmlns:mstts='http://www.w3.org/2001/mstts'>
  <voice name='${voiceName}'>`;

  // Add viseme request if needed (per official docs)
  if (enableViseme) {
    ssml += `
    <mstts:viseme type='redlips_front'/>`;
  }

  // Add style wrapper if supported and not 'general'
  if (supportsStyle && styleConfig.style !== 'general') {
    ssml += `
    <mstts:express-as style='${styleConfig.style}' styledegree='${styleConfig.styledegree}'>
      <prosody rate='${rate}' pitch='${styleConfig.pitch}'>
        ${escapedText}
      </prosody>
    </mstts:express-as>`;
  } else {
    ssml += `
    <prosody rate='${rate}' pitch='${styleConfig.pitch}'>
      ${escapedText}
    </prosody>`;
  }

  ssml += `
  </voice>
</speak>`;

  return ssml;
}

// ============================================================================
// SYNTHESIS
// ============================================================================

/**
 * Synthesize speech with word boundary events for text highlighting.
 *
 * Per official docs, audio offset is in 100-nanosecond units.
 * Convert to milliseconds: (audioOffset + 5000) / 10000
 *
 * @param {string} text - Text to synthesize
 * @param {Object} options
 * @param {string} [options.voice='verse'] - Voice selection
 * @param {string} [options.context='default'] - Speaking context
 * @param {number} [options.speed] - Speed multiplier (0.5-2.0)
 * @param {boolean} [options.enableViseme=false] - Enable lip-sync viseme data
 * @param {Function} [options.onWordBoundary] - Called for each word/punctuation/sentence
 * @param {Function} [options.onViseme] - Called for lip-sync data (viseme IDs 0-21)
 * @param {Function} [options.onBookmark] - Called when SSML bookmark is reached
 * @param {Function} [options.onStart] - Called when synthesis starts
 * @param {Function} [options.onProgress] - Called with audio chunks during synthesis
 * @param {Function} [options.onComplete] - Called when synthesis completes
 * @param {Function} [options.onError] - Called on error or cancellation
 * @returns {Promise<{audioUrl: string, audioData: ArrayBuffer, durationMs: number}>}
 */
export async function synthesizeWithSDK(text, options = {}) {
  if (!isSpeechSDKReady()) {
    throw new Error('Speech SDK not initialized. Call initSpeechSDK() first.');
  }

  const {
    voice = 'verse',
    context = 'default',
    speed,
    enableViseme = false,
    onWordBoundary,
    onViseme,
    onBookmark,
    onStart,
    onProgress,
    onComplete,
    onError
  } = options;

  // Cancel any active synthesis
  if (activeSynthesizer) {
    await closeSynthesizer(activeSynthesizer);
    activeSynthesizer = null;
  }

  // Build SSML with styling
  const ssml = buildSSML(text, { voice, context, speed, enableViseme });

  return new Promise((resolve, reject) => {
    const synthesizer = new sdk.SpeechSynthesizer(speechConfig, null);
    activeSynthesizer = synthesizer;

    // Synthesis started
    synthesizer.synthesisStarted = function () {
      onStart?.();
    };

    // Word boundary - for text highlighting
    synthesizer.wordBoundary = function (_s, e) {
      const audioOffsetMs = (e.audioOffset + 5000) / 10000;

      onWordBoundary?.({
        text: e.text,
        textOffset: e.textOffset,
        wordLength: e.wordLength,
        audioOffsetMs,
        duration: e.duration,
        boundaryType: mapBoundaryType(e.boundaryType)
      });
    };

    // Viseme received - for avatar lip-sync animation
    synthesizer.visemeReceived = function (_s, e) {
      const audioOffsetMs = (e.audioOffset + 5000) / 10000;

      onViseme?.({
        visemeId: e.visemeId,
        audioOffsetMs
      });
    };

    // Bookmark reached - for SSML markers
    synthesizer.bookmarkReached = function (_s, e) {
      const audioOffsetMs = (e.audioOffset + 5000) / 10000;

      onBookmark?.({
        text: e.text,
        audioOffsetMs
      });
    };

    // Synthesizing - audio chunks during synthesis
    synthesizer.synthesizing = function (_s, e) {
      onProgress?.({
        audioData: e.result.audioData,
        bytesReceived: e.result.audioData?.byteLength || 0
      });
    };

    // Synthesis completed
    synthesizer.synthesisCompleted = function (_s, e) {
      onComplete?.({
        audioData: e.result.audioData,
        audioDuration: e.result.audioDuration
      });
    };

    // Synthesis canceled - handle errors
    synthesizer.synthesisCanceled = function (_s, e) {
      const cancellation = sdk.CancellationDetails.fromResult(e.result);
      onError?.({
        reason: mapCancellationReason(cancellation.reason),
        errorCode: cancellation.errorCode,
        errorDetails: cancellation.errorDetails
      });
    };

    // Perform synthesis with SSML
    synthesizer.speakSsmlAsync(
      ssml,
      function (result) {
        activeSynthesizer = null;

        if (result.reason === sdk.ResultReason.SynthesizingAudioCompleted) {
          const blob = new Blob([result.audioData], { type: 'audio/mp3' });
          const audioUrl = URL.createObjectURL(blob);

          resolve({
            audioUrl,
            audioData: result.audioData,
            durationMs: (result.audioDuration + 5000) / 10000,
            resultId: result.resultId
          });
        } else if (result.reason === sdk.ResultReason.Canceled) {
          const cancellation = sdk.CancellationDetails.fromResult(result);

          if (cancellation.reason === sdk.CancellationReason.Error) {
            reject(new Error(
              `CANCELED: ErrorCode=${cancellation.errorCode}, ErrorDetails=[${cancellation.errorDetails}]`
            ));
          } else {
            reject(new Error(`CANCELED: Reason=${cancellation.reason}`));
          }
        } else {
          reject(new Error(`Synthesis failed with reason: ${result.reason}`));
        }

        closeSynthesizer(synthesizer);
      },
      function (err) {
        activeSynthesizer = null;
        closeSynthesizer(synthesizer);
        reject(new Error(`Synthesis error: ${err}`));
      }
    );
  });
}

/**
 * Map SDK boundary type enum to string.
 * @param {number} type - SDK boundary type enum value
 * @returns {string} 'word' | 'punctuation' | 'sentence' | 'unknown'
 */
function mapBoundaryType(type) {
  if (!sdk) return 'unknown';
  switch (type) {
    case sdk.SpeechSynthesisBoundaryType.Word:
      return 'word';
    case sdk.SpeechSynthesisBoundaryType.Punctuation:
      return 'punctuation';
    case sdk.SpeechSynthesisBoundaryType.Sentence:
      return 'sentence';
    default:
      return 'unknown';
  }
}

/**
 * Map SDK cancellation reason enum to string.
 * @param {number} reason - SDK cancellation reason enum value
 * @returns {string}
 */
function mapCancellationReason(reason) {
  if (!sdk) return 'unknown';
  switch (reason) {
    case sdk.CancellationReason.Error:
      return 'error';
    case sdk.CancellationReason.EndOfStream:
      return 'end-of-stream';
    case sdk.CancellationReason.CancelledByUser:
      return 'user-cancelled';
    default:
      return 'unknown';
  }
}

// ============================================================================
// CLEANUP
// ============================================================================

/**
 * Close a synthesizer instance safely.
 * @param {Object} synthesizer - SpeechSynthesizer instance
 * @returns {Promise<void>}
 */
async function closeSynthesizer(synthesizer) {
  if (!synthesizer) return;

  return new Promise(resolve => {
    try {
      synthesizer.close();
    } catch {
      // swallow close errors
    } finally {
      resolve();
    }
  });
}

/**
 * Cleanup all Speech SDK resources.
 * Call this when unmounting or switching providers.
 */
export async function cleanup() {
  if (tokenRefreshTimer) {
    clearTimeout(tokenRefreshTimer);
    tokenRefreshTimer = null;
  }

  if (activeSynthesizer) {
    await closeSynthesizer(activeSynthesizer);
    activeSynthesizer = null;
  }

  if (speechConfig) {
    try {
      speechConfig.close();
    } catch {
      // ignore
    }
    speechConfig = null;
  }

  currentVoice = 'en-US-AriaNeural';
}

// Export cleanup with an alias for compatibility
export { cleanup as closeSpeechSDK };
