import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { join, startConversation, submit, type Conversation } from "@/lib/conversation/model";
import { formData } from "@/test/form-data";
import { validSitting } from "@/test/sittings";

const rpc = vi.hoisted(() => vi.fn());
const insert = vi.hoisted(() => vi.fn());
const eq = vi.hoisted(() => vi.fn());
const from = vi.hoisted(() => vi.fn(() => ({ insert, delete: () => ({ eq }) })));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ rpc, from }) }));
const requireSignedIn = vi.hoisted(() => vi.fn());
vi.mock("@/lib/auth/session", () => ({ requireSignedIn }));
const loadBenvolio = vi.hoisted(() => vi.fn());
const loadBenvolioToWrite = vi.hoisted(() => vi.fn());
vi.mock("@/lib/db/load-benvolio", () => ({ loadBenvolio, loadBenvolioToWrite }));
const trackServer = vi.hoisted(() => vi.fn());
vi.mock("@/lib/analytics/server", () => ({ trackServer }));
vi.mock("server-only", () => ({}));
const redirect = vi.hoisted(() =>
  vi.fn((to: string) => {
    throw new Error(`redirect ${to}`);
  }),
);
vi.mock("next/navigation", () => ({ redirect }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const { decideQuestion, deleteBenvolio, renewInvite, submitSitting } = await import("./actions");
const { hashInviteToken } = await import("@/lib/invites/token");

const ID = "00000000-0000-4000-8000-0000000000b1";

describe("renewInvite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("SITE_URL", "https://benvolio.test");
    requireSignedIn.mockResolvedValue({ userId: "jane", email: "j@example.com" });
    rpc.mockResolvedValue({ data: true, error: null });
  });
  afterEach(() => vi.unstubAllEnvs());

  it("returns a new link, asking the database to check it's the initiator's", async () => {
    const { url } = await renewInvite({}, formData({ benvolio_id: ID }));
    const token = url!.split("/").pop()!;
    expect(url).toBe(`https://benvolio.test/join/${token}`);
    expect(rpc).toHaveBeenCalledWith("renew_invite", {
      benvolio: ID,
      initiator: "jane",
      token_hash: hashInviteToken(token),
    });
  });

  it("explains when there's nothing to renew", async () => {
    rpc.mockResolvedValue({ data: false, error: null });
    expect(await renewInvite({}, formData({ benvolio_id: ID }))).toEqual({
      error: expect.any(String),
    });
    expect(await renewInvite({}, formData({ benvolio_id: "nope" }))).toEqual({
      error: expect.any(String),
    });
    expect(rpc).toHaveBeenCalledTimes(1);
  });
});

describe("decideQuestion", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireSignedIn.mockResolvedValue({ userId: "jane", email: "j@example.com" });
    rpc.mockResolvedValue({ data: true, error: null });
  });

  it("asks the database to decide as this person, then reloads the page", async () => {
    for (const accept of ["yes", "no"]) {
      await expect(decideQuestion({}, formData({ benvolio_id: ID, accept }))).rejects.toThrow(
        `redirect /b/${ID}`,
      );
      expect(rpc).toHaveBeenLastCalledWith("decide_question", {
        benvolio: ID,
        initiator: "jane",
        accept: accept === "yes",
      });
    }
  });

  it("explains when there's nothing to decide", async () => {
    rpc.mockResolvedValue({ data: false, error: null });
    expect(await decideQuestion({}, formData({ benvolio_id: ID, accept: "yes" }))).toEqual({
      error: expect.any(String),
    });
    expect(await decideQuestion({}, formData({ benvolio_id: "nope", accept: "yes" }))).toEqual({
      error: expect.any(String),
    });
    // Without a choice, nothing is thrown away.
    expect(await decideQuestion({}, formData({ benvolio_id: ID }))).toEqual({
      error: expect.any(String),
    });
    expect(rpc).toHaveBeenCalledTimes(1);
  });
});

describe("deleteBenvolio", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireSignedIn.mockResolvedValue({ userId: "rhonda", email: "r@example.com" });
    eq.mockResolvedValue({ error: null });
  });

  const joined = (): Conversation => join(startConversation("Should we get a dog?"));

  it("deletes it for both people, records the round, then goes home", async () => {
    let conversation = joined();
    for (const sitting of [0, 1]) {
      for (const role of ["initiator", "recipient"] as const) {
        conversation = submit(conversation, role, sitting, validSitting(sitting, role));
      }
    }
    loadBenvolio.mockResolvedValue({ role: "recipient", partnerName: "Jane", conversation });
    await expect(deleteBenvolio(formData({ benvolio_id: ID }))).rejects.toThrow("redirect /");
    expect(loadBenvolio).toHaveBeenCalledWith(ID, "rhonda");
    expect(from).toHaveBeenCalledWith("benvolios");
    expect(eq).toHaveBeenCalledWith("id", ID);
    // Sitting 3 writes round 3.
    expect(trackServer).toHaveBeenCalledExactlyOnceWith("rhonda", "benvolio_deleted", {
      benvolio_id: ID,
      round: 3,
    });
  });

  it("records round 1 before anything's written, and round 5 once it's finished", async () => {
    loadBenvolio.mockResolvedValue({ role: "initiator", partnerName: "Rhonda", conversation: joined() });
    await expect(deleteBenvolio(formData({ benvolio_id: ID }))).rejects.toThrow("redirect /");
    expect(trackServer).toHaveBeenLastCalledWith("rhonda", "benvolio_deleted", { benvolio_id: ID, round: 1 });

    let conversation = joined();
    for (let sitting = 0; sitting <= 5; sitting++) {
      for (const role of ["initiator", "recipient"] as const) {
        conversation = submit(conversation, role, sitting, validSitting(sitting, role));
      }
    }
    loadBenvolio.mockResolvedValue({ role: "initiator", partnerName: "Rhonda", conversation });
    await expect(deleteBenvolio(formData({ benvolio_id: ID }))).rejects.toThrow("redirect /");
    expect(trackServer).toHaveBeenLastCalledWith("rhonda", "benvolio_deleted", { benvolio_id: ID, round: 5 });
  });

  it("only goes home when it's already gone or not theirs", async () => {
    loadBenvolio.mockResolvedValue(null);
    await expect(deleteBenvolio(formData({ benvolio_id: ID }))).rejects.toThrow("redirect /");
    expect(from).not.toHaveBeenCalled();
    expect(trackServer).not.toHaveBeenCalled();
  });

  it("fails loudly if the database does", async () => {
    loadBenvolio.mockResolvedValue({ role: "initiator", partnerName: "Rhonda", conversation: joined() });
    eq.mockResolvedValue({ error: { message: "boom" } });
    await expect(deleteBenvolio(formData({ benvolio_id: ID }))).rejects.toThrow("boom");
    expect(trackServer).not.toHaveBeenCalled();
  });
});

describe("submitSitting", () => {
  const { stance, write } = validSitting(0, "Jane") as { stance: string; write: string[] };
  const opening = (fields: { stance?: string; write?: string[] } = { stance, write }, sitting = "0") =>
    formData({ benvolio_id: ID, sitting, question: "Should we get a dog?", ...fields });

  beforeEach(() => {
    vi.clearAllMocks();
    requireSignedIn.mockResolvedValue({ userId: "jane", email: "j@example.com" });
    insert.mockResolvedValue({ error: null });
    loadBenvolioToWrite.mockResolvedValue({
      role: "initiator",
      partnerName: "Rhonda",
      conversation: startConversation("Should we get a dog?"),
    });
  });

  it("saves the opening, tidied, then reloads the page", async () => {
    await expect(submitSitting({}, opening({ stance: ` ${stance} `, write }))).rejects.toThrow(
      `redirect /b/${ID}`,
    );
    expect(loadBenvolioToWrite).toHaveBeenCalledWith(ID, "jane");
    expect(from).toHaveBeenCalledWith("submissions");
    expect(insert).toHaveBeenCalledWith({
      benvolio_id: ID,
      sitting: 0,
      role: "initiator",
      body: { stance, write },
    });
    expect(trackServer).toHaveBeenCalledExactlyOnceWith("jane", "step_submitted", {
      benvolio_id: ID,
      round: 1,
      step: "write",
      sitting: 0,
    });
  });

  it("says what's missing and gives back what was typed", async () => {
    const blank = { stance: "   ", write: ["a", "b", "c"] };
    expect(await submitSitting({}, opening(blank))).toEqual({
      error: expect.stringContaining("Please write where you stand"),
      input: blank,
    });
    const short = { stance: "Yes", write: ["a", " ", "c"] };
    expect(await submitSitting({}, opening(short))).toEqual({
      error: expect.stringContaining("all 3"),
      input: short,
    });
    expect(await submitSitting({}, opening({ write }))).toMatchObject({ input: { stance: "", write } });
    expect(insert).not.toHaveBeenCalled();
  });

  it("reads only the parts the sitting has, with line breaks as typed", async () => {
    const fields = formData({
      benvolio_id: ID,
      sitting: "0",
      question: "Should we get a dog?",
      stance: "Yes,\r\nI think so",
      write,
      respond: "sneaky",
    });
    await expect(submitSitting({}, fields)).rejects.toThrow("redirect");
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({ body: { stance: "Yes,\nI think so", write } }),
    );
  });

  it("gives an opening back if the question changed while it was written", async () => {
    let conversation = startConversation("Should we get a dog this year?");
    loadBenvolioToWrite.mockResolvedValue({ role: "initiator", partnerName: "Rhonda", conversation });
    expect(await submitSitting({}, opening())).toEqual({
      error: expect.stringContaining("“Should we get a dog this year?”"),
      input: { stance, write },
      question: "Should we get a dog this year?",
    });
    // New wording waiting for a decision.
    conversation = { ...startConversation("Should we get a dog?"), recipientJoined: true };
    conversation.question.proposed = "A dog or a cat?";
    loadBenvolioToWrite.mockResolvedValue({ role: "initiator", partnerName: "Rhonda", conversation });
    expect(await submitSitting({}, opening())).toEqual({
      error: expect.stringContaining("Rhonda has suggested new wording"),
      input: { stance, write },
    });
    expect(insert).not.toHaveBeenCalled();
  });

  it("reloads instead when it isn't this person's turn for that sitting", async () => {
    await expect(submitSitting({}, opening(undefined, "1"))).rejects.toThrow("redirect");
    loadBenvolioToWrite.mockResolvedValue(null);
    await expect(submitSitting({}, opening())).rejects.toThrow("redirect");
    expect(insert).not.toHaveBeenCalled();
  });

  it("treats a sitting another tab already sent as sent", async () => {
    insert.mockResolvedValue({ error: { code: "23505", message: "duplicate key" } });
    await expect(submitSitting({}, opening())).rejects.toThrow("redirect");
    expect(trackServer).not.toHaveBeenCalled();
    insert.mockResolvedValue({ error: { code: "XX000", message: "boom" } });
    await expect(submitSitting({}, opening())).rejects.toThrow("boom");
  });
});

describe("submitSitting, responding to a round", () => {
  /** Both people's sittings before `through`, so `through` is next for each. */
  function revealed(through: number): Conversation {
    let c = join(startConversation("Should we get a dog?"));
    for (let sitting = 0; sitting < through; sitting++) {
      for (const role of ["initiator", "recipient"] as const) {
        c = submit(c, role, sitting, validSitting(sitting, role));
      }
    }
    return c;
  }
  const sittingForm = (sitting: number, fields: Record<string, string | string[]>) =>
    formData({ benvolio_id: ID, sitting: String(sitting), ...fields });

  beforeEach(() => {
    vi.clearAllMocks();
    requireSignedIn.mockResolvedValue({ userId: "jane", email: "j@example.com" });
    insert.mockResolvedValue({ error: null });
  });

  it("saves a rephrasing with the next round's items, and tracks both steps", async () => {
    loadBenvolioToWrite.mockResolvedValue({ role: "initiator", partnerName: "Rhonda", conversation: revealed(1) });
    const write = ["Q 1", "Q 2", "Q 3"];
    const texts = { "texts.0": "R 1", "texts.1": "R 2", "texts.2": "R 3" };
    const respond = { kind: "rephrase", texts: ["R 1", "R 2", "R 3"] };
    await expect(submitSitting({}, sittingForm(1, { ...texts, write }))).rejects.toThrow(
      "redirect",
    );
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ sitting: 1, body: { respond, write } }));
    expect(trackServer.mock.calls.map(([, , p]) => [p.step, p.round])).toEqual([
      ["respond", 1],
      ["write", 2],
    ]);
  });

  it("saves agree and disagree marks with feelings, and explains a missing mark", async () => {
    loadBenvolioToWrite.mockResolvedValue({ role: "initiator", partnerName: "Rhonda", conversation: revealed(4) });
    const fields = {
      "agree.0": "agree",
      "agree.1": "disagree",
      "agree.2": "agree",
      "tags.1": "hurt",
      write: ["C 1", "C 2", "C 3"],
    };
    await expect(submitSitting({}, sittingForm(4, fields))).rejects.toThrow("redirect");
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        body: {
          respond: { kind: "agree", agree: [true, false, true], tags: [[], ["hurt"], []] },
          write: ["C 1", "C 2", "C 3"],
        },
      }),
    );
    insert.mockClear();
    for (const mark of [undefined, "constructor", "maybe"]) {
      const tampered: Record<string, string | string[]> = { ...fields };
      if (mark === undefined) delete tampered["agree.1"];
      else tampered["agree.1"] = mark;
      expect(await submitSitting({}, sittingForm(4, tampered))).toMatchObject({
        error: "Please say whether you agree with each one.",
      });
    }
    expect(insert).not.toHaveBeenCalled();
  });

  it("saves a ranking only when each rank is used once", async () => {
    loadBenvolioToWrite.mockResolvedValue({ role: "initiator", partnerName: "Rhonda", conversation: revealed(5) });
    const ranks = (a: string, b: string, c: string) => ({ "ranks.0": a, "ranks.1": b, "ranks.2": c });
    expect(await submitSitting({}, sittingForm(5, ranks("1", "1", "3")))).toMatchObject({
      error: "Please rank them 1 to 3, using each number once.",
      input: { respond: { kind: "rank", ranks: [1, 1, 3] } },
    });
    await expect(submitSitting({}, sittingForm(5, ranks("2", "1", "3")))).rejects.toThrow("redirect");
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({ sitting: 5, body: { respond: { kind: "rank", ranks: [2, 1, 3] } } }),
    );
    expect(trackServer).toHaveBeenCalledExactlyOnceWith("jane", "step_submitted", {
      benvolio_id: ID,
      round: 5,
      step: "respond",
      sitting: 5,
    });
  });

  it("saves answers with the feelings ticked for each, and explains a missing answer", async () => {
    loadBenvolioToWrite.mockResolvedValue({ role: "initiator", partnerName: "Rhonda", conversation: revealed(2) });
    const fields = {
      "texts.0": "A 1",
      "texts.1": "A 2",
      "texts.2": "A 3",
      "tags.0": "hopeful",
      "tags.2": ["sad", "relieved"],
      write: ["S 1", "S 2", "S 3"],
    };
    await expect(submitSitting({}, sittingForm(2, fields))).rejects.toThrow("redirect");
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        body: {
          respond: { kind: "answer", texts: ["A 1", "A 2", "A 3"], tags: [["hopeful"], [], ["sad", "relieved"]] },
          write: ["S 1", "S 2", "S 3"],
        },
      }),
    );

    insert.mockClear();
    const missing = { ...fields, "texts.1": "" };
    expect(await submitSitting({}, sittingForm(2, missing))).toMatchObject({
      error: "Please answer all 3. You can pick up to 3 feelings for each.",
      input: { respond: { kind: "answer", texts: ["A 1", "", "A 3"] } },
    });
    const tooMany = { ...fields, "tags.1": ["sad", "hurt", "hopeful", "curious"] };
    expect(await submitSitting({}, sittingForm(2, tooMany))).toMatchObject({
      error: "Please answer all 3. You can pick up to 3 feelings for each.",
      input: { respond: { tags: [["hopeful"], ["sad", "hurt", "hopeful", "curious"], ["sad", "relieved"]] } },
    });
    expect(insert).not.toHaveBeenCalled();
  });
});
