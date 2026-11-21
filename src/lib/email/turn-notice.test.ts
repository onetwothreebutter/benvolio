import { describe, expect, it } from "vitest";
import { join, startConversation, submit, type Conversation, type Role } from "@/lib/conversation/model";
import { validSitting } from "@/test/sittings";
import { turnNotice } from "./turn-notice";

const sit = (c: Conversation, role: Role, sitting: number) =>
  submit(c, role, sitting, validSitting(sitting, role));

function bothThrough(c: Conversation, last: number) {
  for (let s = 0; s <= last; s++) c = sit(sit(c, "initiator", s), "recipient", s);
  return c;
}

const joined = () => join(startConversation("Should we get a dog?"));

describe("turnNotice", () => {
  it("tells someone their partner has written the sitting they owe", () => {
    expect(turnNotice(sit(joined(), "initiator", 0), "recipient")).toEqual({
      kind: "your_turn",
      sitting: 0,
      why: "waiting",
    });
    const later = sit(bothThrough(joined(), 1), "recipient", 2);
    expect(turnNotice(later, "initiator")).toEqual({ kind: "your_turn", sitting: 2, why: "waiting" });
  });

  it("tells both people when a sitting is revealed, and either when nothing is written yet", () => {
    const c = bothThrough(joined(), 0);
    for (const role of ["initiator", "recipient"] as const) {
      expect(turnNotice(c, role)).toEqual({ kind: "your_turn", sitting: 1, why: "readable" });
      expect(turnNotice(joined(), role)).toEqual({ kind: "your_turn", sitting: 0, why: "start" });
    }
  });

  it("tells them the conversation is finished after the last sitting", () => {
    expect(turnNotice(bothThrough(joined(), 5), "initiator")).toEqual({ kind: "finished" });
  });

  it("asks the initiator to decide on new wording", () => {
    const proposed = join(startConversation("Should we get a dog?"), "Should we get a cat?");
    expect(turnNotice(proposed, "initiator")).toEqual({ kind: "question_proposed" });
  });

  it("tells nobody who is waiting, hasn't joined, or is waiting on the question", () => {
    const opened = sit(joined(), "initiator", 0);
    expect(turnNotice(opened, "initiator")).toBeNull();
    const unjoined = sit(startConversation("Should we get a dog?"), "initiator", 0);
    expect(turnNotice(unjoined, "recipient")).toBeNull();
    expect(turnNotice(join(unjoined, "Should we get a cat?"), "recipient")).toBeNull();
  });
});
