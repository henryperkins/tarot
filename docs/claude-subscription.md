# Personal Claude subscription inference

This optional mode sends non-Cloudflare text generation through the owner's
Claude subscription using the official `claude -p` interface. It covers readings,
follow-up answers and repairs, journal summaries, and offline
narrative sample generation. Workers AI grading, embeddings, coaching extraction,
vision, speech and story art retain their existing integrations.

Question suggestions always use Workers AI, independently of `TEXT_PROVIDER`,
and fall back to the coach's local templates when generation fails.

The service is for the subscription owner's personal use. Subscription-backed endpoints require
the configured owner's authenticated account; anonymous callers, other users and
shared service accounts cannot spend the subscription. See Anthropic's
[subscription guidance](https://support.claude.com/en/articles/15036540-use-the-claude-agent-sdk-with-your-claude-plan)
and [credential-use rules](https://code.claude.com/docs/en/legal-and-compliance).

## Start the local service

Use Node 24 and Claude Code 2.1.286 or later. Install this repository's dependencies
with `npm ci`. The service uses the installed CLI and needs no extra SDK package.

1. Run `claude auth login` on the service host and choose your subscription account.
   `claude auth status` should report `claude.ai`, `firstParty`, and your paid plan.
2. Copy [example.env](../services/claude-code/example.env) to
   `services/claude-code/.env.local`. Generate a gateway token with
   `openssl rand -hex 32` and replace the example value. Use a distinct secret,
   never a Claude credential, for this token.
3. Run `npm run dev:claude`. The service listens on `127.0.0.1:8789` by default.

The CLI inherits only basic OS variables and uses the host's stored login.
Each inference verifies subscription authentication. API keys, bearer overrides,
third-party provider flags and custom Node startup code are excluded. The service
rejects an API-authenticated login; it does not switch to paid API billing.

Run the service as the same OS user who completed `claude auth login`. Renew
expired login credentials on that host. This service rejects `CLAUDE_CODE_OAUTH_TOKEN`:
the CLI does not report a verifiable subscription plan for setup-token credentials.
Do not use `--bare`, which disables subscription authentication.
See the [authentication reference](https://code.claude.com/docs/en/authentication).

## Connect local Tableu

Add these settings to this checkout's untracked `.dev.vars`:

```dotenv
TEXT_PROVIDER=claude-code
CLAUDE_CODE_GATEWAY_URL=http://127.0.0.1:8789
CLAUDE_CODE_GATEWAY_TOKEN=the-same-random-gateway-token
CLAUDE_CODE_OWNER_USER_ID=your-existing-tableu-user-id
CLAUDE_CODE_TIMEOUT_MS=300000
```

The owner is the `users.id` of your existing Tableu account, not your email or
Claude account ID. Existing Tableu tier, ownership and usage checks still apply.
Log into that account in Tableu, then start the normal `npm run dev` stack.

The default `TEXT_PROVIDER=legacy` in Wrangler keeps an unconfigured deployment
working. Switching to `claude-code` takes priority over configured Modal, OpenAI
and Azure credentials. Invalid provider names are configuration errors. A missing
owner denies access. A missing or unavailable gateway permits only existing local
reading/summary fallbacks; follow-ups return their existing retry error.

## Runtime behavior

- All subscription tasks default to Opus 5.5 (`CLAUDE_CODE_MODEL=claude-opus-5-5`)
  with `CLAUDE_CODE_EFFORT=xhigh`. The service explicitly passes `--model` and
  `--effort` to every CLI generation, including repairs and memory continuations.
  Model IDs are pinned for repeatable eval comparisons; reading prompt metadata
  and offline samples record the actual model returned by Claude. The example
  configuration lists optional per-task model overrides. Effort accepts `low`,
  `medium`, `high`, `xhigh`, or `max`; invalid settings stop before launching the CLI.
  See [Claude's model and effort configuration](https://code.claude.com/docs/en/model-config#adjust-effort-level).
  Existing installations should update the model and effort in the service host's
  `.env.local`, remove any unwanted per-task model overrides, and restart the service.
- The CLI receives Tableu's assembled prompts in a fresh temporary directory.
  Customizations and built-in tools are disabled; conversation sessions are not
  persisted. Temporary prompt files are private and removed after each call.
- Follow-up history remains in Tableu. Structured memory decisions are validated,
  executed through the existing owner-scoped memory handler, and followed by a
  continuation containing the real result. At most two new memory calls are allowed.
- Upstream output is buffered until the CLI reports successful completion. Existing
  reading and follow-up content checks run before the HTTP/SSE response is delivered.
- Default concurrency is one, with at most eight queued requests and a 60-second
  queue wait. Requests have a five-minute overall deadline. Cancellation terminates
  the CLI process group; partial/truncated results are never accepted as readings.
  Normal shutdown (`SIGTERM` or `SIGINT`) cancels queued and active work, waits for
  process cleanup, and removes temporary prompts. Run the service directly under
  your process manager so it receives those signals.
- Subscription limits are shared with your interactive Claude usage. Rate limits,
  expired authentication and upstream errors never trigger paid-model fallback.

`GET /healthz` requires the gateway Bearer token and reports queue state. It checks
service liveness, not subscription login or inference availability. The inference
endpoint is `POST /v1/generate`; both endpoints are private and send no CORS grants.
Error responses omit upstream prompts, account details and credentials.

## Run narrative evals

Narrative generation and release qualification always use the Claude subscription.
With the existing Claude Code subscription login on this host, run directly:

```bash
npm run ci:narrative-check
npm run ci:release-check
```

No gateway, API key, `TEXT_PROVIDER` export or additional login is needed when the
host is already authenticated. The runner verifies subscription authentication,
uses the production `claude-api` reading prompt and request builder, and defaults
to Opus 5.5 at `xhigh`. Release checks verify local login before starting code
checks; configured gateways validate their configuration and verify subscription
login on the service host when generating.
Missing login, usage limits and timeouts fail without paid API fallback. Explicit
paid backend overrides are rejected even if their keys exist or the Worker uses
`TEXT_PROVIDER=legacy`.

The eval runner layers exported variables over Wrangler variables; it does not
read `.dev.vars` or the service's `.env.local`. Qualification pins each request to
`ANTHROPIC_MODEL` and `ANTHROPIC_EFFORT` (the production defaults apply when unset),
with a 32,000-token output ceiling including thinking. CLI host model/effort
defaults cannot override these pins. The runner disables the server-side advisor
tool, and qualification rejects a response from a different model. Samples record
the actual returned model, requested settings, authentication and local/gateway
transport. `NARRATIVE_EVAL_BACKEND=local-composer`
remains a deterministic diagnostic; release QA rejects it. Cloudflare's model
judge retains its separate integration.

Hosted runners that cannot access the owner's CLI login must use the private
service above. Set `CLAUDE_CODE_GATEWAY_URL` and `CLAUDE_CODE_GATEWAY_TOKEN` in that
runner's environment. Workers Builds needs its own private build settings.
GitHub Actions billing is permanently unavailable; production releases run
`npm run deploy` locally with the existing CLI login. The GitHub deployment
workflow is a manual reference and is not a release prerequisite.
The gateway uses the host's subscription login; the bearer token
is only a private service credential. A partial or unavailable gateway fails the
gate without switching to the local CLI or a paid API. Public Worker inference
settings remain independent of these evaluation-only settings.

## Optional later remote connection

A deployed Worker cannot reach your laptop's loopback interface or spawn Claude
Code. Run the service on a persistent host and expose it through a private HTTPS
reverse proxy or tunnel. Set the Worker gateway URL, gateway secret and owner ID
together before enabling subscription mode. Claude subscription credentials stay
on that host. Public/shared inference requires a separately supported billing setup.

Provisioning a tunnel, setting remote secrets, and deploying are separate operations.
No migration is required. Reverting `TEXT_PROVIDER` to `legacy` restores the prior
provider routing without changing stored readings or Cloudflare inference.

## Initial verification on 2026-10-01

- Root Node suite: 2,618 tests passed, including 36 new provider, route, memory,
  authentication, cancellation, queue and process-shutdown tests.
- Live personal Max subscription: question generation and a structured memory
  decision with continuation passed. All 11 narrative samples used `claude-code`
  and reported the actual model `claude-sonnet-5-5` through Claude Code 2.1.286.
- `npm run ci:narrative-check` passed using those live generations and the offline
  deterministic grader. This does not qualify the separate Cloudflare model judge.
- Frontend build, Worker dry build, maintained documentation links and changed-file
  ESLint passed. The Worker bundle excludes the Node CLI service.
- Repository-wide ESLint still reports 132 errors and 36 warnings. The findings
  match the unchanged files under the original ESLint configuration.
- No deployed Worker, remote tunnel or remote secret configuration was changed.

## Opus 5.5 update verified on 2026-10-01

- The service defaults to `claude-opus-5-5` with `--effort xhigh`. Subprocess tests
  verify both flags for every task and reject invalid effort before CLI startup.
- Root Node suite: 2,624 tests passed. Changed-file ESLint, documentation links,
  Worker dry build and narrative prompt assembly checks passed.
- Live subscription question generation, structured memory decisions and their
  continuations passed. All 11 narrative samples reported `claude-opus-5-5`.
- The first deterministic gate run mistook the Star's literal "pair of cups" for
  "Page of Cups". The detector now requires a recognized rank or explicit card-title
  context for fuzzy minor-card matching; genuine misspelled-card detection remains
  covered by tests. Re-scoring the same saved outputs passed the unchanged gate
  thresholds, with only that false-positive result changed.
