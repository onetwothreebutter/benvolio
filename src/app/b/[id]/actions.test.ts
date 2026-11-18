import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { formData } from "@/test/form-data";

const rpc = vi.hoisted(() => vi.fn());
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ rpc }) }));
const requireSignedIn = vi.hoisted(() => vi.fn());
vi.mock("@/lib/auth/session", () => ({ requireSignedIn }));
vi.mock("server-only", () => ({}));

const { renewInvite } = await import("./actions");
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
