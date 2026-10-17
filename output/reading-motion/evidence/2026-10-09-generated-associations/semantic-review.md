# Qualitative review of generated passage associations

The retained readings show credible prose → physical detail → interpretation continuity beyond the earlier fixture wording. I found one clear boundary worth improving in a Spanish literal cue, plus smaller wording and selection-span limitations. I found no obvious wrong-card target or clearly forced personal-context link in this pass. This is a same-team qualitative inspection, not an external judge, human user study, or production approval.

## Material and method

Reviewed the raw prose, every supplied annotation, question/reflection and spread in all 15 samples of [generated-gesture-readings.json](../../fixtures/generated-gesture-readings.json): 13 English and two Spanish readings, 247 annotations, 46 distinct faces and 87 distinct card/detail combinations. Compared target IDs and their meanings with the artwork registry. These are counts of inspected material, not accuracy scores.

Snapshot SHA-256: `dd0651d5e9f2f17c05cacf92703ae166e577c41464894ba7e711b69da107dcc3`.

The reviewer previously worked on presentation repairs but did not author these readings. The first exploratory JSON print accidentally included `new-home-rhythm`'s validation metadata. Subsequent inspection explicitly omitted all validation/acceptance fields. Therefore this pass was not fully blinded, and compiler acceptance was not treated as evidence of semantic correctness. No browser checks or exhaustive artwork-pixel inspection were performed for this review.

## Findings and opportunities

1. **Literal/interpretive boundary: `ritmo-compartido`, `lit-lantern`.** The quoted passage, “Su farol alumbra los próximos pasos,” identifies the Hermit's lantern but already describes “next steps,” a future-facing interpretation. The card does not depict a literal sequence of the reader's forthcoming steps. The lantern target is appropriate; classifying the whole phrase as purely physical overstates what the artwork establishes. A stronger annotation would establish the visible `farol` first and treat the broader phrase as interpretation. Keep the generated sample intact as an observed limitation rather than silently correcting the evidence.

2. **Small physical-language ambiguity: `creative-boundaries`, `rel-cup-carried`.** The prose first correctly describes an “ornate lidded cup,” then says the Queen gazes “into her cup.” Looking *at* the covered cup would be more precise. The relationship still points to the correct cup and carried swords; this is a wording issue rather than wrong-card ownership.

3. **Several interpretation selections omit the words that carry the meaning.** `first-small-step` / `i-two-sea` selects only “as the distant sea hints,” while the invitation to consider what the class opens toward sits immediately before it. `slow-recognition` / `int-hoe-step` selects only “like that resting hoe,” leaving the regular pause and noticing growth outside the emphasized span. The surrounding prose supports both targets, so these are not false associations. Selecting a little more of the interpretive clause would make the text emphasis itself carry more meaning.

4. **Narrative hierarchy needs an editorial check in longer spreads.** `changing-routine` introduces The World for the first time inside “Putting It Together,” after describing the other four cards under “The Story.” The World cues (`world-identity`, `world-wreath-literal`, `world-wands-literal`) have correct ownership. Still, the initial description enters the synthesis section; contract validity does not establish coherent section structure.

## Sample-level observations

| Sample | Qualitative observation |
| --- | --- |
| `new-home-rhythm` | Pool/land returns and `rel-lantern-collab` have clear antecedents; the reflection link supports coexistence without claiming a psychological fact. |
| `creative-boundaries` | Sprout/castle, cup/privacy and carried/left swords stay distinct; covered-cup wording caveat above. |
| `first-small-step` | Literal tools become repeated practice; globe and water remain the Two of Wands. Some return spans could include more meaning. |
| `fair-leadership` | `scales-relationship` correctly separates Justice's scales from Six of Pentacles' scales. |
| `gentle-departure` | Cups left standing, departing traveler and passengers retain their owners; “loosened coin” is presented as interpretation of a reversal. |
| `community-project` | `rel-magician-temperance` explicitly links the raised wand and stream; the meeting reflection is framed tentatively. |
| `uncertain-choice` | `rel-blindfold-pentacle` carries an explicit visual contrast; scroll returns remain grounded. |
| `rest-and-courage` | Staff barrier and wall swords are distinct; `bal-hands-swords` has both earlier details established. |
| `friendship-repair` | The two lions retain different card owners in `rel-two-lions`; the hurt/listening link reflects the supplied wording. |
| `shared-resources` | `rel-sword-bundle` has explicit visual referents; `rel-king-cups` correctly stays whole-card because its clause is thematic. |
| `changing-routine` | Wreath/wands balance is explicit and `death-world-relationship` stays whole-card; section-placement caveat above. |
| `speaking-clearly` | Knight/Queen sword contrast follows actual prose; the rush association quotes the reflection directly. |
| `slow-recognition` | `rel-accumulation` accurately pairs the vine and cup row. Short selected spans could make the practical meaning clearer. |
| `ritmo-compartido` | Spanish names, personal links and Temperance balance retain their intended owners. Lantern cue crosses the literal/interpretive boundary. |
| `voz-creativa` | Wheat/shield, staff/feather and trumpet/raised-arms cues remain distinct. `rel-harvest-call` and question-only links work without a reflection. |

## Limits

The readings were generated with a supplied detail catalog, so this pass evaluates a constrained generation experiment, not recovery from arbitrary existing narratives. The material does not cover all 78 faces, every supported spread, other deck editions, long multilingual readings, or adversarial text. Two Spanish samples cannot establish general multilingual quality. Cue timing, cognitive load, exact geometry and motion comfort require rendered/user evidence; none is inferred from annotation counts or schema validity here. No generated readings, annotations or production code were edited by this review.
