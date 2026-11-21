import { statusLine } from "@/lib/conversation/status";
import { questionProposedEmail, yourTurnEmail } from "@/lib/email/templates";
import { hasEmail, takeBenvolioLink } from "./support/mail";
import { joinFromInvite, newPerson, signIn, startBenvolio } from "./support/people";
import { typeSitting } from "./support/sittings";
import { expect, test } from "./support/test";

/**
 * Turn emails, as people get them: through the app's real sending code, to a
 * stand-in for Resend that delivers to Mailpit (e2e/support/fake-resend.ts).
 */

/** Subjects, from the templates, so the tests follow their wording. */
const yourTurnWith = (partner: string) => yourTurnEmail({ partner, sitting: 0, link: "", why: "start" }).subject;
const newWordingFrom = (partner: string) => questionProposedEmail({ partner, link: "" }).subject;
test("each person is emailed when it's their turn, with a link that opens it", async ({ page, anotherPhone }, testInfo) => {
  const jane = newPerson("Jane", testInfo);
  const rhonda = newPerson("Rhonda", testInfo);
  await signIn(page, jane);
  const started = await startBenvolio(page, rhonda);
  const rhondasPhone = await anotherPhone();
  await joinFromInvite(rhondasPhone, started.inviteUrl, rhonda);
  await expect(rhondasPhone).toHaveURL(`/b/${started.id}`);

  // Rhonda joined, so Jane can begin.
  const ready = await takeBenvolioLink(jane.email, yourTurnWith("Rhonda"));
  expect(ready).toBe(`http://localhost:3100/b/${started.id}`);
  await page.goto(ready);
  await expect(page.getByText(statusLine({ kind: "sit", sitting: 0 }, "Rhonda"))).toBeVisible();

  // Jane's opening is waiting on Rhonda's.
  await typeSitting(page, started.id, "initiator", 0);
  await rhondasPhone.goto(await takeBenvolioLink(rhonda.email, yourTurnWith("Jane")));
  await expect(rhondasPhone).toHaveURL(`/b/${started.id}`);
  await expect(rhondasPhone.getByText(statusLine({ kind: "sit", sitting: 0 }, "Jane"))).toBeVisible();

  // Rhonda's reveals both: Jane can read it and reply. Rhonda, on the page, isn't emailed.
  await typeSitting(rhondasPhone, started.id, "recipient", 0);
  await page.goto(await takeBenvolioLink(jane.email, yourTurnWith("Rhonda")));
  await expect(page.getByText(statusLine({ kind: "sit", sitting: 1 }, "Rhonda"))).toBeVisible();
  expect(await hasEmail(rhonda.email, "Your turn")).toBe(false);
});

test("the initiator is emailed about new wording, and the recipient once it's settled", async ({ page, anotherPhone }, testInfo) => {
  const jane = newPerson("Jane", testInfo);
  const rhonda = newPerson("Rhonda", testInfo);
  await signIn(page, jane);
  const started = await startBenvolio(page, rhonda);
  const rhondasPhone = await anotherPhone();
  await joinFromInvite(rhondasPhone, started.inviteUrl, rhonda, "A dog or a cat?");
  await expect(rhondasPhone).toHaveURL(`/b/${started.id}`);

  await page.goto(await takeBenvolioLink(jane.email, newWordingFrom("Rhonda")));
  await page.getByRole("button", { name: "Keep my wording" }).click();
  await expect(page.getByText(statusLine({ kind: "sit", sitting: 0 }, "Rhonda"))).toBeVisible();

  await rhondasPhone.goto(await takeBenvolioLink(rhonda.email, yourTurnWith("Jane")));
  await expect(rhondasPhone.getByText(statusLine({ kind: "sit", sitting: 0 }, "Jane"))).toBeVisible();
});
