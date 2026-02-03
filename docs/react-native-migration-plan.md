# React Native Migration Plan: Tableu Tarot App

## Executive Summary

Converting Tableu from a WebView wrapper to a **full native React Native app** using Expo.

**Current state**: 130+ React web components, Tailwind CSS, anime.js + Framer Motion, react-router-dom  
**Target state**: Native RN components, NativeWind, Reanimated, React Navigation  
**Target RN version**: **0.83** (React 19.2, Expo SDK 55 — Jan 2026)  
**Estimated effort**: 2-3 months (1 developer full-time)

## Current Implementation Status (2026-02-03)

- Native scaffold added in `native/` (Expo SDK 55 preview, RN 0.83, React Navigation, NativeWind v4.2, Reanimated/gesture-handler).
- Preferences storage wired to MMKV (`native/src/lib/storage.js`, `native/src/contexts/PreferencesContext.jsx`).
- Journal schema + list UI implemented via expo-sqlite (`native/src/lib/journalDb.js`, `native/src/screens/JournalScreen.jsx`).
- P0 reading flow exists in `native/src/screens/ReadingScreen.jsx` (spread selection, intention input, ritual controls, card reveal, narrative + audio placeholders).
- Share reading screen exists in `native/src/screens/ShareReadingScreen.jsx` (fetches `/api/share/:token`).
- Auth deep-link screens exist (`native/src/screens/ResetPasswordScreen.jsx`, `native/src/screens/VerifyEmailScreen.jsx`, `native/src/screens/OAuthCallbackScreen.jsx`) and call `/api/auth/*` endpoints.
- Dependency installer script added at `scripts/native/setup-native.sh`.
- Headless Linux dev-server startup is supported by default (standalone React Native DevTools shell disabled via `native/patches/@react-native+dev-middleware+0.83.1.patch`).

---

## React Native 0.83 Features to Leverage

### React 19.2 APIs

| API | Use in Tableu |
|-----|--------------|
| **`<Activity>`** | Hide inactive spread views while preserving state (e.g., keep card selections when switching tabs) |
| **`useEffectEvent`** | Clean up TTS callbacks, haptic feedback events without effect re-runs |

```jsx
// Example: Preserve reading state when navigating away
<Activity mode={isActive ? 'visible' : 'hidden'}>
  <ReadingDisplay cards={cards} />
</Activity>
// Cards, reflections, scroll position all preserved!
```

### IntersectionObserver (Canary)
- **Card Gallery**: Lazy load card images as they scroll into view
- **Journal**: Infinite scroll with native performance
- **Reading Grid**: Detect when cards are fully visible for animation triggers

### Web Performance APIs (Stable)
- `performance.mark()` / `performance.measure()` for reading flow timing
- Track narrative generation latency in production
- `PerformanceObserver` works in production builds — real user metrics!

### DevTools Enhancements
- **Network panel**: Debug API calls to `/api/tarot-reading`
- **Performance panel**: Profile card animations, identify jank
- **Desktop app**: No browser dependency, better debugging

### Hermes V1 (Experimental)
- Significant JS performance improvements
- Consider enabling for production after testing

---

## Codebase Analysis Summary

### Animation Complexity (HIGH) 🔴

**Current Stack:** Anime.js (primary) + Framer Motion (some screens/components)

| Animation | Complexity | RN Approach |
|-----------|------------|-------------|
| **Card flip** | 3-phase timeline: ink blur → content swap → ink spread | Reanimated 3 + 3D transforms |
| **Swipe-to-reveal** | Touch tracking with responsive thresholds | Gesture Handler |
| **Deck ritual** | Shuffle wobble, breathing idle, knock ripple | Reanimated sequences |
| **Page transitions** | 220ms opacity fade | React Navigation presets |

**Card Flip Timeline (350ms + 400ms):**
1. Phase 1: RotateY 0→90°, blur 8px, scale 0.95
2. Phase 2: DOM content swap (instant)
3. Phase 3: RotateY 90→0°, blur 0, scale 1

**Migration Overhead:** ~40-50% for animation parity

### State Management (MEDIUM) 🟡

**Provider Hierarchy:**
```
AuthProvider → SubscriptionProvider → PreferencesProvider → ReadingProvider → ToastProvider
```

**localStorage Keys (12+):**
- `tarot-theme`, `tarot-voice-enabled`, `tarot-tts-*`
- `tarot-personalization:{userId}` (user-scoped)
- `tarot_journal_{userId}` (journal cache)
- `tarot-nudge-state`, `tarot-onboarding-complete`

**Ready for RN:** Context structure, custom hooks, audio abstractions  
**Needs Work:** User-scoped storage keys + migration from web localStorage, and a cookie/session story for mobile

### Navigation (MEDIUM) 🟡

**Routes (10 total):**
| Route | Component | Type |
|-------|-----------|------|
| `/` | TarotReading | Main |
| `/journal` | Journal | Tab |
| `/journal/gallery` | CardGalleryPage | Nested |
| `/account` | AccountPage | Stack |
| `/share/:token` | ShareReading | Deep link |
| `/auth/callback` | OAuthCallbackPage | OAuth |

**Modals (NOT routed):** AuthModal, CardModal, FollowUpDrawer, SettingsDrawer

**React Navigation Mapping:**
- `useNavigate()` → `navigation.navigate()`
- URL state → Route params
- `/share/:token` → Deep linking config

### Web-Specific APIs (CRITICAL) 🔴

| API | Files | RN Alternative |
|-----|-------|----------------|
| **localStorage** | 20+ files, 100+ calls | AsyncStorage / MMKV |
| **Web Audio** | 3 files (TTS, UI sounds) | expo-av |
| **Canvas 2D** | CameraCapture.jsx | expo-camera + expo-image |
| **DOM (window/document)** | 15+ files | Dimensions API, Platform |
| **Media queries** | 80+ in CSS | StyleSheet + responsive hooks |
| **navigator.mediaDevices** | CameraCapture.jsx | expo-camera |

### Key Files to Migrate First

1. **Card.jsx** — Complex animations, gesture handling
2. **DeckRitual.jsx** — Most complex animation set
3. **PreferencesContext.jsx** — Heavy localStorage usage
4. **useJournal.js** — 30+ localStorage calls
5. **CameraCapture.jsx** — Canvas + getUserMedia

### Core Framework (Updated from Blueprint)
| Library | Purpose | Why |
|---------|---------|-----|
| **NativeWind v4.2** | Tailwind for RN | Current baseline in `native/` (revisit v5 upgrade once stable) |
| **class-variance-authority** | Variant management | Works with NativeWind, 38M downloads |
| **tailwind-merge** | Class deduplication | Already used in web ecosystem |

### Storage (Hybrid Model — Blueprint Recommendation)
| Library | Use Case | Why |
|---------|----------|-----|
| **MMKV** | Preferences, theme, settings | 30x faster than AsyncStorage, synchronous, encrypted |
| **expo-sqlite** | Journal, reading history | Relational queries ("all readings with The Tower") |

> ⚠️ **Don't use AsyncStorage** — MMKV prevents "flash of unstyled content" at launch and is synchronous

### UI Components
| Library | Replaces | Downloads |
|---------|----------|-----------|
| **react-native-modalfy** | Custom modals | 12k/mo — modal stack management |
| **@devvie/bottom-sheet** | Drawers | 15k/mo — settings, filters, follow-up |
| **burnt** | ToastContext | 461k/mo — native iOS/Android toasts |
| **rn-emoji-keyboard** | — | 106k/mo — for follow-up chat |
| **@kolking/react-native-rating** | FeedbackPanel ratings | 8k/mo |

### Interactions & Animation
| Library | Purpose | Why |
|---------|---------|-----|
| **react-native-reanimated-dnd** | Card dragging | 141k/mo — "finally works" |
| **react-native-nitro-haptics** | Haptic feedback | Worklet support, low latency |
| **react-native-filament** | 3D effects (optional) | Premium card animations |

### Data & Forms
| Library | Purpose | Downloads |
|---------|---------|-----------|
| **react-hook-form** | Form management | 73M/mo — works in RN |
| **@hookform/resolvers** | Zod/Yup validation | 53M/mo |
| **@data-client/react** | API caching | Suspense + offline support |

### Vision & ML
| Library | Purpose | Tableu Use |
|---------|---------|------------|
| **@react-native-ml-kit/text-recognition** | OCR | Card text detection |
| **react-native-image-colors** | Color extraction | Dynamic theming from cards |

### Infrastructure
| Library | Purpose |
|---------|---------|
| **expo-speech** | TTS fallback (native on-device) |
| **expo-av** | Audio playback |
| **react-native-auto-skeleton** | Loading states |
| **@zoontek/react-native-navigation-bar** | Android nav bar |

### Audio Strategy (Blueprint Guidance)

**Don't use Azure Speech JS SDK** — it has Node.js dependencies (`fs`, `net`) that don't work in RN.

**Use Tableu backend TTS endpoint instead (recommended):**
```
1. POST to `/api/tts` with text + voice options
2. Receive base64 audio payload (MP3)
3. Write to local storage via expo-file-system
4. Play via expo-av
5. Cache locally for replay without API calls
```

**Fallback:** expo-speech (on-device Siri/Google TTS) for offline mode

---

## Phase 1: Foundation Setup (Week 1-2)

### 1.1 Project Structure
- [x] Create new `native/` directory for RN-specific code (keep web working)
- [x] Set up React Navigation 7 (stack + tab navigators)
- [ ] Configure shared code structure (`shared/` already exists)
- [x] **Set up NativeWind v4.2** (keep Tailwind classes!)
- [x] Configure react-native-reanimated + gesture-handler
- [x] Set up MMKV for synchronous storage (wrapper in `native/src/lib/storage.js`)
- [x] Set up expo-sqlite for journal/history (schema + list screen in place)
- [x] Add `scripts/native/setup-native.sh` to install native dependencies

### 1.2 Core Dependencies to Add
```bash
# Navigation
npx expo install @react-navigation/native @react-navigation/stack @react-navigation/bottom-tabs
npx expo install react-native-screens react-native-safe-area-context

# Styling (KEY: keeps Tailwind patterns)
npx expo install nativewind tailwindcss
npm install class-variance-authority tailwind-merge

# Animation & Gestures
npx expo install react-native-reanimated react-native-gesture-handler
npm install react-native-reanimated-dnd
npm install react-native-nitro-haptics

# Storage & Data (Hybrid Model)
npm install react-native-mmkv    # Synchronous, encrypted, 30x faster
npx expo install expo-sqlite     # Relational journal storage
npm install @data-client/react react-hook-form @hookform/resolvers

# UI Components
npm install react-native-modalfy @devvie/bottom-sheet burnt
npm install rn-emoji-keyboard @kolking/react-native-rating
npm install react-native-auto-skeleton

# Media
npx expo install expo-av expo-camera expo-image expo-speech

# Charts
npx expo install react-native-svg
npm install victory-native

# Vision/ML (optional)
npm install @react-native-ml-kit/text-recognition react-native-image-colors
```

### 1.3 Enable RN 0.83 Features
```js
// app.json - target Expo SDK 55
{
  "expo": {
    "sdkVersion": "55.0.0",
    // Enable Hermes V1 (experimental but faster)
    "jsEngine": "hermes"
  }
}

// Enable IntersectionObserver in Metro config (Canary)
// metro.config.js
module.exports = {
  resolver: {
    unstable_enablePackageExports: true,
  },
};
```

### 1.4 Navigation Structure (replaces react-router-dom)
```
RootNavigator
├── MainStack
│   ├── Reading (TarotReading → main flow)
│   ├── Journal
│   ├── Gallery
│   ├── Account
│   └── Pricing
├── AuthStack
│   ├── Login/Register (modal)
│   ├── ResetPassword
│   └── VerifyEmail
└── ShareStack
    └── ShareReading (deep link handling)
```

### 1.5 Deep Linking Configuration (Blueprint)
```js
// React Navigation 7 deep linking config
const linking = {
  prefixes: ['tableu://', 'https://tarot.lakefrontdev.com'],
  config: {
    screens: {
      Reading: '',
      Journal: 'journal',
      Gallery: 'journal/gallery',
      Account: 'account',
      ShareReading: 'share/:token',
      ResetPassword: 'reset-password',
      VerifyEmail: 'verify-email',
      OAuthCallback: 'auth/callback',
    },
  },
};
```

**Status (2026-02-03):** `scheme: "tableu"` is set in `native/app.json`. Universal links (`associatedDomains` / Android `intentFilters`) are still TODO.

**When enabling universal links, `app.json` additions:**
```json
{
  "expo": {
    "scheme": "tableu",
    "ios": {
      "associatedDomains": ["applinks:tarot.lakefrontdev.com"]
    },
    "android": {
      "intentFilters": [{
        "action": "VIEW",
        "data": [{ "scheme": "tableu" }],
        "category": ["BROWSABLE", "DEFAULT"]
      }]
    }
  }
}
```

---

## Phase 2: Utility Layer (Week 2-3)

### 2.1 Storage Migration (localStorage → MMKV + SQLite)
- [x] Create `native/src/lib/storage.js` wrapper using MMKV
- [x] Wire native PreferencesContext storage calls (synchronous MMKV)
- [ ] Migrate feature flags storage
- [ ] Migrate onboarding state
- [x] Set up SQLite schema for journal entries (`native/src/lib/journalDb.js`)
- [ ] Create journal migration from localStorage to SQLite

### 2.2 API Layer (fetch → same, but handle differently)
- [ ] API calls stay mostly the same (fetch works in RN)
- [ ] Add offline detection with NetInfo
- [ ] Add request retry logic for mobile networks

### 2.3 Audio Migration (Web Audio → Azure REST + expo-av)
- [ ] Rewrite `useUISounds.js` for expo-av
- [ ] Implement Azure TTS via REST API (NOT JS SDK)
- [ ] Add expo-file-system for audio caching
- [ ] Add expo-speech as offline fallback

### 2.4 Hooks Migration
| Hook | Web API | RN Equivalent | Effort |
|------|---------|---------------|--------|
| useBodyScrollLock | DOM | Not needed (native scroll) | Remove |
| useModalA11y | DOM focus | React Navigation focus | Medium |
| useKeyboardOffset | CSS | KeyboardAvoidingView | Low |
| useSwipeDismiss | Touch events | Gesture Handler | Medium |
| useHaptic | N/A | expo-haptics (already exists?) | Low |
| useReducedMotion | CSS media query | AccessibilityInfo | Low |

---

## Phase 3: Core Components (Week 3-6)

### 3.1 Priority 1: Card System (critical path)
- [ ] `Card.jsx` → Native with Reanimated flip animation
- [ ] `DeckPile.jsx` → Gesture-based card interactions
- [ ] `DeckRitual.jsx` → Tap/gesture for knocks + cut
- [ ] `ReadingGrid.jsx` → Flexbox layout for spreads
- [ ] `CardModal.jsx` → React Navigation modal

### 3.2 Priority 2: Reading Flow
- [ ] `TarotReading.jsx` → Main screen orchestration
- [ ] `SpreadSelector.jsx` → Native picker/list
- [ ] `QuestionInput.jsx` → TextInput + keyboard handling
- [ ] `RitualControls.jsx` → Native buttons
- [ ] `ReadingDisplay.jsx` → ScrollView + card grid

### 3.2a Current P0 Scaffold (native/)
- [x] `Card` component with Reanimated flip + remote image rendering (`native/src/components/Card/Card.jsx`)
- [x] `DeckRitual` placeholder with knock/cut/deal actions (`native/src/components/DeckRitual.jsx`)
- [x] `SpreadSelector` + `QuestionInput` shells (`native/src/components/SpreadSelector.jsx`, `native/src/components/QuestionInput.jsx`)
- [x] `ReadingDisplay` + spread layouts (`native/src/components/ReadingDisplay.jsx`, `native/src/components/SpreadLayout.jsx`)
- [x] Narrative/audio placeholders (`native/src/components/StreamingNarrative.jsx`, `native/src/components/AudioControls.jsx`)

### 3.3 Priority 3: Narrative & Feedback
- [ ] `StreamingNarrative.jsx` → Text streaming display
- [ ] `MarkdownRenderer.jsx` → react-native-markdown-display
- [ ] `NarrationText.jsx` → Audio playback controls
- [ ] `FeedbackPanel.jsx` → Native form inputs
- [ ] `FollowUpChat.jsx` → Chat UI (FlatList)

### 3.4 Component Conversion Pattern (NativeWind = Minimal Changes!)

```jsx
// WEB (before) — Tailwind CSS
<div className="flex flex-col gap-4 p-6 bg-surface rounded-xl">
  <h2 className="text-xl font-bold text-gold">Title</h2>
</div>

// NATIVE (after) — NativeWind (almost identical!)
<View className="flex flex-col gap-4 p-6 bg-surface rounded-xl">
  <Text className="text-xl font-bold text-gold">Title</Text>
</View>

// Only change: div→View, span→Text, button→Pressable
// Classes stay the same! Configure tokens in tailwind.config.js
```

### 3.5 Card Animations with Reanimated (Blueprint Patterns)

**3D Card Flip** (from Blueprint):
```jsx
import { useSharedValue, useAnimatedStyle, withTiming, interpolate } from 'react-native-reanimated';

function CardFlip({ isRevealed }) {
  const spin = useSharedValue(0);
  
  useEffect(() => {
    spin.value = withTiming(isRevealed ? 1 : 0, { duration: 400 });
  }, [isRevealed]);
  
  const frontStyle = useAnimatedStyle(() => {
    const rotateY = interpolate(spin.value, [0, 1], [0, 180]);
    return {
      transform: [{ perspective: 1000 }, { rotateY: `${rotateY}deg` }],
      opacity: spin.value < 0.5 ? 1 : 0,
    };
  });
  
  const backStyle = useAnimatedStyle(() => {
    const rotateY = interpolate(spin.value, [0, 1], [180, 360]);
    return {
      transform: [{ perspective: 1000 }, { rotateY: `${rotateY}deg` }],
      opacity: spin.value >= 0.5 ? 1 : 0,
    };
  });
  
  return (
    <View style={styles.container}>
      <Animated.View style={[styles.card, frontStyle]}>{/* Card back */}</Animated.View>
      <Animated.View style={[styles.card, backStyle]}>{/* Card face */}</Animated.View>
    </View>
  );
}
```

**Breathing Animation** (for meditation/concentrate screens):
```jsx
useEffect(() => {
  scale.value = withRepeat(
    withSequence(
      withTiming(1.2, { duration: 4000, easing: Easing.inOut(Easing.ease) }), // Inhale
      withTiming(1.2, { duration: 1000 }), // Hold
      withTiming(1.0, { duration: 4000, easing: Easing.inOut(Easing.ease) })  // Exhale
    ),
    -1, // Infinite
    true
  );
}, []);
```

**Error Wobble** (for invalid actions):
```jsx
const wobble = useSharedValue(0);
const triggerWobble = () => {
  wobble.value = withSequence(
    withTiming(-10, { duration: 50 }),
    withTiming(10, { duration: 50 }),
    withTiming(-10, { duration: 50 }),
    withTiming(10, { duration: 50 }),
    withTiming(0, { duration: 50 })
  );
};
```

### 3.6 Card Dragging with Reanimated DnD
```jsx
// Card dragging with react-native-reanimated-dnd
import { Draggable, DndProvider } from 'react-native-reanimated-dnd';

<DndProvider>
  <Draggable id="card-1" data={cardData}>
    <Card card={card} />
  </Draggable>
</DndProvider>
```

### 3.7 Modal Management with Modalfy
```jsx
// Replace ad-hoc modals with modal stack
import { createModalStack, ModalProvider } from 'react-native-modalfy';

const modalConfig = {
  CardDetail: CardModal,
  Settings: SettingsModal,
  Auth: AuthModal,
  FollowUp: FollowUpModal,
};

const stack = createModalStack(modalConfig);
// Then: modal.open('CardDetail', { card })
```

---

## Phase 4: Secondary Features (Week 6-8)

### 4.1 Journal System
- [ ] `Journal.jsx` → FlatList with sections
- [ ] `JournalEntryCard.jsx` → Pressable cards
- [ ] `JournalFilters.jsx` → Bottom sheet or modal
- [ ] Journal export (jspdf) → expo-sharing + expo-print

### 4.2 Charts & Analytics
- [ ] `charts/CardRelationshipGraph.jsx` → victory-native or react-native-svg
- [ ] `charts/TrendSparkline.jsx` → victory-native line chart
- [ ] `MoonPhaseIndicator.jsx` → Custom SVG (astronomy-engine works in RN)

### 4.3 Camera/Vision Features
- [ ] `CameraCapture.jsx` → expo-camera
- [ ] `PhotoInputModal.jsx` → expo-image-picker
- [ ] `VisionValidationPanel.jsx` → Native image display

### 4.4 Authentication
- [ ] `AuthModal.jsx` → Stack screen or modal
- [ ] OAuth flow → expo-auth-session or expo-web-browser
- [ ] Token storage → expo-secure-store

---

## Phase 5: Polish & Platform-Specific (Week 8-10)

### 5.1 Animations
- [ ] Card flip animations (Reanimated)
- [ ] Page transitions (React Navigation + Reanimated)
- [ ] Gesture interactions (card dragging, spread arrangement)
- [ ] Ambient effects (starfield → react-native-skia or simplified)

### 5.2 Platform Optimizations
- [ ] iOS: Safe areas, haptic feedback, SF Symbols
- [ ] Android: Material Design touches, back button handling
- [ ] Tablet: Adaptive layouts

### 5.3 Accessibility
- [ ] VoiceOver/TalkBack labels
- [ ] Dynamic type support
- [ ] Reduced motion respect
- [ ] Focus management

---

## Phase 6: Testing & Launch (Week 10-12)

### 6.1 Testing
- [ ] Unit tests with Jest + React Native Testing Library
- [ ] E2E tests with Detox or Maestro
- [ ] Manual testing on physical devices

### 6.2 App Store Preparation
- [ ] App icons and splash screens
- [ ] App Store screenshots
- [ ] Privacy policy updates
- [ ] EAS Build configuration

### 6.3 Migration Strategy
- [ ] Feature flag to toggle between WebView and native
- [ ] Gradual rollout via TestFlight/Internal testing
- [ ] Monitor crash reports and performance

---

## Files to Delete After Migration

Once native is stable, remove web-only code:
- `src/styles/tailwind.css` (replaced by StyleSheet)
- `vite.config.js`, `postcss.config.cjs`, `tailwind.config.js`
- `index.html`
- `src/main.jsx` (web entry)
- Cloudflare Worker static asset serving (keep API)

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Animation complexity | High | High | Start with simplified animations, iterate |
| TTS SDK compatibility | Medium | Medium | Test early, have fallback (expo-speech) |
| Chart library limitations | Medium | Low | victory-native is capable |
| Timeline slip | High | Medium | Prioritize core reading flow first |

---

## Recommended Approach

**Option A: Big Bang** (not recommended)
- Rewrite everything at once
- High risk, long time without shipping

**Option B: Incremental** (recommended)
- Keep WebView as fallback
- Build native screens one at a time
- Feature flag to toggle
- Ship native reading flow first, then journal, then secondary features

---

## Quick Wins (status as of 2026-02-03)

1. **Set up NativeWind** — Done in `native/` (v4.2 baseline).
2. **Install react-native-modalfy** — Installed; modal stack not yet integrated.
3. **Convert `Card.jsx`** — Initial flip exists in `native/src/components/Card/Card.jsx`.
4. **Add burnt for toasts** — Installed; not yet wired to providers.
5. **Test expo-speech** — Placeholder narration implemented in `native/src/components/AudioControls.jsx`.

**Next up**
1. **Wire `/api/tarot-reading` streaming** — Replace sample reading + narrative.
2. **Wire `/api/tts` + expo-av + caching** — Replace expo-speech placeholder.
3. **Universal links** — Add `associatedDomains` + Android `intentFilters`, and host AASA/assetlinks.

---

## Migration Effort Comparison

| Approach | Styling Effort | Animation Effort | Total Time |
|----------|---------------|------------------|------------|
| **Without NativeWind** | 100% rewrite | High | 4+ months |
| **With NativeWind** | ~20% (tag swaps) | Medium | 2-3 months |

**NativeWind is the key insight** — it reduces the migration from a full rewrite to mostly mechanical tag replacements (`div`→`View`, `button`→`Pressable`).

---

## Appendix: File-by-File Migration Map

### Priority Tiers
- P0: Core reading vertical slice + storage/audio primitives + navigation shell
- P1: Reading journey, coaching, follow-ups, personalization
- P2: Journal system (lists, entry cards, filters, export)
- P3: Account/auth/pricing/share + settings
- P4: Vision/camera + image workflows
- P5: Analytics/insights/charts + advanced visuals
- P6: Layout polish, utility UI, tablet/landscape, general UI cleanup
- P7: Web-only/legacy cleanup; drop or keep web-only

### Components (root)
- `src/components/Card.jsx` (P0) - Reanimated 3 3D flip + RNGH; blur approximation
- `src/components/DeckRitual.jsx` (P0) - Reanimated sequences + haptics
- `src/components/DeckPile.jsx` (P0) - RNGH drag + Reanimated
- `src/components/ReadingGrid.jsx` (P0) - View + Flex layout
- `src/components/ReadingDisplay.jsx` (P0) - ScrollView + grid
- `src/components/ReadingBoard.jsx` (P0) - screen orchestration
- `src/components/ReadingPreparation.jsx` (P0) - pre-reading screen
- `src/components/StreamingNarrative.jsx` (P0) - streaming text display
- `src/components/MarkdownRenderer.jsx` (P0) - replace with RN markdown renderer
- `src/components/NarrationText.jsx` (P0) - expo-av controls
- `src/components/NarrationProgress.jsx` (P0) - RN progress UI
- `src/components/NarrationStatus.jsx` (P0) - RN status UI
- `src/components/AudioControls.jsx` (P0) - expo-av playback UI
- `src/components/QuestionInput.jsx` (P0) - TextInput + KeyboardAvoidingView
- `src/components/SpreadSelector.jsx` (P0) - FlatList + Pressable
- `src/components/SpreadTable.jsx` (P0) - RN grid layout
- `src/components/SpreadPatterns.jsx` (P0) - RN list/cards
- `src/components/SpreadPatternThumbnail.jsx` (P0) - RN Image
- `src/components/SpreadProgressIndicator.jsx` (P0) - RN progress
- `src/components/DeckSelector.jsx` (P0) - FlatList + Pressable
- `src/components/ResponsiveSpreadArt.jsx` (P0) - RN Image + layout
- `src/components/RitualControls.jsx` (P0) - RN buttons
- `src/components/CardModal.jsx` (P0) - modalfy stack
- `src/components/ConfirmModal.jsx` (P6) - modalfy or bottom sheet
- `src/components/StepProgress.jsx` (P0) - RN stepper UI
- `src/components/CarouselDots.jsx` (P0) - RN indicator
- `src/components/NarrativeSkeleton.jsx` (P0) - RN skeleton
- `src/components/InlineStatus.jsx` (P0) - RN status pill
- `src/components/GuidedIntentionCoach.jsx` (P1) - RN UI + coach logic
- `src/components/QuickIntentionCard.jsx` (P1) - RN card
- `src/components/CoachSuggestion.jsx` (P1) - RN card
- `src/components/FollowUpChat.jsx` (P1) - FlatList + input
- `src/components/FollowUpDrawer.jsx` (P1) - bottom sheet
- `src/components/FollowUpModal.jsx` (P1) - modalfy
- `src/components/FeedbackPanel.jsx` (P1) - RN form
- `src/components/PersonalizationBanner.jsx` (P1) - RN banner
- `src/components/PatternAlertBanner.jsx` (P1) - RN banner
- `src/components/SavedIntentionsModal.jsx` (P1) - modalfy
- `src/components/SavedIntentionsList.jsx` (P1) - FlatList
- `src/components/UpgradeNudge.jsx` (P3) - RN banner + pricing link
- `src/components/ExperienceSettings.jsx` (P3) - RN settings UI
- `src/components/UserMenu.jsx` (P3) - ActionSheet/menu
- `src/components/AuthModal.jsx` (P3) - modal or stack screen
- `src/components/GlobalNav.jsx` (P0) - React Navigation headers
- `src/components/Header.jsx` (P0) - React Navigation header
- `src/components/MobileBottomNav.jsx` (P0) - React Navigation tabs
- `src/components/MobileActionBar.jsx` (P6) - RN toolbar if needed
- `src/components/MobileInfoSection.jsx` (P6) - RN layout
- `src/components/MobileSettingsDrawer.jsx` (P3) - bottom sheet
- `src/components/LandscapeSplitView.jsx` (P6) - responsive layout
- `src/components/PageTransition.jsx` (P7) - drop, use navigation transitions
- `src/components/AnimatedRoutes.jsx` (P7) - drop, replace with navigation
- `src/components/Tooltip.jsx` (P6) - RN tooltip library or drop
- `src/components/SkipLink.jsx` (P7) - drop (web-only)
- `src/components/GlowToggle.jsx` (P6) - RN switch + styling
- `src/components/HelperToggle.jsx` (P6) - RN switch
- `src/components/MemoryManager.jsx` (P6) - review for web APIs
- `src/components/InsightsErrorBoundary.jsx` (P6) - RN ErrorBoundary
- `src/components/Icon.jsx` (P0) - RN icon component
- `src/components/TableuLogo.jsx` (P0) - RN SVG/Image
- `src/components/Journal.jsx` (P2) - FlatList + sections
- `src/components/JournalFilters.jsx` (P2) - bottom sheet filters
- `src/components/JournalEntryCard.jsx` (P2) - review legacy vs journal/ version
- `src/components/JournalIcons.jsx` (P2) - RN icons
- `src/components/Journal_backup.jsx` (P7) - drop legacy
- `src/components/CardSymbolInsights.jsx` (P5) - RN UI + insights data
- `src/components/AmberStarfield.jsx` (P6) - Skia or static image
- `src/components/MoonPhaseIndicator.jsx` (P5) - RN SVG
- `src/components/CameraCapture.jsx` (P4) - expo-camera
- `src/components/PhotoInputModal.jsx` (P4) - expo-image-picker + modalfy
- `src/components/ImagePreview.jsx` (P4) - RN Image
- `src/components/VisionValidationPanel.jsx` (P4) - RN panel
- `src/components/VisionHeatmapOverlay.jsx` (P4) - RN overlay
- `src/components/TactileLensOverlay.jsx` (P4) - RN overlay
- `src/components/GestureCoachOverlay.jsx` (P6) - RN overlay
- `src/components/InteractiveCardOverlay.jsx` (P4) - RNGH overlay
- `src/components/readingBoardUtils.js` (P0) - shared; check for DOM usage
- `src/components/icons.js` (P0) - map to RN icon set

### Components (share)
- `src/components/share/SharedSpreadView.jsx` (P3) - RN read-only view
- `src/components/share/CollaborativeNotesPanel.jsx` (P3) - RN notes UI

### Components (ReadingJourney)
- `src/components/ReadingJourney/index.jsx` (P1) - RN container
- `src/components/ReadingJourney/JourneyContent.jsx` (P1) - RN layout
- `src/components/ReadingJourney/JourneyMobileSheet.jsx` (P1) - bottom sheet
- `src/components/ReadingJourney/JourneySidebar.jsx` (P6) - tablet layout
- `src/components/ReadingJourney/CoachSuggestionSwitcher.jsx` (P1) - RN switcher
- `src/components/ReadingJourney/hooks/usePatternsSnapshot.js` (P1) - refactor; remove DOM/storage
- `src/components/ReadingJourney/sections/AchievementsRow.jsx` (P1) - RN row
- `src/components/ReadingJourney/sections/BackfillBanner.jsx` (P1) - RN banner
- `src/components/ReadingJourney/sections/CadenceSection.jsx` (P5) - RN chart
- `src/components/ReadingJourney/sections/CardsCallingYou.jsx` (P1) - RN list
- `src/components/ReadingJourney/sections/ContextBreakdown.jsx` (P1) - RN layout
- `src/components/ReadingJourney/sections/EmptyState.jsx` (P1) - RN empty state
- `src/components/ReadingJourney/sections/ExportSection.jsx` (P2) - expo-print/share
- `src/components/ReadingJourney/sections/JourneyStorySection.jsx` (P1) - RN layout
- `src/components/ReadingJourney/sections/JournalSummarySection.jsx` (P2) - journal summary UI
- `src/components/ReadingJourney/sections/MajorArcanaMap.jsx` (P5) - RN SVG/graph
- `src/components/ReadingJourney/sections/PatternsSnapshotPanel.jsx` (P1) - RN panel
- `src/components/ReadingJourney/sections/SeasonSummary.jsx` (P1) - RN layout

### Components (nudges)
- `src/components/nudges/index.js` (P1) - shared
- `src/components/nudges/JournalNudge.jsx` (P2) - RN banner
- `src/components/nudges/RitualNudge.jsx` (P1) - RN banner
- `src/components/nudges/AccountNudge.jsx` (P3) - RN banner

### Components (journal)
- `src/components/journal/JournalFloatingControls.jsx` (P2) - RN floating actions
- `src/components/journal/JournalSummaryBand.jsx` (P2) - RN summary
- `src/components/journal/JournalStatusBanner.jsx` (P2) - RN banner
- `src/components/journal/JournalEmptyState.jsx` (P2) - RN empty state
- `src/components/journal/entry-card/EntryCard.primitives.js` (P2) - refactor to RN primitives
- `src/components/journal/entry-card/JournalEntryCard.jsx` (P2) - RN card
- `src/components/journal/entry-card/index.js` (P2) - shared barrel
- `src/components/journal/entry-card/EntryActions/index.js` (P2) - shared barrel
- `src/components/journal/entry-card/EntryActions/ActionMenu.jsx` (P2) - ActionSheet
- `src/components/journal/entry-card/EntryActions/ShareLinksPanel.jsx` (P2) - share sheet
- `src/components/journal/entry-card/EntryHeader/index.js` (P2) - shared barrel
- `src/components/journal/entry-card/EntryHeader/ComfortableHeader.jsx` (P2) - RN header
- `src/components/journal/entry-card/EntryHeader/CompactHeader.jsx` (P2) - RN header
- `src/components/journal/entry-card/EntrySections/index.js` (P2) - shared barrel
- `src/components/journal/entry-card/EntrySections/FollowUpSection.jsx` (P2) - RN section
- `src/components/journal/entry-card/EntrySections/KnowledgeGraphSection.jsx` (P5) - RN chart/graph
- `src/components/journal/entry-card/EntrySections/KeyThemesSection.jsx` (P2) - RN section
- `src/components/journal/entry-card/EntrySections/NarrativeSection.jsx` (P2) - RN section
- `src/components/journal/entry-card/EntrySections/QuestionSection.jsx` (P2) - RN section
- `src/components/journal/entry-card/EntrySections/ReflectionsSection.jsx` (P2) - RN section
- `src/components/journal/entry-card/EntrySections/CardsDrawnSection/index.js` (P2) - shared barrel
- `src/components/journal/entry-card/EntrySections/CardsDrawnSection/CardFan.jsx` (P2) - Reanimated fan layout
- `src/components/journal/entry-card/EntrySections/CardsDrawnSection/CardStack.jsx` (P2) - RN layout
- `src/components/journal/entry-card/EntrySections/CardsDrawnSection/CardThumbnail.jsx` (P2) - RN Image
- `src/components/journal/entry-card/EntrySections/CardsDrawnSection/CardsDrawnSection.jsx` (P2) - RN section
- `src/components/journal/entry-card/EntrySections/CardsDrawnSection/useCardFan.js` (P2) - Reanimated hook
- `src/components/journal/entry-card/hooks/index.js` (P2) - shared barrel
- `src/components/journal/entry-card/hooks/useActionMenu.js` (P2) - ActionSheet
- `src/components/journal/entry-card/hooks/useEntryActions.js` (P2) - RN share/save
- `src/components/journal/entry-card/hooks/useEntryMetadata.js` (P2) - shared; verify for DOM

### Components (illustrations)
- `src/components/illustrations/ArchetypeEmptyIllustration.jsx` (P6) - RN SVG/Image
- `src/components/illustrations/BadgeIllustrations.jsx` (P6) - RN SVG/Image
- `src/components/illustrations/EmptyJournalIllustration.jsx` (P6) - RN SVG/Image
- `src/components/illustrations/NoFiltersIllustration.jsx` (P6) - RN SVG/Image
- `src/components/illustrations/SuitIcons.jsx` (P0) - RN SVG
- `src/components/illustrations/suitIconUtils.js` (P0) - shared; verify for DOM

### Components (charts)
- `src/components/charts/CadenceChart.jsx` (P5) - victory-native
- `src/components/charts/CardRelationshipGraph.jsx` (P5) - RN SVG/graph
- `src/components/charts/TrendSparkline.jsx` (P5) - victory-native

### Pages
- `src/pages/AccountPage.jsx` (P3) - RN account screen
- `src/pages/PricingPage.jsx` (P3) - RN pricing screen
- `src/pages/OAuthCallbackPage.jsx` (P3) - expo-auth-session
- `src/pages/ResetPasswordPage.jsx` (P3) - RN form
- `src/pages/VerifyEmailPage.jsx` (P3) - RN form
- `src/pages/ShareReading.jsx` (P3) - RN share screen
- `src/pages/CardGalleryPage.jsx` (P3) - RN gallery screen
- `src/pages/AdminDashboard.jsx` (P7) - keep web-only unless required
- `src/pages/cardGallerySelectors.js` (P3) - shared; verify for DOM

### Contexts
- `src/contexts/PreferencesContext.jsx` (P0) - MMKV storage
- `src/contexts/ReadingContext.jsx` (P0) - remove DOM/localStorage
- `src/contexts/ToastContext.jsx` (P0) - burnt
- `src/contexts/AuthContext.jsx` (P3) - SecureStore + auth session
- `src/contexts/SubscriptionContext.jsx` (P3) - mobile purchase flow

### Hooks
- `src/hooks/useTarotState.js` (P0) - RN-safe state
- `src/hooks/useUISounds.js` (P0) - expo-av
- `src/hooks/useAudioController.js` (P0) - expo-av
- `src/hooks/useHaptic.js` (P0) - expo-haptics or nitro
- `src/hooks/useKeyboardOffset.js` (P0) - KeyboardAvoidingView
- `src/hooks/useReducedMotion.js` (P0) - AccessibilityInfo
- `src/hooks/useAnimatePresence.js` (P0) - Reanimated
- `src/hooks/useAnimeScope.js` (P0) - Reanimated
- `src/hooks/useSwipeDismiss.js` (P0) - RNGH
- `src/hooks/useSwipeNavigation.js` (P0) - RNGH
- `src/hooks/useAndroidBackGuard.js` (P0) - BackHandler
- `src/hooks/useAutoGrow.js` (P0) - TextInput + layout
- `src/hooks/useInlineStatus.js` (P0) - RN status
- `src/hooks/useFeatureFlags.js` (P0) - MMKV
- `src/hooks/useBodyScrollLock.js` (P7) - drop (web-only)
- `src/hooks/useModalA11y.js` (P6) - navigation focus + a11y
- `src/hooks/useLandscape.js` (P6) - Dimensions
- `src/hooks/useSmallScreen.js` (P6) - Dimensions
- `src/hooks/useHandsetLayout.js` (P6) - Dimensions
- `src/hooks/useLocation.js` (P3) - expo-location
- `src/hooks/useJourneyData.js` (P1) - RN storage/network
- `src/hooks/useArchetypeJourney.js` (P1) - shared; verify for DOM
- `src/hooks/useJournal.js` (P2) - SQLite
- `src/hooks/useJournalFilters.js` (P2) - SQLite
- `src/hooks/useJournalSummary.js` (P2) - SQLite
- `src/hooks/useJournalAnalytics.js` (P2) - SQLite
- `src/hooks/useJournalSharing.js` (P2) - RN share
- `src/hooks/useSaveReading.js` (P2) - SQLite + storage
- `src/hooks/useMemories.js` (P2) - SQLite
- `src/hooks/useVisionAnalysis.js` (P4) - native ML or API
- `src/hooks/useVisionValidation.js` (P4) - RN image handling
- `src/hooks/useTactileLens.js` (P4) - RN overlay

### Utils
- `src/utils/spreadArt.js` (P0) - shared; ensure RN image paths
- `src/utils/spreadEntitlements.js` (P0) - shared
- `src/utils/personalization.js` (P1) - shared; verify for DOM/storage
- `src/utils/personalizationStorage.js` (P1) - MMKV/SQLite

### Lib
- `src/lib/deck.js` (P0) - shared
- `src/lib/cardLookup.js` (P0) - shared
- `src/lib/suitColors.js` (P0) - shared
- `src/lib/positionSynthesis.js` (P0) - shared
- `src/lib/cardInsights.js` (P5) - shared; verify for DOM
- `src/lib/journalInsights.js` (P2) - shared; verify for DOM
- `src/lib/journal/constants.js` (P2) - shared
- `src/lib/journal/utils.js` (P2) - shared
- `src/lib/journal/fetchEntryById.js` (P2) - SQLite
- `src/lib/followUpSuggestions.js` (P1) - shared
- `src/lib/coachSuggestionUtils.js` (P1) - shared
- `src/lib/intentionCoach.js` (P1) - shared
- `src/lib/archetypeJourney.js` (P1) - shared
- `src/lib/questionQuality.js` (P0) - shared
- `src/lib/microcopy.js` (P0) - shared
- `src/lib/themeText.js` (P0) - shared
- `src/lib/textUtils.js` (P0) - shared
- `src/lib/formatting.js` (P0) - shared
- `src/lib/highlightUtils.js` (P0) - shared
- `src/lib/utils.js` (P0) - shared; verify for DOM
- `src/lib/safeStorage.js` (P0) - MMKV/SecureStore
- `src/lib/audio.js` (P0) - expo-av
- `src/lib/audioSpeechSDK.js` (P0) - Azure REST TTS
- `src/lib/audioCache.js` (P0) - expo-file-system
- `src/lib/audioHume.js` (P0) - replace if web SDK
- `src/lib/pdfExport.js` (P2) - expo-print + expo-sharing
- `src/lib/symbolElementBridge.js` (P7) - likely web-only
- `src/lib/coachStorage.js` (P1) - MMKV
- `src/lib/onboardingMetrics.js` (P3) - MMKV + analytics
- `src/lib/onboardingVariant.js` (P3) - MMKV
