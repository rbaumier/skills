# UX1: How should I handle different types of errors in my UI?

Follow the **error hierarchy**: inline (field) > toast (recoverable) > banner (partial) > full screen (fatal).

| Severity | Pattern | Example |
|----------|---------|---------|
| **Inline (field)** | Validation error next to the input | "Email format is invalid" |
| **Toast (recoverable)** | Temporary notification, auto-dismiss | "Failed to save, please retry" |
| **Banner (partial)** | Persistent bar at top of section | "Some dashboard widgets failed to load" |
| **Full screen (fatal)** | Error boundary fallback | "Something went wrong" + retry button |

```tsx
// Wrap features in Error Boundaries with retry
<ErrorBoundary fallback={<FullScreenError onRetry={() => window.location.reload()} />}>
  <Dashboard />
</ErrorBoundary>
```

Never silently swallow errors. Always surface them via the appropriate UI pattern based on severity.
