import { expect, type Page } from "@playwright/test";
import { FEELINGS } from "@/lib/conversation/feelings";
import { sittingParts, type Role } from "@/lib/conversation/model";
import { statusLine } from "@/lib/conversation/status";
import { validSitting } from "@/test/sittings";
import { adminDatabase } from "./database";
import { STANCE } from "./screen";

/**
 * Stands in for the screens for responding, which aren't built yet: records
 * what a person writes in a sitting straight into the database, using the
 * unit tests' valid submissions. When the screens exist, type into them instead.
 */
export async function writeSitting(benvolioId: string, role: Role, sitting: number) {
  const { error } = await adminDatabase()
    .from("submissions")
    .insert({ benvolio_id: benvolioId, sitting, role, body: validSitting(sitting, role) });
  if (error) throw new Error(`Writing sitting ${sitting} failed: ${error.message}`);
}

/**
 * Types a sitting on the Benvolio's page, as `who`, using the unit tests'
 * valid submissions, and sends it.
 */
export async function typeSitting(page: Page, benvolioId: string, who: string, sitting: number) {
  const { stance, write, respond } = validSitting(sitting, who);
  const parts = sittingParts(sitting);
  await page.goto(`/b/${benvolioId}`);
  if (stance) await page.getByLabel(STANCE).fill(stance);
  if (respond && parts.respond) {
    const label = parts.respond.itemLabel.toLowerCase();
    for (let i = 0; i < 3; i++) {
      const n = `${label} ${i + 1}`;
      if ("texts" in respond) {
        const field = respond.kind === "rephrase" ? `${n} in your words` : `Your answer to .*${n}`;
        await page.getByLabel(new RegExp(field, "i")).fill(respond.texts[i]);
      }
      if ("tags" in respond) {
        const feelings = page.getByRole("group", { name: new RegExp(`${n} make you feel`, "i") });
        for (const tag of respond.tags[i]) {
          await feelings.getByLabel(FEELINGS.find((f) => f.slug === tag)!.label).check();
        }
      }
    }
  }
  if (write && parts.write) {
    for (const [i, item] of write.entries()) {
      await page.getByLabel(`${parts.write.itemLabel} ${i + 1}`, { exact: true }).fill(item);
    }
  }
  await page.getByRole("button", { name: "Send" }).click();
  // Sent once the page no longer says it's this sitting's turn.
  await expect(page.getByText(statusLine({ kind: "sit", sitting }, ""), { exact: true })).toHaveCount(0);
}
