import type { CaptureResult } from "posthog-js";
import { beforeEach, describe, expect, it, vi } from "vitest";

const posthog = vi.hoisted(() => ({
  init: vi.fn(),
  capture: vi.fn(),
  identify: vi.fn(),
  reset: vi.fn(),
}));
vi.mock("posthog-js", () => ({ default: posthog }));
const captureMessage = vi.hoisted(() => vi.fn());
vi.mock("@sentry/nextjs", () => ({ captureMessage }));

const TOKEN = "Xy7k2Lm9QwErTy0UiOp1";
const ID = "6f1c2a9e-4b7d-4c1e-9a2b-3c4d5e6f7a8b";

async function loadClient(key: string | undefined) {
  vi.resetModules();
  vi.stubEnv("NEXT_PUBLIC_POSTHOG_KEY", key ?? "");
  return import("./client");
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
});

describe("track", () => {
  it("sends typed events in call order once PostHog has loaded", async () => {
    const { track, identify } = await loadClient("phc_test");
    identify("person-1");
    track("invite_sent", { benvolio_id: ID });
    await vi.waitFor(() => expect(posthog.capture).toHaveBeenCalled());
    expect(posthog.init).toHaveBeenCalledOnce();
    expect(posthog.identify.mock.invocationCallOrder[0]).toBeLessThan(
      posthog.capture.mock.invocationCallOrder[0],
    );
    expect(posthog.capture).toHaveBeenCalledWith("invite_sent", { benvolio_id: ID });
  });

  it("drops an event with free text and reports only the property name", async () => {
    const { track } = await loadClient("phc_test");
    track("invite_sent", { benvolio_id: "We should get a dog" });
    await new Promise((r) => setTimeout(r, 0));
    expect(posthog.capture).not.toHaveBeenCalled();
    expect(captureMessage).toHaveBeenCalledWith(
      'Dropped analytics event "invite_sent": unsafe property "benvolio_id"',
      "error",
    );
  });

  it("does nothing, and never loads PostHog, without a project key", async () => {
    const { track } = await loadClient(undefined);
    track("invite_sent", { benvolio_id: ID });
    await new Promise((r) => setTimeout(r, 0));
    expect(posthog.init).not.toHaveBeenCalled();
    expect(posthog.capture).not.toHaveBeenCalled();
  });
});

describe("redactCapture", () => {
  it("redacts URLs in properties, $set and $set_once", async () => {
    const { redactCapture } = await loadClient(undefined);
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
