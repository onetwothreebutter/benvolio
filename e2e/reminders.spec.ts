import { statusLine } from "@/lib/conversation/status";
import { reminderEmail, yourTurnEmail } from "@/lib/email/templates";
import { CRON_SECRET } from "./support/cron";
import { adminDatabase } from "./support/database";
import { hasEmail, takeBenvolioLink } from "./support/mail";
import { joinFromInvite, newPerson, signIn, startBenvolio } from "./support/people";
import { typeSitting } from "./support/sittings";
import { expect, test } from "./support/test";

/**
 * The daily check-in (/api/cron/reminders), called the way Vercel Cron calls
 * it. Time passing is arranged by moving a Benvolio's active_at back.
 */
const CHECK_IN = "/api/cron/reminders";
/** Subjects, from the templates, so the tests follow their wording. */
const reminderAbout = (partner: string) => reminderEmail({ partner, link: "", sitting: 0, last: false }).subject;
const yourTurnWith = (partner: string) => yourTurnEmail({ partner, sitting: 0, link: "", why: "start" }).subject;

async function quietFor(id: string, days: number) {
  const activeAt = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  const { error } = await adminDatabase().from("benvolios").update({ active_at: activeAt }).eq("id", id);
  if (error) throw new Error(error.message);
}

async function remindersSent(id: string) {
  const { data, error } = await adminDatabase()
    .from("notifications")
    .select("role, sitting, reminder_number")
    .eq("benvolio_id", id)
    .eq("kind", "reminder");
  if (error) throw new Error(error.message);
  return data;
}

test("the check-in refuses anyone without the secret", async ({ request }) => {
  expect((await request.get(CHECK_IN)).status()).toBe(401);
  expect((await request.get(CHECK_IN, { headers: { Authorization: "Bearer wrong" } })).status()).toBe(401);
  expect((await request.get(CHECK_IN, { headers: { Authorization: CRON_SECRET } })).status()).toBe(401);
});

test("the check-in reminds whoever's turn it has been for a few quiet days, once", async ({ page, anotherPhone, request }, testInfo) => {
  const jane = newPerson("Jane", testInfo);
  const rhonda = newPerson("Rhonda", testInfo);
  await signIn(page, jane);
  const started = await startBenvolio(page, rhonda);
  // A second Benvolio, quiet for only a day: too soon for a reminder.
  const recent = await startBenvolio(page, newPerson("Robin", testInfo));
  const rhondasPhone = await anotherPhone();
  await joinFromInvite(rhondasPhone, started.inviteUrl, rhonda);
  await typeSitting(page, started.id, "initiator", 0);
  // The turn emails come first; these tests are about what follows.
  await takeBenvolioLink(rhonda.email, yourTurnWith("Jane"));

  await quietFor(started.id, 3);
  await quietFor(recent.id, 1);
  const checkIn = () => request.get(CHECK_IN, { headers: { Authorization: `Bearer ${CRON_SECRET}` } });
  const response = await checkIn();
  expect(response.status()).toBe(200);
  // Only this test's Benvolios are checked below: a local database kept
  // between runs has others gone quiet too, which this run reminds as well.

  // Rhonda owes her opening; Jane is waiting on her, so isn't reminded.
  const link = await takeBenvolioLink(rhonda.email, reminderAbout("Jane"));
  await rhondasPhone.goto(link);
  await expect(rhondasPhone).toHaveURL(`/b/${started.id}`);
  await expect(rhondasPhone.getByText(statusLine({ kind: "sit", sitting: 0 }, "Jane"))).toBeVisible();
  expect(await hasEmail(jane.email, reminderAbout("Rhonda"))).toBe(false);
  expect(await remindersSent(started.id)).toEqual([{ role: "recipient", sitting: 0, reminder_number: 1 }]);
  expect(await remindersSent(recent.id)).toEqual([]);

  // The next run, the same day, sends nothing more.
  expect((await checkIn()).status()).toBe(200);
  expect(await remindersSent(started.id)).toHaveLength(1);
  expect(await hasEmail(rhonda.email, reminderAbout("Jane"))).toBe(false);
});
