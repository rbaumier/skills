# PS3: Should my shared Button handle order submission logic?

It's better to keep business logic out of shared components. Create a wrapper component for the specific use case:

```tsx
function SubmitOrderButton({ orderId }) {
  const handleSubmit = () => submitOrder(orderId);
  return <Button onClick={handleSubmit}>Submit</Button>;
}
```

This keeps your Button component reusable and the order logic in the feature that needs it.
