# Tableu branding

Direction: preserve the original Tableu logo, with minimal cleanup and sharper exports. Updated October 8, 2026.

## Canonical logo

`shared/brand/tableuMark.js` owns the cleaned, traced vector geometry: the original circular seal, card frame, crescent, stars, eye and smiling creature with six stylized arms. The 240 × 240 emblem preserves its proportions. The original TABLEU lettering was traced directly from `public/images/tableu-logo-new.png`; it uses paths rather than a substituted font. The complete lockup is 762 × 240.

`src/components/TableuLogo.jsx` renders these paths directly, using the semantic brand color in both themes. Decorative instances are hidden from assistive technology; the header is labeled Tableu. Header, welcome, ritual, draw pile, unrevealed cards and shared-reading images use the same emblem.

- `tableu-mark.svg`: currentColor emblem.
- `tableu-mark-brass.svg`: warm brass for dark backgrounds.
- `tableu-mark-ink.svg`: aged brass for light backgrounds.
- `tableu-favicon.svg` and `favicon-32.png`: browser icons.
- `tableu-reading-room.jpg` and `.webp`: 1200 × 630 social cover featuring the original circular seal. The journal is a material reference, not a physical product offering.

Legacy originals remain available as source references. Versioned plugin submission packages remain separate release artifacts.

## Export recipe

The cleaned original emblem was generated with Codex's built-in image tool, then traced from its alpha contour using Potrace (threshold 128, turdSize 8, alphaMax 1, optCurve true, optTolerance 0.15). The trace removes translucent background noise and produces a single compound currentColor path. It is normalized uniformly into the 240px square, preserving the original round proportions. The wordmark is a direct trace of the original horizontal asset's alpha, excluding the emblem.

App exports use midnight #0F0E13 and brass #D4B896. Regular 512px icons use a 376px emblem; maskable icons use 400px, with the circular design entirely inside the central 80% safe circle. Apple icons also use 400px before scaling to 152/167/180px. The 1290 × 2796 launch image centers the emblem.

Raster exports use Sharp 0.35.2, Lanczos3 resizing, PNG for icons, JPEG quality 86 with mozjpeg and WebP quality 80/effort 5 for the cover. Icon, Apple and social URLs carry `v=brand-20261008-original`; the service-worker shell cache is v6. Manifest identity and start URL are unchanged.

## Original-emblem cleanup prompt

Built-in image tool; reference: `public/images/tableu-logo-new.png`.

```text
Use case: precise-object-edit.
Asset type: faithful cleanup of Tableu's ORIGINAL logo, transparent master emblem.
The attached image is the ORIGINAL Tableu logo and is authoritative. Preserve its design exactly. Extract and clean up ONLY the round emblem on the left; omit the TABLEU lettering outside the circle. Reproduce the same circular seal, inset tarot-card border, small upper-left crescent, original star/curving line at upper-right, eye at right edge, lower-left sparkle and curved baseline. Most importantly preserve the ORIGINAL friendly little octopus: the same round head, smiling face, original number of visible tentacles, short curling tentacles and exact proportions/pose. Do NOT elongate the head, add arms, replace the face, change the creature, or redesign anything. This is restoration and edge cleanup only.
Render the exact emblem as precise flat solid warm brass #D4B896 shapes with smooth clean curves and consistent original line weights on a truly transparent background. No white background, texture, shading, gradients, shadows, glow, 3D or new details. Keep the entire circle visible with a small even transparent margin. Square high resolution standalone logo. The purpose is a faithful clean master of the existing identity for small UI use, not a new concept.
```

## Cover edit prompt

Built-in image tool; references: previous journal cover and `public/images/tableu-logo-new.png`.

```text
Use case: precise-object-edit.
Asset type: Tableu social cover.
Image1 is the existing journal cover photograph. Image2 is the authoritative ORIGINAL Tableu logo. Change ONLY the emblem stamped on the journal in image1. Replace it with the exact circular seal at the LEFT of image2 (without its adjacent TABLEU text): original round ring, original inset card outline, crescent, small star and curved stem, eye, lower sparkle, curved baseline, and original friendly smiling octopus with exactly its original proportions and original six visible curling tentacles. This is restoration of the original identity. Do not elongate, widen, add arms, remove the smile, or redesign the creature. The complete circular seal must sit naturally in perspective on the journal, sharply stamped in matte warm brass, with clean edges and believable linen showing through the unprinted areas.
Preserve ALL other pixels/composition as closely as possible: journal angle/size, cloth, lighting, cards, flowers and the exact typography 'TABLEU' and 'Authentic tarot, thoughtfully interpreted.' Keep the same roughly1.9:1 landscape ratio, no newtext, no watermark. Use only the original logo from reference2, never the redesigned character visible in reference1.
```
