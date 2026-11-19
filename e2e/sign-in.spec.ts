import { formError } from "./support/screen";
import { askForCode, enterCode, newPerson, signIn, signInHere } from "./support/people";
import { expect, test } from "./support/test";

test("a new person signs in with a code, gives their name, and can sign out", async ({
  page,
}, testInfo) => {
  const jane = newPerson("Jane", testInfo);
  await page.goto("/");
  await page.getByRole("link", { name: "Sign in" }).click();

  const { code } = await askForCode(page, jane.email);
  await enterCode(page, jane.email, code);

  await expect(page.getByRole("heading", { name: "Welcome to Benvolio" })).toBeVisible();
  await page.getByLabel("Your first name").fill(jane.firstName);
  await page.getByRole("button", { name: "Continue" }).click();

  await expect(page).toHaveURL("/");
  await expect(page.getByText("Signed in as Jane.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Start a Benvolio" })).toBeVisible();

  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page.getByRole("link", { name: "Sign in" })).toBeVisible();
  await expect(page.getByText("Signed in as")).toHaveCount(0);
});

test("someone who has signed in before skips the name question", async ({ page }, testInfo) => {
  const jane = newPerson("Jane", testInfo);
  await signIn(page, jane);
  await page.getByRole("button", { name: "Sign out" }).click();

  // Supabase refuses a second email to one address within max_frequency
  // (1s in supabase/config.toml; 60s in production).
  await page.waitForTimeout(1_100);
  await page.goto("/sign-in");
  const { code } = await askForCode(page, jane.email);
  await enterCode(page, jane.email, code);

  await expect(page).toHaveURL("/");
  await expect(page.getByText("Signed in as Jane.")).toBeVisible();
});

test("the emailed link signs in after a tap, and only once", async ({ page }, testInfo) => {
  const jane = newPerson("Jane", testInfo);
  await page.goto("/sign-in");
  const { link } = await askForCode(page, jane.email);

  // Opening the link alone doesn't sign in, so email scanners can't use it up.
  await page.goto(link);
  await expect(page.getByRole("heading", { name: "Sign in to Benvolio" })).toBeVisible();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("heading", { name: "Welcome to Benvolio" })).toBeVisible();
  await page.getByLabel("Your first name").fill(jane.firstName);
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByText("Signed in as Jane.")).toBeVisible();

  await page.getByRole("button", { name: "Sign out" }).click();
  await page.goto(link);
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page).toHaveURL(/\/sign-in\?.*error=link/);
  await expect(formError(page)).toContainText("expired or was already used");
});

test("a wrong code is refused, and a different email can be used", async ({ page }, testInfo) => {
  const typo = newPerson("Jane", testInfo);
  await page.goto("/sign-in");
  const { code } = await askForCode(page, typo.email);
  await enterCode(page, typo.email, "abc");
  await expect(formError(page)).toHaveText("Enter the code from the email.");
  await enterCode(page, typo.email, code === "000000" ? "111111" : "000000");
  await expect(formError(page)).toHaveText("That code didn't work. It may have expired.");

  await page.getByRole("button", { name: "Use a different email" }).click();
  const jane = newPerson("Jane", testInfo);
  await signInHere(page, jane);
  await expect(page.getByText("Signed in as Jane.")).toBeVisible();
});

test("a blank name is refused", async ({ page }, testInfo) => {
  const jane = newPerson("Jane", testInfo);
  await page.goto("/sign-in");
  const { code } = await askForCode(page, jane.email);
  await enterCode(page, jane.email, code);
  // The browser lets spaces through; the server doesn't.
  await page.getByLabel("Your first name").fill("   ");
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(formError(page)).toHaveText("Please enter your first name.");
});

test("an address without a domain is refused before any email is sent", async ({ page }) => {
  await page.goto("/sign-in");
  // The browser accepts this; the server doesn't.
  await page.getByLabel("Your email").fill("jane@localhost");
  await page.getByRole("button", { name: "Email me a code" }).click();
  await expect(formError(page)).toHaveText("That doesn't look like an email address.");
});

test("signing in returns to the page that asked for it", async ({ page }, testInfo) => {
  await page.goto("/start");
  await expect(page).toHaveURL(/\/sign-in\?next=%2Fstart/);
  await signInHere(page, newPerson("Jane", testInfo));
  await expect(page).toHaveURL("/start");
  await expect(page.getByRole("heading", { name: "Start a Benvolio" })).toBeVisible();
});

test("signing out on one phone leaves the others signed in", async ({
  page,
  anotherPhone,
}, testInfo) => {
  const jane = newPerson("Jane", testInfo);
  await signIn(page, jane);
  const janesTablet = await anotherPhone();
  // Supabase refuses a second email to one address within max_frequency.
  await janesTablet.waitForTimeout(1_100);
  await signIn(janesTablet, jane);

  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page.getByRole("link", { name: "Sign in" })).toBeVisible();
  await janesTablet.reload();
  await expect(janesTablet.getByText("Signed in as Jane.")).toBeVisible();
});
