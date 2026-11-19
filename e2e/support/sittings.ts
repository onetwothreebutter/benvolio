import type { Role } from "@/lib/conversation/model";
import { validSitting } from "@/test/sittings";
import { adminDatabase } from "./database";

/**
 * Stands in for the writing screens, which aren't built yet: records what a
 * person writes in a sitting straight into the database, using the unit
 * tests' valid submissions. When the screens exist, type into them instead.
 */
export async function writeSitting(benvolioId: string, role: Role, sitting: number) {
  const { error } = await adminDatabase()
    .from("submissions")
    .insert({ benvolio_id: benvolioId, sitting, role, body: validSitting(sitting, role) });
  if (error) throw new Error(`Writing sitting ${sitting} failed: ${error.message}`);
}

/**
 * Stands in for the initiator accepting the partner's new wording, which has
 * no button yet. Does what decideQuestion in the model does: the wording
 * becomes the question, and the initiator's opening reopens.
 */
export async function acceptProposedQuestion(benvolioId: string) {
  const db = adminDatabase();
  const { data, error } = await db
    .from("benvolios")
    .select("proposed_question")
    .eq("id", benvolioId)
    .single();
  if (error || !data.proposed_question) throw new Error("No wording to accept");
  const results = await Promise.all([
    db
      .from("benvolios")
      .update({ question: data.proposed_question, proposed_question: null })
      .eq("id", benvolioId),
    db
      .from("submissions")
      .delete()
      .match({ benvolio_id: benvolioId, sitting: 0, role: "initiator" }),
  ]);
  for (const { error } of results) {
    if (error) throw new Error(`Accepting the wording failed: ${error.message}`);
  }
}
