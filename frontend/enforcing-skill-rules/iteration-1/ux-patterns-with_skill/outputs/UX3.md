# UX3: Do I need to handle the case when there are zero items in a list?

**Yes. Every list must have an empty state.** This is not optional.

```tsx
function TodoList({ todos }: { todos: Todo[] }) {
  if (todos.length === 0) {
    return (
      <div className="empty-state">
        <EmptyIcon />
        <h3>No todos yet</h3>
        <p>Create your first todo to get started.</p>
        <Button onClick={onCreateTodo}>Create Todo</Button>
      </div>
    );
  }

  return (
    <ul>
      {todos.map((todo) => (
        <TodoItem key={todo.id} todo={todo} />
      ))}
    </ul>
  );
}
```

An empty list with no messaging is confusing — users don't know if the data is loading, if there's an error, or if there truly are no items. A good empty state explains the situation and provides a call to action.
