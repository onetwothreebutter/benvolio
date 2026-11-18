import type { ErrorEvent } from "@sentry/nextjs";
import { describe, expect, it } from "vitest";
import { sentryOptions } from "./sentry-options";

const TOKEN = "Xy7k2Lm9QwErTy0UiOp1";

describe("sentryOptions", () => {
  it("turns off collection of personal data", () => {
    expect(sentryOptions.dataCollection).toEqual({
      userInfo: false,
      cookies: false,
      httpHeaders: false,
      httpBodies: [],
      urlQueryParams: false,
    });
  });

  it("scrubs URLs, emails and tokens from every part of an event", () => {
    const event = sentryOptions.beforeSend({
      type: undefined,
      message: `Invite ${TOKEN} for jane@example.com not found`,
      request: { url: `https://benvolio.app/join/${TOKEN}?x=1` },
      exception: {
        values: [
          {
            value: `Failed to fetch RSC payload for https://benvolio.app/join/${TOKEN}?_rsc=1`,
            stacktrace: {
              frames: [
                { filename: "app:///_next/static/chunks/a1b2c3d4e5f6a7b8.js", lineno: 1 },
                { filename: `https://benvolio.app/join/${TOKEN}?e=jane@example.com`, abs_path: `https://benvolio.app/join/${TOKEN}#x` },
              ],
            },
          },
        ],
      },
    } as ErrorEvent);
    expect(event.message).toBe("Invite :id for [email] not found");
    expect(event.request?.url).toBe("https://benvolio.app/join/:id");
    expect(event.exception?.values?.[0].value).toBe(
      "Failed to fetch RSC payload for https://benvolio.app/join/:id",
    );
    // Bundle file names and hashes stay so source maps still match; query strings go.
    const frames = event.exception?.values?.[0].stacktrace?.frames;
    expect(frames?.[0]).toEqual({ filename: "app:///_next/static/chunks/a1b2c3d4e5f6a7b8.js", lineno: 1 });
    expect(frames?.[1].filename).toBe(`https://benvolio.app/join/${TOKEN}`);
    expect(frames?.[1].abs_path).toBe(`https://benvolio.app/join/${TOKEN}`);
  });

  it("drops console breadcrumbs and scrubs the rest", () => {
    expect(sentryOptions.beforeBreadcrumb({ category: "console", message: "anything" })).toBeNull();
    const crumb = sentryOptions.beforeBreadcrumb({
      category: "navigation",
      data: { from: "/", to: `/join/${TOKEN}` },
    });
    expect(crumb?.data).toEqual({ from: "/", to: "/join/:id" });
  });
});
