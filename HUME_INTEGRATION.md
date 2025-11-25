# Hume AI Octave TTS Integration for Mystic Tarot

This document describes the integration of Hume AI's Octave text-to-speech technology into the Mystic Tarot application.

## Overview

Hume AI Octave TTS is an LLM-powered text-to-speech system that understands text both emotionally and semantically. Unlike traditional TTS systems, Octave knows when to whisper secrets, shout in triumph, and calmly state facts—making it perfect for tarot readings where tone, emotion, and mystical atmosphere are essential.

## Features

- **Emotionally Intelligent**: Understands context and emotional nuance
- **Context-Aware Voices**: Different voice selections for card reveals, full readings, synthesis, questions, and reflections
- **Voice Continuity**: Maintains consistent voice characteristics across multiple utterances via generation IDs
- **Acting Instructions**: Natural language descriptions guide tone, pacing, and emotional quality
- **Preset Voice Library**: Access to Hume's curated voices optimized for different contexts
- **Speed Control**: Adjustable speech rate (0.5x - 2.0x)
- **Trailing Silence**: Configurable pauses after utterances for contemplation
- **High Quality**: Professional-grade audio output (WAV format)

## Architecture

### Backend (Cloudflare Pages Functions)

**`functions/api/tts-hume.js`** - Hume Octave TTS endpoint

- Accepts text, context, voice preferences, and continuation parameters
- Maps tarot reading contexts to appropriate voices and acting instructions
- Calls Hume AI TTS API (`POST https://api.hume.ai/v0/tts`)
- Returns audio as base64-encoded data URI
- Tracks generation IDs for voice continuity

### Frontend (React)

**`src/lib/audioHume.js`** - Client-side Hume TTS utilities

Core functions:
- `speakWithHume(text, options)` - Main TTS function with full control
- `speakCardReveal(cardName, orientation, meaning)` - Specialized for card reveals
- `speakFullReading(readingText, options)` - For complete readings
- `speakSynthesis(synthesisText, options)` - For reading summaries
- `speakSequence(segments, options)` - Multiple segments with voice continuity
- `stopHumeAudio()` - Stop current playback
- `isHumeTTSAvailable()` - Check if Hume is configured

**`src/components/HumeAudioControls.jsx`** - React UI component

Provides:
- Voice selection dropdown (organized by category)
- Speed control slider
- Play/Pause/Stop buttons
- Availability detection
- Error handling and user feedback

## Setup

### 1. Get API Key

1. Visit [Hume AI Platform](https://platform.hume.ai/)
2. Sign up or log in
3. Navigate to [Settings > API Keys](https://platform.hume.ai/settings/keys)
4. Create a new API key
5. Copy the key

### 2. Environment Variables

Add to your Cloudflare Pages environment variables:

```bash
HUME_API_KEY=your_hume_api_key_here
```

Or for local development, add to `.dev.vars`:

```bash
HUME_API_KEY=your_hume_api_key_here
```

### 3. Test the Endpoint

```bash
curl -X POST https://your-app.pages.dev/api/tts-hume \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Welcome, seeker. The cards reveal The Fool, upright.",
    "context": "card-reveal"
  }'
```

### 4. Integration into Components

Add the Hume audio controls to your reading display:

```jsx
import HumeAudioControls from './components/HumeAudioControls';

function ReadingDisplay({ reading }) {
  return (
    <div>
      {/* Your existing reading display */}
      <div className="reading-text">{reading}</div>
      
      {/* Add Hume audio controls */}
      <HumeAudioControls 
        readingText={reading}
        context="full-reading"
        onPlaybackStart={() => console.log('Started reading')}
        onPlaybackEnd={() => console.log('Finished reading')}
      />
    </div>
  );
}
```

## Usage Examples

### Basic Card Reveal

```javascript
import { speakCardReveal } from '../lib/audioHume';

// Speak a card reveal with mystical tone
await speakCardReveal('The Fool', 'upright', 'New beginnings await');
```

### Full Reading with Custom Voice

```javascript
import { speakFullReading } from '../lib/audioHume';

const reading = "The cards reveal a journey of transformation...";

await speakFullReading(reading, {
  voiceName: 'KORA',
  speed: 0.95
});
```

### Sequential Reading with Voice Continuity

```javascript
import { speakSequence, resetGenerationId } from '../lib/audioHume';

// Reset for new reading
resetGenerationId();

// Speak multiple segments with consistent voice
const segments = [
  "In the past position, we see The Tower...",
  "The present shows The Star...",
  "And in the future, The Sun emerges..."
];

await speakSequence(segments, {
  context: 'full-reading',
  voiceName: 'ITO',
  speed: 1.0,
  autoPlay: true // Automatically play each segment in sequence
});
```

### Custom Acting Instructions

```javascript
import { speakWithHume } from '../lib/audioHume';

await speakWithHume("The Magician appears before you", {
  voiceName: 'ITO',
  description: "mystical and ancient, with deep resonance and slow, deliberate pacing",
  speed: 0.85,
  trailingSilence: 2.0
});
```

## Available Voices

Hume's Voice Library includes many expressive voices. Here are recommended voices for tarot readings:

### Mystical Voices (Recommended for Tarot)
- **ITO** - Warm, contemplative - excellent for readings
- **KORA** - Smooth, storytelling quality - great for synthesis
- **DACHER** - Gentle, supportive - perfect for reflections
- **STELLA** - Clear, inviting - good for questions
- **WHIMSY** - Playful yet wise

### Narrator Voices
- **HANK** - Deep, authoritative narrator
- **RAMONA** - Warm, engaging storyteller
- **LIVIA** - Elegant, refined narrator

### Conversational Voices
- **AURA** - Friendly, approachable
- **FINN** - Casual, relatable
- **ORION** - Calm, measured

### Dramatic Voices
- **LUNA** - Mysterious, dramatic
- **COVE** - Rich, theatrical
- **EMBER** - Intense, passionate

Browse the full library: [Hume Voice Library](https://platform.hume.ai/tts/voice-library)

## Context Types

The system recognizes these contexts and applies appropriate voice characteristics:

- **`card-reveal`** - Gentle, reverent, slower pace with pauses (Voice: ITO)
- **`full-reading`** - Thoughtful, contemplative, natural pauses (Voice: ITO)
- **`synthesis`** - Flowing, storytelling cadence (Voice: KORA)
- **`question`** - Warm, inviting, respectful (Voice: STELLA)
- **`reflection`** - Soft, affirming, supportive (Voice: DACHER)
- **`default`** - Mystical yet grounded (Voice: ITO)

## API Reference

### POST /api/tts-hume

**Request Body:**
```json
{
  "text": "The text to speak (required, max 5000 chars)",
  "context": "card-reveal | full-reading | synthesis | question | reflection | default",
  "voiceName": "ITO",
  "description": "Optional acting instructions",
  "speed": 1.0,
  "previousGenerationId": "generation-id-from-previous-call",
  "trailingSilence": 1.5
}
```

**Response:**
```json
{
  "audio": "data:audio/wav;base64,...",
  "provider": "hume-ai",
  "generationId": "uuid",
  "voiceUsed": "ITO"
}
```

**Error Responses:**
- `400` - Missing or invalid text
- `429` - Rate limit exceeded
- `500` - TTS generation failed
- `503` - Hume API not configured

## Best Practices

### 1. Voice Continuity
When reading multiple cards or segments, use `previousGenerationId` to maintain voice consistency:

```javascript
let lastId = null;

for (const card of cards) {
  const result = await speakWithHume(card.interpretation, {
    previousGenerationId: lastId
  });
  lastId = result.generationId;
}
```

### 2. Context Selection
Choose the appropriate context for the best results:
- Use `card-reveal` for individual cards
- Use `full-reading` for complete interpretations
- Use `synthesis` for summaries and conclusions

### 3. Speed Adjustment
- **0.8-0.9x**: Deep contemplation, meditation
- **1.0x**: Natural, conversational
- **1.1-1.2x**: Engaging, slightly faster

### 4. Acting Instructions
Use natural language to guide emotional delivery:
- "shocked and disappointed, speaking slowly with emphasis"
- "warm and reassuring, with gentle pauses"
- "mystical and reverent, as if revealing ancient wisdom"

### 5. Error Handling
Always handle potential errors gracefully:

```javascript
try {
  await speakWithHume(text, options);
} catch (error) {
  console.error('TTS failed:', error);
  // Fall back to text display or alternative TTS
}
```

## Comparison with Azure OpenAI TTS

| Feature | Hume AI Octave | Azure OpenAI |
|---------|----------------|--------------|
| **Emotional Intelligence** | ⭐⭐⭐⭐⭐ LLM-powered understanding | ⭐⭐⭐ Via instructions |
| **Voice Continuity** | ⭐⭐⭐⭐⭐ Built-in via generation IDs | ⭐⭐⭐ Manual management |
| **Voice Library** | Curated expressive voices | 11 base voices |
| **Acting Instructions** | Natural language descriptions | Instruction-based |
| **Audio Format** | WAV (high quality) | MP3 (configurable) |
| **Latency** | ~200ms (Octave 1) | Variable |
| **Mystical Voices** | Purpose-built options | Generic voices |
| **Context Understanding** | Native semantic understanding | Instruction parsing |

## Technical Details

### API Endpoint
```
POST https://api.hume.ai/v0/tts
```

### Request Format
```json
{
  "utterances": [
    {
      "text": "The text to speak",
      "voice": {
        "name": "ITO",
        "provider": "HUME_AI"
      },
      "description": "Optional acting instructions",
      "speed": 1.0,
      "trailingsilence": 1.5
    }
  ],
  "context": {
    "generationId": "previous-generation-id"
  }
}
```

### Response Format
```json
{
  "generations": [
    {
      "audio": "base64-encoded-audio-data",
      "generationId": "unique-generation-id"
    }
  ]
}
```

### Rate Limits
- Defined by your [subscription tier](https://www.hume.ai/pricing)
- Max text length: 5,000 characters per utterance
- Max description length: 1,000 characters per utterance

## Troubleshooting

### "Hume AI is not configured"
- Ensure `HUME_API_KEY` is set in your environment variables
- Redeploy your Cloudflare Pages application after adding the key
- Verify the key is valid at [platform.hume.ai/settings/keys](https://platform.hume.ai/settings/keys)

### Audio Not Playing
- Check browser console for errors
- Verify the audio data URI is properly formatted
- Ensure browser autoplay policies allow audio
- Try user-initiated playback (button click)

### Voice Continuity Not Working
- Verify you're passing the correct `generationId` from previous calls
- Check that `previousGenerationId` is included in subsequent requests
- Ensure you're using the same voice across continuations

### Rate Limiting (429 Error)
- Implement client-side throttling
- Consider caching generated audio for repeated text
- Upgrade your subscription tier if needed

### Poor Voice Quality
- Try different voices from the library
- Adjust speed (slower often sounds better)
- Use acting instructions to guide emotional delivery
- Ensure text is well-formatted (proper punctuation, etc.)

## Future Enhancements

- [ ] Audio caching layer for repeated readings
- [ ] Batch generation for multi-card spreads
- [ ] Voice customization UI with preview
- [ ] Save favorite voice configurations per user
- [ ] Integration with journal feature (replay past readings)
- [ ] Background ambient music mixing
- [ ] Export readings as downloadable audio files
- [ ] Streaming support for real-time generation
- [ ] Voice cloning for personalized readings

## Resources

- [Hume AI Documentation](https://dev.hume.ai/)
- [Octave TTS API Reference](https://dev.hume.ai/reference/text-to-speech-tts)
- [Voice Library](https://platform.hume.ai/tts/voice-library)
- [API Keys Management](https://platform.hume.ai/settings/keys)
- [TypeScript SDK](https://github.com/humeai/hume-typescript-sdk)
- [Sample Code](https://github.com/HumeAI/hume-api-examples/tree/main/tts)
- [MCP Integration](https://dev.hume.ai/docs/integrations/mcp)
- [Pricing & Limits](https://www.hume.ai/pricing)

## Support

For issues or questions about the Hume integration:
1. Check the console logs for detailed error messages
2. Verify your API key is valid and has TTS permissions
3. Review the [Hume AI status page](https://status.hume.ai/) for service issues
4. Check the [Hume documentation](https://dev.hume.ai/) for API updates
5. Contact Hume AI support for API-specific problems

---

**Integration completed by:** Manus AI  
**Date:** November 25, 2025  
**Version:** 2.0.0 (Updated with correct Octave TTS API)  
**API Documentation:** https://dev.hume.ai/reference/text-to-speech-tts
