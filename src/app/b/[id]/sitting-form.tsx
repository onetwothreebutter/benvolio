"use client";

import { useActionState } from "react";
import { LAST_SITTING, MAX_ITEM_LENGTH } from "@/lib/conversation/model";
import { ITEMS_PER_ROUND, ROUNDS } from "@/lib/conversation/rounds";
import styles from "../../form.module.css";
import { submitSitting, type SitState } from "./actions";

/** What this person writes in a sitting, sent all at once. */
export function SittingForm({
  benvolioId,
  sitting,
  partnerName,
}: {
  benvolioId: string;
  sitting: number;
  partnerName: string;
}) {
  const [state, action, pending] = useActionState<SitState, FormData>(submitSitting, {});
  // React clears the form after every submit, so errors carry the typed values back.
  const input = state.input;
  const round = sitting < LAST_SITTING ? ROUNDS[sitting] : undefined;

  return (
    <form action={action} className={styles.form}>
      <input type="hidden" name="benvolio_id" value={benvolioId} />
      <input type="hidden" name="sitting" value={sitting} />

      {sitting === 0 && (
        <>
          <label htmlFor="stance" className={styles.label}>
            Where do you stand?
          </label>
          <textarea
            id="stance"
            name="stance"
            rows={3}
            maxLength={MAX_ITEM_LENGTH}
            required
            defaultValue={input?.stance}
            className={styles.input}
          />
          <p className={styles.hint}>Say it in a sentence or two.</p>
        </>
      )}

      {round && (
        <fieldset className={styles.form}>
          <legend className={styles.label}>{round.write.prompt}</legend>
          <p className={styles.hint}>{round.write.help}</p>
          {Array.from({ length: ITEMS_PER_ROUND }, (_, i) => (
            <textarea
              key={i}
              name="write"
              rows={3}
              maxLength={MAX_ITEM_LENGTH}
              required
              aria-label={`${round.write.itemLabel} ${i + 1}`}
              placeholder={`${round.write.itemLabel} ${i + 1}`}
              defaultValue={input?.write?.[i]}
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
