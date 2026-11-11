# Journal quiet toolbar — implementation and design QA

**Result: BLOCKED — draft for review, not visually qualified.**

Date: 2026-11-10 (America/Chicago). Base: `e1f526a3691547ef46c6cd733a9842f077d2f4a4` on `master`. Review branch: `feat/journal-quiet-toolbar`. No merge or deployment was performed.

## Selected visual source

The reader selected **Option 1: Quiet toolbar**, a desktop/mobile concept board. Reference file: `tableu-journal-quiet-toolbar.png`, 1536 × 1024 PNG; SHA-256 `d7bf66887f6bf3b72d80e1f6f5a0dd74d61146b0c234503c7ac32acbc3aed733`.

The source was opened and inspected before implementation. It is a raster concept board, not a measured browser viewport. Its authoritative direction is the control hierarchy: prominent search, explicit chronological order, one Filters disclosure, a density disclosure, removable active-filter chips, and separate month navigation.

## Implemented scope

- Search fills the phone toolbar's first row. Other controls wrap safely rather than shrinking below their content.
- Newest first / Oldest first orders an immutable projection of the matching readings. Equal timestamps remain stable; undated or invalid dates remain last in either direction.
- Sort changes reset the visible batch and stale month navigation. Month counts, jump indices, pagination and highlighted-reading retention use the same ordered projection.
- Sorting does not alter query signatures, semantic-search mode, filter badges or analytics inputs. All controls remain disabled while complete cloud history is pending.
- Filters opens a non-modal desktop popover or a modal phone sheet with native named choices, live filtering and explicit Close / Show readings controls.
- Display contains Comfortable / Compact. Existing device density persistence remains intact.
- Active chips, clearing and owner-scoped saved views remain available. Clearing preserves sort. Saved views include sort; older views default to newest without rewriting stored bytes merely on read.
- Existing fonts, theme tokens, icons, reading cards, artwork and app chrome are retained.

Intentional differences from the concept board: **Display** replaces its ambiguous **View** label, and the existing reading-card layout is retained because this change concerns controls, not reading content. Filter-overlay open states elaborate the selected closed-toolbar concept using the existing modal/focus infrastructure.

## Verification and comparison history

1. Initial production build passed. Focused sorting/saved-view tests passed.
2. Source review found ancestor clipping and analytics tie-order coupling. The history shell now permits popup overflow while its decorative child remains clipped; analytics and both Journey instances receive the unchanged matching order.
3. Source review also led to consistent mobile visual/DOM order and focus restoration after saving/cancelling a saved view.
4. The initial full Node suite reported 6,507 tests: 6,495 passed, 9 failed, 3 skipped. Five failures exposed missing new modules in the isolated-runtime source allowlist. Both modules were added; the dedicated runtime recheck passed **15/15**.
5. The four other failures were reproduced against the exact unchanged base in a separate clean worktree. Two assume a missing `/tmp/opencode` parent; two require an absent Chromium headless-shell executable. The baseline failed-file run reported 19 tests: 15 passed, 4 failed.
6. Final production build and focused checks passed. The final complete suite reported **6,507 tests: 6,500 passed, 4 failed, 3 skipped** (291.55 seconds, exit 1). The four failures are the same setup failures reproduced on the unchanged base; no source-allowlist failures remain.
7. Cloud-browser navigation to the local review harness returned `upstream connect error or disconnect/reset before headers; reset reason: connection termination`. The scratch preview initially also encountered `uv_interface_addresses` / `EPERM` on a wildcard bind. A safer loopback preview started, but was not reachable through the browser's preview route. No permission, security or network-isolation bypass was attempted. Owned preview processes were stopped.

## Check results

| Check | Observed result |
| --- | --- |
| `npm run build` | Pass; existing `onnxruntime-web` direct-eval warning remains |
| Focused journal sort/history/saved-view/utils/progressive-history/semantic-search Node tests | 44 passed, 0 failed |
| `node --test --test-concurrency=2 tests/readingCueValidationRuntime.test.mjs` | 15 passed, 0 failed after source-manifest correction |
| ESLint on changed JS/JSX/test files | Pass, no lint errors or warnings |
| Repository `npm run lint` | Exit 0; 0 errors, 49 warnings in unchanged files |
| `git diff --check` | Pass |
| Final `npm test` | 6,500 passed, 4 baseline-reproduced setup failures, 3 skipped; exit 1 |
| New and updated Playwright specs | 16 new cases plus updates to 7 existing specs; statically checked, **not executed** |
| Real authenticated local reviewer account | Not exercised |
| Deployment / merge | Not performed |

## Required rendered QA — still open

No implementation screenshot, normalized crop, side-by-side reference comparison or browser console pass is claimed. The browser reached an error page, not the application. Browser capture path: **none**.

Resume with the actual app, synthetic guest readings or an authorized local reviewer account, and no production writes. The scratch-only review harness used 35 synthetic readings across four months and real bundled card artwork; it was not observed rendering and is not authentication evidence.

Required viewports: **320 × 844**, **390 × 844**, **768 × 900**, **1280 × 900** CSS pixels; record actual device-pixel ratio. Check dark and light themes, default and active filters, zero matches, both sorts and densities, and open popover/sheet states. Include larger text and reduced motion.

| Surface | Remaining evidence |
| --- | --- |
| Control hierarchy, spacing, wrapping and radii | Rendered desktop/phone screenshots compared with the reference in one combined input |
| Typography, theme colors and contrast | Rendered measurements, both themes, keyboard focus and forced colors |
| Artwork and reading content | Confirm existing card image/text layout remains unchanged |
| Filter panel, Display and keyboard behavior | Open/close, Escape, focus containment/restoration, outside dismissal and zero-match popup reachability |
| Sort, month jump, pagination and saved views | Execute the new quiet-toolbar regression suite and related updated specs |
| Console and network | Capture actual app errors; distinguish explicit synthetic fixture refusals from app failures |

Do not mark this design QA **passed**, promote the draft as ready, merge or deploy until the rendered comparison and browser interaction checks are complete.
