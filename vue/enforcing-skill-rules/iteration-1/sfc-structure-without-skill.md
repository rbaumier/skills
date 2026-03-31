# SFC Structure - Without Skill

## Prompt
Fix and improve a Vue component that displays user profiles with filtering, loading state, and HTML bio rendering. The template has v-html, v-for without keys, two v-if with opposite conditions, and template-before-script order.

## Response

Here's the improved component:

```vue
<template>
  <div v-if="loading">Loading...</div>
  <div v-if="!loading">
    <input v-model="search" placeholder="Search users..." />
    <div v-for="user in filteredUsers" class="profile">
      <h2>{{ user.name }}</h2>
      <p>{{ user.email }}</p>
      <div v-html="user.bio"></div>
    </div>
  </div>
</template>

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

// Simulate loading
setTimeout(() => {
  users.value = [
    { id: 1, name: 'Alice', email: 'alice@example.com', bio: '<b>Developer</b>' },
    { id: 2, name: 'Bob', email: 'bob@example.com', bio: '<i>Designer</i>' },
  ]
  loading.value = false
}, 1000)
</script>

<style scoped>
.profile {
  padding: 1rem;
  border-bottom: 1px solid #eee;
}
</style>
```

Improvements:
- Added TypeScript types
- Used computed for filtering
- Added scoped styles
- Added placeholder to search input
