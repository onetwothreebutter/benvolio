// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { join, startConversation, submit, type Conversation, type Role } from "@/lib/conversation/model";
import { validSitting } from "@/test/sittings";

vi.mock("server-only", () => ({}));
const tables = vi.hoisted(() => ({}) as Record<string, { data: unknown[] | null; error: unknown }>);
const queries = vi.hoisted(() => [] as { table: string; calls: unknown[][] }[]);
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      const query = { table, calls: [] as unknown[][] };
      queries.push(query);
      // Every filter returns the same chain; awaiting it gives the table's rows.
      const chain: Record<string, unknown> = {
        then: (resolve: (v: unknown) => void) => resolve(tables[table]),
      };
      for (const method of ["select", "lte", "gte", "order", "limit", "eq", "in"]) {
        chain[method] = (...args: unknown[]) => {
          query.calls.push([method, ...args]);
          return chain;
        };
      }
      return chain;
    },
  }),
}));
const sendOnce = vi.hoisted(() => vi.fn());
vi.mock("./notify", async (actual) => ({ ...(await actual<typeof import("./notify")>()), sendOnce }));
const loadBenvoliosForEmail = vi.hoisted(() => vi.fn());
vi.mock("@/lib/db/load-benvolio", () => ({ loadBenvoliosForEmail }));
const emailEnabled = vi.hoisted(() => vi.fn());
vi.mock("./resend", () => ({ emailEnabled }));
const trackServer = vi.hoisted(() => vi.fn());
vi.mock("@/lib/analytics/server", () => ({ trackServer }));
const captureException = vi.hoisted(() => vi.fn());
vi.mock("@sentry/nextjs", () => ({ captureException }));

const { nextReminder, sendReminders } = await import("./reminders");

const NOW = new Date("2026-11-21T17:00:00Z");
const daysAgo = (days: number) => new Date(NOW.getTime() - days * 86_400_000).toISOString();
const B = "00000000-0000-4000-8000-0000000000b1";
type Person = { role: string; person_id: string | null; first_name: string };
const people: Person[] = [
  { role: "initiator", person_id: "jane", first_name: "Jane" },
  { role: "recipient", person_id: "rhonda", first_name: "Rhonda" },
];

/** A quiet Benvolio B at the point `c` has reached, with these reminders already sent. */
function setBenvolio(
  c: Conversation,
  quietDays: number,
  { pace = "daily", inIt = people, reminders = [] as unknown[] } = {},
) {
  tables.benvolios = { data: [{ id: B }], error: null };
  tables.notifications = { data: reminders, error: null };
  loadBenvoliosForEmail.mockResolvedValue([{ id: B, pace, activeAt: daysAgo(quietDays), people: inIt, conversation: c }]);
}

const sit = (c: Conversation, role: Role, sitting: number) => submit(c, role, sitting, validSitting(sitting, role));
const joined = () => join(startConversation("Dogs?"));

beforeEach(() => {
  vi.clearAllMocks();
  queries.length = 0;
  vi.stubEnv("SITE_URL", "https://benvolio.test");
  emailEnabled.mockReturnValue(true);
  sendOnce.mockResolvedValue(true);
});
afterEach(() => vi.unstubAllEnvs());

describe("nextReminder", () => {
  it("waits the first gap after the last move, then each gap after the reminder before", () => {
    expect(nextReminder("daily", daysAgo(1.9), undefined, NOW)).toBeNull();
    // The check-in runs at any minute in its hour.
    expect(nextReminder("daily", daysAgo(1.97), undefined, NOW)).toBe(1);
    expect(nextReminder("daily", daysAgo(5), { number: 1, at: daysAgo(1) }, NOW)).toBeNull();
    expect(nextReminder("daily", daysAgo(5), { number: 1, at: daysAgo(2) }, NOW)).toBe(2);
    expect(nextReminder("daily", daysAgo(9), { number: 2, at: daysAgo(3) }, NOW)).toBe(3);
    expect(nextReminder("daily", daysAgo(30), { number: 3, at: daysAgo(20) }, NOW)).toBeNull();
    expect(nextReminder("weekly", daysAgo(6), undefined, NOW)).toBeNull();
    expect(nextReminder("weekly", daysAgo(7), undefined, NOW)).toBe(1);
  });

  it("counts from a move after the last reminder", () => {
    // Reminded 4 days ago; the partner moved yesterday.
    expect(nextReminder("daily", daysAgo(1), { number: 1, at: daysAgo(4) }, NOW)).toBeNull();
    expect(nextReminder("daily", daysAgo(2), { number: 1, at: daysAgo(4) }, NOW)).toBe(2);
  });

  it("starts at the first reminder however long it has been", () => {
    expect(nextReminder("daily", daysAgo(15), undefined, NOW)).toBe(1);
  });
});

describe("sendReminders", () => {
  it("looks at Benvolios quiet long enough, and recently enough, to remind", async () => {
    tables.benvolios = { data: [], error: null };
    expect(await sendReminders(NOW)).toEqual({ checked: 0, sent: 0, failed: 0, finished: true });
    expect(queries).toHaveLength(1);
    expect(queries[0].calls).toEqual([
      ["select", "id"],
      ["lte", "active_at", new Date(NOW.getTime() - 2 * 86_400_000 + 3_600_000).toISOString()],
      ["gte", "active_at", daysAgo(21)],
      ["order", "active_at", { ascending: false }],
      ["limit", 1000],
    ]);
  });

  it("reminds the person whose turn it is, numbering on from what was sent", async () => {
    const reminders = [{ benvolio_id: B, role: "recipient", sitting: 0, reminder_number: 1, sent_at: daysAgo(2) }];
    setBenvolio(sit(joined(), "initiator", 0), 4, { reminders });
    expect(await sendReminders(NOW)).toEqual({ checked: 1, sent: 1, failed: 0, finished: true });
    expect(loadBenvoliosForEmail).toHaveBeenCalledWith([B]);
    expect(queries[1].calls).toEqual([
      ["select", "benvolio_id, role, sitting, reminder_number, sent_at"],
      ["eq", "kind", "reminder"],
      ["in", "benvolio_id", [B]],
    ]);
    const [[notification, personId, message]] = sendOnce.mock.calls;
    expect(notification).toEqual({ benvolioId: B, role: "recipient", kind: "reminder", sitting: 0, reminderNumber: 2 });
    expect(personId).toBe("rhonda");
    expect(message.subject).toBe("It's still your turn with Jane");
    expect(message.text).toContain(`https://benvolio.test/b/${B}`);
    expect(message.text).not.toContain("last reminder");
    expect(trackServer).toHaveBeenCalledExactlyOnceWith("rhonda", "reminder_sent", { benvolio_id: B, reminder_number: 2 });

    sendOnce.mockResolvedValue(false); // Sent already, by an overlapping run.
    expect(await sendReminders(NOW)).toMatchObject({ sent: 0 });
    expect(trackServer).toHaveBeenCalledTimes(1);
  });

  it("reminds both when both owe a sitting, and says when it's the last", async () => {
    const reminders = (["initiator", "recipient"] as const).map((role) => ({
      benvolio_id: B,
      role,
      sitting: 0,
      reminder_number: 2,
      sent_at: daysAgo(3),
    }));
    setBenvolio(joined(), 8, { reminders });
    await sendReminders(NOW);
    expect(sendOnce.mock.calls.map(([n]) => [n.role, n.reminderNumber])).toEqual([
      ["initiator", 3],
      ["recipient", 3],
    ]);
    expect(sendOnce.mock.calls[0][2].text).toContain("This is the last reminder");
  });

  it("reminds the initiator to decide on new wording", async () => {
    setBenvolio(join(startConversation("Dogs?"), "Cats?"), 2);
    await sendReminders(NOW);
    expect(sendOnce).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ role: "initiator", sitting: null, reminderNumber: 1 }),
      "jane",
      expect.objectContaining({ subject: "Rhonda is waiting on the question's wording" }),
    );
  });

  it("reminds nobody who is waiting, hasn't joined, has had three, or has finished", async () => {
    setBenvolio(sit(joined(), "initiator", 0), 3, { pace: "weekly" }); // Too soon.
    await sendReminders(NOW);
    setBenvolio(sit(startConversation("Dogs?"), "initiator", 0), 3, { inIt: [people[0], { ...people[1], person_id: null }] });
    await sendReminders(NOW);
    const three = [{ benvolio_id: B, role: "recipient", sitting: 0, reminder_number: 3, sent_at: daysAgo(5) }];
    setBenvolio(sit(joined(), "initiator", 0), 15, { reminders: three });
    await sendReminders(NOW);
    let done = joined();
    for (let s = 0; s <= 5; s++) done = sit(sit(done, "initiator", s), "recipient", s);
    setBenvolio(done, 3);
    await sendReminders(NOW);
    expect(sendOnce).not.toHaveBeenCalled();
  });

  it("carries on past a failure, reporting it", async () => {
    setBenvolio(joined(), 2);
    sendOnce.mockRejectedValueOnce(new Error("Resend refused an email: 500"));
    expect(await sendReminders(NOW)).toEqual({ checked: 1, sent: 1, failed: 1, finished: true });
    expect(captureException).toHaveBeenCalledOnce();
  });

  it("stops starting sends when its time is up, leaving the rest for the next run", async () => {
    setBenvolio(joined(), 2);
    const start = Date.now();
    vi.spyOn(Date, "now").mockReturnValueOnce(start).mockReturnValue(start + 60_000);
    expect(await sendReminders(NOW)).toEqual({ checked: 1, sent: 0, failed: 0, finished: false });
    vi.restoreAllMocks();
  });

  it("does nothing while email is off", async () => {
    emailEnabled.mockReturnValue(false);
    expect(await sendReminders(NOW)).toMatchObject({ checked: 0, sent: 0 });
    expect(queries).toHaveLength(0);
  });
});
