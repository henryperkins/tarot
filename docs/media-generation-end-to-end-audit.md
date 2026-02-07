# Media Generation End-to-End Audit

Yes. I traced the full media path and there are multiple cost/abuse gaps.

**End-to-End Flow**
- Story art: `POST /api/generate-story-art` in `functions/api/generate-story-art.js:246` does auth + tier checks, builds a prompt, calls Azure image gen, then returns base64 JPEG.
- Card video: `POST /api/generate-card-video` in `functions/api/generate-card-video.js:449` does auth + tier checks, optionally makes a keyframe image, creates a Sora video job, stores job metadata, then client polls `GET /api/generate-card-video?jobId=...` in `functions/api/generate-card-video.js:807`.
- Frontend callers are `src/components/StoryIllustration.jsx:276` and `src/components/AnimatedReveal.jsx:348`, with polling at `src/components/AnimatedReveal.jsx:232`.

**Models Used**
- Story art image model default: `gpt-image-1.5` (`functions/api/generate-story-art.js:34`, `functions/api/generate-story-art.js:142`).
- Video keyframe image model default: `gpt-image-1.5` (`functions/api/generate-card-video.js:207`).
- Video model default: `sora-2` (`functions/api/generate-card-video.js:37`, `functions/api/generate-card-video.js:262`).
- API paths: images `/openai/v1/images/generations` (`functions/api/generate-story-art.js:163`, `functions/api/generate-card-video.js:222`), videos `/openai/v1/videos` (`functions/api/generate-card-video.js:282`), status/content (`functions/api/generate-card-video.js:342`, `functions/api/generate-card-video.js:374`).

**How Prompts Are Built**
- Story art format switch: triptych/single/vignette in `functions/api/generate-story-art.js:370`.
- Story prompt templates: `functions/lib/storyArtPrompts.js:232`, `functions/lib/storyArtPrompts.js:302`, `functions/lib/storyArtPrompts.js:381`.
- Video prompt templates: `functions/lib/videoPrompts.js:191`, keyframe template `functions/lib/videoPrompts.js:282`.
- Card/question semantics come from `functions/lib/generativeVisuals.js:57` and `functions/lib/generativeVisuals.js:115`, backed by imagery dictionaries in `functions/lib/imageryHooks.js:24` and `functions/lib/imageryHooks.js:356`.

**Rate Limits / Cost Controls Present**
- Tier gates: story art limits in `functions/api/generate-story-art.js:50`, video limits in `functions/api/generate-card-video.js:48`.
- Daily quota checks: story art `functions/api/generate-story-art.js:391`, video `functions/api/generate-card-video.js:592`.
- Quota implementation is KV-based in `functions/lib/utils.js:153`.
- Other controls: feature flags (`functions/api/generate-story-art.js:255`, `functions/api/generate-card-video.js:458`), video seconds cap (`functions/api/generate-card-video.js:527`), plus-tier image quality downgrade (`functions/api/generate-story-art.js:297`), request timeouts (`functions/api/generate-story-art.js:119`, `functions/api/generate-card-video.js:184`), optional cache (`functions/api/generate-story-art.js:206`, `functions/api/generate-card-video.js:395`).

**How Assets Are Stored and Served**
- Cached image keys: `generated-art/<hash>.jpeg` (`functions/api/generate-story-art.js:100`).
- Cached video keys: `generated-video/<hash>.mp4` (`functions/api/generate-card-video.js:165`).
- Job metadata stored in KV as `video_job:<jobId>` with 1h TTL (`functions/api/generate-card-video.js:436`, `functions/api/generate-card-video.js:440`).
- Telemetry stored in KV via `functions/lib/mediaTelemetry.js:74`.
- Assets are served inline as base64 JSON (`functions/api/generate-story-art.js:465`, `functions/api/generate-card-video.js:918`) and rendered as `data:` URLs (`src/components/StoryIllustration.jsx:337`, `src/components/AnimatedReveal.jsx:110`).
- In repo config, R2 binding is commented out (`wrangler.jsonc:202`), so cache may be inactive depending on deployment config.

**Abuse Vectors (Relevant to Expensive Generation)**
- Critical: Daily quota race condition. `checkAndIncrementDailyUsage` does `get` then `put` non-atomically (`functions/lib/utils.js:176`, `functions/lib/utils.js:202`), so parallel requests can overshoot limits.
- High: Story-art limits fail open if KV missing/failing. The limiter returns allowed when storage is unavailable (`functions/lib/utils.js:159`), and story-art does not hard-require `METRICS_DB` (contrast video’s explicit guard at `functions/api/generate-card-video.js:473`).
- High: Video status endpoint can be spam-polled and repeatedly re-download completed videos from Azure. On each completed poll it calls content fetch (`functions/api/generate-card-video.js:864`) and there is no completed-job short-circuit/read-from-cache path in GET.
- High: No per-minute/IP throttling on media endpoints; only daily counters. There’s no RATELIMIT enforcement in these handlers.
- Medium: API-key monthly API-call enforcement exists (`functions/lib/apiUsage.js:4`) but is not applied in media endpoints, so media calls bypass that specific control.
- Medium: No idempotency/in-flight dedupe. Repeated identical POSTs before cache fill create duplicate expensive jobs (`functions/api/generate-card-video.js:534`, `functions/api/generate-card-video.js:668`).
- Medium: Input size/card validation is loose (only “string exists” checks), so users can send oversized/arbitrary prompt content (`functions/api/generate-story-art.js:74`, `functions/api/generate-card-video.js:133`).

If you want, I can draft a concrete hardening patch set (atomic quota reservation, media-specific rate limiter, status endpoint completion caching, and entitlement check parity on GET).
