# Hume AI Octave TTS Quick Start Guide

## 🚀 Get Started in 3 Steps

### Step 1: Get Your API Key
1. Visit https://platform.hume.ai/
2. Sign up or log in
3. Go to [Settings > API Keys](https://platform.hume.ai/settings/keys)
4. Create a new API key
5. Copy the key

### Step 2: Configure Environment
Add to your Cloudflare Pages environment variables:
```bash
HUME_API_KEY=your_api_key_here
```

Or add to `.dev.vars` for local development:
```bash
HUME_API_KEY=your_api_key_here
```

### Step 3: Use in Your Components

#### Option A: Use the React Component (Easiest)
```jsx
import HumeAudioControls from './components/HumeAudioControls';

function ReadingDisplay({ reading }) {
  return (
    <div>
      <div className="reading-text">{reading}</div>
      
      <HumeAudioControls 
        readingText={reading}
        context="full-reading"
      />
    </div>
  );
}
```

#### Option B: Use the Library Functions (More Control)
```javascript
import { speakFullReading } from '../lib/audioHume';

async function handleReadReading(text) {
  const result = await speakFullReading(text, {
    voiceName: 'ITO',
    speed: 0.95
  });
  
  // Audio plays automatically
  console.log('Generation ID:', result.generationId);
}
```

## 🎭 Recommended Voices for Tarot

- **ITO** - Warm, contemplative - best for full readings
- **KORA** - Smooth storytelling - great for synthesis/summaries
- **DACHER** - Gentle, supportive - perfect for reflections
- **STELLA** - Clear, inviting - good for questions

Browse all voices: [Hume Voice Library](https://platform.hume.ai/tts/voice-library)

## 📝 Quick Examples

### Card Reveal
```javascript
import { speakCardReveal } from '../lib/audioHume';

await speakCardReveal(
  'The Fool', 
  'upright', 
  'New beginnings and fresh starts'
);
```

### Full Reading
```javascript
import { speakFullReading } from '../lib/audioHume';

await speakFullReading(readingText, {
  voiceName: 'ITO',
  speed: 1.0
});
```

### Multiple Cards with Voice Continuity
```javascript
import { speakSequence, resetGenerationId } from '../lib/audioHume';

// Reset for new reading
resetGenerationId();

const cardInterpretations = [
  "In the past, The Tower reveals...",
  "The present shows The Star...",
  "And The Sun emerges in the future..."
];

await speakSequence(cardInterpretations, {
  context: 'full-reading',
  voiceName: 'ITO',
  autoPlay: true
});
```

### Custom Acting Instructions
```javascript
import { speakWithHume } from '../lib/audioHume';

await speakWithHume("The Magician appears before you", {
  voiceName: 'ITO',
  description: "mystical and ancient, with deep resonance and slow pacing",
  speed: 0.85,
  trailingSilence: 2.0
});
```

## 🧪 Test the Integration

### Test the API Endpoint
```bash
curl -X POST http://localhost:5173/api/tts-hume \
  -H "Content-Type: application/json" \
  -d '{
    "text": "The Fool appears before you",
    "context": "card-reveal"
  }'
```

### Test in Browser Console
```javascript
// Import the library
import { speakWithHume, isHumeTTSAvailable } from './lib/audioHume';

// Check if available
const available = await isHumeTTSAvailable();
console.log('Hume TTS available:', available);

// Generate speech
const result = await speakWithHume('The cards reveal wisdom', {
  voiceName: 'ITO'
});

// Play audio
result.play();
```

## 🎨 Customization

### Context Types
The system automatically selects appropriate voices based on context:

- **`card-reveal`** - Single card reveals (Voice: ITO)
- **`full-reading`** - Complete interpretations (Voice: ITO)
- **`synthesis`** - Summaries and conclusions (Voice: KORA)
- **`question`** - Question acknowledgments (Voice: STELLA)
- **`reflection`** - User reflection validation (Voice: DACHER)

### Speed Control
- **0.8-0.9x** - Deep contemplation, meditation
- **1.0x** - Natural, conversational
- **1.1-1.2x** - Engaging, slightly faster

### Acting Instructions
Use natural language to guide emotional delivery:

```javascript
await speakWithHume(text, {
  voiceName: 'ITO',
  description: "shocked and disappointed, speaking slowly with emphasis"
});
```

## 📚 Full Documentation

See `HUME_INTEGRATION.md` for complete documentation including:
- Full API reference
- All available voices
- Best practices
- Troubleshooting
- Advanced features

## 🆘 Troubleshooting

**"Hume AI is not configured"**
- Check that `HUME_API_KEY` is set in environment variables
- Redeploy after adding the key
- Verify key at [platform.hume.ai/settings/keys](https://platform.hume.ai/settings/keys)

**Audio not playing**
- Check browser console for errors
- Verify autoplay permissions
- Try user-initiated playback (button click)

**Rate limit errors (429)**
- Wait a moment and try again
- Check your [subscription tier](https://www.hume.ai/pricing)
- Consider caching audio for repeated text

**Need help?**
- Check the console logs
- Review `HUME_INTEGRATION.md`
- Visit [Hume documentation](https://dev.hume.ai/)

## 🎯 Key Features

✅ **Emotionally Intelligent** - LLM-powered understanding of context  
✅ **Voice Continuity** - Seamless multi-part readings  
✅ **Acting Instructions** - Natural language voice control  
✅ **Context-Aware** - Automatic voice selection  
✅ **High Quality** - Professional-grade audio  
✅ **Easy Integration** - Drop-in component or flexible library  

## 🔗 Resources

- [API Documentation](https://dev.hume.ai/reference/text-to-speech-tts)
- [Voice Library](https://platform.hume.ai/tts/voice-library)
- [API Keys](https://platform.hume.ai/settings/keys)
- [TypeScript SDK](https://github.com/humeai/hume-typescript-sdk)
- [Sample Code](https://github.com/HumeAI/hume-api-examples/tree/main/tts)

## 🎉 You're Ready!

The integration is complete and ready to use. Start by adding the `HumeAudioControls` component to your reading display, or use the library functions directly for more control.

The Hume Octave TTS system understands your tarot readings emotionally and semantically, delivering expressive, mystical narration that enhances the reading experience.

Happy reading! 🔮✨

---

**Version:** 2.0.0 (Updated with correct Octave TTS API)  
**Last Updated:** November 25, 2025
