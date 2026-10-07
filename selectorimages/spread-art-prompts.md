# Spread selection artwork

Refreshed October 6, 2026 using the built-in image generation tool. The art follows Tableu's Midnight Reading Room identity: engraved ivory cards, subdued brass, and dark reading cloth. These images illustrate the spread structure; they are not card faces for any supported deck.

## Production files

Each asset base has a 1280 × 720 PNG fallback plus 640 × 360 and 1280 × 720 AVIF/WebP sources. `src/utils/spreadArt.js` resolves the files through Vite so all formats are available on first render and their URLs change with their content. The six legacy public previews under `public/images/spread-art/` are synchronized at 640 × 360.

| Spread | Asset base | Structure |
| --- | --- | --- |
| One-Card Insight | `onecard` | One centered card |
| Three-Card Story | `3card` | Three cards in a row |
| Five-Card Clarity | `5card` | Five-card cross |
| Decision / Two-Path | `decision` | Heart, two paths, clarity, agency: five cards |
| Relationship Snapshot | `relationshipsnapshot` | Three core cards; two small dots suggest optional clarifiers |
| Celtic Cross | `celticcross` | Crossing pair, four cardinal cards, four-card staff: ten cards |

## Export settings

Generated landscape originals were resampled to 1280 × 720 using Sharp (Lanczos3, centered cover; source aspect is approximately 16:9). PNG: lossless, compression level 9. AVIF: quality 52, effort 6, 4:4:4 chroma. WebP: quality 78, effort 5. Smaller sources use 640 × 360. Do not crop the cross or staff out of the art; all physical cards must remain visible in the selector and onboarding preview.

## Generation prompts

Generate the one-card image first. Use that output as the single style reference for each remaining image. No prior production image is an edit target. Prompts below are the exact generation prompts; the built-in tool selected its own rendering parameters.

### onecard

```text
Use case: stylized-concept.
Asset type: one of six coordinated thumbnail illustrations for the spread-selection UI of Tableu, a contemplative tarot reflection app, visual identity "The Midnight Reading Room".
Primary request: create the ONE-CARD INSIGHT illustration. A single beautiful portrait tarot card resting flat in the exact center of a near-black plum charcoal reading cloth, viewed straight down. The card is warm ivory uncoated paper with a narrow antique brass frame and an exquisite restrained copperplate engraving of a rising sun above a low horizon, fine rays, two tiny botanical sprigs. Exactly ONE card, completely visible, with a clear silhouette. The card occupies about 58% of image height.
Style/medium: refined literary editorial still life, physical paper and delicate antique etching, tactile but clean, sophisticated book-cover art. Elegant ink linework, slight paper grain. Soft warm light falling from the upper left, subtle realistic cast shadow to the lower right. Intimate, quiet, scholarly.
Composition: WIDE LANDSCAPE 16:9 canvas. All meaningful content in central 80% width and 80% height. Ample breathing room on all sides. Dark background fills the canvas edge to edge. One whisper-thin incomplete brass circular arc in the cloth around the card is acceptable; no other objects.
Palette: midnight #0F0E13, subdued plum charcoal #1C1A22, candlelit brass #D4B896, warm paper #E8DAC3, muted sage or blue-grey only as tiny ink accents.
Constraints: no text, no letters, no numerals, no title, no watermark, no caption, no hands, no people, no deck stack, no crystals, no crystal balls, no glitter, no neon, no fog, no galaxies, no bright glowing outlines, no UI frame. Artwork must remain recognizable at 300 pixels wide. High visual quality. Output one image, not a collage.
```

### 3card

```text
Use case: stylized-concept. Asset type: a wide 16:9 spread-selection illustration for Tableu's "Midnight Reading Room".
Reference image 1 is STYLE ONLY: match its straight-down view, tactile warm ivory cards, fine antique copperplate engraving, thin double brass card borders, near-black plum-charcoal reading cloth, warm upper-left side light and soft lower-right shadows. Generate a NEW arrangement, replacing the reference single card. Keep the physical-paper literary editorial finish, quiet refined atmosphere, muted brass #D4B896 and paper #E8DAC3, not glossy or luminous. Dark background edge to edge.
All cards must be fully visible and well separated unless explicit overlap is requested. Keep all meaningful content inside central 84% width and 82% height for responsive crop safety. Artwork must read at 300px width. No labels, no text, no letters, no numerals, no watermark, no captions, no UI, no hands, no deck stack, no crystals, no people. No glowing outlines, galaxies, fog, glitter or neon. One faint incomplete brass arc on the cloth is enough decoration. Output ONE wide landscape image, not a collage.
Composition: EXACTLY THREE identical-size portrait cards in a balanced horizontal row centered at the same vertical height, evenly spaced. Each card about 58% of canvas height. Left card engraving: an hourglass with a tiny dried leaf. Middle card: a mature branching tree rooted in earth with a soft muted sage wash. Right card: a winding path toward a distant sunrise. Clear distinct graphic silhouettes representing past, present and possibility. There must be exactly three cards and no additional card-shaped objects.
```

### 5card

```text
Use case: stylized-concept. Asset type: a wide 16:9 spread-selection illustration for Tableu's "Midnight Reading Room".
Reference image 1 is STYLE ONLY: match its straight-down view, tactile warm ivory cards, fine antique copperplate engraving, thin double brass card borders, near-black plum-charcoal reading cloth, warm upper-left side light and soft lower-right shadows. Generate a NEW arrangement, replacing the reference single card. Keep the physical-paper literary editorial finish, quiet refined atmosphere, muted brass #D4B896 and paper #E8DAC3, not glossy or luminous. Dark background edge to edge.
All cards must be fully visible and well separated unless explicit overlap is requested. Keep all meaningful content inside central 84% width and 82% height for responsive crop safety. Artwork must read at 300px width. No labels, no text, no letters, no numerals, no watermark, no captions, no UI, no hands, no deck stack, no crystals, no people. No glowing outlines, galaxies, fog, glitter or neon. One faint incomplete brass arc on the cloth is enough decoration. Output ONE wide landscape image, not a collage.
Composition: EXACTLY FIVE portrait cards forming a compact symmetrical cross, centered on the canvas. One at center (engraved compass rose without letters), one directly above (crescent moon), one directly below (seedling with roots), one directly left (a mountain ridge), one directly right (an olive branch). Each card the same size, about 22% canvas height, each separated from all other cards by a small visible dark gap. The complete cross occupies roughly 76% canvas height. Keep card engravings simple and bold enough at thumbnail size. Exactly five cards, no overlap, no sixth card.
```

### decision

```text
Use case: stylized-concept. Asset type: a wide 16:9 spread-selection illustration for Tableu's "Midnight Reading Room".
Reference image 1 is STYLE ONLY: match its straight-down view, tactile warm ivory cards, fine antique copperplate engraving, thin double brass card borders, near-black plum-charcoal reading cloth, warm upper-left side light and soft lower-right shadows. Generate a NEW arrangement, replacing the reference single card. Keep the physical-paper literary editorial finish, quiet refined atmosphere, muted brass #D4B896 and paper #E8DAC3, not glossy or luminous. Dark background edge to edge.
All cards must be fully visible and well separated unless explicit overlap is requested. Keep all meaningful content inside central 84% width and 82% height for responsive crop safety. Artwork must read at 300px width. No labels, no text, no letters, no numerals, no watermark, no captions, no UI, no hands, no deck stack, no crystals, no people. No glowing outlines, galaxies, fog, glitter or neon. One faint incomplete brass arc on the cloth is enough decoration. Output ONE wide landscape image, not a collage.
Composition: EXACTLY FIVE portrait cards. At upper center, one card with an engraved seed held within a circle (the heart of a decision). Across the middle row: one left card with an engraved path bending past a hill and one right card with an engraved path beside a river, equally inviting and equal in brightness. Across the bottom row: two smaller-position but identical-size cards side by side beneath the upper center, left bearing an engraved lantern and right an engraved open bird in flight. All five cards same physical dimensions, each about 22% canvas height. Thin restrained brass branching lines on cloth may join upper center to left/right options. Symmetrical balanced two-path composition, cards never overlap, each card completely visible. Neither path implies good/bad or fixed fate. Exactly five cards; no question marks or extra cards.
```

### relationshipsnapshot

```text
Use case: stylized-concept. Asset type: wide 16:9 spread-selection illustration for Tableu's "Midnight Reading Room".
Reference image 1 is STYLE ONLY. Match its straight-down view, physical warm ivory paper cards, fine antique copperplate engraving, narrow double-line brass borders, charcoal-plum near-black reading cloth, warm upper-left side light with soft lower-right shadows. Generate a NEW composition. Sophisticated literary editorial still life, restrained ink linework. Dark background fills the canvas. All cards fully within frame. Keep at least 9% empty canvas above and below the complete arrangement and at least 12% on either side. Clean silhouettes readable in a 300px-wide thumbnail.
No text, letters, numerals, labels, watermark, UI, hands, people, crystals, deck stack, neon, glowing outlines, fog, galaxies or glitter. Card motifs should be simple natural engravings. Muted brass #D4B896, warm paper #E8DAC3, midnight #0F0E13. Output one wide landscape image, not a collage.
RELATIONSHIP SNAPSHOT: Exactly THREE large portrait cards arranged in a triangle. Left card centered at x30%, y57%, engraving of a flowering olive branch curving inward. Right card centered at x70%, y57%, engraving of a flowering willow branch curving inward. Top-center card at x50%, y33%, engraving of two botanical stems gently intertwined into an open wreath, expressing the shared connection without gendered characters. Each card approximately 17% canvas width and 43% canvas height. Cards must not overlap. Below the center connection, place TWO tiny hollow brass dots on the cloth, suggesting optional clarifiers without adding more cards. A delicate brass arc visually joins the three cards. Three core cards, no fourth or fifth card. Inclusive and reflective.
```

### celticcross

```text
Use case: stylized-concept. Asset type: wide 16:9 spread-selection illustration for Tableu's "Midnight Reading Room".
Reference image 1 is STYLE ONLY. Match its straight-down view, physical warm ivory paper cards, fine antique copperplate engraving, narrow double-line brass borders, charcoal-plum near-black reading cloth, warm upper-left side light with soft lower-right shadows. Generate a NEW composition. Sophisticated literary editorial still life, restrained ink linework. Dark background fills the canvas. All cards fully within frame. Keep at least 9% empty canvas above and below the complete arrangement and at least 12% on either side. Clean silhouettes readable in a 300px-wide thumbnail.
No text, letters, numerals, labels, watermark, UI, hands, people, crystals, deck stack, neon, glowing outlines, fog, galaxies or glitter. Card motifs should be simple natural engravings. Muted brass #D4B896, warm paper #E8DAC3, midnight #0F0E13. Output one wide landscape image, not a collage.
CELTIC CROSS: Exactly TEN physical tarot cards forming the recognizable Celtic Cross diagram. Use a true flat straight-down arrangement, not perspective. All nine portrait cards have identical physical dimensions: approx 7% canvas width and 19% canvas height. The tenth is identical but rotated 90 degrees.
LEFT/MIDDLE cross cluster of SIX cards: (1) a vertical card centered x42%, y50%, engraved tree; (2) ONE horizontal card laid across its middle, centered x42%, y50%, engraved moon, visibly overlapping (1), with top and bottom of underlying vertical card still clearly visible; (3) vertical card centered x28%, y50%, engraved hourglass; (4) vertical card centered x56%, y50%, engraved rising sun; (5) vertical card centered x42%, y27%, engraved bird; (6) vertical card centered x42%, y73%, engraved roots.
RIGHT staff of FOUR cards, all portrait, a distinct vertical column at x73%: centers y17%, y39%, y61%, y83%. Motifs from top to bottom: star, mountain, sprig, flowing water. They must have visible gaps and never overlap each other or the cross cluster. Leave a clear dark gap between the right arm of cross and the staff.
Count check: crossing pair 2 + top/bottom/left/right 4 + right-hand column 4 = EXACTLY TEN CARDS. No extra cards or ambiguous card-shaped decorations. Cross and staff occupy the center of the canvas with generous dark left and right margins. A faint incomplete brass arc can sit behind just the cross cluster.
```
