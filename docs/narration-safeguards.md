# Narration and media safeguards

Type: reference
Status: active reference
Last reviewed: 2026-10-23

Apply migration 0034 before enabling server narration. Narration fails closed with
503 if D1 accounting is unavailable. Users choose **ElevenLabs** or **Deepgram**
in the account Audio settings or reading audio controls. The preference is saved
on their device and included with each narration request. Both engines share the
same monthly narration allowance. Azure Word-Sync and Hume narration are retired;
`/api/speech-token` and `/api/tts-hume` return 410 without contacting a provider
or consuming an allowance unit.

ElevenLabs uses `eleven_v4` with Sarah by default. Deepgram uses Aura-2 English
with Cora through Cloudflare Workers AI. Explicit provider selections never
silently switch engines on configuration or synthesis failure. A user can choose
the other engine and try again.

Deepgram is the default while ElevenLabs is unavailable. Saved `elevenlabs` and
`deepgram` selections remain unchanged, and `workers-ai-aura-2` preferences migrate
to Deepgram. Retired Azure/Hume values and missing or unknown preferences also use
Deepgram. The normalized value is persisted using the existing
`tarot-tts-provider` device preference.

Requests select the engine with `provider: 'elevenlabs'` or `provider: 'deepgram'`.
Unsupported explicit values return 400 before accounting or synthesis; a selected
engine with missing configuration returns 503. Clients that omit `provider` use
Deepgram even when an ElevenLabs key exists. A missing Workers AI binding returns
503 without switching to ElevenLabs. Response provider metadata remains
`elevenlabs` or `workers-ai-aura-2` for compatibility.

## ElevenLabs setup

Add `ELEVENLABS_API_KEY` to the ignored `.dev.vars` file for local development.
The key is read only by the Worker and sent in ElevenLabs' `xi-api-key` header;
it is never sent to the browser. For production, set the Worker secret
with `wrangler secret put ELEVENLABS_API_KEY --config wrangler.jsonc`.

Optional server settings select `ELEVENLABS_VOICE_ID` (default Sarah,
`EXAVITQu4vr4xnSDxMaL`) and `ELEVENLABS_MODEL_ID` (default
`eleven_v4`). The [ElevenLabs streaming endpoint](https://elevenlabs.io/docs/api-reference/text-to-speech/stream)
returns MP3 at 44.1 kHz, 128 kbps. Neighboring text provides continuity between
pieces. Browser speed controls change playback speed, so synthesis does not apply
the speed a second time. Legacy browser voice fields do not select provider voices.

Deepgram uses the Worker's `AI` binding and needs no additional provider key.
Browsers receive audio from `/api/tts`; neither provider is called directly from
the browser. The Azure Speech SDK, token issuance and its separate safeguards
have been removed.

`GET /api/tts` and `/api/health/tts` report provider configuration without making
a synthesis request; they do not prove upstream service health. Synthesis failures
return a retryable narration error rather than switching engines or retrying paid
synthesis. ElevenLabs upstream error bodies are discarded to keep reading text
and credentials out of public errors. Audio cache keys include the selected
provider, so switching engines cannot replay another engine's cached narration.

Health responses retain their default provider, model and voice fields and add
a `providers` list containing each selectable engine's ID, availability, model and
voice. The list contains no credentials. An available entry means the required
configuration exists, rather than confirming a successful live provider request.

## Server narration units

One `/api/tts` request is one complete narration of up to 64,000 characters. The
server splits it into ordered pieces of at most 1,900 characters. ElevenLabs
consumes one monthly unit once it has produced any nonempty audio, even if the
request later fails, times out or is cancelled. Deepgram consumes one unit after
all synthesis bodies finish successfully. Requests over
the cap or a 512 KiB JSON body are rejected, never silently shortened. A completed
reading is sent in one request; auto-narration waits for the completed, screened
reading rather than synthesizing incremental text. Card reveal utterances remain
separate requests/units; cached playback does not request synthesis again.

Existing monthly account and legacy guest counts seed the new accounting table.
Guest keys hash the Cloudflare client IP, with a shared local-anonymous identity
when absent; arbitrary forwarded IP headers cannot reset identity. Atomic D1
constraints allow one active narration per identity and enforce the existing
monthly tier allowance, plus 30 attempts per minute. Reservation leases expire
after three minutes. Settlement and release are idempotent. Records for an
identity older than 90 days and old minute buckets are removed during its next
reservation. There is no client-selected session or grouping ID to replay.

A 120-second overall deadline covers provider calls and all audio bodies. The
reservation remains active throughout synthesis to prevent concurrent narration
for the same identity. Failure, request abort, body failure and consumer
cancellation settle it once if ElevenLabs has produced audio; otherwise they
release it. Empty audio and failures before audio production still refund.
Overlapping termination paths share one accounting operation, including errors
while buffering a non-streaming response. Provider cancellation is best effort
and cannot delay accounting. ElevenLabs fetch
requests are aborted on cancellation or deadline, including while awaiting headers.
A Workers AI call that stalls before returning a stream cannot be reliably cancelled at the binding
boundary. It is never retried concurrently. A late returned body is cancelled.
Audio queued in the response stream counts as produced audio; monthly accounting
cannot prove that a browser listened to every byte or that a disconnected network
received queued bytes. The client reports interrupted audio as an error and does
not substitute a successful chime for failed narration.

## Image and video availability

FLUX story art gets one 35-second attempt. An uncancellable stalled inference is
not retried while it may still be running; existing failed-generation usage refund
is retained. Card-video generation is retired: `/api/generate-card-video`, including
capability/status requests, returns HTTP 410 without provider calls or new usage
charges. The frontend does not offer new video generation. Existing saved media
remains available through the media library. No replacement video vendor is configured.

Offline tests and local browser fixtures validate these contracts. They do not
qualify live voice quality, provider billing, or production migration state. Retiring
configuration and routes locally does not delete any previously stored remote secrets.
