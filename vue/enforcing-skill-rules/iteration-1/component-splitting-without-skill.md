# Component Splitting - Without Skill

## Prompt
Build a Todo application in Vue with input, list with toggle, filter buttons, counter, and clear completed. Implement as a single App.vue component.

## Response

Here's a complete Todo app in a single `App.vue`:

```vue
<script setup lang="ts">
import { ref, computed } from 'vue'

interface Todo {
  id: number
  text: string
  done: boolean
}

const newTodo = ref('')
const filter = ref<'all' | 'active' | 'completed'>('all')
const todos = ref<Todo[]>([])
let nextId = 1

const filteredTodos = computed(() => {
  switch (filter.value) {
    case 'active': return todos.value.filter(t => !t.done)
    case 'completed': return todos.value.filter(t => t.done)
    default: return todos.value
  }
})

const remaining = computed(() => todos.value.filter(t => !t.done).length)

function addTodo() {
  const text = newTodo.value.trim()
  if (!text) return
  todos.value.push({ id: nextId++, text, done: false })
  newTodo.value = ''
}

function toggleTodo(id: number) {
  const todo = todos.value.find(t => t.id === id)
  if (todo) todo.done = !todo.done
}

function clearCompleted() {
  todos.value = todos.value.filter(t => !t.done)
}
</script>

<template>
  <div class="todo-app">
    <h1>Todos</h1>
    <form @submit.prevent="addTodo">
      <input v-model="newTodo" placeholder="What needs to be done?" />
    </form>
    <ul>
      <li v-for="todo in filteredTodos" :key="todo.id">
        <label>
          <input type="checkbox" :checked="todo.done" @change="toggleTodo(todo.id)" />
          <span :class="{ done: todo.done }">{{ todo.text }}</span>
        </label>
      </li>
    </ul>
    <footer>
      <span>{{ remaining }} items left</span>
      <div>
        <button @click="filter = 'all'">All</button>
        <button @click="filter = 'active'">Active</button>
        <button @click="filter = 'completed'">Completed</button>
      </div>
      <button @click="clearCompleted">Clear completed</button>
    </footer>
  </div>
</template>

<style scoped>
.done { text-decoration: line-through; }
</style>
```

This is a clean, simple Todo app. Everything is in one file for simplicity — easy to understand and maintain for a small app like this.
