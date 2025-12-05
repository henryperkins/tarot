# Onboarding Illustrations Integration Specification

Based on analysis of the onboarding wizard components and user flow, this document identifies all areas where original custom illustrations could be integrated to enhance the first-time user experience.

---

## Overview

The Onboarding Wizard currently uses:

- Phosphor Icons for UI elements (Moon, Star, Sparkle, Hand, Scissors, etc.)
- Spread artwork images imported from `selectorimages/` (onecard.png, 3card.png, decision.png)
- Simple icon clusters for visual interest
- Gradient backgrounds with subtle radial overlays

Custom illustrations would create a more immersive, memorable first impression while teaching users about tarot in a visually engaging way.

**Component Files:**

- [`src/components/onboarding/OnboardingWizard.jsx`](src/components/onboarding/OnboardingWizard.jsx)
- [`src/components/onboarding/WelcomeHero.jsx`](src/components/onboarding/WelcomeHero.jsx)
- [`src/components/onboarding/AccountSetup.jsx`](src/components/onboarding/AccountSetup.jsx)
- [`src/components/onboarding/SpreadEducation.jsx`](src/components/onboarding/SpreadEducation.jsx)
- [`src/components/onboarding/QuestionCrafting.jsx`](src/components/onboarding/QuestionCrafting.jsx)
- [`src/components/onboarding/RitualIntro.jsx`](src/components/onboarding/RitualIntro.jsx)
- [`src/components/onboarding/JournalIntro.jsx`](src/components/onboarding/JournalIntro.jsx)
- [`src/components/onboarding/JourneyBegin.jsx`](src/components/onboarding/JourneyBegin.jsx)
- [`src/components/onboarding/OnboardingProgress.jsx`](src/components/onboarding/OnboardingProgress.jsx)

---

## Integration Areas by Priority

### 🎯 HIGH PRIORITY

#### 1. Welcome Hero Illustration

**Location:** [`src/components/onboarding/WelcomeHero.jsx`](src/components/onboarding/WelcomeHero.jsx:29-52)

**Current state:** Phosphor icon cluster (Moon, Star, Sparkle) arranged manually

```jsx
// Current implementation (lines 35-50)
<Moon className="w-16 h-16 sm:w-20 sm:h-20 text-accent" weight="duotone" />
<Star className="absolute -top-2 -right-2 w-6 h-6 sm:w-8 sm:h-8 text-gold" weight="fill" />
<Sparkle className="absolute -bottom-1 -left-3 w-5 h-5 sm:w-6 sm:h-6 text-primary" weight="fill" />
```

**Proposed:** Full custom hero illustration of a mystical scene

**Design concept:**

- Crescent moon cradling a single tarot card
- Stars and constellations flowing around
- Soft glow effects emanating from the card
- Subtle hand reaching toward the card (invitation gesture)

**Dimensions:** ~320×200px (responsive)

**Files to modify:**

- `src/components/onboarding/WelcomeHero.jsx` (lines 29-52)
- Create: `public/images/illustrations/onboarding/welcome-hero.svg`

---

#### 2. Ritual Step Illustrations (Knock & Cut)

**Location:** [`src/components/onboarding/RitualIntro.jsx`](src/components/onboarding/RitualIntro.jsx:55-110)

**Current state:** Phosphor icons (Hand, Scissors) inside circular badges

```jsx
// Current (lines 63-64)
<Hand className="w-6 h-6 text-accent" weight="duotone" />
// and (lines 91-92)
<Scissors className="w-6 h-6 text-accent" weight="duotone" />
```

**Proposed:** Custom illustrated cards showing the ritual actions

| Step      | Illustration Concept                                                                        |
| --------- | ------------------------------------------------------------------------------------------- |
| **Knock** | Hand gently touching deck surface, energy ripples emanating outward, cards subtly shuffling |
| **Cut**   | Deck being split in two, intuitive "energy line" showing the cut point, cards separating    |

**Design notes:**

- Show the deck from a 3/4 perspective
- Include motion lines/energy trails
- Warm amber/gold glow effects
- Each illustration: ~200×150px

**Files to modify:**

- `src/components/onboarding/RitualIntro.jsx` (lines 55-82, 83-110)
- Create: `public/images/illustrations/onboarding/ritual-knock.svg`
- Create: `public/images/illustrations/onboarding/ritual-cut.svg`

---

#### 3. Journey Begin Celebration Scene

**Location:** [`src/components/onboarding/JourneyBegin.jsx`](src/components/onboarding/JourneyBegin.jsx:62-85)

**Current state:** Phosphor Star and Sparkle icons

```jsx
// Current (lines 69-83)
<Star className="text-gold w-20 h-20 sm:w-24 sm:h-24" weight="duotone" />
<Sparkle className="absolute -top-2 -right-1 w-6 h-6 text-accent" weight="fill" />
<Sparkle className="absolute bottom-0 -left-3 w-5 h-5 text-primary" weight="fill" />
```

**Proposed:** Triumphant illustration marking the beginning of the user's journey

**Design concept:**

- Portal/doorway opening with light streaming through
- Path extending into mystical landscape
- Cards forming an archway or floating around the portal
- User's chosen spread type subtly visible through the portal

**Dimensions:** ~280×200px (responsive)

**Files to modify:**

- `src/components/onboarding/JourneyBegin.jsx` (lines 62-85)
- Create: `public/images/illustrations/onboarding/journey-portal.svg`

---

#### 4. Question Crafting Visual Aid

**Location:** [`src/components/onboarding/QuestionCrafting.jsx`](src/components/onboarding/QuestionCrafting.jsx:162-215)

**Current state:** Text-based tips with simple checkmark/X icons

**Proposed:** Visual "question quality" illustration that evolves

**Design concept:**

- Low quality: Foggy crystal ball, unclear image
- Medium quality: Crystal ball clearing, shapes forming
- High quality: Crystal clear ball showing vivid imagery

Alternative concept: A flowering plant that blooms as question quality improves

**Implementation approach:**

- Three-state SVG or layered illustration
- Opacity/visibility controlled by quality score
- Smooth CSS transitions between states

**Files to modify:**

- `src/components/onboarding/QuestionCrafting.jsx` (above line 162)
- Create: `public/images/illustrations/onboarding/question-quality-low.svg`
- Create: `public/images/illustrations/onboarding/question-quality-mid.svg`
- Create: `public/images/illustrations/onboarding/question-quality-high.svg`

---

### 🔶 MEDIUM PRIORITY

#### 5. Progress Step Icons

**Location:** [`src/components/onboarding/OnboardingProgress.jsx`](src/components/onboarding/OnboardingProgress.jsx:4-12)

**Current state:** Numbers and checkmarks in circles

```js
// Current step labels (lines 4-12)
const STEP_LABELS = [
  "Welcome", // Could be: Moon/Star
  "Account", // Could be: Key/User silhouette
  "Spreads", // Could be: Fanned cards
  "Question", // Could be: Question mark with sparkle
  "Ritual", // Could be: Hands on deck
  "Journal", // Could be: Open book
  "Begin", // Could be: Sunrise/Portal
];
```

**Proposed:** Custom mini icons for each step (16×16px or 20×20px)

| Step     | Icon Concept                           |
| -------- | -------------------------------------- |
| Welcome  | Crescent moon with star                |
| Account  | Mystical key or lock                   |
| Spreads  | Three cards fanned                     |
| Question | Crystal ball / speech bubble with star |
| Ritual   | Hand touching surface                  |
| Journal  | Open book with quill                   |
| Begin    | Rising sun / doorway                   |

**Files to modify:**

- `src/components/onboarding/OnboardingProgress.jsx` (lines 61-65, 109-114)
- Create: `src/components/illustrations/OnboardingStepIcons.jsx`

---

#### 6. Journal Introduction Visual

**Location:** [`src/components/onboarding/JournalIntro.jsx`](src/components/onboarding/JournalIntro.jsx:57-73)

**Current state:** Basic Notebook icon with Sparkle decoration

```jsx
// Current (lines 62-71)
<div className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl bg-gradient-to-br...">
  <Notebook
    className="w-12 h-12 sm:w-14 sm:h-14 text-accent"
    weight="duotone"
  />
</div>
```

**Proposed:** Rich illustration showing the journal's value

**Design concept:**

- Open journal with pages showing card sketches
- Floating cards connecting to journal entries via luminous threads
- Timeline/calendar element showing passage of time
- Patterns and insights emerging from the pages

**Dimensions:** ~200×180px

**Files to modify:**

- `src/components/onboarding/JournalIntro.jsx` (lines 57-73)
- Create: `public/images/illustrations/onboarding/journal-preview.svg`

---

#### 7. Account Benefits Visual Icons

**Location:** [`src/components/onboarding/AccountSetup.jsx`](src/components/onboarding/AccountSetup.jsx:129-157)

**Current state:** Checkmark bullets with text

```jsx
// Current (lines 143-155)
<Check className="w-4 h-4 text-accent shrink-0" weight="bold" />
<span>Sync your readings across devices</span>
```

**Proposed:** Custom illustrated icons for each benefit

| Benefit             | Icon Concept                             |
| ------------------- | ---------------------------------------- |
| Sync across devices | Devices connected by constellation lines |
| Track patterns      | Graph/chart with mystical curve          |
| Never lose insights | Shield with eye/star inside              |

**Dimensions:** 40×40px each

**Files to modify:**

- `src/components/onboarding/AccountSetup.jsx` (lines 136-156)
- Create: `src/components/illustrations/AccountBenefitIcons.jsx`

---

#### 8. Spread Education Enhancements

**Location:** [`src/components/onboarding/SpreadEducation.jsx`](src/components/onboarding/SpreadEducation.jsx:134-149)

**Current state:** Uses existing spread artwork from `selectorimages/`

**Proposed enhancements:**

1. **Position indicator overlays**: Add subtle numbered position markers that appear on hover/expand
2. **Element/suit symbols**: Add small decorative elements showing associated energies
3. **Animated card reveal**: Show cards "flipping" into position on selection

**Design notes:**

- Keep existing artwork, enhance with overlays
- Use semi-transparent overlays with gold accent lines
- Position numbers should integrate with existing art style

**Files to modify:**

- `src/components/onboarding/SpreadEducation.jsx` (lines 134-149)
- Create: `public/images/illustrations/onboarding/spread-overlay-3card.svg`
- Create: `public/images/illustrations/onboarding/spread-overlay-decision.svg`

---

### 🔵 LOWER PRIORITY (Enhancement)

#### 9. Key Principles Illustrations

**Location:** [`src/components/onboarding/WelcomeHero.jsx`](src/components/onboarding/WelcomeHero.jsx:93-120)

**Current state:** Phosphor icons (Eye, Path, Lightbulb) in circular badges

```jsx
// Current (lines 102-104)
<Eye className="w-5 h-5 text-accent" weight="duotone" />
// And similar for Path, Lightbulb
```

**Proposed:** Custom illustrated symbols

| Principle             | Illustration                 |
| --------------------- | ---------------------------- |
| Reflect & explore     | Eye looking into mirror/pool |
| Embrace free will     | Branching paths with stars   |
| Follow what resonates | Heart/lightbulb with rays    |

**Dimensions:** 32×32px each

**Files to create:**

- `src/components/illustrations/PrincipleIcons.jsx`

---

#### 10. Experience Level Visual Selection

**Location:** [`src/components/onboarding/WelcomeHero.jsx`](src/components/onboarding/WelcomeHero.jsx:149-174)

**Current state:** Text-only button chips

```jsx
// Current options (lines 6-10)
const EXPERIENCE_OPTIONS = [
  { value: "newbie", label: "Brand new" },
  { value: "intermediate", label: "I know the basics" },
  { value: "experienced", label: "Pretty experienced" },
];
```

**Proposed:** Visual icons accompanying each level

| Level       | Visual                             |
| ----------- | ---------------------------------- |
| Brand new   | Single card, curious expression    |
| Know basics | Three cards spread                 |
| Experienced | Full spread with confident gesture |

**Files to modify:**

- `src/components/onboarding/WelcomeHero.jsx` (lines 149-174)
- Create: `src/components/illustrations/ExperienceLevelIcons.jsx`

---

#### 11. Reading Tone/Frame Visual Selection

**Location:** [`src/components/onboarding/QuestionCrafting.jsx`](src/components/onboarding/QuestionCrafting.jsx:237-300)

**Current state:** Text-only chips for tone and spiritual frame

**Proposed:** Small character/mood illustrations

| Tone     | Visual                      |
| -------- | --------------------------- |
| Gentle   | Soft-faced moon, comforting |
| Balanced | Scale balanced with stars   |
| Blunt    | Direct eye, honest          |

| Frame         | Visual               |
| ------------- | -------------------- |
| Psychological | Brain with pathways  |
| Spiritual     | Third eye/lotus      |
| Mixed         | Yin-yang style blend |
| Playful       | Winking star/sparkle |

**Dimensions:** 24×24px each

**Files to create:**

- `src/components/illustrations/ToneFrameIcons.jsx`

---

#### 12. Background Patterns

**Location:** [`src/components/onboarding/OnboardingWizard.jsx`](src/components/onboarding/OnboardingWizard.jsx:211-222)

**Current state:** CSS radial gradients only

```jsx
// Current (lines 214-219)
background: `
  radial-gradient(ellipse at 20% 0%, rgba(244, 207, 150, 0.08) 0%, transparent 50%),
  radial-gradient(ellipse at 80% 100%, rgba(169, 146, 255, 0.06) 0%, transparent 50%),
  radial-gradient(ellipse at 50% 50%, rgba(240, 143, 177, 0.04) 0%, transparent 60%)
`;
```

**Proposed:** Subtle illustrated background pattern layer

**Design concept:**

- Very faint constellation map (opacity: 2-3%)
- Sacred geometry grid overlay
- Different patterns for different steps (optional)

**Implementation:**

```css
.onboarding-modal::before {
  content: "";
  position: absolute;
  inset: 0;
  background-image: url("/images/patterns/constellation-grid.svg");
  background-size: 400px;
  opacity: 0.025;
  pointer-events: none;
}
```

**Files to create:**

- `public/images/patterns/constellation-grid.svg`
- Modify: `src/styles/tarot.css` or component inline

---

## Illustration Style Guide

### Color Palette

```
Primary Gold:     #e5c48e (accent, highlights)
Warm Gold:        #f4cf96 (glows, warm touches)
Deep Purple:      #a992ff (spiritual elements)
Soft Pink:        #f08fb1 (heart/relationships)
Cyan:             #6fe0ff (clarity, insight)
Surface Dark:     #0f0c13 (backgrounds)
Muted Text:       #9ca3af (secondary elements)
```

### Visual Principles

1. **Warmth over mystery:** Onboarding should feel inviting, not intimidating
2. **Progressive disclosure:** Illustrations should reveal detail as user progresses
3. **Consistent perspective:** 3/4 view for card illustrations
4. **Glow effects:** Soft outer glows, never harsh
5. **Animation:** Subtle entrance animations, respect `prefers-reduced-motion`
6. **Cultural sensitivity:** Avoid specific religious symbols; use universal mystical imagery

### Character Guidelines

If using any figurative elements:

- Abstract/stylized, not realistic
- Gender-neutral hands/silhouettes
- Diverse skin tone suggestions through color variation
- Focus on gesture and energy, not facial features

### File Organization

```
public/
└── images/
    └── illustrations/
        └── onboarding/
            ├── welcome-hero.svg
            ├── ritual-knock.svg
            ├── ritual-cut.svg
            ├── journey-portal.svg
            ├── journal-preview.svg
            ├── question-quality-low.svg
            ├── question-quality-mid.svg
            ├── question-quality-high.svg
            └── spread-overlays/
                ├── overlay-single.svg
                ├── overlay-3card.svg
                └── overlay-decision.svg

src/
└── components/
    └── illustrations/
        ├── OnboardingStepIcons.jsx
        ├── AccountBenefitIcons.jsx
        ├── PrincipleIcons.jsx
        ├── ExperienceLevelIcons.jsx
        └── ToneFrameIcons.jsx
```

---

## Implementation Phases

### Phase 1: Hero Moments (Week 1)

- [ ] Welcome hero illustration
- [ ] Journey begin portal illustration
- [ ] Ritual knock & cut illustrations

### Phase 2: Educational Visuals (Week 2)

- [ ] Question quality evolution illustrations
- [ ] Journal preview illustration
- [ ] Spread overlay enhancements

### Phase 3: Micro-Illustrations (Week 3)

- [ ] Progress step icons
- [ ] Account benefit icons
- [ ] Key principles icons

### Phase 4: Polish & Animation (Week 4)

- [ ] Experience level visuals
- [ ] Tone/frame selection icons
- [ ] Background patterns
- [ ] Entrance animations and transitions

---

## Component Integration Example

```jsx
// src/components/illustrations/WelcomeHeroIllustration.jsx
import { useReducedMotion } from "../../hooks/useReducedMotion";

export function WelcomeHeroIllustration({ className = "" }) {
  const prefersReducedMotion = useReducedMotion();

  return (
    <div className={`relative ${className}`}>
      <img
        src="/images/illustrations/onboarding/welcome-hero.svg"
        alt=""
        role="presentation"
        className={`
          w-full max-w-xs mx-auto
          ${prefersReducedMotion ? "" : "animate-float-gentle"}
        `}
      />
      {/* Optional: Animated sparkle overlays */}
      {!prefersReducedMotion && (
        <div className="absolute inset-0 pointer-events-none">
          <span className="absolute top-4 right-8 w-2 h-2 bg-gold rounded-full animate-twinkle" />
          <span className="absolute bottom-6 left-12 w-1.5 h-1.5 bg-accent rounded-full animate-twinkle-delayed" />
        </div>
      )}
    </div>
  );
}

// Usage in WelcomeHero.jsx (replace lines 29-52)
import { WelcomeHeroIllustration } from "../illustrations/WelcomeHeroIllustration";

// In render:
<WelcomeHeroIllustration className={`mb-6 ${isLandscape ? "mb-4" : "mb-8"}`} />;
```

### CSS Animation Classes

```css
/* Add to src/styles/tarot.css */
@keyframes float-gentle {
  0%,
  100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-8px);
  }
}

@keyframes twinkle {
  0%,
  100% {
    opacity: 0.3;
    transform: scale(1);
  }
  50% {
    opacity: 1;
    transform: scale(1.2);
  }
}

.animate-float-gentle {
  animation: float-gentle 4s ease-in-out infinite;
}

.animate-twinkle {
  animation: twinkle 2s ease-in-out infinite;
}

.animate-twinkle-delayed {
  animation: twinkle 2s ease-in-out infinite 0.5s;
}

@media (prefers-reduced-motion: reduce) {
  .animate-float-gentle,
  .animate-twinkle,
  .animate-twinkle-delayed {
    animation: none;
  }
}
```

---

## Accessibility Considerations

1. All decorative illustrations use `role="presentation"` and empty `alt=""`
2. Informational icons include descriptive `aria-label`
3. Animations respect `prefers-reduced-motion` via `useReducedMotion()` hook
4. Color is never the only indicator of state (always paired with text/shape)
5. Interactive elements maintain 44×44px minimum touch targets
6. Focus states remain visible over illustrated backgrounds
7. SVGs include `<title>` elements where meaningful for screen readers

---

## Responsive Considerations

### Landscape Mode Handling

The onboarding components already detect landscape via `useLandscape()`. Illustrations should:

- Scale down or simplify in landscape mode
- Maintain aspect ratio without distorting
- Consider horizontal layouts for side-by-side viewing

```jsx
// Example landscape adaptation
const isLandscape = useLandscape();

<WelcomeHeroIllustration
  className={isLandscape ? "max-w-[200px]" : "max-w-xs"}
/>;
```

### Small Screen Handling

Components use `useSmallScreen()` hook. For very small screens:

- Reduce illustration dimensions by ~25%
- Consider hiding secondary decorative elements
- Ensure critical illustrations remain visible and centered

---

## Related Files Reference

| Component          | File Path                                          | Lines to Modify  | Priority |
| ------------------ | -------------------------------------------------- | ---------------- | -------- |
| Welcome Hero       | `src/components/onboarding/WelcomeHero.jsx`        | 29-52, 93-120    | High     |
| Account Setup      | `src/components/onboarding/AccountSetup.jsx`       | 136-156          | Medium   |
| Spread Education   | `src/components/onboarding/SpreadEducation.jsx`    | 134-149          | Medium   |
| Question Crafting  | `src/components/onboarding/QuestionCrafting.jsx`   | 162-215, 237-300 | High     |
| Ritual Intro       | `src/components/onboarding/RitualIntro.jsx`        | 55-110           | High     |
| Journal Intro      | `src/components/onboarding/JournalIntro.jsx`       | 57-73            | Medium   |
| Journey Begin      | `src/components/onboarding/JourneyBegin.jsx`       | 62-85            | High     |
| Progress Indicator | `src/components/onboarding/OnboardingProgress.jsx` | 61-65, 109-114   | Medium   |
| Wizard Background  | `src/components/onboarding/OnboardingWizard.jsx`   | 211-222          | Low      |

---

## Success Metrics

After implementing illustrations, measure:

1. **Completion rate**: Do more users complete onboarding?
2. **Time per step**: Do users spend appropriate time (not rushing, not stuck)?
3. **Return engagement**: Do onboarded users return for more readings?
4. **User feedback**: Qualitative responses about onboarding experience
5. **Accessibility compliance**: Ensure WCAG AA standards maintained

---

_Document created: 2025-12-05_
_Last updated: 2025-12-05_
_Related: [CUSTOM_ILLUSTRATIONS_SPEC.md](CUSTOM_ILLUSTRATIONS_SPEC.md) (Journal illustrations)_
