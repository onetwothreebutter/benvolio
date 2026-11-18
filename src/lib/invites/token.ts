import "server-only";
import { createHash, randomBytes } from "node:crypto";

/**
 * Invite links carry a random token; the database keeps only its hash, so a
 * leaked database can't be used to join anyone's Benvolio.
 */
export function hashInviteToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function newInviteToken(): { token: string; hash: string } {
  const token = randomBytes(32).toString("base64url");
  return { token, hash: hashInviteToken(token) };
}

/** Rejects anything that couldn't be a token before it reaches the database. */
export function isInviteToken(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9_-]{43}$/.test(value);
}
