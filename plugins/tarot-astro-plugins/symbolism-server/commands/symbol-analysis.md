---
description: Deep symbolic analysis of tarot card imagery
---

# Symbol Analysis for Tarot Cards

Provide comprehensive symbolic interpretation of imagery in tarot cards.

## Instructions

When the user requests symbol analysis for a card (or cards), follow this process:

1. **Identify the symbols present** in the card(s)
   - Ask the user which card(s) they want analyzed if not specified
   - If analyzing Rider-Waite cards, recall the common symbols in each card

2. **Use the symbolism MCP tools** to gather meanings:
   - Use `interpret_card_symbols` for multi-symbol synthesis
   - Use `get_symbol` for detailed individual symbol meanings
   - Use `get_color_meanings` to analyze the color palette
   - Use `get_numerological_insight` for number symbolism
   - Use `get_related_symbols` to explore thematic connections

3. **Present findings in this layered format:**

```
🔮 Symbolic Analysis: [Card Name]

**Primary Symbols:**

[Symbol 1 - Name]
• Keywords: [list keywords]
• General meaning: [general interpretation]
• In this card: [specific to this card's context]
• Archetypal resonance: [deeper archetypal meaning]

[Symbol 2 - Name]
• Keywords: [list keywords]
• General meaning: [general interpretation]
• In this card: [specific to this card's context]
• Archetypal resonance: [deeper archetypal meaning]

**Color Symbolism:**
The card's palette of [colors] creates an energetic signature of [interpretation].

**Numerological Insight:**
[Card number/position meaning and significance]

**Symbolic Synthesis:**
[Weave the symbols together into a coherent interpretation, identifying dominant themes and how symbols interact/reinforce each other]

**Interpretive Guidance:**
When reading this card, pay special attention to [key symbols] as they hold the core message. The interplay between [symbol A] and [symbol B] suggests [synthesis].
```

4. **Make it interactive:**
   - Invite deeper exploration: "Would you like me to explore any specific symbol further?"
   - Offer thematic connections: "I can find other symbols related to [theme] if you'd like"
   - Connect to reading context: "How does this symbolic language speak to your question?"

## Example

User: "/symbol-analysis The High Priestess"

Response:
```
🔮 Symbolic Analysis: The High Priestess

**Primary Symbols:**

Pomegranate
• Keywords: underworld, knowledge, abundance, fertility, Persephone
• General meaning: Underworld mysteries, sacred knowledge, abundant fertility
• In this card: The veil decorated with pomegranates represents the threshold between conscious and unconscious, the abundance of wisdom hidden behind the veil
• Archetypal resonance: Seeds of wisdom, descent into the underworld, hidden abundance

Moon at Her Feet
• Keywords: unconscious, intuition, cycles, feminine, mystery
• General meaning: The unconscious, intuition, cycles, dreams, the feminine
• In this card: The crescent moon represents her dominion over the unconscious realms and the cyclical nature of hidden wisdom
• Archetypal resonance: The divine feminine, lunar mysteries, cyclical wisdom

Pillars (Black & White)
• Keywords: duality, balance, threshold, opposites, gateway
• General meaning: The balance of opposites, the gateway between worlds
• In this card: Boaz and Jachin - the pillars of Solomon's temple, representing duality that must be balanced to access wisdom
• Archetypal resonance: The pillars of manifestation, positive and negative forces in balance

**Color Symbolism:**
The card's palette of blue, white, and black creates an energetic signature of deep intuition (blue), pure spiritual wisdom (white), and the mysterious void of infinite potential (black). This combination suggests accessing pure wisdom through the depths of the unconscious.

**Numerological Insight:**
As card II (2), The High Priestess embodies duality, relationship, balance of opposites, and the reflective nature of wisdom. The number 2 represents the first division from unity - awareness through reflection.

**Symbolic Synthesis:**
The High Priestess sits at the threshold between opposites (black/white pillars), veiled by pomegranates (hidden wisdom), with the moon at her feet (unconscious mastery). She holds the Torah (divine law/wisdom) partially hidden, suggesting that true wisdom must be accessed through intuition and inner knowing, not just intellectual study. The water behind her represents the unconscious realm she guards and mediates.

The dominant themes are: threshold consciousness, hidden wisdom, intuitive knowing, balance of opposites, and the feminine principle of receptive understanding.

**Interpretive Guidance:**
When reading this card, pay special attention to the veil and pomegranates - they indicate that the wisdom sought is available but requires you to look beyond the obvious, to trust intuition over pure logic. The interplay between the pillars and the veil suggests that accessing this wisdom requires balancing opposites and being willing to sit in the space between.
```

## Important Notes

- Use actual MCP tool data - don't fabricate symbol meanings
- Synthesize multiple symbols into coherent interpretation
- Connect symbols to the specific card's context
- Layer meanings: keyword → general → card-specific → archetypal
- Always tie analysis back to practical reading guidance
- Respect that symbols can have multiple valid interpretations
- Acknowledge cultural and traditional sources of symbolism
