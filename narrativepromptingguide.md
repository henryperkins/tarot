---
tags: [mystic-tarot, narrative, ai, prompting, tarot-engine]
aliases: [Narrative Rules, AI Prompting in Mystic Tarot]
created: 2025-11-12
modified: 2025-11-12
related: [[Mystic Tarot – Overview]], [[Mystic Tarot – Architecture]], [[Mystic Tarot – Backend Functions]], [[Mystic Tarot – Deck & Spreads]]
---

# Mystic Tarot – Narrative Rules & AI Prompting

This note covers the rules and logic for generating tarot narratives, including local deterministic composition and AI prompting for Claude Sonnet 4.5. The system emphasizes authentic tarot methodology: position as a "question lens," causal storytelling, elemental insights, and non-deterministic guidance that honors free will.

Key principles:
- **Agency-forward**: Readings emphasize choice over fate (e.g., "The outcome is a trajectory based on current patterns. Your choices shape what unfolds.").
- **Trauma-informed tone**: Gentle, empowering, non-alarmist language.
- **Modular**: Local builders provide fallbacks if Claude is unavailable.
- **Spread-aware**: Different logic for Celtic Cross vs. 3-card, etc.
- **Enrichment**: Majors get imagery hooks ([[imageryHooks.js]]); Minors get suit/rank metadata ([[minorMeta.js]]).

## 1. Theme & Relationship Analysis (Input Layer)
From [[spreadAnalysis.js]]:
- **Elemental System**:
  - MAJOR_ELEMENTS (e.g., Fool: Air) and SUIT_ELEMENTS (e.g., Wands: Fire).
  - getCardElement(cardName, cardNumber): Maps any card to its element.
  - analyzeElementalDignity(card1, card2): Returns { relationship: 'supportive' | 'tension' | 'amplified' | 'neutral', elements?, description }.
    - Supportive: Fire-Air, Water-Earth.
    - Tension: Fire-Water, Air-Earth.
    - Amplified: Same element.
- **Spread-Wide Themes** (analyzeSpreadThemes(cardsInfo)):
  - Counts: suitCounts, elementCounts, majorCount, reversalCount.
  - Dominant suit/element, majorRatio, averageNumber → lifecycleStage (e.g., "new cycles" if avg ≤7).
  - Reversal framework auto-selection:
    - Based on reversalRatio: none (0), blocked (≥0.6), delayed (≥0.4), internalized (≥0.2), contextual (else).
    - Each has { name, description, guidance } for consistent interpretation (e.g., Blocked: "Energies present but meeting resistance; address blockages.").
- **Spread-Specific**:
  - analyzeCelticCross: Breaks into nucleus (1-2), timeline (3-1-4), consciousness (6-1-5), staff (7-10), crossChecks (e.g., goalVsOutcome).
  - analyzeThreeCard: Transitions (firstToSecond, secondToThird) with narrative summary.
  - analyzeFiveCard: Core vs challenge, support vs direction.

These feed into builders for context-aware narratives.

## 2. Position-Aware Card Text
From [[narrativeBuilder.js]]:
- **POSITION_LANGUAGE**: Object with per-position templates.
  - Keys: e.g., 'Present — core situation (Card 1)', 'Challenge — crossing / tension (Card 2)'.
  - Values: { intro: (card, orientation) => string, frame: string, connectorToPrev?: string, connectorToNext?: string, useImagery: boolean }.
  - Example (Challenge):
    ```
    'Challenge — crossing / tension (Card 2)': {
      intro: (card, orientation) => `Crossing this, the challenge manifests as ${card} ${orientation}.`,
      frame: 'Even if this card appears positive, it represents the obstacle, tension, or dynamic force you must integrate or overcome to move forward.',
      connectorToPrev: 'However,',
      useImagery: true
    }
    ```
- **buildPositionCardText(cardInfo, position, options)**:
  - Composes: intro + formatted meaning + imagery (if Major) + minorSummary (if Minor) + frame + elementalImagery (if provided) + reversalGuidance (if reversed).
  - Options: { reversalDescription, prevElementalRelationship, withConnectors }.
  - Example output: "At the heart of this moment stands The Fool Reversed. Here we see new beginnings and leaps of faith. Notice the Fool's gaze toward the horizon—an invitation to step forward into the unknown with trust. This card represents your current situation... Within the Blocked Energy lens, interpret as energies encountering resistance that must be consciously released."

## 3. Spread-Specific Narrative Builders
- **buildCelticCrossReading({ cardsInfo, userQuestion, reflectionsText, celticAnalysis, themes })**:
  - Sections: HEART OF THE MATTER, TIMELINE, CONSCIOUSNESS FLOW, STAFF, KEY RELATIONSHIPS, SYNTHESIS & GUIDANCE.
  - Uses celticAnalysis for synthesis (e.g., nucleus.synthesis, timeline.causality).
  - Weaves in themes (e.g., suitFocus, elementalBalance) and reversal lens.
  - Example: "Because of this foundation, [present card]... Within the [reversal framework] lens..."
- **buildThreeCardReading({ cardsInfo, userQuestion, reflectionsText, threeCardAnalysis, themes })**:
  - Single "THE STORY" section with connectors (e.g., "Because of this foundation," for Past → Present).
  - Integrates threeCardAnalysis.transitions for elemental imagery.
  - Ends with GUIDANCE incorporating themes and reversal note on Future.
- **Generic Fallback** (buildGenericReading):
  - For unsupported spreads: Opening + Cards Speak (with position text) + Reflections + Synthesis.

All use buildPositionCardText() for consistency and buildSpineParagraph() from [[narrativeSpine.js]] to enforce WHAT → WHY → WHAT’S NEXT flow.

## 4. Story Spine Enforcement ([[narrativeSpine.js]])
- Core structure: WHAT (situation), WHY (cause/connector), WHAT'S NEXT (trajectory/guidance).
- Helpers:
  - analyzeSpineCompleteness(text): Checks for keywords; returns { isComplete, missing }.
  - buildSpineParagraph({ what, why, whatsNext, connector }): Composes flowing paragraph.
  - buildWhyFromElemental(elementalRelationship): Generates causal phrase (e.g., "However, [card1] creates friction with [card2]...").
  - enhanceSection(section, metadata): Auto-fills missing spine elements if possible.
  - validateReadingNarrative(readingText): Splits by headings and checks each section.
- Usage: Optional enhancement; not yet enforced in all builders but guides development.

## 5. AI Prompting ([[narrativeBuilder.js]])
- **buildEnhancedClaudePrompt({ spreadInfo, cardsInfo, userQuestion, reflectionsText, themes, spreadAnalysis })**:
  - **System Prompt**:
    - Expertise: "You are an expert tarot reader trained in authentic professional methodology and narrative storytelling."
    - Storytelling: Story spine (WHAT → WHY → WHAT’S NEXT) + connective phrases (e.g., "Because," "Therefore," "However").
    - Imagery: Major visual/sensory hooks; elemental metaphors.
    - Reversal: Propagates themes.reversalDescription.
    - Minor Rules: Suit themes, pip numerology, court archetypes; ground in input cards.
    - Position Rules: Lens-based (e.g., Challenge as obstacle even if positive).
    - Spread Structure: Custom for Celtic (nucleus/timeline/etc) or 3-card (causal flow).
    - Ethics: No hallucinations, no fortune-telling, no medical/legal/financial, emphasize agency; 4-7 paragraphs.
  - **User Prompt**:
    - Question + Thematic Context (suits/elements/reversals).
    - Structured cards: buildCardWithImagery() for each, including visuals/sensory if Major.
    - Spread-specific: Groups into NUCLEUS/TIMELINE/etc for Celtic; simple list otherwise.
    - Cross-checks and elemental imagery.
    - Reflections.
    - Instructions: Cohesive narrative referencing cards/positions; practical guidance; remind of free will.
- Integration: If Claude succeeds, reading = Claude response; else fallback to local builder.

## Development Notes
- Testing: [[tests/narrativeBuilder.reversal.test.mjs]] verifies reversal propagation and Minor enrichment.
- Local vs AI: Local builders ensure offline functionality; Claude adds depth when available.
- Future: Layer in [[narrativeSpine.js]] validation more strictly; add prompt templates for new spreads.

See also: [[Mystic Tarot – Backend Functions]] for API flow; [[Mystic Tarot – UX & Product Notes]] for how narratives surface in UI.
