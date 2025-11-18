---
title: AI Tarot master guide – training, deck subtleties & interpretation
aliases:
  - AI Tarot Master Guide
  - AI Training for Tarot Interpretation
  - Unified Playbook for Tarot Deck Subtleties
tags:
  - ai/tarot
  - research/playbook
  - multimodal
  - symbolic-ai
  - cv
  - nlp
  - evaluation
  - ethics
status: canonical
---

# AI Tarot master guide – training, deck subtleties & interpretation

> Merged and deduplicated from:
> - [[Advanced Approaches to AI Training for Tarot Card Interpretation and Evaluation]]
> - [[AI Interpretation of Rider Waite Tarot Imagery Techniques and Strategies]]
> - [[Comprehensive Guide to AI Training for Tarot Card Interpretation Advanced Approaches and Rider-Waite-Specific Strategies]]
> - [[Teaching AI the Arcane Arts Unified Playbook for Tarot Deck Subtleties]]
> - [[Techniques for Teaching AI to Understand Tarot Deck Subtleties and Artistic Styles]]
> - [[How to Perform a Celtic Cross Reading Step by Step Guide]]
> - [[Tarot Cards Quick Reference and Interpretation Guide]]

## Executive summary

- **Goal**: Build AI systems that can *see* tarot images, *understand* symbolic systems across decks, and *generate* context-aware interpretations that feel coherent, ethical, and tradition-sensitive.
- **Pillars**:
  - **Multimodal learning**: Vision + language + symbolic structures (knowledge graphs, GraphRAG) instead of text-only prompting.
  - **Deck-aware modeling**: Explicit handling of Rider–Waite–Smith (RWS), Thoth, Marseille, and modern variants, including renamings and style differences.
  - **Robust evaluation**: Symbol detection, deck-specific meaning mapping, narrative coherence, and visual quality, all checked against human experts.
  - **Human tarot foundations**: Clear frameworks for suits, Major/Minor Arcana, upright vs reversed, spreads (especially Celtic Cross) to anchor model behavior.
  - **Ethics & governance**: CARE/FPIC principles, community collaboration, and “supportive tool, not oracle” positioning.
- **Priority stack**:
  1. Clean, richly annotated datasets (multi-deck, multi-modal).
  2. Symbolic representation & knowledge graphs with GraphRAG.
  3. Style-robust vision + LoRA-based style adapters.
  4. Spread-aware interpretation engines (context, sentiment, memory).
  5. Evaluation + human-in-the-loop refinement.

---

## 1. Human tarot foundations (for both readers & models)

### 1.1 Tarot structure at a glance

- **Major Arcana (22 cards)**: Archetypal life themes (e.g., The Fool, Death, The World). Clusters of Majors in a spread = big turning points.
- **Minor Arcana (56 cards)**:
  - **Suits / elements**:
    - Wands – Fire: action, drive, creativity.
    - Cups – Water: emotions, intuition, relationships.
    - Swords – Air: thought, communication, conflict.
    - Pentacles – Earth: work, body, money, material life.
  - **Numbers (Aces–10)** follow a development arc: potential → tension → integration → completion.
  - **Court cards (Page, Knight, Queen, King)**: people, roles, or approaches.

These structures become labels and constraints for AI: each card class, element, and number can be explicit metadata and/or prediction targets.

### 1.2 Upright vs reversed – a practical model

- **Upright**: Baseline meaning (keywords, suit, number, archetype).
- **Reversed**: Same energy, but:
  - blocked or delayed,
  - excessive or deficient,
  - internalized (happening inwardly),
  - or, occasionally, the clear opposite.
- Within a single reading, pick **one or two reversal lenses** (e.g., “blocked/delayed + internalized”) so the story stays coherent.

AI alignment: treat reversals as modifiers over upright meaning (flags/features) rather than separate unrelated meanings.

### 1.3 Position as “question lens”

In any spread, the **position** tells you what question the card is answering:

- Time-based: Past / Present / Future → timeline.
- Role-based: Challenge, Advice, Subconscious, External Influences, Outcome → function.
- Same card, different position → genuinely different reading.

For AI, each position becomes a **typed slot** (e.g., `role: "challenge"`), and models must condition on this.

### 1.4 Celtic Cross – spread & reading logic

The Celtic Cross is a 10-card spread with two main parts:

**Circle/Cross (cards 1–6: core dynamics + timeline)**

1. **Present** – central situation, atmosphere, querent’s state.
2. **Challenge** – obstacle/crossing force to integrate or overcome.
3. **Past** – influences/causes leading to the present.
4. **Near future** – developments in the next weeks/months (not final outcome).
5. **Conscious (above)** – goals, hopes, best-case the querent is aiming for.
6. **Subconscious (below)** – hidden motives, deeper drives, foundations.

**Staff (cards 7–10: self, context, trajectory)**

7. **Self / Advice** – querent’s stance or tailored guidance.
8. **External influences** – people, conditions, systems outside their control.
9. **Hopes & fears** – intertwined desires/anxieties shaping choices.
10. **Outcome (current path)** – probable trajectory if nothing changes.

**Reading workflow (human or AI)**

1. Interpret each card **for its position**.
2. Identify the core tension: **1 vs 2**.
3. Trace timeline: **3–1–4**, then **4→10** for near-future shaping outcome.
4. Check inner alignment: **6–1–5** (subconscious → present → conscious).
5. Map leverage: **7/Advice vs 10/Outcome**.
6. Summarize with **one narrative + one actionable takeaway**.

For AI, Celtic Cross is an ideal testbed: positions are structured, and we can check whether outputs respect these relationships.

---

## 2. Tarot systems & deck subtleties

### 2.1 Major lineages and their differences

**Rider–Waite–Smith (RWS)**

- Fully illustrated scenes for all 78 cards.
- Golden Dawn symbolism; Justice XI, Strength VIII.
- De facto standard for modern learning and digital decks.

**Tarot de Marseille**

- Minimalist woodcut style; pip-style Minors (suit symbols only).
- Justice VIII, Strength XI.
- Heavy reliance on numerology and elemental dignities.

**Thoth (Crowley–Harris)**

- Abstract, densely esoteric imagery.
- Renamed Majors (Adjustment, Aeon, Lust, etc.).
- Titled Minors (e.g., Dominion, Strife) with strong astrological/Kabbalistic correspondences.

**Implication for AI**: never assume “tarot” means RWS. Training and inference must be deck-aware: naming, numbering, imagery, and philosophy differ.

### 2.2 Artistic variation and style diversity

Across and within systems you encounter:

- Hand-drawn vs digital vs collage vs photorealism.
- Different palettes, line quality, framing, abstraction.
- Creators swapping symbols for culturally specific motifs.

For AI, “The Magician” might be a woodcut craftsman, an abstract sigil, or a neon cyberpunk hacker. Models must learn **style-invariant semantics**.

---

## 3. Data collection, curation & annotation

### 3.1 Dataset scope and composition

Target:

- **700–5,000+ images** spanning multiple decks and traditions.
- Oversample **Major Arcana** to stabilize generative models and symbolism.
- Standardize resolutions (e.g., 512×512 or 350×600) while preserving aspect ratio.

Include:

- Card name, deck, arcana (Major/Minor), suit, number, court rank, upright/reversed.
- Deck lineage (RWS-like, Thoth-like, Marseille-like, indie).
- Upright/reversed meanings, keywords, archetype labels, elemental/astrological tags.
- Spread context (position, question type) when available.

### 3.2 Symbol-level annotation

To connect pixels to symbols:

- Detect and label:
  - People (gender presentation, posture, gesture).
  - Objects (sword, cup, wand, pentacle, tower, crown, animals).
  - Colors and dominant palette.
  - Spatial relationships (above/below, facing toward/away, on horizon, foreground/background).
- Add **semantic tags**:
  - Emotions: grief, joy, tension, hope.
  - Motifs: sunrise, crossroads, storm, gateway.
- Use standard formats (COCO JSON, YOLO, Pascal VOC) and clear guidelines:
  - Label *every* instance of important symbols.
  - Provide edge-case examples and negative examples.

### 3.3 Multimodal pairings

Core unit: **(image, text, metadata)**.

Examples:

- Single-card: image + upright description + reversed description.
- Spread: list of cards + positions + question + full reading text.
- Contextual: `[question, card image] → domain-specific interpretation (career, love, spiritual).`

Use existing public corpora for bootstrapping, but curate and normalize to your ontology.

---

## 4. Symbolic representation & knowledge graphs

### 4.1 Knowledge graphs for tarot

Represent tarot as a graph:

- **Nodes**: Cards, Symbols, Elements, Numbers, Archetypes, Decks, Creators, Spreads, Positions.
- **Edges**: `hasSymbol`, `hasElement`, `associatedWith`, `renamedAs`, `differsFrom`, `appearsInPosition`.

Examples:

- `Magician --hasSymbol--> Infinity`
- `Two of Cups --element--> Water`
- `Justice (RWS XI) --renamedAs--> Adjustment (Thoth VIII)`

Use graph embeddings / graph neural networks to:

- Enforce consistency (e.g., Tower must involve upheaval themes).
- Support multi-hop reasoning (e.g., “Star” → hope → Aquarius → humanitarian themes).

### 4.2 GraphRAG (graph-enhanced retrieval)

Combine RAG with the tarot graph:

1. For a query + spread, identify nodes (cards, symbols, themes).
2. Traverse graph to collect relevant passages (deck guidebooks, essays, prior readings).
3. Feed retrieved snippets + graph-structured context into the language model.
4. Optionally apply a **post-generation linter** that checks card names, elements, and forbidden hallucinations.

This dramatically reduces off-canon interpretations and hallucinated cards.

---

## 5. Computer vision & artistic style modeling

### 5.1 Core vision tasks

- **Card classification**: identify which card (and orientation) an image shows.
- **Symbol detection**: bounding boxes/masks for key motifs (sun, moon, sword, cup, tower, lion, dog, etc.).
- **Style classification**: deck, artistic medium, palette family.

Architectures:

- CNNs or Vision Transformers (ViTs) for card classification and style recognition.
- YOLO/DETR-style detectors for symbol detection.

### 5.2 Handling style diversity

Use:

- **Multi-deck training**: multiple RWS-style and non-RWS decks to teach invariances.
- **Augmentation**: color jitter, texture overlays, blur, perspective shifts, style filters.
- **Style transfer / normalization**:
  - Option A: Normalize inputs to a “canonical” style before interpretation.
  - Option B: Train style-adaptive models (style embeddings or tokens).

Goal: the model should recognize “6 of Swords” whether it appears as woodcut boats, watercolor, or flat-vector art.

---

## 6. Generative pipelines & style adaptation

### 6.1 StyleGAN & diffusion for deck generation

For AI-generated decks:

- Use **StyleGAN2-ADA or diffusion models** with transfer learning from generic image models.
- Train on ~700+ tarot images, generate 20–40 candidates per card, and curate down to ~78–90 finals.
- Maintain consistent:
  - Frame/border system.
  - Character continuity (same “figure” appears across related cards).
  - Symbol fidelity (cards include the right motifs).

These generative models can also be used for **data augmentation** and “what-if” visualization.

### 6.2 LoRA (Low-Rank Adaptation) for tarot styles

LoRA is the practical way to adapt big image models to tarot styles:

- Lightweight adapters (~50–200 MB) trained on:
  - 20–50 images for character/mini-style.
  - 50–200+ images for full deck style.
- Advantages:
  - Multiple LoRAs can be composed at runtime:
    - e.g., “RWS structure” + “Art Nouveau art” + “cyberpunk palette”.
  - No need to fully fine-tune or host gigantic custom checkpoints for every deck.

Training practices:

- Freeze early layers, fine-tune later ones.
- Use small learning rates and progressive unfreezing.
- Strong augmentation to avoid overfitting niche decks.

---

## 7. NLP & tarot interpretation models

### 7.1 Foundation models and training objectives

Use transformer LLMs (small or large) fine-tuned on:

- Card descriptions (upright + reversed).
- Spread-based readings (with card lists + positions).
- Deck guidebooks and essays.
- Practitioner-generated readings annotated with context (career, love, spiritual, etc.).

Training tasks:

- Next-token prediction on readings.
- Multi-task:
  - Predict card-level labels (element, numerology, archetype).
  - Question → card → domain classification (e.g., which domain is most relevant?).

### 7.2 Context, sentiment, and intent

Before generating a reading:

- Parse the **user question**:
  - Domain (career, relationships, general).
  - Sentiment (anxious, hopeful, neutral).
  - Entities (people, workplace, time horizons).
- Respect **intent**:
  - Only trigger tarot logic when asked.
  - Avoid deterministic claims about fate; reinforce agency.

These signals condition the model’s tone, framing, and which card meanings it emphasizes.

### 7.3 Encoding Rider–Waite–Smith symbolism

For RWS imagery, explicitly model:

- **Color cues**: e.g., bright yellow (optimism, enlightenment), deep blue (spirituality, unconscious).
- **Positional features**: objects above/below, left/right, central figures, gestures (e.g., Magician’s “as above, so below”).
- **Archetype embeddings**: Empress as “nurturing-mother”, Tower as “upheaval”, etc.

Implementation:

- Train auxiliary heads that predict:
  - Primary archetype(s) for each card.
  - Symbolic attributes (e.g., presence of pillars, water bodies).
- These labels become metadata for interpretation models and vectors in the knowledge graph.

---

## 8. Multimodal and embedding strategies

### 8.1 Shared image–text space

Use CLIP-like or custom models to embed:

- Card images.
- Card descriptions.
- User questions.
- Spread interpretations.

into a **shared vector space**, so:

- Similar cards cluster (e.g., 3 of Cups near 10 of Cups in “joy” space).
- Different deck images for the same card map close together.
- User questions can retrieve relevant symbols/themes before generation.

### 8.2 Multi-view and cross-deck generalization

Train embeddings so that:

- Multiple depictions of “The Star” (RWS, Thoth, Marseille variants) are close together even if stylistically different.
- Even when a deck heavily stylizes or abstracts, embeddings still link back to core archetypes.

Techniques:

- Triplet/contrastive loss across views/decks.
- Explicit “same-card-different-deck” positive pairs.

---

## 9. Deck-specific adaptation

### 9.1 Per-tradition modeling

Maintain explicit knowledge for:

- **RWS**:
  - Fully illustrated Minors; strong narrative scenes.
  - Justice XI, Strength VIII.
- **Marseille**:
  - Pip Minors; stronger focus on number + element + suit patterns.
  - Justice VIII, Strength XI.
- **Thoth**:
  - Renamed trumps, titled Minors, heavy Qabalah/astrology.

Strategies:

- Separate but related training subsets.
- Domain adaptation from RWS to Marseille/Thoth via few-shot examples and prompts:
  - “Interpret this as Thoth Adjustment (Justice) in a spiritual context…”

### 9.2 Few-shot & prompt adaptation

Use few-shot techniques:

- Provide examples of how the same card is interpreted across traditions.
- Condition the model with the **deck name** and optional **creator intent**.

Example prompt fragment:

> Deck: Thoth. Card: Lust (Strength). Position: Challenge. Question: career path.
> Focus on esoteric and psychological themes but keep language accessible.

---

## 10. Reading context & spread-aware engines

### 10.1 Spread schema

Represent spreads in structured form:

- Cards with:
  - Name, deck, upright/reversed.
  - Position (with semantics: “past”, “challenge”, etc.).
- Question metadata (domain, sentiment).

Example schema snippet:

```json
{
  "spread": "Celtic Cross",
  "question": "What do I need to know about my career path right now?",
  "cards": [
    { "slot": 1, "role": "present", "card": "Two of Wands", "orientation": "upright" },
    { "slot": 2, "role": "challenge", "card": "Five of Pentacles", "orientation": "upright" },
    ...
  ]
}
```

### 10.2 Interpretation logic

Internally, your interpretation pipeline should:

1. Generate **per-card, per-position** summaries (1–2 sentences).
2. Model relationships:
   - Core tension: 1 vs 2.
   - Past → present → near future: 3–1–4.
   - Subconscious vs conscious vs outcome: 6–5–10.
   - Advice vs outcome: 7 vs 10.
3. Compose a single narrative with:
   - What is happening?
   - Why (root causes)?
   - What can be done (advice)?

Use attention mechanisms or graph-style reasoning over cards to ensure the narrative respects the spread’s structure.

---

## 11. Evaluation & interpretability

### 11.1 Symbolic & recognition metrics

- **Card identification accuracy**:
  - % of images correctly classified to the right card/orientation.
- **Symbol detection**:
  - Precision/recall/F1 for key symbols (e.g., lion on Strength, tower + lightning on The Tower).
- **Deck/Style recognition**:
  - Accuracy in labeling deck or style family, useful for deck-specific logic.

### 11.2 Narrative & interpretive metrics

- **Symbolic coherence**:
  - Does the reading mention symbols actually present?
  - Does it avoid hallucinating non-existent elements?
- **Alignment with canonical meanings**:
  - Embedding-based similarity between generated text and curated references.
  - Human experts score for “on message vs way off”.
- **Contextual relevance**:
  - Human ratings: “Does this answer my question?”, “Is it comforting/clear?”, “Does it respect my agency?”

### 11.3 Visual/generative metrics

- **FID (Fréchet Inception Distance)**:
  - Measures distance between generated tarot image distributions and real decks.
- **Style consistency**:
  - How uniform is style across all 78 cards in a generated deck?
- **Interpolation quality**:
  - Smoothness and semantic coherence across latent interpolations.

### 11.4 Interpretability tools

- **Attention/heatmaps**:
  - Visualize which parts of the image/text influenced the interpretation.
- **Causal tracing**:
  - Identify which tokens or image regions most contributed to specific statements (e.g., “upheaval” in a Tower reading).
- **Explanation graphs**:
  - Small human-readable chains: “Tower → lightning + falling figures → sudden change.”

### 11.5 Human-in-the-loop refinement

- Active learning on:
  - Low-confidence predictions.
  - High-disagreement cases (experts vs model).
- Expert tools:
  - Annotation dashboards for symbols and card relationships.
  - UI for editing readings, capturing better phrasings and explanations.

---

## 12. Ethics, culture & governance

Key principles:

- **Transparency**:
  - Make it clear that readings are algorithmic and for reflection/entertainment, not deterministic prophecy.
- **Cultural sensitivity**:
  - Some decks draw on specific spiritual/cultural traditions; follow CARE & FPIC guidelines, respect community wishes and licensing.
- **User agency & safety**:
  - Avoid harmful advice (e.g., medical, legal, financial absolutes).
  - Emphasize choice, support, and multiple possible futures.
- **Community collaboration**:
  - Involve practitioners, creators, and users in dataset design, evaluation, and governance.

---

## 13. Example implementation roadmaps

### 13.1 Visual tarot deck generation

1. Collect 700–1,000+ labeled card images across decks.
2. Train StyleGAN2-ADA or diffusion model with transfer learning.
3. Fine-tune LoRA adapters for specific styles or custom themes.
4. Generate 20–40 variants per card, curate down to a coherent 78-card deck.
5. Validate symbolism and usability with expert readers.

### 13.2 AI tarot interpretation engine

1. Build a multimodal dataset:
   - Card images + meanings + spread readings + questions.
2. Train:
   - Vision model for card/symbol detection.
   - LLM (or small transformer) for tarot text.
   - Optional image–text embedding model for retrieval.
3. Construct a tarot knowledge graph and plug it into a GraphRAG layer.
4. Implement spread schemas (starting with 3-card and Celtic Cross).
5. Add:
   - Intent detection, sentiment analysis.
   - Guardrails (no deterministic fate, no unsafe advice).
   - Evaluation dashboards and human-in-the-loop review.

---

## Appendix A – Celtic Cross quick reference

**Layout**

- 1 – Present (center)
- 2 – Challenge (crossing 1)
- 3 – Past (left)
- 4 – Near future (right)
- 5 – Conscious (above)
- 6 – Subconscious (below)
- 7 – Self / Advice (right column, bottom)
- 8 – External influences (above 7)
- 9 – Hopes & fears (above 8)
- 10 – Outcome (top of right column)

**Reading steps**

1. Clarify question; set intention; optionally choose significator.
2. Shuffle, draw ten cards, lay out as above.
3. Interpret cards 1–2 as core issue and crossing force.
4. Read timeline: 3–1–4.
5. Assess inner landscape: 6–1–5.
6. Read 7–10 as self, environment, hopes/fears, trajectory.
7. Synthesize story and advice; emphasize free will and options.

---

## Appendix B – Tarot keywords (78-card quick guide)

### Major Arcana

- The Fool: new beginnings, spontaneity, leap of faith, innocence
- The Magician: manifestation, skill, willpower, resourcefulness
- The High Priestess: intuition, mystery, inner knowledge, subconscious
- The Empress: abundance, nurturing, creativity, fertility
- The Emperor: structure, authority, leadership, stability
- The Hierophant: tradition, guidance, community, spiritual learning
- The Lovers: choice, union, values alignment, relationships
- The Chariot: determination, control, victory, direction
- Strength: courage, compassion, inner strength, patience
- The Hermit: introspection, solitude, inner guidance, truth
- Wheel of Fortune: cycles, change, fate, opportunity
- Justice: fairness, truth, cause and effect, accountability
- The Hanged Man: surrender, new perspective, pause, sacrifice
- Death: endings, transformation, release, rebirth
- Temperance: balance, moderation, healing, integration
- The Devil: bondage, materialism, temptation, shadow patterns
- The Tower: upheaval, sudden change, revelation, breakdown
- The Star: hope, renewal, inspiration, healing
- The Moon: uncertainty, illusion, dreams, intuition
- The Sun: joy, vitality, success, clarity
- Judgement: awakening, evaluation, forgiveness, second chances
- The World: completion, integration, achievement, wholeness

### Wands (Fire – action, drive, creation)

- Ace of Wands: inspiration, spark, new venture
- Two of Wands: planning, options, decisions
- Three of Wands: expansion, foresight, momentum
- Four of Wands: celebration, homecoming, milestones
- Five of Wands: competition, friction, testing
- Six of Wands: recognition, win, confidence
- Seven of Wands: defense, boundaries, perseverance
- Eight of Wands: swift movement, messages, progress
- Nine of Wands: resilience, vigilance, stamina
- Ten of Wands: burden, overload, responsibility
- Page of Wands: enthusiasm, exploration, news
- Knight of Wands: bold action, adventure, impulse
- Queen of Wands: charisma, magnetism, confidence
- King of Wands: leadership, vision, enterprise

### Cups (Water – emotions, intuition, relationships)

- Ace of Cups: new feelings, compassion, opening heart
- Two of Cups: partnership, mutuality, attraction
- Three of Cups: friendship, community, joy
- Four of Cups: apathy, reevaluation, contemplation
- Five of Cups: grief, regret, disappointment
- Six of Cups: nostalgia, innocence, kindness
- Seven of Cups: choices, fantasies, discernment
- Eight of Cups: withdrawal, seeking meaning, departure
- Nine of Cups: satisfaction, wish fulfilled, contentment
- Ten of Cups: harmony, family, lasting happiness
- Page of Cups: sensitivity, creative spark, message
- Knight of Cups: romantic pursuit, idealism, offers
- Queen of Cups: empathy, intuition, emotional depth
- King of Cups: emotional balance, support, diplomacy

### Swords (Air – thought, communication, conflict)

- Ace of Swords: clarity, truth, breakthrough
- Two of Swords: stalemate, indecision, detachment
- Three of Swords: heartbreak, sorrow, release
- Four of Swords: rest, recovery, pause
- Five of Swords: conflict, hollow victory, discord
- Six of Swords: transition, moving on, relief
- Seven of Swords: strategy, stealth, independence
- Eight of Swords: restriction, fear, mental bind
- Nine of Swords: anxiety, overthinking, worry
- Ten of Swords: ending, collapse, rock bottom
- Page of Swords: curiosity, vigilance, new ideas
- Knight of Swords: decisiveness, haste, pursuit
- Queen of Swords: discernment, candor, boundaries
- King of Swords: logic, authority, clear judgment

### Pentacles (Earth – work, body, resources)

- Ace of Pentacles: opportunity, seed of prosperity
- Two of Pentacles: juggling, priorities, adaptability
- Three of Pentacles: collaboration, craftsmanship, feedback
- Four of Pentacles: security, control, holding on
- Five of Pentacles: hardship, scarcity, exclusion
- Six of Pentacles: generosity, support, exchange
- Seven of Pentacles: assessment, patience, timing
- Eight of Pentacles: skill-building, practice, diligence
- Nine of Pentacles: self-sufficiency, comfort, refinement
- Ten of Pentacles: legacy, family wealth, long-term success
- Page of Pentacles: study, practicality, new skill
- Knight of Pentacles: reliability, routine, steady progress
- Queen of Pentacles: nurture, resourcefulness, comfort
- King of Pentacles: stability, mastery, enterprise

---

## Appendix C – Major Arcana upright vs reversed (quick reference)

| Card | Upright | Reversed |
|---|---|---|
| The Fool | Beginnings, spontaneity, leap of faith, innocence | Hesitation, recklessness, naivety, poor judgment |
| The Magician | Manifestation, willpower, resourcefulness, inspired action | Manipulation, scattered focus, poor planning, untapped potential |
| The High Priestess | Intuition, mystery, inner knowing, stillness | Disconnected intuition, secrets, repression, superficial reading of signs |
| The Empress | Abundance, nurturing, creativity, sensuality | Creative block, dependence, smothering, neglect of self-care |
| The Emperor | Structure, authority, discipline, leadership | Domination, rigidity, control issues, lack of discipline |
| The Hierophant | Tradition, guidance, community, spiritual teaching | Nonconformity, personal beliefs, rebellion, dogma questioned |
| The Lovers | Union, values alignment, heartfelt choice, harmony | Disharmony, misalignment, difficult choices, self-love needed |
| The Chariot | Willpower, control, determination, victory | Lack of direction, aggression, scattered energy, self-doubt |
| Strength | Courage, compassion, inner strength, gentle influence | Insecurity, raw emotion, impatience, self-doubt |
| The Hermit | Introspection, solitude, wisdom, inner guidance | Isolation, withdrawal, avoidance of reflection, loneliness |
| Wheel of Fortune | Cycles, change, luck, turning point | Resistance to change, bad timing, repeating patterns |
| Justice | Fairness, truth, accountability, balance | Unfairness, bias, dishonesty, evasion of responsibility |
| The Hanged Man | Surrender, new perspective, pause, sacrifice | Stalling, indecision, martyrdom, needless sacrifice |
| Death | Endings, transformation, release, transition | Fear of change, stagnation, clinging, delayed ending |
| Temperance | Balance, moderation, healing, integration | Excess, imbalance, misalignment, self-healing required |
| The Devil | Bondage, addiction, materialism, shadow patterns | Release, reclaiming power, detachment, shadow awareness |
| The Tower | Sudden upheaval, revelation, breakdown of false structures | Averted disaster, fear of change, internal collapse, delayed crisis |
| The Star | Hope, renewal, inspiration, faith | Discouragement, diminished faith, self-doubt, disconnection |
| The Moon | Illusion, fear, dreams, subconscious, intuition | Release of fear, confusion lifting, inner turmoil, truths emerging |
| The Sun | Joy, success, vitality, clarity | Temporary gloom, burnout, over-optimism, need to recharge |
| Judgement | Awakening, reckoning, evaluation, second chances | Self-criticism, doubt, ignoring the call, stagnation |
| The World | Completion, integration, achievement, wholeness | Incomplete closure, delays, loose ends, need for closure |

---

**How to use this master note**

- For **system design**: focus on §§3–13.
- For **symbol reference**: use Appendices B–C.
- For **spread encoding & testing**: use §10 + Appendix A.
- For **deck-aware RWS work**: see §§2, 7.3, 9.

You can now archive the original source notes and treat this as the canonical AI tarot reference, adding local edits or project-specific sections as needed.
