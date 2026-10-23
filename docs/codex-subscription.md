# Codex ChatGPT subscription provider

Type: runbook
Status: active reference
Last reviewed: 2026-10-23

Tableu can use the host's signed-in Codex CLI for personal reading generation,
follow-ups (including their structured memory decisions and repairs), and journal
summaries. Select `TEXT_PROVIDER=codex-subscription`. The existing Claude option
and legacy API routing remain separate choices. Suggested questions and visual
cues keep their existing Workers AI integration; they do not enter the narrative
prompt or consume this provider.

## Local reading beta

With Node 24 and Codex CLI **0.162.0** installed, run `codex login` on the service host.
`codex login status` must report a ChatGPT login. Then, from this worktree:

```bash
npm run dev:reading-gestures -- --provider codex-subscription --check
npm run dev:reading-gestures -- --provider codex-subscription
```

Open <http://localhost:5175/> and sign in with the documented private
[local reviewer account](local-reviewer-account.md). To select your own existing
account in the beta's isolated local database, append
`--owner-email your-local-account@example.com`. An unknown, inactive, or service
account fails startup. This changes the subscription owner for this local process,
not the account's billing plan or production configuration.

The runner creates a private gateway token and local configuration, keeps local
storage isolated, and starts the gateway, Worker and frontend together. See the
[beta guide](dev-reading-gestures.md) for ports, storage and cleanup details.

## Standalone gateway

Copy [example.env](../services/codex-subscription/example.env) to
`services/codex-subscription/.env.local`. Generate a separate gateway secret
with `openssl rand -hex 32`, put it in that private file, and run:

```bash
npm run dev:codex
```

Configure the local Worker in its untracked `.dev.vars`:

```dotenv
TEXT_PROVIDER=codex-subscription
CODEX_SUBSCRIPTION_GATEWAY_URL=http://127.0.0.1:8789
CODEX_SUBSCRIPTION_GATEWAY_TOKEN=the-same-random-gateway-token
CODEX_SUBSCRIPTION_OWNER_USER_ID=your-existing-tableu-user-id
CODEX_SUBSCRIPTION_TIMEOUT_MS=300000
CODEX_SUBSCRIPTION_STREAMING_ENABLED=true
```

The owner is a Tableu `users.id`, not an email or ChatGPT account ID. A missing
owner denies access, and service accounts cannot spend the personal subscription.
Existing Tableu subscription and usage checks still apply. An invalid provider
name is a configuration error. Gateway failure never falls back to a paid API.
Buffered reading/summary fallback and follow-up retry behavior remain; an already
started live reading fails explicitly instead of appending a replacement reading.

The gateway defaults to `127.0.0.1:8789`. Both `GET /healthz` and
`POST /v1/generate` require its bearer token. Health reports service/queue state,
not an inference or subscription-availability guarantee. Do not reuse a ChatGPT
credential as the gateway token or expose the gateway as a public shared service.

## Execution contract

The provider uses Codex's supported noninteractive CLI and stored ChatGPT login,
not a copied OAuth token or a reverse-engineered HTTP endpoint. API-key login is
rejected and API-key environment variables are excluded. Subscription usage and
limits are shared with the host's interactive Codex use. Authentication remains
on the host; the Worker receives only application text and result metadata.
See OpenAI's [authentication](https://developers.openai.com/codex/auth),
[noninteractive execution](https://developers.openai.com/codex/noninteractive), and
[app-server](https://developers.openai.com/codex/app-server) documentation.

Requests run in private temporary directories with session persistence disabled.
Buffered requests use `codex exec --ignore-user-config`. Streaming uses app-server,
which lacks that switch: the runner disables startup integrations and exports,
overrides application instructions, and privately reads the effective configuration
to disable every MCP server before starting an ephemeral thread. The thread has
no host environments. Both paths use a sanitized model catalog to remove shell
and patch capabilities and disable repository instructions and external tools.
The installed CLI's outgoing tool schema and startup side effects are checked
with local fixtures independently of live model generation. Structured responses
are validated against the application's schema before use. Errors omit prompts,
credentials and raw upstream diagnostics.

The runner accepts only the validated CLI version. An upgrade needs the installed
CLI isolation check repeated before changing that allowlist. Codex's JSON event
output does not identify the response model authoritatively, so metadata marks
the pinned model as `modelSource: configured`, rather than claiming it was reported
by the response. Output has a byte limit and each gateway request has a deadline;
this CLI path does not promise a token-count cap.

The default is `gpt-6.1-sol` with `high` reasoning. Set
`CODEX_SUBSCRIPTION_MODEL` and `CODEX_SUBSCRIPTION_EFFORT` on the service host to
change them.

## Live reading delivery

The local Codex beta enables `CODEX_SUBSCRIPTION_STREAMING_ENABLED=true`. The
Worker requests SSE from the private gateway, which forwards final-answer text
deltas from Codex app-server as they arrive. Reasoning, commentary and tool
messages are excluded. Structured follow-ups and summaries retain their buffered
JSON contract.

The Worker holds incomplete sentences, checks completed passages with the existing
deterministic content rules, and delivers accepted text immediately. Final quality
checks still run before `done`. These passage checks are not a substitute for a
whole-reading model assessment: requests requiring that assessment, including the
existing restricted-topic and unsupported-language policy, retain buffered delivery.
Enabling the global evaluation gate also retains buffering.

Delivered prose is immutable: the final source must exactly equal the joined
deltas, including whitespace. A provider error, failed quality check, timeout or
cancellation terminates the live attempt and releases its quota reservation; it
does not append a fallback or replay a completed reading. The independent visual
observer receives those same delivered passages without delaying text. Visual cues
can still arrive after the passage or after completion.

No production deployment, tunnel or remote credentials are configured by this
change. A deployed Worker needs a separately provisioned private HTTPS gateway;
it cannot reach this machine's loopback service. Repository release qualification
continues to use its established Claude subscription policy.

## Verification on 2026-10-09

The recorded live checks below used `medium` reasoning, before the default
changed to `high`. Their timings do not establish latency at `high`.

- Root Node suite: 3,280 passed, zero failures; two installed-CLI checks are
  opt-in and skipped in the ordinary suite. Both passed separately with
  `TABLEU_CODEX_CLI_CHECK=1 node --test tests/codexSubscriptionIsolation.test.mjs`.
- Installed-CLI checks use a local controlled Responses endpoint and no model
  inference. They verify zero tools, no host instructions or authorization header,
  no hostile MCP/hook startup execution, and a delta before model completion.
- A fresh reading in real desktop Chromium used normal local Pro authentication,
  the actual reading screen, reading job, gateway and ChatGPT subscription. First
  text delta arrived at 8.71 seconds; the first visible passage appeared at 9.47
  seconds, with generation still underway. The reading completed at 23.81 seconds:
  25 passage deltas, 23 visible updates before completion, and 2,553 characters.
  Joined deltas exactly matched the final source. The reviewer was logged out.
- The first live attempt caught a connection override that sent subscription
  requests to the API route. The override now matches the CLI's ChatGPT route;
  its boundary regression and the subsequent live browser run passed. The public
  [Codex provider implementation](https://github.com/openai/codex/blob/main/codex-rs/model-provider-info/src/lib.rs)
  distinguishes these authentication routes.
- The controlled browser regression for holding card inspection while new prose
  arrives passed. Transport tests cover partial failure, cancellation, deadlines,
  cleanup failure, exact source consistency and preservation of full evaluation
  gates. Independent runner review found no remaining verified issues.
- Production frontend build, changed-source lint, 182 maintained Markdown link
  checks and diff whitespace checks passed.

These are local checks, not production deployment or broad narrative quality
qualification. This streaming repair did not reassess phone layouts, real devices,
visual-model timing or multilingual generation. The visual observer still receives
accepted prose independently; no new claim about visual cue latency is made here.
Configured model metadata remains explicitly configured, not response-confirmed.

Earlier buffered-provider verification also covered a real follow-up and completed
visual job. Those earlier results establish neither streaming nor visual timing for
this run. Structured follow-ups and journal summaries remain buffered by design.
