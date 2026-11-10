**Read-only provider failure diagnosis — 23 October 2026**

The release is still active. The saved failure pattern is confirmed, but the upstream causes of Claude 400, Modal 503, and OpenAI 429 remain unproven. The concrete code findings are loss of structured error diagnostics and retry decisions that cannot distinguish recoverable from persistent failures.

Source inspected: `be78c9a4d2370102a2ae0d9b295d28d426d4a828` in the clean isolated release checkout (`/home/ubuntu/tarot/.worktrees/reading-context-release-20261023`, local artifact). The primary checkout is `37b6a540`, an ancestor of the release, with existing unrelated changes. An initial progress update incorrectly described it as newer; Git ancestry corrected that interpretation before the provider diagnosis.

**Production evidence**

Cloudflare metadata checked at 2026-10-23T20:14:38.187Z confirms deployment `15afd0b5-0a25-49ab-b562-bd623d9bd90a`, Worker version `0aa03113-ff62-421c-bfb2-59b8dafb3531`, and 100% traffic. All three providers have the expected model settings and secret binding names. Binding presence does not prove that credentials are valid or accounts have available credit. Persisted logs and Issues remain enabled.

A read-only log query through 2026-10-23T20:16:09.209Z returned 20 matching provider failure events from the original evaluation window and no matching successful-reading-generation events. This query is supplemental log evidence, not a complete inference-attempt census or a fresh recovery test. Its last matching failure is at 19:04:55.364 UTC. The [original retained errors](prior-provider-errors.json) independently show the same statuses on earlier Worker versions.

**Verified handling findings**

| Path | Code evidence | Consequence |
| --- | --- | --- |
| Claude | [anthropicMessages.js](../../../functions/lib/anthropicMessages.js#L156) replaces SDK errors with a message containing only the HTTP status. | Structured provider error codes, provider request IDs and spend-limit details cannot reach operational telemetry. |
| Modal | [modalChatCompletions.js](../../../functions/lib/modalChatCompletions.js#L377) cancels non-success bodies, discards response headers and permits two retries. | A supplied `Retry-After` is ignored on 503; only three requests are attempted using short generic backoff. Whether the actual production error was cold start, capacity, failed startup or another service failure remains unknown. |
| OpenAI | [openaiResponses.js](../../../functions/lib/openaiResponses.js#L214) permits three retries and suppresses the error body; [retryWithBackoff.js](../../../functions/lib/retryWithBackoff.js#L295) retains no structured code. | Quota and throttling errors are indistinguishable and both cause four total attempts. If quota is exhausted, those retries cannot restore access. |

The live fallback route uses the non-streaming OpenAI helper: [tarot-reading.js](../../../functions/api/tarot-reading.js#L1403) only chooses token streaming when OpenAI is the first available configured provider. The separate streaming helper also discards non-success bodies and would need diagnostic coverage.

The [inference-attempt recorder](../../../functions/lib/inferenceAttempts.js#L53) persists generic reason categories rather than provider status, provider request ID or machine error code. Therefore rereading that table cannot recover details already discarded by the adapters.

**Offline reproduction**

A single Node process imported the exact release adapters, replaced every global `fetch` call with a synthetic response, supplied only dummy credentials, and asserted the request counts and body redaction. All four scenarios passed:

- Claude 400 with a synthetic `enforced_spend_limit_reached` detail: one request; code and request ID lost.
- Modal 503 with synthetic `Retry-After: 120`: three requests; no retry delay metadata retained.
- OpenAI 429 with `insufficient_quota`: four requests; code and request ID lost.
- OpenAI 429 with `rate_limit_exceeded`: four requests; indistinguishable exposed error.

No synthetic raw error-body marker appeared in captured logs. These scenarios establish adapter behavior, not which synthetic cause matches the real outage. No full test suite was run because no application code changed.

**Provider documentation and remaining uncertainty**

Anthropic documents 400 for both invalid request content and configured spend-limit exhaustion. HTTP 400 alone cannot justify changing the prompt or model settings. The current refusal-fallback beta and `fallbacks: "default"` request shape are documented; no unsupported-field cause was established. See [Claude API errors](https://platform.claude.com/docs/en/api/errors), [rate limits](https://platform.claude.com/docs/en/api/rate-limits), and [refusal fallback](https://platform.claude.com/docs/en/build-with-claude/refusals-and-fallback).

OpenAI documents quota/credit failures separately from temporary rate limits, even though they can return 429. The provider error code is needed before selecting billing remediation or retry/backoff changes. See [OpenAI error codes](https://developers.openai.com/api/docs/guides/error-codes).

Modal documents 503 when a Server has no ready containers, including while a cold start begins. This is a plausible explanation for the configured `modal.direct` service, not a confirmed diagnosis of this deployment. See [Modal Servers](https://modal.com/docs/guide/servers).

**Concrete next diagnostic step**

1. Add a shared, bounded provider-error classifier. Retain numeric HTTP status, an allowlisted error type/code, validated provider request ID, bounded retry timing, and a classified billing/availability category. Treat all provider response content as untrusted. Keep raw bodies, prompts, tokens and free-form messages out of user errors and ordinary logs.
2. Cover Claude, Modal, both OpenAI transports, and the final operational recorder. Stop retrying classified billing/quota/configuration failures. For transient errors, honor retry advice within the existing overall reading deadline; do not lengthen retries without evidence that it addresses the service failure.
3. Run at most one synthetic diagnostic request per provider with application and SDK retries disabled, no fallback cascade, explicit output limits, and a preserved attempt ledger. This is new live inference work and was not performed in this read-only investigation.
4. Use the resulting classified cause to repair the affected provider. Then qualify one real production reading through the restored AI path before repeating a bounded selection of the saved context/GraphRAG cases.

Application files, Git refs/index and production settings were not edited. No new reading, model request, account, memory, commit, push or deployment was created. The only new files are this report and its [sanitized evidence](evidence.json).


> Portability note (23 October 2026): local evidence paths above identify artifacts on the original review host. Those files are not included in this Git handoff. Repository source links are relative.
