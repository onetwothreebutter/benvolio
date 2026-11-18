"use client";

import { useActionState } from "react";
import styles from "../../form.module.css";
import { InviteLink } from "../../invite-link";
import { renewInvite, type RenewState } from "./actions";

export function RenewInvite({
  benvolioId,
  partnerName,
}: {
  benvolioId: string;
  partnerName: string;
}) {
  const [state, action, pending] = useActionState<RenewState, FormData>(renewInvite, {});
  if (state.url) {
    return (
      <div className={styles.form}>
        <InviteLink url={state.url} partnerName={partnerName} />
      </div>
    );
  }
  return (
    <form action={action} className={styles.form}>
      <input type="hidden" name="benvolio_id" value={benvolioId} />
      <p className={styles.hint}>Lost the link, or did it expire? A new one replaces it.</p>
      {state.error && (
        <p role="alert" className={styles.error}>
          {state.error}
        </p>
      )}
      <button type="submit" disabled={pending} className={styles.link}>
        Make a new invite link
      </button>
    </form>
  );
}
