import { describe, expect, it } from "vitest";
import { cleanFirstName } from "./first-name";

describe("cleanFirstName", () => {
  it("trims and collapses spaces", () => {
    expect(cleanFirstName("  Mary   Ann ")).toBe("Mary Ann");
  });

  it.each([undefined, "", "   ", "x".repeat(61)])("rejects %s", (value) => {
    expect(cleanFirstName(value)).toBeNull();
  });
});
