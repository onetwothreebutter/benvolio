import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/** POST only, so a link or prefetch can't sign anyone out. */
export async function POST() {
  const supabase = await createClient();
  // Only this browser: signing out on one phone shouldn't sign you out of the others.
  await supabase.auth.signOut({ scope: "local" });
  redirect("/");
}
