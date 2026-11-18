import { describe, expect, it } from "vitest";
import { nextAction } from "@/lib/conversation/model";
import { toConversation } from "./conversation";

const people = [
  { role: "initiator" as const, person_id: "j", first_name: "Jane" },
  { role: "recipient" as const, person_id: null, first_name: "Rhonda" },
];

describe("toConversation", () => {
  it("builds the model from rows", () => {
    const c = toConversation({ question: "Q?", proposed_question: null }, people, [
      { sitting: 1, role: "initiator", body: { write: ["a", "b", "c"] } },
    ]);
    expect(c).toEqual({
      question: { text: "Q?" },
      recipientJoined: false,
      submissions: [{}, { initiator: { write: ["a", "b", "c"] } }],
    });
    expect(nextAction(c, "recipient")).toEqual({ kind: "join" });
  });

  it("carries pending wording and a joined recipient", () => {
    const joined = [people[0], { ...people[1], person_id: "r" }];
    const c = toConversation({ question: "Q?", proposed_question: "Q2?" }, joined, []);
    expect(c.question).toEqual({ text: "Q?", proposed: "Q2?" });
    expect(nextAction(c, "initiator")).toEqual({ kind: "decide_question", proposed: "Q2?" });
  });
});
