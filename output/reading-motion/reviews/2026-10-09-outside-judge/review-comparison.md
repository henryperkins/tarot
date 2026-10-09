# Comparison of the two outside reviews

Revision: `f6bcfcd17cc52dfe36cea65a286867f8a3e80c95`. This note records follow-up source inspection and bounded probes by the implementation-side reviewers. It is separate from both original external reports and does not change their verdicts. No application changes were made.

The [fresh Claude review](judge-report.md) calls the feature conditionally playable with partial intent fit; the [user-supplied review](additional-external-review.md) accepts it with reservations. Both identify fixture-dependent semantic associations and insufficient independent evidence for all-card reading behavior. Neither establishes production readiness. The second review's numeric score does not resolve their disagreements about visual quality or lifecycle reliability.

## Confirmed agreement

| Concern | Evidence at the reviewed revision | Implication |
| --- | --- | --- |
| Literal-to-interpretive continuity depends on recorded wording | Nine narrow return rules in `src/lib/narrativePassageAligner.js:49-59`; Ace/Queen detail synthesis at `:219-224`. Independent paraphrases retain literal/identity cues but lose interpretive returns or relationship detail IDs. | 78-card identity and authored geometry are not equivalent to generalized interpretation coverage. |
| Original and expanded rules apply different safeguards | Only expanded rules pass through the physical-clause guard at `narrativePassageAligner.js:234-252`. Both supplied negation examples produce false literal cues. | Correct the inconsistency while retaining authentic positive descriptions. |
| New-card evidence is limited | 140 expanded rules cover 70 cards; tests and the deck fixture reuse their authored example sentences. | Passing those tests establishes consistency, not recall on independent readings. |
| Vector details require the vector edition | Aligner `:178-180`, `CardTouchArt.jsx:24-25`; normal spread modeling defaults to scans, while the study supplies vectors. | Edition and asset delivery need an explicit rollout decision. This is an intentionally gated feature checkpoint, not a demonstrated production regression. |

Confirmed negation probes:

- `The Hermit. You do not hold a lantern here.` emits a literal `lantern` cue.
- `Five of Wands. There is no clash of staves.` emits a literal `staffs` cue.

## Do not apply the proposed guard change mechanically

The second review proposes applying `expandedPhysicalClause` universally. A hypothetical version was evaluated in memory, without editing application files. It incorrectly rejected `Queen of Cups. She holds an ornate, covered cup.` because the comma splits the matched noun phrase. On the authentic five-card fixture, this removed the Queen's cup literal and its subsequent detailed Ace/Queen synthesis. It also rejected `The Hermit. You see him holding a lantern.` because the guard treats personal pronouns lexically.

The repair needs clause-aware safeguards with positive and negative examples across both card groups. Removing the boolean fork alone is insufficient.

Likewise, previously establishing two details does not prove that a later relationship refers to those details. `The Ace of Wands and Queen of Cups appear together` should not automatically illuminate the sprout and cup. Any replacement must establish the passage's actual referents, correct card occurrence ownership, and stable behavior during streaming. Validated associations supplied alongside generated prose are an experiment to evaluate, not an already proven solution.

## Additional report qualifications

- **Coverage count:** 151 authored details across 78 faces is correct: 73 faces have two details and five have one. Bounded coordinates do not establish artistic accuracy for every detail.
- **Asset size:** the 78 face SVGs total 271,597,936 bytes (271.6 MB decimal). All 79 SVGs, including the back, total 276,071,643 bytes. Individual faces range from 1,108,487 to 6,658,152 bytes. The supplied report's 270.2 MB and 2–5.8 MB range are not exact figures for this revision.
- **Delivery scope:** the study renders the spread's cards, not all 78 faces at once. The directory total is not a measured per-reading transfer. Optimization is a release concern, but neither review measured a transfer/decode/render budget or proved that rasterization is the only acceptable solution.
- **Edition fallback:** zero vector-detail associations on scans does not mean zero identity associations or legacy scan touchpoints. The production study flag is also disabled by default. These are separate conditions.
- **Language:** automatic detail and return patterns are English-only. Fully translated names and imagery generally lack matching rules, but recognizable card names can retain identity associations, and validated authored sidecars are not restricted to English. The claim that all accompaniment always disappears is too broad.
- **WebKit:** the cited test does use immediate height reads after an awaited visibility assertion (`e2e/reading-gestures.spec.js:140-150`). The attachment contains no failure trace, and this follow-up did not reproduce the reported intermittent zero height. Treat it as a targeted reproduction task before assigning a product cause.
- **Short screens:** the 72px stage below 600px viewport height is confirmed in CSS. The named Emperor scepter and Justice scales use 1.6× and 1.5× crops, respectively, not 2.3×. This follow-up did not visually reproduce their claimed loss of context. Layout clipping and iconographic legibility need separate evidence.
- **Accessibility and contrast:** “flawless” is broader than the available evidence. The first judge observed zero running animations under reduced motion but found static emphasis weak; the second report praises the veil. These are differing visual judgments, not a settled accessibility result. Neither report establishes screen-reader or physical-device performance.
- **Test total:** the supplied report's 3,058-test statement has no attached execution log. It is not a fresh verification result of this review. The independently executed judge tests total 49; see the original receipt and corrected provenance.

## Issue retained from the first review

The first judge observed Star water remaining active after completion, including a capture past 20 seconds. The additional report's praise for clean animation lifecycles does not negate that runtime observation. Its proposed timer-rounding cause remains unconfirmed. Investigate and reproduce the settling failure before changing lifecycle code.

## Recommended sequence, not implemented

1. Reproduce and repair the failure to settle, with a regression for burst completion.
2. Unify semantic safeguards without rejecting legitimate depicted descriptions; cover both supplied false positives and the Queen/Hermit positive examples.
3. Evaluate generated, validated passage associations against independent readings before claiming deck-wide interpretive continuity.
4. Verify short-screen detail legibility and the reported WebKit timing failure with targeted captures and traces.
5. Measure spread-level delivery and decoding, then choose an asset strategy and explicit production edition rollout.

The requested outside assessment is complete. These recommendations have not been applied or treated as implementation approval.
