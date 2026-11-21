import { sittingParts } from "@/lib/conversation/model";
import { ITEMS_PER_ROUND, type ResponseKind } from "@/lib/conversation/rounds";

/** The sitting form's field names, shared by the form and the action. */
export const FIELD = {
  /** The question the opening was written for, as the page showed it. */
  question: "question",
  stance: "stance",
  write: "write",
  /** A text for each of the partner's items, in order. */
  respond: "respond",
  /** The feelings tagged on the partner's item i. */
  feelings: (i: number) => `feelings.${i}`,
} as const;

/** What was typed in a sitting's form, before the model checks it. */
export type SittingInput = {
  stance?: string;
  write?: string[];
  respond?: { kind: ResponseKind; texts?: string[]; tags?: string[][] };
};

const each = <T>(read: (i: number) => T): T[] => Array.from({ length: ITEMS_PER_ROUND }, (_, i) => read(i));

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
    const texts = () => form.getAll(FIELD.respond).map(text);
    const tags = () => each((i) => form.getAll(FIELD.feelings(i)).map(String));
    switch (kind) {
      case "rephrase":
        input.respond = { kind, texts: texts() };
        break;
      case "answer":
        input.respond = { kind, texts: texts(), tags: tags() };
        break;
      default:
        // Reacting, agreeing and ranking come in the next change.
        input.respond = { kind };
    }
  }
  return input;
}

/** A field's text, with the CRLF line breaks browsers send counted as one character, as typed. */
export function text(value: FormDataEntryValue | null): string {
  return String(value ?? "").replace(/\r\n?/g, "\n");
}
