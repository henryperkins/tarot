# Deck selection artwork

Refreshed October 6, 2026 using the built-in image generation tool. The three previews share a shallow card fan, warm side lighting and the dark reading cloth used by the spread illustrations. Each tradition retains its distinct colours and visual language.

## Scope and sources

These are generated selector illustrations, not new reading-card assets or vision evaluation fixtures. The Rider-Waite-Smith and Marseille previews use the repository's Magician / High Priestess / Moon cards as visual references (Le Bateleur / La Papesse / La Lune for Marseille). The Thoth preview is an original, abstract interpretation of the palette and geometric style in `shared/vision/deckCatalog.js`; it does not reproduce named historical Harris card faces. The existing Thoth fixtures include placeholders, as documented in `docs/vision-pipeline.md`.

The actual card assets, deck identities, titles, reading behaviour and subscription behaviour are outside this refresh.

## Production files

| Deck | Asset base | Image description |
| --- | --- | --- |
| Rider-Waite-Smith | `rider` | The Magician in front of The High Priestess and The Moon |
| Thoth | `Thoth` | Three interpretive prismatic cards in teal, magenta and saffron |
| Tarot de Marseille | `marseille` | Le Bateleur in front of La Papesse and La Lune |

Each base has a 982 × 799 JPEG fallback, plus 480 × 391 and 960 × 781 AVIF/WebP sources. The consuming component reserves the existing 982:799 frame. Vite hashes each asset and the eager source mapping makes responsive formats available before the fallback image is attached, preserving WebKit's single-download behavior.

## Export settings

Generated originals were resized with Sharp (Lanczos3, centered cover; source aspect is approximately 982:799). JPEG: quality 88, mozjpeg enabled. AVIF: quality 48, effort 6, 4:4:4 chroma. WebP: quality 74, effort 5. Responsive sizes derive directly from the generated originals rather than re-encoding the JPEG.

## Generation prompts

The one-card spread illustration supplies material/lighting reference for RWS and Marseille. The generated RWS composition supplies that reference for Thoth. The following are the exact prompts, followed by their card reference paths where applicable.

### rider

```text
Use case: product-mockup. Asset type: refreshed deck-selection thumbnail for Tableu, a private reflective tarot app.
Create one polished tactile tabletop photograph-like illustration, landscape aspect ratio 982:799 (approximately 5:4). Exactly THREE tarot cards arranged in an elegant shallow fan on dark plum-charcoal linen. Overhead view with only slight dimensionality. The center card is fully visible, upright, in front; left card tilts 10 degrees counterclockwise behind it, right card tilts 10 degrees clockwise behind it. Each side card remains at least 75% visible. Keep all outer paper corners inside the image, at least 7% padding all around; the total fan occupies about 82% width and 77% height. Cards have believable paper thickness and natural shadows.
Reference image 1 is MATERIAL/LIGHT/BACKGROUND STYLE ONLY: its quiet midnight reading cloth, warm soft upper-left light, paper tactility. Do not copy its sun illustration, monochrome palette or brass circle. References 2,3,4 are exact CARD ARTWORK REFERENCES, used as real printed card faces. Preserve their original linework, colours, recognizable motifs, correct numerals and names. Do not tint their coloured artwork sepia. Do not blend different card identities. This should look like actual cards photographed on the reading cloth, with restrained warm light and rich legible colours.
No extra cards, no deck stacks, no props, no hands, no UI, no captions, no decorative glyphs in the background, no neon, no glow, no watermark. Output one image.
RIDER-WAITE-SMITH: Reference 2 (The Magician) is the CENTER card, preserve red robe, raised wand, infinity sign, yellow field and table with suit tools. Top numeral I and bottom title exactly "THE MAGICIAN." Reference 3 (The High Priestess) is LEFT, preserve seated blue-robed figure, black/white pillars and pomegranate veil, numeral II. Reference 4 (The Moon) is RIGHT, preserve moon, towers, dog/wolf, crayfish, numeral XVIII. Visible titles use reference spelling. Warm aged cream borders, fine historic printed texture.
```

References:

- `public/images/cards/RWS1909_-_01_Magician.jpeg`
- `public/images/cards/RWS1909_-_02_High_Priestess.jpeg`
- `public/images/cards/RWS1909_-_18_Moon.jpeg`

### marseille

```text
Use case: product-mockup. Asset type: refreshed deck-selection thumbnail for Tableu, a private reflective tarot app.
Create one polished tactile tabletop photograph-like illustration, landscape aspect ratio 982:799 (approximately 5:4). Exactly THREE tarot cards arranged in an elegant shallow fan on dark plum-charcoal linen. Overhead view with only slight dimensionality. The center card is fully visible, upright, in front; left card tilts 10 degrees counterclockwise behind it, right card tilts 10 degrees clockwise behind it. Each side card remains at least 75% visible. Keep all outer paper corners inside the image, at least 7% padding all around; the total fan occupies about 82% width and 77% height. Cards have believable paper thickness and natural shadows.
Reference image 1 is MATERIAL/LIGHT/BACKGROUND STYLE ONLY: its quiet midnight reading cloth, warm soft upper-left light, paper tactility. Do not copy its sun illustration, monochrome palette or brass circle. References 2,3,4 are exact CARD ARTWORK REFERENCES, used as real printed card faces. Preserve their original linework, colours, recognizable motifs, correct numerals and names. Do not tint their coloured artwork sepia. Do not blend different card identities. This should look like actual cards photographed on the reading cloth, with restrained warm light and rich legible colours.
No extra cards, no deck stacks, no props, no hands, no UI, no captions, no decorative glyphs in the background, no neon, no glow, no watermark. Output one image.
TAROT DE MARSEILLE: Reference 2 (Le Bateleur) is CENTER, preserve juggler with broad curved hat, red-blue clothing, yellow table and cups, numeral I and title exactly "LE BATELEUR". Reference 3 (La Papesse) is LEFT, preserve seated crowned figure and open book, blue and red cloth, numeral II. Reference 4 (La Lune) is RIGHT, preserve blue moon face, two dogs, towers and crayfish, numeral XVIII. Preserve bold block-printed outlines and strong red, cobalt and yellow fields. Bone-ivory paper borders. Do not invent any extra labels or text.
```

References:

- `public/images/cards/marseille/major01.jpg`
- `public/images/cards/marseille/major02.jpg`
- `public/images/cards/marseille/major18.jpg`

### Thoth

```text
Use case: stylized-concept. Asset type: refreshed Thoth-inspired deck-selection thumbnail for Tableu, a reflective tarot app.
Reference image 1 is COMPOSITION AND MATERIAL STYLE ONLY. Match its landscape aspect ratio 982:799 (roughly 5:4), exactly three physical tarot cards in a shallow fan, center card upright and foreground, side cards tilted gently outward behind, all corners within the canvas with at least 7% padding. Match its near-black charcoal-plum linen, tactile paper, warm soft upper-left light, and realistic restrained shadows. Preserve balanced card scale and arrangement. Do not copy the specific Rider-Waite card faces.
Create THREE ORIGINAL INTERPRETIVE card faces inspired by the abstract geometric visual vocabulary of the Thoth tradition; do not pretend to reproduce named historical card faces. Centre card: elegant interlocking golden ribbons and a vertical winged wand, symmetrically balanced against deep teal and indigo planes, an evocation of creative motion. Left card: a large silver crescent above flowing teal waveforms, layered geometric arcs and a tiny magenta star. Right card: two prismatic streams, warm saffron-gold and deep magenta, meeting in an abstract geometric vessel, suggesting integration. Abstract painterly Art Deco geometry, controlled airbrushed oil/watercolour washes, intricate but legible shapes. Distinct visual character from the figurative RWS/Marseille previews. Rich teal #27cfc0, magenta #c1248b, saffron #d9a441, deep indigo; vibrant ink on paper, not self-illuminated neon.
Each card has a narrow clean warm-ivory border with a thin subtle geometric inner frame. Border is plain and completely WITHOUT title bands or numbering. NO TEXT, NO LETTERS, NO NUMERALS, NO WORDS, no fabricated labels, no artist signature, no watermark. Do not add standalone occult emblems on the cloth. No hands, no human figures, no extra cards, no deck stack, no crystals, no props, no UI, no glitter, no fog, no glowing outlines. Complete physical card silhouettes must remain distinguishable at 250 pixels wide. One image, not a collage.
```

References:

- `Generated Rider-Waite-Smith preview (composition and materials only)`
