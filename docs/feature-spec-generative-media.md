# Feature Spec: Generative Media for Tableu
## Animated Card Reveals + Story Illustration

---

## Overview

Two AI-powered generative media features that create personalized visual experiences no other tarot app offers:

1. **Animated Card Reveals** — Short video clips of each card "coming alive" with context-aware movement
2. **Story Illustration** — Comic-panel style visual narrative generated from the reading interpretation

---

## Feature 1: Animated Card Reveals

### Concept
When a card is revealed, instead of a static flip, users see a 3-5 second animated clip where the card's imagery comes alive in a way that reflects the reading's context.

### Examples

| Card | Question Context | Animation |
|------|------------------|-----------|
| The Fool | "Should I take this job?" | Figure stepping off cliff, briefcase transforming into wings |
| Death | "Ending a relationship" | Skeleton figure gently closing a door, flowers blooming behind |
| The Tower | "My business is struggling" | Lightning strike reveals golden foundation beneath rubble |
| Three of Cups | "Friendship question" | Three figures raise cups, liquid swirls into heart shape |

### Technical Approach

**Option A: Video Generation Model (Higher Quality)**
- Use Runway Gen-3, Pika, or Kling for 3-5 second clips
- Generate per-card based on: card name + position + question keywords
- Cache common combinations, generate novel ones on-demand
- ~$0.05-0.15 per generation

**Option B: Image-to-Video (Lower Cost)**
- Start with static card image
- Use Stable Video Diffusion or AnimateDiff for subtle motion
- Add particle effects, camera movement, lighting shifts
- ~$0.01-0.03 per generation

**Option C: Pre-rendered + Compositing (Lowest Cost)**
- Pre-render base animations for each card (78 × 2 orientations = 156 clips)
- Composite contextual elements (text overlays, color grading based on reading)
- Near-zero marginal cost after initial generation

### Recommended Approach
**Hybrid**: Pre-render base card animations (Option C), then use lightweight image-to-video (Option B) to add question-specific flourishes for premium users.

### User Flow
```
1. User completes ritual, cards are drawn
2. First card position glows
3. Tap to reveal → 3-5s animated clip plays
4. Card settles into static position
5. Repeat for each card
6. Option to replay any animation
7. Option to save/share animation
```

### Subscription Tiers
| Tier | Animated Reveals |
|------|------------------|
| Free | Static reveals only |
| Plus | Pre-rendered base animations |
| Pro | Context-aware generated animations |

---

## Feature 2: Story Illustration

### Concept
After the AI narrative is generated, create a visual "story" of the reading as comic-panel style illustrations that the user can save, share, or use for meditation.

### Format Options

**A. Triptych (3 panels)**
- Beginning → Middle → End
- Works for any spread size
- Clean, shareable format

**B. Panel-per-Card**
- One illustration per card position
- Shows card's meaning in visual metaphor
- Scrollable vertical comic

**C. Single Scene**
- One panoramic illustration capturing entire reading
- All card energies synthesized into unified image
- Best for meditation/wallpaper use

### Example: Three-Card Story Illustration

**Question**: "How can I improve my relationship with my mother?"

**Cards**: 
- Past: Five of Cups (reversed)
- Present: The Empress
- Future: Ten of Cups

**Generated Triptych**:
1. **Panel 1 (Past)**: Figure turning away from spilled cups, noticing two still standing
2. **Panel 2 (Present)**: Maternal figure in garden, hand extended in invitation
3. **Panel 3 (Future)**: Rainbow over family gathering, cups raised in celebration

**Style Prompt Engineering**:
```
Panel 1: Watercolor style, muted blues and grays, figure in 3/4 view 
turning to look over shoulder, dawn light breaking through clouds, 
symbolic of releasing past grief and recognizing remaining blessings.
Five cups spilled, two upright, reflecting the reversed Five of Cups.
```

### Technical Approach

**Image Generation**:
- DALL-E 3, Midjourney API, or Stable Diffusion XL
- Style-locked prompts for visual consistency across panels
- ~$0.04-0.08 per image (3 panels = $0.12-0.24 per reading)

**Prompt Construction Pipeline**:
```
1. Extract card meanings from narrative
2. Map to visual metaphors (knowledgeBase lookup)
3. Apply consistent style tokens
4. Add user-preference modifiers (art style, color palette)
5. Generate with seed locking for coherent series
```

### Style Options (User Choice)
| Style | Description |
|-------|-------------|
| **Watercolor** | Soft, dreamy, traditional tarot feel |
| **Art Nouveau** | Mucha-inspired, ornate borders |
| **Minimal Line** | Clean black & white, modern |
| **Stained Glass** | Rich colors, geometric, sacred |
| **Cosmic** | Stars, nebulae, ethereal |
| **Personal** | User uploads reference for style transfer |

### User Flow
```
1. Reading narrative completes
2. "Create Story Illustration" button appears
3. User selects format (triptych/panels/scene) and style
4. Loading state with progress (15-30 seconds)
5. Illustration revealed with subtle animation
6. Options: Save to gallery, Share, Set as reading cover, Order print
```

### Sharing & Virality
- One-tap share to Instagram Stories (9:16 format)
- Watermark with subtle Tableu branding
- Deep link back to app for viewers
- "Create your own reading" CTA

### Print-on-Demand Integration (Future)
- Partner with Printful/Gooten
- Order physical prints of story illustrations
- Premium feature, revenue share model

---

## Combined User Journey

```
┌─────────────────────────────────────────────────────────────────┐
│  1. RITUAL                                                       │
│     Question → Knocks → Cut → Seed computed                      │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  2. ANIMATED REVEALS                                             │
│     Each card flips with 3-5s contextual animation               │
│     User taps through at their own pace                          │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  3. AI NARRATIVE                                                 │
│     GraphRAG-powered interpretation with pattern detection       │
│     User reads/listens (TTS)                                     │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  4. STORY ILLUSTRATION                                           │
│     Generate triptych/panels capturing the reading visually      │
│     Save, share, or order print                                  │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  5. JOURNAL                                                      │
│     Reading saved with animation thumbnails + illustration       │
│     Revisit visual story anytime                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Competitive Differentiation

| Feature | Tableu | Labyrinthos | Golden Thread | SnapTarot | Any Other |
|---------|--------|-------------|---------------|-----------|-----------|
| Animated reveals | ✓ Context-aware | ✗ | ✗ | ✗ | ✗ |
| Story illustration | ✓ AI-generated | ✗ | ✗ | ✗ | ✗ |
| Shareable visual narrative | ✓ | ✗ | ✗ | ✗ | ✗ |
| Style customization | ✓ | ✗ | ✗ | ✗ | ✗ |

**This combination does not exist in any App Store tarot app.**

---

## API/Model Options

### Video Generation
| Provider | Model | Cost | Latency | Quality |
|----------|-------|------|---------|---------|
| Runway | Gen-3 Alpha | $0.05/sec | 30-60s | Excellent |
| Pika | Pika 1.0 | $0.04/sec | 20-40s | Good |
| Stability | Stable Video | $0.02/sec | 15-30s | Good |
| Replicate | AnimateDiff | $0.01/sec | 10-20s | Moderate |

### Image Generation
| Provider | Model | Cost | Latency | Quality |
|----------|-------|------|---------|---------|
| OpenAI | DALL-E 3 | $0.04-0.08 | 10-20s | Excellent |
| Midjourney | v6 (via API) | $0.05-0.10 | 15-30s | Excellent |
| Stability | SDXL | $0.01-0.02 | 5-15s | Good |
| Replicate | FLUX | $0.01-0.03 | 5-15s | Very Good |

### Recommended Stack
- **Video**: Replicate AnimateDiff (cost-effective) or Runway Gen-3 (premium)
- **Image**: FLUX via Replicate (best quality/cost ratio) or DALL-E 3 (consistency)

---

## Implementation Phases

### Phase 1: Story Illustration (MVP)
- Single scene generation after reading
- 3 style options (Watercolor, Minimal, Cosmic)
- Save to journal
- 2-3 weeks development

### Phase 2: Animated Reveals (Base)
- Pre-render 156 base animations (78 cards × 2 orientations)
- Simple flip + settle animation
- 2 weeks for generation + integration

### Phase 3: Context-Aware Animation
- Add lightweight motion based on question keywords
- Premium tier only
- 2 weeks development

### Phase 4: Full Story Panels
- Triptych and panel-per-card formats
- Style transfer from user uploads
- Share to social with deep links
- 3 weeks development

---

## Cost Projections (Per Reading)

| Tier | Animated Reveals | Story Illustration | Total |
|------|------------------|-------------------|-------|
| Free | None | None | $0.00 |
| Plus | Pre-rendered | 1 scene (cached) | ~$0.02 |
| Pro | Context-aware | 3-panel triptych | ~$0.15-0.25 |

At 10,000 Pro readings/month: $1,500-2,500 generation costs

---

## App Store Appeal Value

This feature directly addresses Apple's 4.3(b) rejection:

> "These features represent a genuinely novel experience in the tarot category: AI-generated animated card reveals that respond to the user's specific question context, and personalized story illustrations that transform each reading into shareable visual art. No existing App Store application offers generative media integration with tarot readings."

---

## Open Questions

1. **Caching strategy** — How aggressively to cache generated content?
2. **Moderation** — Content policy for generated images (avoid disturbing imagery)?
3. **Offline support** — Pre-download animations for offline use?
4. **User uploads** — Allow custom style references? Copyright concerns?
5. **Platform limits** — Video autoplay policies on iOS?

---

## Next Steps

1. [ ] Prototype story illustration with FLUX/DALL-E
2. [ ] Design prompt templates for each Major Arcana
3. [ ] Create 5 sample animated reveals manually (test concept)
4. [ ] User research: Would this feature drive upgrades?
5. [ ] Cost modeling at scale
6. [ ] Resubmit to App Store with feature in TestFlight
