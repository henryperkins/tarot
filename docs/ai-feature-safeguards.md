# AI feature operational safeguards

Photo recognition, AI question suggestions and cloud journal summaries have daily request safeguards and permit one active request per identity and feature. These controls protect service capacity and inference spending; they are operational limits, separate from advertised subscription allowances and existing API-key call metering.

| Feature | Guest / Free | Active Plus | Active Pro |
| --- | --- | --- | --- |
| Photo recognition | 5 | 20 | 100 |
| AI question suggestions | Local template | 30 | 100 |
| Cloud journal summaries | Existing subscription restriction | 3 | 10 |

Limits reset at UTC midnight. Each successful request consumes one slot, including a photo request with up to five images. The server chooses the photo backend through `VISION_BACKEND_DEFAULT`; a request's `backendId` has no effect. Guest photo recognition remains available when its identity and accounting can be verified.

Set positive integer Worker variables to override a tier's safeguard:

- `FEATURE_VISION_FREE_DAILY_LIMIT`, `FEATURE_VISION_PLUS_DAILY_LIMIT`, `FEATURE_VISION_PRO_DAILY_LIMIT`
- `FEATURE_QUESTION_PLUS_DAILY_LIMIT`, `FEATURE_QUESTION_PRO_DAILY_LIMIT`
- `FEATURE_SUMMARY_PLUS_DAILY_LIMIT`, `FEATURE_SUMMARY_PRO_DAILY_LIMIT`

Missing, zero, negative, fractional or invalid overrides use the defaults. Overrides do not grant additional subscription access. Expired or canceled paid subscriptions use their effective tier. GPT service tokens follow their effective Plus/Pro tier for questions, while API-key questions and photo requests also use the existing Pro API-call meter. Summary authentication remains session-cookie-only, and the question route still supports its existing bearer/session/cookie authentication.

D1 migration `0033_add_feature_usage.sql` must be applied before the routes are enabled. Missing tables, unavailable accounting or missing trusted guest identity return HTTP 503 before inference. Daily exhaustion and an already active request return HTTP 429 with distinct `feature_daily_limit` / `feature_busy` codes. A free question's local template does not require a reservation.

Authenticated requests use their existing user identity. Guests use a SHA-256 hash of the edge-provided `CF-Connecting-IP`, namespaced for this feature accounting. Raw IP addresses, prompts and uploaded images are not stored in the feature table. User-agent, request-body identity and client-supplied forwarded-IP headers cannot change the quota identity. Guests sharing a public IP share the photo safeguard; local/proxy environments must provide the trusted edge identity before exercising guest recognition.

The conditional SQL insertion checks both the daily count and active request in one statement. A partial unique index independently prevents overlapping reservations across UTC midnight. Successful inference is settled once; failed recognition and question/summary local fallbacks release their reservation. Released rows remain as `released` attempt evidence; they do not consume the completed-operation allowance. A late release cannot refund a completed operation. This table measures operations, not vendor costs: failed paid provider attempts may still have incurred usage, and cost/provenance telemetry is separate.

A reservation has a fixed 15-minute lease, longer than supported generation task deadlines. If a Worker disappears without settling, the next request conservatively counts that unknown operation against its original UTC day and clears its active lock. A settlement storage error keeps the reservation locked until that recovery; it does not silently authorize another request. Completed rows remain available for operational review; retention should preserve the current UTC day's accounting.

Request bodies are read with byte bounds even without `Content-Length`. Text routes accept up to 64 KiB of JSON. Photo requests accept the existing five uploads of up to 8 MiB each, with a total JSON bound of `ceil(5 × 8 MiB × 1.37) + 64 KiB` (57,527,501 bytes). Bodies over those limits return HTTP 413 before inference. Existing per-image validation remains in effect.

## Offline verification

Tests use a real SQLite-backed D1 adapter with all additive migrations. They cover concurrent reservations, final daily slots, UTC-midnight behavior, orphan recovery, storage failures, failure release, effective service tiers, forged backend selection and body bounds. Provider calls are stubbed, and the test runner's network guard rejects external network requests.


## Independent attempt protection

Failures, cancellations and local fallbacks refund the completed-operation allowance,
but retain their admission attempt. A separate daily attempt ceiling defaults to three
times each configured daily allowance. `FEATURE_<FEATURE>_<TIER>_DAILY_ATTEMPT_LIMIT`
overrides it with a positive safe integer; values below the daily allowance are raised
to that allowance. Default rolling sixty-second attempt ceilings are five for vision
and ten for text, configurable through
`FEATURE_<FEATURE>_<TIER>_MINUTE_ATTEMPT_LIMIT`. These are operational safeguards,
not additional subscription benefits.

Admission checks the allowance, daily attempts, recent attempts and active lease in
one atomic conditional INSERT. Every admitted operation counts once even if no
provider is configured; rejected admissions do not consume attempts. Daily attempt
exhaustion returns 429 `feature_attempt_daily_limit`; recent attempt exhaustion returns
429 `feature_attempt_rate_limit`. Responses include `resetAt` and `retryAfter` seconds.
The recent-attempt window crosses UTC midnight; the daily counters reset at midnight.

Each admission cleans up at most 100 settled rows for that identity/feature older
than thirty days. Active reservations are retained, with expired leases conservatively
settled before cleanup. Cleanup is opportunistic; inactive identities can retain old
rows until their next request or an operator's maintenance job. Never remove recent
rows merely to refund failures, because those rows enforce attempt protection.
