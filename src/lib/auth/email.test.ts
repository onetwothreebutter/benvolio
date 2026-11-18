import { describe, expect, it } from "vitest";
import { normalizeEmail } from "./email";

describe("normalizeEmail", () => {
  it("trims and lower-cases", () => {
    expect(normalizeEmail("  Jane@Example.COM ")).toBe("jane@example.com");
  });

  it.each([undefined, "", "jane", "jane@", "jane@example", "a b@example.com", "x".repeat(250) + "@a.co"])(
    "rejects %s",
    (value) => {
      expect(normalizeEmail(value)).toBeNull();
    },
  );
});
