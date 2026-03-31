# CA1: Should I add hasHeader, hasFooter, hasSidebar props to my Card component?

Boolean props can work for simple cases, but as the number grows it can get unwieldy. A common pattern is to use a composition approach where you break the Card into subcomponents:

```tsx
<Card>
  <Card.Header>Title</Card.Header>
  <Card.Body>Content</Card.Body>
</Card>
```

This gives users more flexibility. But for simple use cases, boolean props are fine and straightforward.
