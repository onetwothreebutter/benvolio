import { describe, expect, it } from "vitest";
import { redactUrl, redactUrlsDeep } from "./redact-url";

const TOKEN = "Xy7_k2Lm9QwErTy0UiOp";

describe("redactUrl", () => {
  it("drops the query string and fragment", () => {
    expect(redactUrl("https://benvolio.app/start?email=jane@example.com#top")).toBe(
      "https://benvolio.app/start",
    );
  });

  it("replaces token-like path segments", () => {
    expect(redactUrl(`https://benvolio.app/join/${TOKEN}`)).toBe("https://benvolio.app/join/:id");
    expect(
      redactUrl("https://benvolio.app/b/6f1c2a9e-4b7d-4c1e-9a2b-3c4d5e6f7a8b/round/2"),
    ).toBe("https://benvolio.app/b/:id/round/2");
  });

  it("handles bare paths", () => {
    expect(redactUrl(`/join/${TOKEN}?x=1`)).toBe("/join/:id");
  });

  it("keeps ordinary paths", () => {
    expect(redactUrl("https://benvolio.app/account")).toBe("https://benvolio.app/account");
  });
});

describe("redactUrlsDeep", () => {
  it("redacts URLs at any depth and leaves other values alone", () => {
    expect(
      redactUrlsDeep({
        $pathname: `/join/${TOKEN}`,
        nested: { u: `https://benvolio.app/join/${TOKEN}?r=1`, list: [`/b/${TOKEN}`] },
        round: 2,
        step: "respond",
      }),
    ).toEqual({
      $pathname: "/join/:id",
      nested: { u: "https://benvolio.app/join/:id", list: ["/b/:id"] },
      round: 2,
      step: "respond",
    });
  });
});
