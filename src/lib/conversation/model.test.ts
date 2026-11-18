import { describe, expect, it } from "vitest";
import {
  currentSitting,
  decideQuestion,
  inviteView,
  isFinished,
  isRevealed,
  join,
  nextAction,
  startConversation,
  submit,
  TurnError,
  validateSubmission,
  visibleSubmissions,
  type Conversation,
  type Role,
  type Submission,
} from "./model";

const three = (prefix: string) => [`${prefix} 1`, `${prefix} 2`, `${prefix} 3`] as [string, string, string];
const noTags = [[], [], []] as [string[], string[], string[]];

/** A valid submission for each sitting. */
function sittingFor(sitting: number, who: string): Submission {
  switch (sitting) {
    case 0:
      return { stance: `${who} stance`, write: three(`${who} reason`) };
    case 1:
      return { respond: { kind: "rephrase", texts: three(`${who} rephrase`) }, write: three(`${who} question`) };
    case 2:
      return {
        respond: { kind: "answer", texts: three(`${who} answer`), tags: [["hopeful"], [], ["sad", "relieved"]] },
        write: three(`${who} share`),
      };
    case 3:
      return { respond: { kind: "react", tags: noTags }, write: three(`${who} agree`) };
    case 4:
      return { respond: { kind: "agree", agree: [true, false, true], tags: noTags }, write: three(`${who} compromise`) };
    default:
      return { respond: { kind: "rank", ranks: [2, 1, 3] } };
  }
}

function sit(c: Conversation, role: Role, sitting: number) {
  return submit(c, role, sitting, sittingFor(sitting, role));
}

function bothThrough(c: Conversation, lastSitting: number) {
  for (let s = 0; s <= lastSitting; s++) c = sit(sit(c, "initiator", s), "recipient", s);
  return c;
}

const started = () => startConversation("  Should we get a dog?  ");

describe("starting and joining", () => {
  it("lets the initiator write first while the recipient has to join", () => {
    const c = started();
    expect(c.question.text).toBe("Should we get a dog?");
    expect(nextAction(c, "initiator")).toEqual({ kind: "sit", sitting: 0 });
    expect(nextAction(c, "recipient")).toEqual({ kind: "join" });
    expect(() => sit(c, "recipient", 0)).toThrow(TurnError);
  });

  it("never shows the initiator's stance in the invite", () => {
    const c = sit(started(), "initiator", 0);
    expect(inviteView(c)).toEqual({ question: "Should we get a dog?" });
  });

  it("keeps the question when the recipient accepts it as is", () => {
    const c = join(started(), "Should we get a dog?");
    expect(c.question).toEqual({ text: "Should we get a dog?" });
    expect(nextAction(c, "recipient")).toEqual({ kind: "sit", sitting: 0 });
    expect(() => join(c)).toThrow(TurnError);
  });
});

describe("rewording the question", () => {
  const proposed = () => sit(join(sit(started(), "initiator", 0), "Should we get a dog this year?"), "recipient", 0);

  it("holds the first reveal until the initiator decides", () => {
    const c = proposed();
    expect(isRevealed(c, 0)).toBe(false);
    expect(nextAction(c, "initiator")).toEqual({ kind: "decide_question", proposed: "Should we get a dog this year?" });
    expect(nextAction(c, "recipient")).toEqual({ kind: "wait", sitting: 0 });
  });

  it("uses the new wording when accepted", () => {
    const c = decideQuestion(proposed(), true);
    expect(c.question).toEqual({ text: "Should we get a dog this year?" });
    expect(isRevealed(c, 0)).toBe(true);
  });

  it("keeps the original wording when declined", () => {
    const c = decideQuestion(proposed(), false);
    expect(c.question).toEqual({ text: "Should we get a dog?" });
    expect(isRevealed(c, 0)).toBe(true);
    expect(() => decideQuestion(c, true)).toThrow(TurnError);
  });
});

describe("taking turns", () => {
  it("reveals a sitting only once both have submitted it", () => {
    let c = join(started());
    c = sit(c, "initiator", 0);
    expect(isRevealed(c, 0)).toBe(false);
    expect(visibleSubmissions(c, 0, "initiator")).toEqual({ mine: sittingFor(0, "initiator"), partner: undefined });
    expect(visibleSubmissions(c, 0, "recipient")).toEqual({ mine: undefined, partner: undefined });
    expect(nextAction(c, "initiator")).toEqual({ kind: "wait", sitting: 0 });

    c = sit(c, "recipient", 0);
    expect(isRevealed(c, 0)).toBe(true);
    expect(visibleSubmissions(c, 0, "recipient").partner).toEqual(sittingFor(0, "initiator"));
    expect(nextAction(c, "initiator")).toEqual({ kind: "sit", sitting: 1 });
  });

  it("does not show a partner's next sitting until you have written yours", () => {
    let c = bothThrough(join(started()), 0);
    c = sit(c, "initiator", 1);
    expect(visibleSubmissions(c, 1, "recipient").partner).toBeUndefined();
    expect(nextAction(c, "recipient")).toEqual({ kind: "sit", sitting: 1 });
  });

  it("rejects a submission out of turn or for a sitting already done", () => {
    let c = join(started());
    expect(() => sit(c, "initiator", 1)).toThrow(TurnError);
    c = sit(c, "initiator", 0);
    expect(() => sit(c, "initiator", 0)).toThrow(TurnError);
    expect(() => sit(c, "initiator", 1)).toThrow(TurnError);
  });

  it("finishes after six sittings each", () => {
    const c = bothThrough(join(started()), 5);
    expect(isFinished(c)).toBe(true);
    expect(currentSitting(c, "initiator")).toBe(6);
    expect(nextAction(c, "initiator")).toEqual({ kind: "finished" });
    expect(nextAction(c, "recipient")).toEqual({ kind: "finished" });
  });

  it("does not change the conversation it was given", () => {
    const c = join(started());
    const before = structuredClone(c);
    sit(c, "initiator", 0);
    expect(c).toEqual(before);
  });
});

describe("validateSubmission", () => {
  it.each([0, 1, 2, 3, 4, 5])("accepts a complete submission for sitting %i", (sitting) => {
    expect(validateSubmission(sitting, sittingFor(sitting, "x"))).toBeNull();
  });

  it.each<[string, number, Submission, string]>([
    ["a missing stance", 0, { write: three("r") }, "stance"],
    ["a blank reason", 0, { stance: "yes", write: ["a", "  ", "c"] }, "write"],
    ["two reasons", 0, { stance: "yes", write: ["a", "b"] as never }, "write"],
    ["an over-long item", 0, { stance: "yes", write: ["a", "b", "c".repeat(2001)] }, "write"],
    ["a stance after sitting 0", 1, { ...sittingFor(1, "x"), stance: "late" }, "stance"],
    ["the wrong response kind", 1, { respond: { kind: "react", tags: noTags }, write: three("q") }, "respond"],
    ["a badly formed tag", 2, { respond: { kind: "answer", texts: three("a"), tags: [["#Sad face"], [], []] }, write: three("s") }, "respond"],
    ["too many tags", 3, { respond: { kind: "react", tags: [["a", "b", "c", "d"], [], []] }, write: three("a") }, "respond"],
    ["a repeated rank", 5, { respond: { kind: "rank", ranks: [1, 1, 3] } }, "respond"],
    ["ranks as strings", 5, { respond: { kind: "rank", ranks: ["1", "2", "3"] as never } }, "respond"],
    ["writing in the last sitting", 5, { ...sittingFor(5, "x"), write: three("extra") }, "write"],
  ])("rejects %s", (_label, sitting, submission, part) => {
    expect(validateSubmission(sitting, submission)).toBe(part);
  });
});
