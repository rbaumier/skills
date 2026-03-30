# Migration Strategy - With Skill

## Response to prompt

I need to push back on several aspects of your plan before converting code.

### Problems with your plan

**1. Don't do a big-bang migration.** Converting 200+ modules in one PR is a recipe for disaster. Adopt better-result incrementally - start with one module at a time, validate the pattern, then expand.

**2. Start at I/O boundaries, NOT internal utilities.** Your plan to start with internal utility functions and move to API boundaries is backwards. The correct approach is to begin at I/O boundaries (API calls, DB queries, file operations) and work inward. In your sample code, `fetchFromWarehouse()` (HTTP) and `updateDatabase()` (DB) are the boundaries - start there.

**3. Don't wrap bugs/defects in Result.** Null pointer exceptions and type errors are bugs. They should throw and become `Panic` if they occur inside a Result callback. Fix the bug instead of catching it. Only domain errors (NotFound, Validation) and infrastructure errors (Network, DB connection) should become Results.

**4. Use TaggedError, not plain Error.** Plain `Error` objects lose type safety. Domain errors like NotFound and ValidationError should be `TaggedError` subclasses.

### Step 1: Categorize errors first

Before writing any code, categorize the errors in your module:

| Category       | In your code                     | Migration Target                  |
|---------------|----------------------------------|-----------------------------------|
| Domain         | Invalid item validation          | TaggedError + Result.err          |
| Infrastructure | fetchFromWarehouse, updateDatabase | Result.tryPromise + TaggedError |
| Bugs           | null deref, type errors          | Let throw (becomes Panic)         |

### Step 2: Define TaggedError classes

```typescript
class WarehouseFetchError extends TaggedError {
  readonly _tag = "WarehouseFetchError";
}

class DatabaseWriteError extends TaggedError {
  readonly _tag = "DatabaseWriteError";
}

class ItemValidationError extends TaggedError {
  readonly _tag = "ItemValidationError";
}
```

### Step 3: Wrap I/O boundaries with Result.tryPromise

```typescript
async function fetchFromWarehouseSafe(): Promise<Result<Item[], WarehouseFetchError>> {
  return Result.tryPromise({
    try: async () => fetchFromWarehouse(),
    catch: (e) => new WarehouseFetchError({ cause: e, message: `Warehouse fetch failed: ${e}` }),
  });
}

async function updateDatabaseSafe(item: Item): Promise<Result<void, DatabaseWriteError>> {
  return Result.tryPromise({
    try: async () => updateDatabase(item),
    catch: (e) => new DatabaseWriteError({ cause: e, message: `DB write failed for item ${item.id}: ${e}` }),
  });
}
```

### Step 4: Convert validation to Result

```typescript
function validateItemSafe(item: Item): Result<Item, ItemValidationError> {
  const validated = validateItem(item);
  return validated
    ? Result.ok(item)
    : Result.err(new ItemValidationError({ message: `Invalid item: ${item.id}` }));
}
```

### Step 5: Compose with Result.gen

```typescript
type SyncError = WarehouseFetchError | DatabaseWriteError | ItemValidationError;

async function syncInventory(): Promise<Result<void, SyncError>> {
  return Result.gen(async function* () {
    const items = yield* Result.await(fetchFromWarehouseSafe());
    for (const item of items) {
      const validItem = yield* validateItemSafe(item);
      yield* Result.await(updateDatabaseSafe(validItem));
    }
    return Result.ok(undefined);
  });
}
```

### Migration approach

- Start with this one module
- Validate the pattern works with your tests
- Then migrate adjacent modules that call/are called by this one
- Propagate Result handling up the call stack gradually

Also: check if there's an `opensrc/` directory in the project - if present, read the better-result source code for implementation details and patterns.
