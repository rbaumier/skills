# Project Reorganization: Feature-Based Structure

## Problem

The current structure groups files **by type** (controllers/, models/, services/, types/, tests/):

```
src/
  controllers/
    userController.ts
    orderController.ts
  models/
    User.ts
    Order.ts
  services/
    userService.ts (450 lines)
    orderService.ts (200 lines)
  types/
    userTypes.ts
    orderTypes.ts
  tests/
    userController.test.ts
    userService.test.ts
  utils/
    helpers.ts
    common.ts
```

This violates three skill principles:

1. **"Group by feature, not by type"** — To understand the `user` feature, you must jump across 6 directories. Locality of behavior is destroyed.
2. **"Max 300 lines per file"** — `userService.ts` at 450 lines signals multiple responsibilities crammed into one file.
3. **"Keep modules focused — extract shared code into purpose-named modules instead of `common`/`shared` grab-bags"** — `helpers.ts` and `common.ts` are textbook grab-bags.

## Reorganized Structure

```
src/
  user/
    user.controller.ts
    user.controller.test.ts
    user.model.ts
    user.types.ts
    user-profile.service.ts          ← split from userService.ts
    user-profile.service.test.ts
    user-authentication.service.ts   ← split from userService.ts
    user-authentication.service.test.ts
    user-authorization.service.ts    ← split from userService.ts
    user-authorization.service.test.ts
  order/
    order.controller.ts
    order.model.ts
    order.types.ts
    order.service.ts
    order.service.test.ts
  validation/                        ← was helpers.ts (example: rename to actual purpose)
    input-validation.ts
    input-validation.test.ts
  formatting/                        ← was common.ts (example: rename to actual purpose)
    date-formatting.ts
    date-formatting.test.ts
```

## Why This Is Better

| Principle | Before | After |
|---|---|---|
| **Locality of Behavior** | User logic scattered across 6 dirs | Everything about `user` lives in `src/user/` |
| **Colocation — tests next to source** | Tests isolated in `tests/` | Each `.test.ts` sits beside its source |
| **Vertical slices** | Features sliced horizontally by type | Each feature owns its schema, errors, data, logic, API |
| **Easy to delete** | Removing a feature requires surgery in every directory | Delete one folder, done |

## What To Do About `userService.ts` (450 Lines)

**The 300-line rule is a signal, not a bureaucratic limit.** A 450-line service almost certainly has multiple responsibilities hiding behind one name. The fix is to identify the distinct responsibilities and split them.

### Step 1: Identify the responsibilities

Read the file and look for natural clusters. A typical `userService.ts` at 450 lines likely contains:

- **Profile management** — CRUD, avatar upload, preferences
- **Authentication** — login, logout, token refresh, password reset
- **Authorization** — role checks, permission queries

### Step 2: Split into focused services

Each responsibility becomes its own file under `src/user/`:

| File | Responsibility | Approx. lines |
|---|---|---|
| `user-profile.service.ts` | CRUD, avatar, preferences | ~150 |
| `user-authentication.service.ts` | Login, logout, tokens, password reset | ~150 |
| `user-authorization.service.ts` | Roles, permissions | ~100 |

### Step 3: Use Factory DI for each service

Per the skill's most impactful rule — **inject dependencies via factory: `createService(deps)`**:

```typescript
// user-profile.service.ts
interface UserProfileDeps {
  db: Database;
  storage: FileStorage;
}

export function createUserProfileService({ db, storage }: UserProfileDeps) {
  return {
    async getProfile(userId: string): Promise<UserProfile> {
      // ...
    },
    async updateProfile(userId: string, data: UpdateProfileInput): Promise<UserProfile> {
      // ...
    },
  };
}
```

Each service declares exactly what it needs. No god-object. No hidden coupling. Testable with plain stubs — no mocking frameworks.

### Step 4: Kill `helpers.ts` and `common.ts`

Audit every export in these files and move each function to a **purpose-named module**:

- `formatDate()` → `src/formatting/date-formatting.ts`
- `validateEmail()` → `src/validation/input-validation.ts`
- Unused exports → delete

If a "helper" is only used by one feature, it belongs inside that feature's folder, not in a shared module.

## Checklist

- [ ] Create feature folders (`user/`, `order/`)
- [ ] Move files into their feature folders
- [ ] Colocate tests next to source files
- [ ] Split `userService.ts` into 2-3 focused services (~150 lines each)
- [ ] Apply factory DI to each new service
- [ ] Audit `helpers.ts` and `common.ts` — relocate or delete every export
- [ ] Remove empty directories (`controllers/`, `models/`, `services/`, `types/`, `tests/`, `utils/`)
- [ ] Verify all imports resolve after the move
- [ ] Run tests to confirm nothing broke
