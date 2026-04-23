# Azure OpenAI TTS Improvements Design

**Date:** 2026-01-22
**Status:** Approved
**Scope:** Improve gpt-4o-mini-tts so reading context translates into voice and audio is easier to control/observe

## Overview

Four improvements to the Azure OpenAI TTS provider:

1. **Emotion → Voice Instructions** - Pass GraphRAG-derived emotions to steerable instructions
2. **Speed Control** - Expose narration speed preference (0.85x, 1.0x, 1.15x)
3. **Playback Progress** - Show progress bar with time display
4. **Status & Error Clarity** - Visual status indicators and actionable error messages

## 1. Emotion → Voice Instructions

### Problem
The `speakWithAzure` function in `useAudioController.js` ignores the emotion parameter. Only Hume gets emotion-aware delivery.

### Solution
Merge emotion-derived acting instructions with context templates on the backend, and pass emotion from frontend.

### Files Changed

**`functions/api/tts.js`**
- Accept `emotion` parameter in request body
- Import emotion descriptions from shared module
- Merge emotion instructions with context template in `buildTTSRequest()`

**`src/lib/audio.js`**
- Add `emotion` parameter to `speakText()` function signature
- Include emotion in API request body

**`src/hooks/useAudioController.js`**
- Update `speakWithAzure` to accept and pass emotion parameter
- Update `speak` function routing to pass emotion to Azure provider

### Data Flow
```
ReadingDisplay (emotionalTone)
  → handleNarrationButtonClick(text, error, emotion)
  → speak(text, context, emotion)
  → speakWithAzure(text, context, emotion)
  → speakText({ ..., emotion })
  → POST /api/tts { ..., emotion }
  → buildTTSRequest merges INSTRUCTION_TEMPLATES[context] + EMOTION_INSTRUCTIONS[emotion]
  → Azure gpt-4o-mini-tts with combined instructions
```

## 2. Speed Control

### Problem
Backend supports 0.25-4.0x speed but frontend doesn't expose it.

### Solution
Add `ttsSpeed` preference to PreferencesContext and speed selector to AudioControls.

### Files Changed

**`src/contexts/PreferencesContext.jsx`**
- Add `ttsSpeed` state with localStorage persistence (key: `tarot-tts-speed`)
- Default value: 1.0
- Add to context value

**`src/components/AudioControls.jsx`**
- Add speed selector below Voice Engine selector
- Only show when `voiceOn && ttsProvider === 'azure'`
- Three options: Slower (0.85), Normal (1.0), Faster (1.15)

**`src/hooks/useAudioController.js`**
- Import `ttsSpeed` from usePreferences
- Pass `speed: ttsSpeed` to speakText

### Speed Options

| Option | Value | Description |
|--------|-------|-------------|
| Slower | 0.85 | Contemplative pace for deep readings |
| Normal | 1.0 | Default natural pace |
| Faster | 1.15 | Efficient pace for reviewing saved readings |

## 3. Playback Progress

### Problem
Users can't see how far into narration they are.

### Solution
Track audio progress in TTS state and display progress bar with time.

### Files Changed

**`src/lib/audio.js`**
- Extend `currentTTSState` with: `currentTime`, `duration`, `progress`
- Add `loadedmetadata` listener in `wireTTSEvents()` to capture duration
- Add `timeupdate` listener to emit progress updates
- Update `emitTTSState()` to preserve/reset progress fields

**`src/components/NarrationProgress.jsx`** (new file)
- Display progress bar and time (e.g., "1:24 / 3:45")
- Show only when status is playing, paused, or loading
- Format time as `m:ss`

**`src/components/ReadingDisplay.jsx`**
- Import and render `NarrationProgress` below narration buttons
- Show when Azure TTS is active

### State Shape
```javascript
{
  // Existing fields...
  currentTime: 0,    // seconds
  duration: 0,       // seconds
  progress: 0        // 0-1 percentage
}
```

## 4. Status & Error Clarity

### Problem
Generic error messages, loading states not visible, rate limit vs service failure not distinguished.

### Solution
Surface TTS status with visual indicators and actionable error messages.

### Files Changed

**`functions/api/tts.js`**
- Add `errorCode` to error responses: `TIER_LIMIT`, `RATE_LIMIT`, `SERVICE_ERROR`

**`src/lib/audio.js`**
- Parse JSON error responses to extract errorCode and details
- Add `errorCode` and `errorDetails` to TTS state
- Add `getErrorMessage()` helper for user-friendly messages

**`src/components/NarrationStatus.jsx`** (new file)
- Visual status indicator with icon and label
- Status configs: idle, loading (spinner), playing, paused, completed, error
- Show cached indicator when applicable

**`src/components/ReadingDisplay.jsx`**
- Render `NarrationStatus` above narration buttons
- Show error details with action button for tier limit errors

### Status Configuration

| Status | Icon | Color | Example Message |
|--------|------|-------|-----------------|
| loading | CircleNotch (spin) | accent | "Preparing..." |
| playing | SpeakerHigh | green | "Playing" |
| paused | Pause | amber | "Paused" |
| completed | CheckCircle | muted | "Finished" |
| error | Warning | red | "Monthly limit reached (3/3)" |

### Error Codes

| Code | HTTP Status | User Message |
|------|-------------|--------------|
| `TIER_LIMIT` | 429 | "Monthly limit reached (X/Y). Upgrade for more." |
| `RATE_LIMIT` | 429 | "Too many requests. Please wait a moment." |
| `SERVICE_ERROR` | 5xx | "Voice service temporarily unavailable." |

## Implementation Order

1. **Backend first:** Update `tts.js` to accept emotion and return error codes
2. **Core audio:** Update `audio.js` with emotion, progress tracking, error parsing
3. **Preferences:** Add `ttsSpeed` to PreferencesContext
4. **Hook:** Update `useAudioController.js` to pass emotion and speed
5. **Components:** Create `NarrationProgress.jsx` and `NarrationStatus.jsx`
6. **Integration:** Update `AudioControls.jsx` and `ReadingDisplay.jsx`

## Testing

- Verify emotion instructions appear in Azure API calls (enable TTS debug logging)
- Test speed changes take effect on next narration
- Verify progress updates smoothly during playback
- Test error scenarios: rate limit, tier limit, service error
- Verify cached audio shows "(cached)" indicator

## Future Considerations (Out of Scope)

- Seek functionality (clicking on progress bar)
- Volume control
- Voice selection based on emotion
- Ambient audio ducking during narration
