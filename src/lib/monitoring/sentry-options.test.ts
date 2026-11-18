import type { ErrorEvent } from "@sentry/nextjs";
import { describe, expect, it } from "vitest";
import { scrubEvent } from "./sentry-options";

describe("scrubEvent", () => {
  it("removes request bodies, cookies, headers and user details", () => {
    const event = {
      type: undefined,
      request: {
        url: "https://benvolio.app/join/Xy7_k2Lm9QwErTy0UiOp?x=1",
        data: { answer: "Because I feel lonely" },
        cookies: { session: "secret" },
        headers: { authorization: "Bearer secret" },
        query_string: "x=1",
      },
      user: { id: "person-1", email: "jane@example.com", ip_address: "1.2.3.4" },
    } as ErrorEvent;
    const scrubbed = scrubEvent(event);
    expect(scrubbed.request).toEqual({ url: "https://benvolio.app/join/:id" });
    expect(scrubbed.user).toEqual({ id: "person-1" });
  });
});
