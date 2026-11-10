import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  speakText,
  pauseTTS,
  resumeTTS,
  stopTTS,
  subscribeToTTS,
  getCurrentTTSState,
  unlockAudio,
  beginNarrationIntent,
  finalizeTTSStream,
  resetTTSStream,
  isTTSStreamActive,
  swellAmbience
} from '../lib/audio';
import { usePreferences } from '../contexts/PreferencesContext';
import { createNarrationCoordinator } from '../lib/narrationCoordinator.js';

export function useAudioController() {
  const { voiceOn, setVoiceOn, ttsProvider, ttsSpeed, ambienceOn } = usePreferences();
  const [rawTtsState, setRawTtsState] = useState(() => getCurrentTTSState());
  const [waiting, setWaiting] = useState(false);
  const mountedRef = useRef(true);
  const settingsRef = useRef({ voiceOn, ttsProvider });
  useEffect(() => { settingsRef.current = { voiceOn, ttsProvider }; }, [voiceOn, ttsProvider]);
  const [coordinator] = useState(() => createNarrationCoordinator({
    speak: speakText,
    onWaiting: setWaiting
  }));
  const ttsState = useMemo(() => waiting ? {
    ...rawTtsState, status: 'loading', context: 'full-reading',
    reason: 'waiting-for-card', message: 'Finishing card narration before your reading…'
  } : rawTtsState, [waiting, rawTtsState]);
  const announce = ttsState.context === 'full-reading' || ttsState.context === 'card-reveal';
  const ttsAnnouncement = announce ? ttsState.message || '' : '';
  const [voicePromptRequested, setVoicePromptRequested] = useState(false);
  const showVoicePrompt = voicePromptRequested && !voiceOn;

  const previousProviderRef = useRef(ttsProvider);

  // Feed raw outcomes to the coordinator before projecting queued feedback.
  useEffect(() => {
    mountedRef.current = true;
    const unsubscribe = subscribeToTTS(state => {
      coordinator.updateState(state);
      setRawTtsState(state);
    });
    return () => {
      mountedRef.current = false;
      unsubscribe();
      coordinator.cancelQueued();
      stopTTS();
    };
  }, [coordinator]);

  useEffect(() => {
    if (!voiceOn || previousProviderRef.current !== ttsProvider) {
      coordinator.cancelQueued();
      stopTTS();
    }
    previousProviderRef.current = ttsProvider;
  }, [voiceOn, ttsProvider, coordinator]);

  // /api/tts reader voice; the player applies the speed.
  const speak = useCallback(async (text, context = 'default', emotion = null) => {
    if (!mountedRef.current || !settingsRef.current.voiceOn || settingsRef.current.ttsProvider !== ttsProvider) return;
    const raw = getCurrentTTSState();
    if (context === 'card-reveal' && raw.context === 'full-reading' && ['loading', 'playing', 'paused', 'synthesizing'].includes(raw.status)) return;
    await coordinator.request({
      text,
      enabled: voiceOn,
      provider: ttsProvider,
      context,
      voice: 'nova', // Legacy cache identity; the server selects the actual voice.
      speed: ttsSpeed,
      stream: context === 'full-reading',
      emotion
    });
  }, [voiceOn, ttsSpeed, ttsProvider, coordinator]);

  // Wait for the completed, screened reading and narrate it in one request.
  // A client-controlled cross-request session could bypass the allowance.
  const enqueueNarrationChunk = useCallback(() => false, []);

  const finalizeNarrationStream = useCallback(() => {
    finalizeTTSStream();
  }, []);

  const resetNarrationStream = useCallback((options = {}) => {
    // Starting interpretation prepares a new reading without interrupting its
    // still-pending card synthesis. Explicit resets keep the normal cancel path.
    if (options.preserveCardNarration && getCurrentTTSState().context === 'card-reveal') return;
    coordinator.cancelQueued({ preserveActive: Boolean(options.preserveAudio) });
    setWaiting(false);
    resetTTSStream(options);
  }, [coordinator]);

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

    const isFullReading = ttsState.context === 'full-reading';
    const isLoading = isFullReading && (ttsState.status === 'loading' || ttsState.status === 'synthesizing');
    const isPlaying = isFullReading && ttsState.status === 'playing';
    const isPaused = isFullReading && ttsState.status === 'paused';

    if (isLoading) return;
    if (isPlaying) {
      pauseTTS();
      return;
    }

    const isCurrent = beginNarrationIntent();
    const unlocked = await unlockAudio({ isCurrent });
    if (!unlocked || !isCurrent()) {
      return;
    }

    if (isPaused) {
      void resumeTTS();
      return;
    }

    void speak(fullReadingText, 'full-reading', emotion);
  }, [voiceOn, ttsState, speak]);

  const handleNarrationStop = useCallback(() => {
    coordinator.cancelQueued();
    setWaiting(false);
    stopTTS();
  }, [coordinator]);

  const handleVoicePromptEnable = useCallback(async (fullReadingText, emotion) => {
    const isCurrent = beginNarrationIntent();
    setVoiceOn(true);
    setVoicePromptRequested(false);
    if (!fullReadingText) return;
    const unlocked = await unlockAudio({ isCurrent });
    if (!unlocked || !isCurrent()) return;
    setTimeout(() => {
      if (!isCurrent()) return;
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
