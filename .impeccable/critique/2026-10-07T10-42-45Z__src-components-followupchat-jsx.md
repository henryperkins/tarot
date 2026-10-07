---
target: follow-up chat mobile suggestions
total_score: 24
max_score: 40
na_heuristics:
p0_count: 0
p1_count: 2
target_identity: "file:/home/ubuntu/tarot/src/components/FollowUpChat.jsx"
target_fingerprint: "sha256:6ebcb9eacd7877e05b8f5dad761fd45376bbe20e4a64a0a3a178968cc3a70c82"
target_path: /home/ubuntu/tarot/src/components/FollowUpChat.jsx
timestamp: 2026-10-07T10-42-45Z
slug: src-components-followupchat-jsx
---
Method: dual-agent (A: /root/design_review · B: /root/detector_evidence).

The mobile hierarchy is inverted: suggested questions dominate a surface whose main job is continuing the conversation. In one 390px capture, four suggestions occupied 344px—45% of the sheet. The user's screenshot shows the same imbalance. Keep Tableu's warm surfaces, serif title, and contextual suggestions; make composing and reading the conversation the focus.

Design health: **24/40 — significant mobile improvements needed.** These are heuristic judgments informed by rendered and source evidence.

| Heuristic | Score | Main observation |
|---|---:|---|
| System status | 3/4 | Usage and response feedback are clear. |
| Familiar language | 3/4 | Relevant questions, wordy phrasing. |
| User control | 2/4 | Suggestions cannot be collapsed after reopening. |
| Consistency | 3/4 | Cohesive controls; sending behavior needs clarity. |
| Error prevention | 2/4 | Suggestion selection immediately sends. |
| Recognition | 3/4 | Useful context; original question truncates mid-thought. |
| Efficiency | 2/4 | Mandatory opening suggestions; reopened ideas displace answers. |
| Minimalism | 1/4 | Four large cards command excessive attention. |
| Error recovery | 3/4 | Source preserves failed questions for retry. |
| Contextual help | 2/4 | Mobile shows desktop keyboard advice. |
| **Total** | **24/40** | **Significant mobile improvements needed.** |

What works: suggestions refer to the actual cards and intention, the composer remains available at ordinary heights, and legible text with generous touch targets supports comfortable interaction. The reading-room identity fits the product; the problem is composition and disclosure.

1. **[P1] The opening suggestion wall overpowers the question field.** Four full-width, multi-line buttons with strong borders turn an optional aid into the main event. Show **two short contextual starters plus “More ideas”**, using 44–48px minimum touch targets. Aim for roughly 100–140px of initial suggestion UI when labels fit, while allowing text enlargement. Suggested command: `/impeccable adapt`.
2. **[P1] Reopening ideas interrupts the conversation.** The expanded list appears above the transcript and pushes the latest answer out of view. Put a reversible ideas disclosure near the composer, with an explicit hide control; preserve the reader's place in the conversation. Suggested command: `/impeccable layout`.
3. **[P2] Selecting an idea also sends it.** A tap immediately submits the question. If labels become shorter, fill the composer with the complete generated question so it can be reviewed or edited before Send. Suggested command: `/impeccable clarify`.

Minor observations: hide “Shift+Enter for a new line” on touch phones; shorten the journal label to “Use journal insights”; replace the repeated, truncated original intention with a clear phrase such as “Clarify my original question.” Preserve the full intention in reading context.

Cognitive load is moderate: focus, hierarchy, and progressive disclosure fail. Four starter questions plus writing one's own create five competing question paths. For a first-time reader, ideas offer reassurance but their scale suggests another required decision. A returning reader has to bypass that menu; a larger-text reader gets even taller buttons, so compactness should come from fewer choices and shorter copy.

Evidence: fresh local build; supplied screenshot; Chromium mobile Pro/active at 390×844 and 320×568; guest Chromium at 390×844; Pro WebKit light theme at 375×667; Pro desktop Chromium at 1440×900. Real local API authentication was verified separately from synthetic reading and follow-up streams, with logout afterward. Error recovery scoring uses source review, not exercised failures. Physical iPhone keyboard behavior and other subscription tiers are outside this run's verified coverage. A simulated short visual viewport required whole-sheet scrolling to reach the input; this is a responsive risk, not proof of physical keyboard behavior.

The scoped CLI detector reported **0 findings** in FollowUpChat.jsx. Browser overlay injection and execution succeeded; whole-page totals of 17/13/24/15 include obscured background UI and supply no verified chat-specific defect. The hierarchy findings above come from rendered layout, not detector flags. Browser automation was headless, so no user-visible live overlay is claimed. Browser contexts, fixture servers and detector live-server were stopped.

Source anchors: [suggestion rendering](/home/ubuntu/tarot/src/components/FollowUpChat.jsx:706), [suggestion sizing](/home/ubuntu/tarot/src/styles/follow-up.css:81), [tap submission](/home/ubuntu/tarot/src/components/FollowUpChat.jsx:632), [original-question truncation](/home/ubuntu/tarot/src/lib/followUpSuggestions.js:409).

Application code was unchanged. This critique recommends a mobile adaptation that preserves the current visual identity.
