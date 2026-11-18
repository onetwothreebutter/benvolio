import type { CaptureResult } from "posthog-js";
import { describe, expect, it } from "vitest";
import { redactCapture } from "./client";

describe("redactCapture", () => {
  it("redacts every URL property PostHog attaches", () => {
    const event = {
      uuid: "u",
      event: "$pageview",
      properties: {
        $current_url: "https://benvolio.app/join/Xy7_k2Lm9QwErTy0UiOp?ref=mail",
        $referrer: "https://mail.example.com/inbox?q=dog",
        $pathname: "/join",
      },
    } as CaptureResult;
    const result = redactCapture(event);
    expect(result?.properties.$current_url).toBe("https://benvolio.app/join/:id");
    expect(result?.properties.$referrer).toBe("https://mail.example.com/inbox");
  });
});
