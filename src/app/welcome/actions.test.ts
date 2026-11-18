import { beforeEach, describe, expect, it, vi } from "vitest";
import { formData as form } from "@/test/form-data";

const upsert = vi.hoisted(() => vi.fn());
const from = vi.hoisted(() => vi.fn(() => ({ upsert })));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ from }) }));
const requireSignedIn = vi.hoisted(() => vi.fn());
vi.mock("@/lib/auth/session", () => ({ requireSignedIn }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`redirect ${url}`);
  },
}));

const { saveFirstName } = await import("./actions");

describe("saveFirstName", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireSignedIn.mockResolvedValue({ userId: "u1", email: "a@b.co" });
    upsert.mockResolvedValue({ error: null });
  });

  it("saves the name for the signed-in person only, then moves on", async () => {
    await expect(
      saveFirstName({}, form({ first_name: " Jane ", next: "/start", id: "someone-else" })),
    ).rejects.toThrow("redirect /start");
    expect(from).toHaveBeenCalledWith("people");
    expect(upsert).toHaveBeenCalledWith({ id: "u1", first_name: "Jane" });
  });

  it("asks again for a blank name", async () => {
    expect(await saveFirstName({}, form({ first_name: "  " }))).toEqual({
      error: expect.any(String),
    });
    expect(upsert).not.toHaveBeenCalled();
  });

  it("requires sign-in, returning here afterwards", async () => {
    requireSignedIn.mockRejectedValue(new Error("redirect sign-in"));
    await expect(saveFirstName({}, form({ first_name: "Jane", next: "/start" }))).rejects.toThrow(
      "redirect sign-in",
    );
    expect(requireSignedIn).toHaveBeenCalledWith("/welcome?next=%2Fstart");
    expect(upsert).not.toHaveBeenCalled();
  });
});
