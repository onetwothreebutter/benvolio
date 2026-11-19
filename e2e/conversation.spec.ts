import type { Page } from "@playwright/test";
import { LAST_SITTING, partnerOf, type NextAction, type Role } from "@/lib/conversation/model";
import { statusLine } from "@/lib/conversation/status";
import { joinFromInvite, newPerson, signIn, startBenvolio } from "./support/people";
import { acceptProposedQuestion, writeSitting } from "./support/sittings";
import { expect, test } from "./support/test";

/**
 * A whole Benvolio, from the invite to the finish, checking what each person's
 * page tells them at every turn. The writing itself goes straight into the
 * database (see support/sittings.ts) until the writing screens exist.
 */
test("two people take turns through a whole Benvolio", async ({ page, anotherPhone }, testInfo) => {
  test.setTimeout(180_000);
  await signIn(page, newPerson("Jane", testInfo));
  const started = await startBenvolio(page, newPerson("Rhonda", testInfo), "Should we get a dog?");

  // Jane writes her opening before Rhonda suggests new wording.
  await writeSitting(started.id, "initiator", 0);
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
  await acceptProposedQuestion(started.id);
  await expectNext(both({ kind: "sit", sitting: 0 }));
  for (const phone of Object.values(phones)) {
    await expect(phone.getByRole("heading", { name: "Should we get a dog this year?" })).toBeVisible();
  }

  for (let sitting = 0; sitting <= LAST_SITTING; sitting++) {
    // Take turns going first, so each person waits on the other.
    const first: Role = sitting % 2 === 0 ? "initiator" : "recipient";
    const second = partnerOf(first);
    await test.step(`sitting ${sitting + 1} of ${LAST_SITTING + 1}`, async () => {
      await writeSitting(started.id, first, sitting);
      await expectNext({
        [first]: { kind: "wait", sitting },
        [second]: { kind: "sit", sitting },
      });

      await writeSitting(started.id, second, sitting);
      await expectNext(
        both(sitting === LAST_SITTING ? { kind: "finished" } : { kind: "sit", sitting: sitting + 1 }),
      );
    });
  }
});
