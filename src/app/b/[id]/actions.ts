"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { trackServer } from "@/lib/analytics/server";
import type { RoundNumber } from "@/lib/analytics/events";
import { requireSignedIn } from "@/lib/auth/session";
import {
  checkSubmission,
  MAX_ITEM_LENGTH,
  sittingParts,
  type ParseResult,
} from "@/lib/conversation/model";
import { MAX_FEELINGS_PER_ITEM } from "@/lib/conversation/feelings";
import { ITEMS_PER_ROUND, type ResponseKind } from "@/lib/conversation/rounds";
import { isBenvolioId } from "@/lib/db/benvolio-id";
import { loadBenvolioToWrite } from "@/lib/db/load-benvolio";
import { newInviteToken } from "@/lib/invites/token";
import { siteUrl } from "@/lib/site-url";
import { createAdminClient } from "@/lib/supabase/admin";
import { FIELD, sittingInput, text, type SittingInput } from "./sitting-input";

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

const CHECK_IT = "Please check what you wrote.";
const INVALID: Record<Extract<ParseResult, { ok: false }>["invalid"], string> = {
  stance: `Please write where you stand, in up to ${MAX_ITEM_LENGTH.toLocaleString("en")} characters.`,
  write: `Please write all ${ITEMS_PER_ROUND}, each up to ${MAX_ITEM_LENGTH.toLocaleString("en")} characters.`,
  respond: CHECK_IT, // Said per kind: see INVALID_RESPONSE.
  sitting: CHECK_IT,
  shape: CHECK_IT,
};

const FEELINGS_LIMIT = `You can pick up to ${MAX_FEELINGS_PER_ITEM} feelings for each.`;
const INVALID_RESPONSE: Record<ResponseKind, string> = {
  rephrase: `Please put all ${ITEMS_PER_ROUND} in your own words.`,
  answer: `Please answer all ${ITEMS_PER_ROUND}. ${FEELINGS_LIMIT}`,
  react: FEELINGS_LIMIT,
  agree: "Please say whether you agree with each one.",
  rank: `Please rank them 1 to ${ITEMS_PER_ROUND}, using each number once.`,
};

export type SitState = {
  error?: string;
  input?: SittingInput;
  /** The question as it now stands, when it changed under an opening. */
  question?: string;
};

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

  const input = sittingInput(sitting, form);
  // An opening answers the question as its writer saw it. If that changed
  // (new wording suggested or accepted meanwhile), give it back, not lose it.
  const { question } = benvolio.conversation;
  const opening = sittingParts(sitting).stance;
  if (opening && text(form.get(FIELD.question)) !== text(question.text)) {
    return {
      error: `The question is now “${question.text}”. Check your opening still answers it, then send it.`,
      input,
      question: question.text,
    };
  }
  if (opening && question.proposed !== undefined) {
    return {
      error: `${benvolio.partnerName} has suggested new wording for the question. Keep a copy of what you wrote, then reload the page to decide.`,
      input,
    };
  }
  const checked = checkSubmission(benvolio.conversation, benvolio.role, sitting, input);
  if (!checked.ok) {
    if ("notYourTurn" in checked) redirect(here);
    const { respond } = sittingParts(sitting);
    const error =
      checked.invalid === "respond" && respond ? INVALID_RESPONSE[respond.kind] : INVALID[checked.invalid];
    return { error, input };
  }
  const { error } = await createAdminClient()
    .from("submissions")
    .insert({ benvolio_id: id, sitting, role: benvolio.role, body: checked.submission });
  // A duplicate means another tab sent this sitting first.
  if (error?.code === "23505") redirect(here);
  if (error) throw new Error(`Sending a sitting failed: ${error.message}`);

  const { respond, write } = sittingParts(sitting);
  for (const [step, part] of [["respond", respond], ["write", write]] as const) {
    if (part) {
      trackServer(userId, "step_submitted", {
        benvolio_id: id,
        round: part.round as RoundNumber,
        step,
        sitting,
      });
    }
  }
  redirect(here);
}

