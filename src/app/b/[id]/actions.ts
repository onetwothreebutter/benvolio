"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { trackServer } from "@/lib/analytics/server";
import type { RoundNumber } from "@/lib/analytics/events";
import { requireSignedIn } from "@/lib/auth/session";
import { LAST_SITTING, MAX_ITEM_LENGTH, nextAction, parseSubmission } from "@/lib/conversation/model";
import { sittingInput, type SittingInput } from "@/lib/conversation/sitting-input";
import { loadBenvolioToWrite } from "@/lib/db/load-benvolio";
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
  const choice = form.get("accept");
  if (!isBenvolioId(id) || (choice !== "yes" && choice !== "no")) return { error: NOTHING_TO_DECIDE };
  const { data, error } = await createAdminClient().rpc("decide_question", {
    benvolio: id,
    initiator: userId,
    accept: choice === "yes",
  });
  if (error) throw new Error(`Deciding on the question failed: ${error.message}`);
  if (!data) {
    // Decided elsewhere: show where things stand, with the message.
    revalidatePath(here);
    return { error: NOTHING_TO_DECIDE };
  }
  redirect(here);
}

const INVALID: Record<string, string> = {
  stance: "Please write where you stand.",
  write: `Please write all three, each up to ${MAX_ITEM_LENGTH.toLocaleString("en")} characters.`,
};

export type SitState = { error?: string; input?: SittingInput };

/**
 * Sends what this person wrote in their current sitting. If it isn't their
 * turn for that sitting (another tab sent it, or the page is stale), the page
 * reloads to show where things stand.
 */
export async function submitSitting(_state: SitState, form: FormData): Promise<SitState> {
  const id = String(form.get("benvolio_id") ?? "");
  const here = `/b/${id}`;
  const { userId } = await requireSignedIn(here);
  const sitting = Number(form.get("sitting"));
  const benvolio = await loadBenvolioToWrite(id, userId);
  if (!benvolio) redirect(here);
  const action = nextAction(benvolio.conversation, benvolio.role);
  if (action.kind !== "sit" || action.sitting !== sitting) redirect(here);

  const input = sittingInput(sitting, form);
  const parsed = parseSubmission(sitting, input);
  if (!parsed.ok) return { error: INVALID[parsed.invalid] ?? "Please check what you wrote.", input };
  const { error } = await createAdminClient()
    .from("submissions")
    .insert({ benvolio_id: id, sitting, role: benvolio.role, body: parsed.submission });
  // A duplicate means another tab sent this sitting first.
  if (error && error.code !== "23505") throw new Error(`Sending a sitting failed: ${error.message}`);
  if (!error) {
    // A sitting responds to the round revealed before it and writes the next.
    if (sitting > 0) {
      trackServer(userId, "step_submitted", {
        benvolio_id: id,
        round: sitting as RoundNumber,
        step: "respond",
        sitting,
      });
    }
    if (sitting < LAST_SITTING) {
      trackServer(userId, "step_submitted", {
        benvolio_id: id,
        round: (sitting + 1) as RoundNumber,
        step: "write",
        sitting,
      });
    }
  }
  redirect(here);
}
