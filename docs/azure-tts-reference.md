# Azure Text-to-Speech Complete Reference

Compiled from Microsoft Azure documentation (January 2026).

**Sources:**
- [SSML Structure](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/speech-synthesis-markup-structure)
- [REST API](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/rest-text-to-speech)
- [JavaScript SDK How-To](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/how-to-speech-synthesis)
- [JavaScript SDK API Reference](https://learn.microsoft.com/en-us/javascript/api/microsoft-cognitiveservices-speech-sdk/)

**Important JS SDK Note:** `speakTextAsync()` and `speakSsmlAsync()` are **callback-based**, not Promise-based. They accept `(text, successCallback, errorCallback)`. See Section 3 for promisified wrappers.

---

## 1. REST API

### Endpoints

**TTS Synthesis:**
```
POST https://{region}.tts.speech.microsoft.com/cognitiveservices/v1
```

**Voice List:**
```
GET https://{region}.tts.speech.microsoft.com/cognitiveservices/voices/list
```

### Synthesis Endpoint Headers

For `POST /cognitiveservices/v1` (TTS synthesis):

| Header | Value | Required |
|--------|-------|----------|
| `Authorization` | `Bearer {token}` | Yes (or use `Ocp-Apim-Subscription-Key`) |
| `Ocp-Apim-Subscription-Key` | Your Speech resource key | Yes (or use `Authorization`) |
| `Content-Type` | `application/ssml+xml` | Yes |
| `X-Microsoft-OutputFormat` | Audio format string | Yes |
| `User-Agent` | Application name (<255 chars) | Yes |

### Voice List Endpoint Headers

For `GET /cognitiveservices/voices/list` (voice enumeration):

| Header | Value | Required |
|--------|-------|----------|
| `Authorization` | `Bearer {token}` | Yes (or use `Ocp-Apim-Subscription-Key`) |
| `Ocp-Apim-Subscription-Key` | Your Speech resource key | Yes (or use `Authorization`) |

### Audio Output Formats

#### Streaming Formats
```
amr-wb-16000hz
audio-16khz-16bit-32kbps-mono-opus
audio-16khz-32kbitrate-mono-mp3
audio-16khz-64kbitrate-mono-mp3
audio-16khz-128kbitrate-mono-mp3
audio-24khz-16bit-24kbps-mono-opus
audio-24khz-16bit-48kbps-mono-opus
audio-24khz-48kbitrate-mono-mp3
audio-24khz-96kbitrate-mono-mp3
audio-24khz-160kbitrate-mono-mp3
audio-48khz-96kbitrate-mono-mp3
audio-48khz-192kbitrate-mono-mp3
ogg-16khz-16bit-mono-opus
ogg-24khz-16bit-mono-opus
ogg-48khz-16bit-mono-opus
raw-8khz-8bit-mono-alaw
raw-8khz-8bit-mono-mulaw
raw-8khz-16bit-mono-pcm
raw-16khz-16bit-mono-pcm
raw-16khz-16bit-mono-truesilk
raw-22050hz-16bit-mono-pcm
raw-24khz-16bit-mono-pcm
raw-24khz-16bit-mono-truesilk
raw-44100hz-16bit-mono-pcm
raw-48khz-16bit-mono-pcm
webm-16khz-16bit-mono-opus
webm-24khz-16bit-24kbps-mono-opus
webm-24khz-16bit-mono-opus
g722-16khz-64kbps
```

#### Non-Streaming Formats (RIFF/WAV)
```
riff-8khz-8bit-mono-alaw
riff-8khz-8bit-mono-mulaw
riff-8khz-16bit-mono-pcm
riff-22050hz-16bit-mono-pcm
riff-24khz-16bit-mono-pcm
riff-44100hz-16bit-mono-pcm
riff-48khz-16bit-mono-pcm
```

#### Recommended Formats by Use Case
| Use Case | Format | Notes |
|----------|--------|-------|
| Web streaming | `audio-24khz-48kbitrate-mono-mp3` | Good balance of quality/size |
| High quality | `audio-48khz-192kbitrate-mono-mp3` | Uses 48kHz HD voice model |
| Browser WebM | `webm-24khz-16bit-mono-opus` | Native browser support |
| Low bandwidth | `audio-16khz-32kbitrate-mono-mp3` | Smaller file size |
| Raw processing | `raw-24khz-16bit-mono-pcm` | No headers, for custom processing |

### HTTP Status Codes

| Code | Description | Possible Cause |
|------|-------------|----------------|
| 200 | OK | Success - audio in response body |
| 400 | Bad Request | Missing/invalid parameter, header too long |
| 401 | Unauthorized | Invalid key/token or wrong region |
| 415 | Unsupported Media Type | Wrong `Content-Type` (must be `application/ssml+xml`) |
| 429 | Too Many Requests | Rate limit exceeded |
| 502 | Bad Gateway | Network/server issue, possibly invalid headers |
| 503 | Service Unavailable | Server-side issue |

### Limits
- **Max audio duration**: 10 minutes (truncated if longer)
- **Max silence duration**: 20,000ms (20 seconds)

### Sample REST Request
```http
POST /cognitiveservices/v1 HTTP/1.1
Host: westus.tts.speech.microsoft.com
X-Microsoft-OutputFormat: audio-24khz-48kbitrate-mono-mp3
Content-Type: application/ssml+xml
Authorization: Bearer {token}
User-Agent: MyTTSApp

<speak version='1.0' xml:lang='en-US'>
  <voice name='en-US-AvaNeural'>
    Hello, this is a test.
  </voice>
</speak>
```

### Voice List Response Structure

The response is a **JSON array** of voice objects:

```json
[
  {
    "Name": "Microsoft Server Speech Text to Speech Voice (en-US, JennyNeural)",
    "DisplayName": "Jenny",
    "LocalName": "Jenny",
    "ShortName": "en-US-JennyNeural",
    "Gender": "Female",
    "Locale": "en-US",
    "LocaleName": "English (United States)",
    "StyleList": ["assistant", "chat", "cheerful", "sad"],
    "RolePlayList": ["Narrator", "YoungAdultMale"],
    "SampleRateHertz": "24000",
    "VoiceType": "Neural",
    "Status": "GA",
    "WordsPerMinute": "152",
    "ExtendedPropertyMap": {
      "IsHighQuality48K": "True"
    }
  },
  {
    "Name": "Microsoft Server Speech Text to Speech Voice (en-US, GuyNeural)",
    "DisplayName": "Guy",
    "ShortName": "en-US-GuyNeural",
    "Gender": "Male",
    "Locale": "en-US",
    "LocaleName": "English (United States)",
    "SampleRateHertz": "24000",
    "VoiceType": "Neural",
    "Status": "GA",
    "WordsPerMinute": "150"
  }
  // ... more voices
]
```

---

## 2. SSML (Speech Synthesis Markup Language)

### Document Structure

```xml
<speak version="1.0" 
       xmlns="http://www.w3.org/2001/10/synthesis" 
       xmlns:mstts="https://www.w3.org/2001/mstts" 
       xml:lang="en-US">
    
    <mstts:backgroundaudio src="string" volume="string" fadein="string" fadeout="string"/>
    
    <voice name="en-US-AvaNeural" effect="string">
        <!-- Content goes here -->
    </voice>
</speak>
```

### Required Root Attributes
| Attribute | Value | Required |
|-----------|-------|----------|
| `version` | `"1.0"` | Yes |
| `xmlns` | `"http://www.w3.org/2001/10/synthesis"` | Yes |
| `xml:lang` | Language code (e.g., `"en-US"`) | Yes |
| `xmlns:mstts` | `"https://www.w3.org/2001/mstts"` | For Microsoft extensions |

### Special Characters (Must Escape)
| Character | Entity |
|-----------|--------|
| `&` | `&amp;` |
| `<` | `&lt;` |
| `>` | `&gt;` |
| `"` | `&quot;` |
| `'` | `&apos;` |

### SSML Elements Reference

#### `<voice>` - Voice Selection
```xml
<voice name="en-US-AvaNeural">Text to speak</voice>
<voice name="en-US-Ava:DragonHDLatestNeural">HD voice</voice>
```

#### `<break>` - Pause/Break
```xml
<break />                        <!-- Default medium pause (750ms) -->
<break strength="weak" />        <!-- 500ms -->
<break strength="medium" />      <!-- 750ms (default) -->
<break strength="strong" />      <!-- 1000ms -->
<break strength="x-strong" />    <!-- 1250ms -->
<break time="500ms" />           <!-- Exact duration in ms -->
<break time="2s" />              <!-- Exact duration in seconds -->
```

**Break Strength Durations:**
| Strength | Duration |
|----------|----------|
| x-weak | 250ms |
| weak | 500ms |
| medium | 750ms |
| strong | 1000ms |
| x-strong | 1250ms |

#### `<mstts:silence>` - Silence Control
```xml
<mstts:silence type="Leading" value="200ms"/>
<mstts:silence type="Leading-exact" value="500ms"/>
<mstts:silence type="Tailing" value="200ms"/>
<mstts:silence type="Tailing-exact" value="500ms"/>
<mstts:silence type="Sentenceboundary" value="200ms"/>
<mstts:silence type="Sentenceboundary-exact" value="300ms"/>
<mstts:silence type="Comma-exact" value="50ms"/>
<mstts:silence type="Semicolon-exact" value="100ms"/>
<mstts:silence type="Enumerationcomma-exact" value="150ms"/>
```

**Silence Types:**
| Type | Description |
|------|-------------|
| `Leading` | Extra silence at beginning (added to natural) |
| `Leading-exact` | Absolute silence at beginning (replaces natural) |
| `Tailing` | Extra silence at end (added to natural) |
| `Tailing-exact` | Absolute silence at end (replaces natural) |
| `Sentenceboundary` | Extra silence between sentences |
| `Sentenceboundary-exact` | Absolute silence between sentences |
| `Comma-exact` | Silence at commas |
| `Semicolon-exact` | Silence at semicolons |
| `Enumerationcomma-exact` | Silence at enumeration commas (full-width) |

#### `<prosody>` - Pitch, Rate, Volume
```xml
<prosody rate="slow">Slower speech</prosody>
<prosody rate="fast">Faster speech</prosody>
<prosody rate="+20%">20% faster</prosody>
<prosody rate="-10%">10% slower</prosody>
<prosody pitch="high">Higher pitch</prosody>
<prosody pitch="+5%">Slightly higher</prosody>
<prosody volume="loud">Louder</prosody>
<prosody volume="soft">Softer</prosody>
<prosody volume="90">Volume 0-100</prosody>
<prosody pitch="high" rate="fast" volume="loud">Combined</prosody>
```

#### `<emphasis>` - Stress/Emphasis
```xml
<emphasis level="strong">Important</emphasis>
<emphasis level="moderate">Somewhat important</emphasis>
<emphasis level="reduced">Less important</emphasis>
```

#### `<mstts:express-as>` - Speaking Styles
```xml
<mstts:express-as style="cheerful">Happy text!</mstts:express-as>
<mstts:express-as style="sad">Sad text...</mstts:express-as>
<mstts:express-as style="angry">Angry text!</mstts:express-as>
<mstts:express-as style="chat">Casual conversation</mstts:express-as>
<mstts:express-as style="newscast">News anchor style</mstts:express-as>
<mstts:express-as style="customerservice">Service agent style</mstts:express-as>
<mstts:express-as style="cheerful" styledegree="2">More cheerful (0.01-2)</mstts:express-as>
<mstts:express-as style="narration-relaxed" role="YoungAdultMale">Role play</mstts:express-as>
```

**Common Styles (voice-dependent):**
- `assistant`, `chat`, `customerservice`, `newscast`
- `angry`, `cheerful`, `sad`, `excited`, `friendly`
- `terrified`, `shouting`, `unfriendly`, `whispering`, `hopeful`
- `narration-relaxed`, `embarrassed`, `fearful`, `disgruntled`, `serious`, `depressed`

#### `<p>` and `<s>` - Paragraphs and Sentences
```xml
<p>
  <s>First sentence.</s>
  <s>Second sentence.</s>
</p>
<p>
  Another paragraph with automatic sentence detection.
</p>
```

#### `<phoneme>` - Custom Pronunciation
```xml
<phoneme alphabet="ipa" ph="təˈmeɪtoʊ">tomato</phoneme>
<phoneme alphabet="x-microsoft-ups" ph="T AX M EY T OW">tomato</phoneme>
```

#### `<say-as>` - Content Type Interpretation
```xml
<say-as interpret-as="cardinal">12345</say-as>        <!-- "twelve thousand..." -->
<say-as interpret-as="ordinal">3</say-as>             <!-- "third" -->
<say-as interpret-as="characters">ABC</say-as>        <!-- "A B C" -->
<say-as interpret-as="spell-out">ABC</say-as>         <!-- "A B C" -->
<say-as interpret-as="date" format="mdy">12/25/2024</say-as>
<say-as interpret-as="time" format="hms12">3:45pm</say-as>
<say-as interpret-as="telephone">+1-555-123-4567</say-as>
<say-as interpret-as="address">123 Main St</say-as>
```

#### `<sub>` - Substitution
```xml
<sub alias="World Wide Web Consortium">W3C</sub>
```

#### `<bookmark>` - Event Markers
```xml
We are selling <bookmark mark='flower_1'/>roses and <bookmark mark='flower_2'/>daisies.
```

#### `<audio>` - Insert Audio
```xml
<audio src="https://example.com/sound.wav">
  Fallback text if audio fails
</audio>
```

#### `<lexicon>` - Custom Lexicon
```xml
<lexicon uri="https://example.com/lexicon.xml"/>
```

#### `<mstts:audioduration>` - Target Duration
```xml
<mstts:audioduration value="5s"/>
```

#### `<mstts:viseme>` - Lip Sync Data
```xml
<mstts:viseme type="redlips_front"/>
```

#### `<mstts:backgroundaudio>` - Background Audio
```xml
<mstts:backgroundaudio src="https://example.com/music.mp3" volume="0.5" fadein="2000" fadeout="2000"/>
```

### Element Nesting Rules

| Element | Can Contain |
|---------|-------------|
| `speak` | `mstts:backgroundaudio`, `voice` |
| `voice` | All elements except `mstts:backgroundaudio`, `speak` |
| `p` | Text, `audio`, `break`, `phoneme`, `prosody`, `say-as`, `sub`, `mstts:express-as`, `s` |
| `s` | Text, `audio`, `break`, `phoneme`, `prosody`, `say-as`, `mstts:express-as`, `sub` |
| `prosody` | Text, `audio`, `break`, `p`, `phoneme`, `prosody`, `say-as`, `sub`, `s` |
| `emphasis` | Text, `audio`, `break`, `emphasis`, `lang`, `phoneme`, `prosody`, `say-as`, `sub` |
| `mstts:express-as` | Text, `audio`, `break`, `emphasis`, `lang`, `phoneme`, `prosody`, `say-as`, `sub` |
| `phoneme` | Text only |
| `say-as` | Text only |
| `sub` | Text only |
| `bookmark` | Empty (no content) |
| `break` | Empty (no content) |
| `mstts:silence` | Empty (no content) |

---

## 3. Speech SDK (JavaScript)

### Installation
```bash
npm install microsoft-cognitiveservices-speech-sdk
```

### Browser Import
```javascript
import * as sdk from 'microsoft-cognitiveservices-speech-sdk';
```

### Basic Setup
```javascript
const speechConfig = sdk.SpeechConfig.fromSubscription(key, region);

// Set voice
speechConfig.speechSynthesisVoiceName = "en-US-AvaNeural";

// Set language (optional if voice is set)
speechConfig.speechSynthesisLanguage = "en-US";

// Set output format
speechConfig.setSpeechSynthesisOutputFormat(
  sdk.SpeechSynthesisOutputFormat.Audio24Khz48KBitRateMonoMp3
);
```

### Voice Priority Order
1. SSML `<voice name="...">` (highest priority)
2. `speechConfig.speechSynthesisVoiceName`
3. Default voice for `speechConfig.speechSynthesisLanguage`
4. Default voice for `en-US` (lowest priority)

### Synthesis Methods

#### To File
```javascript
const audioConfig = sdk.AudioConfig.fromAudioFileOutput("output.wav");
const synthesizer = new sdk.SpeechSynthesizer(speechConfig, audioConfig);
await synthesizer.speakTextAsync("Hello world");
```

#### To Speaker
```javascript
const synthesizer = new sdk.SpeechSynthesizer(speechConfig);
await synthesizer.speakTextAsync("Hello world");
```

#### To Memory Stream (No Output Device)

**Note:** `speakTextAsync` and `speakSsmlAsync` are **callback-based**, not Promise-based. Wrap them for async/await:

```javascript
// Helper to promisify the callback-based API
function speakTextAsyncP(synthesizer, text) {
  return new Promise((resolve, reject) => {
    synthesizer.speakTextAsync(text, resolve, reject);
  });
}

function speakSsmlAsyncP(synthesizer, ssml) {
  return new Promise((resolve, reject) => {
    synthesizer.speakSsmlAsync(ssml, resolve, reject);
  });
}

// Usage
const synthesizer = new sdk.SpeechSynthesizer(speechConfig, null);
const result = await speakTextAsyncP(synthesizer, "Hello world");
// result.audioData is an ArrayBuffer
```

#### With SSML
```javascript
const ssml = `<speak version='1.0' xml:lang='en-US'>
  <voice name='en-US-AvaNeural'>Hello world</voice>
</speak>`;
const result = await speakSsmlAsyncP(synthesizer, ssml);
```

### Synthesizer Events

| Event | Description | Use Case |
|-------|-------------|----------|
| `synthesisStarted` | Synthesis began | Progress indicator |
| `synthesizing` | Audio chunk received (fires multiple times) | Streaming playback |
| `synthesisCompleted` | Synthesis finished successfully | Cleanup, next action |
| `SynthesisCanceled` | Synthesis was canceled/failed (note: capital S) | Error handling |
| `wordBoundary` | Word/punctuation/sentence boundary | Highlighting, timing |
| `bookmarkReached` | SSML `<bookmark>` reached | Custom sync points |
| `visemeReceived` | Lip-sync viseme data | Animation |

### Event Subscription Example
```javascript
const synthesizer = new sdk.SpeechSynthesizer(speechConfig, null);

// Enable sentence boundaries
speechConfig.setProperty(
  "SpeechServiceResponse_RequestSentenceBoundary",
  "true"
);

synthesizer.synthesisStarted = (s, e) => {
  console.log("Synthesis started");
};

synthesizer.synthesizing = (s, e) => {
  console.log(`Received ${e.result.audioData.byteLength} bytes`);
};

synthesizer.synthesisCompleted = (s, e) => {
  console.log(`Completed: ${e.result.audioData.byteLength} total bytes`);
  console.log(`Duration: ${e.result.audioDuration}`);
};

// Note: Capital S in SynthesisCanceled
synthesizer.SynthesisCanceled = (s, e) => {
  console.error(`Canceled: ${e.errorDetails}`);
};

synthesizer.wordBoundary = (s, e) => {
  console.log(`Word: "${e.text}" at ${e.audioOffset / 10000}ms`);
  console.log(`Type: ${e.boundaryType}`); // Word, Punctuation, or Sentence
  console.log(`Text offset: ${e.textOffset}, length: ${e.wordLength}`);
};

synthesizer.bookmarkReached = (s, e) => {
  console.log(`Bookmark "${e.text}" at ${e.audioOffset / 10000}ms`);
};

synthesizer.visemeReceived = (s, e) => {
  console.log(`Viseme ${e.visemeId} at ${e.audioOffset / 10000}ms`);
};

// Use callback-based API or promisified wrapper
synthesizer.speakSsmlAsync(
  ssml,
  (result) => console.log('Success:', result.reason),
  (error) => console.error('Error:', error)
);
```

### SpeechSynthesisOutputFormat Enum (Common Values)
```javascript
sdk.SpeechSynthesisOutputFormat.Riff16Khz16BitMonoPcm
sdk.SpeechSynthesisOutputFormat.Riff24Khz16BitMonoPcm
sdk.SpeechSynthesisOutputFormat.Riff48Khz16BitMonoPcm
sdk.SpeechSynthesisOutputFormat.Audio16Khz32KBitRateMonoMp3
sdk.SpeechSynthesisOutputFormat.Audio24Khz48KBitRateMonoMp3
sdk.SpeechSynthesisOutputFormat.Audio24Khz96KBitRateMonoMp3
sdk.SpeechSynthesisOutputFormat.Audio48Khz192KBitRateMonoMp3
sdk.SpeechSynthesisOutputFormat.Raw24Khz16BitMonoPcm
sdk.SpeechSynthesisOutputFormat.Ogg24Khz16BitMonoOpus
sdk.SpeechSynthesisOutputFormat.Webm24Khz16BitMonoOpus
```

### Result Handling

**Note:** Use callback-based API or promisified wrapper (see above).

```javascript
synthesizer.speakTextAsync(
  text,
  (result) => {
    switch (result.reason) {
      case sdk.ResultReason.SynthesizingAudioCompleted:
        // Success - result.audioData contains the audio
        const audioBlob = new Blob([result.audioData], { type: 'audio/mp3' });
        playAudio(audioBlob);
        break;
        
      case sdk.ResultReason.Canceled:
        const cancellation = sdk.CancellationDetails.fromResult(result);
        console.error(`Canceled: ${cancellation.reason}`);
        if (cancellation.reason === sdk.CancellationReason.Error) {
          console.error(`Error: ${cancellation.errorCode} - ${cancellation.errorDetails}`);
        }
        break;
    }
    // Always close the synthesizer
    synthesizer.close();
  },
  (error) => {
    console.error(`Synthesis error: ${error}`);
    synthesizer.close();
  }
);
```

### Streaming Large Audio

**Note:** `AudioDataStream` is **not exported** in the current JS SDK. For large audio handling, use:

1. **Stream chunks via `synthesizing` event:**
```javascript
const chunks = [];
synthesizer.synthesizing = (s, e) => {
  chunks.push(e.result.audioData);
};

synthesizer.synthesisCompleted = (s, e) => {
  // Concatenate all chunks
  const totalLength = chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0);
  const combined = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    combined.set(new Uint8Array(chunk), offset);
    offset += chunk.byteLength;
  }
  // combined.buffer is the full audio
};
```

2. **Use PushAudioOutputStreamCallback (see Section 8)** for custom streaming output.

---

## 4. Complete Examples

### REST API Example (fetch)
```javascript
async function synthesizeSpeech(text, voice = 'en-US-AvaNeural') {
  const region = 'eastus';
  const apiKey = process.env.AZURE_SPEECH_KEY;
  
  const ssml = `<speak version='1.0' xml:lang='en-US'>
    <voice name='${voice}'>${escapeXml(text)}</voice>
  </speak>`;
  
  const response = await fetch(
    `https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`,
    {
      method: 'POST',
      headers: {
        'Ocp-Apim-Subscription-Key': apiKey,
        'Content-Type': 'application/ssml+xml',
        'X-Microsoft-OutputFormat': 'audio-24khz-48kbitrate-mono-mp3',
        'User-Agent': 'MyTTSApp'
      },
      body: ssml
    }
  );
  
  if (!response.ok) {
    throw new Error(`TTS failed: ${response.status}`);
  }
  
  return response.arrayBuffer();
}

function escapeXml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
```

### SSML with Emotional Style
```xml
<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" 
       xmlns:mstts="https://www.w3.org/2001/mstts" xml:lang="en-US">
  <voice name="en-US-JennyNeural">
    <mstts:express-as style="cheerful" styledegree="1.5">
      Welcome to our tarot reading! I'm so excited to guide you today.
    </mstts:express-as>
    <break time="500ms"/>
    <mstts:express-as style="calm">
      Let's take a deep breath and focus on your question.
    </mstts:express-as>
  </voice>
</speak>
```

### SSML with Bookmarks for Sync
```xml
<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="en-US">
  <voice name="en-US-AvaNeural">
    <bookmark mark="card_1"/>The first card represents your past.
    <break time="300ms"/>
    <bookmark mark="card_2"/>The second card shows your present situation.
    <break time="300ms"/>
    <bookmark mark="card_3"/>The third card reveals potential futures.
  </voice>
</speak>
```

### SDK Streaming Example (Browser)
```javascript
function streamTTS(text) {
  const speechConfig = sdk.SpeechConfig.fromSubscription(key, region);
  speechConfig.speechSynthesisVoiceName = "en-US-AvaNeural";
  // Use MP3 for best browser support
  speechConfig.speechSynthesisOutputFormat = 
    sdk.SpeechSynthesisOutputFormat.Audio24Khz48KBitRateMonoMp3;
  
  const synthesizer = new sdk.SpeechSynthesizer(speechConfig, null);
  const audioContext = new AudioContext();
  const chunks = [];
  
  synthesizer.synthesizing = (s, e) => {
    chunks.push(new Uint8Array(e.result.audioData));
  };
  
  synthesizer.synthesisCompleted = async (s, e) => {
    // Concatenate chunks
    const totalLength = chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0);
    const combined = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of chunks) {
      combined.set(chunk, offset);
      offset += chunk.byteLength;
    }
    
    // Decode and play
    const audioBuffer = await audioContext.decodeAudioData(combined.buffer);
    const source = audioContext.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(audioContext.destination);
    source.start();
    synthesizer.close();
  };
  
  // Callback-based API (does not return a Promise)
  synthesizer.speakTextAsync(
    text,
    (result) => { /* handled by synthesisCompleted event */ },
    (error) => console.error('Synthesis error:', error)
  );
}
```

---

## 5. Quick Reference

### Voice Naming Patterns
- Standard: `{locale}-{Name}Neural` (e.g., `en-US-AvaNeural`)
- HD/Dragon: `{locale}-{Name}:DragonHDLatestNeural` (e.g., `en-US-Ava:DragonHDLatestNeural`)
- Multilingual: `{locale}-{Name}MultilingualNeural` (e.g., `en-US-JennyMultilingualNeural`)

### Popular Voices
| Voice | Gender | Notable Styles |
|-------|--------|----------------|
| `en-US-AvaNeural` | Female | General purpose |
| `en-US-JennyNeural` | Female | assistant, chat, cheerful, sad, newscast |
| `en-US-GuyNeural` | Male | newscast |
| `en-US-AriaNeural` | Female | chat, cheerful, customerservice |
| `en-US-DavisNeural` | Male | chat, angry, cheerful |
| `en-US-JaneNeural` | Female | angry, cheerful, sad |

### Timing Quick Reference
| Element | Min | Max | Default |
|---------|-----|-----|---------|
| `<break time="">` | 0ms | 20000ms | 750ms (medium) |
| `<mstts:silence value="">` | 0ms | 20000ms | - |
| Audio output | - | 10 minutes | - |

---

## 6. JavaScript SDK API Reference

### Key Classes

| Class | Purpose |
|-------|---------|
| `SpeechConfig` | Configuration for speech services (key, region, voice, format) |
| `SpeechSynthesizer` | Main TTS class - synthesizes text/SSML to audio |
| `AudioConfig` | Configures audio output (file, speaker, stream) |
| `AudioOutputStream` | Custom audio output stream |
| `AudioDataStream` | Stream for reading synthesis results |
| `SpeechSynthesisResult` | Contains synthesis result (audio data, reason, duration) |
| `VoiceInfo` | Information about a synthesis voice |
| `SynthesisVoicesResult` | Result from `getVoicesAsync()` |

### SpeechConfig

#### Static Factory Methods
```javascript
// From subscription key + region
SpeechConfig.fromSubscription(subscriptionKey: string, region: string): SpeechConfig

// From authorization token + region
SpeechConfig.fromAuthorizationToken(authorizationToken: string, region: string): SpeechConfig

// From custom endpoint
SpeechConfig.fromEndpoint(endpoint: URL, subscriptionKey?: string): SpeechConfig

// From custom host
SpeechConfig.fromHost(hostName: URL, subscriptionKey?: string): SpeechConfig
```

#### TTS Properties
```javascript
// Voice name (e.g., "en-US-AvaNeural")
speechConfig.speechSynthesisVoiceName: string

// Language (e.g., "en-US") - used if voice not specified
speechConfig.speechSynthesisLanguage: string

// Output format
speechConfig.speechSynthesisOutputFormat: SpeechSynthesisOutputFormat

// Authorization token (for token-based auth)
speechConfig.authorizationToken: string

// Region
speechConfig.region: string (readonly)

// Subscription key
speechConfig.subscriptionKey: string (readonly)
```

#### Methods
```javascript
// Get/set arbitrary properties
speechConfig.getProperty(name: string, def?: string): string
speechConfig.setProperty(name: string | PropertyId, value: string): void

// Set service property (sent via URI query)
speechConfig.setServiceProperty(name: string, value: string, channel: UriQueryParameter): void

// Proxy (Node.js only)
speechConfig.setProxy(proxyHostName: string, proxyPort: number): void
speechConfig.setProxy(proxyHostName: string, proxyPort: number, proxyUserName: string, proxyPassword: string): void

// Cleanup
speechConfig.close(): void
```

### SpeechSynthesizer

#### Constructor
```javascript
// With audio output configuration
new SpeechSynthesizer(speechConfig: SpeechConfig, audioConfig?: AudioConfig | null)

// With auto-detect language
SpeechSynthesizer.FromConfig(
  speechConfig: SpeechConfig, 
  autoDetectSourceLanguageConfig: AutoDetectSourceLanguageConfig, 
  audioConfig?: AudioConfig | null
): SpeechSynthesizer
```

#### Synthesis Methods
```javascript
// Synthesize plain text
speakTextAsync(
  text: string, 
  cb?: (e: SpeechSynthesisResult) => void, 
  err?: (e: string) => void, 
  stream?: PathLike | AudioOutputStream | PushAudioOutputStreamCallback
): void

// Synthesize SSML
speakSsmlAsync(
  ssml: string, 
  cb?: (e: SpeechSynthesisResult) => void, 
  err?: (e: string) => void, 
  stream?: PathLike | AudioOutputStream | PushAudioOutputStreamCallback
): void

// Get available voices
getVoicesAsync(locale?: string): Promise<SynthesisVoicesResult>

// Build SSML from plain text (inherited)
buildSsml(text: string): string
```

#### Events
```javascript
// Synthesis lifecycle
synthesizer.synthesisStarted: (sender: SpeechSynthesizer, event: SpeechSynthesisEventArgs) => void
synthesizer.synthesizing: (sender: SpeechSynthesizer, event: SpeechSynthesisEventArgs) => void
synthesizer.synthesisCompleted: (sender: SpeechSynthesizer, event: SpeechSynthesisEventArgs) => void
synthesizer.SynthesisCanceled: (sender: SpeechSynthesizer, event: SpeechSynthesisEventArgs) => void

// Word/sentence boundaries
synthesizer.wordBoundary: (sender: SpeechSynthesizer, event: SpeechSynthesisWordBoundaryEventArgs) => void

// SSML bookmarks
synthesizer.bookmarkReached: (sender: SpeechSynthesizer, event: SpeechSynthesisBookmarkEventArgs) => void

// Lip-sync visemes
synthesizer.visemeReceived: (sender: SpeechSynthesizer, event: SpeechSynthesisVisemeEventArgs) => void
```

#### Properties
```javascript
synthesizer.properties: PropertyCollection      // All properties
synthesizer.authorizationToken: string          // Auth token
synthesizer.autoDetectSourceLanguage: boolean   // Auto-detect enabled
synthesizer.internalData: object                // Internal data
```

#### Cleanup
```javascript
synthesizer.close(cb?: () => void, err?: (error: string) => void): void
synthesizer.dispose(disposing: boolean): Promise<void>
```

### SpeechSynthesisResult

```javascript
interface SpeechSynthesisResult {
  audioData: ArrayBuffer;           // The synthesized audio bytes
  audioDuration: number;            // Duration in 100-nanosecond units
  errorDetails: string;             // Error details if failed
  properties: PropertyCollection;   // Additional properties
  reason: ResultReason;             // Success/canceled/error
  resultId: string;                 // Unique result ID
}
```

### SpeechSynthesisWordBoundaryEventArgs

```javascript
interface SpeechSynthesisWordBoundaryEventArgs {
  audioOffset: number;              // Offset in audio (100-nanosecond units)
  duration: number;                 // Duration (100-nanosecond units)
  text: string;                     // The word/punctuation text
  textOffset: number;               // Character offset in input text
  wordLength: number;               // Length of word in characters
  boundaryType: SpeechSynthesisBoundaryType;  // Word, Punctuation, or Sentence
}
```

### SpeechSynthesisBookmarkEventArgs

```javascript
interface SpeechSynthesisBookmarkEventArgs {
  audioOffset: number;              // Offset in audio (100-nanosecond units)
  text: string;                     // The bookmark mark attribute value
}
```

### SpeechSynthesisVisemeEventArgs

```javascript
interface SpeechSynthesisVisemeEventArgs {
  audioOffset: number;              // Offset in audio (100-nanosecond units)
  visemeId: number;                 // Viseme ID (0-21 for standard visemes)
  animation: string;                // Animation data (if requested)
}
```

### AudioConfig

```javascript
// Output to file
AudioConfig.fromAudioFileOutput(filename: PathLike): AudioConfig

// Output to default speaker
AudioConfig.fromDefaultSpeakerOutput(): AudioConfig

// Output to custom stream
AudioConfig.fromStreamOutput(stream: AudioOutputStream | PushAudioOutputStreamCallback): AudioConfig

// Output to speaker destination (browser)
AudioConfig.fromSpeakerOutput(destination?: SpeakerAudioDestination): AudioConfig
```

### AudioDataStream

```javascript
// Create from synthesis result
AudioDataStream.fromResult(result: SpeechSynthesisResult): AudioDataStream

// Read audio data
stream.read(dataBuffer: ArrayBuffer): number

// Save to WAV file (Node.js)
stream.saveToWaveFile(filename: string): Promise<void>

// Properties
stream.canReadData: boolean
stream.isClosed: boolean
stream.position: number
```

### ResultReason Enum

```javascript
sdk.ResultReason.SynthesizingAudio          // Intermediate result during synthesis
sdk.ResultReason.SynthesizingAudioCompleted // Synthesis completed successfully
sdk.ResultReason.SynthesizingAudioStarted   // Synthesis started
sdk.ResultReason.Canceled                   // Synthesis was canceled
```

### CancellationReason Enum

```javascript
sdk.CancellationReason.Error           // Error occurred
sdk.CancellationReason.EndOfStream     // End of input stream
sdk.CancellationReason.CancelledByUser // User cancelled
```

### SpeechSynthesisOutputFormat Enum

```javascript
// WAV formats
sdk.SpeechSynthesisOutputFormat.Riff8Khz8BitMonoMULaw
sdk.SpeechSynthesisOutputFormat.Riff8Khz16BitMonoPcm
sdk.SpeechSynthesisOutputFormat.Riff16Khz16BitMonoPcm
sdk.SpeechSynthesisOutputFormat.Riff22050Hz16BitMonoPcm
sdk.SpeechSynthesisOutputFormat.Riff24Khz16BitMonoPcm
sdk.SpeechSynthesisOutputFormat.Riff44100Hz16BitMonoPcm
sdk.SpeechSynthesisOutputFormat.Riff48Khz16BitMonoPcm

// MP3 formats
sdk.SpeechSynthesisOutputFormat.Audio16Khz32KBitRateMonoMp3
sdk.SpeechSynthesisOutputFormat.Audio16Khz64KBitRateMonoMp3
sdk.SpeechSynthesisOutputFormat.Audio16Khz128KBitRateMonoMp3
sdk.SpeechSynthesisOutputFormat.Audio24Khz48KBitRateMonoMp3
sdk.SpeechSynthesisOutputFormat.Audio24Khz96KBitRateMonoMp3
sdk.SpeechSynthesisOutputFormat.Audio24Khz160KBitRateMonoMp3
sdk.SpeechSynthesisOutputFormat.Audio48Khz96KBitRateMonoMp3
sdk.SpeechSynthesisOutputFormat.Audio48Khz192KBitRateMonoMp3

// Opus formats
sdk.SpeechSynthesisOutputFormat.Ogg16Khz16BitMonoOpus
sdk.SpeechSynthesisOutputFormat.Ogg24Khz16BitMonoOpus
sdk.SpeechSynthesisOutputFormat.Ogg48Khz16BitMonoOpus
sdk.SpeechSynthesisOutputFormat.Webm16Khz16BitMonoOpus
sdk.SpeechSynthesisOutputFormat.Webm24Khz16BitMonoOpus
sdk.SpeechSynthesisOutputFormat.Webm24Khz16Bit24KbpsMonoOpus

// Raw PCM formats
sdk.SpeechSynthesisOutputFormat.Raw8Khz8BitMonoALaw
sdk.SpeechSynthesisOutputFormat.Raw8Khz8BitMonoMULaw
sdk.SpeechSynthesisOutputFormat.Raw8Khz16BitMonoPcm
sdk.SpeechSynthesisOutputFormat.Raw16Khz16BitMonoPcm
sdk.SpeechSynthesisOutputFormat.Raw16Khz16BitMonoTrueSilk
sdk.SpeechSynthesisOutputFormat.Raw22050Hz16BitMonoPcm
sdk.SpeechSynthesisOutputFormat.Raw24Khz16BitMonoPcm
sdk.SpeechSynthesisOutputFormat.Raw24Khz16BitMonoTrueSilk
sdk.SpeechSynthesisOutputFormat.Raw44100Hz16BitMonoPcm
sdk.SpeechSynthesisOutputFormat.Raw48Khz16BitMonoPcm
```

### SpeechSynthesisBoundaryType Enum

```javascript
sdk.SpeechSynthesisBoundaryType.Word        // Word boundary
sdk.SpeechSynthesisBoundaryType.Punctuation // Punctuation boundary
sdk.SpeechSynthesisBoundaryType.Sentence    // Sentence boundary
```

### PropertyId Enum (TTS-relevant)

```javascript
sdk.PropertyId.SpeechServiceConnection_SynthLanguage      // Synthesis language
sdk.PropertyId.SpeechServiceConnection_SynthVoice         // Voice name
sdk.PropertyId.SpeechServiceConnection_SynthOutputFormat  // Output format
sdk.PropertyId.SpeechServiceResponse_RequestSentenceBoundary  // Enable sentence events
```

### VoiceInfo

```javascript
interface VoiceInfo {
  name: string;              // Full voice name
  shortName: string;         // Short name (e.g., "en-US-AvaNeural")
  locale: string;            // Locale (e.g., "en-US")
  localeName: string;        // Locale display name
  displayName: string;       // Voice display name
  localDisplayName: string;  // Local display name
  gender: SynthesisVoiceGender;  // Male/Female/Unknown
  voiceType: SynthesisVoiceType; // Neural/Standard
  styleList: string[];       // Available styles
  wordsPerMinute: string;    // Estimated WPM
  voicePath: string;         // Path for custom voices
}
```

---

## 7. Common Patterns

### Token-Based Authentication
```javascript
// Get token from your backend
const token = await fetchTokenFromBackend();

// Use token instead of key
const speechConfig = sdk.SpeechConfig.fromAuthorizationToken(token, region);
// Token expires in 10 minutes - recommended to reuse for ~9 minutes then refresh
```

### Word-by-Word Highlighting
```javascript
const words = [];
synthesizer.wordBoundary = (s, e) => {
  if (e.boundaryType === sdk.SpeechSynthesisBoundaryType.Word) {
    words.push({
      text: e.text,
      startTime: e.audioOffset / 10000,  // Convert to ms
      duration: e.duration / 10000,
      textOffset: e.textOffset
    });
  }
};
```

### Chunked Streaming Playback
```javascript
const audioContext = new AudioContext();
let audioBuffer = new ArrayBuffer(0);

synthesizer.synthesizing = (s, e) => {
  // Append new chunk
  const newBuffer = new ArrayBuffer(audioBuffer.byteLength + e.result.audioData.byteLength);
  const view = new Uint8Array(newBuffer);
  view.set(new Uint8Array(audioBuffer), 0);
  view.set(new Uint8Array(e.result.audioData), audioBuffer.byteLength);
  audioBuffer = newBuffer;
};

synthesizer.synthesisCompleted = async (s, e) => {
  const decoded = await audioContext.decodeAudioData(audioBuffer);
  const source = audioContext.createBufferSource();
  source.buffer = decoded;
  source.connect(audioContext.destination);
  source.start();
};
```

### Error Handling Pattern
```javascript
synthesizer.speakTextAsync(
  text,
  (result) => {
    if (result.reason === sdk.ResultReason.SynthesizingAudioCompleted) {
      // Success
      playAudio(result.audioData);
    } else if (result.reason === sdk.ResultReason.Canceled) {
      const details = sdk.CancellationDetails.fromResult(result);
      if (details.reason === sdk.CancellationReason.Error) {
        console.error(`Error: ${details.errorCode} - ${details.errorDetails}`);
      }
    }
    synthesizer.close();
  },
  (error) => {
    console.error(`Synthesis error: ${error}`);
    synthesizer.close();
  }
);
```

### Browser Playback with SpeakerAudioDestination
```javascript
const player = new sdk.SpeakerAudioDestination();
player.onAudioEnd = () => console.log("Playback finished");

const audioConfig = sdk.AudioConfig.fromSpeakerOutput(player);
const synthesizer = new sdk.SpeechSynthesizer(speechConfig, audioConfig);

// Callback-based (audio plays automatically through browser)
synthesizer.speakTextAsync(
  text,
  (result) => console.log('Synthesis complete'),
  (error) => console.error('Error:', error)
);
```

---

## 8. Custom Audio Streams (Advanced)

### PullAudioOutputStream

Use when your code wants to **pull bytes on-demand** from an internal buffer—handy for bridging into Node streams, Web `ReadableStream`, buffering, or "give me the audio when I ask for it".

- Memory-backed; you call `read(ArrayBuffer)` repeatedly
- Wire it into synthesis via `AudioConfig.fromStreamOutput(...)`

```javascript
const pullStream = sdk.PullAudioOutputStream.create();
const audioConfig = sdk.AudioConfig.fromStreamOutput(pullStream);
const synthesizer = new sdk.SpeechSynthesizer(speechConfig, audioConfig);

// Start synthesis (callback-based)
synthesizer.speakTextAsync(
  text,
  async (result) => {
    // Pull audio chunks after synthesis
    const buf = new ArrayBuffer(4096);
    let n = await pullStream.read(buf);
    while (n > 0) {
      processChunk(buf.slice(0, n));
      n = await pullStream.read(buf);
    }
    pullStream.close();
    synthesizer.close();
  },
  (error) => console.error('Error:', error)
);
```

### PushAudioOutputStream + PushAudioOutputStreamCallback

Use when the SDK **pushes audio chunks to you** as they're produced (streaming scenarios: forward chunks over WebSocket, write to a file, pipe into a media pipeline).

Options:
1. Implement `PushAudioOutputStreamCallback` (defines `write()` / `close()`)
2. Create a `PushAudioOutputStream` that delegates to it
3. Or pass the callback directly to `AudioConfig.fromStreamOutput(...)` (accepts `AudioOutputStream | PushAudioOutputStreamCallback`)

```javascript
class MyOutputStream extends sdk.PushAudioOutputStreamCallback {
  write(data) {
    // Send/store chunk; return bytes consumed
    sendToWebSocket(data);
    return data.byteLength;
  }
  close() {
    // Finalize stream
    closeWebSocket();
  }
}

const audioConfig = sdk.AudioConfig.fromStreamOutput(new MyOutputStream());
const synthesizer = new sdk.SpeechSynthesizer(speechConfig, audioConfig);

// Callback-based; chunks are pushed to MyOutputStream.write() as generated
synthesizer.speakTextAsync(
  text,
  (result) => synthesizer.close(),
  (error) => console.error('Error:', error)
);
```

### Node.js Stream Integration Example
```javascript
const { PassThrough } = require('stream');

class NodeStreamOutput extends sdk.PushAudioOutputStreamCallback {
  constructor() {
    super();
    this.stream = new PassThrough();
  }
  write(data) {
    this.stream.write(Buffer.from(data));
    return data.byteLength;
  }
  close() {
    this.stream.end();
  }
}

const output = new NodeStreamOutput();
const audioConfig = sdk.AudioConfig.fromStreamOutput(output);
const synthesizer = new sdk.SpeechSynthesizer(speechConfig, audioConfig);

// Pipe to file or HTTP response
output.stream.pipe(fs.createWriteStream('output.mp3'));

// Callback-based
synthesizer.speakTextAsync(
  text,
  (result) => synthesizer.close(),
  (error) => console.error('Error:', error)
);
```

---

## 9. CancellationDetails & Error Codes

### CancellationDetails

When recognition/synthesis is canceled, use `CancellationDetails` to understand why:

```javascript
if (result.reason === sdk.ResultReason.Canceled) {
  const details = sdk.CancellationDetails.fromResult(result);
  console.log('Reason:', details.reason);           // CancellationReason enum
  console.log('Error Code:', details.errorCode);    // CancellationErrorCode enum
  console.log('Error Details:', details.errorDetails); // String description
}
```

### CancellationErrorCode Enum

```javascript
sdk.CancellationErrorCode.NoError              // No error
sdk.CancellationErrorCode.AuthenticationFailure // Invalid key/token or wrong region
sdk.CancellationErrorCode.BadRequest           // Malformed request
sdk.CancellationErrorCode.TooManyRequests      // Rate limit exceeded (429)
sdk.CancellationErrorCode.Forbidden            // Quota exceeded or resource disabled
sdk.CancellationErrorCode.ConnectionFailure    // Network/connection issue
sdk.CancellationErrorCode.ServiceTimeout       // Service didn't respond in time
sdk.CancellationErrorCode.ServiceError         // Server-side error (500/502/503)
sdk.CancellationErrorCode.ServiceUnavailable   // Service temporarily unavailable
sdk.CancellationErrorCode.RuntimeError         // SDK runtime error
```

### Error Handling Best Practices
```javascript
function handleSynthesisResult(result) {
  if (result.reason === sdk.ResultReason.SynthesizingAudioCompleted) {
    return { success: true, audio: result.audioData };
  }
  
  if (result.reason === sdk.ResultReason.Canceled) {
    const details = sdk.CancellationDetails.fromResult(result);
    
    switch (details.errorCode) {
      case sdk.CancellationErrorCode.AuthenticationFailure:
        return { success: false, error: 'auth', message: 'Invalid credentials' };
      
      case sdk.CancellationErrorCode.TooManyRequests:
        return { success: false, error: 'rate_limit', message: 'Rate limited, retry later' };
      
      case sdk.CancellationErrorCode.ServiceTimeout:
      case sdk.CancellationErrorCode.ServiceError:
      case sdk.CancellationErrorCode.ServiceUnavailable:
        return { success: false, error: 'service', message: 'Service unavailable, retry' };
      
      default:
        return { success: false, error: 'unknown', message: details.errorDetails };
    }
  }
  
  return { success: false, error: 'unexpected', message: 'Unexpected result' };
}
```

---

## 10. SynthesisVoicesResult (Voice Listing)

### Getting Available Voices

```javascript
const synthesizer = new sdk.SpeechSynthesizer(speechConfig);

// Get all voices
const allVoices = await synthesizer.getVoicesAsync();

// Get voices for specific locale
const enVoices = await synthesizer.getVoicesAsync("en-US");

if (enVoices.reason === sdk.ResultReason.VoicesListRetrieved) {
  enVoices.voices.forEach(voice => {
    console.log(`${voice.shortName} (${voice.gender}) - ${voice.localeName}`);
    if (voice.styleList?.length) {
      console.log(`  Styles: ${voice.styleList.join(', ')}`);
    }
  });
} else {
  console.error('Failed to get voices:', enVoices.errorDetails);
}

synthesizer.close();
```

### SynthesisVoicesResult Interface
```javascript
interface SynthesisVoicesResult {
  voices: VoiceInfo[];          // Array of available voices
  reason: ResultReason;         // VoicesListRetrieved or Canceled
  resultId: string;             // Unique result ID
  errorDetails: string;         // Error message if failed
  properties: PropertyCollection;
}
```

### Filtering Voices
```javascript
const result = await synthesizer.getVoicesAsync();

// Filter by gender
const femaleVoices = result.voices.filter(v => 
  v.gender === sdk.SynthesisVoiceGender.Female
);

// Filter by style support
const expressiveVoices = result.voices.filter(v => 
  v.styleList?.includes('cheerful')
);

// Filter neural voices only
const neuralVoices = result.voices.filter(v => 
  v.voiceType === sdk.SynthesisVoiceType.OnlineNeural
);

// Find HD voices
const hdVoices = result.voices.filter(v => 
  v.shortName.includes(':DragonHD')
);
```

---

## 11. SpeakerAudioDestination (Browser Playback Controls)

For browser playback with full control (pause, resume, volume), use `SpeakerAudioDestination` as your audio player.

- Browser-only (uses Media Source Extensions under the hood)
- Supports pause/resume/mute/unmute and volume control
- Wire via `AudioConfig.fromSpeakerOutput(player)`

### Full Browser Playback Example
```javascript
// Create player with controls
const player = new sdk.SpeakerAudioDestination();

// Volume control (0.0 to 1.0)
player.volume = 0.8;

// Event handlers
player.onAudioStart = () => {
  console.log('Playback started');
  updateUI('playing');
};

player.onAudioEnd = () => {
  console.log('Playback finished');
  updateUI('stopped');
};

// Create synthesizer with player
const audioConfig = sdk.AudioConfig.fromSpeakerOutput(player);
const synthesizer = new sdk.SpeechSynthesizer(speechConfig, audioConfig);

// Start synthesis (callback-based; audio plays automatically)
synthesizer.speakTextAsync(
  text,
  (result) => console.log('Synthesis complete'),
  (error) => console.error('Error:', error)
);

// Playback controls (call these from UI buttons)
function pausePlayback() {
  player.pause();
}

function resumePlayback() {
  player.resume();
}

function mutePlayback() {
  player.mute();
}

function unmutePlayback() {
  player.unmute();
}

function setVolume(level) {
  player.volume = level; // 0.0 to 1.0
}

// Cleanup
function stopAndCleanup() {
  player.close();
  synthesizer.close();
}
```

### SpeakerAudioDestination Properties & Methods
```javascript
interface SpeakerAudioDestination {
  // Properties
  volume: number;              // 0.0 to 1.0
  isClosed: boolean;
  
  // Methods
  pause(): void;               // Pause playback
  resume(): void;              // Resume playback
  mute(): void;                // Mute audio
  unmute(): void;              // Unmute audio
  close(): void;               // Close and release resources
  
  // Events
  onAudioStart: () => void;    // Fired when playback starts
  onAudioEnd: () => void;      // Fired when playback ends
}
```

### Note on MP3 Format
The SDK recommends MP3 format for browser playback as it has better support across Microsoft Edge, Chrome, and Safari (desktop):

```javascript
speechConfig.speechSynthesisOutputFormat = 
  sdk.SpeechSynthesisOutputFormat.Audio24Khz48KBitRateMonoMp3;
```

---

## 12. Avatar Synthesis (Talking Avatar)

For video avatar synthesis (animated talking head with lip-sync).

### AvatarConfig
```javascript
interface AvatarConfig {
  character: string;           // Avatar character ID
  style: string;               // Avatar style
  videoFormat: AvatarVideoFormat;
  backgroundColor: string;     // Background color (e.g., "#00FF00FF" for green screen)
  backgroundImage: URL;        // Or background image URL
  customized: boolean;         // Whether using custom avatar
}
```

### AvatarVideoFormat
```javascript
interface AvatarVideoFormat {
  codec: AvatarVideoCodec;     // H264, HEVC, VP9, etc.
  bitrate: number;             // Video bitrate
  width: number;               // Video width
  height: number;              // Video height
}
```

### Basic Avatar Synthesis (WebRTC Real-time)
```javascript
const avatarConfig = new sdk.AvatarConfig(
  "lisa",                      // character
  "casual-sitting",            // style
  new sdk.AvatarVideoFormat()
);
avatarConfig.backgroundColor = "#00FF00FF"; // Green screen

const avatarSynthesizer = new sdk.AvatarSynthesizer(speechConfig, avatarConfig);

// Connect to WebRTC peer connection
const peerConnection = new RTCPeerConnection();

// Handle ICE candidates
avatarSynthesizer.iceServerReceived = (s, e) => {
  // Add ICE servers to peer connection
};

// Start avatar session (startAvatarAsync returns Promise)
const result = await avatarSynthesizer.startAvatarAsync(peerConnection);

if (result.reason === sdk.ResultReason.SynthesizingAudioCompleted) {
  // Avatar session started, speak text (callback-based)
  avatarSynthesizer.speakTextAsync(
    "Hello, I am your virtual assistant.",
    (result) => console.log('Speech complete'),
    (error) => console.error('Error:', error)
  );
}

// Stop when done (stopAvatarAsync returns Promise)
await avatarSynthesizer.stopAvatarAsync();
avatarSynthesizer.close();
```

### Avatar Events
```javascript
avatarSynthesizer.avatarEventReceived = (s, e) => {
  console.log('Avatar event:', e.description);
};
```

### Avatar Use Cases
- Virtual assistants and chatbots
- Video content creation
- Accessibility (sign language avatars)
- Interactive presentations
- Customer service kiosks

**Note:** Avatar synthesis requires additional Azure resources and has different pricing than standard TTS.
