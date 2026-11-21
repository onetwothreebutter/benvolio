import { sittingParts, type Items, type Response, type Submission, type Tags } from "@/lib/conversation/model";
import type { ResponseKind } from "@/lib/conversation/rounds";

/** Three numbered items, as every round writes. */
export const three = (prefix: string): Items => [`${prefix} 1`, `${prefix} 2`, `${prefix} 3`];
const tags: Tags = [["hopeful"], [], ["sad", "relieved"]];

/** A valid submission for each sitting, its text marked with `who`. */
export function validSitting(sitting: number, who: string): Submission {
  const { stance, write, respond } = sittingParts(sitting);
  const submission: Submission = {};
  if (stance) submission.stance = `${who} stance`;
  if (write) submission.write = three(`${who} ${write.itemLabel}`);
  if (respond) {
    const responses: Record<ResponseKind, Response> = {
      rephrase: { kind: "rephrase", texts: three(`${who} rephrase`) },
      answer: { kind: "answer", texts: three(`${who} answer`), tags },
      react: { kind: "react", tags },
      agree: { kind: "agree", agree: [true, false, true], tags },
      rank: { kind: "rank", ranks: [2, 1, 3] },
    };
    submission.respond = responses[respond.kind];
  }
  return submission;
}
