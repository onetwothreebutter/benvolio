import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { cache } from "react";
import { supabaseEnv } from "./env";

/**
 * A client acting as the signed-in person, so row-level security applies. For
 * Server Components, Server Actions and Route Handlers. Shared within
 * a Server Component render; actions and route handlers get a fresh one.
 */
export const createClient = cache(async () => {
  const cookieStore = await cookies();
  const { url, key } = supabaseEnv();
  return createServerClient(url, key, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Server Components can't set cookies. The middleware refreshes the
          // session on every request, so nothing is lost.
        }
      },
    },
  });
});
