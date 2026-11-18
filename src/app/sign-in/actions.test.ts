import { beforeEach, describe, expect, it, vi } from "vitest";
import { formData as form } from "@/test/form-data";

const auth = vi.hoisted(() => ({ signInWithOtp: vi.fn(), verifyOtp: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ auth }) }));
const rememberNext = vi.hoisted(() => vi.fn());
vi.mock("@/lib/auth/next-cookie", () => ({ rememberNext, takeNext: vi.fn() }));
const redirect = vi.hoisted(() =>
  vi.fn((url: string) => {
    throw new Error(`redirect ${url}`);
  }),
);
vi.mock("next/navigation", () => ({ redirect }));
const captureMessage = vi.hoisted(() => vi.fn());
vi.mock("@sentry/nextjs", () => ({ captureMessage }));

const { signIn } = await import("./actions");

describe("signIn", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    auth.signInWithOtp.mockResolvedValue({ error: null });
    auth.verifyOtp.mockResolvedValue({ error: null });
  });

  it("emails a code, remembering where to go after the link", async () => {
    const state = await signIn({ step: "email" }, form({ email: " Jane@Example.com ", next: "/join/x" }));
    expect(state).toEqual({ step: "code", email: "jane@example.com" });
    expect(auth.signInWithOtp).toHaveBeenCalledWith({
      email: "jane@example.com",
      options: { shouldCreateUser: true },
    });
    expect(rememberNext).toHaveBeenCalledWith("/join/x");
  });

  it("never remembers another site", async () => {
    await signIn({ step: "email" }, form({ email: "a@b.co", next: "//evil.example" }));
    expect(rememberNext).toHaveBeenCalledWith("/");
  });

  it("rejects an email that isn't one without calling Supabase", async () => {
    const state = await signIn({ step: "email" }, form({ email: "jane" }));
    expect(state).toMatchObject({ step: "email", email: "jane", error: expect.any(String) });
    expect(auth.signInWithOtp).not.toHaveBeenCalled();
  });

  it("says when to wait after too many tries", async () => {
    auth.signInWithOtp.mockResolvedValue({ error: { status: 429 } });
    const state = await signIn({ step: "email" }, form({ email: "a@b.co" }));
    expect(state).toMatchObject({ step: "email", email: "a@b.co", error: expect.stringContaining("wait") });
    expect(rememberNext).not.toHaveBeenCalled();
    expect(captureMessage).not.toHaveBeenCalled();
  });

  it("reports a failed send to Sentry with Supabase's reason", async () => {
    auth.signInWithOtp.mockResolvedValue({ error: { status: 500, message: "Error sending magic link email" } });
    const state = await signIn({ step: "email" }, form({ email: "a@b.co" }));
    expect(state).toMatchObject({ step: "email", email: "a@b.co", error: expect.stringContaining("couldn't send") });
    expect(captureMessage).toHaveBeenCalledWith("Sign-in email failed: 500 Error sending magic link email", "error");
  });

  it("signs in with the code and goes to the next page", async () => {
    await expect(
      signIn({ step: "code", email: "a@b.co" }, form({ code: "123 456", next: "/start" })),
    ).rejects.toThrow("redirect /welcome?next=%2Fstart");
    expect(auth.verifyOtp).toHaveBeenCalledWith({ email: "a@b.co", token: "123456", type: "email" });
  });

  it("keeps the email when the code is wrong", async () => {
    auth.verifyOtp.mockResolvedValue({ error: { status: 403 } });
    const state = await signIn({ step: "code", email: "a@b.co" }, form({ code: "000000" }));
    expect(state).toMatchObject({ step: "code", email: "a@b.co", error: expect.any(String) });
  });

  it("rejects a code that isn't digits without calling Supabase", async () => {
    const state = await signIn({ step: "code", email: "a@b.co" }, form({ code: "abc" }));
    expect(state.error).toBeDefined();
    expect(auth.verifyOtp).not.toHaveBeenCalled();
  });

  it("doesn't trust the email sent back from the browser", async () => {
    await signIn({ step: "code", email: " A@B.co " }, form({ code: "123456" })).catch(() => {});
    expect(auth.verifyOtp).toHaveBeenCalledWith({ email: "a@b.co", token: "123456", type: "email" });
    expect(await signIn({ step: "code", email: "nope" }, form({ code: "123456" }))).toEqual({
      step: "email",
    });
  });

  it("goes back to the email step", async () => {
    const state = await signIn({ step: "code", email: "a@b.co" }, form({ restart: "1" }));
    expect(state).toEqual({ step: "email" });
  });
});
