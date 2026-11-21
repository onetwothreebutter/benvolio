import { beforeEach, describe, expect, it, vi } from "vitest";
import { formData } from "@/test/form-data";

const rpc = vi.hoisted(() => vi.fn());
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ rpc }) }));
const requirePerson = vi.hoisted(() => vi.fn());
vi.mock("@/lib/auth/session", () => ({ requirePerson }));
const findInvite = vi.hoisted(() => vi.fn());
vi.mock("@/lib/invites/lookup", () => ({ findInvite }));
vi.mock("server-only", () => ({}));
const notifyLater = vi.hoisted(() => vi.fn());
vi.mock("@/lib/email/notify", () => ({ notifyLater }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`redirect ${url}`);
  },
}));

const { joinBenvolio } = await import("./actions");
const { hashInviteToken } = await import("@/lib/invites/token");

const TOKEN = "t".repeat(43);

describe("joinBenvolio", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requirePerson.mockResolvedValue({
      userId: "rhonda",
      email: "r@example.com",
      firstName: "Rhonda",
    });
    findInvite.mockResolvedValue({
      question: "Cats or dogs?",
      initiatorId: "jane",
      initiatorName: "Jane",
    });
    rpc.mockResolvedValue({ data: "b1", error: null });
  });

  it("joins with the wording as sent, ignoring case and spacing changes", async () => {
    await expect(
      joinBenvolio({}, formData({ token: TOKEN, question: " cats  or dogs? " })),
    ).rejects.toThrow("redirect /b/b1");
    expect(rpc).toHaveBeenCalledWith("join_benvolio", {
      token_hash: hashInviteToken(TOKEN),
      recipient: "rhonda",
      proposed_question: null,
    });
    expect(notifyLater).toHaveBeenCalledExactlyOnceWith("b1", "recipient");
  });

  it("passes new wording on for the initiator to decide", async () => {
    await expect(
      joinBenvolio({}, formData({ token: TOKEN, question: "Cats, dogs or neither?" })),
    ).rejects.toThrow("redirect");
    expect(rpc.mock.calls[0][1].proposed_question).toBe("Cats, dogs or neither?");
  });

  it("explains a used or expired invite", async () => {
    expect(notifyLater).not.toHaveBeenCalled();
    findInvite.mockResolvedValue(null);
    expect(await joinBenvolio({}, formData({ token: TOKEN }))).toEqual({
      error: expect.stringContaining("expired"),
    });
    expect(await joinBenvolio({}, formData({ token: "nope" }))).toEqual({
      error: expect.stringContaining("expired"),
    });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("explains the database's refusals", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "BVOWN", message: "own_invite" } });
    expect(await joinBenvolio({}, formData({ token: TOKEN }))).toEqual({
      error: expect.stringContaining("your own invite"),
    });
    rpc.mockResolvedValue({ data: null, error: { code: "BVINV", message: "invite_not_found" } });
    expect(await joinBenvolio({}, formData({ token: TOKEN }))).toEqual({
      error: expect.stringContaining("expired"),
    });
  });

  it("stops the initiator joining their own invite before asking the database", async () => {
    requirePerson.mockResolvedValue({ userId: "jane", email: "j@example.com", firstName: "Jane" });
    expect(await joinBenvolio({}, formData({ token: TOKEN }))).toEqual({
      error: expect.stringContaining("your own invite"),
    });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("sends someone whose profile has gone to /welcome", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "BVPRO", message: "no_profile" } });
    await expect(joinBenvolio({}, formData({ token: TOKEN }))).rejects.toThrow(
      `redirect /welcome?next=%2Fjoin%2F${TOKEN}`,
    );
  });

  it("doesn't hide unexpected database errors", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "23505", message: "duplicate key" } });
    await expect(joinBenvolio({}, formData({ token: TOKEN }))).rejects.toThrow("duplicate key");
  });

  it("rejects wording that is too long", async () => {
    expect(await joinBenvolio({}, formData({ token: TOKEN, question: "x".repeat(301) }))).toEqual({
      error: expect.any(String),
    });
    expect(rpc).not.toHaveBeenCalled();
  });
});
