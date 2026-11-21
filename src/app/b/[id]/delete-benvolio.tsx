"use client";

import { useEffect, useRef, useState } from "react";
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
  const warning = useRef<HTMLParagraphElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const opened = useRef(false);
  // Move focus with each step, so screen readers read the warning out and it
  // scrolls into view below a long sitting form.
  useEffect(() => {
    if (confirming) warning.current?.focus();
    else if (opened.current) trigger.current?.focus();
    opened.current ||= confirming;
  }, [confirming]);

  if (!confirming) {
    return (
      <button ref={trigger} type="button" onClick={() => setConfirming(true)} className={styles.link}>
        Delete this Benvolio
      </button>
    );
  }
  return (
    <form action={deleteBenvolio} aria-label="Delete this Benvolio" className={styles.form}>
      <input type="hidden" name="benvolio_id" value={benvolioId} />
      <p ref={warning} tabIndex={-1} className={styles.error}>
        {partnerJoined
          ? `This deletes it for you and ${partnerName}, with everything you both wrote.`
          : `This deletes it, and your invite to ${partnerName} stops working.`}{" "}
        You can&apos;t undo this.
      </p>
      <Buttons onKeep={() => setConfirming(false)} />
    </form>
  );
}

function Buttons({ onKeep }: { onKeep: () => void }) {
  // Once it's sent, "Keep it" can't call it back, so it's disabled too.
  const { pending } = useFormStatus();
  return (
    <>
      <button type="submit" disabled={pending} className={styles.button}>
        {pending ? "Deleting…" : "Delete it"}
      </button>
      <button type="button" disabled={pending} onClick={onKeep} className={styles.link}>
        Keep it
      </button>
    </>
  );
}
