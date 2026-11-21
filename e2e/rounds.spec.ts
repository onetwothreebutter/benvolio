import { ROUNDS } from "@/lib/conversation/rounds";
import { statusLine } from "@/lib/conversation/status";
import { validSitting } from "@/test/sittings";
import { joinFromInvite, newPerson, signIn, startBenvolio } from "./support/people";
import { NOT_FOUND } from "./support/screen";
import { typeSitting } from "./support/sittings";
import { expect, test } from "./support/test";

const REASONS = ROUNDS[0].respond;

/**
 * The page with every round so far, from both phones, as a Benvolio gets
 * going: what shows when, and that a partner's writing stays hidden until
 * both people have sent that sitting.
 */
test("every round appears once both have responded, from either phone", async ({ page, anotherPhone }, testInfo) => {
  test.setTimeout(120_000);
  await signIn(page, newPerson("Jane", testInfo));
  const started = await startBenvolio(page, newPerson("Rhonda", testInfo));
  const rhonda = await anotherPhone();
  await joinFromInvite(rhonda, started.inviteUrl, newPerson("Rhonda", testInfo));
  await expect(rhonda).toHaveURL(`/b/${started.id}`);
  const rounds = `/b/${started.id}/rounds`;
  const stances = (phone = page) => phone.getByRole("region", { name: "Where you each stand" });

  // Before both openings are in, there's nothing to show, not even Jane's own stance.
  await typeSitting(page, started.id, "initiator", 0);
  await page.goto(rounds);
  await expect(page.getByText(/^Your stances and each round will appear here/)).toBeVisible();
  await expect(stances()).toHaveCount(0);
  await expect(page.getByText(validSitting(0, "initiator").stance!)).toHaveCount(0);

  // Both openings in: the stances show, labelled, but no round yet.
  await typeSitting(rhonda, started.id, "recipient", 0);
  await page.goto(rounds);
  await expect(stances()).toContainText("You wrote: initiator stance");
  await expect(stances()).toContainText("Rhonda wrote: recipient stance");
  await expect(page.getByText(/^Each round will appear here/)).toBeVisible();

  // Rhonda has rephrased Jane's reasons, but Jane hasn't sent hers: Rhonda's
  // rephrasings stay hidden from Jane on both pages, and Jane's from Rhonda.
  await typeSitting(rhonda, started.id, "recipient", 1);
  const rhondasRephrase = validSitting(1, "recipient").respond!;
  const hidden = "texts" in rhondasRephrase ? rhondasRephrase.texts[0] : "";
  for (const [path, loaded] of [
    [rounds, stances()],
    [`/b/${started.id}`, page.getByText(statusLine({ kind: "sit", sitting: 1 }, "Rhonda"))],
  ] as const) {
    await page.goto(path);
    await expect(loaded).toBeVisible();
    await expect(page.getByText(hidden)).toHaveCount(0);
    await expect(page.getByRole("region", { name: REASONS.seen("Rhonda") })).toHaveCount(0);
  }
  await rhonda.goto(rounds);
  await expect(stances(rhonda)).toBeVisible();
  await expect(rhonda.getByRole("heading", { name: /^Round 1/ })).toHaveCount(0);
  await expect(rhonda.getByRole("link", { name: "See every round" })).toHaveCount(0);

  // Jane sends hers: round 1 shows on both phones, each from their own side.
  await typeSitting(page, started.id, "initiator", 1);
  const sides = [
    { phone: page, partner: "Rhonda", theirs: "recipient", mine: "initiator" },
    { phone: rhonda, partner: "Jane", theirs: "initiator", mine: "recipient" },
  ] as const;
  for (const { phone, partner, theirs, mine } of sides) {
    await phone.goto(`/b/${started.id}`);
    await phone.getByRole("link", { name: "See every round" }).click();
    await expect(phone).toHaveURL(rounds);
    await expect(phone.getByRole("heading", { name: `Round 1 of ${ROUNDS.length}: Reasons` })).toBeVisible();
    await expect(phone.getByRole("heading", { name: /^Round 2/ })).toHaveCount(0);
    const yours = phone.getByRole("region", { name: REASONS.seen(partner) });
    await expect(yours).toContainText(`You wrote: ${mine} Reason 1`);
    await expect(yours).toContainText(`${partner} wrote: ${theirs} rephrase 1`);
    const given = phone.getByRole("region", { name: REASONS.given(partner) });
    await expect(given).toContainText(`${partner} wrote: ${theirs} Reason 1`);
    await expect(given).toContainText(`You wrote: ${mine} rephrase 1`);
  }
});

test("only the two people in a Benvolio can open its rounds", async ({ page, anotherPhone }, testInfo) => {
  await signIn(page, newPerson("Jane", testInfo));
  const started = await startBenvolio(page, newPerson("Rhonda", testInfo));
  const rounds = `/b/${started.id}/rounds`;

  const stranger = await anotherPhone();
  await signIn(stranger, newPerson("Sam", testInfo));
  const response = await stranger.goto(rounds);
  expect(response?.status()).toBe(404);
  await expect(stranger.getByRole("heading", { name: NOT_FOUND })).toBeVisible();

  const signedOut = await anotherPhone();
  await signedOut.goto(rounds);
  await expect(signedOut).toHaveURL((url) => url.pathname === "/sign-in" && url.searchParams.get("next") === rounds);
});
