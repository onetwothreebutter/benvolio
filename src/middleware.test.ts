// @vitest-environment node
import { unstable_doesMiddlewareMatch } from "next/experimental/testing/server";
import { describe, expect, it, vi } from "vitest";
import { config } from "./middleware";

vi.mock("@supabase/ssr", () => ({ createServerClient: vi.fn() }));

const runsOn = (url: string) => unstable_doesMiddlewareMatch({ config, url });

describe("the middleware's matcher", () => {
  it("runs on pages, which refresh the session", () => {
    for (const url of ["/", "/sign-in", "/b/00000000-0000-4000-8000-0000000000b1", "/join/abc1"]) {
      expect(runsOn(url), url).toBe(true);
    }
  });

  it("skips API routes such as the reminders cron, the analytics proxy and static files", () => {
    for (const url of ["/api/cron/reminders", "/ingest/e/", "/_next/static/chunk.js", "/favicon.ico", "/logo.png"]) {
      expect(runsOn(url), url).toBe(false);
    }
  });
});
