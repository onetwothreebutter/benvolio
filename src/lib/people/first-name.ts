import { cleanText } from "@/lib/text";

/** The limit on people.first_name and participants.first_name (checked in schema.test.ts). */
export const MAX_FIRST_NAME_LENGTH = 60;

/** A trimmed first name with single spaces, or null if it is blank or too long. */
export function cleanFirstName(value: unknown): string | null {
  return cleanText(typeof value === "string" ? value.replace(/\s+/g, " ") : value, MAX_FIRST_NAME_LENGTH);
}
