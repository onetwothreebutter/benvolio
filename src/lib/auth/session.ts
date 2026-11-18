import "server-only";
import { redirect } from "next/navigation";
import { cache } from "react";
import { withNext } from "@/lib/auth/safe-next";
import { createClient } from "@/lib/supabase/server";

export type SignedIn = { userId: string; email: string };
export type Person = SignedIn & { firstName: string };

/** Who is signed in, from a verified token, or null. */
export const getSignedIn = cache(async (): Promise<SignedIn | null> => {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (error || !claims?.sub || typeof claims.email !== "string") return null;
  return { userId: claims.sub, email: claims.email };
});

/** The signed-in person's profile, or null if they haven't told us their name yet. */
export async function getProfile(userId: string): Promise<{ firstName: string } | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("people")
    .select("first_name")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw error;
  return data && { firstName: data.first_name as string };
}

/** For pages that need an account: sends anyone signed out to sign in, then back to `here`. */
export async function requireSignedIn(here: string): Promise<SignedIn> {
  const signedIn = await getSignedIn();
  if (!signedIn) redirect(withNext("/sign-in", here));
  return signedIn;
}

/** As requireSignedIn, and also sends anyone without a first name to /welcome first. */
export async function requirePerson(here: string): Promise<Person> {
  const signedIn = await requireSignedIn(here);
  const profile = await getProfile(signedIn.userId);
  if (!profile) redirect(withNext("/welcome", here));
  return { ...signedIn, ...profile };
}
