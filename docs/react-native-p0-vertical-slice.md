# P0 Native Vertical Slice: Card + Reading Flow

## Goal
Deliver a native reading flow that covers spread selection, ritual, dealing, revealing, and narrative display with placeholder audio controls.

## In scope
- Select a spread and confirm.
- Enter a question or intention.
- Perform ritual (knock/cut) and deal cards.
- Reveal cards with native flip animation.
- Show streaming narrative placeholder and audio controls stub.

## Out of scope
- Journal list, filters, and export.
- Account, auth, pricing, and subscription flow.
- Camera, vision, and image validation.
- Analytics, insights, charts, and advanced overlays.

## File conversion map
| Web file | Native destination | Notes |
| --- | --- | --- |
| `src/TarotReading.jsx` | `native/src/screens/ReadingScreen.jsx` | Split into smaller RN components; replace router state with navigation params. |
| `src/components/SpreadSelector.jsx` | `native/src/components/SpreadSelector.jsx` | Replace DOM layout with FlatList + Pressable. |
| `src/components/QuestionInput.jsx` | `native/src/components/QuestionInput.jsx` | Replace textarea/input with TextInput + KeyboardAvoidingView. |
| `src/components/ReadingPreparation.jsx` | `native/src/components/ReadingPreparation.jsx` | Simplify panels to RN stacks, remove DOM-only scroll logic. |
| `src/components/DeckRitual.jsx` | `native/src/components/DeckRitual.jsx` | Reanimated sequences + haptics. |
| `src/components/DeckPile.jsx` | `native/src/components/DeckPile.jsx` | RNGH drag + Reanimated. |
| `src/components/Card.jsx` | `native/src/components/Card/Card.jsx` | 3D flip with Reanimated; replace blur with opacity/scale approximation. |
| `src/components/ReadingGrid.jsx` | `native/src/components/ReadingGrid.jsx` | Flex layout grid with View/Pressable. |
| `src/components/ReadingDisplay.jsx` | `native/src/components/ReadingDisplay.jsx` | ScrollView with card grid and narrative section. |
| `src/components/StreamingNarrative.jsx` | `native/src/components/StreamingNarrative.jsx` | Replace DOM streaming with RN Text + incremental state. |
| `src/components/NarrationText.jsx` | `native/src/components/NarrationText.jsx` | expo-av controls + progress state. |
| `src/components/AudioControls.jsx` | `native/src/components/AudioControls.jsx` | RN playback controls (no Web Audio). |
| `src/contexts/ReadingContext.jsx` | `native/src/contexts/ReadingContext.jsx` | Remove window/document usage; replace localStorage with MMKV. |
| `src/contexts/PreferencesContext.jsx` | `native/src/contexts/PreferencesContext.jsx` | MMKV wrapper with user-scoped keys. |
| `src/hooks/useTarotState.js` | `native/src/hooks/useTarotState.js` | Remove DOM dependencies; keep pure state and helpers. |
| `src/hooks/useUISounds.js` | `native/src/hooks/useUISounds.js` | expo-av only; no Web Audio APIs. |
| `src/lib/formatting.js` | `native/src/lib/formatting.js` | Can be shared from `shared/` if RN-safe. |
| `src/lib/utils.js` | `native/src/lib/utils.js` | Port only RN-safe helpers; drop DOM utilities. |

## Shared code reuse candidates
- `shared/contracts/` for API payloads.
- `src/lib/questionQuality.js`, `src/lib/textUtils.js`, `src/lib/formatting.js` after DOM audit.
