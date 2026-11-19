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
  parseSubmission,
  visibleSubmissions,
  type Conversation,
  type Role,
  type Submission,
  type Tags,
} from "./model";
import { three, validSitting } from "@/test/sittings";

const noTags: Tags = [[], [], []];

function sit(c: Conversation, role: Role, sitting: number) {
  return submit(c, role, sitting, validSitting(sitting, role));
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
  const NEW = "Should we get a dog this year?";
  // The usual order: the initiator writes their opening before sending the invite.
  const proposed = () => join(sit(started(), "initiator", 0), NEW);

  it("makes the recipient wait while the initiator decides", () => {
    const c = proposed();
    expect(nextAction(c, "initiator")).toEqual({ kind: "decide_question", proposed: NEW });
    expect(nextAction(c, "recipient")).toEqual({ kind: "wait_for_question" });
    expect(() => sit(c, "recipient", 0)).toThrow(TurnError);
    expect(isRevealed(c, 0)).toBe(false);
  });

  it("treats a blank suggestion as keeping the wording", () => {
    expect(join(started(), "   ").question).toEqual({ text: "Should we get a dog?" });
  });

  it("treats a change of case or spacing as the same wording", () => {
    expect(join(started(), "  should we  get a DOG? ").question).toEqual({ text: "Should we get a dog?" });
  });

  it("accepting reopens the initiator's opening so their stance answers the new wording", () => {
    let c = decideQuestion(proposed(), "initiator", true);
    expect(c.question).toEqual({ text: NEW });
    expect(nextAction(c, "initiator")).toEqual({ kind: "sit", sitting: 0 });
    expect(nextAction(c, "recipient")).toEqual({ kind: "sit", sitting: 0 });
    const revised: Submission = { stance: "Revised stance", write: three("revised reason") };
    c = submit(sit(c, "recipient", 0), "initiator", 0, revised);
    expect(isRevealed(c, 0)).toBe(true);
    expect(visibleSubmissions(c, 0, "recipient").partner).toEqual(revised);
  });

  it("declining keeps the original wording and the initiator's opening", () => {
    let c = decideQuestion(proposed(), "initiator", false);
    expect(c.question).toEqual({ text: "Should we get a dog?" });
    expect(nextAction(c, "initiator")).toEqual({ kind: "wait", sitting: 0 });
    c = sit(c, "recipient", 0);
    expect(isRevealed(c, 0)).toBe(true);
  });

  it("works when the recipient joins before the initiator has written", () => {
    let c = join(started(), NEW);
    expect(nextAction(c, "initiator")).toEqual({ kind: "decide_question", proposed: NEW });
    c = decideQuestion(c, "initiator", true);
    expect(nextAction(c, "initiator")).toEqual({ kind: "sit", sitting: 0 });
  });

  it("only lets the initiator decide, and only when there is something to decide", () => {
    expect(() => decideQuestion(proposed(), "recipient", true)).toThrow(TurnError);
    expect(() => decideQuestion(started(), "initiator", true)).toThrow(TurnError);
  });

  it("rejects an empty or over-long question", () => {
    expect(() => startConversation("   ")).toThrow(TurnError);
    expect(() => join(started(), "x".repeat(301))).toThrow(TurnError);
    expect(() => join(started(), 42 as never)).toThrow(TurnError);
  });

  it("does not change the conversation it was given", () => {
    const c = proposed();
    const before = structuredClone(c);
    decideQuestion(c, "initiator", true);
    join(started(), NEW);
    expect(c).toEqual(before);
  });
});

describe("taking turns", () => {
  it("reveals a sitting only once both have submitted it", () => {
    let c = join(started());
    c = sit(c, "initiator", 0);
    expect(isRevealed(c, 0)).toBe(false);
    expect(visibleSubmissions(c, 0, "initiator")).toEqual({ mine: validSitting(0, "initiator"), partner: undefined });
    expect(visibleSubmissions(c, 0, "recipient")).toEqual({ mine: undefined, partner: undefined });
    expect(nextAction(c, "initiator")).toEqual({ kind: "wait", sitting: 0 });

    c = sit(c, "recipient", 0);
    expect(isRevealed(c, 0)).toBe(true);
    expect(visibleSubmissions(c, 0, "recipient").partner).toEqual(validSitting(0, "initiator"));
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

  it("makes the first to finish wait for the other's last sitting", () => {
    const c = sit(bothThrough(join(started()), 4), "initiator", 5);
    expect(nextAction(c, "initiator")).toEqual({ kind: "wait", sitting: 5 });
    expect(isFinished(c)).toBe(false);
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

describe("parseSubmission", () => {
  it.each([0, 1, 2, 3, 4, 5])("accepts a complete submission for sitting %i", (sitting) => {
    expect(parseSubmission(sitting, validSitting(sitting, "x"))).toEqual({
      ok: true,
      submission: validSitting(sitting, "x"),
    });
  });

  it("returns a trimmed copy, not the input", () => {
    const input = { stance: "  yes  ", write: [" a ", "b", "c"] };
    const result = parseSubmission(0, input);
    expect(result).toEqual({ ok: true, submission: { stance: "yes", write: ["a", "b", "c"] } });
    if (result.ok) expect(result.submission.write).not.toBe(input.write);
  });

  it.each<[string, number, unknown, string]>([
    ["null", 0, null, "shape"],
    ["a string", 0, "hello", "shape"],
    ["an array", 0, [], "shape"],
    ["an unknown key", 0, { stance: "yes", write: three("r"), extra: "x" }, "shape"],
    ["a sitting that doesn't exist", 6, {}, "sitting"],
    ["a negative sitting", -1, {}, "sitting"],
    ["a fractional sitting", 1.5, {}, "sitting"],
    ["a missing stance", 0, { write: three("r") }, "stance"],
    ["a blank reason", 0, { stance: "yes", write: ["a", "  ", "c"] }, "write"],
    ["two reasons", 0, { stance: "yes", write: ["a", "b"] }, "write"],
    ["an over-long item", 0, { stance: "yes", write: ["a", "b", "c".repeat(2001)] }, "write"],
    ["a stance after sitting 0", 1, { ...validSitting(1, "x"), stance: "late" }, "stance"],
    ["the wrong response kind", 1, { respond: { kind: "react", tags: noTags }, write: three("q") }, "respond"],
    ["an extra response field", 3, { respond: { kind: "react", tags: noTags, texts: three("x") }, write: three("a") }, "respond"],
    ["a badly formed tag", 2, { respond: { kind: "answer", texts: three("a"), tags: [["#Sad face"], [], []] }, write: three("s") }, "respond"],
    ["a repeated tag", 3, { respond: { kind: "react", tags: [["sad", "sad"], [], []] }, write: three("a") }, "respond"],
    ["too many tags", 3, { respond: { kind: "react", tags: [["a", "b", "c", "d"], [], []] }, write: three("a") }, "respond"],
    ["two agree marks", 4, { respond: { kind: "agree", agree: [true, false], tags: noTags }, write: three("c") }, "respond"],
    ["a repeated rank", 5, { respond: { kind: "rank", ranks: [1, 1, 3] } }, "respond"],
    ["two ranks", 5, { respond: { kind: "rank", ranks: [1, 2] } }, "respond"],
    ["ranks as strings", 5, { respond: { kind: "rank", ranks: ["1", "2", "3"] } }, "respond"],
    ["writing in the last sitting", 5, { ...validSitting(5, "x"), write: three("extra") }, "write"],
  ])("rejects %s", (_label, sitting, input, invalid) => {
    expect(parseSubmission(sitting, input)).toEqual({ ok: false, invalid });
  });
});
