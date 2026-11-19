import { expect, test } from "@playwright/test";
import { adminDatabase } from "./support/database";
import { newPerson, signIn, signInHere, startBenvolio } from "./support/people";
import { anotherPhone } from "./support/phones";

const INVITE_GONE = "This invite has expired or was already used.";

test("the partner joins from the invite link and both can see the Benvolio", async ({
  page,
  browser,
}, testInfo) => {
  const jane = newPerson("Jane", testInfo);
  await signIn(page, jane);
  const started = await startBenvolio(page, newPerson("Rhonda", testInfo), "Should we get a dog?");

  // Anyone with the link can join, whatever email they sign in with.
  const rhonda = newPerson("Rhonda", testInfo);
  const rhondasPhone = await anotherPhone(browser, testInfo);
  await rhondasPhone.goto(started.inviteUrl);
  await expect(rhondasPhone.getByRole("heading", { name: "Jane would like to talk with you" })).toBeVisible();
  await expect(rhondasPhone.getByText("Should we get a dog?")).toBeVisible();
  await rhondasPhone.getByRole("link", { name: "Sign in to join" }).click();
  await signInHere(rhondasPhone, rhonda);

  await expect(rhondasPhone).toHaveURL(new URL(started.inviteUrl).pathname);
  await expect(rhondasPhone.getByLabel("The question")).toHaveValue("Should we get a dog?");
  await rhondasPhone.getByRole("button", { name: "Join" }).click();

  await expect(rhondasPhone).toHaveURL(`/b/${started.id}`);
  await expect(rhondasPhone.getByRole("heading", { name: "Should we get a dog?" })).toBeVisible();
  await expect(rhondasPhone.getByText("With Jane")).toBeVisible();
  await expect(rhondasPhone.getByText("Your turn: write your opening.")).toBeVisible();

  await page.goto(`/b/${started.id}`);
  await expect(page.getByText("With Rhonda")).toBeVisible();
  await expect(page.getByText("hasn't accepted your invite yet")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Make a new invite link" })).toHaveCount(0);
  await expect(page.getByText("Your turn: write your opening.")).toBeVisible();

  await rhondasPhone.goto("/");
  await expect(rhondasPhone.getByRole("link", { name: "Should we get a dog?" })).toBeVisible();

  // The link works once.
  const latecomer = await anotherPhone(browser, testInfo);
  await latecomer.goto(started.inviteUrl);
  await expect(latecomer.getByRole("heading", { name: INVITE_GONE })).toBeVisible();
});

test("a partner who rewords the question waits for the initiator to agree", async ({
  page,
  browser,
}, testInfo) => {
  await signIn(page, newPerson("Jane", testInfo));
  const started = await startBenvolio(page, newPerson("Rhonda", testInfo), "Should we get a dog?");

  const rhondasPhone = await anotherPhone(browser, testInfo);
  await rhondasPhone.goto(started.inviteUrl);
  await rhondasPhone.getByRole("link", { name: "Sign in to join" }).click();
  await signInHere(rhondasPhone, newPerson("Rhonda", testInfo));
  await rhondasPhone.getByLabel("The question").fill("Should we get a cat?");
  await rhondasPhone.getByRole("button", { name: "Join" }).click();

  await expect(rhondasPhone.getByText("Waiting for Jane to agree to your wording.")).toBeVisible();
  await page.goto(`/b/${started.id}`);
  await expect(page.getByText("Rhonda suggested new wording: “Should we get a cat?”")).toBeVisible();
});

test("someone already signed in joins straight from the link", async ({ page, browser }, testInfo) => {
  await signIn(page, newPerson("Jane", testInfo));
  const started = await startBenvolio(page, newPerson("Rhonda", testInfo));

  const rhondasPhone = await anotherPhone(browser, testInfo);
  await signIn(rhondasPhone, newPerson("Rhonda", testInfo));
  await rhondasPhone.goto(started.inviteUrl);
  await rhondasPhone.getByRole("button", { name: "Join" }).click();
  await expect(rhondasPhone).toHaveURL(`/b/${started.id}`);
});

test("the initiator opening their own link is told to send it on", async ({ page }, testInfo) => {
  await signIn(page, newPerson("Jane", testInfo));
  const started = await startBenvolio(page, newPerson("Rhonda", testInfo));
  await page.goto(started.inviteUrl);
  await expect(page.getByRole("heading", { name: /^This is your own invite/ })).toBeVisible();
  await expect(page.getByRole("button", { name: "Join" })).toHaveCount(0);
});

test("an expired invite can't be used", async ({ page, browser }, testInfo) => {
  await signIn(page, newPerson("Jane", testInfo));
  const started = await startBenvolio(page, newPerson("Rhonda", testInfo));
  const { error } = await adminDatabase()
    .from("invites")
    .update({ expires_at: new Date(Date.now() - 1000).toISOString() })
    .eq("benvolio_id", started.id);
  expect(error).toBeNull();

  const rhondasPhone = await anotherPhone(browser, testInfo);
  await rhondasPhone.goto(started.inviteUrl);
  await expect(rhondasPhone.getByRole("heading", { name: INVITE_GONE })).toBeVisible();
  await expect(rhondasPhone.getByText("Ask the person who sent it for a new one.")).toBeVisible();
});

test("a made-up invite link explains itself", async ({ page }) => {
  await page.goto("/join/not-a-real-token");
  await expect(page.getByRole("heading", { name: INVITE_GONE })).toBeVisible();
});

test("only the two people in a Benvolio can open it", async ({ page, browser }, testInfo) => {
  await signIn(page, newPerson("Jane", testInfo));
  const started = await startBenvolio(page, newPerson("Rhonda", testInfo));

  const stranger = await anotherPhone(browser, testInfo);
  await signIn(stranger, newPerson("Ben", testInfo));
  await stranger.goto(`/b/${started.id}`);
  await expect(stranger.getByRole("heading", { name: "We couldn't find that page" })).toBeVisible();
  await expect(stranger.getByText(started.question)).toHaveCount(0);
});
