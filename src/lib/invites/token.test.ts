import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const { hashInviteToken, isInviteToken, newInviteToken } = await import("./token");

describe("invite tokens", () => {
  it("are random, URL-safe, and stored only as a hash", () => {
    const a = newInviteToken();
    const b = newInviteToken();
    expect(a.token).not.toBe(b.token);
    expect(isInviteToken(a.token)).toBe(true);
    expect(a.hash).toBe(hashInviteToken(a.token));
    expect(a.hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it.each([undefined, "", "short", "x".repeat(44), "a".repeat(42) + "/"])("rejects %s", (value) => {
    expect(isInviteToken(value)).toBe(false);
  });
});
