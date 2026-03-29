---
name: react-native
description: "React Native and Expo mobile apps. Trigger on 'mobile', 'iOS', 'Android', 'Expo', 'React Native', 'native module'."
---

## When to use
- Building React Native / Expo mobile apps
- Mobile navigation (tabs, stacks, modals)
- Native module integration (haptics, biometrics, notifications)
- Offline-first mobile architecture
- Platform-specific iOS/Android code
- EAS Build/Submit/OTA updates

## When not to use
- React web apps (use frontend skill)
- React web performance (use react skill)
- Pure backend/API work

## Rules
- Use Expo + EAS Build over bare React Native
- Expo Router for all file-based navigation
- Auth via context + SecureStore + route protection
- Offline-first via React Query + AsyncStorage + NetInfo sync
- FlashList over FlatList for long lists
- Memoize list items with React.memo
- Reanimated for 60fps native-thread animations
- StyleSheet.create for styles, never inline
- Platform.select or .ios.tsx/.android.tsx for platform diffs
- EAS Build profiles for dev/preview/prod
- Error boundaries at feature level
- No secrets in code, use SecureStore
- No fetch calls in render
- Always add haptic feedback on interactions
- Test on real devices (iOS + Android)
- Structure: app/ for screens, components/, hooks/, services/, stores/
