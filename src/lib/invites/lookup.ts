import "server-only";
import type { ParticipantRow } from "@/lib/db/conversation";
import { createAdminClient } from "@/lib/supabase/admin";
import { hashInviteToken, isInviteToken } from "./token";

export type OpenInvite = {
  question: string;
  initiatorId: string;
  initiatorName: string;
};

/**
 * What an unexpired invite shows before anyone joins: who sent it and the
 * question, never the initiator's stance (see inviteView in the model).
 * join_benvolio checks expiry again, by the database's clock.
 */
export async function findInvite(token: unknown): Promise<OpenInvite | null> {
  if (!isInviteToken(token)) return null;
  const { data: invite, error } = await createAdminClient()
    .from("invites")
    .select("benvolios (question, participants (role, person_id, first_name))")
    .eq("token_hash", hashInviteToken(token))
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
  if (error) throw new Error(`Looking up an invite failed: ${error.message}`);
  if (!invite) return null;

  const { question, participants } = invite.benvolios as unknown as {
    question: string;
    participants: ParticipantRow[];
  };
  // The schema guarantees an initiator with an account.
  const initiator = participants.find((p) => p.role === "initiator")!;
  return { question, initiatorId: initiator.person_id!, initiatorName: initiator.first_name };
}
