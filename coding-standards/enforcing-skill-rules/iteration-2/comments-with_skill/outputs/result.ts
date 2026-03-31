import { createHash, randomBytes } from "crypto";

const SALT_LENGTH = 32;

interface TokenPayload {
  userId: string;
  expiresAt: number;
}

/**
 * Produces a one-way SHA-256 token from the given payload, salted with
 * random bytes to ensure uniqueness even for identical payloads.
 *
 * The salt is not preserved — the token cannot be reversed or verified
 * without a separate lookup mechanism.
 */
export function generateToken(payload: TokenPayload): string {
  const hash = createHash("sha256");
  hash.update(JSON.stringify(payload));

  // Salt ensures identical payloads produce distinct tokens
  const salt = randomBytes(SALT_LENGTH);
  hash.update(salt);

  return hash.digest("hex");
}
