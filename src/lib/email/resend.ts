import "server-only";

/** The sender, on the domain verified in Resend (also Supabase's sign-in email). */
const FROM = "Benvolio <hello@mail.benvolio.app>";

export type Email = {
  to: string;
  subject: string;
  html: string;
  text: string;
  /** For Resend's webhooks and logs: ids and slugs only, never text. */
  tags: Record<string, string>;
  /** Resend sends at most one email per key in 24 hours, so a retry can't send twice. */
  idempotencyKey: string;
};

/** Email is off without RESEND_API_KEY, as in local development and tests. */
export function emailEnabled(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}

/** Sends one email through Resend's API. Throws if Resend refuses it. */
export async function sendEmail({ to, subject, html, text, tags, idempotencyKey }: Email): Promise<void> {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("Set RESEND_API_KEY (see .env.example)");
  // RESEND_API_URL is for the end-to-end tests' stand-in only (e2e/support/fake-resend.ts).
  const response = await fetch(`${process.env.RESEND_API_URL || "https://api.resend.com"}/emails`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      "Idempotency-Key": idempotencyKey,
    },
    body: JSON.stringify({
      from: FROM,
      to: [to],
      subject,
      html,
      text,
      tags: Object.entries(tags).map(([name, value]) => ({ name, value })),
    }),
    // Well inside a function's time limit, so a hung request fails visibly.
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) {
    // Only Resend's error name: its message can quote the address.
    const { name } = (await response.json().catch(() => ({}))) as { name?: unknown };
    throw new Error(`Resend refused an email: ${response.status} ${String(name ?? "")}`.trim());
  }
}
