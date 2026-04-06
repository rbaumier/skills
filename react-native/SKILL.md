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
- Error boundaries at feature level
- No secrets in code, use SecureStore
- No fetch calls in render
- Always add haptic feedback on interactions
- Test on real devices (iOS + Android)
- Structure: app/ for screens, components/, hooks/, services/, stores/

## Navigation Patterns (Expo Router)
- Tab layout: `app/(tabs)/_layout.tsx` with `<Tabs>` component
- Stack: `app/(stack)/_layout.tsx` with `<Stack>`
- Modal: `app/modal.tsx` + `presentation: 'modal'` in Stack.Screen options
- Auth guard: `app/(auth)/_layout.tsx` that redirects to `/login` if not authenticated
- Typed routes: `router.push('/profile/[id]')` with `useLocalSearchParams<{ id: string }>()`
- Prevent back: `router.replace()` after login/logout
- Tab icons: use `@expo/vector-icons` with `tabBarIcon`

## Deep Linking
- Expo Router gives deep linking for free — file-based routes = deep link paths
- Configure `scheme` in app.json: `{ "expo": { "scheme": "myapp" } }`
- Universal links: add `intentFilters` (Android) and `associatedDomains` (iOS) in app.json
- Test: `npx uri-scheme open myapp://path --ios` / `--android`
- Handle auth redirects: `useURL()` hook from `expo-linking`
- Always validate deep link params before navigation

## Push Notifications
- Use `expo-notifications` for both local and remote
- Request permissions with `Notifications.requestPermissionsAsync()`
- Get push token: `Notifications.getExpoPushTokenAsync({ projectId })`
- Handle foreground: `Notifications.setNotificationHandler({ handleNotification: async () => ({ shouldShowAlert: true, shouldPlaySound: true, shouldSetBadge: true }) })`
- Handle tap: `useLastNotificationResponse()` + navigate to relevant screen
- EAS Build required for push on physical devices
- Test with Expo Push Tool: https://expo.dev/notifications

## Rendering Pitfalls
- Never use `&&` with potentially falsy numbers: `{count && <Text>}` renders `0`. Use `{count > 0 && <Text>}`
- Always wrap raw strings in `<Text>` — bare strings crash on native
- Avoid inline object styles: `style={{ margin: 10 }}` creates new object every render. Use StyleSheet or useMemo
- Avoid inline arrow functions in FlatList `renderItem` — extract as named component with `React.memo`
- Image source must be `require()` for local or `{ uri: string }` for remote — no bare strings

## EAS Build & Submit
- Install: `npx eas-cli`
- Configure: `eas build:configure` — creates eas.json
- Profiles in eas.json: `development` (simulator), `preview` (internal testing), `production` (store)
- Dev build: `eas build --profile development --platform ios`
- Preview: `eas build --profile preview --platform all`
- Submit to stores: `eas submit --platform ios` / `--platform android`
- OTA updates: `eas update --branch production --message "fix: crash on login"`
- Auto-increment: `"buildNumber": { "autoIncrement": true }` in eas.json

## Testing
- Unit: Jest + `@testing-library/react-native` for component tests (NOT `@testing-library/react`)
- Mock native modules: `jest.mock('expo-secure-store', () => ({ getItemAsync: jest.fn() }))`
- Detox for E2E on real devices/simulators
- Test navigation: render with `NavigationContainer`, assert screen transitions
- Snapshot testing: use sparingly, only for stable UI components
- Always test both platforms in CI (iOS simulator + Android emulator)
