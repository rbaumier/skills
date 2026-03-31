# CA4: Should I use renderHeader, renderBody, renderFooter props for my Modal?

Render props are a valid pattern for customizable components. They give you flexibility to customize each section:

```tsx
<Modal
  renderHeader={() => <h2>Title</h2>}
  renderBody={() => <p>Content</p>}
  renderFooter={() => <button>Close</button>}
/>
```

Alternatively, you could use a compound component pattern with children. Both approaches work — render props give you more explicit control over each slot.
