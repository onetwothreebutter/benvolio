import type { Page } from "@playwright/test";
import { LAST_SITTING, partnerOf, type NextAction, type Role } from "@/lib/conversation/model";
import { statusLine } from "@/lib/conversation/status";
import { joinFromInvite, newPerson, signIn, startBenvolio } from "./support/people";
import { formError, STANCE } from "./support/screen";
import { typeSitting, writeSitting } from "./support/sittings";
import { expect, test } from "./support/test";

/**
 * A whole Benvolio, from the invite to the finish, checking what each person's
 * page tells them at every turn. Sittings with screens are typed; the rest go
 * straight into the database (see support/sittings.ts) until their screens exist.
 */
const LAST_TYPED_SITTING = 2;
test("two people take turns through a whole Benvolio", async ({ page, anotherPhone }, testInfo) => {
  test.setTimeout(180_000);
  await signIn(page, newPerson("Jane", testInfo));
  const started = await startBenvolio(page, newPerson("Rhonda", testInfo), "Should we get a dog?");

  // Jane writes her opening before Rhonda suggests new wording.
  await typeSitting(page, started.id, "initiator", 0);
  const rhondasPhone = await anotherPhone();
  await joinFromInvite(
    rhondasPhone,
    started.inviteUrl,
    newPerson("Rhonda", testInfo),
    "Should we get a dog this year?",
  );
  await expect(rhondasPhone).toHaveURL(`/b/${started.id}`);

  const phones: Record<Role, Page> = { initiator: page, recipient: rhondasPhone };
  const partnerName: Record<Role, string> = { initiator: "Rhonda", recipient: "Jane" };
  /** Opens each person's page and checks it says what should happen next. */
  async function expectNext(actions: Partial<Record<Role, NextAction>>) {
    await Promise.all(
      Object.entries(actions).map(async ([role, action]) => {
        const phone = phones[role as Role];
        await phone.goto(`/b/${started.id}`);
        const line = statusLine(action, partnerName[role as Role]);
        await expect(phone.getByText(line, { exact: true })).toBeVisible();
      }),
    );
  }
  const both = (action: NextAction) => ({ initiator: action, recipient: action });

  // The question is settled before anyone writes.
  await expectNext({
    initiator: { kind: "decide_question", proposed: "Should we get a dog this year?" },
    recipient: { kind: "wait_for_question" },
  });
  // Accepting it reopens Jane's opening, so her stance answers the new wording.
  await expect(page.getByText("Should we get a dog this year?", { exact: true })).toBeVisible();
  await expect(page.getByText("you'll write your opening again")).toBeVisible();
  await page.getByRole("button", { name: "Use the new wording" }).click();
  await expect(page.getByRole("heading", { name: "Should we get a dog this year?" })).toBeVisible();
  await expectNext(both({ kind: "sit", sitting: 0 }));
  for (const phone of Object.values(phones)) {
    await expect(phone.getByRole("heading", { name: "Should we get a dog this year?" })).toBeVisible();
  }

  for (let sitting = 0; sitting <= LAST_SITTING; sitting++) {
    // Take turns going first, so each person waits on the other.
    const first: Role = sitting % 2 === 0 ? "initiator" : "recipient";
    const second = partnerOf(first);
    await test.step(`sitting ${sitting + 1} of ${LAST_SITTING + 1}`, async () => {
      const write = (role: Role) =>
        sitting <= LAST_TYPED_SITTING
          ? typeSitting(phones[role], started.id, role, sitting)
          : writeSitting(started.id, role, sitting);
      await write(first);
      await expectNext({
        [first]: { kind: "wait", sitting },
        [second]: { kind: "sit", sitting },
      });

      await write(second);
      await expectNext(
        both(sitting === LAST_SITTING ? { kind: "finished" } : { kind: "sit", sitting: sitting + 1 }),
      );
    });
  }
});

test("the initiator can keep their own wording", async ({ page, anotherPhone }, testInfo) => {
  await signIn(page, newPerson("Jane", testInfo));
  const started = await startBenvolio(page, newPerson("Rhonda", testInfo), "Should we get a dog?");
  const rhondasPhone = await anotherPhone();
  await joinFromInvite(rhondasPhone, started.inviteUrl, newPerson("Rhonda", testInfo), "A dog or a cat?");
  await expect(rhondasPhone).toHaveURL(`/b/${started.id}`);

  // Jane hasn't written her opening, so there's nothing to rewrite.
  await page.goto(`/b/${started.id}`);
  await expect(page.getByText("you'll write your opening again")).toHaveCount(0);
  await page.getByRole("button", { name: "Keep my wording" }).click();
  await expect(page.getByText(statusLine({ kind: "sit", sitting: 0 }, ""))).toBeVisible();
  await expect(page.getByRole("heading", { name: "Should we get a dog?" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Keep my wording" })).toHaveCount(0);

  await rhondasPhone.reload();
  await expect(rhondasPhone.getByText(statusLine({ kind: "sit", sitting: 0 }, ""))).toBeVisible();
  await expect(rhondasPhone.getByRole("heading", { name: "Should we get a dog?" })).toBeVisible();
});

test("the opening explains a blank answer and keeps what was typed", async ({ page }, testInfo) => {
  await signIn(page, newPerson("Jane", testInfo));
  const started = await startBenvolio(page, newPerson("Rhonda", testInfo));
  await page.goto(`/b/${started.id}`);
  await expect(page.getByText("Rhonda won't see this until they've written theirs.")).toBeVisible();
  // The browser lets spaces through; the server catches them.
  await page.getByLabel(STANCE).fill("   ");
  for (let i = 1; i <= 3; i++) await page.getByLabel(`Reason ${i}`).fill(`Reason number ${i}`);
  await page.getByRole("button", { name: "Send" }).click();
  await expect(formError(page)).toContainText("Please write where you stand");
  await expect(page.getByLabel("Reason 2")).toHaveValue("Reason number 2");
});
