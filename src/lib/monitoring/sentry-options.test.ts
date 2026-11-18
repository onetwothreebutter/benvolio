import type { ErrorEvent } from "@sentry/nextjs";
import { describe, expect, it } from "vitest";
import { sentryOptions } from "./sentry-options";

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

  it("redacts URLs in events and breadcrumbs", () => {
    const event = sentryOptions.beforeSend({
      type: undefined,
      request: { url: "https://benvolio.app/join/Xy7_k2Lm9QwErTy0UiOp?x=1" },
    } as ErrorEvent);
    expect(event.request?.url).toBe("https://benvolio.app/join/:id");

    const crumb = sentryOptions.beforeBreadcrumb({
      category: "navigation",
      data: { from: "/", to: "/join/Xy7_k2Lm9QwErTy0UiOp" },
    });
    expect(crumb.data).toEqual({ from: "/", to: "/join/:id" });
  });
});
