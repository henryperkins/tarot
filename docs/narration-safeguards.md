# Narration and media safeguards

Apply migration 0034 before enabling server narration. Narration fails closed with
503 if D1 accounting is unavailable. Reader voice uses ElevenLabs when
`ELEVENLABS_API_KEY` is configured; otherwise it uses Deepgram Aura-2 through
Workers AI. Stored Hume preferences migrate to reader voice, and `/api/tts-hume`
returns 410 without using a provider or an allowance unit. Azure Word Sync is
retired; legacy preferences migrate to reader voice.

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

`GET /api/tts` and `/api/health/tts` report the configured provider, model and voice
without making a synthesis request; they do not prove upstream service health.
When ElevenLabs is configured, failures return a retryable narration error rather
than switching voices or retrying paid synthesis. Its upstream error bodies are
discarded to keep reading text and credentials out of public errors. Existing
cached snippets are invalidated once when upgrading the reader voice cache.

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

## Retired Word Sync

`/api/speech-token` returns HTTP 410 without issuing credentials, calling a provider,
or consuming narration allowance. The browser no longer loads the Azure Speech SDK.
Use the server reader voice described above; no Azure Speech setup is supported.

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
