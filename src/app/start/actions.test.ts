import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { formData } from "@/test/form-data";

const rpc = vi.hoisted(() => vi.fn());
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ rpc }) }));
const requirePerson = vi.hoisted(() => vi.fn());
vi.mock("@/lib/auth/session", () => ({ requirePerson }));
vi.mock("server-only", () => ({}));

const { startBenvolio } = await import("./actions");
const { hashInviteToken } = await import("@/lib/invites/token");

const valid = {
  question: "  Cats or dogs? ",
  partner_name: "Rhonda",
  partner_email: "Rhonda@Example.com",
  pace: "weekly",
};

describe("startBenvolio", () => {
  afterEach(() => vi.unstubAllEnvs());
  beforeEach(() => {
    vi.stubEnv("SITE_URL", "https://benvolio.test/");
    vi.clearAllMocks();
    requirePerson.mockResolvedValue({
      userId: "jane",
      email: "jane@example.com",
      firstName: "Jane",
    });
    rpc.mockResolvedValue({ data: "b1", error: null });
  });

  it("starts it and returns a link whose token is stored only as a hash", async () => {
    const state = await startBenvolio({}, formData(valid));
    expect(state).toMatchObject({ done: true, benvolioId: "b1", partnerName: "Rhonda" });
    const url = (state as { inviteUrl: string }).inviteUrl;
    expect(url).toMatch(/^https:\/\/benvolio\.test\/join\/[A-Za-z0-9_-]{43}$/);
    const token = url.split("/").pop()!;
    expect(rpc).toHaveBeenCalledWith("start_benvolio", {
      initiator: "jane",
      question: "Cats or dogs?",
      partner_first_name: "Rhonda",
      partner_email: "rhonda@example.com",
      token_hash: hashInviteToken(token),
      pace: "weekly",
    });
  });

  it.each([
    ["no question", { question: " " }],
    ["no name", { partner_name: "" }],
    ["a bad email", { partner_email: "rhonda" }],
    ["your own email", { partner_email: "JANE@example.com" }],
  ])("asks again for %s", async (_name, change) => {
    const state = await startBenvolio({}, formData({ ...valid, ...change }));
    expect(state).toEqual({ error: expect.any(String) });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("defaults to daily for anything but weekly", async () => {
    await startBenvolio({}, formData({ ...valid, pace: "hourly" }));
    expect(rpc.mock.calls[0][1].pace).toBe("daily");
  });
});
