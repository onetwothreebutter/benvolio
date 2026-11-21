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

/** Email is off without RESEND_API_KEY, as in local development and unit tests. */
export function emailEnabled(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}

/**
 * Resend's API, or the end-to-end tests' stand-in (e2e/support/fake-resend.ts)
 * named by RESEND_API_URL. Only a localhost stand-in counts, so a stray
 * setting can never send the real key and addresses anywhere else.
 */
function apiUrl(): string {
  const override = process.env.RESEND_API_URL;
  if (override && ["localhost", "127.0.0.1"].includes(new URL(override).hostname)) return override;
  return "https://api.resend.com";
}

/** Sends one email through Resend's API. Throws if Resend refuses it. */
export async function sendEmail({ to, subject, html, text, tags, idempotencyKey }: Email): Promise<void> {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("Set RESEND_API_KEY (see .env.example)");
  const response = await fetch(`${apiUrl()}/emails`, {
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
