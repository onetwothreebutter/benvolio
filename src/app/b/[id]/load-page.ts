import "server-only";
import { notFound, redirect } from "next/navigation";
import { withNext } from "@/lib/auth/safe-next";
import { getProfile, requireSignedIn } from "@/lib/auth/session";
import { loadBenvolio } from "@/lib/db/load-benvolio";

/**
 * The Benvolio a page at `here` is about, as the signed-in person may see it.
 * Sends anyone signed out to sign in, anyone without a name to give one, and
 * shows a 404 to anyone not in it.
 */
export async function loadBenvolioPage(id: string, here: string) {
  const { userId } = await requireSignedIn(here);
  const [profile, benvolio] = await Promise.all([getProfile(userId), loadBenvolio(id, userId)]);
  if (!profile) redirect(withNext("/welcome", here));
  if (!benvolio) notFound();
  return benvolio;
}
