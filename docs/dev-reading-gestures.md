# Reading gestures development beta

## Current aligner candidate

The protected beta instructions below describe the earlier model-enabled development environment. Do not restart that checkout or reuse its ports to review the aligner candidate. Current work is recorded in the [aligner execution review](superpowers/reviews/2026-10-11-reading-aligner-release.md).

The updated source separates two exact opt-ins:

| Build flag | Behavior |
| --- | --- |
| `VITE_READING_ALIGNER_ENABLED=true` | Enables the ordinary production reading/journal companion. Default off. |
| `VITE_READING_MODEL_ANNOTATIONS=true` | Allows annotation requests only when presentation is also enabled. Default off; leave off for the aligner release. |

Existing development/controlled-validation presentation still supports `VITE_READING_GESTURES=true`; that flag alone no longer grants model-request consent in this updated source. Server admission, subscription eligibility and qualified model configuration remain separate requirements. The existing running beta's files/configuration were not changed.

The [aligner plan](superpowers/plans/2026-10-11-reading-aligner-release.md) owns ordinary production acceptance through `scripts/evaluation/runReadingAlignerAcceptance.mjs`, with explicit source/output manifests, owned loopback ports and recorded prose. It does not use the development fixture route or permit provider calls. Physical VoiceOver, real authentication and deployment evidence remain separate.

## Historical model beta setup

Run from the reading bridge worktree:

```bash
npm run dev:reading-gestures -- --check
npm run dev:reading-gestures
```

To use the host's Codex ChatGPT login for the reading instead:

```bash
npm run dev:reading-gestures -- --provider codex-subscription --check
npm run dev:reading-gestures -- --provider codex-subscription
```

The default owner is the private reviewer account. To use your own existing
account in this isolated beta, add `--owner-email your-local-account@example.com`.
The runner resolves an active local account before starting inference; it does
not create that account or change its plan. Only the selected owner can use the
subscription provider. `--check` checks the login and configuration prerequisites
without modifying the database; the owner lookup happens on actual startup.

Open <http://localhost:5175/>. The API and real local authentication run at
<http://localhost:8787/>. Use the private credentials described in the
[local reviewer workflow](local-reviewer-account.md); the runner provisions only
that normal password account in its separate local database. A browser login to
the Worker origin also supplies the same-host session cookie to the Vite preview.
Guest readings cannot spend the owner's subscription.

The runner checks the selected subscription login, then starts its private service
in process on loopback port 8789. Claude remains the default: Opus 5.5 at `xhigh`.
Codex uses `gpt-6.1-sol` at `high`; host settings `CODEX_SUBSCRIPTION_MODEL` and
`CODEX_SUBSCRIPTION_EFFORT` can select another supported model and effort.
See [Codex subscription setup](codex-subscription.md) for authentication and
standalone gateway details. The independent visual candidate is explicitly
`@cf/zai-org/glm-5.3-flash` on Workers AI, with `low` reasoning effort and a
60-second deadline.
The Codex beta enables live passage delivery from app-server. Completed sentences
arrive during generation; requests requiring the existing full-reading assessment
remain buffered. Visual cues are observed independently from delivered prose.
Cloudflare credentials or a Wrangler login with Workers AI access are required.
Starting the service itself performs no model generation. Generating a reading
uses the subscription and the separately billed Workers AI integration.

Private configuration, logs and persistent state live under the Git-ignored
`.wrangler/reading-gestures-beta/` directory. The runner applies migrations only
to that local D1 database and seeds the local reviewer using parameterized SQL
and the application's password hash. KV, R2 and Durable Objects also use isolated
local storage. AI is the sole remote binding. No production routes, database IDs,
service bindings, environment files or deployment settings are inherited.

The primary checkout's `.dev.vars` is never loaded. Child process environments
exclude Anthropic/OpenAI/Azure keys and arbitrary host overrides. The generated
gateway token remains in a private local vars file and is removed on normal
shutdown. Prompt logging and persistence are disabled. Logs remain private
because runtime errors can include application data; do not publish them whole.
The generated Vite configuration binds to loopback, restricts hostname requests
to localhost, and explicitly denies dotenv files, the complete `.wrangler`
tree and private authentication state through both regular and `/@fs` URLs.
These rules supplement filesystem permissions and Git ignores; those alone
do not prevent a development server from serving private files. The same policy
also applies to ordinary Vite development and controlled browser-test servers
through the shared base configuration, including previews on custom local ports.

Ports 8787, 8789, 5175 and 9235 must be free. The runner fails on conflicts without
killing existing processes. `Ctrl+C` stops only its own children and gateway;
the isolated reading/journal database survives a restart. The production config
and default gesture gates remain unchanged. The Vite development process opts
into `VITE_READING_GESTURES=true`.

This command establishes a development environment. Model accuracy, latency and
real-device behavior require separate evidence before production activation.

See the [live beta evidence](superpowers/reviews/2026-10-09-reading-gestures-live-beta.md)
for the fresh-question result, controlled regressions and remaining limitations.
Do not rebuild assets or edit Worker source during live timing verification:
Wrangler reload interrupts in-flight local jobs.
