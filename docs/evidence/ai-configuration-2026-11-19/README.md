# AI configuration dashboard acceptance

Type: evidence
Status: historical snapshot
Last reviewed: 2026-11-22

## Original dashboard acceptance

The first dashboard verification used source tree `a46ff7bfaa14072dd696244ab93fa2b7f36e0c01`, based on `b1e9ce9f`. The two screenshots use controlled browser fixtures. A separate Chromium run used the built React app, the actual Worker, migrated local D1 and a SQLite sample Durable Object. Synthetic OpenAI and Workers AI responses made the requested effort, delivered output and failure cases reproducible.

| Behavior | Observed result |
| --- | --- |
| Submit, edit, leave and retry | The browser stayed in the editor during a held write and during a held acknowledgement after D1 had committed. Each save produced one revision. Replaying a lost acknowledgement retained the newer draft. Confirming Back reached the previous document once. |
| Retired models and catalog upgrades | Replaced a retired primary and fallback in one revision. A legacy GLM Medium entry opened clean at effective Max. Tests checked stale-editor conflicts, invalid rebased fallbacks, incompatible schemas and exact retry behavior. |
| Reasoning and sample attribution | Adapter tests exercised both GLM models across the four Workers AI features. A two-call follow-up fixture showed the Low-effort repair as the source of the corrected text. |
| Focus, viewport and authentication | The reference state showed High saved, Medium tested and Low edited at 1280 × 853. At 320 × 256 and 320 × 380, ordinary clicks and keyboard focus reached the sample with a multi-field diff. Chromium and mobile WebKit also exercised navigation and focus. Logout and expiry returned to a masked, empty credential field. [Desktop frame](readings-earlier-draft.png) · [Short-viewport focus](sample-focus-320x256.png) |
| Readiness and gate policy | Tests compared actual TTS availability, visual-cue validity, embedding availability and ordinary/mandatory gate decisions with the catalog. Missing sample storage displayed a reason beside the disabled button. |
| Persistence and history | The browser saved and reloaded all seven assignments and exercised all seven history filters, with 55 D1 revisions and a second page of Readings changes. Separate timezone cases displayed the same UTC times and distinct Before and After orders. |

The integrated walkthrough recorded zero reader, quota and evaluation writes and zero external provider requests. Hosted deployment and live dashboard-provider health require separate evidence. [Browser regressions](../../../e2e/admin-ai-configuration.spec.js) · [Stored assignment recovery](../../../e2e/admin-ai-configuration-recovery.spec.js) · [Built dashboard workflow](../../../e2e/admin-ai-configuration-workflow.spec.js) · [Readiness tests](../../../tests/aiConfigReadiness.test.mjs)

The full Node suite ran on tree `a46ff7bf` in an isolated checkout with LF line endings. It passed 6,605 tests, skipped 32 and recorded zero failures. The combined browser suite passed 19 cases across Chromium and mobile WebKit. The production frontend built successfully. The accessibility checks reported zero errors and 1,028 warnings. Repository lint reported zero errors and 49 warnings. The narrative gate completed 11 subscription-generated samples with zero flags and passed 874 prompt assembly fixtures.

The separate vision release gate requires an independently labeled, held-out three-deck photo corpus and matching source evidence. This checkout had reference art only. The gate rejected the available evidence and the reference-art diagnostic run was stopped. [Vision qualification requirements](../../vision-evaluation-integrity.md)

## Browser-managed configuration and local sign-in

The extended Chromium and mobile WebKit suite passed all 22 cases. The local password workflows covered first-time setup, enrollment from an existing admin session, password changes, logout and reauthentication. A running Worker that had missed the new setup code initially returned HTTP 401. After a restart, the launcher verified a fresh challenge before opening the setup form. Enrollment succeeded on the local installation. Isolated tests also cover missing and stale proofs. [Launcher checks](../../../tests/localAdminLauncher.test.mjs) · [Password workflows](../../../e2e/admin-local-access.spec.js)

The provider editor replaced credentials for all four editable providers, exercised both Modal authentication modes, recovered from concurrent edits and an interrupted acknowledgement, and retained an unsaved feature draft. A separate Worker test observed the active key on a synthetic OpenAI transport, verified fallback after disconnect and restored the inherited connection. The same test exercised narration availability and used the private key-storage binding without a preconfigured encryption key. [Provider editor](../../../e2e/admin-provider-connections.spec.js) · [Provider runtime](../../../tests/providerConnectionWorker.test.mjs)

Source tree `398ffd2e77a5afccddedb004d4b8cedc4709dbd8` passed 6,619 Node tests with 32 skipped and zero failures. Source lint reported zero errors and 49 warnings. Accessibility checks reported zero errors and 1,031 warnings. The narrative evaluation produced 11 samples with zero flags. Its frozen-byte assembly check required the canonical LF checkout, where all 874 fixtures and 2,541 provider builds passed.

## Local owner subscriptions

The running local development server reported ready subscription logins for both Codex / ChatGPT and Claude Code. A disposable Tableu reader linked Codex through the owner API and ran the fixed three-card sample. Its receipt completed after one real Codex generation. Codex returned prose for The Hermit, Two of Wands and Eight of Pentacles, with `gpt-6.1-sol` recorded as its configured model. The CLI omitted the response model ID. The check used an isolated Worker database and left the local reader link available for the owner.

The browser tests cover registration, sign-in, linking, provider switching, sample receipts, access by a different reader and unlinking. Worker tests exercise both provider adapters with controlled responses, including a reported Claude model. Claude's live check verified its login only. [Browser workflow](../../../e2e/admin-owner-subscription.spec.js) · [Owner endpoint and job tests](../../../tests/ownerSubscription.test.mjs) · [Reader routing](../../../tests/codexSubscriptionRouting.test.mjs)

Source tree `371bfca254c45ee82ff6d5974a6398cfbe4a6649` passed 6,627 Node tests with 32 skipped and zero failures. All 23 admin browser cases passed in the development checkout on November 19. The browser log did not record a Git revision. The owner workflow also passed on a 390-pixel phone viewport. The production frontend built, and the running local Worker served the rebuilt assets. The offline narrative prompt assembly check passed all 874 fixtures and 2,541 provider builds.

## PR review on November 22

On commit `b07f476d877c71fcfebeb699cc494a1f89d0915a`, the reviewer reported 103 passing tests across 18 targeted files, zero scoped ESLint errors, 271 documentation files with valid local links and a successful frontend build.

## Verification after review cleanup

The checks below used commit `426a6122831ac835136d2262f12e1792057fb97c`, which includes the audit actor and quality-stats fixes.

| Check | Result |
| --- | --- |
| Full Node suite | `npm test` on Ubuntu 26.04 (WSL), Node 24.18.1 and LF sources passed 6,658 tests with zero failures. The three skips were two installed-CLI integration checks and a Windows-only process cleanup test. |
| Admin browser suite | All 23 cases passed in one run (22 Chromium, one mobile WebKit) using the Playwright 1.62.1 Noble image and `npx playwright test 'e2e/admin-.*' --workers=1`. The mobile case also passed on Windows. |
| Frontend build | `npm run build` passed. |
| Lint and documentation | `npm run lint` reported zero errors and 49 warnings. `npm run docs:check` validated links in all 243 maintained Markdown files in the clean checkout. |

The Ubuntu Node run used a private loader cache for WebKit's native dependencies. An earlier two-worker admin browser run hit a connection reset while loading a Vite asset. The single-worker run passed all cases without retries.
