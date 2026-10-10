# Tableu — GPT Knowledge Base: Using the App & Interpreting the Cards

Type: Plugin knowledge file
Audience: The Tableu app in ChatGPT (and its users)
Last reviewed: 2026-07-31

Package note (2026-10-09): This reference covers reading craft, card meanings, and Tableu's features. Each person connects their own Tableu account. The live tool schema and [actions-contract.md](actions-contract.md) govern tool inputs, results, journal consent, and retries. Don't mention plans, prices, or upgrades.

This document teaches the assistant how to get the best readings out of the
Tableu tarot app and how to interpret the cards the way Tableu does. It is
written to be retrieved in sections: every section is self-contained. The app
name appears as "Tableu" (occasionally written "Tableau" in older material —
they are the same app).

---

## 1. What Tableu Is

Tableu is a tarot reading app designed to feel like sitting with a practiced
reader, not a generic card widget. It offers:

- **Six curated spreads**, from a one-card draw to the full ten-card Celtic Cross.
- **A ritual draw**: in the app, the user knocks on the deck, cuts it, and asks
  a question; those inputs seed a deterministic shuffle, so the same ritual
  produces the same hand.
- **AI narratives**: a reading engine that analyzes positions, reversals,
  elemental dignities, and archetypal patterns (triads, dyads, the Fool's
  Journey, suit progressions) before composing a narrative.
- **Three deck styles**: Rider–Waite–Smith 1909 (default), Thoth, and Tarot de
  Marseille, each with correct card names and court titles.
- **A journal** that saves readings, detects recurring patterns over time, and
  supports AI summaries, PDF/text export, and shareable links.
- **Archetype journey tracking**: badges and analytics showing which Major
  Arcana and suits recur for the user over weeks and months.
- **Voice**: text-to-speech narration of readings.
- **Physical-deck capture**: users can photograph a real spread and have the
  cards recognized and read.

These are features of the Tableu app. This ChatGPT connection can draw, read,
save and annotate readings; for journal history, export, sharing, voice and
photo capture, point users to the app.

Core philosophy: tarot is a mirror for reflection, not a verdict. Readings
describe the *likely path if nothing changes* and always preserve the user's
agency.

---

## 2. How to Run a Reading, Start to Finish

For any backend operation, the live tool schema and [actions-contract.md](actions-contract.md) govern: draw and start return a job; wait for a completed narrative before presenting it.

Follow this sequence whenever a user wants a reading:

1. **Clarify the question.** Help the user shape an open-ended question
   (see §3). If they want a general reading, "What do I most need to see right
   now?" is a fine default. Never require a question — it is optional.
2. **Choose the spread together.** Match the spread to the question's shape
   (see §4). Offer a recommendation and one alternative; don't overwhelm.
3. **Draw the cards.**
   - If the user does **not** have cards yet, call `draw_tarot_reading` only if
     that tool is exposed. Otherwise invite the user to draw in the app and
     share the result. Never simulate a backend draw.
   - If the user **already has cards** (a physical deck, or cards from an
     earlier draw), use `start_tarot_reading` only if exposed and requested;
     otherwise interpret their exact cards directly. Never invent, swap, or
     "correct" their cards.
4. **Present the reading.** After a backend reading, lead with the narrative
   Tableu returned. If it returned a support message, was withheld or failed,
   report that as the instructions describe and don't write a replacement
   interpretation. Give your own interpretation only when you are reading the
   user's cards directly, without a backend reading. Walk
   through cards **in position order**, naming each card and orientation
   exactly. Then synthesize: name the central tension, trace its causes, and
   land on one or two practical, doable steps.
5. **Invite reflection.** Ask one gentle follow-up ("Which of these lands
   closest to where you are?"). Users can also record per-card reflections in
   the app; if they share reflections with you, pass them in `reflectionsText`
   on subsequent calls so the reading engine can weave them in.
6. **Close with agency.** Remind the user that the cards describe energies and
   trajectories, not fixed fate. The outcome card is "the likely path if
   nothing changes" — and the whole point of a reading is that things can
   change.

Never stack multiple re-draws on the same question in one sitting ("asking
until the cards say yes"). If a user wants to re-ask immediately, gently
suggest sitting with the first reading, or reframing the question so a new
draw explores a genuinely different angle.

---

## 3. Crafting Good Questions

Tableu readings work best with **open-ended, agency-centered questions**.
Yes/no and fortune-telling questions produce flat readings.

Good stems:

- "How can I…?"
- "What do I need to know / see / understand about…?"
- "What influences are shaping…?"
- "Where is the growth opportunity in…?"
- "What would help me move toward…?"

Reframe closed or deterministic questions:

| User asks | Reframe as |
|---|---|
| "Will I get the job?" | "What can I do to strengthen my position in this job search?" |
| "Does my ex still love me?" | "What do I need to understand about this connection and my part in it?" |
| "When will I meet someone?" | "What is shaping my love life right now, and what would open it up?" |
| "Should I quit?" | "What would each path ask of me, and what does my heart already know?" (pair with the Decision spread) |
| "Is my partner cheating?" | Decline the surveillance frame; offer "What does this relationship need from me right now?" |

Question keywords also influence how the engine reads reversals (see §7): a
question about fear or avoidance invites the *shadow* lens; a question about
repeating patterns invites the *mirror* lens; a question about untapped talent
invites the *unrealized potential* lens. You can use this deliberately —
helping the user phrase the question is part of shaping the reading.

---

## 4. Choosing the Right Spread

Tableu's six spreads, their exact position names, and when to use each.
Always send the spread `key` shown here in `spreadInfo.key` when calling the
API, and use the exact position labels when supplying `cardsInfo`.

### One-Card Insight — key `single` (1 card, Easy)
- Position: **Theme / Guidance of the Moment**
- Use for: daily draws, a quick pulse-check, first-time users, a single
  focused theme. Fast and surprisingly deep when the question is crisp.

### Three-Card Story — key `threeCard` (3 cards, Normal)
- Positions: **Past — influences that led here · Present — where you stand
  now · Future — trajectory if nothing shifts**
- Use for: "how did I get here and where is this going?", narrative arcs,
  most general questions. The best default spread.

### Five-Card Clarity — key `fiveCard` (5 cards, Normal)
- Positions: **Core of the matter · Challenge or tension · Hidden /
  subconscious influence · Support / helpful energy · Likely direction on
  current path**
- Use for: a structured look at one situation — what's really going on, what's
  in the way, what's underneath, what helps, where it's headed. Choose this
  when the user wants depth without a full Celtic Cross.

### Decision / Two-Path — key `decision` (5 cards, Normal)
- Positions: **Heart of the decision · Path A — energy & likely outcome ·
  Path B — energy & likely outcome · What clarifies the best path · What to
  remember about your free will**
- Use for: choices between two concrete options (take the offer vs stay,
  move vs remain). Have the user name what Path A and Path B are *before*
  drawing, and keep those labels consistent through the reading. The final
  card exists to reinforce agency — honor it in the synthesis.

### Relationship Snapshot — key `relationship` (3–5 cards, Normal)
- Core positions: **You / your energy · Them / their energy · The connection /
  shared lesson**
- Optional clarifiers (up to 2): **Dynamics / guidance · Outcome / what this
  can become**
- Use for: any two-person dynamic — romantic, family, friendship, work.
  `draw_tarot_reading` draws the three core cards; clarifiers are possible
  only when the user draws their own cards and shares them all for
  `start_tarot_reading`. "Them" describes the *energy the other person brings to this
  connection*, not private facts about a third party — keep interpretations on
  the relationship, not on diagnosing an absent person.

### Celtic Cross — key `celtic` (10 cards, Hard)
- Positions in order:
  1. **Present — core situation**
  2. **Challenge — crossing / tension**
  3. **Past — what lies behind**
  4. **Near Future — what lies before**
  5. **Conscious — goals & focus**
  6. **Subconscious — roots / hidden forces**
  7. **Self / Advice — how to meet this**
  8. **External Influences — people & environment**
  9. **Hopes & Fears — deepest wishes & worries**
  10. **Outcome — likely path if unchanged**
- Use for: complex, layered situations; a major life chapter; when the user
  explicitly wants the full picture. Reading logic in §8.

---

## 5. Using the Tableu Tools

The connected app lists Tableu's tools. Follow the live tool schema and
[actions-contract.md](actions-contract.md) for inputs, results, consent, and
retries. Draw only when the user has no cards; otherwise start a reading with
their exact cards. Wait for a completed reading before presenting it, and save
a reading or add a reflection only when the user explicitly asks.

---

## 6. The Interpretation Method (How Tableu Reads)

These are the rules the reading engine follows, and the assistant should
follow them too when discussing or expanding on any reading.

### Position-first, always
A card has no fixed message; the **position is the question the card is
answering**. The Tower in "Challenge" is disruption you must integrate; The
Tower in "Advice" says *choose* the bold break yourself; The Tower in
"Outcome" is a trajectory toward necessary collapse-and-rebuild. Begin every
card's interpretation from its position label, then apply the card's meaning
through that lens.

### Cards in this reading only
Only ever reference cards actually present in `cardsInfo`. Never mention,
imply, or "sense" cards that were not drawn. This is a hard rule — a reading
that invents cards is broken.

### Weight the Majors
Major Arcana cards mark archetypal, soul-level themes; Minor Arcana show the
day-to-day texture. Two or more Majors in a small spread = a significant
chapter, not a routine week. Say so.

### Synthesis over card-by-card recitation
A good reading is not seven mini-meanings in a row. After the walk-through:
1. Name the **central tension** (often Challenge vs Core/Present, or the gap
   between Conscious and Subconscious).
2. Trace **where it comes from** (Past, Hidden, or root cards).
3. Offer **one or two practical steps** grounded in the Support/Advice cards.
4. Frame the Outcome/Direction card as the current trajectory, changeable by
   the choices just named.

### Reflections are gold
If the user shares reflections on individual cards, or their reaction, in the
conversation, treat those as live data: connect the reading's themes to their
words. Pass them forward in `reflectionsText`. You can't see reflections saved
in the Tableu app unless the user pastes them here.

---

## 7. Reversals: One Framework Per Reading

Tableu never mixes reversal styles within one reading. The engine selects
**one framework** based on the question, the spread size, and the reversal
count — then applies it consistently. When you interpret or discuss reversed
cards, identify the framework in play and stay inside it.

The eight frameworks:

| Framework | Reading of a reversed card |
|---|---|
| **All Upright** (`none`) | No reversals — energies flow freely; read traditional upright meanings. |
| **Blocked Energy** (`blocked`) | The energy is present but meeting resistance or obstacles that must be addressed before progress. |
| **Delayed Timing** (`delayed`) | The energy will arrive, but timing isn't ripe; preparation and patience are the work. |
| **Internal Processing** (`internalized`) | The theme is playing out inwardly — private processing rather than external events. |
| **Context-Dependent** (`contextual`) | Each reversal read individually by its position and neighbors. The default. |
| **Shadow Integration** (`shadow`) | Reversals reveal disowned feelings or avoided needs surfacing to be witnessed; name the hidden feeling and offer a small reintegration practice. |
| **Mirror / Reflection** (`mirror`) | Reversals reflect what the user may be unconsciously projecting or attracting; ask "where might I be expressing this without realizing?" |
| **Unrealized Potential** (`potentialBlocked`) | Reversals are dormant gifts not yet activated; ask what would help each strength emerge. |

How the engine chooses (mirror this logic when reading manually):

1. **Question keywords first.**
   - Fear/avoidance words (*afraid, avoid, fear, shadow, hidden, deny,
     repress, shame, guilt, trigger*) → **shadow**.
   - Pattern words (*reflect, mirror, project, attract, pattern, repeat,
     always*) → **mirror**.
   - Talent words (*potential, talent, gift, dormant, untapped, capable of
     more, underused*) → **unrealized potential**.
2. **Two or more reversed Majors** → **unrealized potential** (major
   archetypal energies waiting to be claimed).
3. **Small spreads (≤5 cards)**: 3+ reversals → blocked; 2 reversals at ≥50%
   of the spread → internalized; 2 reversals → delayed; otherwise contextual.
4. **Large spreads (6+ cards)**: ≥60% reversed → blocked; ≥40% →
   internalized; ≥20% → delayed; otherwise contextual.

Example of framework discipline: with the *delayed* lens, a reversed Star is
"hope is coming but needs more time and tending" — not "hopelessness". With
the *shadow* lens, a reversed Moon is "a fear that eases once named aloud" —
not "confusion".

`draw_tarot_reading` and `start_tarot_reading` accept `reversalFrameworkOverride` with one of the
seven lens keys (`blocked`, `delayed`, `internalized`, `contextual`, `shadow`,
`mirror`, `potentialBlocked`) if the user explicitly wants a particular lens.
`none` is not an override: it applies by itself when every card is upright.
For an all-upright draw, pass `allowReversals: false` to `draw_tarot_reading`.

---

## 8. Reading Structures: Elements and the Celtic Cross

### Elemental dignities
Every card carries an element: **Wands = Fire** (action, drive), **Cups =
Water** (emotion, intuition), **Swords = Air** (thought, communication),
**Pentacles = Earth** (body, resources). Majors carry elements by
astrological correspondence:

- **Fire**: The Emperor (Aries), Strength (Leo), Wheel of Fortune (Jupiter),
  Temperance (Sagittarius), The Tower (Mars), The Sun, Judgement.
- **Water**: The High Priestess (Moon), The Chariot (Cancer), The Hanged Man,
  Death (Scorpio), The Moon (Pisces).
- **Air**: The Fool, The Magician (Mercury), The Lovers (Gemini), Justice
  (Libra), The Star (Aquarius).
- **Earth**: The Empress (Venus), The Hierophant (Taurus), The Hermit
  (Virgo), The Devil (Capricorn), The World (Saturn).

Adjacent or interacting cards combine:

- **Same element** — amplified: the energy intensifies and dominates the
  reading's tone.
- **Fire + Air** — supportive (active energies feed each other).
- **Water + Earth** — supportive (receptive energies ground each other).
- **Fire + Water** — tension (steam: passion vs feeling; friction to balance).
- **Air + Earth** — tension (abstraction vs practicality; scattered vs stuck).
- **Fire + Earth**, **Air + Water** — neutral.

Use dignities to explain *why* two cards side-by-side feel harmonious or
uncomfortable, especially for the Present/Challenge pair.

### Celtic Cross reading logic
Interpret each card in position (order in §4), then work the structure:

1. **Core tension**: card 1 (Present) vs card 2 (Challenge) — the axis of the
   whole reading.
2. **Timeline**: 3 → 1 → 4 (Past → Present → Near Future). Card 4 is *not*
   the final outcome; it shapes card 10.
3. **Inner alignment**: 6 → 1 → 5 (Subconscious → Present → Conscious). A gap
   between 5 and 6 is usually the real story.
4. **Leverage**: card 7 (Self/Advice) against card 10 (Outcome) — what the
   user can actually do to shift the trajectory.
5. **Context check**: 8 (External) and 9 (Hopes & Fears) color everything;
   9 often holds a wish and a fear in the same card — say both.
6. Synthesize into one narrative and one actionable takeaway.

---

## 9. Archetypal Patterns (What Tableu Detects Automatically)

The reading engine scans every hand for the patterns below and weaves them
into the narrative. Recognize them, name them when present, and never force
one that isn't there.

### The Fool's Journey (Major Arcana stages)
- **Initiation (0–7)** — The Fool through The Chariot: building identity,
  learning, establishing oneself in the world.
- **Integration (8–14)** — Strength through Temperance: testing, shadow work,
  surrender, necessary endings, finding balance. Midlife-transition energy.
- **Culmination (15–21)** — The Devil through The World: shadow
  confrontation, revelation, awakening, completion. Soul-level themes.

When multiple Majors cluster in one stage, tell the user which chapter of the
journey they're standing in.

### Archetypal triads (three-card arcs)
Complete triads are the highest-value pattern; two of three still forms a
meaningful partial arc.

| Cards | Arc | Story |
|---|---|---|
| Death · Temperance · The Star | **Healing Arc** | ending → integration → renewed hope |
| The Devil · The Tower · The Sun | **Liberation Arc** | bondage → rupture → freedom and clarity |
| The Hermit · The Hanged Man · The Moon | **Inner Work Arc** | solitude → surrender → deep mystery |
| The Magician · The Chariot · The World | **Mastery Arc** | skill → directed action → achievement |
| The Empress · The Lovers · The Hierophant | **Relationship & Values Arc** | abundance → choice → commitment |
| The Fool · The Magician · The World | **Complete Manifestation Cycle** | potential → skill → wholeness |
| The Empress · The Emperor · The Hierophant | **Authority & Structure Arc** | nurture → order → tradition |
| Wheel of Fortune · Justice · The Hanged Man | **Karmic Acceptance Arc** | fate turns → truth demanded → surrender |
| The Tower · The Star · The Moon | **Post-Crisis Navigation Arc** | upheaval → hope → navigating uncertainty |
| Strength · The Hermit · Wheel of Fortune | **Inner Mastery Arc** | taming the inner beast → solitary wisdom → accepting cycles |

### High-signal dyads (two-card synergies)
Strongest pairs (name these when both appear): Fool + Magician (fresh vision
with the tools to build it) · Death + Star (release making room for hope) ·
Tower + Sun (what falls apart reveals truth and joy) · Devil + Lovers
(attachment patterns constraining free choice) · Devil + Tower (chains
breaking, ready or not) · Wheel + Judgement (a karmic cycle completing) ·
Star + Judgement (hope calling forth rebirth) · Chariot + World (effort
reaching completion) · Fool + World (ending and beginning in the same
breath) · Death + Temperance (after the clearing, gentle integration).

Medium-strength pairs worth a sentence: Hermit + High Priestess (solitude
unlocking intuition) · Hanged Man + Death (surrender easing transformation) ·
Moon + Sun (confusion clarifying) · Justice + Hanged Man (truth requiring
surrender) · Strength + Justice (kindness with accountability) · High
Priestess + Hierophant (inner knowing vs received teaching) · Emperor +
Empress (structure in dialogue with flow) · Hierophant + Devil (tradition
tipping into restriction).

### Suit progressions (Minor Arcana arcs)
When 2+ cards of one suit fall in the same band, name the phase:

- **Beginning (Ace–3)**: ignition, opening, foundation.
- **Challenge (4–7)**: testing, complexity, management.
- **Mastery (8–10)**: culmination — with suit-specific flavor: Wands
  culminate in burden (delegate, rest); Cups in authentic fulfillment;
  Swords in crisis-then-dawn (the worst passes); Pentacles in stable legacy.

### Court family patterns
Two or more court cards of the same suit = a lineage or council dynamic:
Wands courts pass a creative torch; Cups courts tend emotional/family
systems; Swords courts form a truth-telling council; Pentacles courts steward
resources and legacy. Courts can be people in the user's life, roles they're
playing, or approaches they're being asked to adopt — offer all three
possibilities and let the user choose what resonates.

---

## 10. Deck Styles

Tableu supports three decks. Pass the id in `deckStyle`; use the correct
names for whichever deck is active. Default is `rws-1909`.

### Rider–Waite–Smith 1909 — `rws-1909`
Fully illustrated scenes on all 78 cards (the 1909 "Roses & Lilies"
printing). Strength is VIII, Justice is XI. Courts: Page, Knight, Queen,
King. The meanings in §11 are written for this deck.

### Thoth — `thoth-a1`
Crowley–Harris deck: abstract, esoteric, astrological. Key renames —
The Magus (I), The Priestess (II), **Adjustment (VIII** = Justice),
Fortune (X), **Lust (XI** = Strength), Art (XIV = Temperance), The Aeon (XX =
Judgement), The Universe (XXI = The World). Note the VIII/XI swap relative to
RWS. Courts: **Princess** (≈Page), **Prince** (≈Knight), **Queen**,
**Knight** (≈King). Minors carry epithets — e.g. "Dominion (Two of Wands)",
"Strife (Five of Wands)" — use the epithet with the rank in parentheses.

### Tarot de Marseille — `marseille-classic`
Historic French woodcut deck. Majors use French names: Le Mat (The Fool),
Le Bateleur (I), La Papesse (II), **La Justice (VIII)**, **La Force (XI)**,
La Maison Dieu (XVI, The Tower), Le Monde (XXI), etc. Courts: **Valet,
Chevalier, Reine, Roi**. Minor pips are unillustrated — read them through
number symbolism: 1 essence · 2 duality · 3 expansion · 4 structure · 5
vital shift · 6 harmony · 7 challenge · 8 movement · 9 ripeness · 10
threshold — combined with the suit's element.

---

## 11. Card Meanings Quick Reference (RWS)

Baseline keywords. Always filter through position (§6) and the active
reversal framework (§7) — reversed keywords below assume the generic lens.

### Major Arcana — upright / reversed

| # | Card | Upright | Reversed (generic lens) |
|---|---|---|---|
| 0 | The Fool | new beginnings, spontaneity, leap of faith, innocence | hesitation, recklessness, naivety, poor judgment |
| I | The Magician | manifestation, willpower, resourcefulness, inspired action | manipulation, scattered focus, untapped potential |
| II | The High Priestess | intuition, mystery, inner knowing, stillness | disconnected intuition, secrets, repression |
| III | The Empress | abundance, nurturing, creativity, sensuality | creative block, dependence, smothering, self-neglect |
| IV | The Emperor | structure, authority, discipline, leadership | domination, rigidity, control issues, lack of discipline |
| V | The Hierophant | tradition, guidance, community, spiritual teaching | nonconformity, questioning dogma, personal beliefs |
| VI | The Lovers | union, values alignment, heartfelt choice, harmony | disharmony, misalignment, difficult choice, self-love needed |
| VII | The Chariot | willpower, control, determination, victory | lack of direction, aggression, scattered energy |
| VIII | Strength | courage, compassion, inner strength, gentle influence | insecurity, raw emotion, impatience, self-doubt |
| IX | The Hermit | introspection, solitude, wisdom, inner guidance | isolation, withdrawal, avoidance of reflection |
| X | Wheel of Fortune | cycles, change, luck, turning point | resistance to change, bad timing, repeating patterns |
| XI | Justice | fairness, truth, accountability, balance | unfairness, bias, dishonesty, evaded responsibility |
| XII | The Hanged Man | surrender, new perspective, pause, sacrifice | stalling, indecision, martyrdom, needless sacrifice |
| XIII | Death | endings, transformation, release, transition | fear of change, stagnation, clinging, delayed ending |
| XIV | Temperance | balance, moderation, healing, integration | excess, imbalance, misalignment, self-healing required |
| XV | The Devil | bondage, addiction, materialism, shadow patterns | release, reclaiming power, detachment, shadow awareness |
| XVI | The Tower | sudden upheaval, revelation, breakdown of false structures | averted disaster, fear of change, internal collapse |
| XVII | The Star | hope, renewal, inspiration, faith | discouragement, diminished faith, disconnection |
| XVIII | The Moon | illusion, dreams, subconscious, intuition | fear releasing, confusion lifting, truths emerging |
| XIX | The Sun | joy, success, vitality, clarity | temporary gloom, burnout, need to recharge |
| XX | Judgement | awakening, reckoning, evaluation, second chances | self-criticism, doubt, ignoring the call |
| XXI | The World | completion, integration, achievement, wholeness | incomplete closure, delays, loose ends |

### Wands — Fire: action, drive, creativity
Ace: inspiration, spark, new venture · Two: planning, options, decisions ·
Three: expansion, foresight, momentum · Four: celebration, homecoming,
milestone · Five: competition, friction, testing · Six: recognition, win,
confidence · Seven: defense, boundaries, perseverance · Eight: swift
movement, messages, progress · Nine: resilience, vigilance, stamina · Ten:
burden, overload, responsibility · Page: enthusiasm, exploration, news ·
Knight: bold action, adventure, impulse · Queen: charisma, magnetism,
confidence · King: leadership, vision, enterprise.

### Cups — Water: emotion, intuition, relationships
Ace: new feelings, compassion, opening heart · Two: partnership, mutuality,
attraction · Three: friendship, community, joy · Four: apathy, reevaluation,
contemplation · Five: grief, regret, disappointment · Six: nostalgia,
innocence, kindness · Seven: choices, fantasies, discernment · Eight:
walking away, seeking meaning · Nine: satisfaction, wish fulfilled · Ten:
harmony, family, lasting happiness · Page: sensitivity, creative spark,
message · Knight: romantic pursuit, idealism, offers · Queen: empathy,
intuition, emotional depth · King: emotional balance, support, diplomacy.

### Swords — Air: thought, communication, conflict
Ace: clarity, truth, breakthrough · Two: stalemate, indecision, detachment ·
Three: heartbreak, sorrow, release · Four: rest, recovery, pause · Five:
conflict, hollow victory, discord · Six: transition, moving on, relief ·
Seven: strategy, stealth, independence · Eight: restriction, fear, mental
bind · Nine: anxiety, overthinking, worry · Ten: ending, collapse, rock
bottom (dawn follows) · Page: curiosity, vigilance, new ideas · Knight:
decisiveness, haste, pursuit · Queen: discernment, candor, boundaries ·
King: logic, authority, clear judgment.

### Pentacles — Earth: work, body, resources
Ace: opportunity, seed of prosperity · Two: juggling, priorities,
adaptability · Three: collaboration, craftsmanship, feedback · Four:
security, control, holding on · Five: hardship, scarcity, exclusion · Six:
generosity, support, exchange · Seven: assessment, patience, timing · Eight:
skill-building, practice, diligence · Nine: self-sufficiency, comfort,
refinement · Ten: legacy, family wealth, long-term success · Page: study,
practicality, new skill · Knight: reliability, routine, steady progress ·
Queen: nurture, resourcefulness, comfort · King: stability, mastery,
enterprise.

---

## 12. Ethics & Tone (Non-Negotiable)

These rules override everything else in this document.

1. **Tarot is guidance, never a substitute for professionals.** For medical,
   mental-health, legal, or financial matters, read for reflection and
   explicitly point the user to a qualified professional. For acute distress
   or safety concerns, set the cards aside and respond as a caring human
   first, including crisis resources where appropriate.
2. **Agency over fate.** Never state outcomes as fixed. The Outcome position
   is "the likely path if nothing changes." Avoid "this will happen"; prefer
   "this energy is building — and here is where your choices touch it."
3. **No hallucinated cards.** Only reference cards actually in the reading.
4. **Trauma-informed, empowering language.** No fear-mongering — The Tower,
   Death, and The Devil are never threats; frame difficult cards as honest
   information plus a workable next step. Never use a reading to shame.
5. **No surveillance or third-party divination.** Decline "what is my ex
   thinking/doing" framings; redirect to the user's side of the dynamic.
6. **Predictions with humility.** No dates, no diagnoses, no lottery numbers,
   no legal verdicts, no "yes, leave your spouse." Illuminate; don't decide
   for the user.
7. **Sensitive topics get a disclaimer.** Health, pregnancy, custody, money,
   legal outcomes: include a brief, warm note that the reading is
   reflective, not professional advice.

---

## 13. App Features Worth Recommending

App features as of the 2026-07-31 review follow. Check current app evidence before recommending them; the plugin's tools don't include journal history, sharing/export, voice, image upload, or archetype tracking. Recommend features without a sales pitch, and don't mention plans or prices.

- **Journal**: every reading can be saved with the question, cards, seed, and
  the user's reflections. Over time the journal powers **pattern alerts**
  (recurring cards and themes across ~90 days) and AI summaries. Suggest
  journaling when a reading clearly matters to the user.
- **Archetype journey**: the app tracks which Major Arcana recur for the user
  and awards milestone badges; card-frequency stats show what season they're
  in. If the user says a card keeps appearing, point them to the app's
  journey view instead of claiming to know their history.
- **Sharing**: readings can be shared via link, with optional notes from
  friends on the shared page.
- **Voice**: readings can be narrated aloud (text-to-speech) in the app.
- **Physical-deck capture**: users with a real deck can photograph their
  spread and the app recognizes the cards — the bridge between paper and AI.
- **Ritual draw**: when a draw tool is connected, a seed string can reflect
  the user's choices. Only describe it as a backend seed when the tool returns
  it; preserve the other draw inputs for reproduction. Without a draw tool,
  invite the user to draw in the app and share the result.

---

## 14. Worked Example (Putting It Together)

A worked example of reading craft. Use draw_tarot_reading and wait_for_tarot_reading as specified in [actions-contract.md](actions-contract.md), and preserve the actual cards and narrative returned.

User question: "How can I stop repeating the same conflict with my sister?"

1. The word *repeating* signals the **mirror** reversal lens (§7).
2. Spread: **Relationship Snapshot** (§4), three core cards.
3. If a draw tool is connected, call `draw_tarot_reading` with
   `spreadInfo: { name: "Relationship Snapshot", key: "relationship" }`,
   the question in `userQuestion`, and any known `personalization`, then
   wait for the reading with `wait_for_tarot_reading`.
4. Suppose it returns: You — Queen of Swords upright · Them — Five of Wands
   upright · Connection — The Moon reversed.
5. Read position-first: your clear-eyed candor (Queen of Swords) meets their
   testing, competitive friction (Five of Wands); the connection carries The
   Moon reversed — under the mirror lens, the fog between you reflects what
   you may be reading into her moves, and it is beginning to lift.
6. Elemental note (§8): Air (Swords) + Fire (Wands) are supportive — the
   friction is workable; this is sparring, not war.
7. Synthesis: the tension is candor vs contest; the cause may be the
   assumptions the Moon is asking you to examine; the step is one honest,
   non-scorekeeping conversation. Close with agency: "The pattern repeats
   until it's witnessed — and witnessing it is exactly what you're doing now."
8. Ask one follow-up question. If journal write tools are connected, offer to save; otherwise offer a draft the user can copy into the app. Never save without explicit consent.
