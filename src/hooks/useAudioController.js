import { useState, useEffect, useCallback } from 'react';
import {
  speakText,
  pauseTTS,
  resumeTTS,
  stopTTS,
  subscribeToTTS,
  getCurrentTTSState,
  unlockAudio
} from '../lib/audio';
import { usePreferences } from '../contexts/PreferencesContext';

export function useAudioController() {
  const { voiceOn, setVoiceOn } = usePreferences();
  const [ttsState, setTtsState] = useState(() => getCurrentTTSState());
  const [ttsAnnouncement, setTtsAnnouncement] = useState('');
  const [voicePromptRequested, setVoicePromptRequested] = useState(false);
  const showVoicePrompt = voicePromptRequested && !voiceOn;

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

  // Stop TTS when voice is toggled off
  useEffect(() => {
    if (!voiceOn) {
      stopTTS();
    }
  }, [voiceOn]);

  const speak = useCallback(async (text, context = 'default') => {
    await speakText({
      text,
      enabled: voiceOn,
      context,
      voice: 'nova' // Default voice for mystical tarot readings
    });
  }, [voiceOn]);

  const handleNarrationButtonClick = useCallback(async (fullReadingText, isPersonalReadingError) => {
    if (!voiceOn) {
      setVoicePromptRequested(true);
      return;
    }
    const isNarrationAvailable = Boolean(fullReadingText);
    if (!isNarrationAvailable || isPersonalReadingError) return;

    const isTtsLoading = ttsState.status === 'loading';
    const isTtsPlaying = ttsState.status === 'playing';
    const isTtsPaused = ttsState.status === 'paused';

    if (isTtsLoading && !isTtsPaused && !isTtsPlaying) return;

    if (isTtsPlaying) {
      pauseTTS();
      return;
    }

    const unlocked = await unlockAudio();
    if (!unlocked) {
      return;
    }

    if (isTtsPaused) {
      void resumeTTS();
      return;
    }

    void speak(fullReadingText, 'full-reading');
  }, [voiceOn, ttsState.status, speak]);

  const handleNarrationStop = useCallback(() => {
    stopTTS();
  }, []);

  const handleVoicePromptEnable = useCallback(async (fullReadingText) => {
    setVoiceOn(true);
    setVoicePromptRequested(false);
    if (!fullReadingText) return;
    const unlocked = await unlockAudio();
    if (!unlocked) return;
    setTimeout(() => {
      void speak(fullReadingText, 'full-reading');
    }, 120);
  }, [setVoiceOn, speak]);

  const setShowVoicePrompt = useCallback((nextVisible) => {
    setVoicePromptRequested(Boolean(nextVisible));
  }, []);

  return {
    ttsState,
    ttsAnnouncement,
    showVoicePrompt,
    setShowVoicePrompt,
    speak,
    handleNarrationButtonClick,
    handleNarrationStop,
    handleVoicePromptEnable
  };
}
