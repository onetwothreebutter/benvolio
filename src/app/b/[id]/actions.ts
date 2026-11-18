"use server";

import { requireSignedIn } from "@/lib/auth/session";
import { newInviteToken } from "@/lib/invites/token";
import { siteUrl } from "@/lib/site-url";
import { createAdminClient } from "@/lib/supabase/admin";

const NOT_RENEWABLE = "There's no invite to renew: they may have joined already.";

export type RenewState = { url?: string; error?: string };

/** A new invite link, replacing the old one, while the partner hasn't joined. */
export async function renewInvite(_state: RenewState, form: FormData): Promise<RenewState> {
  const id = String(form.get("benvolio_id") ?? "");
  const { userId } = await requireSignedIn(`/b/${id}`);
  if (!/^[0-9a-f-]{36}$/i.test(id)) return { error: NOT_RENEWABLE };
  const { token, hash } = newInviteToken();
  const { data, error } = await createAdminClient().rpc("renew_invite", {
    benvolio: id,
    initiator: userId,
    token_hash: hash,
  });
  if (error) throw new Error(`Renewing an invite failed: ${error.message}`);
  if (!data) return { error: NOT_RENEWABLE };
  return { url: `${siteUrl()}/join/${token}` };
}
