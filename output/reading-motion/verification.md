# Verification record

**Date:** October 8, 2026

**Scope:** Reading imagery mockups, local preview, source fixture, and proposal documentation. Application and narrative-provider code are unchanged.

**Base:** `ba009b346216c46597c60a4f07a5283cfc98d5cc`

## Repository checks

- `npm test`: **2,942 passed**, 505 suites, zero failures, cancellations, or skips, in the isolated feature checkout.
- `npm run docs:check`: **177 maintained Markdown files** checked; all local links resolve. This repository command excludes `output/` and `docs/superpowers/`; a separate check also confirmed all local links in the three new handoff documents resolve.
- `node --check output/reading-motion/preview.mjs`: passed.
- Both HTML fragments' JavaScript and embedded asset JSON parse successfully. The current fragment is 567,290 bytes and the earlier fragment is 896,473 bytes.
- The current study's narrative text exactly equals the preserved 97-word [sample excerpt](fixtures/three-card-transition.json), which was extracted unchanged from the original local evaluation output.
- The embedded Star image exactly matches `public/images/cards/RWS1909_-_17_Star.jpeg`. The supplied reflection and question also match the source sample.
- Neither fragment calls fetch, XHR, WebSocket, or beacon APIs. Optional host state contains prototype preferences/selection, not credentials or browser authentication state.

## Standalone browser checks

The documented [local preview](preview.mjs) was exercised in headless Chromium without `window.openai` or `Tweak`. Checks covered:

- Complete simulated passage playback; pause preserves the visible token count; resume advances; replay restarts; Show all restores the full paragraph.
- Pointer inspection of each pitcher links exactly its corresponding artwork detail and reflection phrase.
- Keyboard focus and Enter on the combined-pitchers phrase link both details and both reflection phrases.
- Look closer expands, and Return to reading restores the compact view.
- Desktop at 1040px and phone viewports at 390px and 320px, in light and dark themes: document width equals viewport width, no horizontal child overflow, and embedded artwork decodes correctly.
- The phone companion expands from 72px to 190px and returns to 72px without horizontal overflow.
- Reduced motion preserves the selected imagery/reflection association with zero active animations; inspected transitions are 0s and animation names are none.
- After supplying the preview's empty favicon, the final browser checks report zero console errors, zero page exceptions, and no requests beyond the localhost document.

Representative, visually inspected captures: [desktop](screenshots/desktop.png) and [mobile](screenshots/mobile.png). Screenshots show layout and an interaction state; the playback assertions above are the evidence for behavior over time.

The preview's explicit word/phrase markup creates 104 rendered tokens, including punctuation pieces; the unchanged passage itself contains 97 whitespace-delimited words.

## Evidence boundaries

This is a standalone fixture check, not an application E2E or authenticated guest/Pro review. No live narrative generation, narrative quality gate, vision quality gate, provider qualification, paid API call, deployment, or production smoke was performed for this handoff. No production prompt, vision logic, or model behavior changed.

The cue associations and imagery coordinates are hand-authored. The checks do not establish automatic imagery alignment, actual reading-position tracking, cross-card transitions, Thoth/Marseille behavior, reversals, screen-reader quality, real touch-device behavior, or Safari/Firefox compatibility. The earlier synthetic exploration is retained as history; fresh interaction coverage targets the current Star study.
