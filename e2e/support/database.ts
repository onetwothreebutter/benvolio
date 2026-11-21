import { createClient } from "@supabase/supabase-js";
import { localSupabase } from "./local-supabase";

function connect() {
  const { url, secretKey } = localSupabase();
  return createClient(url, secretKey, { auth: { persistSession: false, autoRefreshToken: false } });
}

let client: ReturnType<typeof connect> | undefined;

/** Local Supabase with the secret key, for setting up what the UI can't, like time passing. */
export function adminDatabase() {
  client ??= connect();
  return client;
}
