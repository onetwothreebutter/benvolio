import { cleanText } from "@/lib/text";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** A trimmed, lower-cased email address, or null if it doesn't look like one. */
export function normalizeEmail(value: unknown): string | null {
  const email = cleanText(value, 254)?.toLowerCase();
  return email && EMAIL.test(email) ? email : null;
}
