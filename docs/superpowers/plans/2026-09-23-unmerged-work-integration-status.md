# Unmerged work — local integration status

> Historical checkpoint from 2026-09-23. See the
> [2026-09-24 MCP production release](2026-09-24-mcp-production-release.md) for
> subsequent integration, migration and deployment evidence.

This is the execution checkpoint for the [dated task list](2026-09-23-unmerged-work-integration.md).
The user authorized resuming local integration, then asked to keep scope bounded.
No branch was pushed, PR changed, cloud resource created, production migration
applied, deployment performed, or original worktree/stash removed.

Master and origin/master remain `3946e1ada5fda13d93d82c34719ce267881f9825`.
These are separate reviewable candidates, **not a combined or released build**.

## Local candidates

| Workstream | Source commit | Outcome |
| --- | --- | --- |
| Narrative remediation | `051064c59cb0891ee47d6543c37fdf7a02650060` | Integrated master; fixed suggestion font-size animation that displaced the focused composer at 200% text. |
| Worker MCP journal | `d3dd76723c7856fcef6c9d26440b2571eb9f0654` | Integrated current HTTP journal contracts, owner OAuth/MCP, atomic saves/reflections and Thoth labels; retired adapter consumers and aligned CI. |
| Interrupted transitions | `329340f48d32a559720a278201108ab7ac5413c8` | Removed only the remaining duplicate Journal/gallery fades; preserved current routing and page motion. |
| Dependency refresh | `ed4c6330156c7276e959542cb5555c3f27d03e90` | Node 24 types and symbolism transitive lock refresh. Focus-trap major excluded. |
| Guidance | This documentation branch | Restored useful content lost by the original root-guidance truncation; kept scoped Worker/script guidance and corrected current architecture/runtime boundaries. |

Documentation commits after these source SHAs contain reports only. The narrative,
MCP, transition and dependency branches retain their individual verification
records under `docs/superpowers/plans/`.

## Verification

- Narrative: **2,017 unit tests**, **42 focused browser tests**, **15 rendered
  accessibility tests**, and four journal browser cases passed. Build, design
  gate, static accessibility and Cloudflare lint passed. Adapter checks passed
  17 cases with one Windows SIGTERM skip; deploy tests passed 11.
- MCP: **2,164 unit tests**, **four final journal browser cases**, 11 deploy
  tests, build, Cloudflare lint and Worker bundle dry run passed. Real local
  OAuth consent/PKCE, eight tools, owner parity, draw/wait, save/reflection retries,
  rendered journal fidelity and allowlist-removal denial passed. Temporary
  credentials and local OAuth/D1 state were removed.
- Transitions: **13 browser passes and one intentional WebKit CDP skip**;
  **2,000 unit tests**, 11 deploy tests, build and Cloudflare lint passed. The
  final paused-entrance test fails on master in both browsers and passes with the
  two-line source fix.
- Narrowed dependencies: `npm ci`, **2,000 unit tests** and build passed on
  `ed4c633`. Symbolism installation and its server test passed. Earlier deploy,
  Cloudflare-lint and bundle checks passed on the trial package tree.
- Full lint remains failing: narrative and MCP each have **146 errors / 37
  warnings**, matching master. MCP's exact diagnostic comparison has no
  differences; narrative's sole message difference is a source-line shift in an
  unchanged hydration effect.

## Open release gates

The full narrative frontend run encountered journal-filter failures. Its first
failure (`filters appear in journal history`) also fails on clean master. The run
was stopped after confirmed failures; this does not establish a completed/passing
full frontend suite or classify every later failure.
The local-composer narrative quality gate also fails on master's Spanish sample;
no live provider was used and no thresholds were lowered. The unfinished CLIP
vision attempt was stopped when closing this bounded local checkpoint. No ML
performance investigation or training change was added. These gates remain open.

The 344 vision source/asset inputs and commands match across master and all four
source candidates. The 81-package CLIP dependency closure matches for narrative,
MCP and transitions; the dependency candidate differs only in Node/Undici type
definitions. This comparison is recorded evidence, **not a vision-gate pass**.

Refresh selected candidates onto their eventual combined base and run the required
gates before release. Production linking, migrations, deployment, physical-device
keyboard behavior and spoken screen-reader proof remain separate from local
emulation. The fresh reviewer found no Critical issue; its Important dependency
coverage concern is resolved by excluding the unverified major upgrade.

## Deferred work and decisions

- Focus-trap 12.0.3 trial: preserved as `chore/defer-focus-trap-major` at
  `27e8a26`. A real nested-focus regression passed Chromium and failed WebKit
  parent dismissal. No baseline attribution or additional modal changes were
  attempted after scope was narrowed. Cost: delayed major-version uptake.
- Vite 8: deferred as a separate Rolldown/Oxc migration. Older Router,
  Playwright and grouped-root proposals are superseded by current master.
- Ephemeris lock refresh: preserved at `f5506c2` on
  `chore/refresh-ephemeris-dependencies`, excluded because `sweph` installation
  requires unavailable Visual Studio C++ tooling. No toolchain was installed.
- Broad Midnight redesign: deferred and preserved at `7d0220c`. Cost: future
  product integration still needs a separate decision and conflict review.
- Review minor: the first expired-job lookup returns 410 and clears job identity;
  a later save lookup returns 404 without helpful payload-save instructions.
  Explicit payload saving remains available and ownership is unaffected. Wording
  or tombstone improvement is deferred; cost is poorer recovery guidance.
- Use the existing plan/spec as design authority and keep workstreams isolated;
  cost is later cross-candidate integration work, not silently combining changes.
- Retain the task workspace, evidence, original worktrees and stash; cost is disk
  usage. Cleanup requires the plan's fresh preservation/parity/ancestry checks.
- Keep production resources/publication, real ChatGPT linking, public distribution,
  app-wide CORS, deck artwork and extra MCP tools outside this local pass. Their
  behavior is not implied by these tests; the specification defers the latter items.
- Preserve physical-device/assistive-technology and provider-quality limitations;
  cost is unverified behavior in those environments, explicitly left as gates.

## Preservation and evidence

Preservation commits: narrative `2a855b8` (115 paths), MCP `877392d`, Midnight
`7d0220c`, and guidance `e04f32d` (six paths). The original checkout's **23 dirty
file fingerprints still match** the manifest. **26 stash blobs** match master;
the stash is retained. The original three planning files remain untouched in the
primary checkout. No original branch or worktree was removed.

Local proof directory:
`C:/Users/htper/AppData/Local/Temp/tarot-integration-b3d08059115b417aa797f86583e7d874`.
It contains exact command/candidate/runtime records, logs, baseline comparisons,
rendered artifacts, QA input comparison and `final-review-disposition.md`.
The ignored execution ledger remains at
`C:/Users/htper/tarot/.superpowers/sdd/2026-09-23-unmerged-work-integration/progress.md`.

Tasks 1–3, 5–6 and local guidance review are complete. Tasks 4/7 retain full-gate
limitations; Task 9 has a verified local fix and deferred redesign; Task 10 has
seven explicit dispositions with unverified upgrades excluded. Tasks 8 and 12
(publication/release and cleanup) remain pending. This is not an all-tasks-complete
or ready-to-release claim.
