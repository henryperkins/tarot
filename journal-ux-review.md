## Executive Summary (Top Recommendations)
- Analytics scope mismatch between “Journal Pulse” and Reading Journey → Add a shared “Scope” selector (All time / This month / Filters / Custom) that drives both `Journal.jsx` summary cards and `useJourneyData`, and label the active scope in both surfaces → Builds trust when counts/top cards align.
- Exports/share snapshot mix month/filtered stats with full-history entries → Build export stats from the same `activeEntries` being exported and show “Exporting N entries · Scope: <label>” before downloads → Prevents mis-shares and confusion over export contents.
- Journal share links ignore filters and silently cap to 5 newest entries → Pass current-view `entryIds` into `onCreateShareLink`, add “Use current filters (N entries)” with adjustable limit, and message scope → Shared links match what the user curated.
- Active filters vanish while scrolling; floating Filters button lacks context → Add compact chips (e.g., “Love · 90d · 2 spreads · Reversals on”) plus an inline “Reset” chip near the floating CTA and under “Journal history” → Users understand why results are limited.
- Collapsed entry cards are hard to scan (no card/deck cues) → Show first 1–2 card chips, deck badge, and relative time in the collapsed row; keep expand for details → Faster identification in long histories.
- Follow-up chat is read-only from Journal → Add “Ask a follow-up” CTA inside each entry’s follow-up section that reopens chat with that entry’s context (tier-gated if needed) → Keeps the journey continuous.
- Sync state lacks upgrade/reassurance → In the signed-in banner, add “Upgrade to Cloud Journal,” last sync timestamp, and retry for failures → Increases trust and conversion to backup.
- Whole journal fetched on mobile though only 10 render; heavy gradients → Paginate `/api/journal` (cursor/month), lazy-load Journey stats after first paint, and lighten the hero background on mobile → Reduces jank for large journals.

## What’s Working (Preserve)
- Clear month grouping with load-more batching.
- Strong empty state with example reading and CTA back to reading flow.
- Saved filter presets with keyboard focus handling and advanced/compact variants.
- Mobile Reading Journey sheet with tabs and swipe-to-dismiss.
- Per-entry action menu covers copy/share/export/delete with keyboard support.
- Follow-up transcripts and patterns rendered inline with markdown.
- Deep links (`prefillQuery`/`highlightEntryId`) route back into Journal effectively.
- Local-to-cloud migration/import helpers with toast feedback.

## Detailed Findings & Fixes
| ID | Location | Issue (user-perspective) | Why it matters | Severity | Suggested Fix | Effort | Platform Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| JRN-1 | `src/components/Journal.jsx` summary vs `src/hooks/useJourneyData.js` | “Journal Pulse” shows all-time stats while Reading Journey defaults to current-month; numbers/top cards diverge. | Conflicting metrics erode trust. | High | Add a visible scope selector shared by both; label active scope in hero + Journey header. | Medium | Keep selector thumb-friendly; avoid extra modals on mobile. |
| JRN-2 | `ReadingJourney/JourneyContent.jsx`, `ReadingJourney/sections/ExportSection.jsx` | PDF/snapshot uses month-scoped stats while exporting all entries when unfiltered. | Users think exports are wrong/incomplete. | High | Build export stats from the same `activeEntries` being exported; show “Exporting N entries · Scope: …”. | Medium | Stream blobs on mobile to avoid stalls. |
| JRN-3 | `ReadingJourney/sections/ExportSection.jsx` | “Create Share Link” ignores filters and silently shares latest 5. | Mis-shares and privacy surprises. | High | Pass current-view `entryIds` to `onCreateShareLink`; add “Use current filters (N entries)” toggle and limit picker. | Medium | On mobile, prefer share sheet post-create; keep clipboard fallback. |
| JRN-4 | `src/components/Journal.jsx` (history header, floating CTA) | Active filters not visible when scrolled; floating Filters button has no context. | Users forget filters and misread empty results. | Medium | Add chip bar showing active filters/timeframe + “Reset” chip near CTA and under “Journal history.” | Low | Chips should wrap and respect safe areas. |
| JRN-5 | `src/components/JournalEntryCard.jsx` collapsed header | Collapsed cards lack card/deck cues; must expand to identify. | Slows scanning long lists. | Medium | Add first 1–2 card chips, deck badge, and relative time in collapsed row. | Low | Keep chips tap-friendly; avoid layout shift. |
| JRN-6 | `JournalEntryCard.jsx` follow-up section | Follow-up thread is read-only from Journal. | Breaks continuity of follow-ups. | Medium | Add “Ask a follow-up” CTA that opens chat preloaded with this entry (tier-gated if needed). | Medium | Use sheet on iOS to avoid keyboard push; Android back should dismiss sheet first. |
| JRN-7 | `src/components/Journal.jsx` signed-in banner | Sync state says “stored locally” with no upgrade or last-sync info. | Low confidence and missed upsell. | Medium | Add “Upgrade to Cloud Journal,” last sync timestamp, and retry link on failure. | Low | VoiceOver should announce sync state succinctly. |
| JRN-8 | `useJournal.js` load, `Journal.jsx` render | Loads all entries and heavy gradients even on mobile; only 10 shown. | Slow first paint and scroll on large journals. | Medium | Paginate `/api/journal`, lazy-load Journey stats after first paint, lighten hero background on mobile, prefetch next batch on idle. | Medium | Test on low-memory Android; honor reduced-motion. |

## Prioritized Roadmap
- **Phase 1 (Now)**: JRN-1, JRN-2, JRN-3, JRN-4, JRN-5
- **Phase 2 (Soon)**: JRN-6, JRN-8
- **Phase 3 (Later)**: JRN-7
