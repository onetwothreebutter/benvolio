import { expect, test } from "./support/test";
import { statusLine } from "@/lib/conversation/status";
import { INVITE_GONE, OWN_INVITE } from "@/lib/invites/messages";
import { adminDatabase } from "./support/database";
import { NOT_FOUND } from "./support/screen";
import {
  askForCode,
  enterCode,
  joinFromInvite,
  newPerson,
  signIn,
  signInHere,
  startBenvolio,
} from "./support/people";

test("the partner joins from the invite link and both can see the Benvolio", async ({
  page,
  anotherPhone,
}, testInfo) => {
  const jane = newPerson("Jane", testInfo);
  await signIn(page, jane);
  const started = await startBenvolio(page, newPerson("Rhonda", testInfo), "Should we get a dog?");

  // Anyone with the link can join, whatever email they sign in with.
  const rhonda = newPerson("Rhonda", testInfo);
  const rhondasPhone = await anotherPhone();
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
  await expect(rhondasPhone.getByText(statusLine({ kind: "sit", sitting: 0 }, ""))).toBeVisible();

  await page.goto(`/b/${started.id}`);
  await expect(page.getByText("With Rhonda")).toBeVisible();
  await expect(page.getByText("hasn't accepted your invite yet")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Make a new invite link" })).toHaveCount(0);
  await expect(page.getByText(statusLine({ kind: "sit", sitting: 0 }, ""))).toBeVisible();

  await rhondasPhone.goto("/");
  await expect(rhondasPhone.getByRole("link", { name: "Should we get a dog?" })).toBeVisible();

  // The link works once.
  const latecomer = await anotherPhone();
  await latecomer.goto(started.inviteUrl);
  await expect(latecomer.getByRole("heading", { name: INVITE_GONE })).toBeVisible();
});

test("someone already signed in joins straight from the link", async ({ page, anotherPhone }, testInfo) => {
  await signIn(page, newPerson("Jane", testInfo));
  const started = await startBenvolio(page, newPerson("Rhonda", testInfo));

  const rhondasPhone = await anotherPhone();
  await signIn(rhondasPhone, newPerson("Rhonda", testInfo));
  await rhondasPhone.goto(started.inviteUrl);
  await rhondasPhone.getByRole("button", { name: "Join" }).click();
  await expect(rhondasPhone).toHaveURL(`/b/${started.id}`);
});

test("tapping the emailed link from an invite comes back to the invite", async ({
  page,
  anotherPhone,
}, testInfo) => {
  await signIn(page, newPerson("Jane", testInfo));
  const started = await startBenvolio(page, newPerson("Rhonda", testInfo));

  const rhonda = newPerson("Rhonda", testInfo);
  const rhondasPhone = await anotherPhone();
  await rhondasPhone.goto(started.inviteUrl);
  await rhondasPhone.getByRole("link", { name: "Sign in to join" }).click();
  const { link } = await askForCode(rhondasPhone, rhonda.email);
  await rhondasPhone.goto(link);
  await rhondasPhone.getByRole("button", { name: "Continue" }).click();
  await rhondasPhone.getByLabel("Your first name").fill(rhonda.firstName);
  await rhondasPhone.getByRole("button", { name: "Continue" }).click();

  await expect(rhondasPhone).toHaveURL(new URL(started.inviteUrl).pathname);
  await expect(rhondasPhone.getByRole("button", { name: "Join" })).toBeVisible();
});

test("someone who stopped at the name step is asked for it before joining", async ({
  page,
  anotherPhone,
}, testInfo) => {
  await signIn(page, newPerson("Jane", testInfo));
  const started = await startBenvolio(page, newPerson("Rhonda", testInfo));
  const invitePath = new URL(started.inviteUrl).pathname;

  const rhonda = newPerson("Rhonda", testInfo);
  const rhondasPhone = await anotherPhone();
  await rhondasPhone.goto("/sign-in");
  const { code } = await askForCode(rhondasPhone, rhonda.email);
  await enterCode(rhondasPhone, rhonda.email, code);
  await expect(rhondasPhone.getByRole("heading", { name: "Welcome to Benvolio" })).toBeVisible();

  // Rhonda leaves without giving her name.
  await rhondasPhone.goto("/");
  await expect(rhondasPhone.getByText("Signed in.", { exact: true })).toBeVisible();
  for (const path of ["/start", `/b/${started.id}`]) {
    await rhondasPhone.goto(path);
    await expect(rhondasPhone).toHaveURL(`/welcome?next=${encodeURIComponent(path)}`);
  }

  await rhondasPhone.goto(started.inviteUrl);
  await expect(rhondasPhone).toHaveURL(`/welcome?next=${encodeURIComponent(invitePath)}`);
  await rhondasPhone.getByLabel("Your first name").fill(rhonda.firstName);
  await rhondasPhone.getByRole("button", { name: "Continue" }).click();
  await expect(rhondasPhone).toHaveURL(invitePath);
  await rhondasPhone.getByRole("button", { name: "Join" }).click();
  await expect(rhondasPhone).toHaveURL(`/b/${started.id}`);
});

test("the initiator opening their own link is told to send it on", async ({ page }, testInfo) => {
  await signIn(page, newPerson("Jane", testInfo));
  const started = await startBenvolio(page, newPerson("Rhonda", testInfo));
  await page.goto(started.inviteUrl);
  await expect(page.getByRole("heading", { name: OWN_INVITE })).toBeVisible();
  await expect(page.getByRole("button", { name: "Join" })).toHaveCount(0);
});

test("an expired invite can't be used, but a new one can", async ({ page, anotherPhone }, testInfo) => {
  await signIn(page, newPerson("Jane", testInfo));
  const started = await startBenvolio(page, newPerson("Rhonda", testInfo));
  const { error } = await adminDatabase()
    .from("invites")
    .update({ expires_at: new Date(Date.now() - 1000).toISOString() })
    .eq("benvolio_id", started.id);
  expect(error).toBeNull();

  const rhondasPhone = await anotherPhone();
  await rhondasPhone.goto(started.inviteUrl);
  await expect(rhondasPhone.getByRole("heading", { name: INVITE_GONE })).toBeVisible();
  await expect(rhondasPhone.getByText("Ask the person who sent it for a new one.")).toBeVisible();

  // Jane makes a new link, which works.
  await page.goto(`/b/${started.id}`);
  await page.getByRole("button", { name: "Make a new invite link" }).click();
  const renewed = await page.getByLabel("Invite link").inputValue();
  await joinFromInvite(rhondasPhone, renewed, newPerson("Rhonda", testInfo));
  await expect(rhondasPhone).toHaveURL(`/b/${started.id}`);
});

test("a made-up invite link explains itself", async ({ page }) => {
  await page.goto("/join/not-a-real-token");
  await expect(page.getByRole("heading", { name: INVITE_GONE })).toBeVisible();
});

test("only the two people in a Benvolio can open it", async ({ page, anotherPhone }, testInfo) => {
  await signIn(page, newPerson("Jane", testInfo));
  const started = await startBenvolio(page, newPerson("Rhonda", testInfo));

  const stranger = await anotherPhone();
  await signIn(stranger, newPerson("Ben", testInfo));
  await stranger.goto(`/b/${started.id}`);
  await expect(stranger.getByRole("heading", { name: NOT_FOUND })).toBeVisible();
  await expect(stranger.getByText(started.question)).toHaveCount(0);
});
