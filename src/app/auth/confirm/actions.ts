"use server";

import { redirect } from "next/navigation";
import { takeNext } from "@/lib/auth/next-cookie";
import { withNext } from "@/lib/auth/safe-next";
import { createClient } from "@/lib/supabase/server";

/** Signs in with the token from the emailed link. */
export async function confirmSignIn(form: FormData) {
  const tokenHash = form.get("token_hash");
  const next = await takeNext();
  if (typeof tokenHash === "string" && tokenHash) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: "email" });
    // /welcome asks new people their name and passes everyone else straight on.
    if (!error) redirect(withNext("/welcome", next));
  }
  redirect(`${withNext("/sign-in", next)}&error=link`);
}
