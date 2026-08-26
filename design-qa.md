# Design QA — The Midnight Reading Room

Status: **Passed** — no open P0, P1, or P2 visual or interaction findings.

## Approved reference

- Desktop composition: `comp/midnight-reading-room-approved-desktop.png`
  - 1440 × 2700
  - SHA-256: `1B79564CE9BBC5DB687DC76970F3AB626A2A7AD42515276462728C76996F02CE`
- Mobile composition: `comp/midnight-reading-room-approved-mobile.png`
  - 517 × 2532
  - SHA-256: `DA56EED432ADAD0BDE56427A5FF2DAF10A673A37ED3502712A27728E954B3C84`

The approved files are storyboard compositions rather than one-screen captures. For like-for-like review, the ritual region beginning at source Y=620 was normalized to the tested viewport and stacked with the implementation capture in a single comparison image.

## Final comparison evidence

- Desktop, 1365 × 900 CSS viewport:
  - Implementation: `comp/qa/implementation-desktop-ritual-final.png`
  - Combined reference/implementation: `comp/qa/design-qa-comparison-desktop-final.png`
- Mobile, 390 × 844 CSS viewport:
  - Implementation: `comp/qa/implementation-mobile-ritual-final.png`
  - Combined reference/implementation: `comp/qa/design-qa-comparison-mobile-final.png`
- Mobile interaction states:
  - All cards dealt face-down: `comp/qa/implementation-mobile-turn-facedown-final.png`
  - Keyboard-opened card layer: `comp/qa/implementation-mobile-card-focus-final.png`

Browser density was approximately 1 device pixel per CSS pixel. Full-page evidence was captured with the document aligned to Y=0 so sticky navigation did not appear midway through the comparison.

## Visual review

- **Hierarchy:** The ritual is again the dominant moment: one brass serif headline, a centered violet deck, restrained progress, and one dominant deal action.
- **Composition:** The outer card-on-card frame was removed. Deck and spread now occupy one continuous midnight cloth, with the spread seats present below the ritual focal point.
- **Typography:** Source Serif 4 carries ritual and reading emphasis; Inter carries controls and compact status copy. The spread name is deliberately quiet so it does not compete with the ritual.
- **Color and surface:** Midnight ink, restrained blue/red atmosphere, candlelight brass, and the approved violet deck are preserved without introducing a new palette.
- **Assets:** Existing tarot art remains uncropped and unobscured. The deck emblem uses the existing Phosphor icon library and renders above the 3D stack. No card-name captions cover Rider-Waite-Smith artwork.
- **Responsive behavior:** Mobile progress uses clear icons without truncated labels. Named Past, Present, and Future positions remain visible. The fixed action bar exposes only the phase-appropriate verb.
- **Copy:** The flow consistently uses Knock, Cut, Shuffle, Deal face-down, Turn face-up, Turn all, and “Turn these cards face-down.”
- **Motion:** Deal/scene movement remains intentionally slow at roughly 400–560 ms. Reduced-motion paths settle at about 150 ms and omit non-essential bloom.

## Interaction review

- Three sequential deals place cards face-down in Past, Present, and Future.
- Turn controls appear only after every card is dealt.
- Turn next and Turn all operate on the spread without remounting the cloth.
- Keyboard Enter opens a full-viewport card-detail layer.
- The mobile action bar becomes inert and visually hidden beneath the card layer.
- Reset turns the cards face-down and leaves the user on the same cloth.
- Browser console: zero JavaScript errors. A non-blocking `SoundManager` audio-decode preload warning was observed throughout preview testing.

## Comparison history

### Pass 1

- **P0:** The mobile card layer was constrained by the scene shell; the action bar competed with it.
- **P1:** Nested framing and an oversized spread heading diluted the approved ritual focus.
- **P1:** Mobile progress labels truncated.
- **P1:** The deck rendered nearly black instead of the approved violet.
- **P2:** An empty desktop detail panel and ritual knock indicators remained visible in unrelated states.

### Corrections

- Portaled the card layer to `document.body` and connected overlay state to the mobile action bar.
- Replaced separate ritual/reveal mounts with one persistent reading-cloth scene.
- Flattened the outer frame, reduced spread-heading emphasis, and restored violet/brass deck styling.
- Switched handset progress to icons with accessible names.
- Removed the empty detail panel and phase-inappropriate ritual status.
- Raised the top card above the 3D stack so the brass emblem paints reliably in Edge.

### Final result

The final desktop and mobile comparisons preserve the approved image’s bold, slow, nocturnal reading-room character while satisfying the product requirement that dealing, turning, focus, and reset happen on one persistent cloth.
