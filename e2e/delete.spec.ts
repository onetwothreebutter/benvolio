import { INVITE_GONE } from "@/lib/invites/messages";
import { joinFromInvite, newPerson, signIn, startBenvolio } from "./support/people";
import { NOT_FOUND } from "./support/screen";
import { typeSitting } from "./support/sittings";
import { expect, test } from "./support/test";

test("either person can delete a Benvolio, for both of them", async ({ page, anotherPhone }, testInfo) => {
  await signIn(page, newPerson("Jane", testInfo));
  const started = await startBenvolio(page, newPerson("Rhonda", testInfo));
  const rhondasPhone = await anotherPhone();
  await joinFromInvite(rhondasPhone, started.inviteUrl, newPerson("Rhonda", testInfo));
  await typeSitting(page, started.id, "initiator", 0);

  // The partner who didn't start it can delete it too.
  await rhondasPhone.goto(`/b/${started.id}`);
  await rhondasPhone.getByRole("button", { name: "Delete this Benvolio" }).click();
  await expect(rhondasPhone.getByText("This deletes it for you and Jane")).toBeVisible();
  await rhondasPhone.getByRole("button", { name: "Delete it" }).click();
  await expect(rhondasPhone).toHaveURL("/");
  await expect(rhondasPhone.getByRole("link", { name: started.question })).toHaveCount(0);

  // It's gone for Jane too.
  await page.goto("/");
  await expect(page.getByRole("link", { name: "Start a Benvolio" })).toBeVisible();
  await expect(page.getByRole("link", { name: started.question })).toHaveCount(0);
  const response = await page.goto(`/b/${started.id}`);
  expect(response?.status()).toBe(404);
  await expect(page.getByRole("heading", { name: NOT_FOUND })).toBeVisible();
});

test("deleting before the partner joins stops the invite working", async ({ page, anotherPhone }, testInfo) => {
  await signIn(page, newPerson("Jane", testInfo));
  const started = await startBenvolio(page, newPerson("Rhonda", testInfo));
  await page.goto(`/b/${started.id}`);
  await page.getByRole("button", { name: "Delete this Benvolio" }).click();
  await expect(page.getByText("your invite to Rhonda stops working")).toBeVisible();
  await page.getByRole("button", { name: "Delete it" }).click();
  await expect(page).toHaveURL("/");

  const rhondasPhone = await anotherPhone();
  await rhondasPhone.goto(started.inviteUrl);
  await expect(rhondasPhone.getByRole("heading", { name: INVITE_GONE })).toBeVisible();
});
