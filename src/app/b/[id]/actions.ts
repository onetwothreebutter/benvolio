"use server";

import { redirect } from "next/navigation";
import { requireSignedIn } from "@/lib/auth/session";
import { isBenvolioId } from "@/lib/db/benvolio-id";
import { newInviteToken } from "@/lib/invites/token";
import { siteUrl } from "@/lib/site-url";
import { createAdminClient } from "@/lib/supabase/admin";

const NOT_RENEWABLE = "There's no invite to renew: they may have joined already.";

export type RenewState = { url?: string; error?: string };

/** A new invite link, replacing the old one, while the partner hasn't joined. */
export async function renewInvite(_state: RenewState, form: FormData): Promise<RenewState> {
  const id = String(form.get("benvolio_id") ?? "");
  const { userId } = await requireSignedIn(`/b/${id}`);
  if (!isBenvolioId(id)) return { error: NOT_RENEWABLE };
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

const NOTHING_TO_DECIDE = "There's no new wording to decide on: you may have decided already.";

export type DecideState = { error?: string };

/**
 * The initiator uses the partner's new wording for the question, or keeps
 * their own. Using it reopens their opening, if written, to answer it.
 */
export async function decideQuestion(_state: DecideState, form: FormData): Promise<DecideState> {
  const id = String(form.get("benvolio_id") ?? "");
  const here = `/b/${id}`;
  const { userId } = await requireSignedIn(here);
  if (!isBenvolioId(id)) return { error: NOTHING_TO_DECIDE };
  const { data, error } = await createAdminClient().rpc("decide_question", {
    benvolio: id,
    initiator: userId,
    accept: form.get("accept") === "yes",
  });
  if (error) throw new Error(`Deciding on the question failed: ${error.message}`);
  if (!data) return { error: NOTHING_TO_DECIDE };
  redirect(here);
}
