import { LAST_SITTING, type NextAction } from "./model";

/** The line on a Benvolio's page that tells this person what happens next. */
export function statusLine(action: NextAction, partner: string): string {
  switch (action.kind) {
    case "join": // Only the recipient joins, and they can't see the page until they have.
      throw new Error("Unreachable: a recipient who hasn't joined can't load this page");
    case "decide_question":
      return `${partner} suggested new wording: “${action.proposed}”`;
    case "wait_for_question":
      return `Waiting for ${partner} to agree to your wording.`;
    case "sit":
      return action.sitting === 0
        ? "Your turn: write your opening."
        : `Your turn: sitting ${action.sitting + 1} of ${LAST_SITTING + 1}.`;
    case "wait":
      return `Waiting for ${partner} to write theirs.`;
    case "finished":
      return "You've finished this Benvolio.";
  }
}
