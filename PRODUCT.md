# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Tableu is for individuals ranging from people new to tarot through experienced practitioners who use tarot privately for structured self-reflection. Their primary job is to bring a question or intention, engage with a reading at the depth they want, make sense of the spread, and revisit useful themes over time. Professional client reading is not the primary use case.

## Product Purpose

Tableu turns tarot into an agency-centered reflective practice. It helps a person move from a question or intention through a participatory card-reading ritual to a grounded narrative they can consider, discuss through follow-ups, save, and revisit. Success means the user leaves with greater clarity or a useful next reflection while retaining responsibility for their own choices.

## Positioning

Tableu is a structured self-reflection system, not a fortune-telling app or generic card randomizer. Optional knock, cut, and question inputs seed repeatable draws. The product combines those cards with spread-position semantics, curated tarot knowledge, and pattern-aware analysis to produce grounded, agency-preserving narratives. Its journal and journey features make readings part of an ongoing practice rather than isolated sessions.

## Operating Context

- The product runs as a responsive web app and installable PWA across handset and desktop browsers.
- The primary flow is: personalize the experience, choose a deck and spread, enter or refine an intention, optionally perform the knock-and-cut ritual, reveal the cards, receive the synthesized reading, and optionally continue with narration, follow-up questions, journaling, or sharing.
- Users may return to journal entries and longer-term journey views to notice recurring cards, archetypes, and themes.
- Accounts and subscription tiers extend usage and unlock capabilities; the central reflective reading flow remains the organizing experience.
- Physical-card recognition is an optional vision-assisted capability, not a requirement for completing a reading or the core product position.

## Capabilities and Constraints

- Supported spreads include One-Card Insight, Three-Card Story, Five-Card Clarity, Decision/Two-Path, Relationship Snapshot, and Celtic Cross.
- Supported deck traditions are Rider-Waite-Smith, Thoth, and Marseille.
- Readings may use spread positions, card relationships, reversal handling, archetypal patterns, curated retrieval, and personalization to assemble a narrative grounded in the actual draw.
- Supporting capabilities include guided question crafting, follow-up conversation, voice narration, personal journaling, user-initiated sharing, recurring-pattern and journey views, and optional physical-card capture.
- Personalization can adapt the experience to tarot familiarity and preferred reading tone without changing the cards or their underlying meaning.
- Readings must preserve agency and avoid absolute predictions or medical, mental-health, legal, and financial directives. Sensitive situations require reflective boundaries and referral to appropriate professional or crisis support.
- The product is implemented as a React and Vite web client backed by Cloudflare Workers and Cloudflare data services. PWA behavior, shared frontend/worker contracts, and subscription-aware entitlement checks are established technical constraints.
- Journal and personalization data are personal by default; sharing must remain an explicit user action.

## Brand Commitments

- The canonical user-facing product name is **Tableu**. Internal legacy identifiers may use `tableau`, but future product copy must preserve the Tableu spelling.
- Tableu must remain positioned around reflection and agency rather than fate, psychic certainty, or supernatural prediction.
- The three supported tarot traditions and the optional ritual mechanics are durable parts of the product identity.
- Physical-card recognition remains a supporting capability unless a future product decision explicitly promotes it into the core promise.

## Evidence on Hand

- Current product overview and implemented capability inventory: `README.md`.
- Current user-facing name and product description: `public/manifest.webmanifest`, `src/components/Header.jsx`, and `src/components/onboarding/trimmed/WelcomeStep.jsx`.
- Current workflows and routes: `src/TarotReading.jsx` and `src/components/AnimatedRoutes.jsx`.
- Active differentiation background: `docs/app-store-differentiation.md` and `docs/app-store-metadata.md`. Competitive or exclusivity claims in these files are not independently verified product proof.
- Current accessibility contract and test tooling: `docs/design-contract.md` and `tests/accessibility/`.
- Real brand, spread, and supported-deck assets exist under `public/images/`, `public/images/spread-art/`, and `selectorimages/`.
- Narrative and vision evaluation fixtures and quality gates exist under `data/`, `tests/`, and `scripts/evaluation/`.
- No verified testimonials, customer counts, press claims, outcome benchmarks, or independently substantiated competitor-exclusivity claims are confirmed. Future work must not invent them.

## Product Principles

1. Preserve agency over prediction: the cards support reflection but never decide for the user.
2. Make the user an active participant: intention and optional ritual inputs should feel meaningful, not like slot-machine randomness.
3. Ground every reading: interpretations must remain faithful to the drawn cards, their positions, and the product's curated knowledge.
4. Welcome different levels of tarot experience without flattening the depth available to practiced users.
5. Support a safe, private, accessible practice that becomes more useful as a person reflects over time.

## Accessibility & Inclusion

Tableu targets WCAG 2.1 AA. Future work must preserve keyboard access, visible focus, meaningful screen-reader labeling and announcements, reduced-motion behavior, sufficient contrast, mobile-safe touch targets, and usable handset and landscape layouts. Onboarding and personalization should continue to support people across tarot experience levels without assuming prior specialist knowledge.
