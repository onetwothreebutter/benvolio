import { sittingParts } from "@/lib/conversation/model";

/** The sitting form's field names, shared by the form and the action. */
export const FIELD = {
  /** The question the opening was written for, as the page showed it. */
  question: "question",
  stance: "stance",
  write: "write",
} as const;

/** What was typed in a sitting's form, before the model checks it. */
export type SittingInput = { stance?: string; write?: string[] };

/**
 * Decodes the sitting form into the shape the model's parser checks. Each part
 * is read only in the sittings that have it, so nothing else gets through.
 */
export function sittingInput(sitting: number, form: FormData): SittingInput {
  const parts = sittingParts(sitting);
  const input: SittingInput = {};
  if (parts.stance) input.stance = text(form.get(FIELD.stance));
  if (parts.write) input.write = form.getAll(FIELD.write).map(text);
  return input;
}

/** A field's text, with the CRLF line breaks browsers send counted as one character, as typed. */
function text(value: FormDataEntryValue | null): string {
  return String(value ?? "").replace(/\r\n/g, "\n");
}
