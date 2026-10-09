import { useState, useEffect, useCallback, useRef } from 'react';
import {
  speakText,
  pauseTTS,
  resumeTTS,
  stopTTS,
  subscribeToTTS,
  getCurrentTTSState,
  unlockAudio,
  finalizeTTSStream,
  resetTTSStream,
  isTTSStreamActive,
  swellAmbience
} from '../lib/audio';
import { usePreferences } from '../contexts/PreferencesContext';

export function useAudioController() {
  const { voiceOn, setVoiceOn, ttsProvider, ttsSpeed, ambienceOn } = usePreferences();
  const [ttsState, setTtsState] = useState(() => getCurrentTTSState());
  const [ttsAnnouncement, setTtsAnnouncement] = useState('');
  const [voicePromptRequested, setVoicePromptRequested] = useState(false);
  const showVoicePrompt = voicePromptRequested && !voiceOn;

  const previousProviderRef = useRef(ttsProvider);

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

  useEffect(() => {
    if (!voiceOn || previousProviderRef.current !== ttsProvider) {
      stopTTS();
      resetTTSStream();
    }
    previousProviderRef.current = ttsProvider;
  }, [voiceOn, ttsProvider]);

  // /api/tts reader voice; the player applies the speed.
  const speak = useCallback(async (text, context = 'default', emotion = null) => {
    await speakText({
      text,
      enabled: voiceOn,
      provider: ttsProvider,
      context,
      voice: 'nova', // Legacy cache identity; the server selects the actual voice.
      speed: ttsSpeed,
      stream: context === 'full-reading',
      emotion
    });
  }, [voiceOn, ttsSpeed, ttsProvider]);

  // Wait for the completed, screened reading and narrate it in one request.
  // A client-controlled cross-request session could bypass the allowance.
  const enqueueNarrationChunk = useCallback(() => false, []);

  const finalizeNarrationStream = useCallback(() => {
    finalizeTTSStream();
  }, []);

  const resetNarrationStream = useCallback((options = {}) => {
    resetTTSStream(options);
  }, []);

  const isNarrationStreamActive = useCallback(() => isTTSStreamActive(), []);

  const pauseNarrationPlayback = useCallback(() => {
    pauseTTS();
  }, []);

  const resumeNarrationPlayback = useCallback(async () => {
    await resumeTTS();
  }, []);

  const currentSpeakRef = useRef(speak);
  useEffect(() => { currentSpeakRef.current = speak; }, [speak]);

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

    const isLoading = ttsState.status === 'loading' || ttsState.status === 'synthesizing';
    const isPlaying = ttsState.status === 'playing';
    const isPaused = ttsState.status === 'paused';

    if (isLoading) return;
    if (isPlaying) {
      pauseTTS();
      return;
    }

    const unlocked = await unlockAudio();
    if (!unlocked) {
      return;
    }

    if (isPaused) {
      void resumeTTS();
      return;
    }

    void speak(fullReadingText, 'full-reading', emotion);
  }, [voiceOn, ttsState, speak]);

  const handleNarrationStop = useCallback(() => {
    stopTTS();
    setTtsAnnouncement('Narration stopped.');
  }, []);

  const handleVoicePromptEnable = useCallback(async (fullReadingText, emotion) => {
    setVoiceOn(true);
    setVoicePromptRequested(false);
    if (!fullReadingText) return;
    const unlocked = await unlockAudio();
    if (!unlocked) return;
    setTimeout(() => {
      // Enabling voice rerenders the hook; use the callback with that updated
      // preference rather than the muted callback captured by this click.
      void currentSpeakRef.current(fullReadingText, 'full-reading', emotion);
    }, 120);
  }, [setVoiceOn]);

  const setShowVoicePrompt = useCallback((nextVisible) => {
    setVoicePromptRequested(Boolean(nextVisible));
  }, []);

  return {
    ttsState,
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
    wordBoundary: null,
    triggerCinematicSwell
  };
}
