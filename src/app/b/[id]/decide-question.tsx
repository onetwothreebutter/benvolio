"use client";

import { useActionState } from "react";
import styles from "../../form.module.css";
import { decideQuestion, type DecideState } from "./actions";

/** The initiator's choice between the partner's new wording and their own. */
export function DecideQuestion({
  benvolioId,
  proposed,
  openingWritten,
}: {
  benvolioId: string;
  proposed: string;
  openingWritten: boolean;
}) {
  const [state, action, pending] = useActionState<DecideState, FormData>(decideQuestion, {});
  return (
    <form action={action} className={styles.form}>
      <input type="hidden" name="benvolio_id" value={benvolioId} />
      <blockquote className={styles.quote}>{proposed}</blockquote>
      {openingWritten && (
        <p className={styles.hint}>
          If you use the new wording, you&apos;ll write your opening again so it answers it.
        </p>
      )}
      {state.error && (
        <p role="alert" className={styles.error}>
          {state.error}
        </p>
      )}
      <button type="submit" name="accept" value="yes" disabled={pending} className={styles.button}>
        Use the new wording
      </button>
      <button type="submit" name="accept" value="no" disabled={pending} className={styles.link}>
        Keep my wording
      </button>
    </form>
  );
}
