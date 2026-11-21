import { statusLine } from "@/lib/conversation/status";
import { INVITE_GONE, OWN_INVITE } from "@/lib/invites/messages";
import { adminDatabase } from "./support/database";
import { formError } from "./support/screen";
import { newPerson, signIn, startBenvolio } from "./support/people";
import { expect, test } from "./support/test";

test("starting a Benvolio gives an invite link and a page for it", async ({
  page,
  baseURL,
}, testInfo) => {
  const jane = newPerson("Jane", testInfo);
  const rhonda = newPerson("Rhonda", testInfo);
  // Without a share sheet the button copies, as on a desktop browser.
  await page.addInitScript(() => {
    delete (Navigator.prototype as { share?: unknown }).share;
  });
  await signIn(page, jane);
  await page.getByRole("link", { name: "Start a Benvolio" }).click();

  await page.getByLabel("What would you like to talk about?").fill("Should we move closer to family?");
  await page.getByLabel("Their first name").fill("Rhonda");
  await page.getByLabel("Their email").fill(rhonda.email);
  await page.getByLabel("Every week").check();
  await page.getByRole("button", { name: "Start" }).click();

  await expect(page.getByRole("heading", { name: "Now invite Rhonda" })).toBeVisible();
  const inviteUrl = await page.getByLabel("Invite link").inputValue();
  expect(inviteUrl).toMatch(new RegExp(`^${baseURL}/join/\\S+$`));

  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.getByRole("button", { name: "Copy the link" }).click();
  await expect(page.getByRole("button", { name: "Copied" })).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(inviteUrl);

  await page.getByRole("link", { name: "Go to your Benvolio" }).click();
  await expect(page).toHaveURL(/\/b\/[0-9a-f-]{36}$/);
  const id = new URL(page.url()).pathname.split("/")[2];
  const { data } = await adminDatabase().from("benvolios").select("pace").eq("id", id).single();
  expect(data?.pace).toBe("weekly");
  await expect(page.getByRole("heading", { name: "Should we move closer to family?" })).toBeVisible();
  await expect(page.getByText("With Rhonda")).toBeVisible();
  await expect(page.getByText("Rhonda hasn't accepted your invite yet.")).toBeVisible();
  await expect(page.getByText(statusLine({ kind: "sit", sitting: 0 }, ""))).toBeVisible();

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

  // The browser lets these through; the server catches them.
  const mistakes: [string, string, string][] = [
    ["What would you like to talk about?", "   ", "Please write the question you'd like to talk about."],
    ["Their first name", "   ", "Please enter their first name."],
    ["Their email", "rhonda@localhost", "Please enter their email address."],
  ];
  for (const [label, value, message] of mistakes) {
    await page.goto("/start");
    await page.getByLabel("What would you like to talk about?").fill("Should we get a dog?");
    await page.getByLabel("Their first name").fill("Rhonda");
    await page.getByLabel("Their email").fill("rhonda@example.com");
    await page.getByLabel(label).fill(value);
    await page.getByRole("button", { name: "Start" }).click();
    await expect(formError(page)).toHaveText(message);
    await expect(page.getByLabel(label)).toHaveValue(value);
  }
});

test("a new invite link replaces the old one", async ({ page, anotherPhone }, testInfo) => {
  await signIn(page, newPerson("Jane", testInfo));
  const started = await startBenvolio(page, newPerson("Rhonda", testInfo));
  // Rhonda has the old link open, ready to join.
  const rhondasPhone = await anotherPhone();
  await signIn(rhondasPhone, newPerson("Rhonda", testInfo));
  await rhondasPhone.goto(started.inviteUrl);

  await page.goto(`/b/${started.id}`);
  await page.getByRole("button", { name: "Make a new invite link" }).click();
  const renewed = await page.getByLabel("Invite link").inputValue();
  expect(renewed).toMatch(/\/join\/\S+$/);
  expect(renewed).not.toBe(started.inviteUrl);

  await rhondasPhone.getByRole("button", { name: "Join" }).click();
  await expect(formError(rhondasPhone)).toHaveText(INVITE_GONE);
  await page.goto(started.inviteUrl);
  await expect(page.getByRole("heading", { name: INVITE_GONE })).toBeVisible();
  await page.goto(renewed);
  // Still Jane's own invite, but alive.
  await expect(page.getByRole("heading", { name: OWN_INVITE })).toBeVisible();

  // Jane has her page open while Rhonda joins with the new link.
  await page.goto(`/b/${started.id}`);
  await rhondasPhone.goto(renewed);
  await rhondasPhone.getByRole("button", { name: "Join" }).click();
  await expect(rhondasPhone).toHaveURL(`/b/${started.id}`);

  await page.getByRole("button", { name: "Make a new invite link" }).click();
  await expect(formError(page)).toHaveText("There's no invite to renew: they may have joined already.");
  await page.reload();
  await expect(page.getByText("With Rhonda")).toBeVisible();
  await expect(page.getByRole("button", { name: "Make a new invite link" })).toHaveCount(0);
});

test("on a phone, the Share button shares the invite link", async ({ page }, testInfo) => {
  // Stand in a share sheet, as phones have.
  await page.addInitScript(() => {
    navigator.share = async (data) => {
      (window as unknown as { shared: ShareData }).shared = data!;
    };
  });
  await signIn(page, newPerson("Jane", testInfo));
  const started = await startBenvolio(page, newPerson("Rhonda", testInfo));
  await page.getByRole("button", { name: "Share the link" }).click();
  const shared = await page.evaluate(() => (window as unknown as { shared: ShareData }).shared);
  expect(shared.url).toBe(started.inviteUrl);

  // Pace defaults to daily.
  await page.goto("/start");
  await expect(page.getByLabel("Every day")).toBeChecked();
  const { data } = await adminDatabase().from("benvolios").select("pace").eq("id", started.id).single();
  expect(data?.pace).toBe("daily");
});
