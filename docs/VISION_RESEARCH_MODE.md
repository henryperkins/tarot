# Vision Research Mode Refactoring

Type: design note
Status: active background document
Last reviewed: 2026-09-25

## Summary

The vision validation system has been refactored from a **production requirement** to an **optional research feature**. Users can now generate AI readings without uploading photos, while still preserving the vision validation infrastructure for research and development purposes.

## Changes Made

### 1. Backend API (`/functions/api/tarot-reading.js`)

**Before:** Hard requirement - API returned `400 Bad Request` if no vision proof provided.

**After:** Optional validation with research telemetry:

- Readings can be generated **without** vision proof
- If vision proof is provided, it's verified and telemetry is collected
- Vision mismatches are logged for research and do not block readings by default
- Strict deck or mismatch-rate policies can be enabled to return 409 instead
- Vision metrics are set to `null` when no proof is provided

**Key code changes:**

```javascript
// Vision validation is OPTIONAL - used for research/development purposes only
let sanitizedVisionInsights = [];
let visionMetrics = null;

if (!visionProof) {
  console.log(
    `[${requestId}] No vision proof provided; proceeding with standard reading.`
  );
} else {
  // Research mode: Verify vision proof and collect telemetry
  console.log(
    `[${requestId}] Vision proof provided - validating for research telemetry...`
  );
  // ... validation logic ...
}
```

### 2. Frontend (`/src/TarotReading.jsx`)

**Before:** "Create Personal Narrative" button disabled when `!isVisionReady`

**After:** Button always enabled (when cards are revealed):

- Removed `!isVisionReady` from button `disabled` condition
- Added warning message only when vision data has conflicts
- Updated helper text to remove vision requirement

**Key changes:**

```jsx
function ReadingActions({ isGenerating, hasVisionData, isVisionReady }) {
  return (
    <>
      <button type="button" disabled={isGenerating}>
        Create Personal Narrative
      </button>
      {hasVisionData && !isVisionReady && (
        <p className="mt-3 text-sm text-amber-100/80">
          Vision data has conflicts; research telemetry may be incomplete.
        </p>
      )}
    </>
  );
}
```

### 3. UI Text Updates

#### VisionValidationPanel.jsx

Current copy includes:

> "Vision Research Console" and "Upload card photos to test vision model recognition. Compares uploads against the active deck’s embeddings."

The panel is optional research UI; a normal reading does not require it. The deck selector itself is a general reading control and is not hidden by the vision flag.

## Current Default and Strict Policies

The client flag is `VITE_ENABLE_VISION_RESEARCH`; when omitted or `false`, the
research UI and proof handshake are disabled, so physical-card research is not
default-on. `VISION_PROOF_SECRET` is needed only when a signed proof is used.

With the default mismatch policies disabled, a mismatched proof is retained for
telemetry and the reading proceeds. `VISION_STRICT_DECK_MATCH=true` rejects a
wrong-deck proof with 409. `VISION_STRICT_MISMATCH_RATE=true` rejects a request
with 409 when its mismatch rate exceeds `VISION_MAX_MISMATCH_RATE` (default 0.5).
Expired proofs are also 409; other invalid proofs are 400. A missing proof is not a
failure and does not return 400; when a proof is supplied, malformed, unsigned,
tampered, or unsupported proofs fail verification rather than being treated as
ordinary research mismatches.

## Purpose and Rationale

### Original Issue

The vision validation system was designed as research infrastructure (see `docs/AI_Tarot_Master.md`) but was deployed with a hard requirement that blocked all readings without photo uploads. This created a nonsensical user experience:

1. App digitally draws cards for users
2. Users required to photograph their screens
3. Upload photos back to the app
4. Only then could generate a reading

### Research Purpose

The vision system serves legitimate research goals:

- Training CLIP models to recognize tarot cards
- Evaluating vision AI accuracy across different decks
- Collecting ground-truth labeled data for model improvement
- Testing multimodal AI capabilities

### Solution

Make vision validation **opt-in** for research participants while allowing normal users to use the app without the circular photo requirement.

## User Experience Flow

### Standard Flow (No Research Participation)

1. User selects spread
2. User draws cards (digital)
3. User reveals cards
4. User generates AI reading ✅ **No photos required**

### Research Flow (Opt-in)

1. User selects spread
2. User draws cards (digital)
3. User reveals cards
4. **Optional:** User photographs displayed cards and uploads
5. Vision AI analyzes photos and collects telemetry
6. User generates AI reading; with default mismatch policy, vision conflicts do not block the reading
7. Research data is sent to telemetry for model improvement

## Enabling / Disabling Research Mode

The frontend treats vision uploads as a build-time toggle. Set `VITE_ENABLE_VISION_RESEARCH=true` in your `.env` (or hosting dashboard) to expose the research panel and proof handshake for authenticated users. When the flag is omitted or `false`:

- The client does not call `/api/vision-proof`, so local/dev builds do not require `VISION_PROOF_SECRET` for the research flow.
- The general deck selector remains available for normal reading setup; the research panel and proof handshake stay hidden.
- Readings still include telemetry fields, but `vision` stays `null` when no proof is provided.

When the flag is enabled and `VISION_PROOF_SECRET` is configured on the worker, the research UI appears for authenticated users and attempts to sign uploads before `/api/tarot-reading` receives them. If the proof request fails, the client proceeds without a proof; the server still requires the secret whenever `/api/vision-proof` is called.

## Testing

To verify the changes work correctly:

### Test 1: Reading Without Vision Proof

```bash
curl -X POST http://localhost:8787/api/tarot-reading \
  -H "Content-Type: application/json" \
  -d '{
    "spreadInfo": {"name": "One-Card Insight"},
    "cardsInfo": [{"card": {"name": "The Fool"}, "isReversed": false}],
    "userQuestion": "Test question",
    "deckStyle": "rws-1909"
  }'
```

**Expected:** Reading generated successfully; absence of a proof is not a proof failure and does not return 400.

### Test 2: Reading With Vision Proof

```bash
# First get a vision proof
curl -X POST http://localhost:8787/api/vision-proof \
  -H "Content-Type: application/json" \
  -d '{
    "deckStyle": "rws-1909",
    "evidence": [{"label": "test", "dataUrl": "data:image/png;base64,..."}]
  }'

# Then use it in reading request
curl -X POST http://localhost:8787/api/tarot-reading \
  -H "Content-Type: application/json" \
  -d '{
     "spreadInfo": {"name": "One-Card Insight"},
     "cardsInfo": [{"card": {"name": "The Fool"}, "isReversed": false}],
     "userQuestion": "Test question",
     "visionProof": { ... },
     "deckStyle": "rws-1909"
   }'
```

Replace the placeholder with the signed `proof` object returned by the first request; a literal `{ ... }` payload is not a valid proof.

**Expected:** Reading generated with vision telemetry collected. A malformed, unsigned, tampered, or unsupported proof returns 400; an expired proof returns 409.

### Test 3: Frontend Button

1. Navigate to app
2. Draw cards
3. Reveal all cards
4. Verify "Create Personal Narrative" button is **enabled** (not grayed out)
5. Click button
6. Verify reading generates without requiring photo upload

## Future Enhancements

Consider adding:

1. **Collapsible vision panel** to reduce visual clutter for non-participants

2. **Explicit opt-in checkbox**: "I want to help improve vision AI by uploading photos"

3. **Research participant acknowledgment**: Link to research consent/purpose

4. **Telemetry dashboard** for tracking research data collection metrics

## Related Documentation

- `./AI_Tarot_Master.md` - AI training research methodology and deck subtleties
- `./vision-pipeline.md` - Technical implementation of CLIP-based vision validation with optional server-side Llama/hybrid orientation
- `wrangler.jsonc` - Deployment configuration and secrets management (see secrets section)

## Migration Notes

### Breaking Changes

None - This is a backwards-compatible change that removes restrictions.

### Configuration Updates

- `VITE_ENABLE_VISION_RESEARCH`: Controls whether the client exposes the research UI and attempts to create signed proofs. Defaults to `false`.
- `VISION_PROOF_SECRET`: Required on the worker **only when** research mode is enabled. When absent, no signed proof can be issued or accepted; readings without a proof still succeed, and vision telemetry remains `null`.

### Telemetry Impact

- Readings without vision proof will have `vision: null` in telemetry
- Use this field to track research participation rate
- Filter telemetry queries to analyze vision accuracy only for participated readings
