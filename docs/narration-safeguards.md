# Narration and media safeguards

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

Saved `deepgram` preferences remain Deepgram, and `workers-ai-aura-2` preferences
migrate to Deepgram. Retired Azure/Hume values and missing or unknown preferences
migrate to the default ElevenLabs option. The normalized value is persisted using
the existing `tarot-tts-provider` device preference.

Requests select the engine with `provider: 'elevenlabs'` or `provider: 'deepgram'`.
Unsupported explicit values return 400 before accounting or synthesis; a selected
engine with missing configuration returns 503. Older clients that omit `provider`
retain the configured default: ElevenLabs when its key exists, otherwise Deepgram
when the Workers AI binding exists. Response provider metadata remains `elevenlabs`
or `workers-ai-aura-2` for compatibility.

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
server splits it into ordered pieces of at most 1,900 characters, with one monthly
unit settled only after all synthesis bodies finish successfully. Requests over
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

A 120-second overall deadline covers provider calls and all audio bodies. Failure,
request abort, body failure and consumer cancellation release the reservation;
provider cancellation is best effort and cannot delay release. ElevenLabs fetch
requests are aborted on cancellation or deadline, including while awaiting headers.
A Workers AI call that stalls before returning a stream cannot be reliably cancelled at the binding
boundary. It is never retried concurrently. A late returned body is cancelled.
Delivery to the response stream means synthesis succeeded; monthly accounting
cannot prove that a browser listened to every byte or that a disconnected network
received queued bytes. The client reports interrupted audio as an error and does
not substitute a successful chime for failed narration.

## Image and video availability

FLUX story art gets one 35-second attempt. An uncancellable stalled inference is
not retried while it may still be running; existing failed-generation usage refund
is retained. The capability query `/api/generate-card-video?capabilities=true`
returns only whether video is enabled and its database/endpoints/keys are configured.
It returns no secrets and makes no model calls. Both paid-tier UI entry points
require this server capability; loading or discovery failures hide video. This
configuration check does not prove provider health or model quality.

Offline tests and local browser fixtures validate these contracts. They do not
qualify live voice quality, provider billing, production migration state, or video
output. No production secrets need deletion for the retired Hume endpoint.
