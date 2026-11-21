import { expect, type Page } from "@playwright/test";
import type { Role } from "@/lib/conversation/model";
import { ROUNDS } from "@/lib/conversation/rounds";
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

/** Types an opening on the Benvolio's page, as `who`, and sends it. */
export async function writeOpening(page: Page, benvolioId: string, who: string) {
  const { stance, write } = validSitting(0, who);
  await page.goto(`/b/${benvolioId}`);
  await page.getByLabel(STANCE).fill(stance!);
  const { itemLabel } = ROUNDS[0].write;
  for (const [i, item] of write!.entries()) {
    await page.getByLabel(`${itemLabel} ${i + 1}`).fill(item);
  }
  await page.getByRole("button", { name: "Send" }).click();
  // Sent once the page reloads without the form.
  await expect(page.getByLabel(STANCE)).toHaveCount(0);
}
