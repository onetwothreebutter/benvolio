import { expect } from "@playwright/test";
import { localSupabase } from "./local-supabase";

type Summary = { ID: string; Subject: string };

/**
 * Waits for the next email to `to` in local Supabase's Mailpit inbox, then
 * clears the inbox for `to`, so the following call waits for a newer one.
 */
async function takeEmail(to: string): Promise<{ subject: string; html: string }> {
  const mailpit = localSupabase().mailpitUrl;
  const query = encodeURIComponent(`to:"${to}"`);
  let messages: Summary[] = [];
  await expect
    .poll(
      async () => {
        const res = await fetch(`${mailpit}/api/v1/search?query=${query}`);
        ({ messages } = (await res.json()) as { messages: Summary[] });
        return messages.length;
      },
      { message: `an email to ${to}`, timeout: 15_000 },
    )
    .toBeGreaterThan(0);
  // Newest first. Older ones carry codes it has replaced, so they go too.
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
  const { subject, html } = await takeEmail(to);
  const code = subject.match(/Your Benvolio code: (\d{6,10})/)?.[1];
  const link = html.match(/href="([^"]*\/auth\/confirm\?[^"]*)"/)?.[1]?.replaceAll("&amp;", "&");
  if (!code || !link) throw new Error(`Not a sign-in email: ${subject}`);
  return { code, link };
}
