# Browserbase guest UI smoke checks

Run a short guest journey against a deployed Tableu origin in Browserbase Chrome:

```powershell
npm run test:e2e:browserbase -- --url https://tarot.lakefrontdev.com
```

`npm run deploy` also runs this check after a successful Worker publish. Before
release QA or remote changes, it checks that a Browserbase key is available and
validates the target origin. The default target is `vars.APP_URL` in
`wrangler.jsonc`; `BROWSERBASE_SMOKE_URL` can explicitly override it. Use the
standalone command above for an already-published preview or production origin.
The URL override changes only the verification target, not Wrangler's deployment
destination.

Dry runs and migration-only commands do not require Browserbase credentials or
create browser sessions. Failed release QA or publication never starts a cloud
check. A failed check after publication returns a nonzero status and reports that
the Worker was published but guest verification failed; it does not roll back
the Worker or repeat publication. Inspect the report and replay before deciding
how to resolve the failure.

The existing `@browserbasehq/sdk` and `@playwright/test` development dependencies
are sufficient. The command reads `BROWSERBASE_API_KEY` from the environment,
then falls back to the existing, gitignored `.dev.vars`. No project ID, model
provider key, or additional agent framework is needed. Node 22.18+ is required,
matching the enrichment scripts.

One cloud browser session is reused for two fresh guest contexts: desktop
(1280×900) and narrow (390×844). Each context checks onboarding and its exit,
the three deck choices and three-card spread, the guest sign-in dialog, and
drawing/dealing/revealing three cards. It stops before interpretation and never
enters credentials. The narrow run is viewport emulation in Chrome; keep the
existing WebKit and physical-device checks for Safari and device evidence.

## Request guard

The context allows only read-only `/api/auth/me` and `/api/usage` API requests.
Other API requests, all HTTP writes, known model-provider hosts, external
navigation, and WebSockets are blocked before they reach the network. Service
workers are disabled so they cannot bypass the guard. Rendering and card-draw
checks use the actual deployed frontend; no model response is fabricated.
Blocked requests are recorded separately from network failures. Browserbase
browser time still applies; the script does not call Stagehand or Model Gateway.

## Evidence and cleanup

Each invocation prints its complete Browserbase session URL and writes a new
`output/playwright/browserbase/<timestamp>-<run-id>/report.json`, already covered
by `.gitignore`. The report contains each check's result, observed asset URLs,
runtime diagnostics, blocked requests, cleanup errors, and the final cloud
session status. It omits API credentials, request bodies, headers, connection
URLs, and URL query strings. The dashboard URL provides Live View during the run
and replay afterward.

```powershell
npm run test:e2e:browserbase -- --url https://your-preview.example --output-dir output/playwright/browserbase/my-run
npm run test:e2e:browserbase -- --help
```

`BROWSERBASE_SMOKE_URL` can supply the target instead of `--url`. Targets must be
public HTTPS origins with no credentials, path, query, or fragment; cloud Chrome
cannot reach this computer's localhost. Existing reports are never overwritten.

The script closes each context and disconnects from Chrome, then explicitly
requests release and checks the session status even if connection or UI checks
fail. Ctrl+C requests cleanup too. Sessions have a three-minute server timeout
as a final bound on an interrupted or failed connection. An uncertain create
request is not automatically retried.

Exit status is `0` only when both viewport runs and cleanup pass, `1` on failure,
and `130` on cancellation. A passing report establishes only the guest frontend
checks shown in that report. It does not establish real authentication, narrative
quality, journal persistence, the deployed Git revision, or a successful release.

Run the guard and lifecycle regression tests with:

```powershell
node --test tests/browserbaseSmoke.test.mjs
```

The guard test uses a local browser and controlled HTTP server, and skips if the
local Chromium binary is unavailable. The remaining tests need no cloud browser
or API access.

References: [Browserbase with Playwright](https://docs.browserbase.com/welcome/quickstarts/playwright)
and [session replay](https://docs.browserbase.com/platform/browser/observability/session-replay).
