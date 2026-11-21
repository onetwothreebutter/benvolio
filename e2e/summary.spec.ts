import type { Page } from "@playwright/test";
import { LAST_SITTING, partnerOf, type Role, type Submission } from "@/lib/conversation/model";
import { ROUNDS } from "@/lib/conversation/rounds";
import { validSitting } from "@/test/sittings";
import { adminDatabase } from "./support/database";
import { joinFromInvite, newPerson, signIn, startBenvolio } from "./support/people";
import { typeSitting } from "./support/sittings";
import { expect, test } from "./support/test";

/**
 * The summary both people see once a Benvolio is finished. The fixtures mark
 * points 1 and 3 #agree and 2 not, and rank compromise 2 first, then 1, then 3.
 */

const NAMES: Record<Role, string> = { initiator: "Jane", recipient: "Rhonda" };
/** The sitting in which each person writes the items a kind of response is given to. */
const writtenFor = (kind: string) => ROUNDS.findIndex((r) => r.respond.kind === kind);
const points = (who: Role) => validSitting(writtenFor("agree"), who).write!;
const compromises = (who: Role) => validSitting(writtenFor("rank"), who).write!;
const byRank = (items: readonly string[]) => [items[1], items[0], items[2]];

/** Two people take every turn, typing each sitting; returns each person's phone and the Benvolio's id. */
async function finishBenvolio(page: Page, anotherPhone: () => Promise<Page>, testInfo: Parameters<typeof newPerson>[1]) {
  await signIn(page, newPerson(NAMES.initiator, testInfo));
  const started = await startBenvolio(page, newPerson(NAMES.recipient, testInfo), "Should we get a dog?");
  const rhondasPhone = await anotherPhone();
  await joinFromInvite(rhondasPhone, started.inviteUrl, newPerson(NAMES.recipient, testInfo));
  await expect(rhondasPhone).toHaveURL(`/b/${started.id}`);
  const phones: Record<Role, Page> = { initiator: page, recipient: rhondasPhone };
  for (let sitting = 0; sitting <= LAST_SITTING; sitting++) {
    for (const role of ["initiator", "recipient"] as const) await typeSitting(phones[role], started.id, role, sitting);
  }
  return { phones, id: started.id };
}

/** The text of each paragraph in each listed item of a section. */
async function listed(page: Page, section: string) {
  const items = page.getByRole("region", { name: section }).getByRole("listitem");
  return items.evaluateAll((lis) =>
    lis.map((li) => Array.from(li.querySelectorAll("p"), (p) => p.textContent).filter(Boolean)),
  );
}

test("each person's summary shows what they agree on, their compromises and where they started", async (
  { page, anotherPhone },
  testInfo,
) => {
  test.setTimeout(180_000);
  const { phones, id } = await finishBenvolio(page, anotherPhone, testInfo);

  for (const role of ["initiator", "recipient"] as const) {
    const phone = phones[role];
    const partner = partnerOf(role);
    const name = NAMES[partner];
    await phone.goto(`/b/${id}`);
    await expect(phone.getByText("You've finished this Benvolio.")).toBeVisible();

    expect(await listed(phone, "What you agree on")).toEqual([
      [points(role)[0], `You wrote this. ${name} agreed.`],
      [points(role)[2], `You wrote this. ${name} agreed.`],
      [points(partner)[0], `${name} wrote this. You agreed.`],
      [points(partner)[2], `${name} wrote this. You agreed.`],
    ]);
    expect(await listed(phone, "Still to talk about")).toEqual([
      [points(role)[1], `You wrote this. ${name} didn't agree.`],
      [points(partner)[1], `${name} wrote this. You didn't agree.`],
    ]);
    expect(await listed(phone, "Where you each started")).toEqual([
      [validSitting(0, role).stance, "Your view"],
      [validSitting(0, partner).stance, `${name}'s view`],
    ]);

    const section = phone.getByRole("region", { name: "Compromises" });
    expect(await listed(phone, "Compromises").then((items) => items.slice(0, 2))).toEqual([
      [compromises(partner)[1], `${name}'s idea you liked most`],
      [compromises(role)[1], `Your idea ${name} liked most`],
    ]);
    // Every compromise, best ranked first: theirs as you ranked them, then yours as they did.
    for (const [heading, items] of [
      [`All of ${name}'s, as you ranked them`, compromises(partner)],
      [`All of yours, as ${name} ranked them`, compromises(role)],
    ] as const) {
      const list = section.getByRole("heading", { name: heading }).locator("xpath=following-sibling::ol[1]");
      await expect(list.getByRole("listitem")).toHaveText(byRank(items));
    }
  }

  // The button opens the print dialog, and is left off the printout.
  await page.evaluate(() => {
    window.print = () => document.body.setAttribute("data-printed", "yes");
  });
  const print = page.getByRole("button", { name: "Print or save as PDF" });
  await print.click();
  await expect(page.locator("body")).toHaveAttribute("data-printed", "yes");
  await page.emulateMedia({ media: "print" });
  await expect(print).toBeHidden();
  await expect(page.getByRole("heading", { name: "What you agree on" })).toBeVisible();
});

test("the summary says so when neither person agreed with the other's points", async (
  { page, anotherPhone },
  testInfo,
) => {
  test.setTimeout(180_000);
  const { phones, id } = await finishBenvolio(page, anotherPhone, testInfo);
  // The screens always send the fixtures' marks, so unmark every point here.
  const sitting = writtenFor("agree") + 1;
  const db = adminDatabase();
  const { data, error } = await db.from("submissions").select("role, body").eq("benvolio_id", id).eq("sitting", sitting);
  if (error) throw error;
  for (const { role, body } of data as { role: Role; body: Submission }[]) {
    if (body.respond?.kind !== "agree") throw new Error(`Sitting ${sitting} doesn't respond with agree marks`);
    body.respond.agree = [false, false, false];
    const update = await db.from("submissions").update({ body }).eq("benvolio_id", id).eq("sitting", sitting).eq("role", role);
    if (update.error) throw update.error;
  }

  const phone = phones.recipient;
  await phone.goto(`/b/${id}`);
  const agreed = phone.getByRole("region", { name: "What you agree on" });
  await expect(agreed.getByText("Neither of you agreed with the other's points this time.")).toBeVisible();
  await expect(agreed.getByRole("listitem")).toHaveCount(0);
  expect(await listed(phone, "Still to talk about")).toHaveLength(6);
});
