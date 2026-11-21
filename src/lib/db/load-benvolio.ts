import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { partnerOf } from "@/lib/conversation/model";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { isBenvolioId } from "./benvolio-id";
import {
  toConversation,
  type BenvolioRow,
  type ParticipantRow,
  type SubmissionRow,
} from "./conversation";

/**
 * A Benvolio as the signed-in person may see it, read through row-level
 * security. Null if it doesn't exist or they aren't in it.
 */
export async function loadBenvolio(id: string, userId: string) {
  return readBenvolio(await createClient(), id, userId);
}

/**
 * The whole Benvolio, partner's unrevealed writing included, for checking a
 * write against the turn-taking rules. Never show it: use loadBenvolio for that.
 */
export function loadBenvolioToWrite(id: string, userId: string) {
  return readBenvolio(createAdminClient(), id, userId);
}

async function readBenvolio(supabase: SupabaseClient, id: string, userId: string) {
  if (!isBenvolioId(id)) return null;
  // Three queries: submissions reference participants, not benvolios, so
  // PostgREST can't embed them in one select.
  const [benvolio, participants, submissions] = await Promise.all([
    supabase.from("benvolios").select("question, proposed_question").eq("id", id).maybeSingle(),
    supabase.from("participants").select("role, person_id, first_name").eq("benvolio_id", id),
    supabase.from("submissions").select("sitting, role, body").eq("benvolio_id", id),
  ]);
  for (const { error } of [benvolio, participants, submissions]) {
    if (error) throw new Error(`Loading a Benvolio failed: ${error.message}`);
  }
  if (!benvolio.data) return null;

  const people = participants.data as ParticipantRow[];
  const me = people.find((p) => p.person_id === userId);
  const partner = me && people.find((p) => p.role === partnerOf(me.role));
  if (!me || !partner) return null;
  return {
    role: me.role,
    partnerName: partner.first_name,
    conversation: toConversation(
      benvolio.data as BenvolioRow,
      people,
      submissions.data as SubmissionRow[],
    ),
  };
}
