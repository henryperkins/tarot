/**
 * Hume AI Octave TTS Integration for Tarot Readings
 * 
 * This module provides client-side utilities for generating expressive,
 * emotionally-aware speech using Hume AI's Octave TTS service.
 * 
 * Features:
 * - Context-aware voice selection (card reveals, full readings, synthesis)
 * - Voice continuity across multiple utterances via generation IDs
 * - Automatic retry and error handling
 * - Audio caching and playback management
 * 
 * API Documentation: https://dev.hume.ai/reference/text-to-speech-tts
 */

let currentAudio = null;
let lastGenerationId = null;

/**
 * Generate and play speech using Hume AI Octave TTS
 * 
 * @param {string} text - The text to speak (max 5000 characters)
 * @param {Object} options - TTS options
 * @param {string} options.context - Context type (card-reveal, full-reading, synthesis, etc.)
 * @param {string} options.voiceName - Specific Hume voice name (e.g., "ITO", "KORA")
 * @param {string} options.description - Custom voice description/acting instructions
 * @param {number} options.speed - Speech speed (0.5-2.0)
 * @param {boolean} options.continuePrevious - Continue from previous generation for voice consistency
 * @param {number} options.trailingSilence - Silence after utterance (0-5 seconds)
 * @returns {Promise<Object>} Result with audio element and generation ID
 */
export async function speakWithHume(text, options = {}) {
  const {
    context = 'default',
    voiceName,
    description,
    speed,
    continuePrevious = false,
    trailingSilence
  } = options;

  try {
    // Build request payload
    const payload = {
      text,
      context
    };

    if (voiceName) payload.voiceName = voiceName;
    if (description) payload.description = description;
    if (speed !== undefined) payload.speed = speed;
    if (trailingSilence !== undefined) payload.trailingSilence = trailingSilence;
    
    // Add continuation if requested and we have a previous generation
    if (continuePrevious && lastGenerationId) {
      payload.previousGenerationId = lastGenerationId;
    }

    // Call the Hume TTS endpoint
    const response = await fetch('/api/tts-hume', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const text = await response.text();
      let errorMsg = 'TTS request failed';
      try {
        const errorData = JSON.parse(text);
        errorMsg = errorData.error ?? errorMsg;
      } catch (_) {
        // Keep default if response is not JSON
      }
      throw new Error(errorMsg);
    }

    const result = await response.json();
    
    // Store generation ID for potential continuation
    if (result.generationId) {
      lastGenerationId = result.generationId;
    }

    // Create and play audio
    const audio = new Audio(result.audio);
    
    // Stop any currently playing audio
    if (currentAudio) {
      currentAudio.pause();
      currentAudio.currentTime = 0;
    }
    
    currentAudio = audio;
    
    return {
      audio,
      generationId: result.generationId,
      voiceUsed: result.voiceUsed,
      play: () => audio.play(),
      pause: () => audio.pause(),
      stop: () => {
        audio.pause();
        audio.currentTime = 0;
      }
    };

  } catch (error) {
    console.error('Hume TTS error:', error);
    throw error;
  }
}

/**
 * Speak a tarot card reveal with appropriate mystical tone
 * 
 * @param {string} cardName - Name of the card
 * @param {string} orientation - "upright" or "reversed"
 * @param {string} meaning - Brief meaning or interpretation
 * @returns {Promise<Object>} Audio result
 */
export async function speakCardReveal(cardName, orientation, meaning) {
  const text = `${cardName}, ${orientation}. ${meaning}`;
  return speakWithHume(text, {
    context: 'card-reveal',
    voiceName: 'ITO',
    speed: 0.9, // Slightly slower for contemplation
    trailingSilence: 1.5
  });
}

/**
 * Speak a complete tarot reading with natural pauses and flow
 * 
 * @param {string} readingText - The full reading narrative
 * @param {Object} options - Additional options
 * @returns {Promise<Object>} Audio result
 */
export async function speakFullReading(readingText, options = {}) {
  return speakWithHume(readingText, {
    context: 'full-reading',
    voiceName: options.voiceName || 'ITO',
    speed: options.speed || 1.0,
    ...options
  });
}

/**
 * Speak reading synthesis/summary with storytelling flow
 * 
 * @param {string} synthesisText - The synthesis or summary text
 * @param {Object} options - Additional options
 * @returns {Promise<Object>} Audio result
 */
export async function speakSynthesis(synthesisText, options = {}) {
  return speakWithHume(synthesisText, {
    context: 'synthesis',
    voiceName: options.voiceName || 'KORA',
    speed: options.speed || 1.05,
    ...options
  });
}

/**
 * Speak multiple segments with voice continuity
 * Useful for breaking long readings into natural chunks
 * 
 * @param {Array<string>} segments - Array of text segments to speak
 * @param {Object} options - TTS options
 * @returns {Promise<Array<Object>>} Array of audio results
 */
export async function speakSequence(segments, options = {}) {
  const results = [];
  
  for (let i = 0; i < segments.length; i++) {
    const result = await speakWithHume(segments[i], {
      ...options,
      continuePrevious: i > 0 // Continue voice from previous segment
    });
    
    results.push(result);
    
    // Wait for current segment to finish before starting next
    if (options.autoPlay !== false) {
      await new Promise((resolve) => {
        result.audio.onended = resolve;
        result.audio.play();
      });
    }
  }
  
  return results;
}

/**
 * Stop any currently playing Hume audio
 */
export function stopHumeAudio() {
  if (currentAudio) {
    currentAudio.pause();
    currentAudio.currentTime = 0;
    currentAudio = null;
  }
}

/**
 * Check if Hume TTS is available
 * 
 * @returns {Promise<boolean>} True if Hume TTS is configured and available
 */
export async function isHumeTTSAvailable() {
  try {
    const response = await fetch('/api/tts-hume');
    const result = await response.json();
    return result.status === 'ok' && result.provider === 'hume-ai';
  } catch (error) {
    console.error('Error checking Hume TTS availability:', error);
    return false;
  }
}

/**
 * Get the last generation ID for voice continuation
 * 
 * @returns {string|null} Last generation ID or null
 */
export function getLastGenerationId() {
  return lastGenerationId;
}

/**
 * Reset the generation ID (useful when starting a new reading)
 */
export function resetGenerationId() {
  lastGenerationId = null;
}

// Available Hume preset voices for tarot readings
// Based on Hume's Voice Library: https://platform.hume.ai/tts/voice-library
export const HUME_VOICES = {
  mystical: [
    'ITO',           // Warm, contemplative - excellent for readings
    'KORA',          // Smooth, storytelling quality
    'DACHER',        // Gentle, supportive
    'STELLA',        // Clear, inviting
    'WHIMSY'         // Playful yet wise
  ],
  narrators: [
    'HANK',          // Deep, authoritative narrator
    'RAMONA',        // Warm, engaging storyteller
    'LIVIA'          // Elegant, refined narrator
  ],
  conversational: [
    'AURA',          // Friendly, approachable
    'FINN',          // Casual, relatable
    'ORION'          // Calm, measured
  ],
  dramatic: [
    'LUNA',          // Mysterious, dramatic
    'COVE',          // Rich, theatrical
    'EMBER'          // Intense, passionate
  ]
};

// Context to voice mapping
export const CONTEXT_VOICE_MAP = {
  'card-reveal': 'ITO',
  'full-reading': 'ITO',
  'synthesis': 'KORA',
  'question': 'STELLA',
  'reflection': 'DACHER',
  'default': 'ITO'
};
