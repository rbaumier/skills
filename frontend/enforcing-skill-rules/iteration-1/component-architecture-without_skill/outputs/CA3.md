# CA3: My Button has isPrimary, isOutlined, isGhost, isDanger booleans. What should I do?

Consider using a single `variant` prop instead:

```tsx
<Button variant="primary" />
<Button variant="outlined" />
<Button variant="ghost" />
<Button variant="danger" />
```

This is cleaner than multiple booleans and avoids conflicting states. You could use a library like `class-variance-authority` to manage the styles for each variant.
