# CA1: Should I add hasHeader, hasFooter, hasSidebar props to my Card component?

**No.** Prefer composition (`Card` + `CardHeader` + `CardFooter`) for reusable UI primitives. Avoid boolean props because each boolean doubles the number of possible states — with 3 booleans you already have 8 combinations to test and maintain.

```tsx
// BAD - boolean props explosion
<Card hasHeader hasFooter hasSidebar />

// GOOD - composition
<Card>
  <CardHeader>Title</CardHeader>
  <CardBody>Content</CardBody>
  <CardFooter>Actions</CardFooter>
</Card>
```

Composition is more flexible, self-documenting, and lets consumers control exactly what renders and in what order.
