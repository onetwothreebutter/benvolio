"use server";

import { redirect } from "next/navigation";
import { MAX_QUESTION_LENGTH, proposedWording, TurnError } from "@/lib/conversation/model";
import { withNext } from "@/lib/auth/safe-next";
import { requirePerson } from "@/lib/auth/session";
import { refusal } from "@/lib/db/rpc-error";
import { notifyLater } from "@/lib/email/notify";
import { findInvite } from "@/lib/invites/lookup";
import { INVITE_GONE, OWN_INVITE } from "@/lib/invites/messages";
import { hashInviteToken, isInviteToken } from "@/lib/invites/token";
import { createAdminClient } from "@/lib/supabase/admin";

export type JoinState = { error?: string };

export async function joinBenvolio(_state: JoinState, form: FormData): Promise<JoinState> {
  const token = form.get("token");
  if (!isInviteToken(token)) return { error: INVITE_GONE };
  const [person, invite] = await Promise.all([requirePerson(`/join/${token}`), findInvite(token)]);
  if (!invite) return { error: INVITE_GONE };
  if (invite.initiatorId === person.userId) return { error: OWN_INVITE };

  let proposed: string | undefined;
  try {
    proposed = proposedWording(invite.question, form.get("question") ?? undefined);
  } catch (e) {
    if (!(e instanceof TurnError)) throw e;
    return { error: `The question can be up to ${MAX_QUESTION_LENGTH} characters.` };
  }

  const { data, error } = await createAdminClient().rpc("join_benvolio", {
    token_hash: hashInviteToken(token),
    recipient: person.userId,
    proposed_question: proposed ?? null,
  });
  switch (refusal(error)) {
    case "invite_not_found":
      return { error: INVITE_GONE };
    case "own_invite":
      return { error: OWN_INVITE };
    case "no_profile":
      redirect(withNext("/welcome", `/join/${token}`));
  }
  if (error) throw new Error(`Joining a Benvolio failed: ${error.message}`);
  notifyLater(data as string, "recipient");
  redirect(`/b/${data as string}`);
}
