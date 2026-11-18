import type { Conversation, Role, Submission } from "@/lib/conversation/model";

export type BenvolioRow = { question: string; proposed_question: string | null };
export type ParticipantRow = { role: Role; person_id: string | null; first_name: string };
export type SubmissionRow = { sitting: number; role: Role; body: Submission };

/**
 * Builds the model's view of a Benvolio from database rows. Read with the
 * signed-in person's client, row-level security leaves out partner writing
 * that isn't revealed yet, which is exactly what nextAction needs: a sitting
 * shows as revealed only when both submissions are visible.
 */
export function toConversation(
  benvolio: BenvolioRow,
  participants: ParticipantRow[],
  submissions: SubmissionRow[],
): Conversation {
  const rows: Conversation["submissions"] = [];
  for (const { sitting, role, body } of submissions) {
    rows[sitting] = { ...rows[sitting], [role]: body };
  }
  return {
    question: {
      text: benvolio.question,
      ...(benvolio.proposed_question !== null && { proposed: benvolio.proposed_question }),
    },
    recipientJoined: participants.some((p) => p.role === "recipient" && p.person_id !== null),
    submissions: Array.from(rows, (row) => row ?? {}),
  };
}
