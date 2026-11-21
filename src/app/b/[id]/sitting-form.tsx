"use client";

import { useActionState } from "react";
import { MAX_ITEM_LENGTH, sittingParts } from "@/lib/conversation/model";
import { ITEMS_PER_ROUND } from "@/lib/conversation/rounds";
import styles from "../../form.module.css";
import { submitSitting, type SitState } from "./actions";
import { FIELD } from "./sitting-input";

/** What this person writes in a sitting, sent all at once. */
export function SittingForm({
  benvolioId,
  sitting,
  partnerName,
  question,
}: {
  benvolioId: string;
  sitting: number;
  partnerName: string;
  /** The question as this page shows it. */
  question: string;
}) {
  const [state, action, pending] = useActionState<SitState, FormData>(submitSitting, {});
  const { stance, write } = sittingParts(sitting);
  // React clears the form after every submit, so errors carry the typed values back.
  const typed = state.input;

  return (
    <form action={action} className={styles.form}>
      <input type="hidden" name="benvolio_id" value={benvolioId} />
      <input type="hidden" name="sitting" value={sitting} />
      <input type="hidden" name={FIELD.question} value={state.question ?? question} />

      {stance && (
        <>
          <label htmlFor="stance" className={styles.label}>
            Where do you stand?
          </label>
          <textarea
            id="stance"
            name={FIELD.stance}
            rows={3}
            maxLength={MAX_ITEM_LENGTH}
            required
            defaultValue={typed?.stance}
            className={styles.input}
          />
          <p className={styles.hint}>Say it in a sentence or two.</p>
        </>
      )}

      {write && (
        <fieldset className={styles.form}>
          <legend className={styles.label}>{write.prompt}</legend>
          <p className={styles.hint}>{write.help}</p>
          {Array.from({ length: ITEMS_PER_ROUND }, (_, i) => (
            <textarea
              key={i}
              name={FIELD.write}
              rows={3}
              maxLength={MAX_ITEM_LENGTH}
              required
              aria-label={`${write.itemLabel} ${i + 1}`}
              placeholder={`${write.itemLabel} ${i + 1}`}
              defaultValue={typed?.write?.[i]}
              className={styles.input}
            />
          ))}
        </fieldset>
      )}

      {state.error && (
        <p role="alert" className={styles.error}>
          {state.error}
        </p>
      )}
      <button type="submit" disabled={pending} className={styles.button}>
        Send
      </button>
      <p className={styles.hint}>
        {partnerName} won&apos;t see this until they&apos;ve written theirs.
      </p>
    </form>
  );
}
