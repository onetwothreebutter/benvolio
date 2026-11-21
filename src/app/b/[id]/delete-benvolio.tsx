"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import styles from "../../form.module.css";
import { deleteBenvolio } from "./actions";

/** Deleting the Benvolio for both people, after saying what that means. */
export function DeleteBenvolio({
  benvolioId,
  partnerName,
  partnerJoined,
}: {
  benvolioId: string;
  partnerName: string;
  partnerJoined: boolean;
}) {
  const [confirming, setConfirming] = useState(false);
  if (!confirming) {
    return (
      <button type="button" onClick={() => setConfirming(true)} className={styles.link}>
        Delete this Benvolio
      </button>
    );
  }
  return (
    <form action={deleteBenvolio} aria-label="Delete this Benvolio" className={styles.form}>
      <input type="hidden" name="benvolio_id" value={benvolioId} />
      <p className={styles.error}>
        {partnerJoined
          ? `This deletes it for you and ${partnerName}, with everything you both wrote.`
          : `This deletes it, and your invite to ${partnerName} stops working.`}{" "}
        You can&apos;t undo this.
      </p>
      <Confirm />
      <button type="button" onClick={() => setConfirming(false)} className={styles.link}>
        Keep it
      </button>
    </form>
  );
}

function Confirm() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={styles.button}>
      {pending ? "Deleting…" : "Delete it"}
    </button>
  );
}
