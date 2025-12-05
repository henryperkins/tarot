# Journal Redesign & Enhancement Journal

_Last updated: 2025-02-14 · Author: Codex_

This journal consolidates the outstanding redesign intent, the shipped progress, and the engineering instructions required to finish the Mystic Tarot journal overhaul. Use it as the single source of truth when planning sprints, coordinating design, or validating work.

---

## 1. Snapshot & Key References

- **Baseline vision**: `docs/journal-redesign.md`
- **Gap analysis**: `docs/journal-gap-assessment.md`
- **Implementation queue**: `JOURNAL_IMPROVEMENTS_TODO.md`
- **Auth & persistence**: `docs/JOURNAL_SETUP.md`

### Current Status (2025-02-14)

| Area | State | Notes |
| --- | --- | --- |
| Desktop layout & summary band | ✅ | Two-pane grid w/ sticky rail live |
| Compact entry cards & previews | ✅ | Need inline feedback + token sweep |
| Insights toolbar | ✅ | Actions labeled but still toast-only |
| Mobile experience | ⚠️ | Segmented control swaps whole rail instead of discrete accordions |
| Inline statuses | ⚠️ | ToastContext used across entry + insights actions |
| Saved filters | ⚠️ | Placeholder button, no real slot |
| Archetype analytics metadata | ⚠️ | Last run data disappears once analytics load |
| Auth + D1 persistence | ✅ | Optional login + migration path shipped |

---

## 2. Redesign Goals & Success Metrics

1. **Immediate clarity**: Users instantly see “what to do next” (start entry, resume draft, explore insights).
2. **Streamlined analysis**: Filters, insights, and archetype journey remain reachable without scroll gymnastics.
3. **Actionable feedback**: Every action (share, export, copy, migrate) surfaces inline confirmation/error with assistive tech support.
4. **Responsive parity**: Mobile users access the same surfaces via accordions or tabs without losing context.
5. **Unified visual language**: Buttons, chips, and badges reuse shared Tailwind tokens for consistent focus/hover states.
6. **Reliable persistence**: Authenticated users trust the D1 journal; migrations are reversible and observable.
7. **Measurable outcomes**: Telemetry captures engagement (entries created, exports, migrations) to validate success.

**KPIs to watch**
- Entry completion rate (+15% vs. current baseline)
- Insights interaction rate (+20% clicks on filters/insights/actions)
- Export/share success rate (>95% without toast-only errors)
- Mobile bounce rate (<10% drop-off between read + journal entry tabs)
- Migration completion (>80% of prompted users migrate within 7 days)

---

## 3. Focus Areas & Cognitive Load Guardrails

### 3.1 Priority Focus Areas
1. **Action Triage Band** — Surface the most urgent CTA (start entry, resume draft, finish migration) with one accent button and a concise stat cluster; everything else becomes secondary.
2. **Decision-Ready Insights** — Keep filters, insights, and archetype journey synchronized so users never question whether stats reflect their current view; highlight deltas vs. historical baselines.
3. **Narrative Reflection Loop** — Elevate reflections, rituals, and prompts as first-class citizens so journaling feels conversational, not transactional.
4. **Trust & Continuity** — Make migrations, exports, and auth states transparent; always show where data is stored and when it last synced.
5. **Mobile Momentum** — Treat small screens as primary: focus on single-thumb navigation, persistent CTAs, and offline-friendly summaries.

### 3.2 Cognitive Load Reduction Tactics
- **Progressive disclosure**: Gate long-form content (reflections, analytics details, saved filters) behind accordions or “Show more” links with clear affordances.
- **Chunking & labeling**: Group stats into 3–4 item clusters with explicit labels (“Entries this week”, “Reversal %”, “Top context”) to prevent scanning fatigue.
- **Color discipline**: Reserve the accent color for primary actions and warnings; keep secondary controls in a neutral palette to avoid visual noise.
- **Inline messaging**: Replace floating toasts with inline status banners anchored to the action that triggered them; leverage `aria-live="polite"` to narrate outcomes once.
- **Contextual helper copy**: When GraphRAG or archetype data is stale, insert a short hint directly under the affected component instead of global alerts.
- **Temporal cues**: Use relative timestamps (“Updated 4h ago”) to help users anchor insights without re-reading dense text.

### 3.3 Measurement & Validation
- Run UX scorecard sessions monthly to verify that users can list the top three actions available on the page within 5 seconds.
- Track scroll depth and dwell time to confirm that the majority of users interact within the first viewport on desktop and mobile.
- Instrument inline status interactions to ensure >95% of actions conclude without additional user guidance or repeat clicks.

---

## 4. Mobile Experience Strategy

### 4.1 Layout Principles
- **Accordion-first rail**: Filters, Insights, and Archetype Journey behave as independent accordion sections with remembered state and keyboard support.
- **Sticky anchors**: Keep the summary band pinned beneath the header up to its natural height; add a sticky bottom “New entry” CTA for quick access on long feeds.
- **Thumb zones**: Place destructive or secondary actions on the top-right of cards and primary actions bottom-aligned for right-handed reach, with adequate spacing for accessibility.

### 4.2 Interaction & Feedback
- Mirror inline status patterns from desktop; use slide-in banners that occupy no more than 3 lines and dismiss automatically.
- Provide subtle haptic or vibration hooks (via WebHaptics when available) for key actions such as saving, exporting, or completing migrations.
- Keep gestures optional—any swipe action must have an explicit button alternative.

### 4.3 Performance, Offline & Data Use
- Lazy-load history in 10-entry batches and recycle DOM nodes to keep memory usage low on older devices.
- Cache the last known insights/archetype payload in IndexedDB so mobile users see immediate content even before the worker responds.
- Detect offline mode and swap CTAs for “Retry”/“Save locally” options; queue mutations until connectivity resumes.

### 4.4 Mobile QA Heuristics
- Validate tap targets (min 44px) and focus outlines on both light/dark modes.
- Test portrait/landscape rotations, especially for tablets where the two-pane layout might activate mid-session.
- Profile Lighthouse performance on a simulated Moto G Power; aim for <3.5s TTI on 4G throttling.

---

## 5. Guiding Principles

1. **Two-track thinking**: Separate “create today’s entry” from “review historic insights,” but let both live together.
2. **Evidence-first**: Use prompt metadata (`promptMeta.graphRAG.*`) and analytics to warn when insights are degraded.
3. **Accessibility baked in**: Icon-only actions always include labels, focus states, and `aria-live` messaging.
4. **Incremental rollout**: Ship improvements in vertical slices so UI, API, and persistence stay in sync.
5. **Playbooks over heroics**: Document every decision inside this journal—future contributors should not re-derive the plan.

---

## 6. Workstreams & Owners

| Workstream | Focus | Primary files |
| --- | --- | --- |
| **WX-1 Layout & IA** | Summary band, desktop grid, mobile accordion | `src/components/Journal.jsx`, `src/components/JournalLayout.jsx` (if extracted) |
| **WX-2 Entry Surfaces** | Entry cards, inline statuses, reflections | `src/components/JournalEntryCard.jsx`, `src/hooks/useJournal.js` |
| **WX-3 Insights & Sharing** | Toolbar flow, exports, prompt metadata surfacing | `src/components/JournalInsightsPanel.jsx`, `src/lib/exporters/*` |
| **WX-4 Filters & Saved Views** | Token harmonization, saved filter CRUD | `src/components/JournalFilters.jsx`, `src/hooks/useJournalFilters.js` |
| **WX-5 Archetype Journey** | Backfill metadata persistence, analytics UI | `src/components/ArchetypeJourneySection.jsx`, `src/lib/archetypeJourney.js` |
| **WX-6 Mobile Experience** | Accordions, animation, offline hints | `src/components/Journal.jsx`, `src/components/Accordion.tsx` (new) |
| **WX-7 Observability** | Telemetry, log hygiene, GraphRAG warnings | `src/lib/telemetry.js`, `functions/api/journal/index.js` |

Assign a DRI per workstream before starting development to avoid regressions.

---

## 7. Implementation Roadmap

### Phase 0 – Prep & Design Sync (_1 sprint_)
1. Confirm the component inventory and shared Tailwind tokens.
2. Update Figma with inline status patterns + mobile accordion spec.
3. Instrument current telemetry to capture baseline metrics.

### Phase 1 – Feedback & Status Foundation (_~1.5 sprints_)
1. Refactor `JournalEntryCard` actions to expose inline success/error banners (see instructions below).
2. Mirror the inline feedback pattern inside `JournalInsightsPanel` export/share flows.
3. Add `aria-live="polite"` to reusable `StatusInline` component.
4. Replace ToastContext usage in affected surfaces; keep global toasts only for cross-page alerts.

### Phase 2 – Mobile & Saved Filters (_~2 sprints_)
1. Introduce `AccordionSection` component with keyboard support.
2. Rebuild the mobile rail so Filters, Insights, and Archetype sections expand independently.
3. Implement saved filter storage (local for guests, API for authed users).
4. Harmonize token usage across all chip/button variants via Tailwind plugin.

### Phase 3 – Analytics & Telemetry Enhancements (_~1 sprint_)
1. Persist `lastProcessedAt` + `entriesProcessed` on archetype runs and render within the populated state.
2. Surface GraphRAG prompt metadata callouts whenever `includedInPrompt` is false.
3. Emit telemetry events for exports, migrations, and accordion usage.

### Phase 4 – QA & Rollout (_~0.5 sprint_)
1. Execute the QA checklist in §10.
2. Update docs (`docs/journal-redesign.md`, onboarding guides) with new screenshots.
3. Coordinate staged rollout (behind feature flag if necessary).

---

## 8. Detailed Recommendations & Instructions

### 8.1 Layout & Navigation
- Promote a dedicated `JournalLayout` wrapper to encapsulate the two-pane grid and sticky rail logic.
- Desktop (`lg+`): `grid-cols-[minmax(0,1fr)_360px]`, `gap-6`, sticky rail w/ `top-6`.
- Mobile (`<lg`): Replace `MOBILE_SECTIONS` segmented control with an accessible accordion:
  - Each section gets a heading button (`button` + `aria-expanded`), focus outline, and `aria-controls`.
  - Persist open/closed state in `localStorage` keyed by section to remember user preference.
  - Provide “Jump to Today / Insights / History” skip links for screen readers at top of page.

### 8.2 Entry Creation & History
- **Inline status component**: create `src/components/InlineStatus.jsx` that accepts `{ type: 'success' | 'error' | 'loading', message, icon }` + `aria-live`.
- `JournalEntryCard` instructions:
  1. Replace `showToast` calls inside `handleEntryCopy`, `handleEntryExport`, `handleEntryShare`, `handleEntryDelete`.
  2. Store per-action state (`copyStatus`, `shareStatus`, etc.) with timers resetting after 4s.
  3. Render `InlineStatus` inside the footer next to the corresponding button.
  4. Add optimistic UI for delete: collapse card immediately, then revert on error.
- Expand reflections:
  - Display per-card reflections directly under the card list (truncate with “Show more” accordion).
  - Provide quick-add button near cards list; on mobile, keep inline with minimal spacing.

### 8.3 Filters & Saved Views
- Unify outline tokens via `theme('colors.secondary/40')`; define `btn-outline` + `chip` classes in `tailwind.config.js` or `styles/tailwind.css`.
- Saved filters MVP:
  - Guest: store up to 3 saved filter objects in `localStorage['journal.savedFilters']`.
  - Authed: POST/GET `/api/journal/filters` (build lightweight Pages Function storing JSON per user).
  - UI: Add “Save current filters” action + pill list; allow rename/delete inline.
  - Provide guardrail copy (“Saved filters sync when logged in”).

### 8.4 Insights, Export & Prompt Metadata
- Toolbar actions (Share, Export CSV, PDF, Visual Card, Custom Link) should:
  - Disable during request, show spinner inside button, then render inline status banner beneath toolbar.
  - Surface failure reasons inline (e.g., GraphRAG disabled due to budget).
- Add GraphRAG callouts:
  - If `promptMeta.graphRAG.includedInPrompt === false`, show a warning chip (“Context trimmed; insights may be limited”).
  - Include `semanticScoringRequested/Used/Fallback` stats inside insights card for debugging.
- Export pipelines:
  - Move CSV/PDF generation to shared helper in `src/lib/exporters`.
  - Log telemetry event with `context`, `entriesCount`, and `isFiltered`.

### 8.5 Archetype Journey & Analytics
- Persist metadata:
  - Extend API response to include `journey.lastProcessedAt` & `entriesProcessed`.
  - Render small caption under header (“Processed 42 entries • Feb 12, 2025”).
  - Keep success/failure statuses inline instead of toast.
- Provide “Refresh analytics” button, disabled while processing, with tooltip referencing rate limit.

### 8.6 Mobile Behavior & Offline UX
- Accordion sections degrade gracefully offline:
  - Cache last insights snapshot in IndexedDB/localStorage.
  - Show “Last updated …” text when offline.
- Provide sticky bottom CTA on mobile for “New entry” to avoid scrolling back to top.

### 8.7 Auth, Persistence & Migration
- Ensure `useJournal` detects auth changes mid-session and re-fetches entries.
- Migration flow:
  - Display inline checklist (entries detected, duplicates merged, reflections preserved).
  - Provide “Download backup JSON” before migration for confidence.
- Security:
  - Redact PII in logs; ensure no prompt text is stored in plain telemetry.
  - Validate saved filters payload server-side to prevent injection via SQL/JSON.

### 8.8 Observability & Telemetry
- Instrument `src/lib/telemetry.js` to emit:
  - `journal.entry_created`, `journal.export_completed`, `journal.migration_started/completed`, `journal.accordion_toggled`.
- Expose simple dashboard (even CSV) for product review meetings.
- Wire logging toggles through environment variables to avoid leaking secrets in production logs.

---

## 9. Engineering Checklist per Workstream

1. **WX-1 Layout & IA**
   - [ ] Extract layout wrapper
   - [ ] Implement skip links + tab order audit
   - [ ] Ensure sticky rail doesn’t overlap modals
2. **WX-2 Entry Surfaces**
   - [ ] InlineStatus component + tests
   - [ ] Action-specific state machine
   - [ ] Reflections accordion + show-more
3. **WX-3 Insights & Sharing**
   - [ ] Toolbar spinner + disabled states
   - [ ] GraphRAG callout component
   - [ ] Export helper module + telemetry
4. **WX-4 Filters & Saved Views**
   - [ ] Tailwind tokens updated + docs
   - [ ] Saved filters storage + API
   - [ ] UI for list/rename/delete
5. **WX-5 Archetype Journey**
   - [ ] API extends analytics payload
   - [ ] Header metadata + refresh button
   - [ ] Inline result messaging
6. **WX-6 Mobile Experience**
   - [ ] Accessible accordion component
   - [ ] Section persistence + offline copy
   - [ ] Sticky bottom CTA
7. **WX-7 Observability**
   - [ ] Telemetry helpers + sampling guard
   - [ ] Dashboard or CSV export for metrics
   - [ ] Incident playbook for failed migrations

---

## 10. QA & Validation Protocol

1. **Functional**
   - Create/save/delete entries (local + authed)
   - Trigger inline status success/fail for copy/export/share/delete
   - Run archetype backfill + verify metadata persists
   - Test saved filters CRUD (local + authed)
2. **Accessibility**
   - Keyboard-only navigation through accordions, toolbar, entry actions
   - Screen reader (NVDA/VoiceOver) announces inline statuses and accordion state
   - Ensure `aria-live` regions do not spam announcements (debounce updates)
3. **Responsive**
   - Breakpoints: 320px, 375px, 768px, 1024px, 1280px
   - Accordion + sticky CTA behavior verified
   - Ensure summary band doesn’t wrap oddly on small screens
4. **Performance**
   - Lazy-load history >50 entries (virtualized list or pagination)
   - Measure interaction latency for exports (<500ms to show busy state)
5. **Security & Data**
   - Authenticated API calls enforce ownership
   - Saved filters sanitized server-side
   - No secrets in logs/telemetry
6. **Gates**
   - `npm test`
   - `npm run gate:narrative` or `npm run gate:vision` if related modules touched
   - Visual regression spot-check (Storybook/chromatic if available)

---

## 11. Rollout & Communication

1. **Feature flag** `journalInlineStatus` to dark-launch inline feedback for internal users.
2. **Docs update**: refresh `docs/journal-redesign.md`, `docs/journal-gap-assessment.md`, and onboarding decks with new screenshots + behavior notes.
3. **Release notes**: highlight saved filters, inline feedback, and improved mobile navigation.
4. **Telemetry watch**: during the first week, monitor migration success, exports, and accordion engagement daily.
5. **Support script**: provide CX with canned responses for inline status issues, migration troubleshooting, and saved filter questions.

---

## 12. Risks & Mitigations

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Inline statuses regress global toast UX | Users miss critical alerts | Keep ToastContext for cross-page alerts; add integration tests verifying inline + toast do not conflict |
| Saved filters API abuse | Excess storage / injection | Rate-limit per user, validate payload schema server-side, escape strings |
| Accordion accessibility gaps | Screen-reader users blocked | Reuse proven accordion pattern (WAI-ARIA Authoring Practices); add automated axe tests |
| Telemetry PII leakage | Compliance risk | Hash user IDs, redact narrative text before logging, gate logs behind env flag |
| Migration failures mid-session | Data inconsistency | Add transactional migration endpoint + rollback on error; expose retry inline |

---

## 13. Next Actions

1. Assign DRIs to the seven workstreams and slot them in the upcoming sprint board.
2. Create issues referencing the checklist items and link back to this journal.
3. Schedule a design/dev sync to align on inline status visuals and accordion motion.
4. Begin Phase 1 implementation with InlineStatus component + toast removal.

Document updates should be appended to this file with timestamps; treat it like a living journal so decision history stays searchable.
