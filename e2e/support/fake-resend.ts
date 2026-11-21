import { createServer } from "node:http";

/**
 * A stand-in for Resend's API in end-to-end tests: takes the app's POST
 * /emails, checks it the way Resend would, and delivers it to local
 * Supabase's Mailpit, where tests read it like any other email. Playwright
 * starts it (see playwright.config.ts); nothing ever reaches Resend.
 *
 * Usage: node --experimental-strip-types e2e/support/fake-resend.ts <port> <mailpit url> <api key>
 * (the flag is needed before Node 22.18 and harmless after).
 */
const [port, mailpit, apiKey] = process.argv.slice(2);
if (!port || !mailpit || !apiKey) throw new Error("Usage: fake-resend.ts <port> <mailpit url> <api key>");

type ResendEmail = { from: string; to: string[]; subject: string; html: string; text: string };

/** "Benvolio <hello@x>" as Mailpit's { Name, Email }. */
function address(value: string) {
  const match = value.match(/^(.*?)\s*<([^>]+)>$/);
  return match ? { Name: match[1], Email: match[2] } : { Email: value };
}

const reply = (res: import("node:http").ServerResponse, status: number, body: object) => {
  res.writeHead(status, { "Content-Type": "application/json" }).end(JSON.stringify(body));
};

createServer((req, res) => {
  // A crash here would fail every later email test with a bare timeout.
  handle(req, res).catch((e: unknown) => {
    console.error("fake-resend:", e);
    if (!res.headersSent) reply(res, 500, { name: "application_error" });
  });
}).listen(Number(port));

async function handle(req: import("node:http").IncomingMessage, res: import("node:http").ServerResponse) {
  if (req.method === "GET") return reply(res, 200, { ok: true }); // Playwright's readiness check.
  if (req.method !== "POST" || req.url !== "/emails") return reply(res, 404, { name: "not_found" });
  if (req.headers.authorization !== `Bearer ${apiKey}`) return reply(res, 401, { name: "missing_api_key" });
  if (!req.headers["idempotency-key"]) return reply(res, 422, { name: "validation_error" });
  let body = "";
  for await (const chunk of req) body += chunk;
  const email = JSON.parse(body) as ResendEmail;
  if (!email.from || !email.to?.length || !email.subject || !email.html) {
    return reply(res, 422, { name: "validation_error" });
  }
  const sent = await fetch(`${mailpit}/api/v1/send`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      From: address(email.from),
      To: email.to.map(address),
      Subject: email.subject,
      HTML: email.html,
      Text: email.text,
    }),
  });
  if (!sent.ok) return reply(res, 500, { name: "application_error" });
  reply(res, 200, { id: ((await sent.json()) as { ID: string }).ID });
}
