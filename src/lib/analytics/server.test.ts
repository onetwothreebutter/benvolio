import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const ph = vi.hoisted(() => ({ capture: vi.fn(), flush: vi.fn(() => Promise.resolve()) }));
vi.mock("posthog-node", () => ({
  PostHog: vi.fn(function () {
    return ph;
  }),
}));
const after = vi.hoisted(() => vi.fn());
vi.mock("next/server", () => ({ after }));
vi.mock("@sentry/nextjs", () => ({ captureMessage: vi.fn() }));

const ID = "6f1c2a9e-4b7d-4c1e-9a2b-3c4d5e6f7a8b";

async function loadServer(key: string) {
  vi.resetModules();
  vi.stubEnv("NEXT_PUBLIC_POSTHOG_KEY", key);
  return import("./server");
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
});

describe("trackServer", () => {
  it("captures and flushes after the response", async () => {
    const { trackServer } = await loadServer("phc_test");
    trackServer("person-1", "step_submitted", { benvolio_id: ID, round: 2, step: "write", sitting: 3 });
    expect(ph.capture).toHaveBeenCalledWith({
      distinctId: "person-1",
      event: "step_submitted",
      properties: { benvolio_id: ID, round: 2, step: "write", sitting: 3 },
    });
    expect(after).toHaveBeenCalledOnce();
    expect(ph.flush).not.toHaveBeenCalled();
  });

  it("flushes straight away outside a request", async () => {
    after.mockImplementationOnce(() => {
      throw new Error("after() called outside a request scope");
    });
    const { trackServer } = await loadServer("phc_test");
    trackServer("person-1", "invite_sent", { benvolio_id: ID });
    expect(ph.flush).toHaveBeenCalledOnce();
  });

  it("drops an event for a person id that is not opaque", async () => {
    const { trackServer } = await loadServer("phc_test");
    trackServer("jane@example.com", "invite_sent", { benvolio_id: ID });
    expect(ph.capture).not.toHaveBeenCalled();
  });

  it("does nothing without a project key", async () => {
    const { trackServer } = await loadServer("");
    trackServer("person-1", "invite_sent", { benvolio_id: ID });
    expect(ph.capture).not.toHaveBeenCalled();
  });
});
