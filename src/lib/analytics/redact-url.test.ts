import { describe, expect, it } from "vitest";
import { redactUrl } from "./redact-url";

describe("redactUrl", () => {
  it("drops the query string and fragment", () => {
    expect(redactUrl("https://benvolio.app/start?email=jane@example.com#top")).toBe(
      "https://benvolio.app/start",
    );
  });

  it("replaces token-like path segments", () => {
    expect(redactUrl("https://benvolio.app/join/Xy7_k2Lm9QwErTy0UiOp")).toBe(
      "https://benvolio.app/join/:id",
    );
    expect(
      redactUrl("https://benvolio.app/b/6f1c2a9e-4b7d-4c1e-9a2b-3c4d5e6f7a8b/round/2"),
    ).toBe("https://benvolio.app/b/:id/round/2");
  });

  it("keeps ordinary paths", () => {
    expect(redactUrl("https://benvolio.app/account")).toBe("https://benvolio.app/account");
  });

  it("returns an empty string for something that is not a URL", () => {
    expect(redactUrl("not a url")).toBe("");
  });
});
