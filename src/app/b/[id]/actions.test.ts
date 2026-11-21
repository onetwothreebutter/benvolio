import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { startConversation } from "@/lib/conversation/model";
import { formData } from "@/test/form-data";
import { validSitting } from "@/test/sittings";

const rpc = vi.hoisted(() => vi.fn());
const insert = vi.hoisted(() => vi.fn());
const from = vi.hoisted(() => vi.fn(() => ({ insert })));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ rpc, from }) }));
const requireSignedIn = vi.hoisted(() => vi.fn());
vi.mock("@/lib/auth/session", () => ({ requireSignedIn }));
const loadBenvolioToWrite = vi.hoisted(() => vi.fn());
vi.mock("@/lib/db/load-benvolio", () => ({ loadBenvolioToWrite }));
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

const { decideQuestion, renewInvite, submitSitting } = await import("./actions");
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
