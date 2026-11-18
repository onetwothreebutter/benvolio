import { describe, expect, it } from "vitest";
import { assertSafeProperties, UnsafeAnalyticsPropertyError } from "./events";

describe("assertSafeProperties", () => {
  it("accepts ids, slugs, numbers and booleans", () => {
    expect(() =>
      assertSafeProperties({
        benvolio_id: "6f1c2a9e-4b7d-4c1e-9a2b-3c4d5e6f7a8b",
        step: "respond",
        round: 3,
        question_reworded: true,
      }),
    ).not.toThrow();
  });

  it.each([
    ["a sentence", "We should get a dog"],
    ["an email", "jane@example.com"],
    ["an empty string", ""],
    ["a long string", "a".repeat(65)],
    ["an object", { text: "hi" }],
    ["null", null],
  ])("rejects %s", (_label, value) => {
    expect(() => assertSafeProperties({ value })).toThrow(UnsafeAnalyticsPropertyError);
  });
});
