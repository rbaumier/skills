# Component Splitting - With Skill

## Prompt
Build a Todo application in Vue with input, list with toggle, filter buttons, counter, and clear completed. Implement as a single App.vue component.

## Response

While the prompt asks for a single file, the skill rules require splitting CRUD/list features into multiple components. A Todo app is a classic CRUD/list feature with 3+ distinct UI sections (input, list, filters/footer), so a single-file implementation would violate the component splitting rules.

### Component Map

Before coding, here is the component plan:

| Component | Responsibility | Props (in) | Events (out) |
|-----------|---------------|------------|---------------|
| `App.vue` | Composition surface — mounts the TodoApp feature | none | none |
| `TodoApp.vue` | Feature container — composes children, wires composable | none (uses `useTodos`) | none |
| `TodoInput.vue` | Text input + form submit for adding todos | none | `add(text: string)` |
| `TodoList.vue` | Renders filtered list of todo items | `todos: Todo[]` | `toggle(id: number)` |
| `TodoFooter.vue` | Shows remaining count, filter buttons, clear completed | `remaining: number`, `filter: Filter` | `update:filter(f: Filter)`, `clearCompleted()` |

**Feature folder**: `components/todos/`
**Composable**: `composables/useTodos.ts`

### Implementation

#### `composables/useTodos.ts`

```ts
import { ref, computed } from 'vue'

export interface Todo {
  id: number
  text: string
  done: boolean
}

export type Filter = 'all' | 'active' | 'completed'

export function useTodos() {
  const todos = ref<Todo[]>([])
  const filter = ref<Filter>('all')
  let nextId = 1

  const filteredTodos = computed(() => {
    switch (filter.value) {
      case 'active': return todos.value.filter(t => !t.done)
      case 'completed': return todos.value.filter(t => t.done)
      default: return todos.value
    }
  })

  const remaining = computed(() => todos.value.filter(t => !t.done).length)

  function addTodo(text: string) {
    const trimmed = text.trim()
    if (!trimmed) return
    todos.value.push({ id: nextId++, text: trimmed, done: false })
  }

  function toggleTodo(id: number) {
    const todo = todos.value.find(t => t.id === id)
    if (todo) todo.done = !todo.done
  }

  function clearCompleted() {
    todos.value = todos.value.filter(t => !t.done)
  }

  return { todos, filter, filteredTodos, remaining, addTodo, toggleTodo, clearCompleted }
}
```

#### `components/todos/TodoInput.vue`

```vue
<script setup lang="ts">
import { ref } from 'vue'

const emit = defineEmits<{
  add: [text: string]
}>()

const newTodo = ref('')

function submit() {
  emit('add', newTodo.value)
  newTodo.value = ''
}
</script>

<template>
  <form @submit.prevent="submit">
    <input v-model="newTodo" placeholder="What needs to be done?" />
  </form>
</template>
```

#### `components/todos/TodoList.vue`

```vue
<script setup lang="ts">
import type { Todo } from '@/composables/useTodos'

defineProps<{
  todos: Todo[]
}>()

const emit = defineEmits<{
  toggle: [id: number]
}>()
</script>

<template>
  <ul>
    <li v-for="todo in todos" :key="todo.id">
      <label>
        <input type="checkbox" :checked="todo.done" @change="emit('toggle', todo.id)" />
        <span :class="{ done: todo.done }">{{ todo.text }}</span>
      </label>
    </li>
  </ul>
</template>

<style scoped>
.done { text-decoration: line-through; }
</style>
```

#### `components/todos/TodoFooter.vue`

```vue
<script setup lang="ts">
import type { Filter } from '@/composables/useTodos'

defineProps<{
  remaining: number
  filter: Filter
}>()

const emit = defineEmits<{
  'update:filter': [value: Filter]
  clearCompleted: []
}>()
</script>

<template>
  <footer>
    <span>{{ remaining }} items left</span>
    <div>
      <button v-for="f in (['all', 'active', 'completed'] as const)" :key="f"
              :class="{ active: filter === f }"
              @click="emit('update:filter', f)">
        {{ f }}
      </button>
    </div>
    <button @click="emit('clearCompleted')">Clear completed</button>
  </footer>
</template>
```

#### `components/todos/TodoApp.vue`

```vue
<script setup lang="ts">
import { useTodos } from '@/composables/useTodos'
import TodoInput from './TodoInput.vue'
import TodoList from './TodoList.vue'
import TodoFooter from './TodoFooter.vue'

const { filteredTodos, remaining, filter, addTodo, toggleTodo, clearCompleted } = useTodos()
</script>

<template>
  <div class="todo-app">
    <h1>Todos</h1>
    <TodoInput @add="addTodo" />
    <TodoList :todos="filteredTodos" @toggle="toggleTodo" />
    <TodoFooter
      :remaining="remaining"
      v-model:filter="filter"
      @clear-completed="clearCompleted"
    />
  </div>
</template>
```

#### `App.vue`

```vue
<script setup lang="ts">
import TodoApp from '@/components/todos/TodoApp.vue'
</script>

<template>
  <TodoApp />
</template>
```

### Why not a single file?

The todo app has 3+ distinct UI sections (input form, list, footer/filters) and owns both state orchestration and presentational markup. Per the component splitting rules, this triggers mandatory splitting. The entry `App.vue` stays thin as a composition surface.
