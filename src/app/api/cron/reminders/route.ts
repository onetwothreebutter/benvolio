import { timingSafeEqual } from "node:crypto";
import * as Sentry from "@sentry/nextjs";
import { sendReminders } from "@/lib/email/reminders";

/** Matches the crons entry in vercel.json, so Sentry knows when to expect a run. */
const SCHEDULE = "0 17 * * *";

/** Seconds: room for a slow run, within Vercel Hobby's limit. */
export const maxDuration = 60;

/**
 * The daily check-in, called by Vercel Cron with `Authorization: Bearer
 * $CRON_SECRET`. Sentry's cron monitor raises an alert if a run fails or
 * doesn't happen.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || !same(request.headers.get("authorization") ?? "", `Bearer ${secret}`)) {
    return new Response("Unauthorized", { status: 401 });
  }
  const run = await Sentry.withMonitor("reminders", () => sendReminders(), {
    schedule: { type: "crontab", value: SCHEDULE },
    checkinMargin: 60, // Vercel Hobby runs a daily cron at some point within its hour.
    maxRuntime: 5,
    timezone: "Etc/UTC",
  });
  // Counts only: a run cut short leaves people unreminded until tomorrow.
  if (!run.finished) Sentry.captureMessage(`Reminders ran out of time: ${run.sent} sent of ${run.checked} checked`, "warning");
  return Response.json(run);
}

/** Compares in constant time, so the secret can't be guessed from response times. */
function same(a: string, b: string): boolean {
  const [x, y] = [Buffer.from(a), Buffer.from(b)];
  return x.length === y.length && timingSafeEqual(x, y);
}
