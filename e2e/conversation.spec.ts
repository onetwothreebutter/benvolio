import { expect, test, type Page } from "@playwright/test";
import { LAST_SITTING, type Role } from "@/lib/conversation/model";
import { newPerson, signIn, signInHere, startBenvolio } from "./support/people";
import { anotherPhone } from "./support/phones";
import { acceptProposedQuestion, writeSitting } from "./support/sittings";

/**
 * A whole Benvolio, from the invite to the finish, checking what each person's
 * page tells them at every turn. The writing itself goes straight into the
 * database (see support/sittings.ts) until the writing screens exist.
 */
test("two people take turns through a whole Benvolio", async ({ page, browser }, testInfo) => {
  test.setTimeout(180_000);
  await signIn(page, newPerson("Jane", testInfo));
  const started = await startBenvolio(page, newPerson("Rhonda", testInfo), "Should we get a dog?");

  const rhondasPhone = await anotherPhone(browser, testInfo);
  await rhondasPhone.goto(started.inviteUrl);
  await rhondasPhone.getByRole("link", { name: "Sign in to join" }).click();
  await signInHere(rhondasPhone, newPerson("Rhonda", testInfo));
  await rhondasPhone.getByLabel("The question").fill("Should we get a dog this year?");
  await rhondasPhone.getByRole("button", { name: "Join" }).click();
  await expect(rhondasPhone).toHaveURL(`/b/${started.id}`);

  const phones: Record<Role, Page> = { initiator: page, recipient: rhondasPhone };
  const partnerName: Record<Role, string> = { initiator: "Rhonda", recipient: "Jane" };
  async function expectStatus(role: Role, status: string) {
    const phone = phones[role];
    await phone.goto(`/b/${started.id}`);
    await expect(phone.getByText(status, { exact: true })).toBeVisible();
  }

  // The question is settled before anyone writes.
  await expectStatus("initiator", "Rhonda suggested new wording: “Should we get a dog this year?”");
  await expectStatus("recipient", "Waiting for Jane to agree to your wording.");
  await acceptProposedQuestion(started.id);
  for (const role of ["initiator", "recipient"] as const) {
    await expectStatus(role, "Your turn: write your opening.");
    await expect(phones[role].getByRole("heading", { name: "Should we get a dog this year?" })).toBeVisible();
  }

  for (let sitting = 0; sitting <= LAST_SITTING; sitting++) {
    // Take turns going first, so each person waits on the other.
    const [first, second]: Role[] =
      sitting % 2 === 0 ? ["initiator", "recipient"] : ["recipient", "initiator"];
    await test.step(`sitting ${sitting + 1} of ${LAST_SITTING + 1}`, async () => {
      await writeSitting(started.id, first, sitting);
      await expectStatus(first, `Waiting for ${partnerName[first]} to write theirs.`);
      await expectStatus(second, turn(sitting));

      await writeSitting(started.id, second, sitting);
      const next = sitting === LAST_SITTING ? "You've finished this Benvolio." : turn(sitting + 1);
      await expectStatus(first, next);
      await expectStatus(second, next);
    });
  }
});

function turn(sitting: number) {
  return sitting === 0 ? "Your turn: write your opening." : `Your turn: sitting ${sitting + 1} of 6.`;
}
