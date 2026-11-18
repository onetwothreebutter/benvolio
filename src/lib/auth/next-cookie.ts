import "server-only";
import { cookies } from "next/headers";
import { safeNext } from "./safe-next";

/**
 * Where the emailed sign-in link should land. The link itself is built from
 * the Site URL alone (see docs/auth.md), so it never depends on Supabase
 * accepting a redirect address; `next` waits here in the browser that asked.
 * Opened in another browser, the link lands on the home page instead. One per
 * browser: if two tabs sign in at once, the later one wins.
 */
const NAME = "benvolio-next";
const OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax",
  path: "/auth",
} as const;

export async function rememberNext(next: string) {
  (await cookies()).set(NAME, next, { ...OPTIONS, maxAge: 60 * 60 });
}

export async function takeNext(): Promise<string> {
  const store = await cookies();
  const next = safeNext(store.get(NAME)?.value);
  store.set(NAME, "", { ...OPTIONS, maxAge: 0 });
  return next;
}
