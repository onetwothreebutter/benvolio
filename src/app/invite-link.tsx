"use client";

import { useState } from "react";
import styles from "./form.module.css";

/** An invite link to send, with the phone's share sheet where there is one. */
export function InviteLink({ url, partnerName }: { url: string; partnerName: string }) {
  const [copied, setCopied] = useState(false);
  // Usually rendered in the browser, but the server renders it if the form was
  // sent before JavaScript loaded, hence the guard and suppressHydrationWarning.
  const canShare = typeof navigator !== "undefined" && "share" in navigator;

  async function share() {
    if (canShare) {
      await navigator.share({ title: "Benvolio", url }).catch(() => {});
    } else {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    }
  }

  return (
    <>
      <p className={styles.hint}>
        Send {partnerName} this link. It works once and expires in 30 days. They won&apos;t see your
        answers until they&apos;ve written their own.
      </p>
      <input readOnly value={url} aria-label="Invite link" className={styles.input} />
      <button type="button" onClick={share} className={styles.button} suppressHydrationWarning>
        {canShare ? "Share the link" : copied ? "Copied" : "Copy the link"}
      </button>
    </>
  );
}
