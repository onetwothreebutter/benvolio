import type { CaptureResult } from "posthog-js";
import { describe, expect, it } from "vitest";
import { redactCapture } from "./client";

const TOKEN = "Xy7_k2Lm9QwErTy0UiOp";

describe("redactCapture", () => {
  it("redacts URLs in properties, $set and $set_once", () => {
    const result = redactCapture({
      uuid: "u",
      event: "$pageview",
      properties: {
        $current_url: `https://benvolio.app/join/${TOKEN}?ref=mail`,
        $pathname: `/join/${TOKEN}`,
        $session_entry_url: "https://mail.example.com/inbox?q=dog",
      },
      $set_once: { $initial_person_info: { u: `https://benvolio.app/join/${TOKEN}` } },
    } as CaptureResult);
    expect(result?.properties).toMatchObject({
      $current_url: "https://benvolio.app/join/:id",
      $pathname: "/join/:id",
      $session_entry_url: "https://mail.example.com/inbox",
    });
    expect(result?.$set_once).toEqual({
      $initial_person_info: { u: "https://benvolio.app/join/:id" },
    });
  });
});
