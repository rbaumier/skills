# SFC Structure - With Skill

## Prompt
Fix and improve a Vue component that displays user profiles with filtering, loading state, and HTML bio rendering. The template has v-html, v-for without keys, two v-if with opposite conditions, and template-before-script order.

## Response

Several issues to address per Vue best practices:

1. **SFC section order**: Must be `<script>` -> `<template>` -> `<style>` (not template first).
2. **`v-html` XSS risk**: `v-html` renders raw HTML and is a **cross-site scripting (XSS) vector**. Never use it with user-supplied content unless sanitized. Use a sanitizer like DOMPurify or render safe text instead.
3. **`v-for` without `:key`**: Every `v-for` needs a stable `:key` for Vue's diffing algorithm.
4. **`v-if` / `v-if="!loading"`**: Should be `v-if` / `v-else` — clearer intent, and Vue optimizes the toggle.
5. **Filtering in template**: The filtering logic should be in a `computed()` property, keeping the template declarative.

### Implementation

```vue
<script setup lang="ts">
import { ref, computed } from 'vue'

interface User {
  id: number
  name: string
  email: string
  bio: string
}

const loading = ref(true)
const search = ref('')
const users = ref<User[]>([])

const filteredUsers = computed(() =>
  users.value.filter(u =>
    u.name.toLowerCase().includes(search.value.toLowerCase())
  )
)

/**
 * WARNING: v-html is an XSS risk. If `bio` comes from user input or
 * an untrusted API, sanitize it first (e.g. DOMPurify.sanitize(user.bio)).
 * Here we render plain text instead for safety.
 * If HTML rendering is truly required, install DOMPurify:
 *   import DOMPurify from 'dompurify'
 *   const sanitize = (html: string) => DOMPurify.sanitize(html)
 */

// Simulate data fetch
setTimeout(() => {
  users.value = [
    { id: 1, name: 'Alice', email: 'alice@example.com', bio: 'Developer' },
    { id: 2, name: 'Bob', email: 'bob@example.com', bio: 'Designer' },
  ]
  loading.value = false
}, 1000)
</script>

<template>
  <div v-if="loading">Loading...</div>
  <div v-else>
    <input v-model="search" placeholder="Filter by name..." />
    <div v-for="user in filteredUsers" :key="user.id" class="profile">
      <h2>{{ user.name }}</h2>
      <p>{{ user.email }}</p>
      <p>{{ user.bio }}</p>
    </div>
  </div>
</template>

<style scoped>
.profile {
  padding: 1rem;
  border-bottom: 1px solid #eee;
}
</style>
```

### Key fixes

- **SFC order**: `<script>` -> `<template>` -> `<style>` as required.
- **v-html removed**: Replaced with text interpolation `{{ user.bio }}` for safety. Added comment explaining how to sanitize if HTML rendering is truly needed.
- **`:key="user.id"`** added to `v-for` — uses a stable unique identifier, not array index.
- **`v-else`** replaces `v-if="!loading"` — clearer conditional branching.
- **`computed`** for `filteredUsers` — keeps template declarative, caches result.
