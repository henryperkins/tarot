# Narrative remediation — generated v2

Generated September 23, 2026 with the built-in image generation tool, using the reviewed [prompts.md](prompts.md). Each call used the shared visual brief, one numbered prompt, and that prompt's original audit references in the specified order.

## Final images

| View | Saved image | Actual PNG dimensions |
| --- | --- | --- |
| Light reading and feedback | [01-light-reading-v2.png](01-light-reading-v2.png) | 884 × 1779 |
| Dark mobile follow-up | [02-mobile-follow-up-v2.png](02-mobile-follow-up-v2.png) | 853 × 1844 |
| Short desktop follow-up | [03-short-desktop-chat-v2.png](03-short-desktop-chat-v2.png) | 2129 × 739 |

The earlier unversioned PNGs and v1 prompt archive are preserved.

## Visual review

One initial generation and one targeted correction were performed per image:

- **01:** All five narrative sections, the full safety note, existing supporting actions, three stacked feedback groups, collapse chevron, notes field and counter are visible. A targeted edit made the source-status foregrounds consistently dark.
- **02:** The drawer appears above the dimmed page, question text wraps, the first question has a visible focus treatment, Send appears disabled for the empty input, and the full composer/journal option is visible. A targeted edit moved the drawer higher and increased its mobile text/control scale.
- **03:** The question region visibly overflows behind its own boundary; the composer, helper and checked journal option remain inside the dialog. Send appears disabled. A targeted edit enlarged the close control's visible outline.

These are generated design references. Exact dimensions, font metrics, colors, hit areas, and copy should be implemented from the specification and application source. In particular, the generated close-button proportions are approximate rather than a measurement of 48 CSS pixels. The full-page image also uses a different total page height from the approximate requested height. No semantic accessibility, runtime scrolling, focus management, contrast conformance, or 18/20 score is established by these PNGs.

## Reproduction and provenance

[The generation record](generation-v2.json) contains the exact base prompts, reference order, exact targeted edit prompts, initial and final generated paths, copied workspace paths, PNG dimensions and SHA-256 hashes. This preserves the actual instructions sent to the image model separately from the reusable prompt document.

Application source was not changed. No deployment or runtime tests were performed for this image-only task.

