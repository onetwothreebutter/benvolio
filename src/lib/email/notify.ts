import "server-only";
import * as Sentry from "@sentry/nextjs";
import { after } from "next/server";
import { partnerOf, type Role } from "@/lib/conversation/model";
import { loadBenvolioForEmail } from "@/lib/db/load-benvolio";
import { isDuplicate } from "@/lib/db/rpc-error";
import { siteUrl } from "@/lib/site-url";
import { createAdminClient } from "@/lib/supabase/admin";
import { emailEnabled, sendEmail } from "./resend";
import { finishedEmail, questionProposedEmail, yourTurnEmail, type Message } from "./templates";
import { turnNotice } from "./turn-notice";

/** The email_kind enum in supabase/migrations. */
export type EmailKind = "invite" | "question_proposed" | "your_turn" | "reminder" | "finished";

/** A row of public.notifications: its whole unique key, so one email each. */
export type Notification = {
  benvolioId: string;
  role: Role;
  kind: EmailKind;
  /** The sitting it's about, or null (the finish email). */
  sitting: number | null;
  /** Which reminder, 1 to 3; null for anything else. */
  reminderNumber: number | null;
};

/**
 * Sends a person an email at most once. The notifications row is claimed
 * first, so a repeat (another tab, an overlapping job) sends nothing; if
 * sending fails, the claim is dropped so a later attempt can try again.
 * Returns whether it sent.
 */
export async function sendOnce(notification: Notification, personId: string, message: Message): Promise<boolean> {
  if (!emailEnabled()) return false;
  const { benvolioId, role, kind, sitting, reminderNumber } = notification;
  const admin = createAdminClient();
  const claim = await admin
    .from("notifications")
    .insert({ benvolio_id: benvolioId, role, kind, sitting, reminder_number: reminderNumber })
    .select("id")
    .single();
  if (isDuplicate(claim.error)) return false;
  if (claim.error) throw new Error(`Recording an email failed: ${claim.error.message}`);
  try {
    const { data, error } = await admin.auth.admin.getUserById(personId);
    if (error || !data.user.email) throw new Error(`Finding an email address failed: ${error?.message ?? "none"}`);
    await sendEmail({
      to: data.user.email,
      ...message,
      tags: { kind, benvolio_id: benvolioId },
      idempotencyKey: [benvolioId, role, kind, sitting ?? "-", reminderNumber ?? "-"].join("/"),
    });
  } catch (e) {
    const { error } = await admin.from("notifications").delete().eq("id", claim.data.id);
    // Reported on its own, so the cause above still reaches Sentry.
    if (error) Sentry.captureException(new Error(`Releasing an unsent email failed: ${error.message}`));
    throw e;
  }
  return true;
}

/**
 * Emails whoever has something new to do in a Benvolio after `actor` changed
 * it (see turnNotice). The actor is on the page already, so
 * isn't emailed.
 */
export async function notify(benvolioId: string, actor: Role): Promise<void> {
  const benvolio = await loadBenvolioForEmail(benvolioId);
  if (!benvolio) return;
  const role = partnerOf(actor);
  const notice = turnNotice(benvolio.conversation, role);
  const person = benvolio.people.find((p) => p.role === role);
  const other = benvolio.people.find((p) => p.role === actor);
  if (!notice || !person?.person_id || !other) return;
  const link = `${siteUrl()}/b/${benvolioId}`;
  const partner = other.first_name;
  const sitting = notice.kind === "your_turn" ? notice.sitting : null;
  const message =
    notice.kind === "your_turn"
      ? yourTurnEmail({ partner, link, ...notice })
      : (notice.kind === "finished" ? finishedEmail : questionProposedEmail)({ partner, link });
  await sendOnce({ benvolioId, role, kind: notice.kind, sitting, reminderNumber: null }, person.person_id, message);
}

/**
 * Runs notify after the response is sent, so the person acting never waits
 * on email, and reports a failure to Sentry instead of to them.
 */
export function notifyLater(benvolioId: string, actor: Role): void {
  if (!emailEnabled()) return;
  after(async () => {
    try {
      await notify(benvolioId, actor);
    } catch (e) {
      Sentry.captureException(e);
    }
  });
}
