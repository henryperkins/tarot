---
name: "Tableu"
description: "The Midnight Reading Room — a contemplative, scholarly, intimate tarot interface."
colors:
  candlelit-brass: "#D4B896"
  quiet-taupe: "#A89D92"
  pale-candlelight: "#E8DAC3"
  midnight-ink: "#0F0E13"
  reading-surface: "#1C1A22"
  muted-reading-surface: "#2A2730"
  moonlit-paper: "#E8E6E3"
  softened-paper: "#CCC5B9"
  daylight-paper: "#FAFAFA"
  daylight-surface: "#FFFFFF"
  daylight-muted-surface: "#F5F5F5"
  daylight-ink: "#1A1A1A"
  daylight-muted-ink: "#555555"
  aged-brass: "#7D623B"
  daylight-taupe: "#6A5746"
  daylight-candlelight: "#8A6B3B"
  success-sage: "#6B9E78"
  warning-amber: "#F59E0B"
  error-rose: "#C97676"
  wands-gold: "#C9A876"
  cups-silver-blue: "#8B95A5"
  swords-steel: "#6B7280"
  pentacles-sage: "#8A9985"
typography:
  display:
    fontFamily: "Source Serif 4 Variable, Georgia, Times New Roman, serif"
    fontSize: "1.875rem"
    fontWeight: 400
    lineHeight: 1.2
    letterSpacing: "normal"
  headline:
    fontFamily: "Source Serif 4 Variable, Georgia, Times New Roman, serif"
    fontSize: "1.5rem"
    fontWeight: 400
    lineHeight: 1.25
    letterSpacing: "normal"
  title:
    fontFamily: "Source Serif 4 Variable, Georgia, Times New Roman, serif"
    fontSize: "1.125rem"
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: "normal"
  body:
    fontFamily: "Inter Variable, -apple-system, BlinkMacSystemFont, Segoe UI, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "normal"
  label:
    fontFamily: "Inter Variable, -apple-system, BlinkMacSystemFont, Segoe UI, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: "0.18em"
rounded:
  sm: "0.25rem"
  default: "0.375rem"
  md: "0.5rem"
  lg: "0.625rem"
  xl: "0.75rem"
  2xl: "0.875rem"
  3xl: "1rem"
  glass: "1.5rem"
  spread-card: "1.35rem"
  mystic-panel: "1.6rem"
  pill: "9999px"
spacing:
  "1": "0.25rem"
  "2": "0.5rem"
  "3": "0.75rem"
  "4": "1rem"
  "5": "1.25rem"
  "6": "1.5rem"
  "8": "2rem"
components:
  button-primary:
    backgroundColor: "{colors.pale-candlelight}"
    textColor: "{colors.reading-surface}"
    typography: "{typography.body}"
    rounded: "{rounded.xl}"
    padding: "0 16px"
    height: "52px"
  button-secondary:
    backgroundColor: "rgba(212, 184, 150, 0.10)"
    textColor: "{colors.moonlit-paper}"
    typography: "{typography.body}"
    rounded: "{rounded.pill}"
    padding: "8px 16px"
    height: "44px"
  input-default:
    backgroundColor: "{colors.reading-surface}"
    textColor: "{colors.moonlit-paper}"
    typography: "{typography.body}"
    rounded: "{rounded.xl}"
    padding: "12px 16px"
    height: "44px"
  chip-selected:
    backgroundColor: "{colors.pale-candlelight}"
    textColor: "{colors.reading-surface}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: "6px 12px"
  nav-active:
    backgroundColor: "{colors.candlelit-brass}"
    textColor: "{colors.reading-surface}"
    typography: "{typography.body}"
    rounded: "{rounded.pill}"
    padding: "10px 14px"
    height: "44px"
  surface-card:
    backgroundColor: "{colors.reading-surface}"
    textColor: "{colors.moonlit-paper}"
    rounded: "{rounded.2xl}"
    padding: "16px"
  mystic-panel:
    backgroundColor: "{colors.reading-surface}"
    textColor: "{colors.moonlit-paper}"
    rounded: "{rounded.mystic-panel}"
    padding: "16px"
  spread-card:
    backgroundColor: "{colors.muted-reading-surface}"
    textColor: "{colors.moonlit-paper}"
    rounded: "{rounded.spread-card}"
    padding: "16px 18px 22px"
---

# Design System: Tableu

## Overview

**Creative North Star: "The Midnight Reading Room"**

Tableu feels like entering a private reading room after dark: contemplative, scholarly, and intimate. Warm candlelight marks the places where a person may act, while deep ink surfaces keep attention on cards, language, and ritual. The atmosphere supports reflection without pretending to be supernatural evidence.

The system is dark-first, softly luminous, and materially restrained. Serif type carries tarot meaning and ceremonial moments; sans-serif type keeps navigation, controls, and explanations direct. Grain, radial light, glass, and motion appear as quiet sensory cues, never as neon-occult spectacle, kitschy mysticism, or casino-like stimulation. Light mode is the same room by day, not a separate identity.

The approved image composition is the implementation contract. Preserve its bold focal hierarchy, proportions, negative space, and atmosphere before making local refinements. Micro-interactions stay responsive, while card dealing, reveals, and other ritual transitions use the slower 400–600ms cadence already present in the motion system.

**Key Characteristics:**

- Warm brass light against near-black, subtly plum-leaning surfaces.
- Scholarly serif moments within a highly legible sans-serif operating layer.
- Rounded, tactile controls and layered cards with thin warm borders.
- Ambient glow and restrained texture instead of ornamental occult excess.
- Responsive ritual flows that become carousels and docked actions on handsets.
- Bold focal contrast paired with deliberately slower pacing for ceremonial moments.

## Colors

The palette uses low-chroma warmth: candlelight for agency, paper tones for language, and deep ink for concentration.

### Primary

- **Candlelit Brass** (`#D4B896`): the dark-theme brand and active-navigation color; use it for selection, progress, and decisive interactive emphasis.
- **Aged Brass** (`#7D623B`): the contrast-safe light-theme counterpart for the same semantic role.

### Secondary

- **Quiet Taupe** (`#A89D92`): dark-theme secondary borders, subdued controls, and supporting emphasis.
- **Daylight Taupe** (`#6A5746`): the light-theme counterpart for secondary text and controls.
- **Wands Gold** (`#C9A876`), **Cups Silver-Blue** (`#8B95A5`), **Swords Steel** (`#6B7280`), and **Pentacles Sage** (`#8A9985`): suit-specific accents. They identify meaning; they do not replace the global interaction palette.

### Tertiary

- **Pale Candlelight** (`#E8DAC3`): high-contrast CTAs, focus rings, and the strongest warm highlight on dark surfaces.
- **Daylight Candlelight** (`#8A6B3B`): the light-theme counterpart for accent text and focus.
- **Success Sage** (`#6B9E78`), **Warning Amber** (`#F59E0B`), and **Error Rose** (`#C97676`): reserved status colors with semantic meaning.

### Neutral

- **Midnight Ink** (`#0F0E13`): the default dark canvas.
- **Reading Surface** (`#1C1A22`) and **Muted Reading Surface** (`#2A2730`): progressively raised dark surfaces.
- **Moonlit Paper** (`#E8E6E3`) and **Softened Paper** (`#CCC5B9`): primary and supporting dark-theme text.
- **Daylight Paper** (`#FAFAFA`), **Daylight Surface** (`#FFFFFF`), and **Daylight Muted Surface** (`#F5F5F5`): light-theme canvas and surface hierarchy.
- **Daylight Ink** (`#1A1A1A`) and **Daylight Muted Ink** (`#555555`): primary and supporting light-theme text.

### Named Rules

**The Candlelight Rule.** Warm brass identifies action, selection, focus, or tarot meaning; its scarcity gives it authority.

**The Dark-First Rule.** Midnight Ink is the default atmosphere. Light mode must preserve the same warm hierarchy rather than becoming a generic white application.

**The No Neon Rule.** Do not introduce high-chroma mystical purples, electric gradients, or unrelated rainbow accents into application chrome.

## Typography

**Display Font:** Source Serif 4 Variable (with Georgia and Times New Roman fallbacks)
**Body Font:** Inter Variable (with native system-ui fallbacks)

**Character:** The serif is reflective and literary without becoming antique pastiche. The sans-serif is calm, modern, and operational, keeping a complex reading flow easy to scan.

### Hierarchy

- **Display** (400, `1.875rem`, 1.2): onboarding welcomes and the largest ceremonial headings.
- **Headline** (400, `1.5rem`, 1.25): page titles and major reading sections.
- **Title** (600, `1.125rem`, 1.25): card names, spread names, and compact section titles.
- **Body** (400, `1rem`, 1.5): instructions, reading copy, form content, and mobile prose. Long-form reading text should remain near 65–75 characters per line.
- **Label** (600, `0.75rem`, 1.4, `0.18em` tracking): uppercase eyebrows, compact metadata, and category labels.
- **Supporting scale:** 11px is the absolute minimum for non-essential metadata; 12px serves captions, 14px serves secondary text, and form controls remain 16px on mobile.

### Named Rules

**The Two Voices Rule.** Serif carries interpretation, ritual, and named artifacts; sans-serif carries operation, explanation, and system state.

## Layout

Tableu uses a four-pixel spacing foundation, with 8px, 12px, 16px, 24px, and 32px as the recurring rhythm. Full-bleed headers and action docks frame a centered reading canvas; reference and account surfaces commonly cap content near 64rem while reading scenes may use more width for card geometry.

At 640px, handset carousels and stacked controls begin resolving into grids and wider navigation. At 1024px, panels gain more internal space and three-column selections become appropriate. The supported lower bound is 320px, with specific 360px, 375px, 400px, and 440px accommodations for compact phones. Short landscape layouts use a separate max-height 500px treatment.

On handsets, preserve horizontal card carousels, condensed labels, safe-area padding, and the fixed primary action bar. On larger screens, let panels breathe, expose complete labels, and keep related controls in shared rows. Interactive targets use 44px minimum height, primary CTAs use 52px, and navigation may use 56px.

**The Four-Pixel Rhythm Rule.** Prefer the established 4px-derived spacing steps; introduce a new interval only when card geometry or safe-area math requires it.

## Elevation & Depth

The Midnight Reading Room uses a hybrid of tonal layering, ambient shadow, thin borders, and low-opacity radial light. Depth is atmospheric rather than architectural: surfaces feel gently lifted or selected, but the interface never becomes a stack of floating white cards. Glass treatment is reserved for overlays and cinematic scenes, using 12–32px blur only when translucency has a functional layering role.

### Shadow Vocabulary

- **Selected glow** (`0 12px 30px -18px rgba(212, 184, 150, 0.60)`): selected controls and cards.
- **Card glow** (`0 14px 36px -20px rgba(212, 184, 150, 0.60)`): emphasized card surfaces.
- **Elevated overlay** (`0 20px 48px -24px rgba(0, 0, 0, 0.75)`): modals, drawers, and overlays.
- **Mystic panel** (`0 24px 64px -40px rgba(0, 0, 0, 0.80)` plus a faint inset highlight): signature reading panels.
- **Docked action** (`0 -18px 40px rgba(0, 0, 0, 0.35)`): mobile action groups that rise from the bottom edge.

### Named Rules

**The Ambient, Not Architectural Rule.** Use shadow and glow to suggest candlelight, selection, and focus—not to assign arbitrary elevation to every container.

## Shapes

Controls use softly curved 10–12px corners, while standard cards use 14–16px corners. Signature spread cards expand to about 21.6px and mystic panels to about 25.6px, giving the reading environment a softer silhouette than utility surfaces. Pills are reserved for navigation segments, chips, badges, and compact actions.

Borders are usually one pixel and warm, translucent, and low contrast. Cards clip artwork and texture to their radius; selection adds a brighter border and slight lift without changing the underlying form. Tarot artwork keeps its natural tall-card proportion rather than being cropped into generic landscape thumbnails.

**The Soft Geometry Rule.** Rounded forms should feel tactile and calm; avoid both sharp enterprise rectangles and indiscriminate bubble-like rounding.

## Components

Components are tactile and quietly ceremonial: clear enough for task completion, with just enough material response to make ritual actions feel intentional.

### Buttons

- **Shape:** 12px corners for primary CTAs; full pills for compact navigation and secondary actions.
- **Primary:** Pale Candlelight on Reading Surface, 52px high, with 16px horizontal padding and semibold sans-serif text.
- **Hover / Focus:** a small lift or 2–3% scale at most; focus uses a 2px Pale Candlelight ring with visible offset. Active states return toward the surface and may scale to 98%.
- **Secondary / Ghost / Destructive:** translucent warm fill with a thin semantic border. Destructive actions use Error Rose only when the action is genuinely destructive.

### Chips

- **Style:** full pills with compact 6–8px vertical and 10–12px horizontal padding; supporting chips use translucent surfaces and thin borders.
- **State:** selected chips invert to candlelight fill with dark text. Suit and status chips keep their semantic colors rather than borrowing the primary accent.

### Cards / Containers

- **Corner Style:** 14–16px for standard cards; larger signature radii only inside the reading experience.
- **Background:** Reading Surface or Muted Reading Surface, optionally with a very low-opacity ambient gradient.
- **Shadow Strategy:** flat or softly shadowed at rest; stronger glow indicates selection or interaction.
- **Border:** one-pixel warm translucent stroke.
- **Internal Padding:** 16px by default, increasing to 20–26px on wider mystic panels.

### Inputs / Fields

- **Style:** Reading Surface or a translucent muted surface, 12px corners, one-pixel Quiet Taupe border, 12px vertical and 16px horizontal padding.
- **Focus:** border shifts toward candlelight and gains a 2px visible focus ring.
- **Error / Disabled:** errors use Error Rose with text reinforcement; disabled fields lower opacity but retain readable labels.

### Navigation

Primary navigation uses pill segments with 14px semibold sans-serif labels and 44px minimum targets. The active destination receives Candlelit Brass with dark text; inactive items remain on dark translucent surfaces with warm borders. Reading progress uses 12px corners and a subtler brass wash. On mobile, labels condense and the decisive next action moves to a safe-area-aware bottom dock.

### Mystic Panel

The signature panel combines a deep plum-black gradient, three extremely soft radial glows, a thin warm border, subtle noise, a 25.6px radius, and responsive 16–26px padding. It frames spread and deck decisions without turning every ordinary card into a special effect.

### Spread Card

Spread cards use tall visual previews, serif names, tracked sans-serif metadata, a 21.6px radius, and restrained theme-specific glow. Hover lifts by roughly 3px on fine pointers; selection strengthens the border and glow. Mobile cards form a horizontal snap carousel, while tablet and desktop layouts become equal-height grids.

**The Quiet Ceremony Rule.** The approved image composition is the implementation contract: preserve its bold focal hierarchy, proportions, negative space, and atmosphere; reserve the strongest light and slower 400–600ms motion for decisions that advance or reveal a reading.

## Do's and Don'ts

### Do:

- **Do** use semantic theme tokens so dark, light, and increased-contrast modes remain aligned.
- **Do** reserve serif type for interpretation, ritual, card names, and major headings.
- **Do** keep body copy and mobile form controls at 16px, with 11px reserved for non-essential metadata only.
- **Do** preserve 44px touch targets, safe-area insets, visible focus, and reduced-motion alternatives.
- **Do** use Candlelit Brass sparingly for selection, progress, focus, and high-value action.
- **Do** let mobile reading choices become swipeable carousels and move the primary next action into the bottom dock.
- **Do** match implementation to the approved image composition before optimizing local details.

### Don't:

- **Don't** use neon mystical palettes, rainbow chrome, or high-energy casino animation.
- **Don't** make every surface glassy, glowing, or heavily shadowed; atmospheric treatments lose meaning when universal.
- **Don't** use Source Serif for dense controls, helper text, or navigation.
- **Don't** introduce text below 11px or mobile inputs below 16px.
- **Don't** encode status using color alone or replace focus rings with hover-only treatments.
- **Don't** turn the light theme into a generic white dashboard; preserve the warm paper-and-brass hierarchy.
- **Don't** dilute the approved focal hierarchy or accelerate ceremonial motion into generic app-speed transitions.
