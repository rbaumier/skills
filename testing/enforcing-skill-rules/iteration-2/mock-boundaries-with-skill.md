# Review: OrderService test -- mock boundary violations

## Findings

### 1. `vi.spyOn(logger, 'info')` and `vi.spyOn(logger, 'error')` -- internal implementation detail

`Logger` is an internal collaborator, not an external boundary. Spying on it couples the test to the logging implementation. If you later rename the log message from `'Order created'` to `'order_created'`, restructure the log payload, or switch to a different logger, the test breaks even though the actual behavior (creating an order) is unchanged.

**Rule**: Mock ONLY external I/O (network, filesystem, database, time, randomness). Never spy on internal collaborators like loggers.

### 2. `vi.spyOn(eventBus, 'emit')` -- internal implementation detail

`EventBus` is an in-process internal collaborator, not an external boundary. Asserting on `eventBus.emit('order.created', order)` tests *how* the service notifies other parts of the system, not *what* it does. If you refactor to use a callback, a different event name, or a direct method call, the test breaks with no behavioral change.

**Rule**: Same as above. Event emitters within the same codebase are implementation details.

### 3. Asserting log messages and event payloads -- implementation coupling

```typescript
expect(logger.info).toHaveBeenCalledWith('Order created', { orderId: order.id });
expect(eventBus.emit).toHaveBeenCalledWith('order.created', order);
```

These assertions verify *how* the order is created (specific log string, specific event shape), not *that* it was created correctly. They will break on any internal refactor of logging or eventing.

## What the test should do instead

Test the observable behavior through the public interface: the order is persisted and can be retrieved.

```typescript
test('creates order with correct data', async () => {
  const order = await service.createOrder({ item: 'Widget', qty: 2 });

  expect(order.id).toBeDefined();
  expect(order.item).toBe('Widget');
  expect(order.qty).toBe(2);

  // Verify persistence (real collaborator, not a mock)
  const stored = await db.findById(order.id);
  expect(stored).toMatchObject({ item: 'Widget', qty: 2 });
});
```

The `InMemoryDatabase` usage is already correct -- it is a real implementation used in place of an external boundary (database), which is the right approach.

## Summary

| Issue | Severity | Rule violated |
|-------|----------|---------------|
| `vi.spyOn(logger, ...)` | High | Mock at boundaries only |
| `vi.spyOn(eventBus, ...)` | High | Mock at boundaries only |
| Asserting log message strings | Medium | Test behavior, not implementation |
| Asserting event emission details | Medium | Test behavior, not implementation |

All three spies (`logger.info`, `logger.error`, `eventBus.emit`) should be removed. The test should assert on the returned order and its persistence in the database -- the actual behavior the user cares about.
