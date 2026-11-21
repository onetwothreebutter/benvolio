import { LAST_SITTING, type NextAction } from "./model";

/** "your opening" (or "their opening"), else "sitting 3 of 6". */
export function sittingName(sitting: number, whose: "your" | "their" = "your"): string {
  return sitting === 0 ? `${whose} opening` : `sitting ${sitting + 1} of ${LAST_SITTING + 1}`;
}

/** The line on a Benvolio's page that tells this person what happens next. */
export function statusLine(action: NextAction, partner: string): string {
  switch (action.kind) {
    case "join": // Only the recipient joins, and they can't see the page until they have.
      throw new Error("Unreachable: a recipient who hasn't joined can't load this page");
    case "decide_question":
      return `${partner} suggested new wording for the question.`;
    case "wait_for_question":
      return `Waiting for ${partner} to agree to your wording.`;
    case "sit":
      return `Your turn: ${action.sitting === 0 ? "write " : ""}${sittingName(action.sitting)}.`;
    case "wait":
      return `Waiting for ${partner} to write theirs.`;
    case "finished":
      return "You've finished this Benvolio.";
  }
}
