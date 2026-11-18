import "server-only";
import { createClient } from "@supabase/supabase-js";
import { supabaseEnv } from "./env";

/**
 * A client with the secret key, which bypasses row-level security. Every write
 * goes through it, and only after the server has checked who is asking.
 */
export function createAdminClient() {
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!secret) throw new Error("Set SUPABASE_SECRET_KEY (see .env.example)");
  return createClient(supabaseEnv().url, secret, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
