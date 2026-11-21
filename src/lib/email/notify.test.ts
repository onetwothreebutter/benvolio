// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { join, startConversation, submit } from "@/lib/conversation/model";
import { validSitting } from "@/test/sittings";

vi.mock("server-only", () => ({}));
const single = vi.hoisted(() => vi.fn());
const insert = vi.hoisted(() => vi.fn(() => ({ select: () => ({ single }) })));
const eq = vi.hoisted(() => vi.fn());
const from = vi.hoisted(() => vi.fn(() => ({ insert, delete: () => ({ eq }) })));
const getUserById = vi.hoisted(() => vi.fn());
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ from, auth: { admin: { getUserById } } }),
}));
const sendEmail = vi.hoisted(() => vi.fn());
const emailEnabled = vi.hoisted(() => vi.fn());
vi.mock("./resend", () => ({ sendEmail, emailEnabled }));
const after = vi.hoisted(() => vi.fn());
vi.mock("next/server", () => ({ after }));
const captureException = vi.hoisted(() => vi.fn());
vi.mock("@sentry/nextjs", () => ({ captureException }));
const loadBenvoliosForEmail = vi.hoisted(() => vi.fn());
vi.mock("@/lib/db/load-benvolio", () => ({ loadBenvoliosForEmail }));
/** What loadBenvoliosForEmail returns for B, with these people and this conversation. */
const loads = (people: unknown[], conversation: unknown) =>
  loadBenvoliosForEmail.mockResolvedValue([{ id: B, pace: "daily", activeAt: "", people, conversation }]);

const { notify, notifyLater, sendOnce } = await import("./notify");

const B = "00000000-0000-4000-8000-0000000000b1";
const notification = { benvolioId: B, role: "recipient", kind: "reminder", sitting: 1, reminderNumber: 2 } as const;
const message = { subject: "S", html: "<p>H</p>", text: "T" };

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("SITE_URL", "https://benvolio.test");
  emailEnabled.mockReturnValue(true);
  single.mockResolvedValue({ data: { id: 7 }, error: null });
  getUserById.mockResolvedValue({ data: { user: { email: "rhonda@example.com" } }, error: null });
  sendEmail.mockResolvedValue(undefined);
  eq.mockResolvedValue({ error: null });
});
afterEach(() => vi.unstubAllEnvs());

describe("sendOnce", () => {
  it("records the email, then sends it to the person's address", async () => {
    expect(await sendOnce(notification, "rhonda", message)).toBe(true);
    expect(from).toHaveBeenCalledWith("notifications");
    expect(insert).toHaveBeenCalledWith({
      benvolio_id: B,
      role: "recipient",
      kind: "reminder",
      sitting: 1,
      reminder_number: 2,
    });
    expect(getUserById).toHaveBeenCalledWith("rhonda");
    expect(sendEmail).toHaveBeenCalledWith({
      to: "rhonda@example.com",
      ...message,
      tags: { kind: "reminder", benvolio_id: B },
      idempotencyKey: `${B}/recipient/reminder/1/2`,
    });
  });

  it("sends nothing if it was sent already", async () => {
    single.mockResolvedValue({ data: null, error: { code: "23505", message: "duplicate" } });
    expect(await sendOnce(notification, "rhonda", message)).toBe(false);
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("drops the record when sending fails, so it can be tried again", async () => {
    sendEmail.mockRejectedValue(new Error("Resend refused an email: 500"));
    await expect(sendOnce(notification, "rhonda", message)).rejects.toThrow("500");
    expect(eq).toHaveBeenCalledWith("id", 7);
  });

  it("drops the record when there's no address to send to", async () => {
    getUserById.mockResolvedValue({ data: { user: null }, error: { message: "User not found" } });
    await expect(sendOnce(notification, "rhonda", message)).rejects.toThrow("User not found");
    expect(eq).toHaveBeenCalledWith("id", 7);
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("reports a failure to release the record without hiding the cause", async () => {
    sendEmail.mockRejectedValue(new Error("Resend refused an email: 500"));
    eq.mockResolvedValue({ error: { message: "connection reset" } });
    await expect(sendOnce(notification, "rhonda", message)).rejects.toThrow("500");
    expect(captureException).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringContaining("connection reset") }));
  });

  it("throws when the record can't be written", async () => {
    single.mockResolvedValue({ data: null, error: { code: "XX000", message: "boom" } });
    await expect(sendOnce(notification, "rhonda", message)).rejects.toThrow("boom");
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("does nothing while email is off", async () => {
    emailEnabled.mockReturnValue(false);
    expect(await sendOnce(notification, "rhonda", message)).toBe(false);
    expect(insert).not.toHaveBeenCalled();
  });
});

describe("notify", () => {
  const people = [
    { role: "initiator", person_id: "jane", first_name: "Jane" },
    { role: "recipient", person_id: "rhonda", first_name: "Rhonda" },
  ];
  const joined = join(startConversation("Should we get a dog?"));
  const opened = submit(joined, "initiator", 0, validSitting(0, "Jane"));
  const finished = (() => {
    let c = joined;
    for (let s = 0; s <= 5; s++) {
      for (const role of ["initiator", "recipient"] as const) c = submit(c, role, s, validSitting(s, role));
    }
    return c;
  })();

  it("emails the partner when it's their turn, linking to the Benvolio", async () => {
    loads(people, opened);
    await notify(B, "initiator");
    expect(loadBenvoliosForEmail).toHaveBeenCalledWith([B]);
    expect(insert).toHaveBeenCalledWith({
      benvolio_id: B,
      role: "recipient",
      kind: "your_turn",
      sitting: 0,
      reminder_number: null,
    });
    expect(getUserById).toHaveBeenCalledWith("rhonda");
    const [{ subject, text }] = sendEmail.mock.calls[0];
    expect(subject).toBe("Your turn with Jane");
    expect(text).toContain(`https://benvolio.test/b/${B}`);
  });

  it("emails the partner, not the sender, when a sitting is revealed", async () => {
    const both = submit(opened, "recipient", 0, validSitting(0, "Rhonda"));
    loads(people, both);
    await notify(B, "recipient");
    expect(insert).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ role: "initiator", sitting: 1 }));
    expect(sendEmail.mock.calls[0][0].text).toContain("Rhonda has sent their part");
  });

  it("asks the initiator to decide on new wording", async () => {
    loads(people, join(startConversation("Dogs?"), "Cats?"));
    await notify(B, "recipient");
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ role: "initiator", kind: "question_proposed", sitting: null }));
  });

  it("emails the partner when the conversation is finished", async () => {
    loads(people, finished);
    await notify(B, "recipient");
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ role: "initiator", kind: "finished", sitting: null }));
    expect(sendEmail.mock.calls[0][0].subject).toBe("Your Benvolio with Rhonda is finished");
  });

  it("emails nobody while the partner waits, hasn't joined, or the Benvolio is gone", async () => {
    loads(people, opened);
    await notify(B, "recipient"); // The initiator waits for the recipient's opening.
    const unjoined = [people[0], { ...people[1], person_id: null }];
    loads(unjoined, opened);
    await notify(B, "initiator");
    loadBenvoliosForEmail.mockResolvedValue([]);
    await notify(B, "initiator");
    expect(insert).not.toHaveBeenCalled();
  });

  it("runs later, reporting failures to Sentry, and not at all while email is off", async () => {
    loadBenvoliosForEmail.mockRejectedValue(new Error("boom"));
    notifyLater(B, "initiator");
    await after.mock.calls[0][0]();
    expect(captureException).toHaveBeenCalledWith(expect.objectContaining({ message: "boom" }));
    emailEnabled.mockReturnValue(false);
    notifyLater(B, "initiator");
    expect(after).toHaveBeenCalledTimes(1);
  });
});
