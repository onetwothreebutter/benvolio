import { execFileSync } from "node:child_process";

export type LocalSupabase = {
  url: string;
  publishableKey: string;
  secretKey: string;
  mailpitUrl: string;
};

/**
 * The addresses and keys of the Supabase that `npx supabase start` is running.
 * Refuses anything but localhost: the tests create accounts and Benvolios.
 */
export function localSupabase(): LocalSupabase {
  // Looked up once by the runner; its workers inherit the answer.
  const known = process.env.E2E_LOCAL_SUPABASE;
  const found = known ? (JSON.parse(known) as LocalSupabase) : fromCli();
  for (const url of [found.url, found.mailpitUrl]) {
    if (!/^http:\/\/(127\.0\.0\.1|localhost)[:/]/.test(url)) {
      throw new Error(`Refusing to run end-to-end tests against ${url}`);
    }
  }
  process.env.E2E_LOCAL_SUPABASE = JSON.stringify(found);
  return found;
}

function fromCli(): LocalSupabase {
  let out: string;
  try {
    out = execFileSync("npx", ["supabase", "status", "-o", "json"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch {
    throw new Error("Local Supabase isn't running. Start it with `npx supabase start`.");
  }
  // The CLI may print notices before the JSON.
  const status = JSON.parse(out.slice(out.indexOf("{")));
  const found: LocalSupabase = {
    url: status.API_URL,
    publishableKey: status.PUBLISHABLE_KEY,
    secretKey: status.SECRET_KEY,
    mailpitUrl: status.MAILPIT_URL ?? status.INBUCKET_URL,
  };
  for (const [name, value] of Object.entries(found)) {
    if (!value) throw new Error(`\`supabase status\` gave no ${name}`);
  }
  return found;
}
