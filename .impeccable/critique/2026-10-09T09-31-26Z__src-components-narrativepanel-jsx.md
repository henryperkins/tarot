---
target: personalized reading gestures
total_score: 26
max_score: 36
na_heuristics: 9
p0_count: 0
p1_count: 1
target_identity: "file:/home/ubuntu/tarot/.worktrees/reading-gestures-react-bridge/src/components/NarrativePanel.jsx"
target_fingerprint: "sha256:7706c193ebc673218b0dcdc3f78f9825a3b2fc301e813f665470b95d8f516db4"
target_path: /home/ubuntu/tarot/.worktrees/reading-gestures-react-bridge/src/components/NarrativePanel.jsx
timestamp: 2026-10-09T09-31-26Z
slug: src-components-narrativepanel-jsx
---
Method: dual-agent (independent A: preview_design_review; independent B: preview_evidence_review). Baseline: `ad8c97ce1962329b263a79d792e3acc66978287c`, before the repairs and deck expansion in this follow-up. Questions skipped: the user authorized both critical review and continued implementation.

The reading already initiates a meaningful visual dialogue, but explicit inspection weakens its most important cue: brightening the whole card erases the localized light. Preserve its quiet automatic gestures, persistent spatial shelf, original prose, and Source Serif/Inter typography. Repair visibility and continuity before adding more animation.

Design health at the reviewed baseline: **26/36 — good, with specific recognition and feedback gaps.** This is a heuristic assessment, not a WCAG or performance certification.

| Heuristic | Score | Evidence |
| --- | ---: | --- |
| System status | 3/4 | Arrival, presence and held states are understandable. |
| Real-world match | 4/4 | Star's two pours support the recorded interpretation. |
| User control | 3/4 | Holds do not stop text; keyboard release is available. |
| Consistency | 3/4 | Shelf retains positions, but compact targets miss the repo's 44px contract. |
| Error prevention | 3/4 | Unsupported imagery falls back to identity. |
| Recognition | 2/4 | Held illumination disappears; synthesis loses established detail. |
| Efficiency | 3/4 | Arrived associations remain revisitable. |
| Minimalism | 3/4 | Reading remains primary; laboratory controls are outside it. |
| Error recovery | N/A | Not exercised in this visual critique. |
| Contextual help | 2/4 | Some details are difficult to recognize at compact crops. |

Strengths: the six Star moments have semantic purpose, identity inspection does not invent a detail, and prior cards retain spatial memory. The five shelf options are a justified grouping rather than five competing actions. Cognitive load is moderate. New readers benefit from image/prose continuity; low-vision or reduced-motion readers depend especially on persistent static emphasis; distracted phone readers need a recognizable crop when they return.

## Confirmed findings and bounded repairs

1. **P1 — Brightening erases local emphasis.** In held/reduced-motion Star inspection the duplicated illuminated image differs from the full-brightness base by only 0.025 mean RGB units (0–255), maximum 2. Add a softly masked surrounding veil so the detail retains contrast. The regression compares rendered pixels with/without the light layer, including reduced motion.
2. **P2 — Synthesis discards established imagery.** Dynamic Ace/Queen relationship targets contain empty detail IDs despite earlier sprout/cup description. Reuse those details only for the specific grounded drive/sensitivity synthesis; arbitrary pairs must keep whole-card context.
3. **P2 — Reversed planted swords lose their distinguishing ends.** The 106px and short 72px phone focus stages clip the existing Seven of Swords crop. Widen its framing and verify both painted trace ends remain inside the viewport.
4. **P2 — Compact shelf targets miss Tableu's 44px contract.** Buttons measure 40px or 29px wide. Reserve a 44px hit area while retaining the artwork size and horizontal shelf scrolling. This is a repository contract issue, not a claim that WCAG 2.2's 24px minimum failed.
5. **P2 — Exact Celtic imagery is missed.** “five people swing staffs in a chaotic scrum” fails the physical scene predicate, and “lantern first” lacks its grounded return. Add the demonstrated constructions, coalesce duplicate staffs/scrum cues, and require earlier literal imagery for interpretive returns.

The first four findings came from A before seeing B's output. B independently confirmed the synthesis gap and Celtic miss. These are repaired in the accompanying changes; final checks are recorded in the reading-motion verification handoff. This report's score remains the baseline assessment, not a speculative improved score.

## Detector and rendered evidence

B's scoped CLI scan returned zero findings. The temporary live overlay produced 4 groups/6 flags for Star, 9/11 for the five-card phone view and 4/5 for Celtic. Inherited page glow/shadow/divider treatments, a flat-type flag that missed Source Serif, and generic width-transition warnings did not establish a component regression. Inline phrase padding is not an ordinary standalone button target. Overlay occlusion itself was excluded. No suppressed warning is presented as a proven accessibility pass.

Fresh Chromium covered desktop 1280×1000/1100×1000, 390×844 and 375×667, streaming/completed/held states, keyboard selection/release, and reduced motion. Actual Star animation handles ran during eligible motion and reached zero after settlement; reduced motion had zero. Real local guest auth returned 401; Pro login and active tier returned 200; controlled recorded SSE exercised hold/continue/release/completion; logout returned 200 followed by 401. Credentials and session state were not retained. The auth lane used the real Worker and the branch frontend via loopback proxy, with service workers blocked and local-network checks disabled; reading output was recorded, not live generated.

No horizontal overflow or page errors were observed in those runs. Free/Plus/inactive tiers, physical devices, screen readers, BFCache, default production service-worker delivery and universal semantic coverage were not verified. The later 70-card expansion uses static authored focal ellipses, not 70 finished cinemagraphs or segmentation masks.
