import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Pace } from "@/lib/analytics/events";
import { partnerOf, type Conversation } from "@/lib/conversation/model";
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

export type BenvolioForEmail = {
  id: string;
  pace: Pace;
  /** When it last moved (see the active_at migration). */
  activeAt: string;
  people: ParticipantRow[];
  /** Which sittings each person has sent, with empty bodies. */
  conversation: Conversation;
};

/**
 * Benvolios as the server needs them to work out whom to email: the people
 * in each and which sittings each has sent, but never what anyone wrote.
 */
export async function loadBenvoliosForEmail(ids: string[]): Promise<BenvolioForEmail[]> {
  const valid = ids.filter(isBenvolioId);
  const loaded: BenvolioForEmail[] = [];
  for (let i = 0; i < valid.length; i += EMAIL_BATCH) loaded.push(...(await loadBatch(valid.slice(i, i + EMAIL_BATCH))));
  return loaded;
}

/**
 * Benvolios per query: at most 12 submissions each stays under PostgREST's
 * 1,000-row limit, and the ids stay well within a URL's length.
 */
const EMAIL_BATCH = 50;

async function loadBatch(ids: string[]): Promise<BenvolioForEmail[]> {
  if (ids.length === 0) return [];
  const admin = createAdminClient();
  const [benvolios, participants, submissions] = await Promise.all([
    admin.from("benvolios").select("id, question, proposed_question, pace, active_at").in("id", ids),
    admin.from("participants").select("benvolio_id, role, person_id, first_name").in("benvolio_id", ids),
    admin.from("submissions").select("benvolio_id, sitting, role").in("benvolio_id", ids),
  ]);
  for (const { error } of [benvolios, participants, submissions]) {
    if (error) throw new Error(`Loading Benvolios to email about failed: ${error.message}`);
  }
  type Of<T> = T & { benvolio_id: string };
  const people = Map.groupBy(participants.data as Of<ParticipantRow>[], (row) => row.benvolio_id);
  const sent = Map.groupBy(submissions.data as Of<Omit<SubmissionRow, "body">>[], (row) => row.benvolio_id);
  return (benvolios.data as (BenvolioRow & { id: string; pace: Pace; active_at: string })[]).map((b) => {
    const inIt = people.get(b.id) ?? [];
    const rows = (sent.get(b.id) ?? []).map((row) => ({ ...row, body: {} }));
    return { id: b.id, pace: b.pace, activeAt: b.active_at, people: inIt, conversation: toConversation(b, inIt, rows) };
  });
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
