import { beforeEach, describe, expect, it, vi } from "vitest";
import { formData } from "@/test/form-data";

const verifyOtp = vi.hoisted(() => vi.fn());
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ auth: { verifyOtp } }) }));
const takeNext = vi.hoisted(() => vi.fn());
vi.mock("@/lib/auth/next-cookie", () => ({ takeNext }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`redirect ${url}`);
  },
}));

const { confirmSignIn } = await import("./actions");

describe("confirmSignIn", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    takeNext.mockResolvedValue("/join/x");
    verifyOtp.mockResolvedValue({ error: null });
  });

  it("signs in and goes on through /welcome", async () => {
    await expect(confirmSignIn(formData({ token_hash: "abc" }))).rejects.toThrow(
      "redirect /welcome?next=%2Fjoin%2Fx",
    );
    expect(verifyOtp).toHaveBeenCalledWith({ token_hash: "abc", type: "email" });
  });

  it("sends an expired or used link back to sign in, keeping where they were going", async () => {
    verifyOtp.mockResolvedValue({ error: { status: 403 } });
    await expect(confirmSignIn(formData({ token_hash: "abc" }))).rejects.toThrow(
      "redirect /sign-in?next=%2Fjoin%2Fx&error=link",
    );
  });

  it("doesn't call Supabase without a token", async () => {
    await expect(confirmSignIn(formData({}))).rejects.toThrow("redirect /sign-in");
    expect(verifyOtp).not.toHaveBeenCalled();
  });
});
