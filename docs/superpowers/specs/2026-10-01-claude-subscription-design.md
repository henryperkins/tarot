# Personal Claude subscription inference

Approved scope: use the owner's personal Claude subscription for personalized
readings, follow-up answers and repairs, question suggestions, journal summaries,
and offline narrative sample generation. Existing Workers AI inference stays in
place, including grading, embeddings, coaching extraction, vision, speech and art.

## Architecture

`TEXT_PROVIDER=claude-code` selects an authenticated private HTTP service running
the unmodified `claude -p` CLI. The Worker never receives Claude credentials. The
service uses the owner's subscription login and rejects API/provider credentials.
The existing default routing remains available until this mode is configured.
In subscription mode, no failure can fall through to a paid API provider.

Application routes require the authenticated `CLAUDE_CODE_OWNER_USER_ID` in this
mode. The service requires a separate random gateway token and binds to loopback
by default. Public hosting, remote secret changes and deployment are outside this
implementation. A private HTTPS tunnel can connect a deployed Worker later.

The service accepts bounded text requests for reading, followup, followup-repair,
question and journal-summary tasks. It enforces a bounded queue, deadlines,
cancellation, output limits, and sanitized errors. Each CLI request starts an
isolated conversation with no persisted session, no project customizations and no
built-in tools. Successful output must have a successful terminal result; partial
or truncated output is rejected. Model and token usage come from that result.

## Application behavior

Reuse reading prompt construction, including personalization, memories, GraphRAG
and source-usage metadata. Preserve reading jobs and existing safety/quality
buffering. Follow-up generation uses structured decisions for the sole authorized
application tool, save_memory_note. Tableu validates the decision, performs the
existing owner-scoped write, then supplies the result in a fresh continuation.
The model cannot execute filesystem or shell tools. Bound the tool round trips.

Question and journal routes retain their deterministic fallbacks. Readings may
retain the local composer. Follow-ups return the existing retry response when
inference fails. Deterministic evaluation and Cloudflare model grading are not
changed. Offline samples record actual provider/model/usage.

## Verification

Test private access, no paid fallback, cancellation through response consumption,
bounded concurrency, tool validation/ownership, incomplete results, prompt
provenance and both follow-up response formats. Run root tests, lint, build, docs
checks and narrative quality gates. Run a small subscription smoke test and the
narrative sample suite if the login remains available. Keep live inference results
separate from mocked tests and local deterministic gates.
