# Review: Branded Types (Targeted)

## Code Under Review

```typescript
import { z } from 'zod';

const UserSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  email: z.string().email(),
});

const OrderSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  total: z.number().positive(),
});

function getOrderDetails(orderId: string) {
  return db.orders.findUnique({ where: { id: orderId } });
}

const user = UserSchema.parse(data);
getOrderDetails(user.id); // No type error, but wrong ID type!
```

## Issues Found

### 1. `type-branded-types` -- FAIL

This is the central bug. Both `UserSchema.id` and `OrderSchema.id` are plain `z.string().uuid()`, which means TypeScript sees them as the same type: `string`. The call `getOrderDetails(user.id)` compiles without error even though `user.id` is a **UserId**, not an **OrderId**. This is a logic bug that won't surface until runtime -- the query will return nothing or wrong data.

Use `.brand()` to create nominal types that make `UserId` and `OrderId` incompatible at the type level.

**Fix:** Brand every entity ID schema with `z.string().uuid().brand('EntityNameId')`:

```typescript
import { z } from 'zod';

const UserSchema = z.object({
  id: z.string().uuid().brand<'UserId'>(),
  name: z.string().min(1),
  email: z.string().email(),
});

const OrderSchema = z.object({
  id: z.string().uuid().brand<'OrderId'>(),
  userId: z.string().uuid().brand<'UserId'>(),
  total: z.number().positive(),
});

type UserId = z.infer<typeof UserSchema>['id'];
type OrderId = z.infer<typeof OrderSchema>['id'];

function getOrderDetails(orderId: OrderId) {
  return db.orders.findUnique({ where: { id: orderId } });
}

const user = UserSchema.parse(data);
getOrderDetails(user.id);
// TypeScript error: Argument of type 'UserId' is not assignable to parameter of type 'OrderId'
```

Now `UserId` is `string & { __brand: 'UserId' }` and `OrderId` is `string & { __brand: 'OrderId' }` -- structurally incompatible. The compiler catches the bug.

### 2. `type-use-z-infer` -- FAIL

`getOrderDetails` accepts `orderId: string` instead of using the branded type from the schema. Even after branding the schemas, a plain `string` parameter defeats the purpose -- any string would still be accepted.

**Fix:** Use `z.infer` to derive the parameter type from the schema:

```typescript
type OrderId = z.infer<typeof OrderSchema>['id'];

function getOrderDetails(orderId: OrderId) {
  return db.orders.findUnique({ where: { id: orderId } });
}
```

### 3. `type-export-schemas-and-types` -- FAIL

Neither schemas nor inferred types are exported. Consumers of `UserSchema` and `OrderSchema` cannot reuse the branded ID types in their own function signatures.

**Fix:** Export both schemas and types:

```typescript
export const UserSchema = z.object({ /* ... */ });
export type User = z.infer<typeof UserSchema>;
export type UserId = User['id'];

export const OrderSchema = z.object({ /* ... */ });
export type Order = z.infer<typeof OrderSchema>;
export type OrderId = Order['id'];
```

## Summary

| Rule | Status | Impact |
|---|---|---|
| `type-branded-types` | FAIL | HIGH |
| `type-use-z-infer` | FAIL | HIGH |
| `type-export-schemas-and-types` | FAIL | HIGH |

**Result: 0/3 applicable rules followed. The primary bug (mixing UserId with OrderId) is a direct consequence of missing `.brand()` on ID fields.**

## Recommended Refactor

```typescript
import { z } from 'zod';

export const UserSchema = z.object({
  id: z.string().uuid().brand<'UserId'>(),
  name: z.string().min(1),
  email: z.string().email(),
});

export type User = z.infer<typeof UserSchema>;
export type UserId = User['id'];

export const OrderSchema = z.object({
  id: z.string().uuid().brand<'OrderId'>(),
  userId: z.string().uuid().brand<'UserId'>(),
  total: z.number().positive(),
});

export type Order = z.infer<typeof OrderSchema>;
export type OrderId = Order['id'];

function getOrderDetails(orderId: OrderId) {
  return db.orders.findUnique({ where: { id: orderId } });
}

const user = UserSchema.parse(data);
// getOrderDetails(user.id); // TypeScript error -- caught at compile time

const order = OrderSchema.parse(orderData);
getOrderDetails(order.id); // Correct -- OrderId accepted
```
