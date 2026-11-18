/**
 * Every analytics event Benvolio sends, and the properties each one carries.
 *
 * Privacy rule: events describe what happened, never what anyone wrote. Property
 * values are ids, enum slugs, numbers or booleans. `findUnsafeProperty` enforces
 * this at runtime as a backstop to the types.
 */

export type RoundNumber = 1 | 2 | 3 | 4 | 5;
export type StepKind = "write" | "respond";
export type Pace = "daily" | "weekly";
export type EmailKind = "invite" | "your_turn" | "reminder" | "finished";

type Base = { benvolio_id: string };

export type AnalyticsEvents = {
  benvolio_started: Base & { pace: Pace };
  invite_sent: Base;
  invite_opened: Base;
  invite_accepted: Base & { question_reworded: boolean };
  step_submitted: Base & { round: RoundNumber; step: StepKind; sitting: number };
  step_revealed: Base & { round: RoundNumber; step: StepKind; hours_waiting: number };
  reminder_sent: Base & { reminder_number: 1 | 2 | 3 };
  benvolio_paused: Base & { round: RoundNumber };
  benvolio_resumed: Base & { round: RoundNumber };
  benvolio_finished: Base & { days_taken: number };
  benvolio_deleted: Base & { round: RoundNumber };
  email_bounced: Base & { email_kind: EmailKind };
  email_spam_complaint: Base & { email_kind: EmailKind };
};

export type AnalyticsEventName = keyof AnalyticsEvents;

// Ids and enum slugs: letters, digits, "_" and "-", no spaces, at most 64 chars.
const SAFE_STRING = /^[A-Za-z0-9_-]{1,64}$/;

/** Returns the name of the first property that could hold free text, or null. */
export function findUnsafeProperty(properties: Record<string, unknown>): string | null {
  for (const [key, value] of Object.entries(properties)) {
    const ok =
      typeof value === "number" ||
      typeof value === "boolean" ||
      (typeof value === "string" && SAFE_STRING.test(value));
    if (!ok) return key;
  }
  return null;
}
