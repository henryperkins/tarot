import { useState, useEffect, useCallback, useRef } from 'react';
import { normalizeReadingTextForTtsHighlight } from '../lib/formatting.js';
import {
  speakText,
  pauseTTS,
  resumeTTS,
  stopTTS,
  subscribeToTTS,
  getCurrentTTSState,
  unlockAudio,
  enqueueTTSChunk,
  finalizeTTSStream,
  resetTTSStream,
  isTTSStreamActive,
  swellAmbience
} from '../lib/audio';
import {
  speakWithHume,
  stopHumeAudio,
  resetGenerationId
} from '../lib/audioHume';
import {
  initSpeechSDK,
  isSpeechSDKReady,
  synthesizeWithSDK,
  cleanup as cleanupSpeechSDK
} from '../lib/audioSpeechSDK';
import { usePreferences } from '../contexts/PreferencesContext';

export function useAudioController() {
  const { voiceOn, setVoiceOn, ttsProvider, ttsSpeed, ambienceOn } = usePreferences();
  const [ttsState, setTtsState] = useState(() => getCurrentTTSState());
  const [ttsAnnouncement, setTtsAnnouncement] = useState('');
  const [voicePromptRequested, setVoicePromptRequested] = useState(false);
  const showVoicePrompt = voicePromptRequested && !voiceOn;

  // Track Hume audio state separately
  const humeAudioRef = useRef(null);
  const [humeState, setHumeState] = useState({ status: 'idle', error: null });
  const [humeFallbackActive, setHumeFallbackActive] = useState(false);
  const humeRequestRef = useRef(0);

  // Track Speech SDK state separately
  const sdkAudioRef = useRef(null);
  const sdkObjectUrlRef = useRef(null);
  const [sdkState, setSdkState] = useState({ status: 'idle', error: null });
  const [wordBoundary, setWordBoundary] = useState(null);
  const sdkInitializedRef = useRef(false);
  const sdkRequestRef = useRef(0);

  const releaseSdkAudio = useCallback(() => {
    if (sdkAudioRef.current) {
      try {
        sdkAudioRef.current.pause();
        sdkAudioRef.current.currentTime = 0;
        sdkAudioRef.current.src = '';
      } catch {
        // ignore pause errors
      }
      sdkAudioRef.current = null;
    }
    if (sdkObjectUrlRef.current && typeof URL !== 'undefined') {
      try {
        URL.revokeObjectURL(sdkObjectUrlRef.current);
      } catch {
        // ignore revoke errors
      }
      sdkObjectUrlRef.current = null;
    }
  }, []);

  // Subscribe to TTS state changes
  useEffect(() => {
    const unsubscribe = subscribeToTTS(state => {
      setTtsState(state);

      const isAnnounceContext =
        state.context === 'full-reading' ||
        state.context === 'card-reveal';

      const baseMessage =
        state.message ||
        (state.status === 'completed'
          ? (state.context === 'card-reveal'
            ? 'Card narration finished.'
            : 'Narration finished.')
          : state.status === 'paused'
            ? (state.context === 'card-reveal'
              ? 'Card narration paused.'
              : 'Narration paused.')
            : state.status === 'playing'
              ? (state.context === 'card-reveal'
                ? 'Card narration playing.'
                : 'Narration playing.')
              : state.status === 'loading'
                ? (state.context === 'card-reveal'
                  ? 'Preparing card narration.'
                  : 'Preparing narration.')
                : state.status === 'stopped'
                  ? 'Narration stopped.'
                  : state.status === 'error'
                    ? 'Narration unavailable.'
                    : '');

      const announcement = isAnnounceContext ? baseMessage : '';
      setTtsAnnouncement(announcement);
    });
    return unsubscribe;
  }, []);

  // Initialize Speech SDK when needed
  useEffect(() => {
    let cancelled = false;

    if (ttsProvider === 'azure-sdk' && voiceOn && !sdkInitializedRef.current) {
      initSpeechSDK({ voice: 'verse', enableSentenceBoundary: true })
        .then(success => {
          if (!cancelled && success) {
            sdkInitializedRef.current = true;
            console.log('[AudioController] Speech SDK initialized');
          }
        })
        .catch(err => {
          if (!cancelled) {
            console.warn('[AudioController] Speech SDK init failed:', err);
            setSdkState({ status: 'error', error: err?.message || 'Speech SDK unavailable' });
          }
        });
    }

    return () => {
      cancelled = true;
      if (ttsProvider === 'azure-sdk') {
        releaseSdkAudio();
        setSdkState({ status: 'idle', error: null });
        setWordBoundary(null);
        sdkInitializedRef.current = false;
        void cleanupSpeechSDK();
      }
    };
  }, [ttsProvider, voiceOn, releaseSdkAudio]);

  // Stop TTS when voice is toggled off
  useEffect(() => {
    if (!voiceOn) {
      humeRequestRef.current += 1;
      sdkRequestRef.current += 1;
      stopTTS();
      stopHumeAudio();
      setHumeFallbackActive(false);
      setTimeout(() => {
        setHumeState({ status: 'idle', error: null });
      }, 0);
      releaseSdkAudio();
      setSdkState({ status: 'idle', error: null });
      setWordBoundary(null);
      if (sdkInitializedRef.current) {
        sdkInitializedRef.current = false;
        void cleanupSpeechSDK();
      }
    }
  }, [voiceOn, releaseSdkAudio]);

  useEffect(() => {
    if (ttsProvider !== 'hume') {
      setHumeFallbackActive(false);
    }
  }, [ttsProvider]);

  // Azure TTS speak function with emotion and speed support
  const speakWithAzure = useCallback(async (text, context = 'default', emotion = null) => {
    await speakText({
      text,
      enabled: voiceOn,
      context,
      voice: 'nova', // Default voice for mystical tarot readings
      speed: ttsSpeed,
      emotion
    });
  }, [voiceOn, ttsSpeed]);

  // Hume TTS speak function with emotion support
  const speakWithHumeProvider = useCallback(async (text, context = 'default', emotion = null) => {
    if (!text || !voiceOn) return;
    const requestId = ++humeRequestRef.current;
    const isStaleRequest = () => humeRequestRef.current !== requestId;

    try {
      setHumeFallbackActive(false);
      // Stop any currently playing Hume audio
      if (humeAudioRef.current) {
        humeAudioRef.current.stop();
      }

      setHumeState({ status: 'loading', error: null });
      setTtsAnnouncement('Preparing mystical narration...');

      const result = await speakWithHume(text, {
        context,
        voiceName: 'ITO', // Warm, contemplative voice for readings
        speed: 0.95, // Slightly slower for contemplation
        emotion // GraphRAG-derived emotion for acting instructions
      });

      if (isStaleRequest()) {
        result?.stop?.();
        return;
      }

      humeAudioRef.current = result;
      setHumeState({ status: 'playing', error: null });
      setTtsAnnouncement('Playing your personalized reading...');

      // Play the audio
      await result.play();
      if (isStaleRequest()) {
        result?.stop?.();
        return;
      }

      // Handle audio end
      result.audio.onended = () => {
        if (isStaleRequest()) return;
        setHumeState({ status: 'completed', error: null });
        setTtsAnnouncement('Narration finished.');
        humeAudioRef.current = null;
      };

      // Handle audio errors
      result.audio.onerror = (e) => {
        if (isStaleRequest()) return;
        console.error('Hume audio playback error:', e);
        setHumeState({ status: 'error', error: 'Audio playback failed' });
        setTtsAnnouncement('Narration unavailable.');
        humeAudioRef.current = null;
      };

    } catch (error) {
      if (isStaleRequest()) return;
      console.error('Hume TTS error:', error);
      setHumeState({ status: 'error', error: error.message || 'Failed to generate speech' });
      setTtsAnnouncement('Hume unavailable. Falling back to Azure...');
      setHumeFallbackActive(true);
      await speakWithAzure(text, context, emotion);
    }
  }, [voiceOn, speakWithAzure]);

  const enqueueNarrationChunk = useCallback((text, context = 'full-reading', emotion = null) => {
    if (!voiceOn || !text) return false;
    if (ttsProvider !== 'azure') return false;
    const status = ttsState.status;
    const isBusy = status === 'playing' || status === 'paused' || status === 'loading' || status === 'synthesizing';
    if (isBusy && !isTTSStreamActive()) return false;

    return enqueueTTSChunk({
      text,
      context,
      voice: 'nova',
      speed: ttsSpeed,
      emotion
    });
  }, [voiceOn, ttsProvider, ttsSpeed, ttsState.status]);

  const finalizeNarrationStream = useCallback(() => {
    finalizeTTSStream();
  }, []);

  const resetNarrationStream = useCallback((options = {}) => {
    resetTTSStream(options);
  }, []);

  const isNarrationStreamActive = useCallback(() => isTTSStreamActive(), []);

  const pauseNarrationPlayback = useCallback(() => {
    if (ttsProvider === 'hume' && humeAudioRef.current) {
      try {
        humeAudioRef.current.pause();
      } catch {
        // ignore pause errors
      }
      setHumeState({ status: 'paused', error: null });
      setTtsAnnouncement('Narration paused.');
      return;
    }

    if (ttsProvider === 'azure-sdk' && sdkAudioRef.current) {
      try {
        sdkAudioRef.current.pause();
      } catch {
        // ignore pause errors
      }
      setSdkState({ status: 'paused', error: null });
      setTtsAnnouncement('Narration paused.');
      return;
    }

    pauseTTS();
  }, [ttsProvider]);

  const resumeNarrationPlayback = useCallback(async () => {
    if (ttsProvider === 'hume' && humeAudioRef.current?.audio) {
      try {
        await humeAudioRef.current.audio.play();
        setHumeState({ status: 'playing', error: null });
        setTtsAnnouncement('Resuming narration...');
      } catch {
        // ignore resume errors
      }
      return;
    }

    if (ttsProvider === 'azure-sdk' && sdkAudioRef.current) {
      try {
        await sdkAudioRef.current.play();
        setSdkState({ status: 'playing', error: null });
        setTtsAnnouncement('Resuming narration...');
      } catch {
        // ignore resume errors
      }
      return;
    }

    await resumeTTS();
  }, [ttsProvider]);

  // Azure Speech SDK with word-boundary events
  const speakWithSpeechSDK = useCallback(async (text, context = 'default') => {
    if (!text || !voiceOn) return;
    const requestId = ++sdkRequestRef.current;
    const isStaleRequest = () => sdkRequestRef.current !== requestId;
    const normalizedText = normalizeReadingTextForTtsHighlight(text);

    try {
      if (!isSpeechSDKReady()) {
        const success = await initSpeechSDK({ voice: 'verse', enableSentenceBoundary: true });
        if (!success) {
          throw new Error('Failed to initialize Speech SDK');
        }
        sdkInitializedRef.current = true;
      }

      releaseSdkAudio();
      setSdkState({ status: 'loading', error: null });
      setTtsAnnouncement('Preparing narration with word tracking...');
      setWordBoundary(null);

      const wordTimings = [];

      const result = await synthesizeWithSDK(normalizedText, {
        voice: 'verse',
        context,
        speed: 0.95,
        enableViseme: false,
        onStart: () => {
          if (isStaleRequest()) return;
          setSdkState({ status: 'synthesizing', error: null });
        },
        onWordBoundary: (event) => {
          if (isStaleRequest()) return;
          wordTimings.push(event);
          if (event.boundaryType === 'word') {
            setWordBoundary(event);
          }
        },
        onComplete: () => {
          if (isStaleRequest()) return;
          setSdkState({ status: 'ready', error: null });
        },
        onError: (err) => {
          if (isStaleRequest()) return;
          console.error('[SpeechSDK] Synthesis error:', err);
          setSdkState({ status: 'error', error: err?.errorDetails || err?.reason || 'Synthesis failed' });
          setTtsAnnouncement('Narration unavailable.');
        }
      });

      if (isStaleRequest()) {
        if (result?.audioUrl && typeof URL !== 'undefined') {
          try {
            URL.revokeObjectURL(result.audioUrl);
          } catch {
            // ignore revoke errors
          }
        }
        return;
      }

      const audio = new Audio(result.audioUrl);
      sdkAudioRef.current = audio;
      sdkObjectUrlRef.current = result.audioUrl;

      audio.ontimeupdate = () => {
        if (isStaleRequest()) return;
        const currentMs = audio.currentTime * 1000;
        const currentWord = wordTimings.find((w, index) => {
          const next = wordTimings[index + 1];
          return currentMs >= w.audioOffsetMs && (!next || currentMs < next.audioOffsetMs);
        });
        if (currentWord && currentWord.boundaryType === 'word') {
          setWordBoundary(currentWord);
        }
      };

      audio.onplay = () => {
        if (isStaleRequest()) return;
        setSdkState({ status: 'playing', error: null });
        setTtsAnnouncement('Playing narration with word highlighting.');
      };

      audio.onpause = () => {
        if (isStaleRequest()) return;
        if (!audio.ended) {
          setSdkState({ status: 'paused', error: null });
          setTtsAnnouncement('Narration paused.');
        }
      };

      audio.onended = () => {
        if (isStaleRequest()) return;
        releaseSdkAudio();
        setSdkState({ status: 'completed', error: null });
        setWordBoundary(null);
        setTtsAnnouncement('Narration finished.');
      };

      audio.onerror = () => {
        if (isStaleRequest()) return;
        releaseSdkAudio();
        setSdkState({ status: 'error', error: 'Audio playback failed' });
        setWordBoundary(null);
        setTtsAnnouncement('Narration unavailable.');
      };

      await audio.play();
      if (isStaleRequest()) {
        return;
      }
    } catch (error) {
      if (isStaleRequest()) return;
      releaseSdkAudio();
      setWordBoundary(null);

      const autoplayError = error?.name === 'NotAllowedError' ||
        error?.message?.toLowerCase?.().includes('user interaction') ||
        error?.message?.toLowerCase?.().includes('autoplay');

      setSdkState({
        status: 'error',
        error: error?.message || 'Failed to generate speech'
      });
      setTtsAnnouncement(
        autoplayError
          ? 'Tap anywhere on the page to enable audio, then try again.'
          : 'Narration unavailable.'
      );

      console.log('[AudioController] Falling back to Azure REST API');
      await speakWithAzure(text, context);
    }
  }, [voiceOn, releaseSdkAudio, speakWithAzure]);

  // Unified speak function that routes to appropriate provider
  const speak = useCallback(async (text, context = 'default', emotion = null) => {
    if (ttsProvider === 'hume') {
      await speakWithHumeProvider(text, context, emotion);
    } else if (ttsProvider === 'azure-sdk') {
      await speakWithSpeechSDK(text, context);
    } else {
      // Azure TTS now supports emotion parameter via steerable instructions
      await speakWithAzure(text, context, emotion);
    }
  }, [ttsProvider, speakWithHumeProvider, speakWithSpeechSDK, speakWithAzure]);

  const swellCooldownRef = useRef(0);
  const triggerCinematicSwell = useCallback((beatKey) => {
    if (!ambienceOn) return;
    const now = Date.now();
    if (now - swellCooldownRef.current < 1800) return;
    swellCooldownRef.current = now;

    const beatPeakMap = {
      opening: 0.28,
      cards: 0.3,
      pivot: 0.34,
      tension: 0.32,
      synthesis: 0.36,
      resolution: 0.34,
      guidance: 0.33
    };
    const peak = beatPeakMap[beatKey] || 0.3;
    swellAmbience({ peak });
  }, [ambienceOn]);

  const handleNarrationButtonClick = useCallback(async (fullReadingText, isPersonalReadingError, emotion = null) => {
    if (!voiceOn) {
      setVoicePromptRequested(true);
      return;
    }
    const isNarrationAvailable = Boolean(fullReadingText);
    if (!isNarrationAvailable || isPersonalReadingError) return;

    const shouldUseAzureFallback = ttsProvider === 'hume' && humeFallbackActive;
    // Determine current state based on provider
    const currentState = shouldUseAzureFallback
      ? ttsState
      : ttsProvider === 'hume'
        ? humeState
        : ttsProvider === 'azure-sdk'
          ? sdkState
          : ttsState;
    const isLoading = currentState.status === 'loading' || currentState.status === 'synthesizing';

    // Check if any provider is playing to prevent overlap
    const isHumePlaying = humeState.status === 'playing';
    const isAzurePlaying = ttsState.status === 'playing';
    const isSdkPlaying = sdkState.status === 'playing';
    const isPlaying = isHumePlaying || isAzurePlaying || isSdkPlaying;
    const isPaused = currentState.status === 'paused';

    if (isLoading && !isPaused && !isPlaying) return;

    if (isPlaying) {
      if (isHumePlaying && humeAudioRef.current) {
        humeAudioRef.current.pause();
        setHumeState({ status: 'paused', error: null });
        setTtsAnnouncement('Narration paused.');
      }

      if (isSdkPlaying && sdkAudioRef.current) {
        sdkAudioRef.current.pause();
        setSdkState({ status: 'paused', error: null });
        setTtsAnnouncement('Narration paused.');
      }

      if (isAzurePlaying) {
        pauseTTS();
      }
      return;
    }

    const unlocked = await unlockAudio();
    if (!unlocked) {
      return;
    }

    if (isPaused) {
      if (ttsProvider === 'hume' && humeAudioRef.current) {
        humeAudioRef.current.audio.play();
        setHumeState({ status: 'playing', error: null });
        setTtsAnnouncement('Resuming narration...');
      } else if (ttsProvider === 'azure-sdk' && sdkAudioRef.current) {
        void sdkAudioRef.current.play();
        setSdkState({ status: 'playing', error: null });
        setTtsAnnouncement('Resuming narration...');
      } else {
        void resumeTTS();
      }
      return;
    }

    // Reset voice continuity when starting a new reading narration
    if (ttsProvider === 'hume') {
      resetGenerationId();
    }

    void speak(fullReadingText, 'full-reading', emotion);
  }, [voiceOn, ttsState, humeState, sdkState, ttsProvider, humeFallbackActive, speak]);

  const handleNarrationStop = useCallback(() => {
    humeRequestRef.current += 1;
    sdkRequestRef.current += 1;
    // Always attempt to stop both providers to prevent orphaned audio
    stopHumeAudio();
    if (humeAudioRef.current) {
      humeAudioRef.current = null;
    }
    setHumeState({ status: 'stopped', error: null });
    setHumeFallbackActive(false);
    resetGenerationId(); // Reset for next reading

    releaseSdkAudio();
    setSdkState({ status: 'stopped', error: null });
    setWordBoundary(null);

    stopTTS();
    setTtsAnnouncement('Narration stopped.');
  }, [releaseSdkAudio]);

  const handleVoicePromptEnable = useCallback(async (fullReadingText, emotion) => {
    setVoiceOn(true);
    setVoicePromptRequested(false);
    if (!fullReadingText) return;
    const unlocked = await unlockAudio();
    if (!unlocked) return;
    setTimeout(() => {
      void speak(fullReadingText, 'full-reading', emotion);
    }, 120);
  }, [setVoiceOn, speak]);

  const setShowVoicePrompt = useCallback((nextVisible) => {
    setVoicePromptRequested(Boolean(nextVisible));
  }, []);

  // Expose the correct TTS state based on current provider
  let effectiveTtsState;
  if (ttsProvider === 'hume' && humeFallbackActive) {
    effectiveTtsState = ttsState;
  } else if (ttsProvider === 'hume') {
    effectiveTtsState = humeState;
  } else if (ttsProvider === 'azure-sdk') {
    effectiveTtsState = sdkState;
  } else {
    effectiveTtsState = ttsState;
  }

  return {
    ttsState: effectiveTtsState,
    ttsAnnouncement,
    showVoicePrompt,
    setShowVoicePrompt,
    speak,
    enqueueNarrationChunk,
    finalizeNarrationStream,
    resetNarrationStream,
    isNarrationStreamActive,
    pauseNarrationPlayback,
    resumeNarrationPlayback,
    handleNarrationButtonClick,
    handleNarrationStop,
    handleVoicePromptEnable,
    ttsProvider,
    wordBoundary,
    triggerCinematicSwell
  };
}
