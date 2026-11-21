import { expect, type Page } from "@playwright/test";
import { feelingLabel } from "@/lib/conversation/feelings";
import { sittingParts } from "@/lib/conversation/model";
import { statusLine } from "@/lib/conversation/status";
import { validSitting } from "@/test/sittings";
import { STANCE } from "./screen";

/**
 * Types a sitting on the Benvolio's page, as `who`, using the unit tests'
 * valid submissions, and sends it.
 */
export async function typeSitting(page: Page, benvolioId: string, who: string, sitting: number) {
  const { stance, write, respond } = validSitting(sitting, who);
  const parts = sittingParts(sitting);
  const yourTurn = page.getByText(statusLine({ kind: "sit", sitting }, ""), { exact: true });
  await page.goto(`/b/${benvolioId}`);
  await expect(yourTurn).toBeVisible();
  // What the partner wrote for the round this sitting responds to is on screen.
  const partner = sitting > 0 && validSitting(sitting - 1, who === "initiator" ? "recipient" : "initiator");
  for (const item of (partner && partner.write) || []) await expect(page.getByText(item)).toBeVisible();
  if (stance) await page.getByLabel(STANCE).fill(stance);
  if (respond) {
    const item = (i: number) => `${parts.respond!.itemName} ${i + 1}`;
    for (const [i, text] of ("texts" in respond ? respond.texts : []).entries()) {
      const field = respond.kind === "rephrase" ? `${item(i)} in your words` : `Your answer to .*${item(i)}`;
      await page.getByLabel(new RegExp(field, "i")).fill(text);
    }
    for (const [i, tags] of ("tags" in respond ? respond.tags : []).entries()) {
      const feelings = page.getByRole("group", { name: new RegExp(`${item(i)} make you feel`, "i") });
      for (const tag of tags) {
        await feelings.getByLabel(feelingLabel(tag)).check();
      }
    }
    for (const [i, agree] of ("agree" in respond ? respond.agree : []).entries()) {
      await page
        .getByRole("group", { name: new RegExp(`agree with .*${item(i)}`, "i") })
        .getByLabel(agree ? "Agree" : "Disagree", { exact: true })
        .check();
    }
    for (const [i, rank] of ("ranks" in respond ? respond.ranks : []).entries()) {
      await page.getByLabel(new RegExp(`rank for .*${item(i)}`, "i")).selectOption(String(rank));
    }
  }
  for (const [i, item] of (write ?? []).entries()) {
    await page.getByLabel(`${parts.write!.itemLabel} ${i + 1}`, { exact: true }).fill(item);
  }
  await page.getByRole("button", { name: "Send" }).click();
  await expect(yourTurn).toHaveCount(0);
}
