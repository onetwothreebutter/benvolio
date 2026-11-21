import { beforeEach, describe, expect, it, vi } from "vitest";
import { startConversation, type Conversation } from "@/lib/conversation/model";
import { validSitting } from "@/test/sittings";

const insert = vi.hoisted(() => vi.fn());
const from = vi.hoisted(() => vi.fn(() => ({ insert })));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ from }) }));
const requireSignedIn = vi.hoisted(() => vi.fn());
vi.mock("@/lib/auth/session", () => ({ requireSignedIn }));
const loadBenvolioToWrite = vi.hoisted(() => vi.fn());
vi.mock("@/lib/db/load-benvolio", () => ({ loadBenvolioToWrite }));
const trackServer = vi.hoisted(() => vi.fn());
vi.mock("@/lib/analytics/server", () => ({ trackServer }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("server-only", () => ({}));
const redirect = vi.hoisted(() =>
  vi.fn((to: string) => {
    throw new Error(`redirect ${to}`);
  }),
);
vi.mock("next/navigation", () => ({ redirect }));

const { submitSitting } = await import("./actions");

const ID = "00000000-0000-4000-8000-0000000000b1";

function opening(fields: { stance?: string; write?: string[] }, sitting = "0") {
  const data = new FormData();
  data.set("benvolio_id", ID);
  data.set("sitting", sitting);
  if (fields.stance !== undefined) data.set("stance", fields.stance);
  for (const item of fields.write ?? []) data.append("write", item);
  return data;
}

function inConversation(conversation: Conversation) {
  loadBenvolioToWrite.mockResolvedValue({ role: "initiator", partnerName: "Rhonda", conversation });
}

describe("submitSitting", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireSignedIn.mockResolvedValue({ userId: "jane", email: "j@example.com" });
    insert.mockResolvedValue({ error: null });
    inConversation(startConversation("Should we get a dog?"));
  });

  it("saves the opening, tidied, then reloads the page", async () => {
    const { stance, write } = validSitting(0, "Jane");
    await expect(
      submitSitting({}, opening({ stance: ` ${stance} `, write: write! })),
    ).rejects.toThrow(`redirect /b/${ID}`);
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
    const typed = { stance: "   ", write: ["a", "b", "c"] };
    expect(await submitSitting({}, opening(typed))).toEqual({
      error: "Please write where you stand.",
      input: typed,
    });
    const short = { stance: "Yes", write: ["a", " ", "c"] };
    expect(await submitSitting({}, opening(short))).toMatchObject({
      error: expect.stringContaining("all three"),
      input: short,
    });
    expect(insert).not.toHaveBeenCalled();
  });

  it("reloads instead when it isn't this person's turn for that sitting", async () => {
    const { stance, write } = validSitting(0, "Jane");
    await expect(submitSitting({}, opening({ stance, write: write! }, "1"))).rejects.toThrow(
      "redirect",
    );
    loadBenvolioToWrite.mockResolvedValue(null);
    await expect(submitSitting({}, opening({ stance, write: write! }))).rejects.toThrow("redirect");
    expect(insert).not.toHaveBeenCalled();
  });

  it("treats a sitting another tab already sent as sent", async () => {
    insert.mockResolvedValue({ error: { code: "23505", message: "duplicate key" } });
    const { stance, write } = validSitting(0, "Jane");
    await expect(submitSitting({}, opening({ stance, write: write! }))).rejects.toThrow("redirect");
    expect(trackServer).not.toHaveBeenCalled();
    insert.mockResolvedValue({ error: { code: "XX000", message: "boom" } });
    await expect(submitSitting({}, opening({ stance, write: write! }))).rejects.toThrow("boom");
  });
});
