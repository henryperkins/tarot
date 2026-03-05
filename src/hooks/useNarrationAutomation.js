import { useCallback, useEffect, useRef, useState } from 'react';
import {
  STREAM_AUTO_NARRATE_DEBOUNCE_MS,
  shouldScheduleAutoNarration
} from '../lib/narrationStream.js';

export function getAutoNarrationReadingKey({
  readingIdentity,
  personalReading
}) {
  if (typeof readingIdentity === 'string' && readingIdentity.trim().length > 0) {
    return `identity:${readingIdentity.trim()}`;
  }

  const requestId = personalReading?.requestId;
  if (typeof requestId === 'string' && requestId.trim().length > 0) {
    return `request:${requestId.trim()}`;
  }

  if (personalReading) {
    return '__reading_present__';
  }

  return '__no_reading__';
}

export function getCanAutoNarrate({
  voiceOn,
  autoNarrate,
  narrativePhase,
  isReadingStreaming,
  autoNarrationTriggered,
  ttsProvider
}) {
  return Boolean(
    voiceOn
    && autoNarrate
    && narrativePhase === 'complete'
    && !isReadingStreaming
    && !autoNarrationTriggered
    && ttsProvider !== 'azure'
  );
}

export function useNarrationAutomation({
  voiceOn,
  autoNarrate,
  narrativePhase,
  isReadingStreaming,
  isPersonalReadingError,
  fullReadingText,
  narrativeText,
  emotionalTone,
  ttsProvider,
  ttsStatus,
  readingIdentity,
  personalReading,
  handleNarrationButtonClick,
  handleVoicePromptEnable
}) {
  const readingKey = getAutoNarrationReadingKey({
    readingIdentity,
    personalReading
  });
  const [autoNarrationTriggeredState, setAutoNarrationTriggeredState] = useState({
    key: readingKey,
    value: false
  });
  const autoNarrationTriggered = autoNarrationTriggeredState.key === readingKey
    ? autoNarrationTriggeredState.value
    : false;
  const autoNarrationTriggeredRef = useRef(false);
  const autoNarrationTimeoutRef = useRef(null);
  const emotion = emotionalTone?.emotion || null;
  const narrationTextForPlayback = fullReadingText || narrativeText;
  const setAutoNarrationTriggered = useCallback((value) => {
    setAutoNarrationTriggeredState({ key: readingKey, value });
  }, [readingKey]);

  const handleNarration = useCallback(() => {
    handleNarrationButtonClick(narrationTextForPlayback, isPersonalReadingError, emotion);
  }, [emotion, handleNarrationButtonClick, isPersonalReadingError, narrationTextForPlayback]);

  const handleVoicePrompt = useCallback(() => {
    handleVoicePromptEnable(narrationTextForPlayback, emotion);
  }, [emotion, handleVoicePromptEnable, narrationTextForPlayback]);

  const canAutoNarrate = getCanAutoNarrate({
    voiceOn,
    autoNarrate,
    narrativePhase,
    isReadingStreaming,
    autoNarrationTriggered,
    ttsProvider
  });

  useEffect(() => {
    if (!personalReading) {
      autoNarrationTriggeredRef.current = false;
      if (autoNarrationTimeoutRef.current) {
        window.clearTimeout(autoNarrationTimeoutRef.current);
        autoNarrationTimeoutRef.current = null;
      }
    }
  }, [personalReading]);

  useEffect(() => {
    autoNarrationTriggeredRef.current = autoNarrationTriggered;
  }, [autoNarrationTriggered]);

  useEffect(() => () => {
    if (autoNarrationTimeoutRef.current) {
      window.clearTimeout(autoNarrationTimeoutRef.current);
      autoNarrationTimeoutRef.current = null;
    }
  }, []);

  useEffect(() => {
    const shouldDebounceAutoNarrate = shouldScheduleAutoNarration({
      voiceOn,
      autoNarrate,
      isReadingStreaming,
      isPersonalReadingError,
      autoNarrationTriggered: autoNarrationTriggeredRef.current,
      narrativeText,
      ttsProvider,
      ttsStatus
    });

    if (!shouldDebounceAutoNarrate) {
      if (autoNarrationTimeoutRef.current) {
        window.clearTimeout(autoNarrationTimeoutRef.current);
        autoNarrationTimeoutRef.current = null;
      }
      return;
    }

    if (autoNarrationTimeoutRef.current) {
      return;
    }

    autoNarrationTimeoutRef.current = window.setTimeout(() => {
      autoNarrationTimeoutRef.current = null;
      if (autoNarrationTriggeredRef.current) return;
      autoNarrationTriggeredRef.current = true;
      setAutoNarrationTriggered(true);
      handleNarration();
    }, STREAM_AUTO_NARRATE_DEBOUNCE_MS);
  }, [
    autoNarrate,
    handleNarration,
    isPersonalReadingError,
    isReadingStreaming,
    narrativeText,
    setAutoNarrationTriggered,
    ttsProvider,
    ttsStatus,
    voiceOn
  ]);

  return {
    autoNarrationTriggered,
    canAutoNarrate,
    handleNarration,
    handleVoicePrompt
  };
}
