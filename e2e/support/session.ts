import type { Page } from "@playwright/test";
import { localSupabase } from "./local-supabase";

/**
 * Whether Supabase itself still holds the session in this page's cookies.
 * The app checks tokens locally by their signature, so a page keeps showing
 * someone as signed in until the token expires even after Supabase has
 * ended the session; asking Supabase directly is the only real check.
 */
export async function sessionIsLive(page: Page): Promise<boolean> {
  // @supabase/ssr stores the session as "base64-" + JSON, split into numbered
  // chunks once it's long.
  const chunks = (await page.context().cookies())
    .filter((c) => /^sb-.+-auth-token(\.\d+)?$/.test(c.name))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
  if (chunks.length === 0) return false;
  const stored = chunks.map((c) => c.value).join("");
  const json = Buffer.from(stored.replace(/^base64-/, ""), "base64url").toString("utf8");
  const { access_token: accessToken } = JSON.parse(json) as { access_token: string };

  const { url, publishableKey } = localSupabase();
  const response = await fetch(`${url}/auth/v1/user`, {
    headers: { apikey: publishableKey, Authorization: `Bearer ${accessToken}` },
  });
  return response.ok;
}
