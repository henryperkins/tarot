# OpenAI readings release — November 6, 2026

Production runs Worker version `9ac98049-7d94-4cc8-9b30-7db2626fdee5`. It was built from master `42ee4362b7b5a1977cd884da095c4834ad695d89` and has served all traffic since 04:11 UTC.

Readings use the OpenAI Responses API with `gpt-6-astra` at `high` reasoning effort and default verbosity, streamed. The Claude API, Modal and the local composer follow as fallbacks. Before this release, Claude API requests were failing in production, and readings were served by Modal.

The owner authorized the merges, the release and the variable override described below.

Rollback:

- `npx wrangler rollback 3a00b28c-1380-4b96-884b-942737c0ff14 --config wrangler.jsonc` keeps this code with `gpt-5.6-sol` at `xhigh`.
- `5ac954d1-1f3b-4783-89ce-c77fb56db5ac` returns to the [previous release](READING_PANELS_RELEASE_2026-11-05.md).

## What shipped

| PR | Merge commit | Change |
| --- | --- | --- |
| [#141](https://github.com/henryperkins/tarot/pull/141) | `959a0125` | OpenAI leads the reading order. The release gate grades the production primary provider through the paid OpenAI API. A stream draft replaced by another provider is recorded as a notice, so MCP delivers the reading and jobs stamp its memories. The narrative gate accepts "guaranteed" when it is negated earlier in the same clause. |
| [#142](https://github.com/henryperkins/tarot/pull/142) | `7bafb2eb` | Sets `gpt-6-astra` as the reading model. The narrative gate also accepts a contrast before "guaranteed". |
| [#143](https://github.com/henryperkins/tarot/pull/143) | `42ee4362` | Sets reasoning effort to `high`. |

Follow-up answers and journal summaries are unchanged: they try Claude first, then the Responses API.

## Release QA

Each attempt ran `npm run deploy` from a clean detached worktree. Narrative samples were generated through the paid OpenAI API with the configured model and effort.

1. **`959a0125`, `gpt-5.6-sol` at `xhigh`.** Stopped before any migration or upload on one deterministic-language false positive: "…direction rather than a guaranteed outcome." #142 fixes it.
2. **`7bafb2eb`, `gpt-6-astra` at `xhigh`.** Stopped before upload. Samples took 67 and 87 seconds, then the five-card sample exceeded the 120-second request limit.
3. **`42ee4362`, `gpt-6-astra` at `high`.** Passed and uploaded.

Before the third attempt, two paid readings were timed at `high`: five cards took 61 seconds and a Celtic Cross 90 seconds.

| Release check (third attempt) | Result |
| --- | --- |
| Root tests | 6,429 passed, 2 skipped, 0 failed. |
| Deployment tests | 75 passed, 0 failed. |
| Narrative qualification | 11 samples from `gpt-6-astra` at `high`, 32–103 seconds each, 0 flagged. Story spine and card coverage were 100%. |
| Prompt assembly | 874 fixtures and 2,541 provider builds passed. |
| Production migrations | Already applied; this release has none. |
| Vision qualification | Not run, because `VISION_EVAL_MANIFEST_DIR` was unset. |

## Production variables

`npm run deploy` keeps existing production variables. Values in `wrangler.jsonc` only seed variables that don't exist yet. The release therefore produced version `3a00b28c` at 03:05 UTC, which still ran `gpt-5.6-sol` at `xhigh`.

At the owner's direction, a version was uploaded from the same commit with only `OPENAI_MODEL` and `OPENAI_REASONING_EFFORT` set explicitly. Before it took traffic, it was compared with the live version:

- All 109 bindings matched: 62 variables, 35 secrets and 12 resource bindings.
- The compatibility date and flags matched.
- Only those two values differed.

It was deployed at 100% at 04:11 UTC.

Monitoring settings were checked afterward:

- logs on, including invocation logs, at sampling rate 1;
- traces off;
- Issues on;
- the tail consumer still attached.

## Live verification

- **Assets.** All 106 built JavaScript and CSS files are served byte-identical to the release build. The served index matches after removing the one script Cloudflare injects.
- **Health.** `/api/health/tarot-reading` reports `openai-native`, and `/api/health/tts` returned `ok`.
- **Guest UI.** Browserbase returned HTTP 402 because the free plan's browser minutes were used up, so `npm run deploy` exited nonzero after the upload. The same guest checks then ran in local Chromium against production at 1280×900 and 390×844. All four passed at both sizes, with no page errors or failed requests.
- **Live readings.** One guest three-card reading ran through the streaming route on each new version:

  | Version | Model in the Worker log | Time |
  | --- | --- | --- |
  | `3a00b28c` | `gpt-5.6-sol`, `xhigh` | 26 seconds |
  | `9ac98049` | `gpt-6-astra`, `high`, medium verbosity | 52 seconds |

  Both were served by `openai-native` without fallback and named every drawn card. Both showed the corrected Symbol Cue and reported `no_patterns_detected` for GraphRAG.

## Not verified

- Signed-in Pro flows. This includes the Relationship Snapshot prose fix in a live reading, because guests can't use that spread.
- Follow-up answers and journal summaries on OpenAI.
- Vision qualification, Browserbase cloud browsers and physical devices.

## Known limits

- Non-streaming JSON callers get 90 seconds per attempt. A Celtic Cross on `gpt-6-astra` at `high` took 90–103 seconds in QA. Web and ChatGPT readings run as streamed jobs, which have the whole 240-second budget.
- The release gate reads model settings from `wrangler.jsonc`, but production uses its live variables. Keep the two equal when changing models.
- A quality-rejected OpenAI answer isn't retried; only Modal gets a retry.

## Evidence

Private evidence is kept outside the repository, under `~/.local/state/tarot/`, in one directory per attempt:

- `release-959a0125-20261106T015108Z/`
- `release-7bafb2eb-20261106T021434Z/`
- `release-42ee4362-20261106T024715Z/`

They hold the deploy logs, narrative samples and metrics, version snapshots, guest-check reports, live-reading outputs and the scripts that produced them.
