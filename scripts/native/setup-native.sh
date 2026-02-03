#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
NATIVE_DIR="${ROOT_DIR}/native"

if [ ! -d "${NATIVE_DIR}" ]; then
  echo "native/ directory not found. Run from repo root."
  exit 1
fi

cd "${NATIVE_DIR}"

npm install

npx expo install @react-navigation/native @react-navigation/stack @react-navigation/bottom-tabs
npx expo install react-native-screens react-native-safe-area-context
npx expo install react-native-reanimated react-native-gesture-handler
npx expo install nativewind tailwindcss
npm install class-variance-authority tailwind-merge
npm install react-native-reanimated-dnd react-native-nitro-haptics
npm install react-native-mmkv @data-client/react react-hook-form @hookform/resolvers
npx expo install expo-sqlite
npm install react-native-modalfy @devvie/bottom-sheet burnt
npm install rn-emoji-keyboard @kolking/react-native-rating react-native-auto-skeleton
npx expo install expo-av expo-camera expo-image expo-speech expo-file-system
npx expo install react-native-svg
npm install victory-native

# Optional ML
# npm install @react-native-ml-kit/text-recognition react-native-image-colors
