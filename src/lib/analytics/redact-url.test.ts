import { describe, expect, it } from "vitest";
import { redactUrl, redactUrlsDeep, scrubText } from "./redact-url";

const TOKEN = "Xy7k2Lm9QwErTy0UiOp1";

describe("redactUrl", () => {
  it("drops the query string and fragment", () => {
    expect(redactUrl("https://benvolio.app/start?email=jane@example.com#top")).toBe(
      "https://benvolio.app/start",
    );
  });

  it("replaces token, id, encoded and email path segments", () => {
    expect(redactUrl(`https://benvolio.app/join/${TOKEN}`)).toBe("https://benvolio.app/join/:id");
    expect(redactUrl("https://benvolio.app/b/6f1c2a9e-4b7d-4c1e-9a2b-3c4d5e6f7a8b/round/2")).toBe(
      "https://benvolio.app/b/:id/round/2",
    );
    expect(redactUrl("/u/jane@example.com")).toBe("/u/:id");
    expect(redactUrl("/q/should%20we%20get%20a%20dog")).toBe("/q/:id");
  });

  it("keeps ordinary paths, including long words", () => {
    expect(redactUrl("https://benvolio.app/account")).toBe("https://benvolio.app/account");
    expect(redactUrl("/notification-settings")).toBe("/notification-settings");
  });

  it("handles bare paths", () => {
    expect(redactUrl(`/join/${TOKEN}?x=1`)).toBe("/join/:id");
  });
});

describe("redactUrlsDeep", () => {
  it("redacts URLs at any depth and leaves other values alone", () => {
    expect(
      redactUrlsDeep({
        $pathname: `/join/${TOKEN}`,
        $session_id: "019a2b3c-4d5e-7f60-8a9b-0c1d2e3f4a5b",
        nested: { u: `https://benvolio.app/join/${TOKEN}?r=1`, list: [`/b/${TOKEN}`] },
        round: 2,
      }),
    ).toEqual({
      $pathname: "/join/:id",
      $session_id: "019a2b3c-4d5e-7f60-8a9b-0c1d2e3f4a5b",
      nested: { u: "https://benvolio.app/join/:id", list: ["/b/:id"] },
      round: 2,
    });
  });
});

describe("scrubText", () => {
  it("replaces URLs, paths with queries, emails and tokens inside text", () => {
    expect(
      scrubText(
        `GET /join/${TOKEN}?e=a@b.co failed; see https://benvolio.app/b/${TOKEN}#x for jane.doe@example.com`,
      ),
    ).toBe("GET /join/:id failed; see https://benvolio.app/b/:id for [email]");
  });

  it("leaves ordinary sentences alone", () => {
    expect(scrubText("Cannot read properties of undefined (reading 'round')")).toBe(
      "Cannot read properties of undefined (reading 'round')",
    );
  });
});
