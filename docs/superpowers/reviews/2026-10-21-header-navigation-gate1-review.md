# Direction A — Gate 1 remediation and visual evidence

Date: 2026-10-21. Status: **all reviewed Gate 1 findings addressed; ready for owner visual review.** Changes remain uncommitted in the isolated prototype. This report does not grant visual approval or qualify Gate 2 integration.

## Scope and authority

- Prototype worktree: `/home/ubuntu/tarot/.worktrees/header-nav-prototype-a`.
- Branch: `prototype/header-nav-a-gate1-20261021`; unchanged base/HEAD: `804c84cd4356ae4ace801517390b60a66fc59bd3`.
- [Approved design specification](../specs/2026-10-21-shared-app-navigation-design.md), preserved in the PR worktree.
- [Actionable remediation checklist](../plans/2026-10-21-header-navigation-remediation.md), mapped to every finding, NAV criterion, and original implementation step.
- Original nine findings and two smaller gaps are closed. All four follow-up P2 findings (R1–R4), including the final read-only review’s iOS choice and enlarged-text recovery regressions, are closed.

## Working previews and source identity

| Preview | Link | Identity |
| --- | --- | --- |
| Direction A state chooser | [Open the isolated prototype](https://terminals-maintained-bedford-andy.trycloudflare.com/prototype) | `direction-a-804c84cd-8b806ecbd38f` |
| Pro reading setup | [Open Reading](https://terminals-maintained-bedford-andy.trycloudflare.com/preview) | Synthetic Pro account |
| Pro completed reading | [Open completed Reading](https://terminals-maintained-bedford-andy.trycloudflare.com/preview/completed) | Deterministic saved reading |
| Pro Journal | [Open Journal](https://terminals-maintained-bedford-andy.trycloudflare.com/preview/journal) | Separate synthetic local D1 data |
| Pro Account | [Open Account](https://terminals-maintained-bedford-andy.trycloudflare.com/preview/account) | Separate synthetic local D1 account |
| Guest Journal | [Open guest Journal](https://terminals-maintained-bedford-andy.trycloudflare.com/preview/guest/journal) | Browser-local synthetic entry |
| Guest completed reading | [Open guest Reading](https://terminals-maintained-bedford-andy.trycloudflare.com/preview/guest/completed) | Includes 320px guest controls |
| Guest shared reading | [Open quiet share variant](https://terminals-maintained-bedford-andy.trycloudflare.com/preview/share) | Synthetic share, no destination dock |
| Original PR #118 | [Open unchanged comparison](https://elections-shoe-kernel-inn.trycloudflare.com/preview) | `804c84cd4356ae4ace801517390b60a66fc59bd3` |

The chooser also links guest setup, empty Journal, Account, and light-theme variants. These are temporary tunnel URLs backed by detached local services, not production deployments. Each bootstrap signs into or out of the synthetic identity on this preview origin only. No approved local reviewer credentials are used or exposed. Browser verification contexts were logged out and closed.

Frozen executable-source SHA-256: `8b806ecbd38f` is the prefix published in `X-Preview-Source`; the full source manifest and hash live in the private preview metadata. Full asset-manifest SHA-256: `f6081756cc49c4bc01dabf3d4a192a298c4e68a178de2f736163e78262ac1c62`. The publicly fetched `/assets/app-pyy8Gsns.js` matched the frozen file exactly: `dcedfa7fab13f42acc6aa96f3cf00185879cd08ad528568e99b30ac7c3397ab2`.

Preview services, immutable source/assets, manifests, and separate state are under `/home/ubuntu/.cache/tableu-pr-previews/direction-a-804c84cd-cegzmkc_`. Runtime ports are 8880/8881, with a separate inspector on 9250. The prior PR service on 8878/8879 was preserved. The previous Direction A metadata, replaced runtime files, and complete assets are retained under `versions/direction-a-804c84cd-2772699ec873/`; the Direction A tunnel and URL were retained during the owned Worker/proxy refresh. Public health at `/__preview/health` identifies the frozen source, asset manifest, uncommitted status, and synthetic data.

## Findings closed

| Finding | Result and evidence |
| --- | --- |
| F1 Pricing/Journal controls collide with destinations | Pricing upgrade actions belong to the shared contextual slot. Journal floating controls clear the measured region and return to flow beside the history filters. Browser hit-target checks pass. |
| F2 Ritual completion and skip are reversed | Existing ritual facts survive the draw and snapshot restoration. Synthetic skip readiness is never reported as performed. Six ritual tests and the canvas skip regression pass. |
| F3 Flow fallback cannot recover; combined budget missing | A pure budget solver starts from natural measurements each time, releases the named controls in order, and restores fixed placement when room returns. Portrait/landscape/portrait checks pass in Chromium and WebKit. |
| F4 Missing end clearance | Shared page padding owns measured bottom, keyboard, and Journal-control reservations. Account safe-area and last-action checks pass; Gallery/Design use the same page contract. |
| F5 Breakpoint focus loss | The equivalent destination is revealed and focused before the old copy becomes hidden/inert. Both directions pass in both engines. Keyboard hiding sends dock focus to the page heading. |
| F6 Completed guest header overflows at 320px | Guest Settings and Sign in remain visible; installation is retained in a mounted settings-sheet host, with a desktop footer host. The extra header utility control is removed. |
| F7 Reading has a different outer frame | Its header is outside padded main content. All 40 visual cases measure exactly 56px; actual account controls align across primary routes. |
| F8 Gallery/Share wrappers break stickiness | Shared headers are direct page children. Gallery controls use normal flow; Share tabs consume shared pinned height and participate in secondary release. Scrolled-header probes pass. |
| F9 Probe lint and incomplete evidence | Root ad hoc probe replaced by configured E2E coverage, focused Node tests, complete navigation contract tests, and a 40-case screenshot matrix. Lint/build and all final checks pass. |
| M1 Account label/loading area | Desktop signed-in trigger says Account, accessible identity remains intact, and loading reserves the control area. |
| M2 Share promotion/desktop actions | Promotional explanation stays in page flow. Handset guest actions use the quiet shared region; desktop actions remain in flow. Loading/error/loaded variants omit destinations. |
| R1 New reading reuses previous ritual/seed | Fresh shuffle distinguishes an existing reading from first draw. Prior knocks/cut no longer seed or complete the new reading; repeat-reading regression and independent recheck pass. |
| R2 Keyboard resize obscures focused search | The coordinator reveals focused controls after viewport measurement as well as focus entry. The exact reproduced search field moves from y=599.7–643.7 to y=359.7–403.7 when visible height becomes 420px, retaining input focus. Both browser engines pass the strengthened assertion. |
| R3 iOS installation choices unmount before saving | The signed-in menu/installation host remains mounted while its closed presentation is hidden/inert. Pointer choices survive the parent menu’s dismissal; Later and Already added persist after reload and return focus to the visible Account trigger in Chromium and WebKit. |
| R4 Enlarged-text actions fail to recover after landscape | The observer measures prospective fixed action geometry independently of its narrower flow container, restoring temporary inline position in `finally`. Identical final viewports now produce identical placement, dimensions, clearance, and reachable Draw cards controls. |

The visual follow-up also corrected actual Account-trigger drift in completed Reading, compacted handset progress into four columns beside Settings, and added current-step treatment when revisiting completed setup. Reading settings now isolates background chrome and restores focus to a visible canvas control after breakpoint unmount or delayed native-install completion.

## Final-review P2 corrections

The iOS installation guide is portalled to the body. Closing the Account menu on its outside pointer no longer unmounts that guide: its host stays mounted, and closed menu content is both hidden and inert. Both **Later** and **Already added** are exercised with synthesized touch input, saved preferences, guide closure, visible Account focus, and persistence after reload. These are browser-emulated iOS paths, not physical installation evidence.

Reading’s in-flow bottom region may be narrower than its fixed layout because it sits inside padded main content. The coordinator now measures its prospective fixed geometry before resolving the budget and restores its inline position synchronously. The action DOM, handlers, focus, provisional percentages, and actual flow layout are retained.

At 320×600 with 18px root text, both browser engines now record the same result before and after a 700×360 landscape round trip:

| Path to final viewport | Placement | Action width | Action height | Fixed bottom clearance |
| --- | --- | --- | --- | --- |
| From taller portrait | Fixed | 284px | 61px | 118px |
| Return from landscape | Fixed | 284px | 61px | 118px |

The regression also checks no page overflow and a visible, unobscured Draw cards hit target. Its measurement waits for published clearance to agree with the rendered region before comparing histories; this avoids sampling an earlier resize publication in WebKit. Chromium and WebKit recovery screenshots were captured under the temporary evidence root and are not retained in the repository.

## Validation results

Current evidence is under `/tmp/tarot-nav-p2-fixes-oerphfeg/`. The first-pass evidence under `/tmp/tarot-nav-remediation-w5kvvel4/` and the final read-only review evidence under `/tmp/tarot-direction-a-final-review-5ywelzoe/` are preserved; the results below supersede their readiness totals.

| Check | Final result | Evidence |
| --- | --- | --- |
| New regressions before fixes | 6/6 fail at the intended persistence/recovery assertions | `red.log`, `red-results/` |
| New regressions after fixes | 6/6 pass, Chromium/WebKit | `green-final.log`, `green-final-results/` |
| `npm test` | 4,420 tests; 4,418 pass, 2 skip, 0 fail; 531 suites | `unit-all.log` |
| Focused navigation, chrome policy, ritual, reading-state and PWA Node tests | 66/66 pass | `focused-node.log` |
| `npm run lint` | Pass | `lint.log` |
| `npm run build` | Pass, 19.51 seconds | `build.log` |
| Scoped Gate 1 Playwright config | 64/64 pass: 57 Chromium, 7 WebKit; includes all 40 visual cases and flow-action hit-target checks | `gate1.log`, `gate1-results/` |
| New regressions on the public frozen build | 6/6 pass, Chromium/WebKit | `public-regressions.log`, `public-results/` |
| `git diff --check` | Pass | Final worktree check |
| Focused Impeccable detector | Three touched implementation/test files scanned; zero findings | `detector.json` |
| Refreshed public preview | Seven real browser route/viewport bootstraps pass; expected isolated synthetic auth, 56px header, correct destination count, no page errors/overflow; fetched entry asset matches SHA-256 | `public-verification.json` |
| Public synthetic generation | Draw → deal → reveal → interpret completes through the mock stream; follow-up action appears; zero page errors | `public-generation.json`, `public-generation.log` |
| Independent final review | No confirmed remaining P1/P2 findings in the current diff | Fresh whole-change read-only reviewer |

The two Node skips are existing opt-in installed CLI and installed app-server isolation tests. No live model calls are required or used. The full Node run also retains the isolated-runtime/source-manifest coverage from the initial remediation.

The prior full-prototype detector’s two typography advisories (17px wordmark and 11px skipped annotation) are unchanged. The new focused detector found no additional issues. Those intentional prototype typography choices remain documented, without new ignore rules or edits to DESIGN.md, its sidecar, or existing critiques; coordinated design documentation remains Gate 2 work.

## Visual inspection and layout judgments

All **40 primary screenshots** were recaptured and inspected after the P2 fixes through eight contact sheets: five states (Reading setup/completed, Journal populated/empty, Account) × guest/Pro × dark/light × 1440×1000/390×844. Populated Journey panels and visible images were awaited before capture. These use synthetic intercepted API fixtures; they do not establish real production or approved local-reviewer authentication coverage.

The contact sheets were written to a temporary review directory and are not retained in the repository; the captured filenames are recorded below.

| Desktop | Handset |
| --- | --- |
| `1440-dark-guest.png` | `390-dark-guest.png` |
| `1440-dark-pro.png` | `390-dark-pro.png` |
| `1440-light-guest.png` | `390-light-guest.png` |
| `1440-light-pro.png` | `390-light-pro.png` |

The frame is visually consistent across primary routes and both themes. Navigation uses plain text with the active underline/dot, while the reading progress remains within the canvas. Handset progress no longer produces three stacked rows. The completed-reading heading outline in screenshots reflects the existing programmatic focus target; it is not a new container treatment.

**64rem judgment:** at 1440px the brand starts at x=208 and the account control ends at x=1232. The wider Reading main starts at x=80, with an inner content edge at x=104. The full-width screenshots deliberately retain this offset: the narrower stable chrome reads as one navigation frame while the canvas has room for cards and operational progress. It does not require a Gate 1 spec amendment. Owner approval remains pending.

**Height-budget judgment:** the provisional thresholds hold for the tested longest real labels. Their usability consequence is explicit: at narrow widths, follow-up/save actions may move to page flow before secondary reading controls release. The actions remain reachable and unobscured when scrolled into view; the added hit-target check and screenshots verify this. Keep the thresholds provisional for the integration matrix and physical devices.

| State / viewport | Fixed bottom | Other pinned chrome | Combined | Result |
| --- | --- | --- | --- | --- |
| Generating, 320×700 | 109px (15.6%) | Header 56px + secondary 57px | 222px (31.7%) | Below 25% bottom / 40% combined; Cancel generation stays fixed |
| Follow-up ready, 320×700 | 57px (8.1%) | Header 56px + secondary 153px | 266px (38.0%) | Save/Ask actions move into flow; labels fit and hit targets clear dock |
| Generating, 700×360 | 57px (15.8%) | 0px | 57px (15.8%) | Actions, secondary controls, and header release; destinations remain |
| Follow-up ready, 700×360 | 57px (15.8%) | 0px | 57px (15.8%) | Same release; Save/Ask actions remain reachable in flow |

Raw measurements and the inspected scrolled-action images are in `/tmp/tarot-nav-p2-fixes-oerphfeg/gate1-results/navigation-gate1-real-gene-54116--provisional-height-budgets-chromium/`. Normal portrait recovery, single destination focusability, keyboard open/close, quiet password/share, and 34px emulated safe-area clearance have bounded Chromium/WebKit evidence.

## Independent review and preservation

A fresh read-only reviewer examined the complete current diff against the specification and checklist, traced the persistent menu through its portalled installation/focus path, checked prospective fixed measurement and style restoration, and inspected the six-case red/green evidence plus recovery screenshots. The verdict is **no confirmed remaining P1/P2 findings**. Final full-suite and public-preview results were independently completed by the implementer after that review; the reviewer did not claim Gate 2, physical-device behavior, or owner visual approval.

Preservation manifest comparison passed:

- Main checkout remains on `6b56a45be1017587724d84f5d1eee7150fe31120`, with identical status, index, and all 58 recorded dirty/untracked file hashes, including existing critiques and unrelated files.
- PR worktree remains on `804c84cd4356ae4ace801517390b60a66fc59bd3`, with identical status/index and approved uncommitted spec SHA-256 `c7137097a3e30a454624a0b96629e1240af56e9009a14bcbfca9f0623272c0e8`.
- Prototype HEAD/index remain unchanged; the implementation is unstaged and uncommitted. The Task 7 patch/archive and manifest preserve the pre-fix prototype state; only the two runtime files, regression spec, checklist, and this report changed in this follow-up.
- The comparison preview still responds with HTTP 200 and the original PR commit identity. No comparison service was restarted or replaced.

Evidence: `before.json`, `prototype-before.patch`, `prototype-dirty-before.tar.gz`, and `preservation-final.json` under `/tmp/tarot-nav-p2-fixes-oerphfeg/`.

## Remaining gate

The owner still needs to visually approve Direction A. After approval, integrate the accepted prototype into the PR branch, refresh DESIGN.md and its sidecar together, and execute the complete NAV-01–12 integration matrix: real local Pro, Free/local journals, long names/auth errors, 200% text, every dirty-profile exit, all reading/PWA/history phases, and the specified Chromium/WebKit suites.

Keyboard and safe-area tests here are browser emulation. Physical-device browser chrome, real software keyboards, assistive technology, and full lifecycle qualification remain unverified. The checklist records these as Gate 2 work. No commit, push, PR update, or production release was performed.
