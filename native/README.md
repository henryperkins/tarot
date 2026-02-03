# Native App Scaffold

This folder contains the React Native (Expo) app scaffold for the migration.

## Quick start
1. Run `scripts/native/setup-native.sh` from repo root.
2. `cd native` then run `npm start`.

## Structure
- `App.jsx`: app entry with navigation and providers.
- `src/navigation/`: root stack, tabs, and deep linking config.
- `src/screens/`: base screens for the main tabs.
- `src/contexts/`: initial preferences and reading contexts.
- `src/lib/`: storage and SQLite stubs.
- `styles/`: NativeWind input CSS.
