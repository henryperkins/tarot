# React Native Migration Execution Plan

## Assumptions
- Kickoff date: 2026-02-03 (adjust if different).
- Staffing: 1 core developer (update owners if team expands).
- Target stack: Expo SDK 55, React Native 0.83, NativeWind v4.2 (upgrade to v5 when compatible), React Navigation 7.
- Auth strategy: Auth0 via existing `/api/auth/*` endpoints; deep links for `/reset-password`, `/verify-email`, `/auth/callback`.
- Dev environment: iOS simulator builds require macOS + Xcode; Android can be developed on Linux/Windows (Android Studio) and with physical devices via Expo Go.

## Status update (2026-02-03)
- Foundation work already exists in `native/` (navigation, NativeWind, MMKV, SQLite, base screens).
- Early P0 is in place (reading flow scaffold, journal list, share screen); remaining is API wiring + validation on devices/deep links.
- Immediate Phase 2 focus: wire `/api/tarot-reading` streaming and `/api/tts` + expo-av caching.
- Dev server startup is unblocked in this repo setup: root uses `metro.config.cjs` (repo is ESM), and `native/` disables the standalone React Native DevTools shell by default on headless Linux via patch-package.

## Milestones (12-week plan)
| Phase | Dates | Outcome | Exit criteria |
| --- | --- | --- | --- |
| Phase 1: Foundation | 2026-02-03 to 2026-02-16 | Native shell running with navigation, NativeWind, storage primitives | App boots on device, tabs render, storage wrapper initialized |
| Phase 2: Utility layer | 2026-02-17 to 2026-03-02 | Storage, API, audio primitives stabilized | MMKV and SQLite working, audio playback wired |
| Phase 3: Core components | 2026-03-03 to 2026-03-23 | P0 reading flow running natively | Card draw and reveal flow functional, narrative placeholder visible |
| Phase 4: Secondary features | 2026-03-24 to 2026-04-06 | Journal and share flow enabled | Journal list renders, share view works |
| Phase 5: Polish | 2026-04-07 to 2026-04-20 | UX refinement and platform polish | Motion polish, a11y pass, tablet layout checked |
| Phase 6: Testing and launch | 2026-04-21 to 2026-04-27 | Release candidate build | Device tests complete, store assets ready |

## Phase 1 task list (Week 1-2)
| Task | Owner | Start | Due | Status | Deliverable |
| --- | --- | --- | --- | --- | --- |
| Create native app scaffold | Core dev | 2026-02-03 | 2026-02-04 | Done | `native/` folder with App entry, navigation, base screens |
| Add dependency setup script | Core dev | 2026-02-03 | 2026-02-05 | Done | `scripts/native/setup-native.sh` |
| Configure React Navigation shell | Core dev | 2026-02-04 | 2026-02-06 | Done | Root stack, tab navigator, deep link config (share + auth flows) |
| Configure NativeWind v4 | Core dev | 2026-02-04 | 2026-02-06 | Done | `tailwind.config.js`, `metro.config.js`, `styles/tailwind.css` |
| Configure Reanimated and RNGH | Core dev | 2026-02-05 | 2026-02-06 | Done | Babel plugin, gesture root wrapper |
| Add MMKV storage wrapper | Core dev | 2026-02-06 | 2026-02-08 | Done | `native/src/lib/storage.js` + preferences wiring |
| Add SQLite module stub | Core dev | 2026-02-08 | 2026-02-11 | Done | `native/src/lib/journalDb.js` schema + basic helpers |
| Wire base screens with theme tokens | Core dev | 2026-02-07 | 2026-02-11 | Done | Reading/Journal/Gallery/Account shells styled |
| Validate native boot on device | Core dev | 2026-02-12 | 2026-02-14 | Pending | iOS + Android dev run confirmed |
| Add auth deep-link screens | Core dev | 2026-02-12 | 2026-02-14 | Done | Reset/Verify/OAuth callback screens wired to API |
| Validate deep links | Core dev | 2026-02-14 | 2026-02-16 | Pending | `tableu://share/<token>` + auth links open correct screens |

## Phase 1 definition of done
- `native/` app starts with `expo start` and renders tabs.
- Navigation and deep linking config are present and loadable.
- Auth deep links resolve to functional screens (reset password, verify email, OAuth callback).
- NativeWind builds className styles without runtime errors.
- MMKV storage wrapper works for simple key/value reads.

## Risk notes
- Card and ritual animations are the largest effort driver; start motion spikes in Week 3.
- TTS and audio caching depend on REST and file system setup; validate early in Phase 2.
