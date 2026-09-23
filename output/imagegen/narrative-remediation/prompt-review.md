# Independent review of the narrative mockup prompts

Reviewed September 23, 2026.

**Verdict:** the original set had a sound visual direction and a useful status-contrast remedy, but was not reliable enough to reuse as a complete remediation specification. Six material prompt weaknesses were found and corrected in [prompts.md](prompts.md). The original exact text is preserved in [prompts.generated-v1.md](prompts.generated-v1.md).

## Findings

| Finding | Evidence in the original prompts | Why it matters | Correction |
| --- | --- | --- | --- |
| Empty input paired with an active-looking Send action | v1 lines 62–65 and 78–79 specify empty input/0/500 plus a brass Send button. FollowUpChat.jsx:713 explicitly disables Send for an empty trimmed value. | The mockups imply an action the current app cannot take and risk teaching the wrong interaction state. | Both chat prompts now explicitly show a disabled 48px Send control; all account, usage, input, loading, journal, and focus states are declared. |
| Reference roles and execution order are incomplete | v1 starts with revision instructions at lines 3 and 11; generation instructions begin at line 20. References have descriptions but no file map. | The file is a generation log, not a replayable brief. Running it in order starts with edits lacking a bound target. | Separate exact v1 history from canonical v2 prompts; include per-call ordered reference paths, shared-versus-per-image instructions, and future v2 filenames. Copy six original references into the package. |
| Content and existing controls are omitted or underspecified | v1 lines 30–33 omit the introductory explanation, Story, and Synthesis; line 42 asks for a shallow notes field without the existing collapse affordance, placeholder, or 750-character counter. | The resulting images can look complete while implying removal of content or working controls. The README's condensed-content caveat was not carried into the standalone prompt. | Restore the full synthetic reading and the expanded feedback control set. Preserve action order. Explicitly describe selected ratings as a user interaction state, not a default. |
| Layout constraints lack an overflow priority | v1 requires three 48px buttons with two 8px gaps in a 160px region, exactly filling it, yet asks a scrollbar to imply more content without specifying any. Main-page content is dense, while mobile gains additional context blocks. | The model can satisfy decoration by shrinking controls, inventing hidden content, or spending vertical space on unneeded context. | Give desktop header/body/footer a consistent 100 + 156 + 196 = 452px budget. Provide 200px of actual middle content. Keep mobile context to existing header and questions. Let full-page height grow rather than shrinking content. |
| The prompt file does not map all nine issues to suitable evidence | v1 mentions that images are not implementation proof but includes no complete issue coverage or required behavior. Closed focus targets, radio arrows, heading semantics, and the dead skip link are not demonstrable from these three frames. | A visually improved image could be mistaken for a complete fix or sufficient evidence for the target score. | Add a nine-row visual-versus-implementation contract and an explicit post-implementation 18/20 acceptance goal. No score can be awarded from the images. |
| Fidelity and copy invariants are too loose in the base prompts | v1's corrective edits remove invented source helper text and background navigation only after generation. Focus color and operational title styling are not fully locked. | Rerunning the base prompts can recreate the same drift. Preserving a generated foreground blindly can also preserve defects. | Merge known corrections into the base brief; specify exact source text with no added helpers, theme-specific focus rings, correct desktop labels, and sans-serif operational chat titles. Use targeted edits only after reviewing a new output. |

The 18/20-or-higher goal is valid as an implementation acceptance target. The previous 19/20 allocation is aspirational; no fresh accessibility, responsive, performance, or integrity score was established by these images.

## What remains sound

- Existing screenshots are appropriate reference material for refinement.
- Tableu's product name, reflective framing, palette, and two-font identity are grounded in PRODUCT.md and DESIGN.md.
- Dark sage on pale sage is an appropriate proposed remedy for the light success badges; its specified opaque colors calculate to 5.78:1.
- Separate mobile and short-desktop dialog states target the most consequential visible failures.
- Single-defect revision prompts with clear invariants are an appropriate editing technique when attached to the correct actual output.

## Review evidence and limits

Read the entire original prompt file and companion guide; compared the instructions with PRODUCT.md, DESIGN.md, the imagegen prompting guide, FollowUpChat.jsx, FollowUpDrawer.jsx, FollowUpModal.jsx, FeedbackPanel.jsx, NarrativePanelHeader.jsx, ReadingInputUsageSection.jsx, and the current skip-link code in TarotReading.jsx. Verified all six referenced audit images exist.

This pass changes the prompt package and provenance documentation only. No images were regenerated, application code changed, or runtime tests rerun. The existing PNGs still illustrate v1 and retain its known discrepancies until regenerated. The historical v1 prompt archive is a byte-for-byte copy.

