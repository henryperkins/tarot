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
  clear-paper: "#DDD7CD"
  daylight-clear-ink: "#333333"
  daylight-success-sage: "#2F6A3B"
  daylight-warning-amber: "#854D0E"
  daylight-error-rose: "#A13F3F"
  success-surface: "#1B2C21"
  daylight-success-surface: "#EDF4EE"
  warning-surface: "#392B17"
  daylight-warning-surface: "#FEF3C7"
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
    lineHeight: "2rem"
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
    lineHeight: "1rem"
    letterSpacing: "0.18em"
  reading-title:
    fontFamily: "Source Serif 4 Variable, Georgia, Times New Roman, serif"
    fontSize: "clamp(1.5rem, 2.4vw, 2rem)"
    fontWeight: 500
    lineHeight: 1.2
  reading-body:
    fontFamily: "Inter Variable, -apple-system, BlinkMacSystemFont, Segoe UI, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.7
  control:
    fontFamily: "Inter Variable, -apple-system, BlinkMacSystemFont, Segoe UI, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 600
    lineHeight: 1.4
  control-small:
    fontFamily: "Inter Variable, -apple-system, BlinkMacSystemFont, Segoe UI, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 600
    lineHeight: 1.4
  control-journey:
    fontFamily: "Inter Variable, -apple-system, BlinkMacSystemFont, Segoe UI, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 500
    lineHeight: "1.25rem"
  step-label:
    fontFamily: "Inter Variable, -apple-system, BlinkMacSystemFont, Segoe UI, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 600
    lineHeight: "1rem"
    letterSpacing: "0.1em"
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
    textColor: "{colors.midnight-ink}"
    typography: "{typography.control}"
    rounded: "{rounded.xl}"
    padding: "12px 16px"
    height: "52px"
  button-secondary:
    backgroundColor: "rgba(212, 184, 150, 0.10)"
    textColor: "{colors.moonlit-paper}"
    typography: "{typography.control-small}"
    rounded: "{rounded.pill}"
    padding: "8px 16px"
    height: "44px"
  input-default:
    backgroundColor: "rgba(42, 39, 48, 0.40)"
    textColor: "{colors.moonlit-paper}"
    typography: "{typography.body}"
    rounded: "{rounded.xl}"
    padding: "12px 16px"
    height: "44px"
  chip-selected:
    backgroundColor: "{colors.pale-candlelight}"
    textColor: "{colors.reading-surface}"
    typography: "{typography.step-label}"
    rounded: "{rounded.pill}"
    padding: "4px 12px"
    height: "44px"
  nav-active:
    backgroundColor: "{colors.candlelit-brass}"
    textColor: "{colors.reading-surface}"
    typography: "{typography.control-small}"
    rounded: "{rounded.pill}"
    padding: "10px 14px"
    height: "44px"
  surface-card:
    backgroundColor: "rgba(28, 26, 34, 0.70)"
    textColor: "{colors.moonlit-paper}"
    rounded: "{rounded.2xl}"
    padding: "16px"
  mystic-panel:
    textColor: "{colors.moonlit-paper}"
    rounded: "{rounded.mystic-panel}"
    padding: "16px"
  spread-card:
    textColor: "{colors.moonlit-paper}"
    rounded: "{rounded.spread-card}"
    padding: "1rem 1.15rem 1.35rem"
  button-journey:
    textColor: "{colors.moonlit-paper}"
    typography: "{typography.control-journey}"
    rounded: "{rounded.xl}"
    padding: "10px 16px"
    height: "44px"
---

# Design System: Tableu

Refreshed from local source on 2026-10-02 (commit `38701a1`). [Theme tokens](src/styles/theme.css), [Tailwind mapping](tailwind.config.js), [shared styles](src/styles/tarot.css), and [reading-table styles](src/styles/reading-table.css) are the implementation references. The frontmatter records the default dark-theme tokens and named light-theme counterparts; runtime components use semantic CSS variables to follow the active theme. Component height entries describe minimum targets, not fixed clipping heights.

Local Chromium sampling covered `/design`, reading setup, and the revealed reading table at 390px and 1440px in dark and light themes, with reduced motion. This is a design snapshot, not a full accessibility audit. The [design contract](docs/design-contract.md) supplies the accessibility and responsive targets; historical audit counts in that document are not current verification. Format: [DESIGN.md specification](https://raw.githubusercontent.com/google-labs-code/design.md/main/docs/spec.md).

## Overview

**Creative North Star: "The Midnight Reading Room"**

Tableu feels like entering a private reading room after dark: contemplative, scholarly, and intimate. Warm candlelight marks the places where a person may act, while deep ink surfaces keep attention on cards, language, and ritual. The atmosphere supports reflection without pretending to be supernatural evidence.

The system is dark-first, softly luminous, and materially restrained. Serif type carries tarot meaning and ceremonial moments; sans-serif type keeps navigation, controls, and explanations direct. Grain, radial light, glass, and motion appear as quiet sensory cues, never as neon-occult spectacle, kitschy mysticism, or casino-like stimulation. Light mode is the same room by day, not a separate identity.

Where a surface has an approved image composition, preserve its focal hierarchy, proportions, negative space, and atmosphere before making local refinements. The implemented reading table gives cards and interpretation one quiet, mostly opaque surface; deck and spread selection retain the more atmospheric panels. Micro-interactions use the fast end of the motion scale, while the slower 400–600ms tokens support ceremonial transitions. Reduced-motion preferences suppress decorative movement.

**Key Characteristics:**

- Warm brass light against near-black, subtly plum-leaning surfaces.
- Scholarly serif moments within a highly legible sans-serif operating layer.
- Rounded, tactile controls and layered cards with thin warm borders.
- Ambient glow and restrained texture instead of ornamental occult excess.
- Responsive spread selection that becomes a carousel on handsets, with reading actions in a bottom dock.
- A quiet reading table that places card geometry beside interpretation on wide screens and stacks them on phones.
- Bold focal contrast paired with deliberately slower pacing for ceremonial moments.

## Colors

The palette uses low-chroma warmth: candlelight for agency, paper tones for language, and deep ink for concentration.

### Primary

- **Candlelit Brass** and **Aged Brass** are the dark and light expressions of `--brand-primary`: active navigation, progress, and interactive emphasis.

### Secondary

- **Quiet Taupe** and **Daylight Taupe** supply `--brand-secondary` for supporting emphasis and borders.
- **Wands Gold**, **Cups Silver-Blue**, **Swords Steel**, and **Pentacles Sage** identify suit meaning. Deck artwork and its palette samples retain the tradition's own colors.

### Tertiary

- **Pale Candlelight** and **Daylight Candlelight** supply `--brand-accent` for decisive actions and the default focus color. The `text-accent` utility instead maps to `--brand-primary-rgb`; it does not mean accent-filled button text.
- **Success Sage**, **Warning Amber**, and **Error Rose** have explicit daylight counterparts. Their opaque success and warning surfaces also switch with the theme. Use the semantic status variables, rather than the fixed primitive success/error colors, for UI feedback.

### Neutral

- **Midnight Ink**, **Reading Surface**, and **Muted Reading Surface** provide the dark canvas and tonal layers; **Daylight Paper**, **Daylight Surface**, and **Daylight Muted Surface** provide their light equivalents.
- **Moonlit Paper**, **Softened Paper**, and **Clear Paper** map to main, muted, and higher-contrast muted text. **Daylight Ink**, **Daylight Muted Ink**, and **Daylight Clear Ink** carry those roles in light mode.
- Text on brand fills uses `--text-on-brand`: Reading Surface in dark mode and Daylight Paper in light mode. The reading-table primary button specifically uses `--bg-main` for its contrasting text.

Exact colors live in the frontmatter. [theme.css](src/styles/theme.css) also owns the `prefers-contrast: more` overrides, translucent borders, panel gradients, and shadow variants. Keep those live semantic relationships; the named swatches are not a replacement for the theme cascade.

### Named Rules

**The Candlelight Rule.** Warm brass identifies action, selection, focus, or tarot meaning; its scarcity gives it authority.

**The Dark-First Rule.** Midnight Ink is the default atmosphere. Light mode must preserve the same warm hierarchy rather than becoming a generic white application.

**The No Neon Rule.** Do not introduce high-chroma mystical purples, electric gradients, or unrelated rainbow accents into application chrome.

## Typography

**Display Font:** Source Serif 4 Variable (with Georgia and Times New Roman fallbacks)
**Body Font:** Inter Variable (with native system-ui fallbacks)

**Character:** The serif is reflective and literary without becoming antique pastiche. The sans-serif is calm, modern, and operational, keeping a complex reading flow easy to scan.

### Hierarchy

- **Display:** regular serif onboarding welcomes. Short landscape layouts use the smaller headline size.
- **Headline:** regular serif page titles, including the design reference page. Reading-table titles use their own fluid, medium-weight role.
- **Title:** semibold serif for compact artifact headings. Spread-selector names are a smaller local variant (16px at standard widths, slightly smaller on compact phones).
- **Body:** regular sans-serif for instructions and form content. Reading-table meanings use the more open reading-body role. The shared [MarkdownRenderer](src/components/MarkdownRenderer.jsx) uses 16px prose, growing to 18px at 768px, with a 65ch reading measure on wider screens. Follow-up answers retain 16px copy.
- **Label:** tracked uppercase eyebrows and metadata. Coach step chips use a separate step-label role with tighter tracking; button labels use the control roles rather than eyebrow typography.
- **Supporting scale:** 11px is the absolute minimum for non-essential metadata; 12px serves captions, 14px serves secondary text, and form controls remain 16px on mobile.

### Named Rules

**The Two Voices Rule.** Serif carries headings, ritual, and named artifacts; sans-serif carries interpretation paragraphs, operation, explanation, and system state.

## Layout

Tableu uses a four-pixel spacing foundation, with 8px, 12px, 16px, 24px, and 32px as the recurring rhythm. Full-bleed headers and action docks frame a centered reading canvas; reference and account surfaces commonly cap content near 64rem while reading scenes may use more width for card geometry.

At 640px, handset carousels and stacked controls begin resolving into grids and wider navigation. At 1024px, panels gain more internal space and the reading table becomes a two-column workspace (1.5fr for the spread, a minimum 18rem interpretation column, and a 32px gap). Below 1024px, interpretation follows the spread with a horizontal divider; at 768px and below, the outer table frame becomes transparent and borderless. Short landscape screens at least 640px wide can restore two columns.

The supported lower bound is 320px, with specific 360px, 375px, 400px, and 440px accommodations for compact phones. Those compact max-width queries are distinct from Tailwind's min-width breakpoints. Short landscape layouts use a max-height 500px treatment; the separate short-viewport query uses 600px.

On handsets, preserve the spread-selection carousel, condensed labels, safe-area padding, and the fixed primary action bar. The revealed spread retains its card geometry rather than becoming that selection carousel. On larger screens, expose complete labels and keep related controls in shared rows. Tableu's internal target is 44px for interactive controls and 52px for primary reading CTAs; a 56px navigation token is available, while GlobalNav currently uses 44px. Compact landscape dock actions may use the 44px minimum.

Bottom content clearance includes the measured action-bar height, keyboard offset, and safe-area inset. Use the shared safe-area utilities and existing dock measurement rather than assuming a fixed bar height.

**The Four-Pixel Rhythm Rule.** Prefer the established 4px-derived spacing steps; introduce a new interval only when card geometry or safe-area math requires it.

## Elevation & Depth

The Midnight Reading Room uses a hybrid of tonal layering, ambient shadow, thin borders, and low-opacity radial light. Depth is atmospheric rather than architectural: surfaces feel gently lifted or selected, but the interface never becomes a stack of floating white cards. Glass treatment appears on overlays, cinematic scenes, and selected shared surfaces, with blur reduced for accessibility or mobile stability. The reading table removes the scene artwork and particle layers and uses an opaque semantic surface on wide screens.

### Shadow Vocabulary

- **Selected glow** (`--ui-selected-shadow`): selected controls and cards, with a lighter shadow in the light theme.
- **Card glow** (`--ui-card-shadow-strong` / `--ui-card-shadow-soft`): emphasized cards and the quieter reading-table shell.
- **Elevated overlay** (`--ui-elevated-shadow`): modals, drawers, and overlays, switching to a warm, low-opacity light-theme shadow.
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
- **Primary reading action:** Pale Candlelight fill with Midnight Ink text in the dark theme, switching to Daylight Candlelight with Daylight Paper text in light mode. It has a 52px minimum height and the control typography role. The reading-table instance changes fill on hover and presses down by one pixel only when motion is allowed.
- **Journey action:** the shared [journey button](src/styles/buttonClasses.js) uses a transparent brass gradient, warm border, medium-weight 14px text, and a 44px minimum target. The design reference page labels this softer variant “Primary action”; it is distinct from the solid reading CTA.
- **Hover / Focus:** use each shared variant's actual state treatment. The general focus fallback is a 2px semantic outline with 3px offset; reading-table controls use 4px offset. Shared Tailwind focus helpers use rings, sometimes with a surface-matched offset.
- **Secondary / Panel / Destructive:** the outline action is a translucent brass pill with a small hover lift. The panel action uses 10px corners and a quieter warm wash. Both target 44px minimum height. Destructive actions use the theme-aware error token and a clear label.

### Chips

- **Style:** navigation and coach step chips use full pills; current onboarding preference choices use 12px corners. Interactive chips keep a 44px target even when their text and padding are compact. Non-interactive metadata badges may be smaller.
- **State:** selected options use the accent fill with theme-aware on-brand text. Coach steps expose selection semantically and keep the full step name accessible when phones show only a number. Suit and status chips retain their own semantic roles.

### Cards / Containers

- **Corner Style:** 14–16px for standard cards; larger signature radii only inside the reading experience.
- **Background:** Reading Surface or Muted Reading Surface, optionally with a very low-opacity ambient gradient.
- **Shadow Strategy:** flat or softly shadowed at rest; stronger glow indicates selection or interaction.
- **Border:** one-pixel warm translucent stroke.
- **Internal Padding:** 16px by default, increasing to 20–26px on wider mystic panels.

### Inputs / Fields

- **Style:** the design reference field uses a muted surface at 40% opacity, 12px corners, a secondary border at 20% opacity, and 12px vertical / 16px horizontal padding. It uses 16px type on phones and 14px from 640px. The question textarea instead uses an opaque surface and a primary border; retain the pattern appropriate to the task.
- **Focus:** the question field strengthens its primary border and adds a one-pixel primary ring; the design reference uses the shared primary focus helper. Reading-table reflection uses an explicit semantic outline and a 96px minimum textarea height.
- **Error / Disabled:** errors pair the theme-aware error color with explanatory text. Keep labels legible when fields are unavailable.

### Navigation

Primary navigation uses pill segments with 14px semibold sans-serif labels and 44px minimum targets. The active destination receives the primary fill and on-brand text and exposes `aria-current="page"`; inactive items use the semantic surface with secondary borders. Reading and Journal remain readable as guest controls wrap. Reading progress is a separate control group with 12px corners and a subtler brass wash. On mobile, progress labels condense and the decisive next action moves to the safe-area-aware bottom dock.

### Mystic Panel

The signature panel combines theme-specific layered gradients, three soft radial glows, a thin warm border, subtle noise, and the mystic-panel radius. Padding grows from 16px to 21.6px at 640px and 25.6px at 1024px. Its light variant uses warm paper tones. It frames spread and deck decisions; it is not the shell used by the quieter reading table.

### Spread Card

Spread cards combine artwork previews, serif names, tracked metadata, the spread-card radius, and suit-aware selection accents. Hover lifts by 3px on fine pointers; selection strengthens the border and glow. Mobile choices form a horizontal snap carousel, while wider layouts use equal-height grid rows. Heights are minimums and may grow with copy. Actual tarot cards retain their 2:3 shape; the spread artwork preview may use a wider crop.

The sidecar uses the existing three-card SVG fallback from [SpreadPatternThumbnail](src/components/SpreadPatternThumbnail.jsx), keeping it self-contained without fabricating replacement artwork. Current per-spread background strings in [SpreadSelector](src/components/SpreadSelector.jsx) contain unitless gradient stops; sampled card backgrounds resolve to `none`, while their decorative pseudo-elements still render. That is an observed implementation discrepancy, not a palette rule.

### Reading Table

[ReadingTableScene](src/components/scenes/ReadingTableScene.jsx) keeps the spread, selected card meaning, navigation, and optional reflection together. A fine divider separates spread and interpretation on wide screens and becomes a horizontal rule when stacked. Fluid serif headings carry the card names; meaning paragraphs use the reading-body role. Decorative scene backgrounds and particles are suppressed in this surface.

**The Quiet Ceremony Rule.** Preserve the focal hierarchy of an approved surface composition; reserve the strongest light and slower motion for decisions that advance or reveal a reading, and keep the interpretation surface quiet.

## Do's and Don'ts

### Do:

- **Do** use semantic theme tokens so dark, light, and increased-contrast modes remain aligned.
- **Do** reserve serif type for ritual, card names, and headings; keep interpretation paragraphs in the established sans-serif reading styles.
- **Do** keep primary reading copy at least 16px and mobile form controls at 16px, with 11px reserved for non-essential metadata only.
- **Do** preserve 44px touch targets, safe-area insets, visible focus, and reduced-motion alternatives.
- **Do** use Candlelit Brass sparingly for selection, progress, focus, and high-value action.
- **Do** let mobile spread selection become a swipeable carousel and move the primary next action into the bottom dock; preserve the geometry of the revealed spread.
- **Do** preserve an approved surface composition where one exists and verify documentation against the rendered implementation in both themes.

### Don't:

- **Don't** use neon mystical palettes, rainbow chrome, or high-energy casino animation.
- **Don't** make every surface glassy, glowing, or heavily shadowed; atmospheric treatments lose meaning when universal.
- **Don't** use Source Serif for dense controls, helper text, navigation, or the existing sans-serif interpretation paragraphs.
- **Don't** introduce text below 11px or mobile inputs below 16px.
- **Don't** encode status using color alone or replace focus rings with hover-only treatments.
- **Don't** turn the light theme into a generic white dashboard; preserve the warm paper-and-brass hierarchy.
- **Don't** dilute the approved focal hierarchy or accelerate ceremonial motion into generic app-speed transitions.
