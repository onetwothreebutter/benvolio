import { hasSubmitted, nextAction, partnerOf, type Conversation, type Role } from "@/lib/conversation/model";

/**
 * Why it's someone's turn: `waiting`, their partner has already written the
 * sitting they owe; `readable`, the sitting before it was just revealed, so
 * there's writing to read; `start`, nobody has written anything yet.
 */
export type TurnReason = "waiting" | "readable" | "start";

export type TurnNotice =
  | { kind: "your_turn"; sitting: number; why: TurnReason }
  | { kind: "question_proposed" }
  | { kind: "finished" };

/**
 * What to email this person about the conversation as it stands: that it's
 * their turn, that their partner suggested new wording for the question, that
 * it's finished, or nothing while they wait or haven't joined. Sending the same
 * notice twice is prevented elsewhere (sendOnce), so this can be asked after
 * every change.
 */
export function turnNotice(c: Conversation, role: Role): TurnNotice | null {
  const action = nextAction(c, role);
  if (action.kind === "finished") return { kind: "finished" };
  if (action.kind === "decide_question") return { kind: "question_proposed" };
  if (action.kind !== "sit") return null;
  const { sitting } = action;
  const why: TurnReason = hasSubmitted(c, sitting, partnerOf(role))
    ? "waiting"
    : sitting > 0
      ? "readable"
      : "start";
  return { kind: "your_turn", sitting, why };
}
