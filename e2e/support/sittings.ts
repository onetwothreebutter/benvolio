import type { Role } from "@/lib/conversation/model";
import { validSitting } from "@/test/sittings";
import { adminDatabase } from "./database";

/**
 * Stands in for the writing screens, which aren't built yet: records what a
 * person writes in a sitting straight into the database, using the unit
 * tests' valid submissions. When the screens exist, type into them instead.
 */
export async function writeSitting(benvolioId: string, role: Role, sitting: number) {
  const { error } = await adminDatabase()
    .from("submissions")
    .insert({ benvolio_id: benvolioId, sitting, role, body: validSitting(sitting, role) });
  if (error) throw new Error(`Writing sitting ${sitting} failed: ${error.message}`);
}

