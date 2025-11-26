import { useState, useEffect, useCallback, useRef } from 'react';
import {
  speakText,
  pauseTTS,
  resumeTTS,
  stopTTS,
  subscribeToTTS,
  getCurrentTTSState,
  unlockAudio
} from '../lib/audio';
import {
  speakWithHume,
  stopHumeAudio,
  resetGenerationId
} from '../lib/audioHume';
import { usePreferences } from '../contexts/PreferencesContext';

export function useAudioController() {
  const { voiceOn, setVoiceOn, ttsProvider } = usePreferences();
  const [ttsState, setTtsState] = useState(() => getCurrentTTSState());
  const [ttsAnnouncement, setTtsAnnouncement] = useState('');
  const [voicePromptRequested, setVoicePromptRequested] = useState(false);
  const showVoicePrompt = voicePromptRequested && !voiceOn;

  // Track Hume audio state separately
  const humeAudioRef = useRef(null);
  const [humeState, setHumeState] = useState({ status: 'idle', error: null });

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
      stopHumeAudio();
      setTimeout(() => {
        setHumeState({ status: 'idle', error: null });
      }, 0);
    }
  }, [voiceOn]);

  // Hume TTS speak function with emotion support
  const speakWithHumeProvider = useCallback(async (text, context = 'default', emotion = null) => {
    if (!text || !voiceOn) return;

    try {
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

      humeAudioRef.current = result;
      setHumeState({ status: 'playing', error: null });
      setTtsAnnouncement('Playing your personalized reading...');

      // Play the audio
      await result.play();

      // Handle audio end
      result.audio.onended = () => {
        setHumeState({ status: 'completed', error: null });
        setTtsAnnouncement('Narration finished.');
        humeAudioRef.current = null;
      };

      // Handle audio errors
      result.audio.onerror = (e) => {
        console.error('Hume audio playback error:', e);
        setHumeState({ status: 'error', error: 'Audio playback failed' });
        setTtsAnnouncement('Narration unavailable.');
        humeAudioRef.current = null;
      };

    } catch (error) {
      console.error('Hume TTS error:', error);
      setHumeState({ status: 'error', error: error.message || 'Failed to generate speech' });
      setTtsAnnouncement('Narration unavailable.');
    }
  }, [voiceOn]);

  // Azure TTS speak function (original)
  const speakWithAzure = useCallback(async (text, context = 'default') => {
    await speakText({
      text,
      enabled: voiceOn,
      context,
      voice: 'nova' // Default voice for mystical tarot readings
    });
  }, [voiceOn]);

  // Unified speak function that routes to appropriate provider
  const speak = useCallback(async (text, context = 'default', emotion = null) => {
    if (ttsProvider === 'hume') {
      await speakWithHumeProvider(text, context, emotion);
    } else {
      // Azure TTS doesn't support emotion parameter
      await speakWithAzure(text, context);
    }
  }, [ttsProvider, speakWithHumeProvider, speakWithAzure]);

  const handleNarrationButtonClick = useCallback(async (fullReadingText, isPersonalReadingError, emotion = null) => {
    if (!voiceOn) {
      setVoicePromptRequested(true);
      return;
    }
    const isNarrationAvailable = Boolean(fullReadingText);
    if (!isNarrationAvailable || isPersonalReadingError) return;

    // Determine current state based on provider
    const currentState = ttsProvider === 'hume' ? humeState : ttsState;
    const isLoading = currentState.status === 'loading';
    
    // Check if either provider is playing to prevent race conditions or overlap
    const isHumePlaying = humeState.status === 'playing';
    const isAzurePlaying = ttsState.status === 'playing';
    const isPlaying = isHumePlaying || isAzurePlaying;
    const isPaused = currentState.status === 'paused';

    if (isLoading && !isPaused && !isPlaying) return;

    if (isPlaying) {
      if (isHumePlaying && humeAudioRef.current) {
        humeAudioRef.current.pause();
        setHumeState({ status: 'paused', error: null });
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
  }, [voiceOn, ttsState, humeState, ttsProvider, speak]);

  const handleNarrationStop = useCallback(() => {
    // Always attempt to stop both providers to prevent orphaned audio
    stopHumeAudio();
    if (humeAudioRef.current) {
      humeAudioRef.current = null;
    }
    setHumeState({ status: 'stopped', error: null });
    setTtsAnnouncement('Narration stopped.');
    resetGenerationId(); // Reset for next reading
    
    stopTTS();
  }, []);

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
  const effectiveTtsState = ttsProvider === 'hume' ? humeState : ttsState;

  return {
    ttsState: effectiveTtsState,
    ttsAnnouncement,
    showVoicePrompt,
    setShowVoicePrompt,
    speak,
    handleNarrationButtonClick,
    handleNarrationStop,
    handleVoicePromptEnable,
    ttsProvider
  };
}
