import { expect, type Page, type TestInfo } from "@playwright/test";
import { takeSignInEmail } from "./mail";

export type TestPerson = { email: string; firstName: string };

/**
 * A new person with an address no other test uses, so tests can run in
 * parallel against one database without clearing it.
 */
export function newPerson(firstName: string, testInfo: TestInfo): TestPerson {
  const unique = `${testInfo.workerIndex}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  return { email: `${firstName.toLowerCase()}-${unique}@example.com`, firstName };
}

/** Asks for a sign-in email from the sign-in form, and returns its code and link. */
export async function askForCode(page: Page, email: string) {
  await page.getByLabel("Your email").fill(email);
  await page.getByRole("button", { name: "Email me a code" }).click();
  return takeSignInEmail(email);
}

/** Types a code into the sign-in form's second step. */
export async function enterCode(page: Page, email: string, code: string) {
  await page.getByLabel(`The code we sent to ${email}`).fill(code);
  await page.getByRole("button", { name: "Sign in" }).click();
}

/**
 * Signs in with an emailed code from the sign-in form the page is showing, and
 * gives a first name if the app asks for one (new people only).
 */
export async function signInHere(page: Page, person: TestPerson) {
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
  const { code } = await askForCode(page, person.email);
  await enterCode(page, person.email, code);
  // New people are asked their name; everyone else passes /welcome by.
  const nameField = page.getByLabel("Your first name");
  const signedIn = (url: URL) => !["/sign-in", "/welcome"].includes(url.pathname);
  await expect
    .poll(async () => signedIn(new URL(page.url())) || (await nameField.isVisible()))
    .toBe(true);
  if (await nameField.isVisible()) {
    await nameField.fill(person.firstName);
    await page.getByRole("button", { name: "Continue" }).click();
    await page.waitForURL(signedIn);
  }
}

/** Signs in from the sign-in page, ending wherever the app sends them. */
export async function signIn(page: Page, person: TestPerson) {
  await page.goto("/sign-in");
  await signInHere(page, person);
}

export type Started = { id: string; inviteUrl: string; question: string };

/** Starts a Benvolio from the start form; the person must be signed in. */
export async function startBenvolio(
  page: Page,
  partner: TestPerson,
  question = "Should we get a dog?",
): Promise<Started> {
  await page.goto("/start");
  await page.getByLabel("What would you like to talk about?").fill(question);
  await page.getByLabel("Their first name").fill(partner.firstName);
  await page.getByLabel("Their email").fill(partner.email);
  await page.getByRole("button", { name: "Start" }).click();
  await expect(page.getByRole("heading", { name: `Now invite ${partner.firstName}` })).toBeVisible();
  const inviteUrl = await page.getByLabel("Invite link").inputValue();
  const href = await page.getByRole("link", { name: "Go to your Benvolio" }).getAttribute("href");
  const id = href!.replace("/b/", "");
  return { id, inviteUrl, question };
}

/**
 * Joins from an invite link as someone signed out, signing in on the way,
 * optionally suggesting new wording for the question.
 */
export async function joinFromInvite(
  page: Page,
  inviteUrl: string,
  person: TestPerson,
  rewording?: string,
) {
  await page.goto(inviteUrl);
  await page.getByRole("link", { name: "Sign in to join" }).click();
  await signInHere(page, person);
  if (rewording) await page.getByLabel("The question").fill(rewording);
  await page.getByRole("button", { name: "Join" }).click();
}
