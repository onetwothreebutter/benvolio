import { expect } from "@playwright/test";
import { localSupabase } from "./local-supabase";

type Summary = { ID: string; Subject: string };

/**
 * Emails in local Supabase's Mailpit inbox to `to` whose subject contains
 * `subject`, newest first. Mailpit matches subjects as substrings, ignoring
 * case: "Your turn with Jane" also finds "It's still your turn with Jane".
 */
async function search(to: string, subject: string): Promise<Summary[]> {
  if (`${to}${subject}`.includes('"')) throw new Error("Mailpit searches can't contain quotes");
  const query = encodeURIComponent(`to:"${to}" subject:"${subject}"`);
  const res = await fetch(`${localSupabase().mailpitUrl}/api/v1/search?query=${query}`);
  return ((await res.json()) as { messages: Summary[] }).messages;
}

/**
 * Waits for the newest email to `to` about `subject` (see search), then
 * deletes every match, so the following call waits for a newer one: older
 * sign-in emails carry codes the newest has replaced. Other emails to `to`
 * are left alone.
 */
async function takeEmail(to: string, subject: string): Promise<{ subject: string; html: string }> {
  let messages: Summary[] = [];
  await expect
    .poll(async () => (messages = await search(to, subject)).length, {
      message: `an email to ${to} about "${subject}"`,
      timeout: 15_000,
    })
    .toBeGreaterThan(0);
  const mailpit = localSupabase().mailpitUrl;
  const message = (await (await fetch(`${mailpit}/api/v1/message/${messages[0].ID}`)).json()) as {
    Subject: string;
    HTML: string;
  };
  await fetch(`${mailpit}/api/v1/messages`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ IDs: messages.map((m) => m.ID) }),
  });
  return { subject: message.Subject, html: message.HTML };
}

/** The code and the link from the next sign-in email to `to`. */
export async function takeSignInEmail(to: string): Promise<{ code: string; link: string }> {
  const { subject, html } = await takeEmail(to, "Your Benvolio code");
  const code = subject.match(/Your Benvolio code: (\d{6,10})/)?.[1];
  const link = html.match(/href="([^"]*\/auth\/confirm\?[^"]*)"/)?.[1]?.replaceAll("&amp;", "&");
  if (!code || !link) throw new Error(`Not a sign-in email: ${subject}`);
  return { code, link };
}

/** The link to a Benvolio's page in the next email to `to` about `subject` (see src/lib/email). */
export async function takeBenvolioLink(to: string, subject: string): Promise<string> {
  const { html } = await takeEmail(to, subject);
  const link = html.match(/href="([^"]*\/b\/[^"]*)"/)?.[1];
  if (!link) throw new Error(`No link to a Benvolio in "${subject}"`);
  return link;
}

/** Whether any email to `to` about `subject` is waiting (see search), without taking it. */
export async function hasEmail(to: string, subject: string): Promise<boolean> {
  return (await search(to, subject)).length > 0;
}
