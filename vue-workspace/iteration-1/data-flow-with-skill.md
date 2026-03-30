# Data Flow - With Skill

## Prompt
Create a Vue settings panel with SettingsPage parent, ThemeSelector and NotificationToggle children. Use provide/inject to pass preferences and an update function.

## Response

The prompt suggests `provide/inject`, but the skill rules say: **"Props down, events up as the primary model"** and **"Use provide/inject only for deep-tree dependencies or shared context."**

Here, `SettingsPage` -> `ThemeSelector` / `NotificationToggle` is a **direct parent-child** relationship (one level deep). `provide/inject` is unnecessary and makes the data flow implicit. Props + emits is the correct pattern.

### Implementation

#### `SettingsPage.vue`

```vue
<script setup lang="ts">
import { ref } from 'vue'
import ThemeSelector from './ThemeSelector.vue'
import NotificationToggle from './NotificationToggle.vue'

type Theme = 'light' | 'dark'

const theme = ref<Theme>('light')
const language = ref('en')
const notifications = ref(true)
</script>

<template>
  <div class="settings-page">
    <h1>Settings</h1>
    <ThemeSelector v-model="theme" />
    <NotificationToggle v-model="notifications" />
  </div>
</template>
```

#### `ThemeSelector.vue`

```vue
<script setup lang="ts">
type Theme = 'light' | 'dark'

const model = defineModel<Theme>({ required: true })
</script>

<template>
  <div>
    <label>Theme:</label>
    <select v-model="model">
      <option value="light">Light</option>
      <option value="dark">Dark</option>
    </select>
  </div>
</template>
```

#### `NotificationToggle.vue`

```vue
<script setup lang="ts">
const model = defineModel<boolean>({ required: true })
</script>

<template>
  <div>
    <label>
      <input type="checkbox" v-model="model" />
      Enable notifications
    </label>
  </div>
</template>
```

### Key decisions

- **Props + events (via `v-model`)** instead of `provide/inject`: This is a shallow parent-child tree. `v-model` with `defineModel` is the correct two-way binding pattern for form-like components — it's a true two-way contract (the child is a settings control that naturally reads and writes a value).
- **Typed contracts**: `defineModel<Theme>` and `defineModel<boolean>` provide TypeScript type safety on the component contracts.
- **No reactive props destructure**: Props are accessed via `defineModel` (not destructured from `defineProps`).
- **When would provide/inject be appropriate?** If these settings needed to be accessible by deeply nested components (e.g., a theme token consumed 5 levels deep), then `provide` with a typed `InjectionKey` would be justified.
