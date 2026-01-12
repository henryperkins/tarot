/**
 * Hume AI Octave TTS Integration for Tarot Readings
 *
 * This module provides client-side utilities for generating expressive,
 * emotionally-aware speech using Hume AI's Octave TTS service.
 *
 * Features:
 * - Context-aware voice selection (card reveals, full readings, synthesis)
 * - Voice continuity across multiple utterances via generation IDs
 * - GraphRAG emotion-based acting instructions
 * - Automatic retry and error handling
 * - Audio caching for common phrases
 *
 * API Documentation: https://dev.hume.ai/reference/text-to-speech-tts
 */

import { getActingInstructions } from '../data/emotionMapping.js';
import { audioCache } from './audioCache.js';

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
 * @param {string} options.emotion - GraphRAG-derived emotion for acting instructions
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
    emotion,
    speed,
    continuePrevious = false,
    trailingSilence
  } = options;

  try {
    // Check cache first for short phrases
    const cachedAudio = audioCache.get(text, emotion);
    if (cachedAudio) {
      const audio = new Audio(cachedAudio);

      // Stop any currently playing audio
      if (currentAudio) {
        currentAudio.pause();
        currentAudio.currentTime = 0;
      }

      currentAudio = audio;

      return {
        audio,
        generationId: null,
        voiceUsed: voiceName || 'ITO',
        cached: true,
        play: () => audio.play(),
        pause: () => audio.pause(),
        stop: () => {
          audio.pause();
          audio.currentTime = 0;
        }
      };
    }

    // Build request payload
    const payload = {
      text,
      context
    };

    if (voiceName) payload.voiceName = voiceName;

    // Priority: custom description > emotion-based > none (let backend use context)
    if (description) {
      payload.description = description;
    } else if (emotion) {
      payload.description = getActingInstructions(emotion);
      payload.emotion = emotion; // Also send emotion key for backend logging
    }

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
      const responseText = await response.text();
      let errorMsg = 'TTS request failed';
      try {
        const errorData = JSON.parse(responseText);
        errorMsg = errorData.error ?? errorMsg;
      } catch {
        // Keep default if response is not JSON
      }
      throw new Error(errorMsg);
    }

    const result = await response.json();

    // Store generation ID for potential continuation
    if (result.generationId) {
      lastGenerationId = result.generationId;
    }

    // Cache the result for short phrases
    if (result.audio && audioCache.isCacheable(text)) {
      audioCache.set(text, emotion, result.audio);
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
      cached: false,
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
 * Reset the generation ID (useful when starting a new reading)
 */
export function resetGenerationId() {
  lastGenerationId = null;
}
