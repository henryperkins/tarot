# Narration and media safeguards

Apply migration 0034 before enabling server narration. Narration fails closed with
503 if D1 accounting is unavailable. The default voice is Deepgram Aura-2 through
Workers AI; stored Hume preferences migrate to that voice, and `/api/tts-hume`
returns 410 without using a provider or an allowance unit. Word-Sync remains an
independent Azure browser SDK option.

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
provider cancellation is best effort and cannot delay release. A Workers AI call
that stalls before returning a stream cannot be reliably cancelled at the binding
boundary. It is never retried concurrently. A late returned body is cancelled.
Delivery to the response stream means synthesis succeeded; monthly accounting
cannot prove that a browser listened to every byte or that a disconnected network
received queued bytes. The client reports interrupted audio as an error and does
not substitute a successful chime for failed narration.

## Word-Sync limitation

Azure SDK authorization tokens are separate from monthly narration accounting.
Signed-in users receive at most six token requests per minute; token initialization
and refresh do not consume narration units. The token endpoint has a 15-second
header/body deadline. Tokens authorize the browser to synthesize directly with
Azure, so this endpoint cannot enforce a per-narration monthly synthesis allowance.
The UI describes separate request safeguards. Moving this synthesis behind the
server is a follow-up if strict monthly metering is required.

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
