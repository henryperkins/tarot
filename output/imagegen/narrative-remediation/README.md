# Your Personalized Narrative — remediation mockups

Three coordinated proposals for Tableu, based on the rendered local-app audit of September 23, 2026. The aim is to resolve all nine findings while preserving the Midnight Reading Room identity, existing actions, and agency-centered copy.

**Current version: v2.** The mockups below were regenerated using the corrected [prompts.md](prompts.md), following [the independent review](prompt-review.md). The [generation notes](generation-v2.md) record the visual checks, targeted corrections, dimensions, and remaining raster limitations. Original v1 images are preserved alongside them.

**Implementation companion:** [Your Personalized Narrative remediation specification](../../../docs/superpowers/specs/2026-09-23-personalized-narrative-remediation.md) maps all nine findings to component changes, behavior and state requirements, embedded v2 guidance, and acceptance cases A01–A09. Its measurable requirements take precedence over approximate image geometry.

**Design target: 19/20, with 18/20 as the acceptance floor.** This is a proposed result, not a new audit score. The audited implementation remains 10/20 until remediation and verification. These generated images demonstrate appearance; they do not prove DOM semantics, focus behavior, hit areas, contrast, responsive operation, or performance.

## The series

| Mockup | Final file | What to inspect |
| --- | --- | --- |
| 01 — Light reading | [01-light-reading-v2.png](01-light-reading-v2.png) | All five narrative sections, daytime surfaces, darker source status labels, stacked feedback ratings, visible focus, and existing reading actions. |
| 02 — Mobile follow-up | [02-mobile-follow-up-v2.png](02-mobile-follow-up-v2.png) | An opaque foreground drawer above a dimmed reading, wrapped question buttons, disabled empty-input Send, and the complete journal-history row. Intended layout: 390 × 844 CSS pixels. |
| 03 — Short desktop chat | [03-short-desktop-chat-v2.png](03-short-desktop-chat-v2.png) | Visible question overflow between the header and composer; disabled empty-input Send and the journal-history control remain visible. Intended layout: 1440 × 500 CSS pixels. |

01 is a full-page composition, not a claim that all content fits in one desktop viewport. V2 contains the complete five-section synthetic reading fixture. Implementation must preserve the complete generated reading and all user-authored content.

Feedback groups remain vertically stacked, matching the established component pattern. Existing visual-studio and recent-media entry points remain present; their otherwise working dialogs retain their established behavior. The short desktop mockup's subdued background is illustrative; exact product copy comes from the application, not generated pixels.

## How all nine findings are addressed

| Audit finding | Visible direction | Required implementation and acceptance evidence |
| --- | --- | --- |
| P1 — Mobile drawer behind the page | 02: clearly separated foreground sheet; page and action dock cannot overlap it. | Use a real defined modal layer or portal. Make background content inert while open. At both 320px and 390px, pointer hit tests must resolve to the close button, suggestions, textarea, and send control rather than underlying reading content. |
| P1 — Closed dialogs retain keyboard targets | 02 and 03 show only the open state; a static image cannot show this fix. | Apply real boolean inert with correctly coordinated hidden state. Keep chat mounted on ordinary close, or preserve its local state before unmounting. Trap focus while open, close with Escape, and restore focus to the opener. After closing, Tab must never enter the hidden drawer or modal. Verify draft/conversation retention through repeated open/close cycles and reduced motion. |
| P1 — Suggestions lose button semantics | 02 and 03: recognizable, full-size question buttons. | Preserve native button roles; place each button inside a list item if list semantics are wanted. Enter/Space must activate suggestions. No aria-allowed-role violations. |
| P1 — Light-theme success labels fail contrast | 01: dark sage text and check icons on pale sage. | Define a light-theme success token. Proposed opaque pair: #2F6A3B on #EDF4EE, calculated contrast 5.78:1. Use text plus icon, not color alone. Verify actual rendered badges at 4.5:1 or higher, including opacity and blended backgrounds. |
| P2 — Short desktop window clips the footer | 03: independently scrollable questions, visible composer and checkbox. | Use a flex-column dialog bounded by the dynamic viewport; allow its middle region to shrink and scroll. Header and footer stay reachable. At 1440 × 500 and with 200% text, all controls must remain accessible. When expanded text or an on-screen keyboard leaves insufficient space, permit the whole dialog to scroll instead of clipping controls. |
| P2 — Feedback radios do not support arrow keys | 01: one selected rating per group, separate focus indicator. | Prefer native radio groups with fieldset/legend. Tab enters each group once; arrow keys move and select; Space selects; the next Tab leaves the group. A selected state must not be mistaken for keyboard focus. Preserve current rating labels and submission behavior. |
| P2 — Inconsistent heading hierarchy | 01: narrative title, section titles, and supporting panels form a clear hierarchy. | Keep the page's h1, use h2 for Your Personalized Narrative and peer panels, and h3 for narrative subsections and Highlights. Do not turn section headings into higher-level headings or visual-only spans. Verify the accessible heading outline. |
| P2 — Small chat touch targets | 02 and 03: generously padded questions and close/send controls. | Set every interactive hit area to at least 44 × 44 CSS pixels; use 48 × 48 for close/send. A smaller visible icon or outline may sit inside the larger hit area. Verify DOM rectangles at 320px and 390px, not raster proportions. |
| P2 — Skip link targets a removed spread section | Navigation retained across the series; skip links appear only on keyboard focus. | Render skip links only for currently mounted targets. In the completed reading state, offer a working Skip to narrative target. Omit the spread destination when setup is hidden; skip activation must not reset the reading or reveal hidden setup. Verify activation moves focus to a real destination. |

## Design details to carry into implementation

- Preserve Source Serif 4 headings, Inter UI, restrained brass, and readable narrative measures. Do not introduce a new brand direction.
- Keep mobile body text at least 16px and comfortable line spacing. Preserve complete labels at narrow widths and with enlarged text.
- Keep all light-theme surfaces, status tokens, form controls, and focus rings theme-aware. Proposed brass #7D623B against white calculates to 5.70:1. Proposed dark-theme brass #D4B896 against #1C1A22 calculates to 9.09:1. These are token calculations, not measurements of generated pixels.
- Keep the journal-history option's current meaning and user-selected state; the checked state in these examples is illustrative.
- Preserve the exact safety language: “Reflective guidance only. Not medical, mental health, legal, financial, or safety advice.”
- Respect reduced motion without delaying access to content or leaving hidden focusable elements. Avoid new expensive blur or glow effects.

## Evidence needed for the target score

| Dimension | Audited | Proposed target | Completion evidence |
| --- | ---: | ---: | --- |
| Accessibility | 1/4 | 4/4 | All relevant role, hidden-focus, contrast, radio, heading, and skip-link failures resolved; keyboard and accessibility scan evidence. |
| Performance | 3/4 | 3/4 | Preserve the existing behavior; verify no new layout/scroll or rendering regressions. The mockups provide no runtime performance evidence. |
| Responsive behavior | 2/4 | 4/4 | 320px, 390px, 1440px, a 500px-high desktop window, 200% text, and mobile keyboard checks. |
| Theming | 2/4 | 4/4 | Real light/dark contrast, surfaces, focus states, and status labels verified. |
| Implementation integrity | 2/4 | 4/4 | Valid semantics, predictable modal lifecycle, working targets, and regression coverage. |
| **Total** | **10/20** | **19/20** | **Re-audit the running implementation; accept only at 18/20 or higher with no unresolved P1 findings.** |

Retain the existing generation, streaming, retry, reduced-motion, visual-studio, and recent-media regressions. Add focused coverage for the nine findings; inspect rendered desktop/mobile behavior. No production deployment, live AI generation, TTS, or persistence verification is implied by this design package.

## Provenance

Generated with the built-in image generation tool using screenshots from the preceding local UI audit. Each v2 image was visually inspected and received one targeted correction: source-status contrast in 01, mobile scale/layout in 02, and the close-control outline in 03. Final images were copied into this workspace; application source was not changed.

The exact v2 generation and correction calls are recorded in [generation-v2.json](generation-v2.json), with a readable summary in [generation-v2.md](generation-v2.md). The reusable image-generation prompts are [prompts.md](prompts.md); implementation requirements are in the [companion specification](../../../docs/superpowers/specs/2026-09-23-personalized-narrative-remediation.md). The original generation prompts remain in [prompts.generated-v1.md](prompts.generated-v1.md); original audit screenshots are preserved in the references directory.
