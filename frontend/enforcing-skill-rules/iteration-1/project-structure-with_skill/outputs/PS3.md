# PS3: Should my shared Button handle order submission logic?

**No. No feature logic in shared components.** Shared components in `components/` must be pure, reusable UI primitives with zero domain knowledge.

Order submission logic belongs in the feature layer:

```tsx
// BAD - feature logic in shared component
// components/ui/Button.tsx
function Button({ onSubmitOrder, orderId }) { // domain knowledge leaked!
  const handleClick = () => submitOrder(orderId);
}

// GOOD - feature owns logic, shared component is pure
// features/orders/components/SubmitOrderButton.tsx
function SubmitOrderButton({ orderId }: { orderId: string }) {
  const { submitOrder, isSubmitting } = useOrderActions();
  return (
    <Button onClick={() => submitOrder(orderId)} disabled={isSubmitting}>
      Submit Order
    </Button>
  );
}
```

Use hooks and context instead of prop drilling to get data to feature components. No prop drilling — use hooks/context.
