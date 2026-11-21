import { LAST_SITTING } from "./model";

/** What was typed in a sitting's form, before parseSubmission checks it. */
export type SittingInput = { stance?: string; write?: string[] };

/**
 * Reads a sitting's form fields into the shape parseSubmission checks. Each
 * part is read only in the sittings that have it, so nothing else gets through.
 */
export function sittingInput(sitting: number, form: FormData): SittingInput {
  const input: SittingInput = {};
  if (sitting === 0) input.stance = String(form.get("stance") ?? "");
  if (sitting < LAST_SITTING) input.write = form.getAll("write").map(String);
  return input;
}
