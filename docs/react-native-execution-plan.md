# React Native Migration Execution Plan

## Assumptions
- Kickoff date: 2026-02-09 (adjust if different).
- Staffing: 1 core developer (update owners if team expands).
- Target stack: Expo SDK 55, React Native 0.83, NativeWind v4.2 (upgrade to v5 when compatible), React Navigation 7.
- Auth strategy: Auth0 via existing `/api/auth/*` endpoints; deep links for `/reset-password`, `/verify-email`, `/auth/callback`.

## Milestones (12-week plan)
| Phase | Dates | Outcome | Exit criteria |
| --- | --- | --- | --- |
| Phase 1: Foundation | 2026-02-09 to 2026-02-22 | Native shell running with navigation, NativeWind, storage primitives | App boots on device, tabs render, storage wrapper initialized |
| Phase 2: Utility layer | 2026-02-23 to 2026-03-08 | Storage, API, audio primitives stabilized | MMKV and SQLite working, audio playback wired |
| Phase 3: Core components | 2026-03-09 to 2026-03-29 | P0 reading flow running natively | Card draw and reveal flow functional, narrative placeholder visible |
| Phase 4: Secondary features | 2026-03-30 to 2026-04-12 | Journal and share flow enabled | Journal list renders, share view works |
| Phase 5: Polish | 2026-04-13 to 2026-04-26 | UX refinement and platform polish | Motion polish, a11y pass, tablet layout checked |
| Phase 6: Testing and launch | 2026-04-27 to 2026-05-03 | Release candidate build | Device tests complete, store assets ready |

## Phase 1 task list (Week 1-2)
| Task | Owner | Start | Due | Deliverable |
| --- | --- | --- | --- | --- |
| Create native app scaffold | Core dev | 2026-02-09 | 2026-02-10 | `native/` folder with App entry, navigation, base screens |
| Add dependency setup script | Core dev | 2026-02-09 | 2026-02-11 | `scripts/native/setup-native.sh` |
| Configure React Navigation shell | Core dev | 2026-02-10 | 2026-02-12 | Root stack, tab navigator, deep link config (share + auth flows) |
| Configure NativeWind v4 | Core dev | 2026-02-10 | 2026-02-12 | `tailwind.config.js`, `metro.config.js`, `styles/tailwind.css` |
| Configure Reanimated and RNGH | Core dev | 2026-02-11 | 2026-02-12 | Babel plugin, gesture root wrapper |
| Add MMKV storage wrapper | Core dev | 2026-02-12 | 2026-02-14 | `native/src/lib/storage.js` + preferences stub |
| Add SQLite module stub | Core dev | 2026-02-14 | 2026-02-17 | `native/src/lib/journalDb.js` with schema placeholders |
| Wire base screens with theme tokens | Core dev | 2026-02-13 | 2026-02-17 | Reading/Journal/Gallery/Account shells styled |
| Validate native boot on device | Core dev | 2026-02-18 | 2026-02-20 | iOS + Android dev run confirmed |
| Add auth deep-link screens | Core dev | 2026-02-18 | 2026-02-20 | Reset/Verify/OAuth callback screens wired to API |
| Validate deep links | Core dev | 2026-02-20 | 2026-02-22 | `tableu://share/<token>` + auth links open correct screens |

## Phase 1 definition of done
- `native/` app starts with `expo start` and renders tabs.
- Navigation and deep linking config are present and loadable.
- Auth deep links resolve to functional screens (reset password, verify email, OAuth callback).
- NativeWind builds className styles without runtime errors.
- MMKV storage wrapper works for simple key/value reads.

## Risk notes
- Card and ritual animations are the largest effort driver; start motion spikes in Week 3.
- TTS and audio caching depend on REST and file system setup; validate early in Phase 2.
