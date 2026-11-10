---
target: Coach suggestion wizard / Shape a question with clarity components
total_score: 27
max_score: 40
na_heuristics:
p0_count: 0
p1_count: 2
target_identity: "file:/home/ubuntu/tarot/src/components/GuidedIntentionCoach/GuidedIntentionCoachView.jsx"
target_fingerprint: "sha256:c3379b89c64005822958730636be4653ccc24f2cbe67d08992978f4ddde68c10"
target_path: /home/ubuntu/tarot/src/components/GuidedIntentionCoach/GuidedIntentionCoachView.jsx
timestamp: 2026-10-23T05-10-26Z
slug: tentioncoach-guidedintentioncoachview-jsx-d15e16b4
---
Method: dual-agent (A: /root/coach_design_review · B: /root/coach_evidence_review), with an additional source and regression review by the parent.

**The coach has a coherent visual foundation, but it currently works better as a question generator than as a guide for clarifying the concern a person brought.** The highest priorities are preserving that concern and making the resulting question the focus of the final step. No application code was changed.

The review covers the “Shape a question with clarity” dialog, topic/timeframe/depth choices, question editing and scoring, suggested questions, templates and recent history, AI states, draft reopening, and the handoff to the reading page. Findings below distinguish current Code/Render evidence from synthetic fault injection.

1. **[P1] “Shape it with the coach” loses the question it promises to help shape.**

   **Code + Render.** I entered “Will I ever stop doubting myself in my career?” and chose the contextual coach action. The wizard selected Love & Relationships and produced “Where do I stand with my closest relationships and connections, how did I arrive here, and how can I step forward this week with confidence?” The independent design reviewer reproduced the same mismatch with a promotion question. The existing reading-page question survives dismissal; applying the unrelated coach result replaces it.

   The launcher and dialog props do not pass the current question into the session. Start the contextual action from the person's existing wording, preserving its subject and time reference. The empty-question entry can retain the topic-first flow. Sources: [entrypoint](../../src/TarotReading.jsx#L1354), [contextual action](../../src/components/QuestionNudge.jsx#L23). Rendered example (`/home/ubuntu/tarot/output/playwright/coach-wizard-review-20261023/core/question-handoff.png`, local artifact). Suggested work: Impeccable shape/clarify.

2. **[P1] The final step offers “Use question” before presenting the question clearly.**

   **Code + Render.** Next → Next lands on depth choices and optional detail, with an enabled docked apply button. The actual question sits farther down, behind configuration chips, mode controls, and explanations. This happens at desktop and phone sizes. On a phone, Templates also takes a full-width row above the current task. 390px opening (`/home/ubuntu/tarot/output/playwright/coach-wizard-review-20261023/design/guest-mobile-depth-top-390.png`, local artifact).

   The same nesting causes a separate compact-layout symptom: at 320×568 with a 32px root font, the padding leaves an extremely narrow text column and the stacked footer occupies roughly half the viewport. Words split into several fragments. Controls remain reachable and there is no measured horizontal overflow; reading and editing are still burdensome. This is root-font enlargement, not browser page zoom. Enlarged-text example (`/home/ubuntu/tarot/output/playwright/coach-wizard-review-20261023/evidence/guest-320-light-root200-depth.png`, local artifact).

   Make reviewing the question an explicit destination, with the editor first and adjustment controls secondary. Reduce nested insets and dock spacing in the compact enlarged-text state. Sources: [depth/review order](../../src/components/GuidedIntentionCoach/GuidedIntentionCoachView.jsx#L449), [question placement](../../src/components/GuidedIntentionCoach/GuidedIntentionCoachView.jsx#L578), [footer action](../../src/components/GuidedIntentionCoach/GuidedIntentionCoachView.jsx#L940). Suggested work: Impeccable distill/layout/adapt.

3. **[P2] Changing settings or adding a detail can discard hand-edited wording.**

   **Code + Render.** I wrote “What can help me speak more openly with my sister this week?” Changing Timeframe to Next 30 days replaced it with the generic relationships question, losing “my sister” and the communication focus. The independent reviewer reproduced this by adding a promotion detail after editing a question about asking for support. There is no visible restore action.

   The implementation deliberately re-enables generation on setting/detail changes; existing tests preserve that behavior. It remains a product interaction risk. Retain the previous edited version and offer “Restore my wording,” or require an explicit regenerate action after manual editing. Sources: [detail handler](../../src/components/GuidedIntentionCoach/GuidedIntentionCoachView.jsx#L475), [generation release](../../src/contexts/GuidedIntentionCoachContext.jsx#L249). Reproduced replacement (`/home/ubuntu/tarot/output/playwright/coach-wizard-review-20261023/core/question-replaced-after-setting.png`, local artifact). Suggested work: Impeccable harden/clarify.

4. **[P2] “Question quality / Excellent” makes claims the wording checks cannot support.**

   **Code + Render.** “How can I guarantee that my partner comes back to me this week?” receives 100/100 internally, the visible “Excellent” label, and all four positive badges. The fixed-outcome check catches “guaranteed” but misses “guarantee.” A question about what a partner secretly thinks also scores 100 in the utility. These are direct gaps in the feature's reflective-framing guidance. Guarantee example (`/home/ubuntu/tarot/output/playwright/coach-wizard-review-20261023/core/guarantee-quality.png`, local artifact).

   The language gate also equates mostly Latin letters with English. “¿Cómo puedo cuidar mi relación con mi pareja esta semana?” receives “Good” and English advice to name a person or role, despite already naming the partner. Spanish example (`/home/ubuntu/tarot/output/playwright/coach-wizard-review-20261023/core/spanish-quality.png`, local artifact).

   Use a narrower label such as “Question framing,” strengthen the specific checks, and avoid grading languages the heuristics do not support. Feedback should explain a useful adjustment without implying that meaning has been validated. Sources: [framing patterns](../../src/lib/questionQuality.js#L28), [language gate](../../src/lib/questionQuality.js#L201), [displayed endorsement](../../src/contexts/GuidedIntentionCoachContext.jsx#L395). Suggested work: Impeccable clarify/harden.

5. **[P2] The template library says “archived” when an entry is actually dropped.**

   **Code + Render.** Saving a ninth template keeps eight, removes the oldest, and reports “Template saved (oldest archived to keep 8 max).” The capacity note does disclose replacement, but the success message implies a recovery location that does not exist. Storage simply slices the list to eight entries.

   Identify the replaced template, use truthful language, and provide undo or an explicit replacement choice. Sources: [success message](../../src/contexts/GuidedIntentionCoachContext.jsx#L460), [storage cap](../../src/lib/coachStorage.js#L99). Capacity example (`/home/ubuntu/tarot/output/playwright/coach-wizard-review-20261023/design/template-capacity.png`, local artifact). Suggested work: Impeccable clarify/harden.

The strongest parts should be preserved: Tableu's warm serif/ink visual identity; approachable choice descriptions and a visible selection check; exact suggestion/template wording carried into an editable field; nested Escape and focus restoration; and useful local fallback when generation fails. The coach does not need a new visual identity.

The main cognitive-load problem is concentrated in the last step. Depth, detail, settings chips, AI, Remix, provenance, editing, saving, and grading compete before the reader can recognize the final wording. For a first-time reader, the entry mismatch undermines trust. For a distracted phone user, the buried result and temporary draft lifetime make interruption costly. For a keyboard user, Next can leave focus on the apply action before the result is visible, even though the underlying tab and modal mechanics work well.

The independent design assessment scored **27/40 — Acceptable, with clear improvements needed**:

| Heuristic | Score | Main assessment |
|---|---:|---|
| System status | 3/4 | Steps and loading are clear; review destination is weak |
| Match with the reader's task | 3/4 | Approachable labels; contextual entry loses the concern |
| User control | 2/4 | Good dismissal; weak recovery after replacement |
| Consistency | 3/4 | Strong visual system; inconsistent AI terminology |
| Error prevention | 2/4 | Good field bounds; weak replacement safeguards |
| Recognition | 3/4 | Helpful choices/history; question is initially buried |
| Efficiency | 3/4 | Useful shortcuts, templates, and suggestions |
| Minimalism | 2/4 | Final step carries too many competing controls |
| Error recovery | 3/4 | Useful local fallback; no restore for replaced wording |
| Help | 3/4 | Useful descriptions; unclear draft/replacement semantics |
| **Total** | **27/40** | All ten heuristics apply |

Additional technical and copy findings:

- **[P2, synthetic fault injection]** HTTP 200 JSON containing an object-valued `question` crashes the coach into “Unable to open question coach / Check your connection.” The rest of the app survives. Validate the response value as a nonempty string and use the existing fallback. No malformed production response was observed. Sources: [API acceptance](../../src/lib/intentionCoach.js#L323), [trim call](../../src/contexts/GuidedIntentionCoachContext.jsx#L333). Fault screenshot (`/home/ubuntu/tarot/output/playwright/coach-wizard-review-20261023/evidence/pro-synthetic-ai-malformed-shape.png`, local artifact).
- **[P2, interaction tradeoff]** Radio arrow keys move focus while Space/Enter selects. This is deliberate protection against replacing prefilled wording, but no instruction explains the model. A keyboard user can advance believing a focused card was selected. This is not a demonstrated WCAG failure.
- **[P3]** Recent-question suggestions repeat the question as both helper and preview; mobile setting pills truncate useful labels; guests are told to “toggle AI” when only a Plus badge appears. “Creative mode,” “AI Personalization,” and “Personalize with AI” should share one name.
- **Product limitation:** Close/reopen preserves unfinished work for 30 minutes in memory. Reload starts fresh by design. The UI does not explain that lifetime.

Verification: a fresh local Vite build succeeded; **95/95 focused unit tests** passed; **58/58 existing coach E2E tests** passed across desktop Chromium and mobile WebKit. Independent manual browser review used separate guest and genuine local active-Pro sessions at 320, 390, and 1440 widths, with dark/light and enlarged-text samples. The CLI detector returned zero findings. All 22 saved axe results contain zero definite violations, with contrast incompletes on layered surfaces. The browser overlay ran on topic, depth, and templates and reported six page-wide style signals; these include background content and are not six confirmed coach defects.

The manual browser passes were not a full Cartesian matrix. Physical devices, assistive technology, actual virtual-keyboard/browser-chrome behavior, page zoom, inactive/Free/Plus account sessions, and live provider quality were not established. Generation success/failure/fault cases used scoped fixtures; no real model calls occurred. Active Pro authentication was real and all reviewer sessions logged out.

Two product choices would guide a follow-up: should the contextual entry **refine the current question by default**, or offer **“Refine this / Start fresh”**? Should the quality panel use **gentle framing suggestions**, or **retain a grade after tightening its checks**?

> Portability note (23 October 2026): local evidence paths above identify artifacts on the original review host. Those files are not included in this Git handoff. Repository source links are relative.
