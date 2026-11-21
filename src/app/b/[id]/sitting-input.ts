import { RESPONSE_FIELDS, sittingParts, type ResponseField } from "@/lib/conversation/model";
import { ITEMS_PER_ROUND, type ResponseKind } from "@/lib/conversation/rounds";

/** The sitting form's field names, shared by the form and the action. */
export const FIELD = {
  /** The question the opening was written for, as the page showed it. */
  question: "question",
  stance: "stance",
  write: "write",
  /** A response's value for the partner's item i, by response field. */
  respond: (field: ResponseField, i: number) => `${field}.${i}`,
} as const;

/** What was typed in a sitting's form, before the model checks it. */
export type SittingInput = {
  stance?: string;
  write?: string[];
  respond?: { kind: ResponseKind } & Partial<Record<ResponseField, unknown[]>>;
};

/** How each response field reads one item's value from the form. */
const READ: Record<ResponseField, (form: FormData, name: string) => unknown> = {
  texts: (form, name) => text(form.get(name)),
  tags: (form, name) => form.getAll(name).map(String),
  agree: (form, name) => {
    const mark = form.get(name);
    return mark === "agree" ? true : mark === "disagree" ? false : undefined;
  },
  ranks: (form, name) => {
    const rank = form.get(name);
    return rank ? Number(rank) : undefined;
  },
};

/**
 * Decodes the sitting form into the shape the model's parser checks. Each part
 * is read only in the sittings that have it, so nothing else gets through.
 */
export function sittingInput(sitting: number, form: FormData): SittingInput {
  const parts = sittingParts(sitting);
  const input: SittingInput = {};
  if (parts.stance) input.stance = text(form.get(FIELD.stance));
  if (parts.write) input.write = form.getAll(FIELD.write).map(text);
  if (parts.respond) {
    const { kind } = parts.respond;
    input.respond = { kind };
    for (const field of RESPONSE_FIELDS[kind]) {
      input.respond[field] = Array.from({ length: ITEMS_PER_ROUND }, (_, i) =>
        READ[field](form, FIELD.respond(field, i)),
      );
    }
  }
  return input;
}

/** A field's text, with the CRLF line breaks browsers send counted as one character, as typed. */
export function text(value: FormDataEntryValue | null): string {
  return String(value ?? "").replace(/\r\n?/g, "\n");
}
