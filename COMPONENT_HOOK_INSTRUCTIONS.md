# Component Hook Instructions

Explicit, actionable instructions for each component. Copy-paste ready.

---

## 🔴 CRITICAL PRIORITY

### 1. GuidedIntentionCoach.jsx
**Location:** `src/components/GuidedIntentionCoach.jsx`
**Current:** Uses FocusTrap library, no custom hooks
**Add:**
```javascript
import { useModalA11y } from '../hooks/useModalA11y';
import { useSmallScreen } from '../hooks/useSmallScreen';
import { useLandscape } from '../hooks/useLandscape';
import { useReducedMotion } from '../hooks/useReducedMotion';
```
**Changes:**
1. Replace manual focus/scroll lock with `useModalA11y(isOpen, { onClose, containerRef })`
2. Use `useSmallScreen()` to adjust suggestion card layout
3. Use `useLandscape()` to show horizontal step indicators in landscape
4. Use `useReducedMotion()` to disable streaming text animation

---

### 2. MobileActionBar.jsx
**Location:** `src/components/MobileActionBar.jsx`
**Current:** No hooks
**Add:**
```javascript
import { useLandscape } from '../hooks/useLandscape';
```
**Changes:**
1. Add `const isLandscape = useLandscape();`
2. In landscape: use icon-only buttons, reduce padding, thinner bar height
3. Example: `className={isLandscape ? 'py-1 gap-1' : 'py-2 gap-2'}`

---

### 3. ConfirmModal.jsx
**Location:** `src/components/ConfirmModal.jsx`
**Current:** Manual focus restore, manual escape handling, FocusTrap
**Add:**
```javascript
import { useModalA11y, createBackdropHandler } from '../hooks/useModalA11y';
```
**Changes:**
1. Remove manual `previousFocusRef` logic (lines 21-38)
2. Add `const modalRef = useRef(null);`
3. Add `useModalA11y(isOpen, { onClose, containerRef: modalRef });`
4. Replace `onClick={handleBackdropClick}` with `onClick={createBackdropHandler(onClose)}`
5. Remove manual `onKeyDown` escape handler - hook handles it

---

### 4. AuthModal.jsx
**Location:** `src/components/AuthModal.jsx`
**Current:** Uses FocusTrap, no useModalA11y
**Add:**
```javascript
import { useModalA11y, createBackdropHandler } from '../hooks/useModalA11y';
import { useSmallScreen } from '../hooks/useSmallScreen';
```
**Changes:**
1. Add `const modalRef = useRef(null);`
2. Add `useModalA11y(isOpen, { onClose, containerRef: modalRef });`
3. Use `useSmallScreen()` for full-width inputs on mobile
4. Remove any manual scroll lock or focus management

---

### 5. JournalInsightsPanel.jsx
**Location:** `src/components/JournalInsightsPanel.jsx`
**Current:** No responsive hooks
**Add:**
```javascript
import { useSmallScreen } from '../hooks/useSmallScreen';
import { useLandscape } from '../hooks/useLandscape';
import { useReducedMotion } from '../hooks/useReducedMotion';
```
**Changes:**
1. Add `const isSmallScreen = useSmallScreen();`
2. Add `const isLandscape = useLandscape();`
3. In landscape: 2-column layout for stats cards
4. On small screen: stack charts vertically, reduce font sizes
5. Use `useReducedMotion()` for chart animations

---

### 6. CameraCapture.jsx
**Location:** `src/components/CameraCapture.jsx`
**Current:** No responsive hooks
**Add:**
```javascript
import { useLandscape } from '../hooks/useLandscape';
```
**Changes:**
1. Add `const isLandscape = useLandscape();`
2. In landscape: position controls on side instead of bottom
3. Adjust video container aspect ratio for landscape
4. Example: `className={isLandscape ? 'flex-row' : 'flex-col'}`

---

## 🟠 HIGH PRIORITY

### 7. ReadingDisplay.jsx
**Location:** `src/components/ReadingDisplay.jsx`
**Current:** useSmallScreen, useFeatureFlags, useSaveReading, contexts
**Add:**
```javascript
import { useReducedMotion } from '../hooks/useReducedMotion';
import { useLandscape } from '../hooks/useLandscape';
```
**Changes:**
1. Add `const prefersReducedMotion = useReducedMotion();`
2. Add `const isLandscape = useLandscape();`
3. In landscape: side-by-side card grid + narrative panel
4. Pass `prefersReducedMotion` to child animations

---

### 8. ReadingGrid.jsx
**Location:** `src/components/ReadingGrid.jsx`
**Current:** useSmallScreen, useReducedMotion
**Add:**
```javascript
import { useLandscape } from '../hooks/useLandscape';
```
**Changes:**
1. Add `const isLandscape = useLandscape();`
2. Adjust grid columns: `isLandscape ? Math.min(cards.length, 5) : 3`
3. Enable horizontal scroll for large spreads in landscape
4. Reduce card scale in cramped landscape: `--card-scale: 0.75`

---

### 9. SpreadSelector.jsx
**Location:** `src/components/SpreadSelector.jsx`
**Current:** useReducedMotion only
**Add:**
```javascript
import { useSmallScreen } from '../hooks/useSmallScreen';
import { useLandscape } from '../hooks/useLandscape';
```
**Changes:**
1. Add `const isSmallScreen = useSmallScreen();`
2. Add `const isLandscape = useLandscape();`
3. On small: 2-column grid instead of 3
4. In landscape: smaller thumbnails, horizontal scroll

---

### 10. DeckRitual.jsx
**Location:** `src/components/DeckRitual.jsx`
**Current:** useReducedMotion only
**Add:**
```javascript
import { useSmallScreen } from '../hooks/useSmallScreen';
import { useLandscape } from '../hooks/useLandscape';
```
**Changes:**
1. Add `const isSmallScreen = useSmallScreen();`
2. Add `const isLandscape = useLandscape();`
3. In landscape: horizontal layout for knock + cut controls
4. Smaller touch targets that still meet 44px minimum

---

### 11. TarotReading.jsx
**Location:** `src/TarotReading.jsx`
**Current:** useReducedMotion, useSmallScreen, useSaveReading, contexts
**Add:**
```javascript
import { useLandscape } from './hooks/useLandscape';
```
**Changes:**
1. Add `const isLandscape = useLandscape();`
2. Pass `isLandscape` to child components that need layout changes
3. Adjust main container padding in landscape

---

## 🟡 MEDIUM PRIORITY

### 12. VisionValidationPanel.jsx
**Location:** `src/components/VisionValidationPanel.jsx`
**Current:** useVisionValidation
**Add:**
```javascript
import { useFeatureFlags } from '../hooks/useFeatureFlags';
import { useSmallScreen } from '../hooks/useSmallScreen';
```
**Changes:**
1. Add `const { visionResearch } = useFeatureFlags();`
2. Early return if `!visionResearch`
3. Use `useSmallScreen()` for compact layout

---

### 13. VisionHeatmapOverlay.jsx
**Location:** `src/components/VisionHeatmapOverlay.jsx`
**Current:** No hooks
**Add:**
```javascript
import { useFeatureFlags } from '../hooks/useFeatureFlags';
```
**Changes:**
1. Add feature gate check at component level
2. Return null if vision research disabled

---

### 14. CardSymbolInsights.jsx
**Location:** `src/components/CardSymbolInsights.jsx`
**Current:** No hooks
**Add:**
```javascript
import { useFeatureFlags } from '../hooks/useFeatureFlags';
import { useSmallScreen } from '../hooks/useSmallScreen';
```
**Changes:**
1. Add feature gate for vision-dependent features
2. Use small screen for compact symbol display

---

### 15. PhotoInputModal.jsx
**Location:** `src/components/PhotoInputModal.jsx`
**Current:** useModalA11y
**Add:**
```javascript
import { useSmallScreen } from '../hooks/useSmallScreen';
import { useLandscape } from '../hooks/useLandscape';
```
**Changes:**
1. Use `useLandscape()` for camera preview layout
2. Use `useSmallScreen()` for button sizing

---

### 16. CardModal.jsx
**Location:** `src/components/CardModal.jsx`
**Current:** useModalA11y
**Add:**
```javascript
import { useSmallScreen } from '../hooks/useSmallScreen';
import { useLandscape } from '../hooks/useLandscape';
import { useReducedMotion } from '../hooks/useReducedMotion';
```
**Changes:**
1. Use `useLandscape()` for side-by-side card + details
2. Use `useReducedMotion()` for modal animations
3. Use `useSmallScreen()` for full-width on mobile

---

### 17. Header.jsx
**Location:** `src/components/Header.jsx`
**Current:** useReducedMotion
**Add:**
```javascript
import { useSmallScreen } from '../hooks/useSmallScreen';
import { useLandscape } from '../hooks/useLandscape';
```
**Changes:**
1. Condense header in landscape mode
2. Smaller logo/title on small screens

---

### 18. StepProgress.jsx
**Location:** `src/components/StepProgress.jsx`
**Current:** No custom hooks
**Add:**
```javascript
import { useSmallScreen } from '../hooks/useSmallScreen';
import { useLandscape } from '../hooks/useLandscape';
import { useReducedMotion } from '../hooks/useReducedMotion';
```
**Changes:**
1. Icon-only steps on small screens
2. Horizontal compact layout in landscape
3. Disable step transition animations if reduced motion

---

### 19. GlobalNav.jsx
**Location:** `src/components/GlobalNav.jsx`
**Current:** Only react-router hooks
**Add:**
```javascript
import { useSmallScreen } from '../hooks/useSmallScreen';
import { useReducedMotion } from '../hooks/useReducedMotion';
```
**Changes:**
1. Smaller nav buttons on small screens
2. Disable hover animations if reduced motion

---

### 20. StreamingNarrative.jsx
**Location:** `src/components/StreamingNarrative.jsx`
**Current:** useReducedMotion, useSmallScreen
**Add:**
```javascript
import { useLandscape } from '../hooks/useLandscape';
```
**Changes:**
1. In landscape: narrower max-width, side panel layout
2. Adjust scroll behavior for landscape

---

### 21. Journal.jsx
**Location:** `src/components/Journal.jsx`
**Current:** useAuth, useJournal
**Add:**
```javascript
import { useSmallScreen } from '../hooks/useSmallScreen';
import { useLandscape } from '../hooks/useLandscape';
import { useReducedMotion } from '../hooks/useReducedMotion';
```
**Changes:**
1. 2-column entry grid in landscape
2. Compact list view on small screens
3. Disable list animations if reduced motion

---

### 22. JournalEntryCard.jsx
**Location:** `src/components/JournalEntryCard.jsx`
**Current:** useSmallScreen
**Add:**
```javascript
import { useLandscape } from '../hooks/useLandscape';
import { useReducedMotion } from '../hooks/useReducedMotion';
```
**Changes:**
1. Horizontal card layout in landscape
2. Disable expand/collapse animations if reduced motion

---

## 🟢 LOW PRIORITY (Nice to Have)

### 23. Card.jsx
**Location:** `src/components/Card.jsx`
**Current:** useReducedMotion, useSmallScreen
**Add:**
```javascript
import { useLandscape } from '../hooks/useLandscape';
```
**Changes:**
1. Slightly smaller card in cramped landscape
2. Pass landscape state to flip animation

---

### 24. DeckSelector.jsx
**Location:** `src/components/DeckSelector.jsx`
**Current:** useReducedMotion
**Add:**
```javascript
import { useSmallScreen } from '../hooks/useSmallScreen';
import { useLandscape } from '../hooks/useLandscape';
```
**Changes:**
1. Horizontal scroll for deck options in landscape
2. Smaller deck preview cards on small screens

---

### 25. DeckPile.jsx
**Location:** `src/components/DeckPile.jsx`
**Current:** useReducedMotion
**Add:**
```javascript
import { useSmallScreen } from '../hooks/useSmallScreen';
```
**Changes:**
1. Smaller pile on small screens

---

### 26. AudioControls.jsx
**Location:** `src/components/AudioControls.jsx`
**Current:** usePreferences context
**Add:**
```javascript
import { useSmallScreen } from '../hooks/useSmallScreen';
```
**Changes:**
1. Stack controls vertically on small screens

---

### 27. ExperienceSettings.jsx
**Location:** `src/components/ExperienceSettings.jsx`
**Current:** usePreferences context
**Add:**
```javascript
import { useSmallScreen } from '../hooks/useSmallScreen';
```
**Changes:**
1. Full-width toggles on small screens

---

### 28. RitualControls.jsx
**Location:** `src/components/RitualControls.jsx`
**Current:** usePreferences context
**Add:**
```javascript
import { useSmallScreen } from '../hooks/useSmallScreen';
import { useLandscape } from '../hooks/useLandscape';
import { useReducedMotion } from '../hooks/useReducedMotion';
```
**Changes:**
1. Compact ritual UI in landscape
2. Disable knock ripple animation if reduced motion

---

### 29. QuestionInput.jsx
**Location:** `src/components/QuestionInput.jsx`
**Current:** No custom hooks
**Add:**
```javascript
import { useSmallScreen } from '../hooks/useSmallScreen';
import { useLandscape } from '../hooks/useLandscape';
```
**Changes:**
1. Taller textarea in landscape (more horizontal space)
2. Adjust placeholder text length on small screens

---

### 30. FeedbackPanel.jsx
**Location:** `src/components/FeedbackPanel.jsx`
**Current:** No custom hooks
**Add:**
```javascript
import { useSmallScreen } from '../hooks/useSmallScreen';
```
**Changes:**
1. Stack rating buttons vertically on small screens

---

### 31. ReadingPreparation.jsx
**Location:** `src/components/ReadingPreparation.jsx`
**Current:** No custom hooks (props-driven)
**Add:**
```javascript
import { useSmallScreen } from '../hooks/useSmallScreen';
import { useLandscape } from '../hooks/useLandscape';
```
**Changes:**
1. Adjust tab sizing based on screen
2. Compact section headers in landscape

---

### 32. MobileSettingsDrawer.jsx
**Location:** `src/components/MobileSettingsDrawer.jsx`
**Current:** useModalA11y
**Add:**
```javascript
import { useLandscape } from '../hooks/useLandscape';
import { useReducedMotion } from '../hooks/useReducedMotion';
```
**Changes:**
1. Side drawer instead of bottom drawer in landscape
2. Disable slide animation if reduced motion

---

### 33. SharedSpreadView.jsx
**Location:** `src/components/share/SharedSpreadView.jsx`
**Current:** No custom hooks
**Add:**
```javascript
import { useSmallScreen } from '../../hooks/useSmallScreen';
import { useLandscape } from '../../hooks/useLandscape';
import { useReducedMotion } from '../../hooks/useReducedMotion';
```
**Changes:**
1. Responsive card grid for shared view
2. Landscape-optimized layout

---

### 34. CollaborativeNotesPanel.jsx
**Location:** `src/components/share/CollaborativeNotesPanel.jsx`
**Current:** Internal useLocalStorage only
**Add:**
```javascript
import { useSmallScreen } from '../../hooks/useSmallScreen';
import { useReducedMotion } from '../../hooks/useReducedMotion';
```
**Changes:**
1. Compact notes list on small screens
2. Disable typing indicator animation if reduced motion

---

## ⬜ NO CHANGES NEEDED

These components are appropriately simple or already well-configured:

| Component | Reason |
|-----------|--------|
| **UserMenu.jsx** | Auth context only - correct |
| **Tooltip.jsx** | Self-contained positioning |
| **MarkdownRenderer.jsx** | Pure rendering |
| **ImagePreview.jsx** | Pure preview |
| **Icon.jsx** | Pure wrapper |
| **TableuLogo.jsx** | Static SVG |
| **HelperToggle.jsx** | Simple toggle |
| **GlowToggle.jsx** | Simple toggle |
| **CarouselDots.jsx** | Simple indicator |
| **MobileInfoSection.jsx** | Static content |
| **SpreadPatternThumbnail.jsx** | Pure SVG |
| **SpreadTable.jsx** | Already has useReducedMotion |
| **InteractiveCardOverlay.jsx** | Already has useReducedMotion |
| **CoachSuggestion.jsx** | Props-driven, parent handles responsive |
| **SavedIntentionsList.jsx** | Props-driven |
| **JournalFilters.jsx** | Props-driven |
| **ArchetypeJourney.jsx** | Auth context appropriate |
| **ArchetypeJourneySection.jsx** | Props-driven |
| **HumeAudioControls.jsx** | Standalone, props-driven |

---

## Summary Statistics

| Priority | Components | Estimated Effort |
|----------|------------|------------------|
| 🔴 Critical | 6 | 2-3 hours |
| 🟠 High | 5 | 1-2 hours |
| 🟡 Medium | 11 | 2-3 hours |
| 🟢 Low | 12 | 2-3 hours |
| ⬜ None | 18 | 0 |
| **Total** | **52** | **7-11 hours** |

---

## Quick Reference: Import Snippets

### Responsive Trio
```javascript
import { useSmallScreen } from '../hooks/useSmallScreen';
import { useLandscape } from '../hooks/useLandscape';
import { useReducedMotion } from '../hooks/useReducedMotion';
```

### Modal A11y
```javascript
import { useModalA11y, createBackdropHandler } from '../hooks/useModalA11y';
```

### Feature Flags
```javascript
import { useFeatureFlags } from '../hooks/useFeatureFlags';
```

### Proposed Composite (Future)
```javascript
import { useResponsive } from '../hooks/useResponsive';
const { isSmallScreen, isLandscape, prefersReducedMotion } = useResponsive();
```
