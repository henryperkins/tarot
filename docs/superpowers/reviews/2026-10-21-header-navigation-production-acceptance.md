# Direction A post-merge production verification and acceptance

**Status:** Production matches `4f6ed43e6ba7d8035e4eb78c9927f6bae21a3be9`. All **38 fresh live guest browser scenarios pass**, with zero failures, skips, retries or JavaScript page errors. **Full acceptance remains open:** a real production Pro session and physical iOS/Android devices require access that is not available in this environment.

Production and browser checks ran on **2026-10-21, 13:05–13:12 CDT (America/Chicago)**. Raw evidence uses UTC timestamps. This is a new addendum to the [approved specification](../specs/2026-10-21-shared-app-navigation-design.md), [completed remediation checklist](../plans/2026-10-21-header-navigation-final-remediation.md), [three-regression report](2026-10-21-header-navigation-final-remediation-review.md), [logo token cleanup](2026-10-21-header-navigation-logo-token-cleanup.md) and [historical Gate 2 report](2026-10-21-header-navigation-gate2-review.md). Their contents and existing critiques are preserved.

## Production identity

| Check | Fresh result |
| --- | --- |
| Local master and remote master | Both point to `4f6ed43e6ba7d8035e4eb78c9927f6bae21a3be9` |
| Local and remote Direction A branch | Same commit |
| Worker | `tableau`, account `a77e479f6736120eadd99973dbeb705e` |
| Active deployment | `57359df9-1c91-4109-b015-795d3dd79083` |
| Active Worker version | `5bc82119-c7d5-415f-a93d-fb13856648fb`, 100% traffic |
| Deployment and runtime settings before/after browser checks | Unchanged |
| Frozen release checkout | All 3,293 recorded source inputs retain their recorded SHA-256 hashes; checkout HEAD is the expected commit |
| Live JavaScript/CSS assets | All 100 return HTTP 200 and match the recorded release and local release-build bytes |
| Primary routes | `/`, `/journal`, `/account`, `/pricing`, `/journal/gallery`: HTTP 200 with the expected release entry assets |
| Health | `/api/health/tarot-reading` and `/api/health/tts`: HTTP 200 JSON |
| Real guest authentication | `/api/auth/me`: HTTP 401, including in both browser engines |
| Design gate | Pass; zero product hex color literals |

The frozen release source manifest retains identity `6aa23530ecbc6e8b518f1b806358165ff2000c8d603d45565d8b30298ba2e65f`. Production identity is established by the active immutable version matching the recorded release, that release's frozen source inputs and the served asset hashes together. The earlier release had already deployed this commit before its fast-forward into master.

The existing runtime values remain `MODAL_TEMPERATURE=1`, `OPENAI_MODEL=gpt-6.1-sol` and `LOG_LLM_PROMPTS=true`; Issues remains enabled. All Cloudflare operations in this verification were GET requests. No deployment or runtime configuration change was performed.

## Fresh live browser acceptance

The CLI used Chromium **155.0.8059.12** and WebKit **26.6** against [the production site](https://tarot.lakefrontdev.com). Each scenario created and closed an isolated browser context. Authentication and subscription APIs were not intercepted. Guest preferences and completed readings were seeded only in isolated browser storage and are synthetic fixtures.

| Coverage | Chromium | WebKit | Required observations |
| --- | ---: | ---: | --- |
| FIN-01 progress layout | 8 passed | 8 passed | 320px/390px × setup/completed × dark/light; normal, 200%, then restored normal text |
| FIN-02 preparation dismissal | 6 passed | 6 passed | Escape, close button, Done, backdrop, Back and desktop breakpoint transition |
| FIN-03 requested tabs | 2 passed | 2 passed | Setup and completed reading; Ritual first opening/reopening, plus explicit Deck opening |
| Question, deck and ritual facts | 1 passed | 1 passed | Question, Thoth selection, three knocks and confirmed cut at position 7 survive closing/reopening |
| Deferred installation | 1 passed | 1 passed | Pending simulated native result survives completed-reading drawer closure; host identity, single prompt and focus return retained |
| iOS installation guidance | 1 passed | 1 passed | Guidance opens by keyboard and returns focus through the guide and drawer |
| **Total** | **19 passed** | **19 passed** | **38 passed; 0 failed/skipped/retries** |

The progress cases contain **48 geometry observations** across normal/enlarged/restored text. Each checks separate label containment, target separation, minimum 44px dimensions, center hit testing, horizontal overflow, one current step, sequential keyboard access and focus outlines. Relative geometry returns to its original state after text shrinks.

Every dismissal case checks that the confirmation is unmounted, the overlay history guard and page locks are released, visible focus is restored and the original route history entry is retained. A subsequent Back reaches Journal and Forward returns to Reading without a hidden confirmation.

The pending native-install response is simulated in both engines with a non-iOS user agent. The iOS guidance cases use an iPhone Safari user agent. These checks establish application control lifetime and focus behavior; they do not establish a physical installation, browser offer timing or native Share-sheet behavior.

There were zero JavaScript page errors and zero reading-generation requests. Browser observers recorded telemetry envelope POSTs; no production journal, account, membership or billing mutation action was invoked. No live reading inference was exercised.

Twenty screenshots were retained. Visual inspection covered enlarged 320px completed progress in light Chromium and dark WebKit, Chromium deferred-install focus return and WebKit iOS guidance. The two enlarged progress captures show separate labels and targets; the installation captures show the retained reading canvas and accessible guidance dialog.

These 38 cases are a fresh guest acceptance run. The historical 942-case Gate 2 matrix and previous 52-case live fixture run retain their original source, scope and results. They are not counted again here. Pending-generation preservation remains supported by the earlier release evidence; this run exercises setup and a restored completed reading without starting a production generation.

## Acceptance still requiring access

| Remaining check | Status and prerequisite | Completion evidence |
| --- | --- | --- |
| Real production Pro session | **BLOCKED:** no production-approved credential file or browser session was supplied or found in the configured Tableu credential directory | Real login succeeds; unmodified `/api/auth/me` establishes Pro/active; Reading, Journal and Settings navigation and an existing reading retain state; log out afterward |
| Physical iOS device | **BLOCKED:** no physical-device tool, device-service connection or attached iOS device is available | Record model/iOS/Safari version and test enlarged text, orientation/browser chrome, drawer dismissal, Ritual/Deck reopening, Add to Home Screen guidance/native flow and focus return |
| Physical Android device | **BLOCKED:** no physical-device tool, device-service connection or attached Android device is available | Record model/Android/Chrome version and test enlarged text, orientation/browser chrome, system Back, Ritual/Deck reopening, native install flow and focus return |

The available reviewer account has scope `local-development-only` at `http://localhost:8787`. The [reviewer instructions](../../local-reviewer-account.md) explicitly say, “Never use these credentials against a live site.” It was not used against production. No password, session cookie, authentication token or persistent browser session state was recorded.

The configured tool inventory exposes no physical-device connection. `adb`, `idevice_id` and `xcrun` are unavailable, and no device-service or remote-browser connection environment variable is configured. Browser mobile/touch emulation is recorded as emulation throughout. Access details were requested while independent checks continued; these remaining rows cannot be marked passed without that access.

## Evidence and preservation

Evidence directory:

`/home/ubuntu/.local/state/tarot/direction-a-production-acceptance-20261021T180515Z-3a91_9w_/`

- `acceptance-verification.json`: source, deployment, browser totals, evidence limits and outstanding access.
- `cloudflare-before.json`, `cloudflare-after.json`: fresh active deployment and safe runtime metadata.
- `production-http.json`, `verify_production_http.py`: route, health, guest auth, 100 asset hashes and source-input verification.
- `{chromium,webkit}-{geometry320,geometry390,dismissal,preparation}.json`: all eight browser batches, including geometry, errors and observed mutation-request paths.
- Matching `.cli.json` logs and `.js` files, `browser-acceptance-template.js`, `run_browser_batch.py`: exact CLI results and repeatable scenario definitions.
- `browser-metadata.json`, `browser-cleanup.json`: engine versions, guest auth, isolated-context closure and closure of the two owned sessions.
- `remaining-access.json`: the real Pro and physical-device access gaps.
- `design-gate.json`, `design-gate.log`: fresh passing token gate.
- `document-validation.json`, `preservation-final.json`: final links, whitespace and three-worktree preservation checks.
- Twenty PNGs and their hashes in `acceptance-verification.json`.

The new addendum is the only repository file added or changed by this task and remains uncommitted. Before/after manifests preserve all pre-existing file bytes and modes, raw indexes, HEADs and dirty states in main, Direction A and the prototype. All 58 unrelated dirty/untracked files in main, including its existing critiques, retain their original contents. Refs, stashes and worktree registrations are unchanged. Historical reports are retained verbatim.

Both owned browser sessions and every per-scenario context were closed. The unrelated pre-existing `flavor-production` browser session remains open. No application source, test, deployment or existing critique was modified.
