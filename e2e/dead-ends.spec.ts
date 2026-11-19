import { expect, test } from "@playwright/test";
import { newPerson, signIn, signInHere } from "./support/people";

const NOT_FOUND = "We couldn't find that page";

test("the home page invites people to sign in", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Benvolio" })).toBeVisible();
  await expect(page.getByText("Talk. Listen. Learn.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Sign in" })).toBeVisible();
});

test("an unknown address shows the not-found page with a way home", async ({ page }) => {
  const response = await page.goto("/no-such-page");
  expect(response?.status()).toBe(404);
  await expect(page.getByRole("heading", { name: NOT_FOUND })).toBeVisible();
  await page.getByRole("link", { name: "Go to the home page" }).click();
  await expect(page).toHaveURL("/");
});

test("pages that need an account send signed-out people to sign in", async ({ page }) => {
  for (const path of ["/start", "/welcome", "/b/00000000-0000-0000-0000-000000000000"]) {
    await page.goto(path);
    await expect(page).toHaveURL((url) => {
      return url.pathname === "/sign-in" && url.searchParams.get("next")?.startsWith(path) === true;
    });
  }
});

test("a Benvolio that doesn't exist is not found", async ({ page }, testInfo) => {
  await signIn(page, newPerson("Jane", testInfo));
  for (const id of ["00000000-0000-0000-0000-000000000000", "not-an-id"]) {
    await page.goto(`/b/${id}`);
    await expect(page.getByRole("heading", { name: NOT_FOUND })).toBeVisible();
  }
});

test("a broken sign-in link sends people back to ask for a code", async ({ page }) => {
  await page.goto("/auth/confirm?token_hash=nonsense");
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText("expired or was already used");
  await expect(page.getByLabel("Your email")).toBeVisible();
});

test("an address outside the site is never used as a sign-in destination", async ({
  page,
}, testInfo) => {
  await page.goto("/sign-in?next=https://example.org/phish");
  await signInHere(page, newPerson("Jane", testInfo));
  await expect(page).toHaveURL("/");
});

