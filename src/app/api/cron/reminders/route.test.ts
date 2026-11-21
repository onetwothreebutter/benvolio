// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const sendReminders = vi.hoisted(() => vi.fn());
vi.mock("@/lib/email/reminders", () => ({ sendReminders }));
const withMonitor = vi.hoisted(() => vi.fn((_slug: string, run: () => unknown) => run()));
const captureMessage = vi.hoisted(() => vi.fn());
vi.mock("@sentry/nextjs", () => ({ withMonitor, captureMessage }));

const { GET } = await import("./route");

const call = (authorization?: string) =>
  GET(new Request("https://benvolio.test/api/cron/reminders", { headers: authorization ? { authorization } : {} }));

describe("the daily check-in", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("CRON_SECRET", "s3cret");
    sendReminders.mockResolvedValue({ checked: 2, sent: 1, failed: 0, finished: true });
  });
  afterEach(() => vi.unstubAllEnvs());

  it("sends reminders under Sentry's cron monitor, on the schedule in vercel.json", async () => {
    const response = await call("Bearer s3cret");
    expect(await response.json()).toEqual({ checked: 2, sent: 1, failed: 0, finished: true });
    expect(captureMessage).not.toHaveBeenCalled();
    const [slug, , config] = withMonitor.mock.calls[0] as unknown as [string, unknown, { schedule: { value: string } }];
    expect(slug).toBe("reminders");
    const { readFileSync } = await import("node:fs");
    const vercel = JSON.parse(readFileSync("vercel.json", "utf8"));
    expect(vercel.crons).toEqual([{ path: "/api/cron/reminders", schedule: config.schedule.value }]);
  });

  it("warns Sentry when a run runs out of time", async () => {
    sendReminders.mockResolvedValue({ checked: 9, sent: 4, failed: 0, finished: false });
    await call("Bearer s3cret");
    expect(captureMessage).toHaveBeenCalledWith("Reminders ran out of time: 4 sent of 9 checked", "warning");
  });

  it("refuses anyone without the secret, and everyone when it isn't set", async () => {
    expect((await call()).status).toBe(401);
    expect((await call("Bearer wrong")).status).toBe(401);
    expect((await call("Bearer s3cre")).status).toBe(401);
    vi.stubEnv("CRON_SECRET", "");
    expect((await call("Bearer ")).status).toBe(401);
    expect(sendReminders).not.toHaveBeenCalled();
  });
});
