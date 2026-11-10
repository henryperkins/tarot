# Dependency reconciliation — 2026-11-01

Three independently qualified local replacements were prepared from master
`19be91abd8a3f90e4f9fcea84423231e5aa17e08`. Four upgrades are deferred with their
failed checks or compatibility constraints preserved. Nothing was merged,
pushed, deployed, or closed on GitHub. The combined dependency set has not been
qualified; these are separate branches from the same baseline.

| Original PR | Local disposition | Verification or blocker |
| --- | --- | --- |
| [#115](https://github.com/henryperkins/tarot/pull/115), sharp also in #120 | `deps/sharp-20261101` at `89b791342d2c180045215b0f99c6eb85334783a6`: root sharp 0.32.6 → 0.35.5 | 6,238 root tests passed, 0 failed, 2 skipped; build and actual PNG → lossless WebP resize/pixel smoke passed. |
| [#120](https://github.com/henryperkins/tarot/pull/120), other four packages | `deps/root-group-20261101` at `ac2b0171b391248846482bf66bd7ce2f7920a6f4`: MCP SDK 1.30.1 → 1.32.0, brace-expansion 1.1.18 → 1.1.21, DOMPurify 3.4.12 → 3.4.17, source-map-js 1.2.1 → 1.2.2 | 6,238 root tests passed, 0 failed, 2 skipped; build and two mocked Chromium reading-render/navigation cases passed. This batch retains root sharp 0.32.6. |
| [#119](https://github.com/henryperkins/tarot/pull/119) | `deps/astro-plugins-20261101` at `e577015344fcfd8c47202d8605c8f0db4545f945`: the ephemeris and symbolism lockfiles update Hono to 4.13.16 and proxy-addr to 2.0.8 | Ephemeris 45/45 and symbolism 43/43 tests passed, including their local MCP/manual samples; root build passed. No root package files changed. |
| [#113](https://github.com/henryperkins/tarot/pull/113), axe 4.14.0 | Deferred; exact candidate patch and browser evidence archived | Root suite and build pass, but all three selected accessibility cases fail `label-content-name-mismatch` on step-navigation buttons. Exact master with axe 4.12.1 passes all three. No rule exclusion or application rewrite was introduced. |
| [#114](https://github.com/henryperkins/tarot/pull/114), Sentry Cloudflare 11.7.0 | Deferred; exact candidate patch and logs archived | Build passes; isolated Worker checks pass 6/7, failing the existing `"op":"db.query"` database-tracing assertion. Exact master passes 7/7. The failed contract requires SDK/tracing compatibility review; this is not proof by itself of lost production telemetry. |
| [#116](https://github.com/henryperkins/tarot/pull/116), Vite React plugin 6.1.2 | Deferred before installation | Official package metadata requires Vite ^8; master resolves Vite 7.3.6. A Vite major migration is outside this cleanup. |
| [#117](https://github.com/henryperkins/tarot/pull/117), tsParticles slim 4.4.0 | Deferred before installation | Current React adapter 3.0.0 requires engine ^3.0.2; slim 4 needs engine 4. Upgrade the adapter/engine/slim together in a separately qualified change. |

## Scope and compatibility

The lockfiles were regenerated from current master rather than copied from the
stale PRs. Sharp is implemented once. Its 68 changed lock entries consist of the
root manifest entry and packages reachable through the old or new sharp
dependency trees, including native optional packages moving during deduplication.
The Transformers dependency still needs its own sharp 0.32.6; that version is
retained and its native module was rebuilt. The checks ran on Linux x64 with Node
24.21.0. Other operating systems and architectures were not exercised.

The four-package root batch changes exactly those four resolved package entries
and the root SDK range. The plugin batch changes only Hono and proxy-addr in each
lockfile. Its fresh resolver selected Hono 4.13.16 rather than the old PR's
4.13.13; the selected version and package metadata were verified against the
official npm registry and tested locally.

## Failed attempts retained

Install scripts were initially disabled. Moving the old sharp under Transformers
left its native binary unbuilt, and the ephemeris install likewise needed sweph
built. The initial failures remain in the evidence. Rebuilding those exact
modules fixed the setup, after which the affected checks passed without source
or assertion changes.

Two initial root suites ran concurrently and exposed the existing fixed browser
port 4193. A task-owned overlapping root-group supervisor was stopped and its
interrupted receipt retained. Subsequent full root suites ran serially. Sentry's
database-tracing failure reproduced in isolation; it is independent of the port
collision. The original npm metadata command also rejected a duplicated config
path before contacting the registry; registry metadata was then read directly.

Every run has a unique label and terminal receipt. There were no automatic
retries, generated readings, live embeddings, or changes to acceptance criteria.
The rendering cases used fixture text, not provider inference or a real member
account. These checks do not qualify F3b or the existing narrative content halt.

## Recovery and next action

Private evidence is under
`/home/ubuntu/.local/state/tarot/reconciliation-cleanup/20261101T030802Z/continuation/`.
`task6/qualified-commits.json` maps exact files, hashes, and checks to each commit;
`checks/` retains all attempts. `task6/dependency-checkpoints.json` records the
verified incremental bundle and independent restoration into the recovery mirror.
`task6/recovery/` retains exact rejected candidate files, binary patches, indexes,
and browser reports. `task6/retirement-receipts.json` records the temporary
worktree retirement; successful local branches remain available.

The owner can review and integrate the three passing branches separately, then
verify their combined dependency graph before publication. Close #115/#119 only
after their replacements are integrated; #120 also needs both its sharp and
four-package replacements integrated. Keep the four blocked PRs open until their
specific remediation is agreed. This document proposes those future actions and
does not authorize publication or PR closure.
