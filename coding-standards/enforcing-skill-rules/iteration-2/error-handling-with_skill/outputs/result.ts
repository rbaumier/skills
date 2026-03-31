/**
 * User data synchronization module.
 *
 * Design: Uses Result types for expected failures (network, DB) instead of
 * try/catch pyramids. Each I/O operation is isolated with its own timeout
 * and typed error. User profile and preferences are fetched in parallel.
 *
 * Tradeoff: Slightly more types upfront, but every failure path is explicit
 * and the caller decides how to handle each error case.
 */

// -- Result type for expected errors (no exceptions for control flow) --

type Result<T, E = SyncError> = { ok: true; value: T } | { ok: false; error: E };

const ok = <T>(value: T): Result<T, never> => ({ ok: true, value });
const err = <E>(error: E): Result<never, E> => ({ ok: false, error });

// -- Error types (discriminated union — exhaustive matching) --

type SyncError =
  | { type: "FETCH_USER_FAILED"; cause: unknown }
  | { type: "FETCH_PREFERENCES_FAILED"; cause: unknown }
  | { type: "UPSERT_USER_FAILED"; cause: unknown }
  | { type: "UPSERT_PREFERENCES_FAILED"; cause: unknown };

// -- Constants --

const FETCH_TIMEOUT_MS = 5_000;
const API_BASE_URL = "https://api.example.com";

// -- I/O helpers (imperative shell — side effects isolated here) --

/** Fetch JSON from a URL with a timeout. */
async function fetchJson<T>(url: string): Promise<Result<T, unknown>> {
  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });

    if (!response.ok) {
      return err(new Error(`HTTP ${response.status} from ${url}`));
    }

    const data = (await response.json()) as T;
    return ok(data);
  } catch (cause) {
    return err(cause);
  }
}

/** Upsert a row: UPDATE, then INSERT on failure. Preserves original cause. */
async function upsertUser(
  db: Database,
  userId: string,
  name: string,
): Promise<Result<void, unknown>> {
  try {
    await db.query("UPDATE users SET name = $1 WHERE id = $2", [name, userId]);
    return ok(undefined);
  } catch (updateCause) {
    try {
      await db.query("INSERT INTO users (id, name) VALUES ($1, $2)", [userId, name]);
      return ok(undefined);
    } catch (insertCause) {
      return err(
        new Error("Upsert failed: UPDATE then INSERT both rejected", {
          cause: { updateCause, insertCause },
        }),
      );
    }
  }
}

async function upsertPreferences(
  db: Database,
  userId: string,
  prefsData: unknown,
): Promise<Result<void, unknown>> {
  try {
    await db.query("UPDATE prefs SET data = $1 WHERE user_id = $2", [
      JSON.stringify(prefsData),
      userId,
    ]);
    return ok(undefined);
  } catch (cause) {
    return err(cause);
  }
}

// -- Core (functional — pure orchestration, no try/catch) --

interface UserData {
  name: string;
}

/** Placeholder — replace with your actual DB interface. */
interface Database {
  query(sql: string, params: unknown[]): Promise<unknown>;
}

/**
 * Sync a user's profile and preferences from the remote API into the local DB.
 *
 * Returns a discriminated Result so the caller can pattern-match on each
 * failure mode independently. No silent swallowing, no generic "sync failed".
 */
async function syncUserData(
  userId: string,
  db: Database,
): Promise<Result<{ userSynced: true; preferencesSynced: boolean }, SyncError>> {
  // 1. Fetch user profile and preferences in parallel
  const [userResult, prefsResult] = await Promise.all([
    fetchJson<UserData>(`${API_BASE_URL}/users/${userId}`),
    fetchJson<unknown>(`${API_BASE_URL}/users/${userId}/preferences`),
  ]);

  // 2. Fail fast on user fetch — can't proceed without it
  if (!userResult.ok) {
    return err({ type: "FETCH_USER_FAILED", cause: userResult.error });
  }

  // 3. Persist user — fail fast on DB error
  const upsertResult = await upsertUser(db, userId, userResult.value.name);
  if (!upsertResult.ok) {
    return err({ type: "UPSERT_USER_FAILED", cause: upsertResult.error });
  }

  // 4. Persist preferences — non-fatal, but reported (no silent failures)
  if (!prefsResult.ok) {
    return err({
      type: "FETCH_PREFERENCES_FAILED",
      cause: prefsResult.error,
    });
  }

  const prefsPersist = await upsertPreferences(db, userId, prefsResult.value);
  if (!prefsPersist.ok) {
    return err({
      type: "UPSERT_PREFERENCES_FAILED",
      cause: prefsPersist.error,
    });
  }

  return ok({ userSynced: true, preferencesSynced: true });
}

export { syncUserData, type SyncError, type Result, type Database, type UserData };
