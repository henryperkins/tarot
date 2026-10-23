# Journal remediation design

The user selected **history and saved questions first**, authorized all P1/P2 fixes from the Journal audit, and required preservation of Tableu's existing visual identity and unrelated changes, verification, and Impeccable polish. This is the approved direction; no further design selection is needed.

The audit is `.impeccable/critique/2026-10-23T16-59-39Z__src-components-journal-jsx.md` in the primary checkout. Findings J1–J13 are the acceptance checklist.

## Result

- Populated Journal opens with search, ordinary filters and saved questions. Practice snapshot and Journey remain available as secondary content. Remove the overlapping duplicate filter map. Original questions identify both entry densities; spread/date remain metadata.
- Preserve warm brass/plum ink, Source Serif headings, semantic light/dark tokens, tarot artwork, card geometry, and supported filter options. Keep the first-reading action near the empty heading; one optional example is sufficient.
- Preserve all local readings until an explicit deletion. Remove artificial 100-entry eviction, verify persisted writes before clearing import sources, and preserve unreadable storage on failed writes/imports. Browser quota errors must report failure truthfully.
- Saved views belong to a guest or account namespace. Existing global views stay quarantined unless explicitly imported; do not expose their names/queries in another identity. Draft and active filter state reset on owner changes.
- Guests can delete local entries with confirmation. Device-only sharing copies a summary; cloud sharing requires a cloud entry/capability. Explain Plus/Pro cloud eligibility accurately.
- Failed retrieval/unreadable storage has a recovery state separate from known-empty history.
- Reading actions occupy reserved space or document flow, never cover prose. Fix painted Journey contrast, fan-collapse focus, 44px reset target, and frequency wording semantics.

## Implementation choices

Keep existing React/Vite/Worker architecture and dependencies. Use small storage helpers for meaningful Node tests and browser tests for actual mounted behavior. Retain optional analytics with disclosure instead of deleting capabilities. Use document-flow Journal actions to remove overlap without changing shared navigation infrastructure. Remove the artificial local count cap rather than introduce a new capacity policy.

## Boundaries

Work in an isolated checkout, snapshot/hash original dirty files, copy back only owned changes after review, preserve the Git index and unrelated files. No commit, push, deployment, paid/model generation, production access, or real journal/share writes. Browser content uses scoped fixtures; real local Pro authentication is verified separately and logged out. Physical devices/screen readers remain a separate evidence lane.
