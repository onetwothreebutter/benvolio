"use server";

import { redirect } from "next/navigation";
import { requireSignedIn } from "@/lib/auth/session";
import { safeNext, withNext } from "@/lib/auth/safe-next";
import { cleanFirstName } from "@/lib/people/first-name";
import { createAdminClient } from "@/lib/supabase/admin";

export type WelcomeState = { error?: string };

export async function saveFirstName(_state: WelcomeState, form: FormData): Promise<WelcomeState> {
  const next = safeNext(form.get("next"));
  const { userId } = await requireSignedIn(withNext("/welcome", next));
  const firstName = cleanFirstName(form.get("first_name"));
  if (!firstName) return { error: "Please enter your first name." };

  const { error } = await createAdminClient()
    .from("people")
    .upsert({ id: userId, first_name: firstName });
  if (error) throw new Error(`Saving first name failed: ${error.message}`);
  redirect(next);
}
