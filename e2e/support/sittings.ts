import { LAST_SITTING, parseSubmission, type Role } from "@/lib/conversation/model";
import { ROUNDS } from "@/lib/conversation/rounds";
import { adminDatabase } from "./database";

/**
 * Stands in for the writing screens, which aren't built yet: records what a
 * person writes in a sitting straight into the database. Each body is checked
 * with the model's own parser, so it is exactly what the app will accept.
 * When the screens exist, tests should type into them instead.
 */
export async function writeSitting(benvolioId: string, role: Role, sitting: number) {
  const items = (what: string) => [1, 2, 3].map((n) => `${what} ${n}`);
  const tags = [[], [], ["hopeful"]];
  const input: Record<string, unknown> = {};
  if (sitting === 0) input.stance = `The ${role}'s view`;
  if (sitting < LAST_SITTING) input.write = items(ROUNDS[sitting].write.itemLabel);
  if (sitting > 0) {
    const kind = ROUNDS[sitting - 1].respond.kind;
    input.respond = {
      rephrase: { kind, texts: items("In other words") },
      answer: { kind, texts: items("My answer"), tags },
      react: { kind, tags },
      agree: { kind, agree: [true, false, true], tags },
      rank: { kind, ranks: [2, 1, 3] },
    }[kind];
  }
  const parsed = parseSubmission(sitting, input);
  if (!parsed.ok) throw new Error(`Test sitting ${sitting} is invalid: ${parsed.invalid}`);

  const { error } = await adminDatabase()
    .from("submissions")
    .insert({ benvolio_id: benvolioId, sitting, role, body: parsed.submission });
  if (error) throw new Error(`Writing sitting ${sitting} failed: ${error.message}`);
}

/**
 * Stands in for the initiator accepting the partner's new wording, which has
 * no button yet. Matches decideQuestion in the model.
 */
export async function acceptProposedQuestion(benvolioId: string) {
  const db = adminDatabase();
  const { data, error } = await db
    .from("benvolios")
    .select("proposed_question")
    .eq("id", benvolioId)
    .single();
  if (error || !data.proposed_question) throw new Error("No wording to accept");
  const update = await db
    .from("benvolios")
    .update({ question: data.proposed_question, proposed_question: null })
    .eq("id", benvolioId);
  if (update.error) throw new Error(`Accepting the wording failed: ${update.error.message}`);
}
