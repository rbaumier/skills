import { createHash, randomBytes } from "crypto";

const SALT_LENGTH = 32;

interface TokenPayload {
  userId: string;
  expiresAt: number;
}

/**
 * Generates a salted SHA-256 token from the given payload.
 * Note: the salt is not preserved, so the token cannot be verified later.
 */
export function generateToken(payload: TokenPayload): string {
  const hash = createHash("sha256");
  hash.update(JSON.stringify(payload));

  const salt = randomBytes(SALT_LENGTH);
  hash.update(salt);

  return hash.digest("hex");
}

// TODO: add token verification
// TODO: add token refresh
// FIXME: salt should be stored somewhere so tokens can be verified
