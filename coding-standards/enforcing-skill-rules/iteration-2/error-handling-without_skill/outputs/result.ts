class SyncError extends Error {
  constructor(
    message: string,
    public readonly cause: unknown,
    public readonly step: string,
  ) {
    super(`${message} [step: ${step}]`);
    this.name = "SyncError";
  }
}

async function fetchJson<T>(url: string, label: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new SyncError(`HTTP ${response.status} from ${label}`, null, label);
  }
  return response.json() as Promise<T>;
}

async function upsertUser(userId: string, name: string): Promise<void> {
  await db.query(
    `INSERT INTO users (id, name) VALUES ($1, $2)
     ON CONFLICT (id) DO UPDATE SET name = $2`,
    [userId, name],
  );
}

async function syncPreferences(userId: string): Promise<void> {
  const prefsData = await fetchJson(
    `https://api.example.com/users/${userId}/preferences`,
    "preferences",
  );
  await db.query("UPDATE prefs SET data = $1 WHERE user_id = $2", [
    JSON.stringify(prefsData),
    userId,
  ]);
}

async function syncUserData(userId: string): Promise<{ success: true }> {
  const userData = await fetchJson<{ name: string }>(
    `https://api.example.com/users/${userId}`,
    "user",
  );

  await upsertUser(userId, userData.name);

  try {
    await syncPreferences(userId);
  } catch (error) {
    console.warn("Preferences sync failed for user %s:", userId, error);
  }

  return { success: true };
}
