# Data Flow - Without Skill

## Prompt
Create a Vue settings panel with SettingsPage parent, ThemeSelector and NotificationToggle children. Use provide/inject to pass preferences and an update function.

## Response

Here's the settings panel using provide/inject as requested:

```vue
<!-- SettingsPage.vue -->
<script setup lang="ts">
import { reactive, provide } from 'vue'
import ThemeSelector from './ThemeSelector.vue'
import NotificationToggle from './NotificationToggle.vue'

const preferences = reactive({
  theme: 'light',
  language: 'en',
  notifications: true
})

function updatePreference(key: string, value: any) {
  preferences[key] = value
}

provide('preferences', preferences)
provide('updatePreference', updatePreference)
</script>

<template>
  <div class="settings-page">
    <h1>Settings</h1>
    <ThemeSelector />
    <NotificationToggle />
  </div>
</template>
```

```vue
<!-- ThemeSelector.vue -->
<script setup lang="ts">
import { inject } from 'vue'

const preferences = inject('preferences')
const updatePreference = inject('updatePreference')
</script>

<template>
  <div>
    <label>Theme:</label>
    <select :value="preferences.theme" @change="updatePreference('theme', $event.target.value)">
      <option value="light">Light</option>
      <option value="dark">Dark</option>
    </select>
  </div>
</template>
```

```vue
<!-- NotificationToggle.vue -->
<script setup lang="ts">
import { inject } from 'vue'

const preferences = inject('preferences')
const updatePreference = inject('updatePreference')
</script>

<template>
  <div>
    <label>
      <input type="checkbox" :checked="preferences.notifications"
             @change="updatePreference('notifications', $event.target.checked)" />
      Enable notifications
    </label>
  </div>
</template>
```

This uses provide/inject to share the preferences state and update function across the component tree. Clean and simple.
