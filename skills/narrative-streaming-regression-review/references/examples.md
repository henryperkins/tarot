# Examples

## Example 1: Chunked Reveal Progression

Good pattern:

```js
const nextChunk = units.slice(visibleCount, Math.min(units.length, visibleCount + revealStep)).join('');
const delay = computeRevealDelay(nextChunk, revealStep);
setVisibleCount((prev) => Math.min(prev + revealStep, units.length));
```

## Example 2: Mobile Suppression with User Notice

Good pattern:

```jsx
const shouldSuppressMobileStreaming = isLongMobileNarrative || isMarkdownMobileNarrative;
const streamingOptInNotice = streamingSuppressedForMobile ? <button>Play typing effect</button> : null;
```

## Example 3: Source Usage Metadata on Local Composer

Good pattern:

```js
payload.promptMeta.sourceUsage = buildLocalComposerSourceUsage(
  { ...payload, visionInsights, personalization },
  payload.promptMeta,
  graphRAGPayload
);
```

## Example 4: Finding Writeup

- `P2` - `src/components/StreamingNarrative.jsx:251`
- Completion callback can re-fire when text resets and stale flags are not cleared before visibility updates.
- Ensure reset order clears completion and narration refs before new stream progression starts.
- Validate with streaming wrapper and narrative tests.