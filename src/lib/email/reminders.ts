import "server-only";
import * as Sentry from "@sentry/nextjs";
import { trackServer } from "@/lib/analytics/server";
import type { Pace } from "@/lib/analytics/events";
import { loadBenvoliosForEmail } from "@/lib/db/load-benvolio";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendOnce, turnEmail } from "./notify";
import { emailEnabled } from "./resend";
import { reminderEmail } from "./templates";

/**
 * Days to wait before each of the three reminders about a sitting, by the
 * pace chosen at the start: the first counts from the Benvolio's last move,
 * each later one from the reminder before it, or a later move.
 */
export const REMINDER_GAPS: Record<Pace, readonly [number, number, number]> = {
  daily: [2, 2, 3],
  weekly: [7, 3, 4],
};

const DAY = 24 * 60 * 60 * 1000;
/** The check-in runs at any minute in its hour, so a gap of 2 days may measure 1.96. */
const SLACK = 60 * 60 * 1000;
const SHORTEST_GAP = Math.min(...Object.values(REMINDER_GAPS).flat());
/** A week past the last reminder of either pace, so a missed run is caught up. */
const LOOK_BACK_DAYS = Math.max(...Object.values(REMINDER_GAPS).map(([a, b, c]) => a + b + c)) + 7;
/** Benvolios per batch: their reminder rows stay under PostgREST's 1,000-row limit. */
const BATCH = 25;
/** Stop starting sends well inside the route's time limit; the next run picks up the rest. */
const TIME_BUDGET = 40_000;

export type SentReminder = { number: number; at: string };

/**
 * The next reminder to send someone about a sitting, if it's due: one more
 * than the last sent, once its gap has passed since that reminder or the
 * Benvolio's last move, whichever is later. Null after the third.
 */
export function nextReminder(pace: Pace, activeAt: string, last: SentReminder | undefined, now: Date): 1 | 2 | 3 | null {
  const next = (last?.number ?? 0) + 1;
  if (next > 3) return null;
  const since = Math.max(Date.parse(activeAt), last ? Date.parse(last.at) : 0);
  return now.getTime() - since >= REMINDER_GAPS[pace][next - 1] * DAY - SLACK ? (next as 1 | 2 | 3) : null;
}

export type ReminderRun = { checked: number; sent: number; failed: number; finished: boolean };

const key = (benvolioId: string, role: string, sitting: number | null) => `${benvolioId}/${role}/${sitting ?? "-"}`;

/**
 * The daily check-in: reminds everyone whose turn it has been for a few quiet
 * days. Each reminder is sent at most once (sendOnce), so a repeated or
 * overlapping run sends nothing new. A missed turn email is covered by the
 * first reminder. One failure doesn't stop the rest: it's reported to Sentry
 * and counted.
 */
export async function sendReminders(now = new Date()): Promise<ReminderRun> {
  const run: ReminderRun = { checked: 0, sent: 0, failed: 0, finished: true };
  if (!emailEnabled()) return run;
  const admin = createAdminClient();
  const ago = (ms: number) => new Date(now.getTime() - ms).toISOString();
  const quiet = await admin
    .from("benvolios")
    .select("id")
    .lte("active_at", ago(SHORTEST_GAP * DAY - SLACK))
    .gte("active_at", ago(LOOK_BACK_DAYS * DAY))
    // Newest first: those are the ones due a first reminder.
    .order("active_at", { ascending: false })
    .limit(1000);
  if (quiet.error) throw new Error(`Finding quiet Benvolios failed: ${quiet.error.message}`);
  const ids = quiet.data.map((b) => b.id as string);
  const deadline = Date.now() + TIME_BUDGET;

  for (let i = 0; i < ids.length; i += BATCH) {
    const batch = ids.slice(i, i + BATCH);
    const [benvolios, reminders] = await Promise.all([
      loadBenvoliosForEmail(batch),
      admin
        .from("notifications")
        .select("benvolio_id, role, sitting, reminder_number, sent_at")
        .eq("kind", "reminder")
        .in("benvolio_id", batch),
    ]);
    if (reminders.error) throw new Error(`Loading sent reminders failed: ${reminders.error.message}`);
    const lastSent = new Map<string, SentReminder>();
    for (const r of reminders.data) {
      const k = key(r.benvolio_id, r.role, r.sitting);
      if ((lastSent.get(k)?.number ?? 0) < r.reminder_number) lastSent.set(k, { number: r.reminder_number, at: r.sent_at });
    }
    run.checked += benvolios.length;

    // One at a time: Resend allows a few requests a second.
    for (const benvolio of benvolios) {
      for (const { role } of benvolio.people) {
        const email = turnEmail(benvolio, role);
        if (!email || email.notice.kind === "finished") continue;
        const { personId, partner, link, sitting } = email;
        const number = nextReminder(benvolio.pace, benvolio.activeAt, lastSent.get(key(benvolio.id, role, sitting)), now);
        if (!number) continue;
        if (Date.now() > deadline) {
          run.finished = false;
          return run;
        }
        try {
          const notification = { benvolioId: benvolio.id, role, kind: "reminder", sitting, reminderNumber: number } as const;
          const message = reminderEmail({ partner, link, sitting, last: number === 3 });
          if (await sendOnce(notification, personId, message)) {
            run.sent++;
            trackServer(personId, "reminder_sent", { benvolio_id: benvolio.id, reminder_number: number });
          }
        } catch (e) {
          run.failed++;
          Sentry.captureException(e);
        }
      }
    }
  }
  return run;
}
