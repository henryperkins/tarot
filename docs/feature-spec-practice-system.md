# Feature Spec: Tarot Practice System
## "Fitness App for Self-Reflection"

Type: spec
Status: active background document
Last reviewed: 2026-04-23

---

## Core Concept

Reposition Tableu from "tarot reading app" to **"guided self-reflection practice app"** that uses tarot archetypes as a framework—similar to how fitness apps use exercise science.

| Fitness App | Tableu |
|-------------|--------|
| Suggests exercises based on goals | Suggests practices based on cards drawn |
| Video demonstrations of movements | Video demonstrations of reflective practices |
| Tracks reps, sets, progress | Tracks practice completion, streaks, growth |
| Progressive programs | Archetypal journey progression |
| Rest days | Integration periods |

---

## The Practice Library

Each of the 78 cards has associated **practices** across multiple modalities:

### Practice Categories

| Category | Description | Duration | Example |
|----------|-------------|----------|---------|
| **Breathwork** | Breathing patterns that embody the card's energy | 3-10 min | Box breathing for The Emperor (structure) |
| **Meditation** | Guided visualization/contemplation | 5-15 min | Shadow integration for The Devil |
| **Journaling** | Reflective writing prompts | 10-20 min | "What am I ready to release?" for Death |
| **Movement** | Gentle somatic practices, yoga-inspired | 5-15 min | Heart-opening stretches for The Empress |
| **Ritual** | Symbolic actions for integration | 5-10 min | Candle lighting for The Star (hope) |
| **Creative** | Art, music, or expression exercises | 15-30 min | Collage for The Moon (exploring unconscious) |

### Example: The Tower (Card XVI)

```yaml
card: The Tower
theme: Sudden change, necessary destruction, revelation
practices:
  breathwork:
    name: "Release Breath"
    duration: 5 min
    description: "Forceful exhales releasing what no longer serves"
    video_id: "tower-breath-001"
    
  meditation:
    name: "Rubble to Foundation"
    duration: 10 min  
    description: "Visualize destruction clearing space for rebuilding"
    video_id: "tower-meditation-001"
    
  journaling:
    prompts:
      - "What structure in my life is ready to fall?"
      - "What truth am I avoiding that would set me free?"
      - "When has destruction led to liberation in my past?"
    duration: 15 min
    
  movement:
    name: "Shake & Release"
    duration: 8 min
    description: "Somatic shaking to release tension, followed by stillness"
    video_id: "tower-movement-001"
    
  ritual:
    name: "Controlled Burn"
    duration: 5 min
    description: "Write what you're releasing, safely burn the paper"
    video_id: "tower-ritual-001"
    materials: ["paper", "pen", "fireproof container", "matches"]
```

---

## Video Content Strategy

### Production Approach

**Option A: Original Production**
- Hire instructor(s) for breathwork, meditation, movement
- Film in consistent setting (calm, minimal, sacred feel)
- 78 cards × 5 practices × avg 8 min = ~52 hours of content
- High quality, fully owned IP
- Cost: $30-50K for initial library

**Option B: AI-Generated Guides**
- Use HeyGen/Synthesia for guided audio with avatar
- Stock footage + motion graphics for movement demos
- Lower cost, faster iteration
- Cost: $5-10K for initial library

**Option C: Hybrid**
- Original video for movement/breathwork (needs real demonstration)
- AI avatar for meditation voiceover
- Motion graphics for ritual/journaling guidance
- Cost: $15-25K

**Recommended: Option C (Hybrid)**

### Video Specifications

| Type | Format | Length | Style |
|------|--------|--------|-------|
| Breathwork | Instructor demo + timer overlay | 3-10 min | Calm, focused on breath cues |
| Meditation | Audio + ambient visuals or avatar | 5-15 min | Ethereal, card imagery woven in |
| Movement | Full-body instructor demo | 5-15 min | Yoga-studio feel, clear form |
| Ritual | Step-by-step walkthrough | 3-8 min | Warm, inviting, materials shown |
| Journaling | Prompts on screen + soft music | Timer only | Minimal, space for reflection |

---

## User Experience Flow

### After Reading: Practice Recommendations

```
┌─────────────────────────────────────────────────────────────────┐
│  READING COMPLETE                                                │
│                                                                  │
│  Your cards suggest these practices:                             │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ 🌬️ BREATHWORK                              5 min        │    │
│  │ "Release Breath" for The Tower                          │    │
│  │ [Start Practice]                                        │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ 📝 JOURNALING                              15 min       │    │
│  │ 3 prompts for Death + Tower combination                 │    │
│  │ [Start Practice]                                        │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ 🧘 MOVEMENT                                 8 min        │    │
│  │ "Shake & Release" somatic practice                      │    │
│  │ [Start Practice]                                        │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
│  [Save Reading]  [Skip Practices]  [Schedule for Later]          │
└─────────────────────────────────────────────────────────────────┘
```

### Practice Player Screen

```
┌─────────────────────────────────────────────────────────────────┐
│  ← Back                              The Tower: Release Breath   │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│                    ┌───────────────────────┐                     │
│                    │                       │                     │
│                    │    VIDEO PLAYER       │                     │
│                    │                       │                     │
│                    │   Instructor demo     │                     │
│                    │   with breath cues    │                     │
│                    │                       │                     │
│                    └───────────────────────┘                     │
│                                                                  │
│                         2:34 / 5:00                              │
│                    ●━━━━━━━━━━━━━━━━━━━○                         │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ INHALE deeply through your nose...                      │    │
│  │ hold at the top... and EXHALE forcefully,               │    │
│  │ releasing what no longer serves you.                    │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
│           [Pause]    [Restart]    [Mark Complete]                │
└─────────────────────────────────────────────────────────────────┘
```

---

## Practice Tracking & Gamification

### Progress Dashboard

```
┌─────────────────────────────────────────────────────────────────┐
│  YOUR PRACTICE JOURNEY                                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  This Week                                                       │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━                       │
│  Mon  Tue  Wed  Thu  Fri  Sat  Sun                               │
│   ●    ●    ○    ●    ○    ○    ○                                │
│                                                                  │
│  Practices Completed: 12                                         │
│  Total Time: 1h 47m                                              │
│  Current Streak: 3 days                                          │
│                                                                  │
│  ─────────────────────────────────────────────────────────────   │
│                                                                  │
│  PRACTICE BREAKDOWN                                              │
│  🌬️ Breathwork    ████████░░  8 sessions                         │
│  📝 Journaling    ██████░░░░  6 sessions                         │
│  🧘 Movement      ████░░░░░░  4 sessions                         │
│  🕯️ Ritual        ██░░░░░░░░  2 sessions                         │
│  🧠 Meditation    ██░░░░░░░░  2 sessions                         │
│                                                                  │
│  ─────────────────────────────────────────────────────────────   │
│                                                                  │
│  CARDS YOU'VE WORKED WITH                                        │
│  The Tower (5 practices) • Death (4) • The Star (3)              │
│  The Hermit (2) • Eight of Cups (2)                              │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Achievements / Badges

| Badge | Criteria | Icon |
|-------|----------|------|
| First Breath | Complete first breathwork | 🌬️ |
| Shadow Worker | Complete 5 practices for "shadow" cards (Devil, Moon, Tower) | 🌑 |
| Daily Practice | 7-day streak | 🔥 |
| Major Journey | Practice with all 22 Major Arcana | ⭐ |
| Element Master | Complete practices for all 4 suits | 🌍🔥💨💧 |
| Integration | Complete full practice set for one card | 🔮 |
| Century | 100 practices completed | 💯 |

---

## Smart Recommendations

### Context-Aware Practice Selection

The system recommends practices based on:

1. **Cards in reading** — Direct card-to-practice mapping
2. **Time available** — User sets preferred duration
3. **Modality preference** — Learn user's preferred practice types
4. **Time of day** — Energizing practices AM, calming PM
5. **Emotional state** — Optional mood check-in
6. **Recent practice history** — Vary modalities, don't repeat

### Example Algorithm

```javascript
function recommendPractices(reading, userPrefs, timeAvailable) {
  const candidates = [];
  
  // Weight by card significance (Major > Court > Pip)
  for (const card of reading.cards) {
    const practices = getPracticesForCard(card);
    for (const practice of practices) {
      candidates.push({
        practice,
        score: calculateScore(practice, card, userPrefs, timeAvailable)
      });
    }
  }
  
  // Combine practices for multi-card patterns
  const patterns = detectPatterns(reading.cards);
  for (const pattern of patterns) {
    candidates.push({
      practice: getCombinedPractice(pattern),
      score: pattern.significance * 1.5 // Boost pattern-specific practices
    });
  }
  
  // Filter by time, sort by score, ensure variety
  return selectDiverseSet(candidates, timeAvailable);
}
```

---

## Scheduled Practices

### "Practice Plan" Feature

Users can schedule practices for later:

```
┌─────────────────────────────────────────────────────────────────┐
│  SCHEDULE PRACTICE                                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  "Release Breath" for The Tower                                  │
│                                                                  │
│  When would you like to practice?                                │
│                                                                  │
│  ○ Tomorrow morning (7:00 AM)                                    │
│  ○ Tomorrow evening (7:00 PM)                                    │
│  ○ This weekend                                                  │
│  ○ Custom time...                                                │
│                                                                  │
│  ☑️ Send reminder notification                                   │
│                                                                  │
│  [Schedule]                                                      │
└─────────────────────────────────────────────────────────────────┘
```

### Daily Practice Notification

> 🔮 **Your Tower practice awaits**
> "Release Breath" — 5 minutes to let go of what no longer serves.
> [Start Now]

---

## Integration with Existing Features

### Journal Entries
- Practices completed are logged with reading
- Journaling responses saved to journal entry
- Reflection prompts after practice completion

### Archetype Journey
- Practice completion counts toward card mastery
- "Cards Practiced" as new tracking dimension
- Badges for deep work with specific archetypes

### Pattern Detection
- Combined practices for detected triads/dyads
- "Healing Arc Meditation" for Death + Temperance + Star
- "Shadow Integration" practice for Devil + Tower

---

## Content Roadmap

### Phase 1: MVP (4-6 weeks)
- 22 Major Arcana × 2 practices each = 44 practices
- Focus on Breathwork + Journaling (no video production needed initially)
- Audio-guided meditations (can use TTS initially)
- Basic tracking (completed/not completed)

### Phase 2: Video Content (8-12 weeks)
- Produce movement videos for Major Arcana
- Add ritual demonstration videos
- Upgrade meditation to guided video

### Phase 3: Full Library (Ongoing)
- Expand to Minor Arcana (56 cards)
- Multiple practices per category per card
- User-generated practice submissions
- Expert instructor partnerships

### Phase 4: Social & Programs
- Structured multi-week programs ("Tower Month", "Fool's Journey")
- Group challenges
- Instructor-led live sessions

---

## Monetization

| Tier | Access |
|------|--------|
| **Free** | 1 practice per reading, journaling prompts only |
| **Plus** | Full practice library, basic tracking |
| **Pro** | Video content, advanced tracking, programs, downloads |

---

## App Store Positioning

### New Category
**Primary:** Health & Fitness
**Secondary:** Lifestyle

### New Subtitle
`Guided Self-Reflection Practice`

### Key Differentiator Statement

> "Tableu is the first app to combine tarot archetypes with structured practice exercises. Like a fitness app for self-reflection—complete with video demonstrations, progress tracking, and personalized recommendations based on your readings."

---

## Competitive Analysis

| App | Card Readings | Guided Practices | Video Demos | Progress Tracking |
|-----|---------------|------------------|-------------|-------------------|
| Tableu | ✓ | ✓ | ✓ | ✓ |
| Labyrinthos | ✓ | ✗ | ✗ | Learning only |
| Golden Thread | ✓ | ✗ | ✗ | Journal only |
| Headspace | ✗ | ✓ | ✓ | ✓ |
| Calm | ✗ | ✓ | ✓ | ✓ |

**Tableu = Headspace meets Tarot**

No other app combines archetypal card work with structured practice exercises and video guidance.

---

## Technical Implementation

### Data Model

```javascript
// Practice definition
{
  id: "tower-breath-001",
  cardNumber: 16,
  cardName: "The Tower",
  category: "breathwork",
  title: "Release Breath",
  description: "Forceful exhales releasing what no longer serves",
  duration: 300, // seconds
  difficulty: "beginner",
  videoUrl: "https://cdn.tableu.app/practices/tower-breath-001.mp4",
  audioUrl: "https://cdn.tableu.app/practices/tower-breath-001.mp3",
  transcript: "...",
  cues: [
    { time: 30, text: "Inhale deeply..." },
    { time: 35, text: "Hold at the top..." },
    { time: 40, text: "Exhale forcefully..." }
  ]
}

// User practice log
{
  id: "uuid",
  userId: "user-123",
  practiceId: "tower-breath-001",
  readingId: "reading-456", // optional, links to originating reading
  completedAt: "2026-02-03T14:00:00Z",
  duration: 312, // actual time spent
  journalResponse: "...", // if journaling practice
  rating: 4, // user feedback
  notes: "Felt releasing..."
}
```

### API Endpoints

```
GET  /api/practices/:cardNumber       — Get practices for a card
GET  /api/practices/recommend         — Get personalized recommendations
POST /api/practices/log               — Log practice completion
GET  /api/practices/history           — User's practice history
GET  /api/practices/stats             — Aggregated practice stats
```

### Video Hosting
- Cloudflare Stream or Mux for adaptive bitrate
- Offline download for Pro users
- CDN caching for fast global delivery

---

## Next Steps

1. [ ] Design practice data schema
2. [ ] Write journaling prompts for 22 Major Arcana
3. [ ] Create breathwork audio guides (TTS or recorded)
4. [ ] Build practice player component
5. [ ] Implement basic tracking
6. [ ] User test with 5-10 beta users
7. [ ] Plan video production for Phase 2
