import { describe, expect, it } from "vitest";
import { statusLine } from "./status";

describe("statusLine", () => {
  it("tells each person what happens next", () => {
    expect(statusLine({ kind: "decide_question", proposed: "Why?" }, "Rhonda")).toBe(
      "Rhonda suggested new wording for the question.",
    );
    expect(statusLine({ kind: "wait_for_question" }, "Jane")).toBe(
      "Waiting for Jane to agree to your wording.",
    );
    expect(statusLine({ kind: "sit", sitting: 0 }, "Jane")).toBe("Your turn: write your opening.");
    expect(statusLine({ kind: "sit", sitting: 3 }, "Jane")).toBe("Your turn: sitting 4 of 6.");
    expect(statusLine({ kind: "wait", sitting: 3 }, "Jane")).toBe("Waiting for Jane to write theirs.");
    expect(statusLine({ kind: "finished" }, "Jane")).toBe("You've finished this Benvolio.");
    // A recipient who hasn't joined never sees the Benvolio's page.
    expect(() => statusLine({ kind: "join" }, "Jane")).toThrow();
  });
});
