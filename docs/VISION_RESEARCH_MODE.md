# Vision Research Mode Refactoring

## Summary

The vision validation system has been refactored from a **production requirement** to an **optional research feature**. Users can now generate AI readings without uploading photos, while still preserving the vision validation infrastructure for research and development purposes.

## Changes Made

### 1. Backend API (`/functions/api/tarot-reading.js`)

**Before:** Hard requirement - API returned `400 Bad Request` if no vision proof provided.

**After:** Optional validation with research telemetry:

- Readings can be generated **without** vision proof
- If vision proof is provided, it's verified and telemetry is collected
- Vision mismatches no longer block readings - they're logged for research
- Vision metrics are set to `null` when no proof is provided

**Key code changes:**

```javascript
// Vision validation is OPTIONAL - used for research/development purposes only
let sanitizedVisionInsights = [];
let visionMetrics = null;

if (!visionProof) {
  console.log(
    `[${requestId}] No vision proof provided (research mode disabled). Proceeding with standard reading.`
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

```javascript
// Button no longer blocked by vision validation
disabled = { isGenerating }; // Previously: disabled={isGenerating || !isVisionReady}

// Show warning only when there are conflicts
{
  hasVisionData && !isVisionReady && (
    <p className="mt-3 text-sm text-amber-100/80">
      ⚠️ Vision data has conflicts - research telemetry may be incomplete.
    </p>
  );
}
```

### 3. UI Text Updates

#### VisionValidationPanel.jsx

**Before:**

> "Upload up to five photos of your drawn cards so the deck can confirm what you pulled before unlocking the AI reading. **Validation is required to continue.**"

**After:**

> "Help improve our AI by uploading photos of your drawn cards. This **optional feature** helps us train better card recognition models. **Your contribution is appreciated but not required.**"

#### DeckSelector.jsx

**Before:**

> "Choose your physical deck" - "Select the deck you're using so the vision validation can accurately recognize your cards."

**After:**

> "Select deck style for vision research" - "**If you're participating in vision validation research**, select which deck style you're photographing to help our AI learn."

## Purpose and Rationale

### Original Issue

The vision validation system was designed as research infrastructure (as documented in `guidetoaitraining.md`) but was deployed with a hard requirement that blocked all readings without photo uploads. This created a nonsensical user experience:

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
6. User generates AI reading (regardless of vision results)
7. Research data sent to telemetry for model improvement

## Enabling / Disabling Research Mode

The frontend now treats vision uploads as a build-time toggle. Set `VITE_ENABLE_VISION_RESEARCH=true` in your `.env` (or hosting dashboard) to show the deck selector and the `VisionValidationPanel`. When the flag is omitted or `false`:

- The client never calls `/api/vision-proof`, so local/dev builds no longer require `VISION_PROOF_SECRET`
- The deck selector and research UI stay hidden, keeping the default experience streamlined
- Readings still include telemetry fields, but `vision` stays `null`

When the flag is enabled and `VISION_PROOF_SECRET` is configured on the worker, the research UI appears and uploads will be signed before `/api/tarot-reading` receives them.

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

**Expected:** Reading generated successfully, no 400 error

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

**Expected:** Reading generated with vision telemetry collected

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

- `guidetoaitraining.md` - AI training research methodology (source of vision requirements)
- `docs/VISION_PIPELINE.md` - Technical implementation of CLIP-based vision validation
- `docs/DEPLOYMENT.md` - Deployment configuration and secrets management

## Migration Notes

### Breaking Changes

None - This is a backwards-compatible change that removes restrictions.

### Configuration Updates

- `VITE_ENABLE_VISION_RESEARCH`: Controls whether the client exposes the research UI and attempts to create signed proofs. Defaults to `false`.
- `VISION_PROOF_SECRET`: Required on the worker **only when** research mode is enabled. When absent, the API still serves readings without telemetry data.

### Telemetry Impact

- Readings without vision proof will have `vision: null` in telemetry
- Use this field to track research participation rate
- Filter telemetry queries to analyze vision accuracy only for participated readings
