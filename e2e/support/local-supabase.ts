import { execFileSync } from "node:child_process";

export type LocalSupabase = {
  url: string;
  publishableKey: string;
  secretKey: string;
  mailpitUrl: string;
};

let cached: LocalSupabase | undefined;

/**
 * The addresses and keys of the Supabase that `npx supabase start` is running.
 * Refuses anything but localhost: the tests create accounts and Benvolios.
 */
export function localSupabase(): LocalSupabase {
  if (cached) return cached;
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
  if (!/^http:\/\/(127\.0\.0\.1|localhost)[:/]/.test(found.url)) {
    throw new Error(`Refusing to run end-to-end tests against ${found.url}`);
  }
  cached = found;
  return found;
}
