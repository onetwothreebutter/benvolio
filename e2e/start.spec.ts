import { expect, test } from "@playwright/test";
import { INVITE_GONE, OWN_INVITE } from "@/lib/invites/messages";
import { formError } from "./support/screen";
import { newPerson, signIn, startBenvolio } from "./support/people";

test("starting a Benvolio gives an invite link and a page for it", async ({
  page,
  baseURL,
}, testInfo) => {
  const jane = newPerson("Jane", testInfo);
  const rhonda = newPerson("Rhonda", testInfo);
  await signIn(page, jane);
  await page.getByRole("link", { name: "Start a Benvolio" }).click();

  await page.getByLabel("What would you like to talk about?").fill("Should we move closer to family?");
  await page.getByLabel("Their first name").fill("Rhonda");
  await page.getByLabel("Their email").fill(rhonda.email);
  await page.getByLabel("Every week").check();
  await page.getByRole("button", { name: "Start" }).click();

  await expect(page.getByRole("heading", { name: "Now invite Rhonda" })).toBeVisible();
  await expect(page.getByLabel("Invite link")).toHaveValue(new RegExp(`^${baseURL}/join/\\S+$`));

  await page.getByRole("link", { name: "Go to your Benvolio" }).click();
  await expect(page).toHaveURL(/\/b\/[0-9a-f-]{36}$/);
  await expect(page.getByRole("heading", { name: "Should we move closer to family?" })).toBeVisible();
  await expect(page.getByText("With Rhonda")).toBeVisible();
  await expect(page.getByText("Rhonda hasn't accepted your invite yet.")).toBeVisible();
  await expect(page.getByText("Your turn: write your opening.")).toBeVisible();

  await page.goto("/");
  await page.getByRole("link", { name: "Should we move closer to family?" }).click();
  await expect(page.getByRole("heading", { name: "Should we move closer to family?" })).toBeVisible();
});

test("the start form explains mistakes and keeps what was typed", async ({ page }, testInfo) => {
  const jane = newPerson("Jane", testInfo);
  await signIn(page, jane);
  await page.goto("/start");

  await page.getByLabel("What would you like to talk about?").fill("Should we get a dog?");
  await page.getByLabel("Their first name").fill("Rhonda");
  await page.getByLabel("Their email").fill(jane.email.toUpperCase());
  await page.getByLabel("Every week").check();
  await page.getByRole("button", { name: "Start" }).click();

  await expect(formError(page)).toHaveText(
    "That's your own email. Enter the email of the person you're inviting.",
  );
  await expect(page.getByLabel("What would you like to talk about?")).toHaveValue("Should we get a dog?");
  await expect(page.getByLabel("Their first name")).toHaveValue("Rhonda");
  await expect(page.getByLabel("Their email")).toHaveValue(jane.email.toUpperCase());
  await expect(page.getByLabel("Every week")).toBeChecked();
});

test("a new invite link replaces the old one", async ({ page }, testInfo) => {
  await signIn(page, newPerson("Jane", testInfo));
  const started = await startBenvolio(page, newPerson("Rhonda", testInfo));

  await page.goto(`/b/${started.id}`);
  await page.getByRole("button", { name: "Make a new invite link" }).click();
  const renewed = await page.getByLabel("Invite link").inputValue();
  expect(renewed).toMatch(/\/join\/\S+$/);
  expect(renewed).not.toBe(started.inviteUrl);

  await page.goto(started.inviteUrl);
  await expect(page.getByRole("heading", { name: INVITE_GONE })).toBeVisible();
  await page.goto(renewed);
  // Still Jane's own invite, but alive.
  await expect(page.getByRole("heading", { name: OWN_INVITE })).toBeVisible();
});
